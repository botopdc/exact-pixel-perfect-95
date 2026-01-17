import React from 'react';
import { 
  Handshake, 
  Users, 
  FileStack, 
  DollarSign, 
  TrendingUp,
  PieChart,
  Plus,
} from 'lucide-react';
import { ModuleHeader, KPICard, ShortcutCard, SectionTitle } from '@/components/navigation/ModuleCard';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function ParceirosModuleHome() {
  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Parceiros"
        description="Gestão de parceiros, propostas e comissões"
        icon={Handshake}
        actions={
          <Link to="/modulos/parceiros/gestao">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Parceiro
            </Button>
          </Link>
        }
      />

      {/* KPIs Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Parceiros Ativos"
          value="32"
          description="Com contratos vigentes"
          icon={Users}
          trend={{ value: 8, label: 'vs mês anterior', positive: true }}
        />
        <KPICard
          title="Propostas Parceiros"
          value="18"
          description="Aguardando aprovação"
          icon={FileStack}
        />
        <KPICard
          title="MRR via Parceiros"
          value="R$ 78.400"
          description="Receita de parceiros"
          icon={DollarSign}
          trend={{ value: 12, label: 'vs mês anterior', positive: true }}
        />
        <KPICard
          title="Comissões Pendentes"
          value="R$ 15.200"
          description="A pagar este mês"
          icon={TrendingUp}
        />
      </div>

      {/* Pipeline Visual */}
      <div>
        <SectionTitle 
          title="Pipeline de Parceiros" 
          description="Distribuição por tipo de parceiro"
        />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">ISV</span>
              <span className="text-2xl font-bold text-primary">12</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: '40%' }} />
            </div>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">VAR</span>
              <span className="text-2xl font-bold text-blue-500">15</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: '50%' }} />
            </div>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">FINDER</span>
              <span className="text-2xl font-bold text-green-500">5</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: '17%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div>
        <SectionTitle 
          title="Atalhos Rápidos" 
          description="Acesse rapidamente as funcionalidades"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ShortcutCard
            title="Visão Executiva"
            description="Dashboard de parceiros"
            icon={PieChart}
            href="/modulos/parceiros"
          />
          <ShortcutCard
            title="Gestão de Parceiros"
            description="Gerenciar parceiros"
            icon={Users}
            href="/modulos/parceiros/gestao"
          />
          <ShortcutCard
            title="Propostas"
            description="Propostas de parceiros"
            icon={FileStack}
            href="/modulos/parceiros/propostas"
          />
          <ShortcutCard
            title="Comissões"
            description="Gestão de comissões"
            icon={DollarSign}
            href="/modulos/parceiros/comissoes"
          />
        </div>
      </div>
    </div>
  );
}
