import { resetDB } from './db.js';
import db from './db.js';

console.log("=== 測試資料庫初始化與 Triggers 運作 ===");

try {
  // 1. 重置資料庫 (刪除舊檔、建表、建 Trigger、導 Seed Data)
  resetDB();

  // 2. 驗證資料是否寫入
  const companies = db.prepare("SELECT * FROM company").all();
  console.log(`\n[驗證] 用人單位數量: ${companies.length}`);
  console.log("用人單位列表:", companies.map(c => c.company_name));

  const employees = db.prepare("SELECT * FROM employee").all();
  console.log(`\n[驗證] 員工數量: ${employees.length}`);

  const contracts = db.prepare("SELECT * FROM contract").all();
  console.log(`\n[驗證] 合約數量: ${contracts.length}`);

  // 3. 驗證 Trigger 1 (工時超時 > 12) 是否成功將出勤設為 '異常'，並寫入警示日誌
  const overtimeAttendance = db.prepare("SELECT * FROM attendance WHERE work_hours > 12").all();
  console.log(`\n[驗證] 工時超過 12 小時的出勤紀錄數: ${overtimeAttendance.length}`);
  overtimeAttendance.forEach(a => {
    console.log(`-> 日期: ${a.work_date}, 工時: ${a.work_hours}小時, 狀態 (預期為 '異常'): ${a.attendance_status}`);
  });

  const logs = db.prepare("SELECT * FROM system_logs").all();
  console.log(`\n[驗證] 系統警示日誌數: ${logs.length}`);
  logs.forEach(l => {
    console.log(`[${l.log_type}] (時間: ${l.created_at}) ${l.message}`);
  });

  console.log("\n=== 測試成功！資料庫與 Triggers 運作正常 ===");

} catch (error) {
  console.error("測試失敗，錯誤原因:", error);
}
