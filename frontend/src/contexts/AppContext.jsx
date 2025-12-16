import React, { createContext, useState, useContext, useEffect } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [selectedSystemId, setSelectedSystemId] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState(() => {
    return localStorage.getItem('selectedApplicationId') || '';
  });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? saved === 'true' : false;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved !== null ? saved === 'true' : false;
  });

  // Hierarchy filters (global context)
  const [selectedTenant, setSelectedTenant] = useState(() => {
    const saved = localStorage.getItem('selectedTenant');
    return saved || '';
  });
  const [selectedSystemType, setSelectedSystemType] = useState(() => {
    return localStorage.getItem('selectedSystemType') || '';
  });
  const [selectedEnvironment, setSelectedEnvironment] = useState(() => {
    return localStorage.getItem('selectedEnvironment') || '';
  });
  const [selectedApplication, setSelectedApplication] = useState(() => {
    return localStorage.getItem('selectedApplication') || '';
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
    localStorage.setItem('selectedSystemType', selectedSystemType);
  }, [selectedSystemType]);

  useEffect(() => {
    localStorage.setItem('selectedEnvironment', selectedEnvironment);
  }, [selectedEnvironment]);

  useEffect(() => {
    localStorage.setItem('selectedApplication', selectedApplication);
  }, [selectedApplication]);

  useEffect(() => {
    localStorage.setItem('selectedApplicationId', selectedApplicationId);
  }, [selectedApplicationId]);

  return (
    <AppContext.Provider value={{
      selectedSystemId,
      setSelectedSystemId,
      selectedApplicationId,
      setSelectedApplicationId,
      darkMode,
      setDarkMode,
      sidebarCollapsed,
      setSidebarCollapsed,
      selectedTenant,
      setSelectedTenant,
      selectedSystemType,
      setSelectedSystemType,
      selectedEnvironment,
      setSelectedEnvironment,
      selectedApplication,
      setSelectedApplication
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
