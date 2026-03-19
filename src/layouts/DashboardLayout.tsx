import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectiveRoles, isInternal } from '@/lib/rbac';

// ============================================================================
// DASHBOARD LAYOUT — Legacy shell, now redirects to ModuleLayout
// ============================================================================

export default function DashboardLayout() {
  const { isLoading, isAuthenticated, profile, roles } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const eff = getEffectiveRoles(roles, profile);
  if (isInternal(eff)) {
    return <Navigate to="/modulos/dashboard" replace />;
  }

  return <Outlet />;
}
