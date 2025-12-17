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
import SystemsPage from './pages/SystemsPage';
import SystemDetailsPage from './pages/SystemDetailsPage';
import ApplicationsPage from './pages/ApplicationsPage';
import UsersPage from './pages/UsersPage';
import AdminSettingsPage from './pages/AdminSettingsPage';

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
              <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/logs/live" element={<ProtectedRoute><LogsLivePage /></ProtectedRoute>} />
              <Route path="/logs/table" element={<ProtectedRoute><LogsTablePage /></ProtectedRoute>} />
              <Route path="/logs" element={<Navigate to="/logs/live" replace />} />
              <Route path="/systems" element={<ProtectedRoute><SystemsPage /></ProtectedRoute>} />
              <Route path="/systems/:id" element={<ProtectedRoute><SystemDetailsPage /></ProtectedRoute>} />
              <Route path="/applications" element={<ProtectedRoute><ApplicationsPage /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute><AdminSettingsPage /></ProtectedRoute>} />
            </Routes>
          </NotificationProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
