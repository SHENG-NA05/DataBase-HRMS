import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'database.db');
const SCHEMA_PATH = path.join(process.cwd(), 'database', 'schema.sql');

let db;

if (process.env.NODE_ENV === 'production') {
  db = new Database(DB_PATH);
} else {
  // 防止 Next.js 熱重載時重置連線
  if (!global.db) {
    global.db = new Database(DB_PATH);
  }
  db = global.db;
}

// 啟用外鍵約束
db.pragma('foreign_keys = ON');

// 初始化資料庫
export function initDB() {
  // 檢查是否已建表 (例如 company 表是否存在)
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='company'").get();
  
  if (!tableCheck) {
    console.log('--- 開始初始化資料庫 Schema 與 Triggers ---');
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schemaSql);
    console.log('--- 資料庫 Schema 與 Triggers 初始化完成 ---');
    
    // 插入測試資料 (Seed Data)
    seedData();
  }
}

function seedData() {
  console.log('--- 開始導入測試資料 ---');
  
  // 1. 用人單位
  const insertCompany = db.prepare(`
    INSERT INTO company (company_id, company_name, company_address, company_type, risk_status, phone, contact_person)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  insertCompany.run('COMP001', '科技巨擘-台積電', '新竹科學園區力行六路8號', '半導體製造', '正常', '03-5636688', '張經理');
  insertCompany.run('COMP002', '智慧晶片-聯發科', '新竹科學園區篤行一路1號', 'IC設計', '正常', '03-5670766', '林小姐');
  insertCompany.run('COMP003', '藍天餐飲集團', '台北市信義區松智路17號', '餐飲服務', '正常', '02-27208888', '陳主管');

  // 2. 工作需求
  const insertJob = db.prepare(`
    INSERT INTO job_request (company_id, job_title, job_content, required_people, work_location, salary_range, request_status, request_date, manager_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  insertJob.run('COMP001', '半導體生產助理', '負責無塵室內機台操作、晶圓搬運、生產數據記錄，需輪班。', 3, '新竹科學園區', '日薪 1,800 元', '徵才中', '2026-05-10', 'MGR001');
  insertJob.run('COMP001', '設備維護技術員', '負責半導體機台日常保養、故障排除、零件更換與效能調校。', 2, '新竹科學園區', '時薪 200 元', '徵才中', '2026-05-12', 'MGR001');
  insertJob.run('COMP002', '軟體開發測試助理', '協助測試軟體功能、撰寫測試報告、回報 Bug，需懂基本 Python。', 1, '新竹科學園區', '月薪 35,000 元', '徵才中', '2026-05-15', 'MGR002');
  insertJob.run('COMP003', '外場服務專員', '客人在店內的帶位、點餐、送餐、整理環境，排班制。', 5, '台北市信義區', '時薪 190 元', '徵才中', '2026-05-20', 'MGR003');

  // 3. 派遣員工
  const insertEmployee = db.prepare(`
    INSERT INTO employee (employee_id, emp_name, gender, birth_date, phone, email, address, join_date, job_status, user_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  insertEmployee.run('EMP001', '陳小明', '男', '1998-05-12', '0912-345678', 'xiaoming@email.com', '新竹市東區光復路二段101號', '2026-01-15', '派駐中', '啟用');
  insertEmployee.run('EMP002', '林美玲', '女', '1995-10-22', '0922-111222', 'meiling@email.com', '新竹縣竹北市光明六路88號', '2026-02-01', '派駐中', '啟用');
  insertEmployee.run('EMP003', '王小華', '男', '2000-08-05', '0933-444555', 'xiaohua@email.com', '新竹市北區大同路50號', '2026-03-10', '派駐中', '啟用');
  insertEmployee.run('EMP004', '張大同', '男', '1992-03-30', '0955-666777', 'datong@email.com', '苗栗縣竹南鎮科學路12號', '2025-11-20', '待業中', '強制停權');
  insertEmployee.run('EMP005', '李小虎', '男', '2002-12-18', '0988-777666', 'xiaohu@email.com', '台北市大安區和平東路三段20號', '2026-05-01', '待業中', '啟用');

  // 4. 證照資料
  const insertCert = db.prepare(`
    INSERT INTO cert (cert_id, employee_id, cert_name, expiry_date, issue_org, cert_status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  // 陳小明的丙級證照已失效 (用來測試打卡 Trigger 阻擋)
  insertCert.run('CERT001', 'EMP001', '電腦硬體裝修丙級技術士', '2026-04-30', '勞動部勞動力發展署', '已失效');
  insertCert.run('CERT002', 'EMP002', '勞工安全衛生管理員甲級', '2028-12-31', '勞動部職業安全衛生署', '有效');
  insertCert.run('CERT002_B', 'EMP002', '專科護理師證書', '2026-06-15', '衛生福利部', '即將到期');
  insertCert.run('CERT003', 'EMP003', 'TQC-OA 辦公軟體應用-Word', '2029-05-20', '電腦技能基金會', '有效');

  // 5. 媒合紀錄
  const insertMatch = db.prepare(`
    INSERT INTO matching_record (request_id, employee_id, match_date, match_status, interview_date, interview_result, fail_reason, hire_reason, match_manager_id, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  // 已錄取
  insertMatch.run(1, 'EMP001', '2026-05-14', '已錄取', '2026-05-18', '錄取', null, '具備機台操作基本知識，學習態度佳。', 'MGR001', '推薦至台積電生產助理');
  insertMatch.run(2, 'EMP002', '2026-05-15', '已錄取', '2026-05-19', '錄取', null, '具備工安衛管理員證照，極符合廠區工安需求。', 'MGR001', '推薦至台積電設備技術員');
  insertMatch.run(3, 'EMP003', '2026-05-18', '已錄取', '2026-05-22', '錄取', null, '具備基礎程式測試能力，細心度足。', 'MGR002', '推薦至聯發科軟體測試');
  
  // 其他媒合狀態
  insertMatch.run(4, 'EMP005', '2026-05-22', '推薦中', null, null, null, null, 'MGR003', '推薦李小虎至藍天餐飲外場');
  insertMatch.run(3, 'EMP005', '2026-05-20', '面試中', '2026-06-02', null, null, null, 'MGR002', '李小虎聯發科二面中');

  // 6. 派遣合約
  const insertContract = db.prepare(`
    INSERT INTO contract (contract_id, company_id, matching_id, start_date, end_date, contract_status, contract_type, pay_type, agreed_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  insertContract.run('CON001', 'COMP001', 1, '2026-05-20', '2026-11-20', '執行中', '長期派遣', '日薪', 8.00);
  insertContract.run('CON002', 'COMP001', 2, '2026-05-20', '2026-08-20', '執行中', '短期派遣', '時薪', 8.00);
  insertContract.run('CON003', 'COMP002', 3, '2026-05-25', '2027-05-25', '執行中', '長期派遣', '月薪', 8.00);

  // 7. 出勤紀錄
  const insertAttendance = db.prepare(`
    INSERT INTO attendance (contract_id, work_date, clock_in, clock_out, work_hours, attendance_status, remarks, payroll_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  // CON002 (林美玲) 的正常出勤
  insertAttendance.run('CON002', '2026-05-25', '2026-05-25 09:00:00', '2026-05-25 18:00:00', 8.00, '正常', '正常出勤', null);
  insertAttendance.run('CON002', '2026-05-26', '2026-05-26 09:00:00', '2026-05-26 17:30:00', 7.50, '正常', '提早完成工作離廠', null);

  // CON003 (王小華) 的正常出勤
  insertAttendance.run('CON003', '2026-05-26', '2026-05-26 09:00:00', '2026-05-26 18:00:00', 8.00, '正常', '正常出勤', null);
  insertAttendance.run('CON003', '2026-05-27', '2026-05-27 08:55:00', '2026-05-27 18:05:00', 8.00, '正常', '正常出勤', null);

  // 注意：我們不能直接在這裡插入工時 > 12 的出勤，否則會因為打卡 Trigger (Trigger 3 證照過期) 或是 Trigger 1 (工時超時) 觸發。
  // 等等！陳小明 (EMP001) 的合約是 CON001。因為陳小明有「已失效」證照，
  // 依照 Trigger 3 (trigger_check_cert_status_before_attendance)，對 CON001 進行 INSERT 就會拋出異常！
  // 為了讓 Seed Data 可以順利插入歷史出勤（在證照失效前），我們可以先插入出勤，最後再插入過期證照，或是暫時停用外鍵/Triggers？
  // 在 SQLite 中，我們可以先插入出勤數據，之後再插入過期證照。或是，我們先插入正常出勤。
  // 我們這裡為了展示，先插入林美玲和王小華的出勤。陳小明的出勤我們可以在前端打卡時，特意給出錯誤提示，用來展示 Trigger 3。
  // 不過，我們也可以在 seed 裡為林美玲 (CON002) 插入一筆超過 12 小時的出勤，來展示 Trigger 1：
  insertAttendance.run('CON002', '2026-05-27', '2026-05-27 08:00:00', '2026-05-27 21:00:00', 13.00, '正常', '設備緊急搶修', null);
  // 這筆記錄插入時，因為 work_hours = 13.00 > 12，會自動被 trigger_check_attendance_hours_insert 設為 '異常'，並新增警告日誌！

  console.log('--- 測試資料導入完成 ---');
  
  // 導入後立即跑一次狀態同步
  checkAndUpdateSystemStates();
}

// 全域狀態檢查與同步函數 (模擬 Cron 任務或 Hook 檢查)
export function checkAndUpdateSystemStates() {
  console.log('--- 執行全域系統狀態檢查與自動更新 ---');
  
  // 使用 transaction 來確保一致性
  const transaction = db.transaction(() => {
    // 1. 證照到期狀態更新
    // (a) 90天內到期 -> 變更為 '即將到期'
    db.prepare(`
      UPDATE cert 
      SET cert_status = '即將到期' 
      WHERE date('now', 'localtime') <= expiry_date 
        AND expiry_date <= date('now', 'localtime', '+90 days') 
        AND cert_status = '有效'
    `).run();

    // (b) 已過期 -> 變更為 '已失效'
    const expiredCerts = db.prepare(`
      SELECT DISTINCT employee_id FROM cert 
      WHERE expiry_date < date('now', 'localtime') 
        AND cert_status != '已失效'
    `).all();

    if (expiredCerts.length > 0) {
      db.prepare(`
        UPDATE cert 
        SET cert_status = '已失效' 
        WHERE expiry_date < date('now', 'localtime') 
          AND cert_status != '已失效'
      `).run();

      // (c) 將擁有失效證照的員工狀態設為 '合約暫停'
      for (const certOfEmp of expiredCerts) {
        const emp = db.prepare("SELECT emp_name, user_status FROM employee WHERE employee_id = ?").get(certOfEmp.employee_id);
        if (emp && emp.user_status === '啟用') {
          db.prepare("UPDATE employee SET user_status = '合約暫停' WHERE employee_id = ?").run(certOfEmp.employee_id);
          
          db.prepare(`
            INSERT INTO system_logs (log_type, message)
            VALUES ('WARN', '員工 ' || ? || ' (' || ? || ') 持有的證照已過期，系統已自動將其狀態設為「合約暫停」並關閉其打卡權限。')
          `).run(emp.emp_name, certOfEmp.employee_id);
        }
      }
    }

    // 2. 合約到期狀態更新
    // (a) 找出今天過期但狀態為執行中的合約
    const expiredContracts = db.prepare(`
      SELECT contract_id, c.company_id, comp.company_name, m.employee_id, emp.emp_name
      FROM contract c
      JOIN company comp ON c.company_id = comp.company_id
      JOIN matching_record m ON c.matching_id = m.matching_id
      JOIN employee emp ON m.employee_id = emp.employee_id
      WHERE date('now', 'localtime') > c.end_date 
        AND c.contract_status = '執行中'
    `).all();

    if (expiredContracts.length > 0) {
      // 更新合約為 '已到期'
      db.prepare(`
        UPDATE contract 
        SET contract_status = '已到期' 
        WHERE date('now', 'localtime') > end_date 
          AND contract_status = '執行中'
      `).run();

      for (const con of expiredContracts) {
        db.prepare(`
          INSERT INTO system_logs (log_type, message)
          VALUES ('INFO', '合約 ' || ? || ' (員工: ' || ? || ', 用人單位: ' || ? || ') 已於 ' || 
                  (SELECT end_date FROM contract WHERE contract_id = ?) || ' 到期，狀態更新為「已到期」。')
        `).run(con.contract_id, con.emp_name, con.company_name, con.contract_id);

        // (b) 如果該員工沒有其他執行中的合約，則將員工在職狀態改為 '待業中'
        const activeContractsCount = db.prepare(`
          SELECT COUNT(*) as cnt 
          FROM contract c
          JOIN matching_record m ON c.matching_id = m.matching_id
          WHERE m.employee_id = ? AND c.contract_status = '執行中'
        `).get(con.employee_id).cnt;

        if (activeContractsCount === 0) {
          db.prepare("UPDATE employee SET job_status = '待業中' WHERE employee_id = ?").run(con.employee_id);
          db.prepare(`
            INSERT INTO system_logs (log_type, message)
            VALUES ('INFO', '員工 ' || ? || ' (' || ? || ') 已無其他進行中的派遣合約，在職狀態自動更新為「待業中」。')
          `).run(con.emp_name, con.employee_id);
        }
      }
    }
  });

  transaction();
  console.log('--- 系統狀態更新與同步檢查完成 ---');
}

export default db;
