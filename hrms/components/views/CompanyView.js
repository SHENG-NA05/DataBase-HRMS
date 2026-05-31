'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';

export default function CompanyView({ activeTab }) {
  const { selectedCompanyId, refreshData } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 新增職缺表單狀態
  const [jobTitle, setJobTitle] = useState('');
  const [jobContent, setJobContent] = useState('');
  const [requiredPeople, setRequiredPeople] = useState(1);
  const [workLocation, setWorkLocation] = useState('');
  const [salaryRange, setSalaryRange] = useState('');

  // 審核出勤狀態
  const [approvalNotes, setApprovalNotes] = useState({});

  const fetchCompanyData = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/company?id=${selectedCompanyId}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError('載入用人單位資料失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyData();
  }, [selectedCompanyId]);

  const handleAddRequest = async (e) => {
    e.preventDefault();
    if (!jobTitle || !requiredPeople) {
      alert('請填寫必要職缺資料');
      return;
    }
    try {
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_request',
          company_id: selectedCompanyId,
          job_title: jobTitle,
          job_content: jobContent,
          required_people: parseInt(requiredPeople),
          work_location: workLocation,
          salary_range: salaryRange,
          manager_id: 'MGR001'
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        // 清空
        setJobTitle('');
        setJobContent('');
        setRequiredPeople(1);
        setWorkLocation('');
        setSalaryRange('');
        fetchCompanyData();
        refreshData();
      } else {
        alert('發布失敗：' + json.error);
      }
    } catch (err) {
      alert('發布職缺連線異常');
    }
  };

  const handleVerifyAttendance = async (attendance_id, status) => {
    const notes = approvalNotes[attendance_id] || '用人單位已確認無誤';
    try {
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_attendance',
          company_id: selectedCompanyId,
          attendance_id,
          status,
          notes
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchCompanyData();
        refreshData();
      } else {
        alert('審查失敗：' + json.error);
      }
    } catch (err) {
      alert('審核出勤連線異常');
    }
  };

  if (!selectedCompanyId) {
    return <div className="glass-panel">請先於右上角選擇一家用人單位。</div>;
  }

  if (loading) return <div className="glass-panel">資料載入中...</div>;
  if (error) return <div className="glass-panel text-danger">錯誤：{error}</div>;
  if (!data) return null;

  const { info, requests, contracts, attendances } = data;

  return (
    <div className="fade-in">
      {/* 1. 單位首頁 */}
      {activeTab === 'comp_dashboard' && (
        <div>
          <div className="glass-panel">
            <div className="panel-header">
              <h3>🏢 {info.company_name} - 單位概況</h3>
              <span className={`badge ${info.risk_status === '正常' ? 'badge-success' : 'badge-danger'}`}>
                財務評級: {info.risk_status}
              </span>
            </div>
            {info.risk_status === '財務風險' ? (
              <div className="badge badge-danger" style={{ display: 'block', padding: '16px', fontSize: '14px', marginBottom: '20px' }}>
                🚨 警告：貴公司目前已被派遣系統標記為「財務風險」狀態（逾期 30 天未付合約款項）。系統已暫停您的新媒合推薦與合約起草權限，直至結算欠款入帳！
              </div>
            ) : null}
            <div className="form-grid">
              <div className="stat-card">
                <span className="stat-title">公司類型</span>
                <span className="stat-value" style={{ fontSize: '18px' }}>{info.company_type || '一般企業'}</span>
                <span className="stat-desc">產業領域</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">派駐在職人數</span>
                <span className="stat-value">{contracts.filter(c => c.contract_status === '執行中').length} 人</span>
                <span className="stat-desc">目前派駐於貴單位</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">發布職缺需求</span>
                <span className="stat-value">{requests.length} 筆</span>
                <span className="stat-desc">{requests.filter(r => r.request_status === '徵才中').length} 筆徵才中</span>
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="panel-header">
              <h3>📞 基本聯絡資料</h3>
            </div>
            <p className="text-secondary" style={{ marginBottom: '8px' }}>📍 公司地址：{info.company_address || '未提供'}</p>
            <p className="text-secondary" style={{ marginBottom: '8px' }}>👤 聯絡人：{info.contact_person || '未提供'}</p>
            <p className="text-secondary">📞 聯絡電話：{info.phone || '未提供'}</p>
          </div>
        </div>
      )}

      {/* 2. 發布與管理職缺 */}
      {activeTab === 'comp_requests' && (
        <div>
          <div className="glass-panel">
            <div className="panel-header">
              <h3>➕ 發布新派遣工作需求</h3>
            </div>
            <form onSubmit={handleAddRequest}>
              <div className="form-grid">
                <div className="form-group">
                  <label>工作/職缺名稱 *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="例如: 廠區夜班保全"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>需求人數 *</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    min="1"
                    value={requiredPeople}
                    onChange={(e) => setRequiredPeople(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>工作地點</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="例如: 竹科力行廠區"
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>薪資範圍/費率</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="例如: 時薪 190 元 或 月薪 30,000 元"
                    value={salaryRange}
                    onChange={(e) => setSalaryRange(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>工作內容詳述</label>
                <textarea 
                  className="form-textarea" 
                  placeholder="請輸入詳細的工作內容與資格限制..."
                  value={jobContent}
                  onChange={(e) => setJobContent(e.target.value)}
                />
              </div>
              <div style={{ textAlign: 'right' }}>
                <button type="submit" className="btn btn-primary" disabled={info.risk_status === '財務風險'}>
                  發布需求
                </button>
              </div>
            </form>
          </div>

          <div className="glass-panel">
            <div className="panel-header">
              <h3>📂 既有職缺申請進度</h3>
            </div>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>需求編號</th>
                    <th>工作名稱</th>
                    <th>人數</th>
                    <th>地點</th>
                    <th>薪資範圍</th>
                    <th>申請日期</th>
                    <th>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length > 0 ? (
                    requests.map((r) => (
                      <tr key={r.request_id}>
                        <td><code>REQ-{r.request_id}</code></td>
                        <td><strong>{r.job_title}</strong></td>
                        <td>{r.required_people} 人</td>
                        <td>{r.work_location || '-'}</td>
                        <td>{r.salary_range || '-'}</td>
                        <td>{r.request_date}</td>
                        <td>
                          <span className={`badge ${
                            r.request_status === '徵才中' ? 'badge-success' : 
                            r.request_status === '已徵滿' ? 'badge-muted' : 'badge-warning'
                          }`}>{r.request_status}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-secondary" style={{ textAlign: 'center' }}>尚無職缺需求紀錄</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. 派遣合約名冊 */}
      {activeTab === 'comp_contracts' && (
        <div className="glass-panel">
          <div className="panel-header">
            <h3>📄 派駐人員合約名冊</h3>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>合約編號</th>
                  <th>派駐員工</th>
                  <th>聯絡電話</th>
                  <th>派駐職稱</th>
                  <th>合約期間</th>
                  <th>計薪方式</th>
                  <th>約定工時</th>
                  <th>合約狀態</th>
                </tr>
              </thead>
              <tbody>
                {contracts.length > 0 ? (
                  contracts.map((c) => (
                    <tr key={c.contract_id}>
                      <td><code>{c.contract_id}</code></td>
                      <td><strong>{c.emp_name}</strong> (<code>{c.employee_id}</code>)</td>
                      <td>{c.emp_phone}</td>
                      <td>{c.job_title}</td>
                      <td>{c.start_date} ~ {c.end_date}</td>
                      <td>{c.pay_type}</td>
                      <td>{c.agreed_hours} 小時/日</td>
                      <td>
                        <span className={`badge ${
                          c.contract_status === '執行中' ? 'badge-success' : 
                          c.contract_status === '已到期' ? 'badge-muted' : 'badge-danger'
                        }`}>{c.contract_status}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="text-secondary" style={{ textAlign: 'center' }}>目前貴公司尚無任何有效的派駐員工。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. 出勤確認審核 */}
      {activeTab === 'comp_attendance' && (
        <div className="glass-panel">
          <div className="panel-header">
            <h3>📅 員工出勤打卡紀錄與確認</h3>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>員工姓名</th>
                  <th>派駐職缺</th>
                  <th>出勤日期</th>
                  <th>上班時間</th>
                  <th>下班時間</th>
                  <th>累計工時</th>
                  <th>出勤狀態</th>
                  <th>確認備註與審查</th>
                  <th>動作</th>
                </tr>
              </thead>
              <tbody>
                {attendances.length > 0 ? (
                  attendances.map((a) => (
                    <tr key={a.attendance_id}>
                      <td><strong>{a.emp_name}</strong></td>
                      <td>{a.job_title}</td>
                      <td>{a.work_date}</td>
                      <td><code>{a.clock_in}</code></td>
                      <td><code>{a.clock_out || '工作中'}</code></td>
                      <td><strong>{a.work_hours} 小時</strong></td>
                      <td>
                        <span className={`badge ${
                          a.attendance_status === '正常' ? 'badge-success' : 
                          a.attendance_status === '超時加班' ? 'badge-info' : 'badge-danger'
                        }`}>{a.attendance_status}</span>
                      </td>
                      <td>
                        {a.payroll_id ? (
                          <span className="text-muted"><small>已結帳封存 (備註: {a.remarks || '-'})</small></span>
                        ) : (
                          <input 
                            type="text" 
                            className="form-input" 
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            placeholder={a.remarks || "輸入審查備註..."}
                            onChange={(e) => setApprovalNotes({ ...approvalNotes, [a.attendance_id]: e.target.value })}
                          />
                        )}
                      </td>
                      <td>
                        {!a.payroll_id ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                              className="btn btn-success" 
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => handleVerifyAttendance(a.attendance_id, '正常')}
                            >
                              確認正常
                            </button>
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => handleVerifyAttendance(a.attendance_id, '異常')}
                            >
                              標記異常
                            </button>
                          </div>
                        ) : (
                          <span className="badge badge-muted">已結發薪</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="text-secondary" style={{ textAlign: 'center' }}>目前尚無任何員工的出勤打卡紀錄。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
