import React, { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { sidebarCollapsed } = useApp();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 transition-colors duration-200">
      <Sidebar />

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'} min-h-screen bg-neutral-50 dark:bg-neutral-900`}>
        <main className={`min-h-screen bg-neutral-50 dark:bg-neutral-900 ${location.pathname.startsWith('/logs/') ? '' : 'p-4 sm:p-5 md:p-6 lg:p-8'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
