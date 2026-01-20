import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Outlet, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { authService } from '@/services/authService';
import { openApi } from '@/lib/openApi';
import logoWhite from '@/assets/logo-white.png';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import {
  LayoutDashboard,
  Calculator,
  LogOut,
  Menu,
  User,
  FileStack,
  TrendingUp,
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
import { Badge } from '@/components/ui/badge';

function ExecutiveSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  // Menu items for level 700 (Executivo) only - this layout is simplified
  // IMPORTANT: Use modular routes, NOT legacy /executivo/* paths
  const menuItems = [
    { title: 'Dashboard', url: '/modulos/dashboard', icon: LayoutDashboard },
    { title: 'Calculadora de Preços', url: '/modulos/comercial/propostas/criar', icon: Calculator },
    { title: 'Propostas Salvas', url: '/modulos/comercial/propostas', icon: FileStack },
    { title: 'Meu Potencial', url: '/modulos/comercial/meu-potencial', icon: TrendingUp },
  ];

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link to="/modulos/dashboard" className="flex items-center gap-3">
          <img src={logoWhite} alt="OPEN Datacenter" className="h-8 w-auto" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-wider text-foreground">OPEN</span>
              <span className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase">Executivos</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {/* Executive Info Card */}
        {!collapsed && user && (
          <div className="mx-2 mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                Executivo
              </Badge>
            </div>
            <p className="text-sm font-medium text-foreground truncate">{user.name || user.email}</p>
          </div>
        )}

        {/* Main Menu */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
                        activeClassName="bg-primary/10 text-primary"
                      >
                        <item.icon className="h-5 w-5" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 px-3 py-2 h-auto">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                <User className="h-4 w-4 text-primary" />
              </div>
              {!collapsed && (
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {user?.name || user?.email || 'Executivo'}
                  </span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4" />
              Meu Perfil
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

function ExecutiveHeader() {
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    // Use modular routes for title matching
    if (path === '/modulos/dashboard') return 'Dashboard';
    if (path === '/modulos/comercial/propostas/criar') return 'Calculadora de Preços';
    if (path === '/modulos/comercial/propostas') return 'Propostas Salvas';
    if (path === '/modulos/comercial/meu-potencial') return 'Meu Potencial';
    if (path === '/modulos/comercial/potencial-gerente') return 'Meu Potencial (Gerente)';
    return 'Portal do Executivo';
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <SidebarTrigger className="md:hidden">
        <Menu className="h-5 w-5" />
      </SidebarTrigger>

      <div className="flex flex-col flex-1">
        <h1 className="text-xl font-semibold text-foreground">{getPageTitle()}</h1>
      </div>

      <ThemeToggle />
    </header>
  );
}

export default function ExecutiveLayout() {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const user = authService.getCurrentUser();
      
      // Must be authenticated
      if (!authService.isAuthenticated() || !user) {
        navigate('/login', { replace: true });
        return;
      }
      
      // DEPRECATED: This layout is being phased out
      // ALL internal users now use ModuleLayout - redirect to modular routes
      navigate('/modulos/dashboard', { replace: true });
      return;

      // Validate API session
      try {
        await openApi.getCurrentUser();
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          authService.logout();
          toast.error('Sessão expirada. Faça login novamente.');
          navigate('/login', { replace: true });
          return;
        }
        console.error('[ExecutiveLayout] Falha ao validar sessão via API:', err);
      }
    };

    void checkAuth().finally(() => {
      if (mounted) setIsChecking(false);
    });

    const interval = setInterval(() => {
      void checkAuth();
    }, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
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
        <ExecutiveSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <ExecutiveHeader />
          <div className="flex-1 overflow-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
