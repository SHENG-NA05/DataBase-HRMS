-- 啟用外鍵約束
PRAGMA foreign_keys = ON;

-- 1. 用人單位
CREATE TABLE IF NOT EXISTS company (
    company_id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    company_address TEXT,
    company_type TEXT,
    risk_status TEXT DEFAULT '正常', -- 正常 / 財務風險
    phone TEXT,
    contact_person TEXT
);

-- 2. 工作需求
CREATE TABLE IF NOT EXISTS job_request (
    request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    job_title TEXT NOT NULL,
    job_content TEXT,
    required_people INTEGER DEFAULT 1,
    work_location TEXT,
    salary_range TEXT,
    request_status TEXT DEFAULT '徵才中', -- 徵才中 / 已徵滿 / 關閉
    request_date TEXT, -- YYYY-MM-DD
    manager_id TEXT,
    FOREIGN KEY(company_id) REFERENCES company(company_id) ON DELETE CASCADE
);

-- 3. 派遣員工
CREATE TABLE IF NOT EXISTS employee (
    employee_id TEXT PRIMARY KEY,
    emp_name TEXT NOT NULL,
    gender TEXT,
    birth_date TEXT, -- YYYY-MM-DD
    phone TEXT,
    email TEXT,
    address TEXT,
    join_date TEXT, -- YYYY-MM-DD
    job_status TEXT DEFAULT '待業中', -- 待業中 / 派駐中
    user_status TEXT DEFAULT '啟用' -- 啟用 / 合約暫停 / 強制停權
);

-- 4. 媒合紀錄
CREATE TABLE IF NOT EXISTS matching_record (
    matching_id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    employee_id TEXT NOT NULL,
    match_date TEXT, -- YYYY-MM-DD
    match_status TEXT DEFAULT '推薦中', -- 推薦中 / 面試中 / 已錄取 / 未錄取
    interview_date TEXT, -- YYYY-MM-DD
    interview_result TEXT,
    fail_reason TEXT,
    hire_reason TEXT,
    match_manager_id TEXT,
    remarks TEXT,
    FOREIGN KEY(request_id) REFERENCES job_request(request_id) ON DELETE CASCADE,
    FOREIGN KEY(employee_id) REFERENCES employee(employee_id) ON DELETE CASCADE
);

-- 5. 派遣合約
CREATE TABLE IF NOT EXISTS contract (
    contract_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    matching_id INTEGER NOT NULL UNIQUE,
    start_date TEXT NOT NULL, -- YYYY-MM-DD
    end_date TEXT NOT NULL, -- YYYY-MM-DD
    contract_status TEXT DEFAULT '執行中', -- 執行中 / 已到期 / 財務風險
    contract_type TEXT, -- 長期派遣 / 短期兼任
    pay_type TEXT, -- 時薪 / 日薪 / 月薪
    agreed_hours REAL,
    FOREIGN KEY(company_id) REFERENCES company(company_id) ON DELETE CASCADE,
    FOREIGN KEY(matching_id) REFERENCES matching_record(matching_id) ON DELETE CASCADE
);

-- 6. 薪資資料 (N:1, 薪資以月為單位)
CREATE TABLE IF NOT EXISTS payroll (
    payroll_id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id TEXT NOT NULL,
    payroll_month TEXT NOT NULL, -- YYYY-MM
    base_pay INTEGER NOT NULL, -- 應發金額
    deduction INTEGER DEFAULT 0, -- 扣款金額
    net_pay INTEGER NOT NULL, -- 實發金額
    pay_date TEXT, -- YYYY-MM-DD
    bank_account TEXT,
    remarks TEXT,
    FOREIGN KEY(contract_id) REFERENCES contract(contract_id) ON DELETE CASCADE
);

-- 7. 出勤紀錄
CREATE TABLE IF NOT EXISTS attendance (
    attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id TEXT NOT NULL,
    work_date TEXT NOT NULL, -- YYYY-MM-DD
    clock_in TEXT, -- YYYY-MM-DD HH:MM:SS
    clock_out TEXT, -- YYYY-MM-DD HH:MM:SS
    work_hours REAL,
    attendance_status TEXT DEFAULT '正常', -- 正常 / 超時加班 / 異常
    remarks TEXT,
    payroll_id INTEGER, -- 結算時填入
    FOREIGN KEY(contract_id) REFERENCES contract(contract_id) ON DELETE CASCADE,
    FOREIGN KEY(payroll_id) REFERENCES payroll(payroll_id) ON DELETE SET NULL
);

-- 8. 證照資料
CREATE TABLE IF NOT EXISTS cert (
    cert_id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    cert_name TEXT NOT NULL,
    expiry_date TEXT NOT NULL, -- YYYY-MM-DD
    issue_org TEXT,
    cert_status TEXT DEFAULT '有效', -- 有效 / 即將到期 / 已失效
    FOREIGN KEY(employee_id) REFERENCES employee(employee_id) ON DELETE CASCADE
);

-- 9. 系統警示日誌
CREATE TABLE IF NOT EXISTS system_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_type TEXT NOT NULL, -- INFO, WARN, ERROR
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);


-- ==========================================
-- Triggers (觸發器) 定義
-- ==========================================

