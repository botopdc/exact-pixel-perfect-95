import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Outlet, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { partnerAuthService } from '@/services/partnersService';
import { openApi } from '@/lib/openApi';
import { PARTNER_DISCOUNTS, PartnerType } from '@/types/partner';
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
  Users,
  LogOut,
  Menu,
  Building2,
  FileText,
  Handshake,
  FileStack,
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

function PartnerSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const session = partnerAuthService.getSession();

  const handleLogout = () => {
    partnerAuthService.logout();
    navigate('/parceiro/login');
  };

  const discount = session ? PARTNER_DISCOUNTS[session.tipo_parceria] : 0;
  const discountLabel = discount > 0 ? `${(discount * 100).toFixed(0)}% desconto` : null;

  const menuItems = [
    { title: 'Dashboard', url: '/parceiro/dashboard', icon: LayoutDashboard },
    { title: 'Calculadora de Preços', url: '/parceiro/calculadora', icon: Calculator },
    { title: 'Propostas Salvas', url: '/parceiro/propostas', icon: FileStack },
  ];

  // FINDER gets access to referrals
  const finderItems = session?.tipo_parceria === 'FINDER' ? [
    { title: 'Minhas Indicações', url: '/parceiro/indicacoes', icon: Users },
  ] : [];

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link to="/parceiro/dashboard" className="flex items-center gap-3">
          <img src={logoWhite} alt="OPEN Datacenter" className="h-8 w-auto" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-wider text-foreground">OPEN</span>
              <span className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase">Parceiros</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {/* Partner Info Card */}
        {!collapsed && session && (
          <div className="mx-2 mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {session.tipo_parceria}
              </Badge>
              {discountLabel && (
                <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  {discountLabel}
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium text-foreground truncate">{session.empresa}</p>
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

        {/* FINDER Section */}
        {finderItems.length > 0 && (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Indicações
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {finderItems.map((item) => {
                  const isActive = location.pathname === item.url || location.pathname.startsWith(item.url);
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
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 px-3 py-2 h-auto">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              {!collapsed && (
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {session?.empresa || 'Parceiro'}
                  </span>
                  <span className="text-xs text-muted-foreground">{session?.email}</span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem disabled>
              <FileText className="mr-2 h-4 w-4" />
              Meu Contrato
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

function PartnerHeader() {
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/parceiro/dashboard') return 'Dashboard';
    if (path === '/parceiro/calculadora') return 'Calculadora de Preços';
    if (path === '/parceiro/propostas') return 'Propostas Salvas';
    if (path === '/parceiro/indicacoes') return 'Minhas Indicações';
    if (path.match(/^\/parceiro\/indicacoes\/nova$/)) return 'Nova Indicação';
    return 'Portal do Parceiro';
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

export default function PartnerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      // First check local session exists
      const localSession = partnerAuthService.getSession();
      if (!localSession) {
        navigate('/parceiro/login', { replace: true });
        return;
      }

      if (import.meta.env.DEV) {
        console.log('PartnerGuard', {
          path: location.pathname,
          partnerId: localSession.partnerId,
          status: localSession.status,
        });
      }

      // Partner must be active
      if (localSession.status !== 'Ativo') {
        partnerAuthService.logout();
        toast.error('Sua conta está inativa. Entre em contato com a equipe OPEN.');
        navigate('/parceiro/login', { replace: true });
        return;
      }

      // Background refresh (non-blocking, apenas para manter dados atualizados)
      partnerAuthService.refreshSessionFromApi().catch((err) => {
        console.warn('[PartnerLayout] Background refresh failed:', err);
      });
    };

    void checkAuth().finally(() => {
      if (mounted) setIsChecking(false);
    });

    // Periodic check every 5 minutes (background only, non-blocking)
    const interval = setInterval(() => {
      partnerAuthService.refreshSessionFromApi().catch((err) => {
        console.warn('[PartnerLayout] Periodic refresh failed:', err);
      });
    }, 300000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [navigate, location.pathname]);

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
        <PartnerSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <PartnerHeader />
          <div className="flex-1 overflow-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
