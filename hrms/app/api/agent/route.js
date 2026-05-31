import { NextResponse } from 'next/server';
import db from '../../../database/db.js';

// 獲取業務員需要的數據 (職缺、待配員工、媒合、合約)
export async function GET() {
  try {
    const jobs = db.prepare(`
      SELECT jr.*, comp.company_name, comp.risk_status as comp_risk
      FROM job_request jr
      JOIN company comp ON jr.company_id = comp.company_id
      ORDER BY jr.request_date DESC
    `).all();

    const employees = db.prepare("SELECT * FROM employee ORDER BY join_date DESC").all();
    
    // 計算近 3 個月媒合成功率，低於 60% 者在前端顯示「建議技能培訓」 (實體關係基數投影片要求)
    // 成功率 = (已錄取的媒合 / 總媒合) 
    // 我們可以幫每個員工計算出來，回傳給前端
    const employeesWithSuccessRate = employees.map(emp => {
      const totalMatches = db.prepare(`
        SELECT COUNT(*) as cnt FROM matching_record 
        WHERE employee_id = ? 
          AND match_date >= date('now', 'localtime', '-3 months')
      `).get(emp.employee_id).cnt;

      const hiredMatches = db.prepare(`
        SELECT COUNT(*) as cnt FROM matching_record 
        WHERE employee_id = ? 
          AND match_status = '已錄取'
          AND match_date >= date('now', 'localtime', '-3 months')
      `).get(emp.employee_id).cnt;

      const rate = totalMatches > 0 ? Math.round((hiredMatches / totalMatches) * 100) : 100; // 無歷史媒合者預設 100
      return { ...emp, success_rate_3m: rate, total_matches_3m: totalMatches };
    });

    const matches = db.prepare(`
      SELECT mr.*, emp.emp_name, jr.job_title, comp.company_name
      FROM matching_record mr
      JOIN employee emp ON mr.employee_id = emp.employee_id
      JOIN job_request jr ON mr.request_id = jr.request_id
      JOIN company comp ON jr.company_id = comp.company_id
      ORDER BY mr.match_date DESC, mr.matching_id DESC
    `).all();

    const contracts = db.prepare(`
      SELECT c.*, comp.company_name, emp.emp_name, jr.job_title
      FROM contract c
      JOIN company comp ON c.company_id = comp.company_id
      JOIN matching_record m ON c.matching_id = m.matching_id
      JOIN employee emp ON m.employee_id = emp.employee_id
      JOIN job_request jr ON m.request_id = jr.request_id
      ORDER BY c.start_date DESC
    `).all();

    return NextResponse.json({
      success: true,
      jobs,
      employees: employeesWithSuccessRate,
      matches,
      contracts
    });
  } catch (error) {
    console.error('GET Agent Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 業務員操作 (新增媒合、變更媒合狀態、簽署合約)
export async function POST(req) {
  try {
    const body = await req.json();
    const { action } = body;

    // 1. 新增媒合
    if (action === 'create_match') {
      const { request_id, employee_id, remarks, manager_id } = body;

      if (!request_id || !employee_id) {
        return NextResponse.json({ success: false, error: '缺少必要參數' }, { status: 400 });
      }

      // 檢查員工狀態
      const emp = db.prepare("SELECT user_status, emp_name FROM employee WHERE employee_id = ?").get(employee_id);
      if (emp.user_status === '合約暫停' || emp.user_status === '強制停權') {
        return NextResponse.json({ success: false, error: `該員工目前處於「${emp.user_status}」狀態，無法推薦媒合！` }, { status: 400 });
      }

      const today = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

      db.prepare(`
        INSERT INTO matching_record (request_id, employee_id, match_date, match_status, match_manager_id, remarks)
        VALUES (?, ?, ?, '推薦中', ?, ?)
      `).run(request_id, employee_id, today, manager_id || 'MGR001', remarks || null);

      return NextResponse.json({ success: true, message: '已成功推薦員工到職缺！' });
    }

    // 2. 更新媒合狀態
    if (action === 'update_match') {
      const { matching_id, match_status, interview_date, interview_result, fail_reason, hire_reason } = body;

      if (!matching_id || !match_status) {
        return NextResponse.json({ success: false, error: '缺少必要參數' }, { status: 400 });
      }

      db.prepare(`
        UPDATE matching_record 
        SET match_status = ?, interview_date = ?, interview_result = ?, fail_reason = ?, hire_reason = ?
        WHERE matching_id = ?
      `).run(
        match_status,
        interview_date || null,
        interview_result || null,
        fail_reason || null,
        hire_reason || null,
        matching_id
      );

      // 如果錄取，更新員工狀態為在職 (此處在合約簽立後正式變更為派駐中也可，這裡我們先不做強制變更，等合約簽署)
      return NextResponse.json({ success: true, message: '媒合狀態更新成功！' });
    }

    // 3. 簽署合約 (多重合約衝突警示)
    if (action === 'create_contract') {
      const { contract_id, company_id, matching_id, start_date, end_date, contract_type, pay_type, agreed_hours, ignore_warning } = body;

      if (!contract_id || !company_id || !matching_id || !start_date || !end_date || !pay_type) {
        return NextResponse.json({ success: false, error: '缺少合約必要資料' }, { status: 400 });
      }

      // 獲取該媒合關聯的員工
      const match = db.prepare("SELECT employee_id FROM matching_record WHERE matching_id = ?").get(matching_id);
      if (!match) {
        return NextResponse.json({ success: false, error: '找不到該媒合紀錄' }, { status: 404 });
      }
      const employeeId = match.employee_id;

      // 檢查公司是否處於財務風險狀態
      const comp = db.prepare("SELECT company_name, risk_status FROM company WHERE company_id = ?").get(company_id);
      if (comp && comp.risk_status === '財務風險') {
        return NextResponse.json({ success: false, error: `無法建立合約：該用人單位「${comp.company_name}」有財務風險，系統已禁止新增媒合與合約！` }, { status: 400 });
      }

      // 檢查多重合約衝突 (時間重疊)
      // 若時間有重疊且用戶未點選「確認強制簽立」(ignore_warning)
      if (!ignore_warning) {
        const overlapContracts = db.prepare(`
          SELECT c.contract_id, comp.company_name, c.start_date, c.end_date
          FROM contract c
          JOIN company comp ON c.company_id = comp.company_id
          JOIN matching_record m ON c.matching_id = m.matching_id
          WHERE m.employee_id = ? 
            AND c.contract_status = '執行中'
            AND (
              (c.start_date <= ? AND ? <= c.end_date) OR
              (c.start_date <= ? AND ? <= c.end_date) OR
              (? <= c.start_date AND c.end_date <= ?)
            )
        `).all(employeeId, start_date, start_date, end_date, end_date, start_date, end_date);

        if (overlapContracts.length > 0) {
          const overlapInfo = overlapContracts.map(o => `${o.company_name} (${o.start_date} ~ ${o.end_date})`).join(', ');
          
          // 寫入系統日誌
          db.prepare(`
            INSERT INTO system_logs (log_type, message)
            VALUES ('WARN', '檢測到合約簽署衝突警告！員工ID：' || ? || ' 與既有合約 ' || ? || ' 時間重疊。')
          `).run(employeeId, overlapContracts[0].contract_id);

          return NextResponse.json({
            success: false,
            hasConflict: true,
            message: `[法律風險警示] 該員工於相同期間內已與其他公司簽有執行中合約：${overlapInfo}。是否仍要強制簽署？`
          });
        }
      }

      // 執行合約寫入
      db.prepare(`
        INSERT INTO contract (contract_id, company_id, matching_id, start_date, end_date, contract_status, contract_type, pay_type, agreed_hours)
        VALUES (?, ?, ?, ?, ?, '執行中', ?, ?, ?)
      `).run(contract_id, company_id, matching_id, start_date, end_date, contract_type || '長期派遣', pay_type, agreed_hours || 8.00);

      // 同時更新媒合狀態為 '已錄取' (以防未變更)
      db.prepare("UPDATE matching_record SET match_status = '已錄取' WHERE matching_id = ?").run(matching_id);

      // 更新員工為在職
      db.prepare("UPDATE employee SET job_status = '派駐中' WHERE employee_id = ?").run(employeeId);

      // 更新對應職缺的狀態 (若有滿額可以手動關閉，這裡只記錄成功)
      return NextResponse.json({ success: true, message: '合約簽署成功，員工已正式派駐！' });
    }

    return NextResponse.json({ success: false, error: '未知動作' }, { status: 400 });
  } catch (error) {
    console.error('POST Agent Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
