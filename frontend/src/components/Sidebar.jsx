import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Server, Activity, Users, LogOut, Menu, X,
  Moon, Sun, ChevronLeft, ChevronRight, Package
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getGravatarUrl } from '../utils/md5';
import { api } from '../utils/api';
import Logo from './Logo';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const {
    darkMode,
    setDarkMode,
    sidebarCollapsed,
    setSidebarCollapsed,
    selectedTenant,
    setSelectedTenant,
    selectedSystemType,
    setSelectedSystemType,
    selectedSystemId,
    setSelectedSystemId,
    selectedEnvironment,
    setSelectedEnvironment,
    selectedApplication,
    setSelectedApplication,
    selectedApplicationId,
    setSelectedApplicationId
  } = useApp();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [systems, setSystems] = useState([]);
  const [applications, setApplications] = useState([]);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Logs', href: '/logs/live', icon: Activity },
    { name: 'Systems', href: '/systems', icon: Server },
    { name: 'Applications', href: '/applications', icon: Package },
    ...(user?.is_admin ? [{ name: 'Users', href: '/users', icon: Users }] : []),
  ];

  // Fetch tenants from API
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const tenantsData = await api.get('/tenants');
        setTenants(tenantsData);
      } catch (error) {
        console.error('Error fetching tenants:', error);
      }
    };

    if (user) {
      fetchTenants();
    }
  }, [user]);

  // Fetch systems based on selected tenant
  useEffect(() => {
    const fetchSystems = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedTenant) params.append('tenant_id', selectedTenant);
        const systemsData = await api.get(`/systems?${params}`);
        setSystems(systemsData);
      } catch (error) {
        console.error('Error fetching systems:', error);
      }
    };

    if (user) {
      fetchSystems();
    }
  }, [user, selectedTenant]);

  // Fetch applications based on selected tenant and system
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedTenant) params.append('tenant_id', selectedTenant);
        if (selectedSystemType) {
          // Find the system ID from the selected system name
          const system = systems.find(s => s.name === selectedSystemType);
          if (system) params.append('system_id', system.id);
        }
        const applicationsData = await api.get(`/applications?${params}`);
        setApplications(applicationsData);
      } catch (error) {
        console.error('Error fetching applications:', error);
      }
    };

    if (user) {
      fetchApplications();
    }
  }, [user, selectedTenant, selectedSystemType, systems]);

  // Environment filter moved inline to Logs pages; Sidebar no longer fetches or renders it

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
      <aside className={`fixed top-0 left-0 z-50 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-xl transform transition-all duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64`}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700 dark:to-gray-800">
          <div className="flex-shrink-0 hover:scale-110 transition-transform duration-300">
            <Logo size={48} />
          </div>
          {!sidebarCollapsed && (
            <span className="font-bold text-xl bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              LogRadar
            </span>
          )}
          <button className="lg:hidden ml-auto text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors" onClick={() => setSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tenant Selector - Minimalistic */}
        {!sidebarCollapsed && (
          <div className="px-4 pt-3 pb-2">
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="w-full px-3 py-2 text-sm border-0 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 transition-all appearance-none cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
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

        <nav className="p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-800 hover:text-gray-900 dark:hover:text-white hover:scale-105 hover:shadow-md'
                }`}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? item.name : ''}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                {!sidebarCollapsed && <span className="font-semibold">{item.name}</span>}
                {sidebarCollapsed && (
                  <div className="hidden lg:group-hover:block absolute left-full ml-3 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg whitespace-nowrap z-50 shadow-xl font-medium">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Context Filters - only show on Logs pages */}
        {!sidebarCollapsed && location.pathname.startsWith('/logs') && (
          <div className="px-4 py-3 space-y-3 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">Context</h3>

            {/* System */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 px-2">System</label>
              <select
                value={selectedSystemType}
                onChange={(e) => {
                  const name = e.target.value;
                  setSelectedSystemType(name);
                  if (!name) {
                    setSelectedSystemId('');
                  } else {
                    const sys = systems.find(s => s.name === name);
                    setSelectedSystemId(sys ? String(sys.id) : '');
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
              >
                <option value="">All systems</option>
                {systems.map((system) => (
                  <option key={system.id} value={system.name}>
                    {system.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Application */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 px-2">Application</label>
              <select
                value={selectedApplicationId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedApplicationId(id);
                  if (!id) {
                    setSelectedApplication('');
                    return;
                  }
                  const app = applications.find(a => String(a.id) === String(id));
                  setSelectedApplication(app ? app.name : '');
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
              >
                <option value="">All applications</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Environment selector removed from Sidebar; use inline on Logs pages */}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-t from-gray-50 to-white dark:from-gray-700 dark:to-gray-800">
          {/* Dark Mode Toggle */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-full flex items-center justify-center px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-600 dark:hover:to-gray-700 rounded-xl transition-all hover:shadow-md"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? (
                <>
                  <Sun className="w-5 h-5 text-yellow-500" />
                  {!sidebarCollapsed && <span className="ml-2 text-sm font-semibold">Light Mode</span>}
                </>
              ) : (
                <>
                  <Moon className="w-5 h-5 text-blue-600" />
                  {!sidebarCollapsed && <span className="ml-2 text-sm font-semibold">Dark Mode</span>}
                </>
              )}
            </button>
          </div>

          {/* Collapse button */}
          <div className="hidden lg:block p-3 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-600 dark:hover:to-gray-700 rounded-xl transition-all hover:shadow-md"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <>
                  <ChevronLeft className="w-5 h-5" />
                  <span className="ml-2 text-sm font-semibold">Collapse</span>
                </>
              )}
            </button>
          </div>

          {/* User section */}
          <div className="p-4">
            <div className={`flex items-center gap-3 py-2 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-xl ${sidebarCollapsed ? 'justify-center px-2' : 'px-4'} hover:shadow-md transition-all`}>
              {user?.email && getGravatarUrl(user.email) ? (
                <img
                  src={getGravatarUrl(user.email, 40)}
                  alt={user.name || user.email}
                  className="w-10 h-10 rounded-full flex-shrink-0 min-w-[2.5rem] ring-2 ring-gray-300 dark:ring-gray-600 hover:ring-blue-500 transition-all"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 min-w-[2.5rem] shadow-lg ring-2 ring-gray-300 dark:ring-gray-600 hover:ring-blue-500 transition-all">
                  <span className="text-sm font-bold text-white">{user?.name?.[0] || user?.email?.[0]}</span>
                </div>
              )}
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{user?.email}</p>
                  </div>
                  <button onClick={logout} className="text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20" title="Logout">
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              )}
              {sidebarCollapsed && (
                <button
                  onClick={logout}
                  className="hidden lg:block absolute left-full ml-3 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition shadow-xl font-medium"
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
        className="lg:hidden fixed top-4 left-4 z-40 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 p-3 rounded-xl shadow-xl border border-blue-500 transition-all hover:scale-110 active:scale-95"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="w-6 h-6 text-white" />
      </button>
    </>
  );
}
