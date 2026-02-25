import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContextType } from '../types';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  // Detail page ID state
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedSystemId, setSelectedSystemId] = useState(() => {
    return localStorage.getItem('selectedSystemId') || '';
  });

  // UI state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? saved === 'true' : false;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved !== null ? saved === 'true' : false;
  });

  // Language state
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('language') || i18n.language || 'en';
  });

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    i18n.changeLanguage(lang);
    // Persist to backend (fire-and-forget)
    api.put('/auth/language', { language: lang }).catch(() => {});
  };

  // Hierarchy filters for logs (global context)
  // New hierarchy: Tenant → Site → Environment → System
  const [selectedTenant, setSelectedTenant] = useState(() => {
    const saved = localStorage.getItem('selectedTenant');
    return saved || '';
  });
  const [selectedSite, setSelectedSite] = useState(() => {
    return localStorage.getItem('selectedSite') || '';
  });
  const [selectedEnvironment, setSelectedEnvironment] = useState(() => {
    return localStorage.getItem('selectedEnvironment') || '';
  });
  const [selectedSystem, setSelectedSystem] = useState(() => {
    return localStorage.getItem('selectedSystem') || '';
  });

  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('selectedTenant', selectedTenant);
  }, [selectedTenant]);

  useEffect(() => {
    localStorage.setItem('selectedSite', selectedSite);
  }, [selectedSite]);

  useEffect(() => {
    localStorage.setItem('selectedEnvironment', selectedEnvironment);
  }, [selectedEnvironment]);

  useEffect(() => {
    localStorage.setItem('selectedSystem', selectedSystem);
  }, [selectedSystem]);

  useEffect(() => {
    localStorage.setItem('selectedSystemId', selectedSystemId);
  }, [selectedSystemId]);

  // Auto-select tenant when none is selected and user has tenants
  useEffect(() => {
    if (!selectedTenant && user?.tenant_roles && user.tenant_roles.length > 0) {
      setSelectedTenant(String(user.tenant_roles[0].tenant_id));
    }
  }, [user, selectedTenant]);

  return (
    <AppContext.Provider value={{
      selectedSiteId,
      setSelectedSiteId,
      selectedSystemId,
      setSelectedSystemId,
      darkMode,
      setDarkMode,
      sidebarCollapsed,
      setSidebarCollapsed,
      selectedTenant,
      setSelectedTenant,
      selectedSite,
      setSelectedSite,
      selectedEnvironment,
      setSelectedEnvironment,
      selectedSystem,
      setSelectedSystem,
      language,
      setLanguage
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
