import React, { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectiveRoles, isInternal } from '@/lib/rbac';

// ============================================================================
// DASHBOARD LAYOUT — Legacy shell, now redirects to ModuleLayout
// ============================================================================

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated, profile, roles } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    const eff = getEffectiveRoles(roles, profile);
    if (isInternal(eff)) {
      navigate('/modulos/dashboard', { replace: true });
      return;
    }
  }, [isLoading, isAuthenticated, profile, roles, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return <Outlet />;
}
