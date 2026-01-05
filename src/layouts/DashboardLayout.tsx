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
  LayoutDashboard, 
  Briefcase, 
  Calculator, 
  Clock,
  LogOut,
  Menu,
  User,
  BookOpen,
  Wrench,
  Users,
  BarChart3,
  PieChart,
  TrendingUp,
  Heart,
  Activity,
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

const menuItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Vagas / RH', url: '/rh/vagas', icon: Briefcase },
  { title: 'Calculadora de Preços', url: '/calculadora', icon: Calculator },
  { title: 'Artigos', url: '/artigos', icon: BookOpen },
];

const atendimentosItems = [
  { title: 'Suporte', url: '/atendimentos/suporte', icon: Wrench },
  { title: 'Customer Success', url: '/atendimentos/cs', icon: Users },
];

const kpisItems = [
  { title: 'Suporte', url: '/kpis/suporte', icon: BarChart3 },
  { title: 'Customer Success', url: '/kpis/cs', icon: PieChart },
  { title: 'Gestão', url: '/kpis/gestao', icon: TrendingUp },
];

const healthScoreItems = [
  { title: 'Visão CS', url: '/health-score/cs', icon: Heart },
  { title: 'Visão Executiva', url: '/health-score/executivo', icon: Activity },
];

const comingSoonItems = [
  { title: 'Relatórios', icon: Clock },
  { title: 'Faturamento', icon: Clock },
];

function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const user = authService.getCurrentUser();

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
        {/* Main Menu */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
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

        {/* Atendimentos Section */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Atendimentos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {atendimentosItems.map((item) => {
                const isActive = location.pathname === item.url || location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
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

        {/* KPIs Section */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            KPIs de Atendimento
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {kpisItems.map((item) => {
                const isActive = location.pathname === item.url || location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
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

        {/* Health Score Section */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Health Score
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {healthScoreItems.map((item) => {
                const isActive = location.pathname === item.url || location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
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

        {/* Coming Soon */}
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Em breve...
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {comingSoonItems.map((item) => (
                <SidebarMenuItem key={item.title}>
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
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
                  <span className="text-sm font-medium">{user?.email || 'Usuário'}</span>
                  <span className="text-xs text-muted-foreground capitalize">{user?.role || 'admin'}</span>
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

function DashboardHeader() {
  const location = useLocation();
  
  // Generate breadcrumb based on current route
  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/dashboard') return ['Dashboard'];
    if (path === '/rh/vagas') return ['Dashboard', 'Vagas / RH'];
    if (path === '/rh/vagas/nova') return ['Dashboard', 'Vagas / RH', 'Nova Vaga'];
    if (path.match(/^\/rh\/vagas\/[^/]+\/editar$/)) return ['Dashboard', 'Vagas / RH', 'Editar Vaga'];
    if (path === '/calculadora') return ['Dashboard', 'Calculadora de Preços'];
    if (path === '/artigos') return ['Dashboard', 'Artigos'];
    if (path === '/artigos/novo') return ['Dashboard', 'Artigos', 'Novo Artigo'];
    if (path.match(/^\/artigos\/[^/]+\/editar$/)) return ['Dashboard', 'Artigos', 'Editar Artigo'];
    if (path.match(/^\/artigos\/[^/]+$/)) return ['Dashboard', 'Artigos', 'Visualizar Artigo'];
    if (path === '/atendimentos/suporte') return ['Dashboard', 'Atendimentos', 'Suporte'];
    if (path === '/atendimentos/cs') return ['Dashboard', 'Atendimentos', 'Customer Success'];
    if (path === '/atendimentos/novo') return ['Dashboard', 'Atendimentos', 'Novo Ticket'];
    if (path.match(/^\/atendimentos\/[^/]+$/)) return ['Dashboard', 'Atendimentos', 'Detalhes do Ticket'];
    if (path === '/kpis/suporte') return ['Dashboard', 'KPIs', 'Suporte'];
    if (path === '/kpis/cs') return ['Dashboard', 'KPIs', 'Customer Success'];
    if (path === '/kpis/gestao') return ['Dashboard', 'KPIs', 'Gestão'];
    if (path === '/health-score/cs') return ['Dashboard', 'Health Score', 'Visão CS'];
    if (path === '/health-score/executivo') return ['Dashboard', 'Health Score', 'Visão Executiva'];
    return ['Dashboard'];
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/rh/vagas') return 'Vagas / RH';
    if (path === '/rh/vagas/nova') return 'Nova Vaga';
    if (path.match(/^\/rh\/vagas\/[^/]+\/editar$/)) return 'Editar Vaga';
    if (path === '/calculadora') return 'Calculadora de Preços';
    if (path === '/artigos') return 'Artigos';
    if (path === '/artigos/novo') return 'Novo Artigo';
    if (path.match(/^\/artigos\/[^/]+\/editar$/)) return 'Editar Artigo';
    if (path.match(/^\/artigos\/[^/]+$/)) return 'Artigo';
    if (path === '/atendimentos/suporte') return 'Fila de Suporte';
    if (path === '/atendimentos/cs') return 'Customer Success';
    if (path === '/atendimentos/novo') return 'Novo Ticket';
    if (path.match(/^\/atendimentos\/[^/]+$/)) return 'Detalhes do Ticket';
    if (path === '/kpis/suporte') return 'KPIs de Suporte';
    if (path === '/kpis/cs') return 'KPIs de Customer Success';
    if (path === '/kpis/gestao') return 'Dashboard Executivo';
    if (path === '/health-score/cs') return 'Health Score - Visão CS';
    if (path === '/health-score/executivo') return 'Health Score - Executivo';
    return 'Dashboard';
  };

  const breadcrumb = getBreadcrumb();

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
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
