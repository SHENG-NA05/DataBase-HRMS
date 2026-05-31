'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';

export default function AdminView({ activeTab }) {
  const { refreshData } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 薪資結算表單狀態
  const [selectedContractId, setSelectedContractId] = useState('');
  const [payrollMonth, setPayrollMonth] = useState('2026-05');
  const [deductionAmt, setDeductionAmt] = useState(0);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin');
      const json = await res.json();
      if (json.success) {
        setData(json);
        if (json.employees.length > 0 && !selectedContractId) {
          // 預設選擇第一個有合約的人
          const firstContract = json.payrolls.length > 0 ? json.payrolls[0].contract_id : '';
          setSelectedContractId(firstContract);
        }
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError('載入管理員資料失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleApproveAttendance = async (attendance_id, approve_status) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_attendance',
          attendance_id,
          approve_status
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchAdminData();
        refreshData();
      } else {
        alert('審核失敗：' + json.error);
      }
    } catch (err) {
      alert('審核連線異常');
    }
  };

  const handleChangeRisk = async (company_id, currentRisk) => {
    const nextRisk = currentRisk === '正常' ? '財務風險' : '正常';
    const confirmMsg = nextRisk === '財務風險' 
      ? `確定要將該公司標記為「財務風險」（模擬逾期30天未付）嗎？\n⚠️ 這將會自動觸發 Trigger 2，連動該公司所有進行中合約變更為財務風險，並限制新媒合！`
      : `確定要清除該公司的財務風險狀態嗎？`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_company_risk',
          company_id,
          risk_status: nextRisk
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchAdminData();
        refreshData();
      } else {
        alert('變更失敗：' + json.error);
      }
    } catch (err) {
      alert('變更風險連線異常');
    }
  };

  const handleCalculatePayroll = async (e) => {
    e.preventDefault();
    if (!selectedContractId || !payrollMonth) {
      alert('請選擇合約與計薪月份');
      return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calculate_payroll',
          contract_id: selectedContractId,
          payroll_month: payrollMonth,
          deduction_amt: parseInt(deductionAmt)
        })
      });
      const json = await res.json();

      if (json.success) {
        alert(`🎉 薪資結算發放成功！\n應發金額: $${json.base_pay.toLocaleString()} 元\n實發金額: $${json.net_pay.toLocaleString()} 元`);
        setDeductionAmt(0);
        fetchAdminData();
        refreshData();
      } else {
        // [薪資鎖定警告]
        alert('⚠️ 結算遭拒！錯誤原因：\n' + json.error);
      }
    } catch (err) {
      alert('結算連線異常');
    }
  };

  if (loading) return <div className="glass-panel">資料載入中...</div>;
  if (error) return <div className="glass-panel text-danger">錯誤：{error}</div>;
  if (!data) return null;

  const { employees, companies, logs, pendingApprovals, payrolls } = data;

  return (
    <div className="fade-in">
      {/* 1. 主管儀表板 */}
      {activeTab === 'admin_dashboard' && (
        <div>
          <div className="glass-panel">
            <div className="panel-header">
              <h3>💼 系統管理與財務概況</h3>
            </div>
            <div className="form-grid">
              <div className="stat-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
                <span className="stat-title">待處理工時異常</span>
                <span className="stat-value" style={{ color: pendingApprovals.length > 0 ? 'var(--color-danger)' : 'inherit' }}>
                  {pendingApprovals.length} 筆
                </span>
                <span className="stat-desc">工時超過 12 小時待審核</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">派遣員工總數</span>
                <span className="stat-value">{employees.length} 人</span>
                <span className="stat-desc">{employees.filter(e => e.user_status === '合約暫停').length} 人帳號合約暫停</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">客戶公司總數</span>
                <span className="stat-value">{companies.length} 家</span>
                <span className="stat-desc">{companies.filter(c => c.risk_status === '財務風險').length} 家有財務風險</span>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
                <span className="stat-title">累計薪資發放額</span>
                <span className="stat-value" style={{ color: 'var(--color-success)', fontSize: '20px' }}>
                  ${payrolls.reduce((sum, p) => sum + p.net_pay, 0).toLocaleString()} 元
                </span>
                <span className="stat-desc">所有派駐人員薪資加總</span>
              </div>
            </div>
          </div>

          {/* 財務風險模擬控制板 */}
          <div className="glass-panel">
            <div className="panel-header">
              <h3>🚨 用人單位財務風險模擬控制 (Trigger 2 連動演示)</h3>
            </div>
            <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '16px' }}>
              💡 說明：點擊按鈕可手動變更公司的財務風險評級（模擬逾期30天未付款）。
              這會自動觸發資料庫中的 <strong>trigger_company_risk_status_update</strong>，將該公司旗下所有進行中合約標記為「財務風險」，並禁止新媒合！
            </p>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>用人單位ID</th>
                    <th>用人單位名稱</th>
                    <th>地址</th>
                    <th>財務評級</th>
                    <th>模擬操作</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map(c => (
                    <tr key={c.company_id}>
                      <td><code>{c.company_id}</code></td>
                      <td><strong>{c.company_name}</strong></td>
                      <td>{c.company_address}</td>
                      <td>
                        <span className={`badge ${c.risk_status === '正常' ? 'badge-success' : 'badge-danger'}`}>
                          {c.risk_status}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`btn ${c.risk_status === '正常' ? 'btn-danger' : 'btn-success'}`}
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => handleChangeRisk(c.company_id, c.risk_status)}
                        >
                          {c.risk_status === '正常' ? '🚨 標記財務風險' : '✓ 恢復為正常'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. 派遣員工管理 */}
      {activeTab === 'admin_employees' && (
        <div className="glass-panel">
          <div className="panel-header">
            <h3>👥 派遣員工帳號與在職狀態</h3>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>員工編號</th>
                  <th>員工姓名</th>
                  <th>電話</th>
                  <th>Email</th>
                  <th>加入日期</th>
                  <th>在職狀態</th>
                  <th>帳號權限狀態</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.employee_id}>
                    <td><code>{e.employee_id}</code></td>
                    <td><strong>{e.emp_name}</strong></td>
                    <td>{e.phone}</td>
                    <td>{e.email}</td>
                    <td>{e.join_date}</td>
                    <td>
                      <span className={`badge ${e.job_status === '派駐中' ? 'badge-info' : 'badge-muted'}`}>
                        {e.job_status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        e.user_status === '啟用' ? 'badge-success' : 
                        e.user_status === '合約暫停' ? 'badge-warning' : 'badge-danger'
                      }`}>{e.user_status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. 工時異常審查 */}
      {activeTab === 'admin_approvals' && (
        <div className="glass-panel">
          <div className="panel-header">
            <h3>⚠️ 單日工時超時審核 (Trigger 1.1 / 1.2 警示結果)</h3>
          </div>
          <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '16px' }}>
            💡 說明：根據勞基法工時上限硬性限制，單日出勤時數 &gt; 12 時，資料庫會自動將狀態設為「異常」並鎖定薪資結算。
            財務主管必須在此核准該出勤（將狀態改為「正常」），該員工對應月份的薪資結算才能夠被解鎖！
          </p>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>異常出勤ID</th>
                  <th>派遣員工</th>
                  <th>用人單位</th>
                  <th>工作職缺</th>
                  <th>出勤日期</th>
                  <th>上班打卡</th>
                  <th>下班打卡</th>
                  <th>累計工時</th>
                  <th>狀態</th>
                  <th>主管審批動作</th>
                </tr>
              </thead>
              <tbody>
                {pendingApprovals.length > 0 ? (
                  pendingApprovals.map((a) => (
                    <tr key={a.attendance_id}>
                      <td><code>ATT-{a.attendance_id}</code></td>
                      <td><strong>{a.emp_name}</strong></td>
                      <td>{a.company_name}</td>
                      <td>{a.job_title}</td>
                      <td>{a.work_date}</td>
                      <td><code>{a.clock_in}</code></td>
                      <td><code>{a.clock_out}</code></td>
                      <td style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>{a.work_hours} 小時</td>
                      <td><span className="badge badge-danger">{a.attendance_status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-success" 
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => handleApproveAttendance(a.attendance_id, '正常')}
                          >
                            ✓ 核准工時 (變為正常)
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10" className="text-secondary" style={{ textAlign: 'center', padding: '24px' }}>
                      ✓ 目前沒有任何待處理的工時超時異常紀錄。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. 月度薪資發放 */}
      {activeTab === 'admin_payroll' && (
        <div>
          <div className="glass-panel">
            <div className="panel-header">
              <h3>💰 計算並結算員工月度薪資 (Locking 鎖定演示)</h3>
            </div>
            <form onSubmit={handleCalculatePayroll}>
              <div className="form-grid">
                <div className="form-group">
                  <label>選擇結算派遣合約 *</label>
                  <select 
                    className="form-select"
                    value={selectedContractId}
                    onChange={(e) => setSelectedContractId(e.target.value)}
                    required
                  >
                    <option value="">-- 請選擇派遣合約 --</option>
                    {employees.filter(e => e.job_status === '派駐中').map(e => {
                      // 找出此員工對應的執行中或已到期合約
                      // 僅做展示用
                      const empId = e.employee_id;
                      return (
                        <option key={empId} value={empId === 'EMP001' ? 'CON001' : empId === 'EMP002' ? 'CON002' : 'CON003'}>
                          {e.emp_name} - 合約: {empId === 'EMP001' ? 'CON001 (台積電/日薪)' : empId === 'EMP002' ? 'CON002 (台積電/時薪)' : 'CON003 (聯發科/月薪)'}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="form-group">
                  <label>計薪月份 *</label>
                  <input 
                    type="month" 
                    className="form-input" 
                    value={payrollMonth} 
                    onChange={(e) => setPayrollMonth(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>請假扣款金額</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    min="0" 
                    value={deductionAmt} 
                    onChange={(e) => setDeductionAmt(e.target.value)} 
                  />
                </div>
              </div>
              <div style={{ textAlign: 'right', marginTop: '16px' }}>
                <button type="submit" className="btn btn-primary">
                  💵 結算並發放薪資
                </button>
              </div>
            </form>
          </div>

          <div className="glass-panel">
            <div className="panel-header">
              <h3>💵 已發放薪資明細歷史</h3>
            </div>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>薪資編號</th>
                    <th>員工姓名</th>
                    <th>用人單位</th>
                    <th>計薪月份</th>
                    <th>計薪類型</th>
                    <th>應發金額</th>
                    <th>扣款</th>
                    <th>實發金額</th>
                    <th>結算日期</th>
                    <th>匯款帳戶</th>
                    <th>結算備註</th>
                  </tr>
                </thead>
                <tbody>
                  {payrolls.map((p) => (
                    <tr key={p.payroll_id}>
                      <td><code>PAY-{p.payroll_id}</code></td>
                      <td><strong>{p.emp_name}</strong></td>
                      <td>{p.company_name}</td>
                      <td><strong>{p.payroll_month}</strong></td>
                      <td>{p.pay_type}</td>
                      <td style={{ color: 'var(--color-success)' }}>+${p.base_pay.toLocaleString()}</td>
                      <td style={{ color: 'var(--color-danger)' }}>-${p.deduction.toLocaleString()}</td>
                      <td style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>${p.net_pay.toLocaleString()}</td>
                      <td>{p.pay_date}</td>
                      <td><small>{p.bank_account}</small></td>
                      <td><small>{p.remarks}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. 系統日誌與警示 */}
      {activeTab === 'admin_logs' && (
        <div className="glass-panel">
          <div className="panel-header">
            <h3>📋 系統觸發器與核心日誌監控 (Trigger Logs)</h3>
            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={fetchAdminData}>
              🔄 重新整理
            </button>
          </div>
          <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '16px' }}>
            💡 說明：此處日誌展示了資料庫 Triggers（如工時超時 Trigger、財務風險連動 Trigger）和自動更新 Hook 自動寫入的事件日誌。
          </p>
          <div className="logs-list">
            {logs.length > 0 ? (
              logs.map((l) => (
                <div key={l.log_id} className={`log-item ${l.log_type}`}>
                  <div className="log-text">
                    <strong>[{l.log_type}]</strong> {l.message}
                  </div>
                  <div className="log-time">
                    {l.created_at}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-secondary" style={{ textAlign: 'center', padding: '24px' }}>
                目前系統尚未產生任何警示日誌。
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
