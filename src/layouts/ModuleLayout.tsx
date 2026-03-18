import React from 'react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ModuleSidebar } from '@/components/navigation/ModuleSidebar';
import { SubNavigation } from '@/components/navigation/SubNavigation';
import { CultureTagline } from '@/components/navigation/CultureTagline';
import {
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Menu } from 'lucide-react';
import { toast } from 'sonner';
import { 
  MODULE_CONFIGS, 
  isModuleRouteAllowed,
} from '@/config/modulesConfig';
import { getEffectiveRoles } from '@/lib/rbac';

// ============================================================================
// MODULE HEADER COMPONENT
// ============================================================================

function ModuleLayoutHeader() {
  const location = useLocation();
  
  const getCurrentModule = () => {
    const path = location.pathname;
    for (const [id, config] of Object.entries(MODULE_CONFIGS)) {
      if (path.startsWith(`/modulos/${id}`)) {
        return config;
      }
    }
    return null;
  };

  const currentModule = getCurrentModule();

  return (
    <header className="sticky top-0 z-10 flex flex-col border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <div className="flex h-14 items-center gap-4">
        <SidebarTrigger className="md:hidden">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>

        <div className="flex-1 min-w-0">
          {currentModule && (
            <h1 className="text-lg font-semibold text-foreground">
              {currentModule.title}
            </h1>
          )}
        </div>

        <NotificationBell />
        <ThemeToggle />
      </div>
      
      <div className="pb-2.5 -mt-1">
        <CultureTagline />
      </div>
    </header>
  );
}

// ============================================================================
// HELPERS: get user level from Supabase profile (no legacy fallback)
// ============================================================================

function useEffectiveUserLevel(): { level: number | null; isResolved: boolean } {
  const { profile, isLoading, session } = useAuth();

  // If Supabase session exists and profile is loaded, use it
  if (session && profile) {
    return { level: profile.level, isResolved: true };
  }

  // If Supabase is still loading, don't resolve yet
  if (isLoading) {
    return { level: null, isResolved: false };
  }

  // If Supabase session exists but profile hasn't loaded yet, wait
  if (session && !profile) {
    return { level: null, isResolved: false };
  }

  // No Supabase session — unauthenticated
  return { level: null, isResolved: true };
}

// ============================================================================
// ROUTE GUARD COMPONENT
// ============================================================================

function ModuleRouteGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { level } = useEffectiveUserLevel();

  React.useEffect(() => {
    if (!isModuleRouteAllowed(location.pathname, level)) {
      toast.error('Acesso não permitido', {
        description: 'Você não tem permissão para acessar esta página.',
      });
      navigate('/modulos/dashboard', { replace: true });
    }
  }, [location.pathname, level, navigate]);

  return <>{children}</>;
}

// ============================================================================
// MODULE LAYOUT COMPONENT
// ============================================================================

export default function ModuleLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { level, isResolved } = useEffectiveUserLevel();

  const getCurrentModuleConfig = () => {
    const path = location.pathname;
    for (const [id, config] of Object.entries(MODULE_CONFIGS)) {
      if (path.startsWith(`/modulos/${id}`)) {
        return config;
      }
    }
    return null;
  };

  const currentModuleConfig = getCurrentModuleConfig();

  // Wait for auth state to resolve before deciding
  if (!isResolved) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Auth resolved but no user → redirect to login
  if (isResolved && level === null) {
    if (import.meta.env.DEV) {
      console.log('[ModuleLayout] No auth found, redirecting to /login');
    }
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <ModuleSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <ModuleLayoutHeader />
          
          {currentModuleConfig && currentModuleConfig.subNavigation.length > 0 && (
            <SubNavigation items={currentModuleConfig.subNavigation} />
          )}
          
          <div className="flex-1 overflow-auto p-6">
            <ModuleRouteGuard>
              <Outlet />
            </ModuleRouteGuard>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
