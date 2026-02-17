import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import Notification from './components/Notification';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LogsLivePage from './pages/LogsLivePage';
import LogsTablePage from './pages/LogsTablePage';
import SitesPage from './pages/SitesPage';
import SiteDetailsPage from './pages/SiteDetailsPage';
import EnvironmentsPage from './pages/EnvironmentsPage';
import SystemsPage from './pages/SystemsPage';
import UsersPage from './pages/UsersPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import SuperadminPage from './pages/SuperadminPage';
import TenantsPage from './pages/TenantsPage';
import TenantSettingsPage from './pages/TenantSettingsPage';
import TenantUsersPage from './pages/TenantUsersPage';
import AcceptInvitationPage from './pages/AcceptInvitationPage';
import OrgUsersPage from './pages/OrgUsersPage';

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <AuthProvider>
        <AppProvider>
          <NotificationProvider>
            <Notification />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/invitation/:token" element={<AcceptInvitationPage />} />
              <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/logs/live" element={<ProtectedRoute><LogsLivePage /></ProtectedRoute>} />
              <Route path="/logs/table" element={<ProtectedRoute><LogsTablePage /></ProtectedRoute>} />
              <Route path="/logs" element={<Navigate to="/logs/live" replace />} />
              <Route path="/sites" element={<ProtectedRoute><SitesPage /></ProtectedRoute>} />
              <Route path="/sites/:id" element={<ProtectedRoute><SiteDetailsPage /></ProtectedRoute>} />
              <Route path="/sites/:id/:tab" element={<ProtectedRoute><SiteDetailsPage /></ProtectedRoute>} />
              <Route path="/environments" element={<ProtectedRoute requireNotViewer><EnvironmentsPage /></ProtectedRoute>} />
              <Route path="/systems" element={<ProtectedRoute requireNotViewer><SystemsPage /></ProtectedRoute>} />
              <Route path="/tenants" element={<ProtectedRoute requireOrgAdmin><TenantsPage /></ProtectedRoute>} />
              <Route path="/tenants/:id/settings" element={<ProtectedRoute requireOrgAdmin><TenantSettingsPage /></ProtectedRoute>} />
              <Route path="/tenants/:id/settings/users" element={<ProtectedRoute requireOrgAdmin><TenantSettingsPage /></ProtectedRoute>} />
              <Route path="/tenants/:tenantId/users" element={<ProtectedRoute requireTenantAdmin><TenantUsersPage /></ProtectedRoute>} />
              <Route path="/organization/users" element={<ProtectedRoute requireOrgAdmin><OrgUsersPage /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute requireAdmin><UsersPage /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><AdminSettingsPage /></ProtectedRoute>} />
              <Route path="/superadmin" element={<ProtectedRoute requireSuperadmin><SuperadminPage /></ProtectedRoute>} />
            </Routes>
          </NotificationProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
