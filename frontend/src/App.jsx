import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Server, FileText, Settings, LogOut, Menu, X,
  Activity, AlertTriangle, CheckCircle, Clock, Search, RefreshCw,
  Plus, Trash2, Copy, Eye, EyeOff, ChevronDown, ChevronUp, Users, UserCheck, UserX, Edit2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';

// API Helper
const api = {
  token: localStorage.getItem('token'),
  
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  },
  
  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token && !path.includes('/auth/login') && !path.includes('/auth/register')) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    const res = await fetch(`/api${path}`, { ...options, headers });
    
    if (res.status === 401) {
      this.setToken(null);
      window.location.href = '/login';
      return null;
    }
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Request failed');
    }
    
    return res.json();
  },
  
  get: (path) => api.request(path),
  post: (path, data) => api.request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => api.request(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (path) => api.request(path, { method: 'DELETE' }),
};

// Auth Context
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (api.token) {
      api.get('/auth/me')
        .then(setUser)
        .catch(() => api.setToken(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);
  
  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!res.ok) throw new Error('Invalid credentials');
    
    const data = await res.json();
    api.setToken(data.access_token);
    const userData = await api.get('/auth/me');
    setUser(userData);
  };
  
  const register = async (email, password, name) => {
    await api.post('/auth/register', { email, password, name });
    await login(email, password);
  };
  
  const logout = () => {
    api.setToken(null);
    setUser(null);
  };
  
  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  return useContext(AuthContext);
}

// Login Page
function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-xl mb-4">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">LogPilot</h1>
          <p className="text-gray-500 mt-1">Log Aggregation Made Simple</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Your name"
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Loading...' : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-blue-500 hover:text-blue-600 text-sm"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Layout
function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Logs', href: '/logs', icon: FileText },
    { name: 'Systems', href: '/systems', icon: Server },
    { name: 'Kubernetes', href: '/kubernetes', icon: Activity },
    ...(user?.is_admin ? [{ name: 'Users', href: '/users', icon: Users }] : []),
  ];
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-6 py-4 border-b">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl">LogPilot</span>
          <button className="lg:hidden ml-auto" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">{user?.name?.[0] || user?.email?.[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button onClick={logout} className="text-gray-400 hover:text-gray-600">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>
      
      {/* Main content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 lg:px-6">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
        </header>
        
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// Dashboard Page
function DashboardPage() {
  const [systems, setSystems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    Promise.all([
      api.get('/systems'),
      api.get('/logs/stats?hours=24')
    ]).then(([sys, st]) => {
      setSystems(sys);
      setStats(st);
    }).finally(() => setLoading(false));
  }, []);
  
  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-blue-500" /></div>;
  
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const levelData = stats?.logs_by_level ? Object.entries(stats.logs_by_level).map(([name, value]) => ({ name, value })) : [];
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Logs (24h)</p>
              <p className="text-2xl font-bold">{stats?.total_logs?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Server className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Systems</p>
              <p className="text-2xl font-bold">{systems.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Errors (24h)</p>
              <p className="text-2xl font-bold">{(stats?.logs_by_level?.ERROR || 0) + (stats?.logs_by_level?.CRITICAL || 0)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Sources</p>
              <p className="text-2xl font-bold">{stats?.top_sources?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="font-semibold mb-4">Logs per Hour</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={stats?.logs_per_hour || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="font-semibold mb-4">Logs by Level</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={levelData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {levelData.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Top Sources */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h2 className="font-semibold mb-4">Top Sources</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stats?.top_sources?.slice(0, 5) || []} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis dataKey="source" type="category" tick={{ fontSize: 12 }} width={150} />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Logs Page
