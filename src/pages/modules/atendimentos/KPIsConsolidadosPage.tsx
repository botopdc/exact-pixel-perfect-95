// ============================================================================
// KPIs CONSOLIDADOS PAGE — Unified KPIs for support, CS and management
// Rota: /modulos/atendimentos/kpis
// ============================================================================

import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { ModuleHeader } from '@/components/navigation/ModuleCard';
import KPIsSuporte from '@/pages/KPIsSuporte';
import KPIsCS from '@/pages/KPIsCS';
import KPIsGestao from '@/pages/KPIsGestao';
import { authService } from '@/services/authService';
import { USER_LEVELS } from '@/config/modulesConfig';
import { cn } from '@/lib/utils';

type TabId = 'suporte' | 'cs' | 'gestao';

export default function KPIsConsolidadosPage() {
  const user = authService.getCurrentUser();
  const userLevel = user?.level ?? 0;

  const tabs: { id: TabId; label: string; minLevel: number }[] = [
    { id: 'gestao', label: 'Gestão', minLevel: 950 },
    { id: 'suporte', label: 'Suporte', minLevel: 950 },
    { id: 'cs', label: 'Customer Success', minLevel: 775 },
  ];

  const allowedTabs = tabs.filter(t => userLevel >= t.minLevel || userLevel >= USER_LEVELS.ADMIN);
  const [activeTab, setActiveTab] = useState<TabId>(allowedTabs[0]?.id ?? 'gestao');

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="KPIs de Atendimento"
        description="Indicadores operacionais consolidados"
        icon={BarChart3}
      />

      {/* Tab bar */}
      <div className="flex items-center gap-2">
        {allowedTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              activeTab === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'suporte' && <KPIsSuporte />}
      {activeTab === 'cs' && <KPIsCS />}
      {activeTab === 'gestao' && <KPIsGestao />}
    </div>
  );
}
