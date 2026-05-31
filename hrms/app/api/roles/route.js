import { NextResponse } from 'next/server';
import db, { checkAndUpdateSystemStates } from '../../../database/db.js';

export async function GET() {
  try {
    // 每次拿取角色列表前，自動同步一次過期狀態，保持數據最新
    checkAndUpdateSystemStates();

    const employees = db.prepare("SELECT employee_id, emp_name, user_status, job_status FROM employee").all();
    const companies = db.prepare("SELECT company_id, company_name, risk_status FROM company").all();
    const logs = db.prepare("SELECT * FROM system_logs ORDER BY log_id DESC LIMIT 50").all();

    return NextResponse.json({
      success: true,
      employees,
      companies,
      logs
    });
  } catch (error) {
    console.error('API Roles Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