-- Trigger 1.1: 出勤紀錄插入時，單日工時 > 12 自動將狀態變為 '異常'，並記日誌
CREATE TRIGGER IF NOT EXISTS trigger_check_attendance_hours_insert
AFTER INSERT ON attendance
WHEN NEW.work_hours > 12
BEGIN
    UPDATE attendance 
    SET attendance_status = '異常' 
    WHERE attendance_id = NEW.attendance_id;
    
    INSERT INTO system_logs (log_type, message)
    VALUES ('WARN', '員工單日工時超時！合約ID：' || NEW.contract_id || '，日期：' || NEW.work_date || '，工時：' || NEW.work_hours || ' 小時。');
END;

-- Trigger 1.2: 出勤紀錄更新時，單日工時 > 12 自動將狀態變為 '異常'，並記日誌
CREATE TRIGGER IF NOT EXISTS trigger_check_attendance_hours_update
AFTER UPDATE OF work_hours ON attendance
WHEN NEW.work_hours > 12 AND (OLD.work_hours IS NULL OR OLD.work_hours <= 12)
BEGIN
    UPDATE attendance 
    SET attendance_status = '異常' 
    WHERE attendance_id = NEW.attendance_id;
    
    INSERT INTO system_logs (log_type, message)
    VALUES ('WARN', '員工單日工時超時！合約ID：' || NEW.contract_id || '，日期：' || NEW.work_date || '，工時：' || NEW.work_hours || ' 小時。');
END;

-- Trigger 1.3: 出勤紀錄插入時，檢查當月累計工時是否超過 138 小時
CREATE TRIGGER IF NOT EXISTS trigger_check_monthly_hours_insert
AFTER INSERT ON attendance
BEGIN
    INSERT INTO system_logs (log_type, message)
    SELECT 'WARN', '員工 ' || e.emp_name || ' (' || e.employee_id || ') 於 ' || strftime('%Y-%m', NEW.work_date) || ' 累計工時達 ' || SUM(a.work_hours) || ' 小時，已超過勞基法 138 小時上限！'
    FROM attendance a
    JOIN contract c ON a.contract_id = c.contract_id
    JOIN matching_record m ON c.matching_id = m.matching_id
    JOIN employee e ON m.employee_id = e.employee_id
    WHERE e.employee_id = (
        SELECT m2.employee_id 
        FROM contract c2 
        JOIN matching_record m2 ON c2.matching_id = m2.matching_id 
        WHERE c2.contract_id = NEW.contract_id
    )
    AND strftime('%Y-%m', a.work_date) = strftime('%Y-%m', NEW.work_date)
    GROUP BY e.employee_id
    HAVING SUM(a.work_hours) > 138
    AND NOT EXISTS (
        SELECT 1 FROM system_logs 
        WHERE log_type = 'WARN' 
          AND message LIKE '%' || e.employee_id || '%' 
          AND message LIKE '%' || strftime('%Y-%m', NEW.work_date) || '%超過勞基法%'
    );
END;

-- Trigger 1.4: 出勤紀錄更新時，檢查當月累計工時是否超過 138 小時
CREATE TRIGGER IF NOT EXISTS trigger_check_monthly_hours_update
AFTER UPDATE OF work_hours ON attendance
BEGIN
    INSERT INTO system_logs (log_type, message)
    SELECT 'WARN', '員工 ' || e.emp_name || ' (' || e.employee_id || ') 於 ' || strftime('%Y-%m', NEW.work_date) || ' 累計工時達 ' || SUM(a.work_hours) || ' 小時，已超過勞基法 138 小時上限！'
    FROM attendance a
    JOIN contract c ON a.contract_id = c.contract_id
    JOIN matching_record m ON c.matching_id = m.matching_id
    JOIN employee e ON m.employee_id = e.employee_id
    WHERE e.employee_id = (
        SELECT m2.employee_id 
        FROM contract c2 
        JOIN matching_record m2 ON c2.matching_id = m2.matching_id 
        WHERE c2.contract_id = NEW.contract_id
    )
    AND strftime('%Y-%m', a.work_date) = strftime('%Y-%m', NEW.work_date)
    GROUP BY e.employee_id
    HAVING SUM(a.work_hours) > 138
    AND NOT EXISTS (
        SELECT 1 FROM system_logs 
        WHERE log_type = 'WARN' 
          AND message LIKE '%' || e.employee_id || '%' 
          AND message LIKE '%' || strftime('%Y-%m', NEW.work_date) || '%超過勞基法%'
    );
END;

-- Trigger 2: 用人單位被標記為 '財務風險' 時，將該公司所有進行中合約變更為 '財務風險'
CREATE TRIGGER IF NOT EXISTS trigger_company_risk_status_update
AFTER UPDATE OF risk_status ON company
WHEN NEW.risk_status = '財務風險'
BEGIN
    UPDATE contract
    SET contract_status = '財務風險'
    WHERE company_id = NEW.company_id AND contract_status = '執行中';
    
    INSERT INTO system_logs (log_type, message)
    VALUES ('WARN', '用人單位 ' || NEW.company_name || ' 被標記為財務風險，已自動將其執行中合約狀態變更為財務風險。');
END;

-- Trigger 3: 員工打卡前，若持有已失效證照，則拒絕打卡
CREATE TRIGGER IF NOT EXISTS trigger_check_cert_status_before_attendance
BEFORE INSERT ON attendance
BEGIN
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 
            FROM contract c
            JOIN matching_record m ON c.matching_id = m.matching_id
            JOIN cert cr ON m.employee_id = cr.employee_id
            WHERE c.contract_id = NEW.contract_id 
              AND cr.cert_status = '已失效'
        )
        THEN RAISE(ABORT, '打卡失敗：該員工持有已失效的必要證照，系統已暫停其出勤權限！')
    END;
END;
