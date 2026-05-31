'use client';

import React from 'react';
import { useApp } from './AppContext';

export default function RoleSwitcher() {
  const {
    currentRole,
    setCurrentRole,
    selectedEmployeeId,
    setSelectedEmployeeId,
    selectedCompanyId,
    setSelectedCompanyId,
    employeesList,
    companiesList
  } = useApp();

  const handleRoleChange = (e) => {
    setCurrentRole(e.target.value);
  };

  return (
    <div className="role-switcher-container">
      <div className="role-switcher-item">
        <label className="switcher-label">切換操作角色</label>
        <select 
          className="switcher-select" 
          value={currentRole} 
          onChange={handleRoleChange}
        >
          <option value="admin">💼 行政與財務主管</option>
          <option value="agent">🤝 派遣業務員</option>
          <option value="employee">👤 派遣員工</option>
          <option value="company">🏢 用人單位 (客戶)</option>
        </select>
      </div>

      {currentRole === 'employee' && (
        <div className="role-switcher-item fade-in">
          <label className="switcher-label">選擇派遣員工</label>
          <select 
            className="switcher-select secondary-select" 
            value={selectedEmployeeId} 
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
          >
            {employeesList.map((emp) => (
              <option key={emp.employee_id} value={emp.employee_id}>
                {emp.emp_name} ({emp.employee_id}) {emp.user_status === '合約暫停' ? '⚠️已停權' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {currentRole === 'company' && (
        <div className="role-switcher-item fade-in">
          <label className="switcher-label">選擇用人單位</label>
          <select 
            className="switcher-select secondary-select" 
            value={selectedCompanyId} 
            onChange={(e) => setSelectedCompanyId(e.target.value)}
          >
            {companiesList.map((comp) => (
              <option key={comp.company_id} value={comp.company_id}>
                {comp.company_name} ({comp.company_id}) {comp.risk_status === '財務風險' ? '🚨風險' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
