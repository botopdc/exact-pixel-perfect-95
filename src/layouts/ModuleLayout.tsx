import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { authService } from '@/services/authService';
import { ModuleSidebar } from '@/components/navigation/ModuleSidebar';
import { SubNavigation } from '@/components/navigation/SubNavigation';
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
  USER_LEVELS,
} from '@/config/modulesConfig';

// ============================================================================
// MODULE HEADER COMPONENT
// ============================================================================

function ModuleLayoutHeader() {
  const location = useLocation();
  
  // Find current module based on URL
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
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <SidebarTrigger className="md:hidden">
        <Menu className="h-5 w-5" />
      </SidebarTrigger>

      <div className="flex-1">
        {currentModule && (
          <h1 className="text-lg font-semibold text-foreground">
            {currentModule.title}
          </h1>
        )}
      </div>

      <ThemeToggle />
    </header>
  );
}

// ============================================================================
// ROUTE GUARD COMPONENT
// ============================================================================

function ModuleRouteGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const userLevel = user?.level ?? null;

  useEffect(() => {
    // Verificar se a rota atual é permitida
    if (!isModuleRouteAllowed(location.pathname, userLevel)) {
      toast.error('Acesso não permitido', {
        description: 'Você não tem permissão para acessar esta página.',
      });
      navigate('/modulos/dashboard', { replace: true });
    }
  }, [location.pathname, userLevel, navigate]);

  return <>{children}</>;
}

// ============================================================================
// MODULE LAYOUT COMPONENT
// ============================================================================

export default function ModuleLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  // Find current module for sub-navigation
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

  // Check auth on mount
  useEffect(() => {
    const checkAuth = () => {
      if (!authService.isAuthenticated()) {
        navigate('/login', { replace: true });
        return;
      }
      
      // Executivos (700) usam ExecutiveLayout
      const user = authService.getCurrentUser();
      if (user?.level === USER_LEVELS.COMERCIAL) {
        // Executivos podem acessar módulo comercial, mas com visão limitada
        // Redirecionamos apenas se tentarem acessar módulos não permitidos
      }
    };

    checkAuth();
    setIsChecking(false);

    const interval = setInterval(checkAuth, 60000);
    return () => clearInterval(interval);
  }, [navigate]);

  if (isChecking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <ModuleSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <ModuleLayoutHeader />
          
          {/* Sub-navigation for current module */}
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
