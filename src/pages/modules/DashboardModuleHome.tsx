/**
 * Unified Corporate Dashboard
 * Displays area-based content for all non-client users
 */

import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { ModuleHeader } from '@/components/navigation/ModuleCard';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { getUserArea, isClientUser, AREA_CONFIGS } from '@/lib/userArea';
import { useDashboardKPIs } from '@/hooks/useDashboardKPIs';
import { GlobalKPICards } from '@/components/dashboard/GlobalKPICards';
import { AreaSpecificCards } from '@/components/dashboard/AreaSpecificCards';
import { AreaSpecificSection } from '@/components/dashboard/AreaSpecificSection';
import { QuickActionsSection } from '@/components/dashboard/QuickActionsSection';

// Client dashboard (level=1) - simplified view
function ClientDashboard() {
  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Meu Painel"
        description="Bem-vindo ao portal OPEN Datacenter"
        icon={LayoutDashboard}
      />
      <div className="flex items-center justify-center h-64 rounded-lg bg-muted/50 border border-dashed">
        <p className="text-muted-foreground">Dashboard do cliente em desenvolvimento</p>
      </div>
    </div>
  );
}

// Resolve user level from Supabase profile
function useUserLevel(): number | null {
  const { profile } = useAuth();
  return profile?.level ?? null;
}

// Corporate dashboard for non-client users
export default function DashboardModuleHome() {
  const userLevel = useUserLevel();
  const area = getUserArea(userLevel);
  const areaConfig = AREA_CONFIGS[area];
  
  const { data, loading } = useDashboardKPIs();

  // Client users see simplified dashboard
  if (isClientUser(userLevel)) {
    return <ClientDashboard />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <ModuleHeader
        title="Dashboard"
        description={`Visão geral — ${areaConfig.label}`}
        icon={LayoutDashboard}
      />

      {/* 5 Global KPIs (always visible for non-clients) */}
      <GlobalKPICards data={data.global} loading={loading} />

      {/* 2 Area-specific cards */}
      <AreaSpecificCards area={area} data={data} loading={loading} />

      {/* Area-specific section (chart/list) */}
      <AreaSpecificSection area={area} data={data} loading={loading} />

      {/* Quick actions */}
      <QuickActionsSection area={area} />
    </div>
  );
}
