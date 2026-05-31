'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [currentRole, setCurrentRole] = useState('admin'); // 預設為 admin，方便首次加載看到全局
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  
  const [employeesList, setEmployeesList] = useState([]);
  const [companiesList, setCompaniesList] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // 初始化與更新角色列表、日誌
  const refreshData = async () => {
    try {
      // 呼叫 API 初始化資料庫 (僅首次會真正執行)
      await fetch('/api/init');

      const res = await fetch('/api/roles');
      const data = await res.json();
      if (data.success) {
        setEmployeesList(data.employees || []);
        setCompaniesList(data.companies || []);
        setSystemLogs(data.logs || []);

        // 設定預設的選擇實體 ID
        if (data.employees.length > 0 && !selectedEmployeeId) {
          setSelectedEmployeeId(data.employees[0].employee_id);
        }
        if (data.companies.length > 0 && !selectedCompanyId) {
          setSelectedCompanyId(data.companies[0].company_id);
        }
      }
    } catch (error) {
      console.error('Failed to load role switcher data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <AppContext.Provider value={{
      currentRole,
      setCurrentRole,
      selectedEmployeeId,
      setSelectedEmployeeId,
      selectedCompanyId,
      setSelectedCompanyId,
      employeesList,
      companiesList,
      systemLogs,
      loading,
      refreshData
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
