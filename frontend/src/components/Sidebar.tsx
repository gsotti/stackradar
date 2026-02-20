import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Server, Activity, LogOut, Menu, X,
  Moon, Sun, ChevronLeft, ChevronRight, Package, Globe, Shield, Building2, Users, Settings
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { usePermissions } from '../hooks/usePermissions';
import { getGravatarUrl } from '../utils/md5';
import { api } from '../utils/api';
import Logo from './Logo';
import { Tenant, Site, Environment } from '../types';

export default function Sidebar() {
  const { user, logout, isSuperadmin, isOrgAdmin } = useAuth();
  const { isViewer } = usePermissions();
  const {
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
    setSelectedSystem
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);

  // Hide logs/environments/systems when all sites in the tenant are uptime-only
  const isUptimeOnly = sites.length > 0 && sites.every(s => !s.has_metrics);

  const navigation = [
    ...(!isSuperadmin() ? [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      ...(!isUptimeOnly ? [
        { name: 'Logs', href: '/logs/live', icon: Activity },
      ] : []),
      { name: 'Sites', href: '/sites', icon: Server },
      ...(!isViewer() && !isUptimeOnly ? [
        { name: 'Environments', href: '/environments', icon: Globe },
        { name: 'Systems', href: '/systems', icon: Package }
      ] : []),
    ] : []),
    ...(isOrgAdmin() ? [
      { name: 'Tenants', href: '/tenants', icon: Building2 },
      { name: 'Users', href: '/organization/users', icon: Users },
      { name: 'Settings', href: '/admin/settings', icon: Settings }
    ] : []),
    ...(isSuperadmin() ? [
      { name: 'Superadmin', href: '/superadmin', icon: Shield }
    ] : []),
  ];

  // Fetch tenants from API
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const tenantsData = await api.get<Tenant[]>('/tenants');
        setTenants(tenantsData);

        // Auto-select tenant if user has exactly one and none is selected
        if (tenantsData.length === 1 && !selectedTenant) {
          setSelectedTenant(String(tenantsData[0].id));
        }
      } catch (error) {
        console.error('Error fetching tenants:', error);
      }
    };

    if (user) {
      fetchTenants();
    }
  }, [user, selectedTenant, setSelectedTenant]);

  // Fetch sites based on selected tenant
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedTenant) params.append('tenant_id', selectedTenant);
        const sitesData = await api.get<Site[]>(`/sites?${params}`);
        setSites(Array.isArray(sitesData) ? sitesData : []);

        // Clear site selection if current site is not in the new list
        if (selectedSite && sitesData.length > 0) {
          const siteIds = sitesData.map(s => String(s.id));
          if (!siteIds.includes(String(selectedSite))) {
            setSelectedSite('');
          }
        } else if (!selectedTenant) {
          // Clear site when tenant is cleared (for admin users)
          setSelectedSite('');
        }
      } catch (error) {
        console.error('Error fetching sites:', error);
        setSites([]);
      }
    };

    if (user) {
      fetchSites();
    }
  }, [user, selectedTenant, selectedSite, setSelectedSite]);

  // Fetch environments based on selected site (or all if no site selected)
  useEffect(() => {
    const fetchEnvironments = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedSite) params.append('site_id', selectedSite);
        const environmentsData = await api.get<Environment[]>(`/environments?${params}`);
        setEnvironments(Array.isArray(environmentsData) ? environmentsData : []);

        // Clear environment selection if current environment is not in the new list
        if (selectedEnvironment && environmentsData.length > 0) {
          const envIds = environmentsData.map(e => String(e.id));
          if (!envIds.includes(String(selectedEnvironment))) {
            setSelectedEnvironment('');
          }
        } else if (!selectedSite) {
          // Clear environment when site is cleared
          setSelectedEnvironment('');
        }
      } catch (error) {
        console.error('Error fetching environments:', error);
        setEnvironments([]);
      }
    };

    if (user) {
      fetchEnvironments();
    }
  }, [user, selectedSite, selectedEnvironment, setSelectedEnvironment]);


  return (
    <>
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 shadow-xl transform transition-all duration-300 lg:translate-x-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarCollapsed ? 'lg:w-sidebar-collapsed' : 'lg:w-sidebar'} w-sidebar`}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-neutral-200 dark:border-neutral-700/50 flex-shrink-0">
          <div className="flex-shrink-0 hover:scale-110 transition-transform duration-300 text-primary-600 dark:text-primary-400">
            <Logo size={40} animated />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                StackRadar
              </span>
              {user?.organization_name && (
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {user.organization_name}
                </span>
              )}
            </div>
          )}
          <button className="lg:hidden ml-auto text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors p-1" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Tenant Selector - Show for users with multiple tenants (except superadmins) */}
          {!sidebarCollapsed && !isSuperadmin() && tenants.length > 1 && (
            <div className="px-3 pt-3 pb-2">
              <select
                value={selectedTenant}
                onChange={(e) => {
                  setSelectedTenant(e.target.value);
                  // Clear all dependent filters when tenant changes
                  setSelectedSite('');
                  setSelectedEnvironment('');
                  setSelectedSystem('');
                  // Navigate to dashboard so data reloads for the new tenant
                  navigate('/');
                }}
                className="input-base w-full text-sm"
              >
                <option value="">All Tenants</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <nav className="p-3 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                    isActive
                      ? 'bg-primary-500 text-white shadow-md'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                  title={sidebarCollapsed ? item.name : ''}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {!sidebarCollapsed && <span>{item.name}</span>}
                  {sidebarCollapsed && (
                    <div className="hidden lg:group-hover:block absolute left-full ml-2 px-2.5 py-1.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs rounded-md whitespace-nowrap z-50 shadow-lg font-medium">
                      {item.name}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Context Filters - only show on Logs pages */}
          {!sidebarCollapsed && location.pathname.startsWith('/logs') && (
            <div className="px-3 py-3 space-y-3 border-t border-neutral-200 dark:border-neutral-700/50">
              <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">Context</h3>

              {/* Site */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 px-1 text-label">Site</label>
                <select
                  value={selectedSite}
                  onChange={(e) => {
                    setSelectedSite(e.target.value);
                    // Clear dependent filters when site changes
                    setSelectedEnvironment('');
                    setSelectedSystem('');
                  }}
                  className="input-base w-full text-sm"
                >
                  <option value="">All sites</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Environment */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 px-1 text-label">Environment</label>
                <select
                  value={selectedEnvironment}
                  onChange={(e) => {
                    setSelectedEnvironment(e.target.value);
                    // Clear dependent filters when environment changes
                    setSelectedSystem('');
                  }}
                  className="input-base w-full text-sm"
                >
                  <option value="">All environments</option>
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.display_name || env.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Bottom section - fixed */}
        <div className="border-t border-neutral-200 dark:border-neutral-700/50 flex-shrink-0 bg-white dark:bg-neutral-900">
          {/* Dark Mode Toggle */}
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-700/50">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 rounded-lg transition-all text-sm font-medium"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 text-accent-warning" />
                  {!sidebarCollapsed && <span>Light Mode</span>}
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-primary-600" />
                  {!sidebarCollapsed && <span>Dark Mode</span>}
                </>
              )}
            </button>
          </div>

          {/* Collapse button */}
          <div className="hidden lg:block p-3 border-b border-neutral-200 dark:border-neutral-700/50">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 rounded-lg transition-all text-sm font-medium"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>

          {/* User section */}
          <div className="p-3">
            <div className={`flex items-center gap-2.5 py-2.5 px-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg ${sidebarCollapsed ? 'justify-center' : ''} hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-all`}>
              {user?.email && getGravatarUrl(user.email) ? (
                <img
                  src={getGravatarUrl(user.email, 32)!}
                  alt={user.name || user.email}
                  className="w-8 h-8 rounded-full flex-shrink-0 min-w-[2rem] ring-1.5 ring-neutral-300 dark:ring-neutral-600"
                />
              ) : (
                <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0 min-w-[2rem] text-white text-xs font-semibold">
                  {user?.name?.[0] || user?.email?.[0]}
                </div>
              )}
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-neutral-900 dark:text-white">{user?.name || 'User'}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user?.email}</p>
                  </div>
                  <button onClick={logout} className="text-neutral-600 dark:text-neutral-300 hover:text-accent-danger dark:hover:text-accent-danger transition-colors p-1.5 rounded hover:bg-accent-danger/10 dark:hover:bg-accent-danger/20" title="Logout">
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              )}
              {sidebarCollapsed && (
                <button
                  onClick={logout}
                  className="hidden lg:group-hover:block absolute left-full ml-2 px-2.5 py-1.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs rounded-md whitespace-nowrap z-50 shadow-lg font-medium"
                  title="Logout"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-40 bg-primary-500 hover:bg-primary-600 p-2.5 rounded-lg shadow-md border border-primary-600 transition-all hover:scale-110 active:scale-95"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="w-5 h-5 text-white" />
      </button>
    </>
  );
}
