// ============================================================================
// KPIs CONSOLIDADOS PAGE — Unified KPIs for support, CS and management
// Rota: /modulos/atendimentos/kpis
// Auth: useAuth() primary, authService fallback
// ============================================================================

import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { ModuleHeader } from '@/components/navigation/ModuleCard';
import KPIsSuporte from '@/pages/KPIsSuporte';
import KPIsCS from '@/pages/KPIsCS';
import KPIsGestao from '@/pages/KPIsGestao';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin, isSupportManager, isCS, getEffectiveRoles } from '@/lib/rbac';
import { cn } from '@/lib/utils';

type TabId = 'suporte' | 'cs' | 'gestao';

export default function KPIsConsolidadosPage() {
  const { profile, roles } = useAuth();

  const _isAdmin = isAdmin(profile, roles);
  const _isSupportManager = isSupportManager(profile, roles);
  const _isCS = isCS(profile, roles);

  const tabs: { id: TabId; label: string; allowed: boolean }[] = [
    { id: 'gestao', label: 'Gestão', allowed: _isSupportManager || _isAdmin },
    { id: 'suporte', label: 'Suporte', allowed: _isSupportManager || _isAdmin },
    { id: 'cs', label: 'Customer Success', allowed: _isCS || _isSupportManager || _isAdmin },
  ];

  const allowedTabs = tabs.filter(t => t.allowed);
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