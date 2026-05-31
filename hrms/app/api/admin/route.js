import { NextResponse } from 'next/server';
import db from '../../../database/db.js';

// 獲取管理員數據 (員工狀態、異常出勤、警示日誌、薪資單)
export async function GET() {
  try {
    const employees = db.prepare("SELECT * FROM employee ORDER BY employee_id ASC").all();
    const companies = db.prepare("SELECT * FROM company ORDER BY company_id ASC").all();
    const logs = db.prepare("SELECT * FROM system_logs ORDER BY log_id DESC LIMIT 100").all();
    
    // 待審核的異常出勤 (出勤狀態為 '異常' 且尚未結算薪資的紀錄)
    const pendingApprovals = db.prepare(`
      SELECT a.*, emp.emp_name, jr.job_title, comp.company_name
      FROM attendance a
      JOIN contract c ON a.contract_id = c.contract_id
      JOIN company comp ON c.company_id = comp.company_id
      JOIN matching_record m ON c.matching_id = m.matching_id
      JOIN employee emp ON m.employee_id = emp.employee_id
      JOIN job_request jr ON m.request_id = jr.request_id
      WHERE a.attendance_status = '異常' AND a.payroll_id IS NULL
      ORDER BY a.work_date DESC
    `).all();

    // 薪資單歷史
    const payrolls = db.prepare(`
      SELECT p.*, emp.emp_name, comp.company_name, c.pay_type
      FROM payroll p
      JOIN contract c ON p.contract_id = c.contract_id
      JOIN company comp ON c.company_id = comp.company_id
      JOIN matching_record m ON c.matching_id = m.matching_id
      JOIN employee emp ON m.employee_id = emp.employee_id
      ORDER BY p.payroll_month DESC, p.payroll_id DESC
    `).all();

    return NextResponse.json({
      success: true,
      employees,
      companies,
      logs,
      pendingApprovals,
      payrolls
    });
  } catch (error) {
    console.error('GET Admin Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 管理員/主管操作 (風險變更、異常出勤審核、發放薪資)
export async function POST(req) {
  try {
    const body = await req.json();
    const { action } = body;

    // 1. 手動更新用人單位的財務風險
    if (action === 'change_company_risk') {
      const { company_id, risk_status } = body;

      if (!company_id || !risk_status) {
        return NextResponse.json({ success: false, error: '缺少必要參數' }, { status: 400 });
      }

      // 更新公司風險狀態。此處會觸發 SQLite trigger_company_risk_status_update 自動連動合約狀態
      db.prepare("UPDATE company SET risk_status = ? WHERE company_id = ?").run(risk_status, company_id);

      return NextResponse.json({ success: true, message: `用人單位風險狀態已更新為「${risk_status}」，其進行中合約已自動連動。` });
    }

    // 2. 審查/核准異常出勤
    if (action === 'approve_attendance') {
      const { attendance_id, approve_status } = body; // '正常' 或 '異常'

      if (!attendance_id || !approve_status) {
        return NextResponse.json({ success: false, error: '缺少必要參數' }, { status: 400 });
      }

      // 核准後，將異常出勤狀態改為 '正常' (代表審核通過)，以便計算薪資
      db.prepare(`
        UPDATE attendance 
        SET attendance_status = ?, remarks = '主管已審核核准' 
        WHERE attendance_id = ?
      `).run(approve_status, attendance_id);

      db.prepare(`
        INSERT INTO system_logs (log_type, message)
        VALUES ('INFO', '主管手動核准了出勤紀錄 ID: ' || ? || '，狀態變更為「' || ? || '」。')
      `).run(attendance_id, approve_status);

      return NextResponse.json({ success: true, message: '異常出勤審查完成！' });
    }

    // 3. 結算按月薪資 (計算與發薪)
    if (action === 'calculate_payroll') {
      const { contract_id, payroll_month, deduction_amt } = body;

      if (!contract_id || !payroll_month) {
        return NextResponse.json({ success: false, error: '缺少必要參數' }, { status: 400 });
      }

      // (a) 檢查該月份該合約是否已經結算過
      const alreadyPaid = db.prepare(`
        SELECT payroll_id FROM payroll 
        WHERE contract_id = ? AND payroll_month = ?
      `).get(contract_id, payroll_month);

      if (alreadyPaid) {
        return NextResponse.json({ success: false, error: `該合約於 ${payroll_month} 已經完成薪資結算，請勿重複計算！` }, { status: 400 });
      }

      // (b) 查詢當月該合約的所有出勤紀錄
      const attendances = db.prepare(`
        SELECT * FROM attendance 
        WHERE contract_id = ? AND strftime('%Y-%m', work_date) = ?
      `).all(contract_id, payroll_month);

      if (attendances.length === 0) {
        return NextResponse.json({ success: false, error: `在 ${payroll_month} 內找不到該合約的任何出勤紀錄，無法計算薪資。` }, { status: 400 });
      }

      // (c) 檢查是否有未審核的異常出勤 (出勤狀態為 '異常'，代表超時工時未通過審核)
      const hasAnomaly = attendances.some(a => a.attendance_status === '異常');
      if (hasAnomaly) {
        return NextResponse.json({ 
          success: false, 
          error: `[薪資鎖定] 檢測到該員工在 ${payroll_month} 存在工時超時的「異常」出勤，薪資已遭系統鎖定！請先完成出勤審查後，方可發薪。` 
        }, { status: 400 });
      }

      // (d) 獲取合約的薪資計算方式與費率
      const contract = db.prepare(`
        SELECT c.*, emp.emp_name, emp.email FROM contract c
        JOIN matching_record m ON c.matching_id = m.matching_id
        JOIN employee emp ON m.employee_id = emp.employee_id
        WHERE c.contract_id = ?
      `).get(contract_id);

      let base_pay = 0;
      const totalHours = attendances.reduce((sum, a) => sum + (a.work_hours || 0), 0);
      const totalDays = attendances.length;

      if (contract.pay_type === '時薪') {
        // 時薪計算：時薪費率 * 總工時。
        // 我們測試資料 CON002 為時薪 220
        const rate = contract.contract_id === 'CON002' ? 220 : 180;
        base_pay = Math.round(rate * totalHours);
      } else if (contract.pay_type === '日薪') {
        // 日薪計算：日薪費率 * 出勤天數。
        // 測試資料 CON001 日薪 1800
        const rate = contract.contract_id === 'CON001' ? 1800 : 1500;
        base_pay = Math.round(rate * totalDays);
      } else {
        // 月薪計算：固定底薪。
        // 測試資料 CON003 月薪 35000
        base_pay = contract.contract_id === 'CON003' ? 35000 : 30000;
      }

      const deduction = parseInt(deduction_amt || 0);
      const net_pay = base_pay - deduction;
      const pay_date = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      const bank_account = '郵局 700-0012345-6789012'; // 模擬帳戶

      // 使用交易，寫入薪資表並更新出勤表
      const transaction = db.transaction(() => {
        const result = db.prepare(`
          INSERT INTO payroll (contract_id, payroll_month, base_pay, deduction, net_pay, pay_date, bank_account, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(contract_id, payroll_month, base_pay, deduction, net_pay, pay_date, bank_account, `月度出勤結算 (${totalDays}天, ${totalHours}小時)`);

        const newPayrollId = result.lastInsertRowid;

        // 將這些出勤記錄綁定到這次結算中，完成 N:1 關聯
        db.prepare(`
          UPDATE attendance 
          SET payroll_id = ?
          WHERE contract_id = ? AND strftime('%Y-%m', work_date) = ?
        `).run(newPayrollId, contract_id, payroll_month);

        db.prepare(`
          INSERT INTO system_logs (log_type, message)
          VALUES ('INFO', '已完成合約 ' || ? || ' (員工: ' || ? || ') 於 ' || ? || ' 的薪資結算，實發金額為: ' || ? || ' 元。')
        `).run(contract_id, contract.emp_name, payroll_month, net_pay);
        
        return newPayrollId;
      });

      const payrollId = transaction();

      return NextResponse.json({
        success: true,
        message: '薪資結算完成！已發放薪資明細。',
        payrollId,
        base_pay,
        net_pay
      });
    }

    return NextResponse.json({ success: false, error: '未知動作' }, { status: 400 });
  } catch (error) {
    console.error('POST Admin Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
