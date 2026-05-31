import { NextResponse } from 'next/server';
import db from '../../../database/db.js';

// 獲取用人單位資料 (職缺、合約、派駐員工、出勤紀錄)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('id');

    if (!companyId) {
      return NextResponse.json({ success: false, error: '缺少用人單位 ID' }, { status: 400 });
    }

    // 1. 公司基本資料
    const compInfo = db.prepare("SELECT * FROM company WHERE company_id = ?").get(companyId);
    if (!compInfo) {
      return NextResponse.json({ success: false, error: '找不到該用人單位' }, { status: 404 });
    }

    // 2. 公司的職缺需求
    const requests = db.prepare("SELECT * FROM job_request WHERE company_id = ? ORDER BY request_date DESC").all(companyId);

    // 3. 公司的派遣合約與目前的派駐員工
    const contracts = db.prepare(`
      SELECT c.*, m.employee_id, emp.emp_name, emp.phone as emp_phone, jr.job_title
      FROM contract c
      JOIN matching_record m ON c.matching_id = m.matching_id
      JOIN employee emp ON m.employee_id = emp.employee_id
      JOIN job_request jr ON m.request_id = jr.request_id
      WHERE c.company_id = ?
      ORDER BY c.contract_status ASC, c.start_date DESC
    `).all(companyId);

    // 4. 公司合約關聯的派遣員工出勤紀錄
    const attendances = db.prepare(`
      SELECT a.*, emp.emp_name, jr.job_title
      FROM attendance a
      JOIN contract c ON a.contract_id = c.contract_id
      JOIN matching_record m ON c.matching_id = m.matching_id
      JOIN employee emp ON m.employee_id = emp.employee_id
      JOIN job_request jr ON m.request_id = jr.request_id
      WHERE c.company_id = ?
      ORDER BY a.work_date DESC, a.attendance_id DESC
      LIMIT 100
    `).all(companyId);

    return NextResponse.json({
      success: true,
      info: compInfo,
      requests,
      contracts,
      attendances
    });
  } catch (error) {
    console.error('GET Company Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 用人單位操作 (新增職缺、確認出勤)
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, company_id } = body;

    if (!company_id) {
      return NextResponse.json({ success: false, error: '缺少用人單位 ID' }, { status: 400 });
    }

    if (action === 'add_request') {
      const { job_title, job_content, required_people, work_location, salary_range, manager_id } = body;

      if (!job_title || !required_people) {
        return NextResponse.json({ success: false, error: '缺少職缺必要資料' }, { status: 400 });
      }

      const today = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

      db.prepare(`
        INSERT INTO job_request (company_id, job_title, job_content, required_people, work_location, salary_range, request_status, request_date, manager_id)
        VALUES (?, ?, ?, ?, ?, ?, '徵才中', ?, ?)
      `).run(
        company_id,
        job_title,
        job_content || null,
        required_people,
        work_location || null,
        salary_range || null,
        today,
        manager_id || 'MGR001'
      );

      return NextResponse.json({ success: true, message: '工作需求發布成功！' });
    }

    if (action === 'verify_attendance') {
      const { attendance_id, notes, status } = body;

      if (!attendance_id || !status) {
        return NextResponse.json({ success: false, error: '缺少審查必要資料' }, { status: 400 });
      }

      // 用人單位確認出勤 (可填入確認備註或標記為正常/異常)
      db.prepare(`
        UPDATE attendance 
        SET attendance_status = ?, remarks = ?
        WHERE attendance_id = ?
      `).run(status, notes || '用人單位已確認', attendance_id);

      return NextResponse.json({ success: true, message: '出勤紀錄審核與備註成功！' });
    }

    return NextResponse.json({ success: false, error: '未知動作' }, { status: 400 });
  } catch (error) {
    console.error('POST Company Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
