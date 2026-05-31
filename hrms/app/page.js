'use client';

import React, { useState } from 'react';
import { useApp } from '../components/AppContext';
import Sidebar from '../components/Sidebar';
import RoleSwitcher from '../components/RoleSwitcher';

// 動態引入視圖組件
import AdminView from '../components/views/AdminView';
import AgentView from '../components/views/AgentView';
import EmployeeView from '../components/views/EmployeeView';
import CompanyView from '../components/views/CompanyView';

export default function MainDashboard() {
  const { currentRole, loading } = useApp();
  const [activeTab, setActiveTab] = useState('');

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0b0f19',
        color: '#f3f4f6',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px auto'
          }} />
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes spin { to { transform: rotate(360deg); } }
          `}} />
          <h2>系統初始化中...</h2>
          <p style={{ color: '#9ca3af', marginTop: '8px', fontSize: '14px' }}>正在載入 SQLite 資料庫與建立觸發器</p>
        </div>
      </div>
    );
  }

  // 根據角色決定要渲染的視圖
  const renderContentView = () => {
    switch (currentRole) {
      case 'admin':
        return <AdminView activeTab={activeTab} />;
      case 'agent':
        return <AgentView activeTab={activeTab} />;
      case 'employee':
        return <EmployeeView activeTab={activeTab} />;
      case 'company':
        return <CompanyView activeTab={activeTab} />;
      default:
        return <div className="glass-panel">未知操作角色</div>;
    }
  };

  // 取得當前視圖的標題
  const getHeaderTitle = () => {
    switch (currentRole) {
      case 'admin': return '💼 行政與財務主管工作台';
      case 'agent': return '🤝 派遣業務員工作台';
      case 'employee': return '👤 派遣員工自助平台';
      case 'company': return '🏢 用人單位管理平台';
      default: return 'HRMS Platform';
    }
  };

  return (
    <div className="dashboard-container">
      {/* 1. 左側選單 */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 2. 右側主要內容 */}
      <div className="main-wrapper">
        
        {/* 頂部標頭與角色切換 */}
        <header className="main-header">
          <div className="header-title">
            <h2>{getHeaderTitle()}</h2>
          </div>
          
          {/* 右上角切換角色與帳號選擇 */}
          <RoleSwitcher />
        </header>

        {/* 主內容展示區域 */}
        <main className="content-area">
          {renderContentView()}
        </main>
      </div>
    </div>
  );
}
