import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import logoWhite from '@/assets/logo-white.png';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  getFilteredModules, 
  getUserLevelName,
  Module,
} from '@/config/modulesConfig';
import { getEffectiveRoles, getUserDisplayRole } from '@/lib/rbac';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ModuleSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  // Supabase-only identity
  const { profile, roles, signOut } = useAuth();
  const displayName = profile?.name || profile?.email || 'Usuário';
  const effectiveRoles = getEffectiveRoles(roles, profile);

  const filteredModules = getFilteredModules(effectiveRoles);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const isModuleActive = (module: Module) => {
    return location.pathname === module.url || location.pathname.startsWith(module.url + '/');
  };

  const renderModule = (module: Module) => {
    const isActive = isModuleActive(module);
    const Icon = module.icon;

    if (module.disabled) {
      return (
        <SidebarMenuItem key={module.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton disabled className="opacity-40 cursor-not-allowed">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <Icon className="h-5 w-5" />
                  {!collapsed && <span className="text-sm">{module.title}</span>}
                </div>
              </SidebarMenuButton>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{module.title} - Em breve</p>
            </TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={module.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton asChild isActive={isActive}>
              <Link
                to={module.url}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                  isActive && "bg-primary/10 text-primary font-medium"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                {!collapsed && <span className="text-sm">{module.title}</span>}
              </Link>
            </SidebarMenuButton>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right">
              <p>{module.title}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link to="/modulos/dashboard" className="flex items-center gap-3">
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
        <SidebarMenu className="space-y-1">
          {filteredModules.map(renderModule)}
        </SidebarMenu>
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
                  <span className="text-sm font-medium truncate max-w-[120px]">{displayName}</span>
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
