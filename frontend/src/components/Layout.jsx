import React from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  const { sidebarCollapsed } = useApp();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      {/* Main content */}
      <div className={`transition-all ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <main className={location.pathname.startsWith('/logs/') ? '' : 'p-4 lg:p-6'}>
          {children}
        </main>
      </div>
    </div>
  );
}
