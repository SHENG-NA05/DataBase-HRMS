'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';

export default function EmployeeView({ activeTab }) {
  const { selectedEmployeeId, refreshData } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clockLoading, setClockLoading] = useState(false);

  // 證照表單狀態
  const [certId, setCertId] = useState('');
  const [certName, setCertName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [issueOrg, setIssueOrg] = useState('');

  const fetchEmployeeData = async () => {
    if (!selectedEmployeeId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/employee?id=${selectedEmployeeId}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError('載入員工資料失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
  }, [selectedEmployeeId]);

  const handleClock = async (action) => {
    setClockLoading(true);
    try {
      const res = await fetch('/api/employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, employee_id: selectedEmployeeId })
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchEmployeeData();
        refreshData(); // 重新整理全局警示日誌
      } else {
        alert('⚠️ 打卡失敗！錯誤原因：\n' + json.error);
      }
    } catch (err) {
      alert('打卡連線異常');
    } finally {
      setClockLoading(false);
    }
  };

  const handleAddCert = async (e) => {
    e.preventDefault();
    if (!certId || !certName || !expiryDate) {
      alert('請填寫必要證照資訊');
      return;
    }
    try {
      const res = await fetch('/api/employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_cert',
          employee_id: selectedEmployeeId,
          cert_id: certId,
          cert_name: certName,
          expiry_date: expiryDate,
          issue_org: issueOrg
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        // 清空表單
        setCertId('');
        setCertName('');
        setExpiryDate('');
        setIssueOrg('');
        fetchEmployeeData();
        refreshData();
      } else {
        alert('上傳失敗：' + json.error);
      }
    } catch (err) {
      alert('證照新增異常');
    }
  };

  if (!selectedEmployeeId) {
    return <div className="glass-panel">請先於右上角選擇一位派遣員工。</div>;
  }

  if (loading) return <div className="glass-panel">資料載入中...</div>;
  if (error) return <div className="glass-panel text-danger">錯誤：{error}</div>;
  if (!data) return null;

  const { info, contracts, attendances, payrolls, certs } = data;
  
  // 找出是否有今天尚未下班的出勤
  const todayStr = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  const activeContract = contracts.find(c => c.contract_status === '執行中');
  const todayAttendance = activeContract 
    ? attendances.find(a => a.contract_id === activeContract.contract_id && a.work_date === todayStr)
    : null;

  return (
    <div className="fade-in">
      {/* 1. 員工首頁 */}
      {activeTab === 'emp_dashboard' && (
        <div>
          <div className="glass-panel">
            <div className="panel-header">
              <h3>👋 歡迎回來，{info.emp_name}</h3>
              <span className={`badge ${info.user_status === '啟用' ? 'badge-success' : 'badge-danger'}`}>
                帳號狀態: {info.user_status}
              </span>
            </div>
            <div className="form-grid">
              <div className="stat-card">
                <span className="stat-title">在職狀態</span>
                <span className="stat-value">{info.job_status}</span>
                <span className="stat-desc">目前派駐職務</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">有效合約</span>
                <span className="stat-value">{activeContract ? '1 筆' : '無'}</span>
                <span className="stat-desc">{activeContract ? `對應單位: ${activeContract.company_name}` : '待媒合中'}</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">證照數量</span>
                <span className="stat-value">{certs.length} 張</span>
                <span className="stat-desc">{certs.filter(c => c.cert_status === '已失效').length} 張已過期</span>
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="panel-header">
              <h3>📌 目前進行中的合約資訊</h3>
            </div>
            {activeContract ? (
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>合約編號</th>
                      <th>用人單位</th>
                      <th>合約期間</th>
                      <th>合約狀態</th>
                      <th>計薪方式</th>
                      <th>每日約定工時</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>{activeContract.contract_id}</code></td>
                      <td>{activeContract.company_name}</td>
                      <td>{activeContract.start_date} 至 {activeContract.end_date}</td>
                      <td>
                        <span className={`badge ${
                          activeContract.contract_status === '執行中' ? 'badge-success' : 
                          activeContract.contract_status === '已到期' ? 'badge-muted' : 'badge-warning'
                        }`}>{activeContract.contract_status}</span>
                      </td>
                      <td>{activeContract.pay_type}</td>
                      <td>{activeContract.agreed_hours} 小時</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-secondary">您目前沒有正在執行的合約。請聯絡您的業務經理進行媒合推薦。</p>
            )}
          </div>
        </div>
      )}

      {/* 2. 出勤線上打卡 */}
      {activeTab === 'emp_attendance' && (
        <div>
          <div className="glass-panel">
            <div className="panel-header">
              <h3>⏰ 線上出勤打卡控制台</h3>
              {activeContract && (
                <span className="text-secondary">目前簽署合約: <code>{activeContract.contract_id}</code> ({activeContract.company_name})</span>
              )}
            </div>

            {info.user_status === '合約暫停' ? (
              <div className="badge badge-danger" style={{ display: 'block', padding: '16px', fontSize: '14px', marginBottom: '20px' }}>
                🚨 警告：您的帳號已被系統設定為「合約暫停」狀態，這通常是因為您有已失效的證照！系統已關閉您的出勤打卡權限。請先前往「個人證照管理」上傳有效證照。
              </div>
            ) : null}

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat-card" style={{ alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
                <span className="stat-title" style={{ marginBottom: '12px' }}>今日打卡狀態</span>
                {!todayAttendance ? (
                  <span className="badge badge-muted" style={{ fontSize: '14px', padding: '8px 16px' }}>尚未打卡上班</span>
                ) : !todayAttendance.clock_out ? (
                  <span className="badge badge-success" style={{ fontSize: '14px', padding: '8px 16px' }}>工作中 (上班時間: {todayAttendance.clock_in.split(' ')[1] || todayAttendance.clock_in})</span>
                ) : (
                  <span className="badge badge-info" style={{ fontSize: '14px', padding: '8px 16px' }}>已打卡下班 (工時: {todayAttendance.work_hours} 小時)</span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
                <button
                  className="btn btn-success"
                  style={{ height: '50px', fontSize: '16px' }}
                  disabled={!activeContract || !!todayAttendance || clockLoading || info.user_status === '合約暫停'}
                  onClick={() => handleClock('clock_in')}
                >
                  🚀 打卡上班 (Clock In)
                </button>
                <button
                  className="btn btn-danger"
                  style={{ height: '50px', fontSize: '16px' }}
                  disabled={!activeContract || !todayAttendance || !!todayAttendance.clock_out || clockLoading || info.user_status === '合約暫停'}
                  onClick={() => handleClock('clock_out')}
                >
                  🚪 打卡下班 (Clock Out)
                </button>
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="panel-header">
              <h3>📅 近期出勤紀錄</h3>
            </div>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>用人單位</th>
                    <th>上班打卡</th>
                    <th>下班打卡</th>
                    <th>工時</th>
                    <th>狀態</th>
                    <th>確認備註</th>
                  </tr>
                </thead>
                <tbody>
                  {attendances.length > 0 ? (
                    attendances.map((att) => (
                      <tr key={att.attendance_id}>
                        <td>{att.work_date}</td>
                        <td>{att.company_name}</td>
                        <td><code>{att.clock_in}</code></td>
                        <td><code>{att.clock_out || '未下班'}</code></td>
                        <td><strong>{att.work_hours} 小時</strong></td>
                        <td>
                          <span className={`badge ${
                            att.attendance_status === '正常' ? 'badge-success' : 
                            att.attendance_status === '超時加班' ? 'badge-info' : 'badge-danger'
                          }`}>{att.attendance_status}</span>
                        </td>
                        <td>{att.remarks || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-secondary" style={{ textAlign: 'center' }}>尚無出勤打卡紀錄</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. 薪資明細查詢 */}
      {activeTab === 'emp_payroll' && (
        <div className="glass-panel">
          <div className="panel-header">
            <h3>💵 歷史薪資結算明細</h3>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>計薪月份</th>
                  <th>合約編號</th>
                  <th>用人單位</th>
                  <th>應發金額 (A)</th>
                  <th>扣款金額 (B)</th>
                  <th>實發金額 (A-B)</th>
                  <th>發放日期</th>
                  <th>入帳帳戶</th>
                  <th>備註</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.length > 0 ? (
                  payrolls.map((pay) => (
                    <tr key={pay.payroll_id}>
                      <td><strong>{pay.payroll_month}</strong></td>
                      <td><code>{pay.contract_id}</code></td>
                      <td>{pay.company_name}</td>
                      <td style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>+${pay.base_pay.toLocaleString()}</td>
                      <td style={{ color: 'var(--color-danger)' }}>-${pay.deduction.toLocaleString()}</td>
                      <td style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '15px' }}>${pay.net_pay.toLocaleString()}</td>
                      <td>{pay.pay_date}</td>
                      <td><small>{pay.bank_account}</small></td>
                      <td>{pay.remarks}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="text-secondary" style={{ textAlign: 'center' }}>目前尚無任何薪資結算紀錄。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. 個人證照管理 */}
      {activeTab === 'emp_certs' && (
        <div>
          <div className="glass-panel">
            <div className="panel-header">
              <h3>📜 目前持有的專業證照</h3>
            </div>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>證照編號</th>
                    <th>證照名稱</th>
                    <th>發照單位</th>
                    <th>有效期限</th>
                    <th>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {certs.length > 0 ? (
                    certs.map((c) => (
                      <tr key={c.cert_id}>
                        <td><code>{c.cert_id}</code></td>
                        <td><strong>{c.cert_name}</strong></td>
                        <td>{c.issue_org || '-'}</td>
                        <td>{c.expiry_date}</td>
                        <td>
                          <span className={`badge ${
                            c.cert_status === '有效' ? 'badge-success' : 
                            c.cert_status === '即將到期' ? 'badge-warning' : 'badge-danger'
                          }`}>{c.cert_status}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-secondary" style={{ textAlign: 'center' }}>尚無證照紀錄。請於下方表單上傳新增。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel">
            <div className="panel-header">
              <h3>➕ 新增/上傳專業證照</h3>
            </div>
            <form onSubmit={handleAddCert}>
              <div className="form-grid">
                <div className="form-group">
                  <label>證照代碼/字號 *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="例如: CERT004"
                    value={certId}
                    onChange={(e) => setCertId(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>證照名稱 *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="例如: 堆高機操作技術士"
                    value={certName}
                    onChange={(e) => setCertName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>有效截止日期 *</label>
                  <input 
                    type="date" 
                    className="form-input"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>發照機構</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="例如: 勞動部"
                    value={issueOrg}
                    onChange={(e) => setIssueOrg(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <button type="submit" className="btn btn-primary">💾 儲存並上傳證照</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