function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [systems, setSystems] = useState([]);
  const [filters, setFilters] = useState({
    system_id: '',
    level: '',
    search: '',
    limit: 100,
    offset: 0
  });
  const [expandedLog, setExpandedLog] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'live'
  const [liveLogs, setLiveLogs] = useState([]);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const liveLogsEndRef = React.useRef(null);
  
  useEffect(() => {
    api.get('/systems').then(setSystems);
  }, []);
  
  useEffect(() => {
    if (viewMode === 'table') {
      fetchLogs();
    }
  }, [filters, viewMode]);

  // Live mode polling
  useEffect(() => {
    if (viewMode === 'live' && isLiveMode) {
      const interval = setInterval(async () => {
        const params = new URLSearchParams();
        if (filters.system_id) params.append('system_id', filters.system_id);
        if (filters.level) params.append('level', filters.level);
        params.append('limit', '20');

        try {
          const data = await api.get(`/logs?${params}`);
          setLiveLogs(prev => {
            const newLogs = [...prev, ...data.logs];
            // Keep only last 500 logs
            return newLogs.slice(-500);
          });
        } catch (error) {
          console.error('Failed to fetch live logs:', error);
        }
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
  }, [viewMode, isLiveMode, filters.system_id, filters.level]);

  // Auto-scroll in live mode
  useEffect(() => {
    if (viewMode === 'live' && isLiveMode) {
      liveLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveLogs, viewMode, isLiveMode]);
  
  const fetchLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    
    try {
      const data = await api.get(`/logs?${params}`);
      setLogs(data.logs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  };
  
  const getLevelBadgeClass = (level) => {
    const classes = {
      DEBUG: 'bg-gray-100 text-gray-700',
      INFO: 'bg-blue-100 text-blue-700',
      WARNING: 'bg-yellow-100 text-yellow-700',
      ERROR: 'bg-red-100 text-red-700',
      CRITICAL: 'bg-red-200 text-red-900'
    };
    return classes[level] || classes.INFO;
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Logs</h1>
        <div className="flex gap-2">
          {viewMode === 'table' && (
            <button onClick={fetchLogs} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => { setViewMode('table'); setIsLiveMode(false); }}
              className={`px-6 py-3 font-medium ${
                viewMode === 'table'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => { setViewMode('live'); setLiveLogs([]); }}
              className={`px-6 py-3 font-medium flex items-center gap-2 ${
                viewMode === 'live'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Activity className="w-4 h-4" />
              Live View
            </button>
          </div>
        </div>
      </div>

      {/* Filters - Only show search in live mode */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">System</label>
            <select
              value={filters.system_id}
              onChange={(e) => setFilters({ ...filters, system_id: e.target.value, offset: 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Systems</option>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
            <select
              value={filters.level}
              onChange={(e) => setFilters({ ...filters, level: e.target.value, offset: 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Levels</option>
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, offset: 0 })}
                placeholder="Search logs..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
      ) : (
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">System</label>
              <select
                value={filters.system_id}
                onChange={(e) => setFilters({ ...filters, system_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Systems</option>
                {systems.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
              <select
                value={filters.level}
                onChange={(e) => setFilters({ ...filters, level: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Levels</option>
                <option value="DEBUG">DEBUG</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                </tr>
              </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(log.timestamp), 'MMM dd HH:mm:ss')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getLevelBadgeClass(log.level)}`}>
                          {log.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {log.source || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">
                        {log.message}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {expandedLog === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 bg-gray-50">
                          <pre className="text-sm whitespace-pre-wrap font-mono bg-white p-4 rounded border overflow-x-auto">
                            {log.message}
                            {log.metadata && (
                              <>
                                {'\n\n--- Metadata ---\n'}
                                {log.metadata}
                              </>
                            )}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-4 py-3 border-t flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {filters.offset + 1} - {Math.min(filters.offset + filters.limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })}
              disabled={filters.offset === 0}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
              disabled={filters.offset + filters.limit >= total}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Live View */}
      {viewMode === 'live' && (
        <div className="bg-black rounded-xl shadow-sm overflow-hidden border border-gray-700">
          <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className={`w-4 h-4 ${isLiveMode ? 'text-green-400 animate-pulse' : 'text-gray-400'}`} />
              <span className="text-sm font-mono text-gray-300">
                {isLiveMode ? 'Live streaming...' : 'Paused'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLiveLogs([])}
                className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
              >
                Clear
              </button>
              <button
                onClick={() => setIsLiveMode(!isLiveMode)}
                className={`px-3 py-1 text-xs rounded ${
                  isLiveMode
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isLiveMode ? 'Pause' : 'Start'}
              </button>
            </div>
          </div>

          <div className="h-[600px] overflow-y-auto bg-black p-4 font-mono text-sm">
            {liveLogs.length === 0 ? (
              <div className="text-gray-500 text-center py-12">
                {isLiveMode ? 'Waiting for logs...' : 'Click "Start" to begin live streaming'}
              </div>
            ) : (
              <div className="space-y-1">
                {liveLogs.map((log, index) => {
                  const levelColors = {
                    DEBUG: 'text-gray-400',
                    INFO: 'text-blue-400',
                    WARNING: 'text-yellow-400',
                    ERROR: 'text-red-400',
                    CRITICAL: 'text-red-600'
                  };
                  const levelColor = levelColors[log.level] || levelColors.INFO;

                  return (
                    <div key={`${log.id}-${index}`} className="flex gap-2 hover:bg-gray-900 px-2 py-1 rounded">
                      <span className="text-gray-500 flex-shrink-0">
                        {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                      </span>
                      <span className={`${levelColor} font-semibold flex-shrink-0 w-16`}>
                        [{log.level}]
                      </span>
                      {log.source && (
                        <span className="text-purple-400 flex-shrink-0">
                          {log.source}:
                        </span>
                      )}
                      <span className="text-green-300">{log.message}</span>
                    </div>
                  );
                })}
                <div ref={liveLogsEndRef} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Systems Page
function SystemsPage() {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSystem, setEditingSystem] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', retention_days: 30 });
  const [visibleTokens, setVisibleTokens] = useState({});
  
  useEffect(() => {
    fetchSystems();
  }, []);
  
  const fetchSystems = async () => {
    setLoading(true);
    const data = await api.get('/systems');
    setSystems(data);
    setLoading(false);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingSystem) {
      await api.put(`/systems/${editingSystem.id}`, form);
    } else {
      await api.post('/systems', form);
    }
    setShowForm(false);
    setEditingSystem(null);
    setForm({ name: '', description: '', retention_days: 30 });
    fetchSystems();
  };
  
  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this system?')) {
      await api.delete(`/systems/${id}`);
      fetchSystems();
    }
  };
  
  const handleRegenerateToken = async (id) => {
    if (confirm('Are you sure? This will invalidate the current token.')) {
      await api.post(`/systems/${id}/regenerate-token`);
      fetchSystems();
    }
  };
  
  const copyToken = (token) => {
    navigator.clipboard.writeText(token);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Systems</h1>
        <button
          onClick={() => { setShowForm(true); setEditingSystem(null); setForm({ name: '', description: '', retention_days: 30 }); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          <Plus className="w-4 h-4" />
          Add System
        </button>
      </div>
      
      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              {editingSystem ? 'Edit System' : 'Add New System'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Retention (days)</label>
                <input
                  type="number"
                  value={form.retention_days}
                  onChange={(e) => setForm({ ...form, retention_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min={1}
                  max={365}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  {editingSystem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Systems List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : systems.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border">
            <Server className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No systems yet. Create one to start collecting logs.</p>
          </div>
        ) : (
          systems.map((system) => (
            <div key={system.id} className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{system.name}</h3>
                  <p className="text-gray-500 text-sm">{system.description || 'No description'}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingSystem(system); setForm(system); setShowForm(true); }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(system.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Retention:</span>
                  <span className="ml-2 font-medium">{system.retention_days} days</span>
                </div>
                <div>
                  <span className="text-gray-500">Created:</span>
                  <span className="ml-2 font-medium">
                    {formatDistanceToNow(new Date(system.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">API Token</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVisibleTokens({ ...visibleTokens, [system.id]: !visibleTokens[system.id] })}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {visibleTokens[system.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => copyToken(system.api_token)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRegenerateToken(system.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <code className="text-sm bg-white px-3 py-2 rounded border block break-all">
                  {visibleTokens[system.id] ? system.api_token : '••••••••••••••••••••••••••••••••'}
                </code>
                
                <div className="mt-3 text-xs text-gray-500">
                  <p className="font-medium mb-1">Ingest Endpoint:</p>
                  <code className="bg-white px-2 py-1 rounded border block">
                    POST /api/ingest/{'{api_token}'}
                  </code>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Kubernetes Page
function KubernetesPage() {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const fetchMetrics = async () => {
    try {
      const data = await api.get('/k8s/metrics');
      setMetrics(data);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }
  
  if (metrics.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Kubernetes Monitoring</h1>
        <div className="bg-white rounded-xl p-12 text-center border">
          <Activity className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">No Kubernetes metrics available yet.</p>
          <p className="text-sm text-gray-400">
            Deploy the metrics collector to your cluster to start monitoring.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kubernetes Monitoring</h1>
        <button onClick={fetchMetrics} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
      
      {metrics.map((m) => (
        <div key={m.id} className="space-y-4">
          <h2 className="text-lg font-semibold">{m.cluster_name || 'Cluster'}</h2>
          
          {/* Resource Usage */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">CPU Usage</span>
                <Activity className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold">{m.cpu_usage_percent?.toFixed(1)}%</p>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 rounded-full h-2" 
                  style={{ width: `${Math.min(m.cpu_usage_percent, 100)}%` }}
                />
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Memory Usage</span>
                <Activity className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-2xl font-bold">{m.memory_usage_percent?.toFixed(1)}%</p>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-500 rounded-full h-2" 
                  style={{ width: `${Math.min(m.memory_usage_percent, 100)}%` }}
                />
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Nodes</span>
                <Server className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold">{m.node_ready}/{m.node_count}</p>
              <p className="text-sm text-gray-500">Ready / Total</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Pods</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold">{m.pod_running}/{m.pod_count}</p>
              <p className="text-sm text-gray-500">
                Running: {m.pod_running} | Pending: {m.pod_pending} | Failed: {m.pod_failed}
              </p>
            </div>
          </div>
          
          {/* Workloads */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="font-medium mb-4">Deployments</h3>
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold text-green-600">{m.deployment_ready}</div>
                <div className="text-gray-400">/</div>
                <div className="text-2xl text-gray-500">{m.deployment_count}</div>
              </div>
              <p className="text-sm text-gray-500 mt-2">Ready / Total</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="font-medium mb-4">Services</h3>
              <div className="text-3xl font-bold">{m.service_count}</div>
              <p className="text-sm text-gray-500 mt-2">Total Services</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="font-medium mb-4">PVCs</h3>
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold text-green-600">{m.pvc_bound}</div>
                <div className="text-gray-400">/</div>
                <div className="text-2xl text-gray-500">{m.pvc_count}</div>
              </div>
              <p className="text-sm text-gray-500 mt-2">Bound / Total</p>
            </div>
          </div>
          
          {/* Alerts */}
          {m.alerts && JSON.parse(m.alerts).length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Alerts
              </h3>
              <div className="space-y-2">
                {JSON.parse(m.alerts).map((alert, i) => (
                  <div key={i} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                    {alert}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="text-sm text-gray-400">
            Last updated: {formatDistanceToNow(new Date(m.updated_at), { addSuffix: true })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Users Page (Admin Only)
function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', is_admin: false, auto_approve: true });
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', is_admin: false });

  const loadUsers = async () => {
    try {
      setLoading(true);
      const [allUsers, pending] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/users/pending')
      ]);
      setUsers(allUsers);
      setPendingUsers(pending);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const approveUser = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/approve`);
      await loadUsers();
    } catch (error) {
      alert('Failed to approve user: ' + error.message);
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await api.delete(`/admin/users/${userId}`);
      await loadUsers();
    } catch (error) {
      alert('Failed to delete user: ' + error.message);
    }
  };

  const toggleUserActive = async (userId, isActive) => {
    try {
      await api.post(`/admin/users/${userId}/${isActive ? 'deactivate' : 'activate'}`);
      await loadUsers();
    } catch (error) {
      alert(`Failed to ${isActive ? 'deactivate' : 'activate'} user: ` + error.message);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();

    if (!newUser.email || !newUser.password) {
      alert('Email and password are required');
      return;
    }

    try {
      // Register the user
      await api.post('/auth/register', {
        email: newUser.email,
        password: newUser.password,
        name: newUser.name || null
      });

      // If auto-approve is enabled, get the user and approve them
      if (newUser.auto_approve) {
        const allUsers = await api.get('/admin/users');
        const createdUser = allUsers.find(u => u.email === newUser.email);
        if (createdUser && !createdUser.is_approved) {
          await api.post(`/admin/users/${createdUser.id}/approve`);
        }
      }

      // Reset form and close modal
      setNewUser({ email: '', password: '', name: '', is_admin: false, auto_approve: true });
      setShowCreateModal(false);
      await loadUsers();
    } catch (error) {
      alert('Failed to create user: ' + error.message);
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email,
      password: '',
      is_admin: user.is_admin
    });
    setShowEditModal(true);
  };

  const updateUser = async (e) => {
    e.preventDefault();

    try {
      const updateData = {
        name: editForm.name,
        email: editForm.email,
        is_admin: editForm.is_admin
      };

      // Only include password if it's been changed
      if (editForm.password && editForm.password.length > 0) {
        updateData.password = editForm.password;
      }

      await api.put(`/admin/users/${editingUser.id}`, updateData);

      // Reset form and close modal
      setEditForm({ name: '', email: '', password: '', is_admin: false });
      setEditingUser(null);
      setShowEditModal(false);
      await loadUsers();
    } catch (error) {
      alert('Failed to update user: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Check if current user is admin
  if (!currentUser?.is_admin) {
    return (
      <div className="text-center py-12">
        <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Admin Access Required</h2>
        <p className="text-gray-500">You need administrator privileges to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">User Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create User
          </button>
          <button
            onClick={loadUsers}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold">{users.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-50 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-2xl font-bold">{pendingUsers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-2xl font-bold">
                {users.filter(u => u.is_active && u.is_approved).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'all'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'pending'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pending Approval ({pendingUsers.length})
            </button>
          </div>
        </div>

        {/* User List */}
        <div className="p-6">
          {activeTab === 'pending' && pendingUsers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No pending users</p>
            </div>
          )}

          {activeTab === 'all' && users.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No users found</p>
            </div>
          )}

          <div className="space-y-3">
            {(activeTab === 'pending' ? pendingUsers : users).map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="font-medium text-gray-700">
                        {user.name?.[0] || user.email[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{user.name || 'Unnamed User'}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Badges */}
                  {user.is_admin && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                      Admin
                    </span>
                  )}
                  {user.is_approved ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                      Approved
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                      Pending
                    </span>
                  )}
                  {user.is_active ? (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                      Inactive
                    </span>
                  )}

                  {/* Actions */}
                  {!user.is_approved && (
                    <button
                      onClick={() => approveUser(user.id)}
                      className="px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 flex items-center gap-1"
                    >
                      <UserCheck className="w-4 h-4" />
                      Approve
                    </button>
                  )}

                  {user.is_approved && (
                    <button
                      onClick={() => toggleUserActive(user.id, user.is_active)}
                      className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${
                        user.is_active
                          ? 'bg-orange-500 text-white hover:bg-orange-600'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {user.is_active ? (
                        <>
                          <UserX className="w-4 h-4" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4" />
                          Activate
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => openEditModal(user)}
                    className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 flex items-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>

                  <button
                    onClick={() => deleteUser(user.id)}
                    className="px-3 py-1.5 bg-red-500 text-white text-sm rounded hover:bg-red-600 flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Create New User</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={createUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter password"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto-approve"
                  checked={newUser.auto_approve}
                  onChange={(e) => setNewUser({ ...newUser, auto_approve: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="auto-approve" className="text-sm text-gray-700">
                  Auto-approve user (recommended)
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Edit User</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={updateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password (Leave empty to keep current)
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter new password"
                  minLength={6}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-is-admin"
                  checked={editForm.is_admin}
                  onChange={(e) => setEditForm({ ...editForm, is_admin: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="edit-is-admin" className="text-sm text-gray-700">
                  Administrator privileges
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Protected Route
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <Layout>{children}</Layout>;
}

// App
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/logs" element={<ProtectedRoute><LogsPage /></ProtectedRoute>} />
          <Route path="/systems" element={<ProtectedRoute><SystemsPage /></ProtectedRoute>} />
          <Route path="/kubernetes" element={<ProtectedRoute><KubernetesPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
