import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Layout from './Layout';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireNotViewer?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false, requireNotViewer = false }: ProtectedRouteProps) {
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

  if (requireAdmin && !user.is_admin) {
    return <Navigate to="/" replace />;
  }

  if (requireNotViewer && user.is_viewer) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
}
