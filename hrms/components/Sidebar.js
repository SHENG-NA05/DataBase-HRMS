'use client';

import React from 'react';
import { useApp } from './AppContext';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { currentRole } = useApp();

  // 根據角色設定不同的選單項目
  const getMenuItems = () => {
    switch (currentRole) {
      case 'admin':
        return [
          { id: 'admin_dashboard', label: '📊 系統儀表板' },
          { id: 'admin_employees', label: '👥 派遣員工管理' },
          { id: 'admin_approvals', label: '⚠️ 工時異常審查' },
          { id: 'admin_payroll', label: '💰 月度薪資發放' },
          { id: 'admin_logs', label: '📋 系統警示日誌' }
        ];
      case 'agent':
        return [
          { id: 'agent_dashboard', label: '📊 業務儀表板' },
          { id: 'agent_requests', label: '📁 職缺需求清單' },
          { id: 'agent_matching', label: '🎯 派遣人才媒合' },
          { id: 'agent_contracts', label: '✍️ 派遣合約簽署' }
        ];
      case 'employee':
        return [
          { id: 'emp_dashboard', label: '🏠 員工首頁' },
          { id: 'emp_attendance', label: '⏰ 出勤線上打卡' },
          { id: 'emp_payroll', label: '💵 薪資明細查詢' },
          { id: 'emp_certs', label: '📜 個人證照管理' }
        ];
      case 'company':
        return [
          { id: 'comp_dashboard', label: '🏠 單位首頁' },
          { id: 'comp_requests', label: '➕ 職缺需求發布' },
          { id: 'comp_contracts', label: '📄 派駐合約查詢' },
          { id: 'comp_attendance', label: '✓ 出勤確認回報' }
        ];
      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  // 當角色切換時，如果目前的 tab 不在該角色的選單內，自動切換至該角色的第一個項目
  React.useEffect(() => {
    if (menuItems.length > 0 && !menuItems.find(item => item.id === activeTab)) {
      setActiveTab(menuItems[0].id);
    }
  }, [currentRole, menuItems, activeTab, setActiveTab]);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-logo">🌐</span>
        <div className="brand-text">
          <h1>派遣管家</h1>
          <p>HRMS Platform</p>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="status-indicator">
          <span className="dot pulse-green"></span>
          <span>資料庫連線中 (SQLite)</span>
        </div>
      </div>
    </aside>
  );
}
