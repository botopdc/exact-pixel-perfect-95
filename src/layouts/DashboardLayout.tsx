import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Outlet, Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import logoWhite from '@/assets/logo-white.png';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import {
  LogOut,
  Menu,
  User,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import {
  getFilteredMenu,
  isRouteAllowed,
  getUserLevelName,
  MenuSection,
  MenuItem,
  USER_LEVELS,
} from '@/config/menuConfig';

// ============================================================================
// APP SIDEBAR COMPONENT
// ============================================================================

function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const user = authService.getCurrentUser();
  const userLevel = user?.level ?? null;
  
  // Obter menu filtrado por permissões
  const filteredMenu = getFilteredMenu(userLevel);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  // Renderiza um item do menu
  const renderMenuItem = (item: MenuItem, isActive: boolean) => {
    if (item.disabled) {
      return (
        <SidebarMenuItem key={item.id}>
          <SidebarMenuButton
            disabled
            className="opacity-50 cursor-not-allowed"
            tooltip={item.title}
          >
            <div className="flex items-center gap-3 px-3 py-2">
              <item.icon className="h-5 w-5" />
              {!collapsed && <span>{item.title}</span>}
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={item.title}
        >
          <NavLink
            to={item.url!}
            className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
            activeClassName="bg-primary/10 text-primary"
          >
            <item.icon className="h-5 w-5" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  // Renderiza uma seção do menu
  const renderSection = (section: MenuSection) => {
    return (
      <SidebarGroup key={section.id} className="mt-4 first:mt-0">
        <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
          {section.title}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {section.items.map((item) => {
              const isActive = item.url 
                ? location.pathname === item.url || location.pathname.startsWith(item.url + '/')
                : false;
              return renderMenuItem(item, isActive);
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      {/* Logo Header */}
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link to="/dashboard" className="flex items-center gap-3">
          <img src={logoWhite} alt="OPEN Datacenter" className="h-8 w-auto" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-wider text-foreground">OPEN</span>
              <span className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase">Datacenter</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {/* Modo seguro - sem userLevel */}
        {userLevel === null && (
          <div className="px-3 py-2 mb-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertTriangle className="h-4 w-4" />
              <span>Modo seguro ativo</span>
            </div>
          </div>
        )}

        {/* Renderizar seções filtradas */}
        {filteredMenu.map(renderSection)}
      </SidebarContent>

      {/* Footer with User */}
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-3 py-2 h-auto"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                <User className="h-4 w-4 text-primary" />
              </div>
              {!collapsed && (
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium">{user?.name || user?.email || 'Usuário'}</span>
                  <span className="text-xs text-muted-foreground">
                    {userLevel !== null ? getUserLevelName(userLevel) : 'Carregando...'}
                  </span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

// ============================================================================
// DASHBOARD HEADER COMPONENT
// ============================================================================

function DashboardHeader() {
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/ceo') return 'CEO View';
    if (path === '/calculadora') return 'Calculadora de Preços';
    if (path === '/parceiros/executivo') return 'Executivo Parceiros';
    if (path === '/parceiros/gestao') return 'Gestão de Parceiros';
    if (path === '/parceiros/propostas') return 'Propostas Parceiros';
    if (path === '/parceiros/comissoes') return 'Gestão de Comissões';
    if (path === '/atendimentos/suporte') return 'Suporte';
    if (path === '/atendimentos/cs') return 'Customer Success';
    if (path === '/atendimentos/novo') return 'Novo Ticket';
    if (path.match(/^\/atendimentos\/[^/]+$/)) return 'Detalhes do Ticket';
    if (path === '/kpis/suporte') return 'KPIs - Suporte';
    if (path === '/kpis/cs') return 'KPIs - Customer Success';
    if (path === '/kpis/gestao') return 'KPIs - Gestão';
    if (path === '/health/cs') return 'Health Score - Visão CS';
    if (path === '/health/executivo') return 'Health Score - Visão Executiva';
    if (path === '/artigos') return 'Artigos';
    if (path === '/artigos/novo') return 'Novo Artigo';
    if (path.match(/^\/artigos\/[^/]+\/editar$/)) return 'Editar Artigo';
    if (path.match(/^\/artigos\/[^/]+$/)) return 'Artigo';
    if (path === '/rh/vagas') return 'Vagas / RH';
    if (path === '/rh/vagas/nova') return 'Nova Vaga';
    if (path.match(/^\/rh\/vagas\/[^/]+\/editar$/)) return 'Editar Vaga';
    if (path.match(/^\/rh\/vagas\/[^/]+$/)) return 'Detalhe da Vaga';
    return 'Dashboard';
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <SidebarTrigger className="md:hidden">
        <Menu className="h-5 w-5" />
      </SidebarTrigger>

      <div className="flex flex-col flex-1">
        {/* Page Title */}
        <h1 className="text-xl font-semibold text-foreground">
          {getPageTitle()}
        </h1>
        {/* Subtitle only on dashboard */}
        {location.pathname === '/dashboard' && (
          <span className="text-sm text-muted-foreground">
            Bem-vindo ao sistema OPEN Datacenter
          </span>
        )}
      </div>

      {/* Theme Toggle */}
      <ThemeToggle />
    </header>
  );
}

// ============================================================================
// ROUTE GUARD COMPONENT
// ============================================================================

function RouteGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const userLevel = user?.level ?? null;

  useEffect(() => {
    // Verificar se a rota atual é permitida
    if (!isRouteAllowed(location.pathname, userLevel)) {
      toast.error('Acesso não permitido', {
        description: 'Você não tem permissão para acessar esta página.',
      });
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, userLevel, navigate]);

  return <>{children}</>;
}

// ============================================================================
// DASHBOARD LAYOUT COMPONENT
// ============================================================================

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  // Check auth on mount and periodically for session expiry
  useEffect(() => {
    const checkAuth = () => {
      if (!authService.isAuthenticated()) {
        navigate('/login', { replace: true });
      }
    };

    checkAuth();
    setIsChecking(false);

    // Check session every minute
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
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader />
          <div className="flex-1 overflow-auto p-6">
            <RouteGuard>
              <Outlet />
            </RouteGuard>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
