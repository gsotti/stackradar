import React, { createContext, useState, useContext, useEffect } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
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
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
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
      setSelectedSystem
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
