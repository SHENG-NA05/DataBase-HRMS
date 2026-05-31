'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';

export default function AgentView({ activeTab }) {
  const { refreshData } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 媒合操作狀態
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [matchRemarks, setMatchRemarks] = useState('');

  // 登記面試結果狀態
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [matchStatus, setMatchStatus] = useState('已錄取');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewResult, setInterviewResult] = useState('');
  const [failReason, setFailReason] = useState('');
  const [hireReason, setHireReason] = useState('');

  // 簽訂合約狀態
  const [contractId, setContractId] = useState('');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [contractType, setContractType] = useState('長期派遣');
  const [payType, setPayType] = useState('時薪');
  const [agreedHours, setAgreedHours] = useState(8.00);

  const fetchAgentData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agent');
      const json = await res.json();
      if (json.success) {
        setData(json);
        // 設定預設下拉選單
        if (json.jobs.length > 0) setSelectedJobId(json.jobs[0].request_id.toString());
        if (json.employees.length > 0) setSelectedEmpId(json.employees[0].employee_id);
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError('載入業務員資料失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentData();
  }, []);

  const handleCreateMatch = async (e) => {
    e.preventDefault();
    if (!selectedJobId || !selectedEmpId) {
      alert('請選擇職缺與員工');
      return;
    }
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_match',
          request_id: parseInt(selectedJobId),
          employee_id: selectedEmpId,
          remarks: matchRemarks,
          manager_id: 'MGR001'
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        setMatchRemarks('');
        fetchAgentData();
        refreshData();
      } else {
        alert('推薦失敗：' + json.error);
      }
    } catch (err) {
      alert('媒合連線異常');
    }
  };

  const handleUpdateMatch = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_match',
          matching_id: editingMatchId,
          match_status: matchStatus,
          interview_date: interviewDate,
          interview_result: interviewResult,
          fail_reason: failReason,
          hire_reason: hireReason
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        setEditingMatchId(null);
        fetchAgentData();
        refreshData();
      } else {
        alert('更新失敗：' + json.error);
      }
    } catch (err) {
      alert('更新媒合連線異常');
    }
  };

  const handleCreateContract = async (e, ignoreWarning = false) => {
    if (e) e.preventDefault();
    if (!contractId || !selectedMatch || !startDate || !endDate || !payType) {
      alert('請填寫合約必要欄位');
      return;
    }

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_contract',
          contract_id: contractId,
          company_id: selectedMatch.company_id,
          matching_id: selectedMatch.matching_id,
          start_date: startDate,
          end_date: endDate,
          contract_type: contractType,
          pay_type: payType,
          agreed_hours: parseFloat(agreedHours),
          ignore_warning: ignoreWarning
        })
      });
      const json = await res.json();
      
      if (json.success) {
        alert(json.message);
        // 清空
        setContractId('');
        setSelectedMatch(null);
        setStartDate('');
        setEndDate('');
        fetchAgentData();
        refreshData();
      } else if (json.hasConflict) {
        // [法律風險警示]
        const confirmForce = window.confirm(json.message + '\n\n⚠️ 簽署此合約具有法律風險，是否仍要強制執行？');
        if (confirmForce) {
          handleCreateContract(null, true); // 強制簽署
        }
      } else {
        alert('合約簽署失敗：' + json.error);
      }
    } catch (err) {
      alert('簽署合約連線異常');
    }
  };

  if (loading) return <div className="glass-panel">資料載入中...</div>;
  if (error) return <div className="glass-panel text-danger">錯誤：{error}</div>;
  if (!data) return null;

  const { jobs, employees, matches, contracts } = data;

  return (
    <div className="fade-in">
      {/* 1. 業務首頁 */}
      {activeTab === 'agent_dashboard' && (
        <div>
          <div className="glass-panel">
            <div className="panel-header">
              <h3>🤝 業務人員控制台</h3>
            </div>
            <div className="form-grid">
              <div className="stat-card">
                <span className="stat-title">委託職缺總數</span>
                <span className="stat-value">{jobs.length} 筆</span>
                <span className="stat-desc">{jobs.filter(j => j.request_status === '徵才中').length} 筆徵才中</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">人才庫總人數</span>
                <span className="stat-value">{employees.length} 人</span>
                <span className="stat-desc">{employees.filter(e => e.job_status === '待業中').length} 人待業中</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">累計媒合件數</span>
                <span className="stat-value">{matches.length} 件</span>
                <span className="stat-desc">包含面試中與已錄取</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">執行中派遣合約</span>
                <span className="stat-value">{contracts.filter(c => c.contract_status === '執行中').length} 筆</span>
                <span className="stat-desc">派駐服務中</span>
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="panel-header">
              <h3>📌 客戶公司財務狀況警示</h3>
            </div>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>公司編號</th>
                    <th>公司名稱</th>
                    <th>聯絡人</th>
                    <th>聯絡電話</th>
                    <th>公司評級 (風險)</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(j => j.company_id).filter((v, i, a) => a.indexOf(v) === i).map(cid => {
                    const job = jobs.find(j => j.company_id === cid);
                    return (
                      <tr key={cid}>
                        <td><code>{cid}</code></td>
                        <td><strong>{job.company_name}</strong></td>
                        <td>業務經理 MGR</td>
                        <td>03-xxxx-xxx</td>
                        <td>
                          <span className={`badge ${job.comp_risk === '正常' ? 'badge-success' : 'badge-danger'}`}>
                            {job.comp_risk}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. 職缺需求清單 */}
      {activeTab === 'agent_requests' && (
        <div className="glass-panel">
          <div className="panel-header">
            <h3>📁 客戶公司職缺委託需求</h3>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>職缺ID</th>
                  <th>公司名稱</th>
                  <th>職缺名稱</th>
                  <th>人數需求</th>
                  <th>工作地點</th>
                  <th>薪資費率</th>
                  <th>發布日期</th>
                  <th>狀態</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.request_id}>
                    <td><code>REQ-{j.request_id}</code></td>
                    <td><strong>{j.company_name}</strong> {j.comp_risk === '財務風險' ? '🚨' : ''}</td>
                    <td><strong>{j.job_title}</strong></td>
                    <td>{j.required_people} 人</td>
                    <td>{j.work_location}</td>
                    <td>{j.salary_range}</td>
                    <td>{j.request_date}</td>
                    <td>
                      <span className={`badge ${
                        j.request_status === '徵才中' ? 'badge-success' : 
                        j.request_status === '已徵滿' ? 'badge-muted' : 'badge-warning'
                      }`}>{j.request_status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. 派遣人才媒合 */}
      {activeTab === 'agent_matching' && (
        <div>
          <div className="glass-panel">
            <div className="panel-header">
              <h3>🎯 推薦派遣員工到工作職缺</h3>
            </div>
            <form onSubmit={handleCreateMatch}>
              <div className="form-grid">
                <div className="form-group">
                  <label>選擇委託職缺需求 *</label>
                  <select 
                    className="form-select"
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    required
                  >
                    {jobs.filter(j => j.request_status === '徵才中').map((j) => (
                      <option key={j.request_id} value={j.request_id} disabled={j.comp_risk === '財務風險'}>
                        [{j.company_name}] {j.job_title} (需 {j.required_people}人) {j.comp_risk === '財務風險' ? '🚨財務風險中(禁止媒合)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>選擇派遣員工 (人才庫) *</label>
                  <select 
                    className="form-select"
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    required
                  >
                    {employees.map((e) => (
                      <option key={e.employee_id} value={e.employee_id}>
                        {e.emp_name} ({e.job_status} | 3月成功率: {e.success_rate_3m}%) {e.success_rate_3m < 60 ? '⚠️建議培訓' : ''} {e.user_status === '合約暫停' ? '🚫停權中' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>推薦備註/原因</label>
                <textarea 
                  className="form-textarea"
                  placeholder="例如: 該員工具備相關經驗，通勤時間短，近月媒合表現優良..."
                  value={matchRemarks}
                  onChange={(e) => setMatchRemarks(e.target.value)}
                />
              </div>
              <div style={{ textAlign: 'right' }}>
                <button type="submit" className="btn btn-primary">💾 送出推薦</button>
              </div>
            </form>
          </div>

          <div className="glass-panel">
            <div className="panel-header">
              <h3>📋 媒合推薦紀錄與面試登記</h3>
            </div>
            
            {editingMatchId && (
              <div className="glass-panel" style={{ border: '1px solid var(--color-primary)', backgroundColor: 'rgba(59, 130, 246, 0.02)', marginBottom: '20px' }}>
                <div className="panel-header">
                  <h4>✍️ 登記面試結果 (媒合ID: {editingMatchId})</h4>
                </div>
                <form onSubmit={handleUpdateMatch}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>媒合狀態變更 *</label>
                      <select className="form-select" value={matchStatus} onChange={(e) => setMatchStatus(e.target.value)}>
                        <option value="面試中">面試中</option>
                        <option value="已錄取">已錄取 (錄取)</option>
                        <option value="未錄取">未錄取 (失敗)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>面試日期</label>
                      <input type="date" className="form-input" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>面試評語/結果</label>
                      <input type="text" className="form-input" placeholder="例如: 態度積極，技術符合" value={interviewResult} onChange={(e) => setInterviewResult(e.target.value)} />
                    </div>
                  </div>
                  <div className="form-grid" style={{ marginTop: '10px' }}>
                    {matchStatus === '已錄取' ? (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>錄取原因 (沉澱組織資產)</label>
                        <input type="text" className="form-input" placeholder="例如: 客戶極滿意其無塵室經驗" value={hireReason} onChange={(e) => setHireReason(e.target.value)} />
                      </div>
                    ) : matchStatus === '未錄取' ? (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>未錄取原因 (分析痛點用)</label>
                        <input type="text" className="form-input" placeholder="例如: 期望薪資落差、英文能力不足" value={failReason} onChange={(e) => setFailReason(e.target.value)} />
                      </div>
                    ) : null}
                  </div>
                  <div style={{ textAlign: 'right', marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingMatchId(null)}>取消</button>
                    <button type="submit" className="btn btn-primary">儲存結果</button>
                  </div>
                </form>
              </div>
            )}

            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>媒合ID</th>
                    <th>派遣員工</th>
                    <th>推薦職缺</th>
                    <th>推薦日期</th>
                    <th>媒合狀態</th>
                    <th>面試時間</th>
                    <th>面試結果</th>
                    <th>備註</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.matching_id}>
                      <td><code>MATCH-{m.matching_id}</code></td>
                      <td><strong>{m.emp_name}</strong></td>
                      <td>{m.company_name} - {m.job_title}</td>
                      <td>{m.match_date}</td>
                      <td>
                        <span className={`badge ${
                          m.match_status === '已錄取' ? 'badge-success' : 
                          m.match_status === '推薦中' ? 'badge-info' : 
                          m.match_status === '面試中' ? 'badge-warning' : 'badge-danger'
                        }`}>{m.match_status}</span>
                      </td>
                      <td>{m.interview_date || '-'}</td>
                      <td>
                        {m.match_status === '已錄取' ? (
                          <span style={{ color: 'var(--color-success)' }}><small>錄取: {m.hire_reason}</small></span>
                        ) : m.match_status === '未錄取' ? (
                          <span style={{ color: 'var(--color-danger)' }}><small>未錄: {m.fail_reason}</small></span>
                        ) : m.interview_result || '-'}
                      </td>
                      <td><small>{m.remarks || '-'}</small></td>
                      <td>
                        {m.match_status !== '已錄取' && m.match_status !== '未錄取' ? (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => {
                              setEditingMatchId(m.matching_id);
                              setMatchStatus(m.match_status);
                              setInterviewDate(m.interview_date || '');
                              setInterviewResult(m.interview_result || '');
                            }}
                          >
                            📝 登記面試
                          </button>
                        ) : (
                          <span className="text-muted"><small>流程已結束</small></span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. 派遣合約簽署 */}
      {activeTab === 'agent_contracts' && (
        <div>
          <div className="glass-panel">
            <div className="panel-header">
              <h3>✍️ 起草與簽署派遣合約</h3>
              <p className="text-secondary" style={{ fontSize: '12px' }}>說明：僅能為「已錄取」狀態且尚未簽合約的媒合記錄簽訂派遣合約</p>
            </div>
            <form onSubmit={(e) => handleCreateContract(e, false)}>
              <div className="form-grid">
                <div className="form-group">
                  <label>選擇錄取媒合紀錄 *</label>
                  <select 
                    className="form-select"
                    value={selectedMatch ? selectedMatch.matching_id : ''}
                    onChange={(e) => {
                      const matchId = parseInt(e.target.value);
                      const m = matches.find(x => x.matching_id === matchId);
                      // 尋找對應職缺
                      const job = jobs.find(j => j.job_title === m.job_title && j.company_name === m.company_name);
                      setSelectedMatch(m ? { ...m, company_id: job.company_id } : null);
                    }}
                    required
                  >
                    <option value="">-- 請選擇已錄取人員 --</option>
                    {matches.filter(m => m.match_status === '已錄取' && !contracts.some(c => c.matching_id === m.matching_id)).map((m) => (
                      <option key={m.matching_id} value={m.matching_id}>
                        [{m.company_name}] 錄取 {m.emp_name} (媒合ID: MATCH-{m.matching_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>合約編號 *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="例如: CON004"
                    value={contractId}
                    onChange={(e) => setContractId(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>服務開始日 *</label>
                  <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>服務結束日 *</label>
                  <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>合約類型</label>
                  <select className="form-select" value={contractType} onChange={(e) => setContractType(e.target.value)}>
                    <option value="長期派遣">長期派遣</option>
                    <option value="短期派遣">短期派遣</option>
                    <option value="短期兼任">短期兼任</option>
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>計薪方式 *</label>
                  <select className="form-select" value={payType} onChange={(e) => setPayType(e.target.value)} required>
                    <option value="時薪">時薪</option>
                    <option value="日薪">日薪</option>
                    <option value="月薪">月薪</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>每日約定正常工時</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    step="0.5" 
                    min="1" 
                    max="12" 
                    value={agreedHours} 
                    onChange={(e) => setAgreedHours(e.target.value)} 
                  />
                </div>
              </div>

              <div style={{ textAlign: 'right', marginTop: '16px' }}>
                <button type="submit" className="btn btn-primary" disabled={!selectedMatch}>
                  🖋️ 簽署合約並派駐員工
                </button>
              </div>
            </form>
          </div>

          <div className="glass-panel">
            <div className="panel-header">
              <h3>📂 既有簽署派遣合約列表</h3>
            </div>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>合約ID</th>
                    <th>用人單位</th>
                    <th>派遣員工</th>
                    <th>職缺職稱</th>
                    <th>期間</th>
                    <th>類型</th>
                    <th>計薪</th>
                    <th>工時/天</th>
                    <th>合約狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.contract_id}>
                      <td><code>{c.contract_id}</code></td>
                      <td>{c.company_name}</td>
                      <td><strong>{c.emp_name}</strong></td>
                      <td>{c.job_title}</td>
                      <td>{c.start_date} ~ {c.end_date}</td>
                      <td>{c.contract_type}</td>
                      <td>{c.pay_type}</td>
                      <td>{c.agreed_hours}小時</td>
                      <td>
                        <span className={`badge ${
                          c.contract_status === '執行中' ? 'badge-success' : 
                          c.contract_status === '已到期' ? 'badge-muted' : 'badge-danger'
                        }`}>{c.contract_status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
