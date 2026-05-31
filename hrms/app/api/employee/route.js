import { NextResponse } from 'next/server';
import db, { checkAndUpdateSystemStates } from '../../../database/db.js';

// 獲取員工的完整資料（合約、出勤、薪資、證照）
export async function GET(req) {
  try {
    // 先執行全域系統狀態檢查與自動更新
    checkAndUpdateSystemStates();

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('id');

    if (!employeeId) {
      return NextResponse.json({ success: false, error: '缺少員工 ID' }, { status: 400 });
    }

    // 1. 員工基本資料
    const empInfo = db.prepare("SELECT * FROM employee WHERE employee_id = ?").get(employeeId);
    if (!empInfo) {
      return NextResponse.json({ success: false, error: '找不到該員工' }, { status: 404 });
    }

    // 2. 員工的合約
    const contracts = db.prepare(`
      SELECT c.*, comp.company_name 
      FROM contract c
      JOIN company comp ON c.company_id = comp.company_id
      JOIN matching_record m ON c.matching_id = m.matching_id
      WHERE m.employee_id = ?
      ORDER BY c.start_date DESC
    `).all(employeeId);

    // 3. 員工的出勤歷史
    const attendances = db.prepare(`
      SELECT a.*, c.contract_id, comp.company_name
      FROM attendance a
      JOIN contract c ON a.contract_id = c.contract_id
      JOIN company comp ON c.company_id = comp.company_id
      JOIN matching_record m ON c.matching_id = m.matching_id
      WHERE m.employee_id = ?
      ORDER BY a.work_date DESC, a.attendance_id DESC
      LIMIT 100
    `).all(employeeId);

    // 4. 員工的薪資單
    const payrolls = db.prepare(`
      SELECT p.*, c.contract_id, comp.company_name
      FROM payroll p
      JOIN contract c ON p.contract_id = c.contract_id
      JOIN company comp ON c.company_id = comp.company_id
      JOIN matching_record m ON c.matching_id = m.matching_id
      WHERE m.employee_id = ?
      ORDER BY p.payroll_month DESC
    `).all(employeeId);

    // 5. 員工的證照
    const certs = db.prepare("SELECT * FROM cert WHERE employee_id = ? ORDER BY expiry_date ASC").all(employeeId);

    return NextResponse.json({
      success: true,
      info: empInfo,
      contracts,
      attendances,
      payrolls,
      certs
    });
  } catch (error) {
    console.error('GET Employee Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 員工操作（打卡、上傳證照）
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, employee_id } = body;

    if (!employee_id) {
      return NextResponse.json({ success: false, error: '缺少員工 ID' }, { status: 400 });
    }

    // 取得該員工是否有進行中且無財務風險的合約
    const activeContract = db.prepare(`
      SELECT c.contract_id, c.contract_status
      FROM contract c
      JOIN matching_record m ON c.matching_id = m.matching_id
      WHERE m.employee_id = ? AND c.contract_status = '執行中'
      LIMIT 1
    `).get(employee_id);

    if (action === 'clock_in') {
      if (!activeContract) {
        return NextResponse.json({ success: false, error: '您目前沒有處於「執行中」狀態的派遣合約，無法打卡打卡！' }, { status: 400 });
      }

      const today = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      
      // 檢查今天是否已打卡上班
      const alreadyClocked = db.prepare(`
        SELECT attendance_id FROM attendance 
        WHERE contract_id = ? AND work_date = ?
      `).get(activeContract.contract_id, today);

      if (alreadyClocked) {
        return NextResponse.json({ success: false, error: '您今日已完成上班打卡！' }, { status: 400 });
      }

      const nowTimeStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }).replace(/\//g, '-');

      // 執行打卡。此處若員工證照失效，將會被 SQLite trigger_check_cert_status_before_attendance 阻擋
      try {
        db.prepare(`
          INSERT INTO attendance (contract_id, work_date, clock_in, clock_out, work_hours, attendance_status, remarks, payroll_id)
          VALUES (?, ?, ?, NULL, 0, '正常', '正常打卡', NULL)
        `).run(activeContract.contract_id, today, nowTimeStr);
      } catch (sqlError) {
        // 捕獲 Trigger 3 拋出的阻擋訊息
        return NextResponse.json({ success: false, error: sqlError.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: '上班打卡成功！時間：' + nowTimeStr });
    }

    if (action === 'clock_out') {
      if (!activeContract) {
        return NextResponse.json({ success: false, error: '找不到執行中合約' }, { status: 400 });
      }

      const today = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

      // 尋找今日尚未打卡下班的紀錄
      const todayAttendance = db.prepare(`
        SELECT * FROM attendance 
        WHERE contract_id = ? AND work_date = ? AND clock_out IS NULL
      `).get(activeContract.contract_id, today);

      if (!todayAttendance) {
        return NextResponse.json({ success: false, error: '找不到今日的上班打卡紀錄，或您今日已完成下班打卡。' }, { status: 400 });
      }

      const nowTimeStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }).replace(/\//g, '-');
      
      // 計算工時
      const clockInTime = new Date(todayAttendance.clock_in);
      const clockOutTime = new Date(nowTimeStr);
      const diffMs = clockOutTime - clockInTime;
      const hours = Math.max(0.1, parseFloat((diffMs / 3600000).toFixed(2))); // 最小 0.1 小時

      // 更新下班打卡與工時
      // 此處更新工時大於 12 將會觸發 SQLite trigger_check_attendance_hours_update，自動標記狀態為 '異常' 並寫入 system_logs
      db.prepare(`
        UPDATE attendance 
        SET clock_out = ?, work_hours = ?
        WHERE attendance_id = ?
      `).run(nowTimeStr, hours, todayAttendance.attendance_id);

      // 檢查是否被 Trigger 標記為異常 (以便前端顯示對應超時提示)
      const updatedRecord = db.prepare("SELECT attendance_status FROM attendance WHERE attendance_id = ?").get(todayAttendance.attendance_id);

      return NextResponse.json({ 
        success: true, 
        message: `下班打卡成功！累計工時: ${hours} 小時。` + 
                 (updatedRecord.attendance_status === '異常' ? ' (⚠️ 工時超過 12 小時，已被系統標記為異常)' : ''),
        hours 
      });
    }

    if (action === 'add_cert') {
      const { cert_id, cert_name, expiry_date, issue_org } = body;

      if (!cert_id || !cert_name || !expiry_date) {
        return NextResponse.json({ success: false, error: '缺少證照必要資料' }, { status: 400 });
      }

      // 判斷證照狀態
      const expiry = new Date(expiry_date);
      const today = new Date();
      const diffTime = expiry - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let cert_status = '有效';
      if (diffDays < 0) {
        cert_status = '已失效';
      } else if (diffDays <= 90) {
        cert_status = '即將到期';
      }

      // 插入證照
      db.prepare(`
        INSERT INTO cert (cert_id, employee_id, cert_name, expiry_date, issue_org, cert_status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(cert_id, employee_id, cert_name, expiry_date, issue_org || null, cert_status);

      return NextResponse.json({ success: true, message: '證照上傳成功！' });
    }

    return NextResponse.json({ success: false, error: '未知動作' }, { status: 400 });
  } catch (error) {
    console.error('POST Employee Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
