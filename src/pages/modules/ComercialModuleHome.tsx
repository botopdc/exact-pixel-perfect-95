import React from 'react';
import { 
  Briefcase, 
  Users, 
  FileStack, 
  Target, 
  DollarSign, 
  TrendingUp,
  Calculator,
  Plus,
} from 'lucide-react';
import { ModuleHeader, KPICard, ShortcutCard, SectionTitle } from '@/components/navigation/ModuleCard';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import { USER_LEVELS } from '@/config/modulesConfig';

export default function ComercialModuleHome() {
  const user = authService.getCurrentUser();
  const userLevel = user?.level ?? null;
  const isAdmin = userLevel === USER_LEVELS.ADMIN;
  const isManager = userLevel === USER_LEVELS.GERENTE_COMERCIAL;

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Comercial"
        description="Gestão de vendas, executivos e propostas"
        icon={Briefcase}
        actions={
          <Link to="/modulos/comercial/propostas/criar">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Proposta
            </Button>
          </Link>
        }
      />

      {/* KPIs Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Propostas este mês"
          value="42"
          description="Criadas no período"
          icon={FileStack}
          trend={{ value: 15, label: 'vs mês anterior', positive: true }}
        />
        <KPICard
          title="Taxa de Conversão"
          value="68%"
          description="Propostas aprovadas"
          icon={TrendingUp}
          trend={{ value: 5, label: 'vs mês anterior', positive: true }}
        />
        <KPICard
          title="MRR Pipeline"
          value="R$ 89.500"
          description="Em negociação"
          icon={DollarSign}
        />
        {(isAdmin || isManager) && (
          <KPICard
            title="Executivos Ativos"
            value="8"
            description="Com propostas abertas"
            icon={Users}
          />
        )}
      </div>

      {/* Quick Actions Section */}
      <div>
        <SectionTitle 
          title="Atalhos Rápidos" 
          description="Acesse rapidamente as funcionalidades"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ShortcutCard
            title="Calculadora de Preços"
            description="Simular e criar propostas"
            icon={Calculator}
            href="/modulos/comercial/propostas/criar"
          />
          <ShortcutCard
            title="Minhas Propostas"
            description="Ver propostas enviadas"
            icon={FileStack}
            href="/modulos/comercial/propostas"
          />
          {(isAdmin || isManager) && (
            <>
              <ShortcutCard
                title="Gestão de Executivos"
                description="Gerenciar equipe comercial"
                icon={Users}
                href="/modulos/comercial/executivos"
              />
              <ShortcutCard
                title="Metas Comerciais"
                description="Acompanhar metas da equipe"
                icon={Target}
                href="/modulos/comercial/metas"
              />
              <ShortcutCard
                title="Comissões"
                description="Gestão de comissões"
                icon={DollarSign}
                href="/modulos/comercial/comissoes"
              />
              <ShortcutCard
                title="Potencial do Gerente"
                description="Visualizar potencial de receita"
                icon={TrendingUp}
                href="/modulos/comercial/potencial"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
