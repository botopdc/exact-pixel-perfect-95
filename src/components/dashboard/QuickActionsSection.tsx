/**
 * Quick Actions Section Component
 * Displays shortcuts based on user's area
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileStack, 
  Calculator,
  HeadphonesIcon, 
  Users,
  TrendingUp,
  Briefcase,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import type { UserArea } from '@/lib/userArea';

interface QuickActionsProps {
  area: UserArea;
}

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

export function QuickActionsSection({ area }: QuickActionsProps) {
  const getActionsForArea = (): QuickAction[] => {
    const commonActions: QuickAction[] = [
      {
        title: 'Calculadora',
        description: 'Montar proposta comercial',
        href: '/modulos/comercial/propostas/criar',
        icon: Calculator,
        color: 'text-primary',
        bgColor: 'bg-primary/10',
      },
    ];

    switch (area) {
      case 'comercial':
        return [
          ...commonActions,
          {
            title: 'Nova Proposta',
            description: 'Criar proposta para cliente',
            href: '/modulos/comercial/propostas/criar',
            icon: FileStack,
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-500/10',
          },
          {
            title: 'Metas',
            description: 'Ver metas comerciais',
            href: '/modulos/comercial/metas',
            icon: TrendingUp,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
          },
        ];

      case 'customer_success':
        return [
          {
            title: 'Clientes',
            description: 'Ver base de clientes',
            href: '/modulos/atendimentos/cs',
            icon: Users,
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-500/10',
          },
          {
            title: 'Health Score',
            description: 'Analisar saúde da base',
            href: '/modulos/atendimentos/kpis/cs',
            icon: BarChart3,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
          },
        ];

      case 'suporte_tecnico':
        return [
          {
            title: 'NOC',
            description: 'Centro de Operações',
            href: '/modulos/atendimentos/suporte-tecnico',
            icon: HeadphonesIcon,
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-500/10',
          },
          {
            title: 'Novo Incidente',
            description: 'Registrar ocorrência',
            href: '/modulos/atendimentos/suporte-tecnico/incidentes/criar',
            icon: FileStack,
            color: 'text-orange-500',
            bgColor: 'bg-orange-500/10',
          },
        ];

      case 'lideranca':
        return [
          ...commonActions,
          {
            title: 'Indicadores',
            description: 'KPIs de gestão',
            href: '/modulos/dashboard/indicadores',
            icon: BarChart3,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
          },
          {
            title: 'Usuários',
            description: 'Gestão de acessos',
            href: '/modulos/admin/usuarios',
            icon: Users,
            color: 'text-amber-500',
            bgColor: 'bg-amber-500/10',
          },
        ];

      case 'rh':
        return [
          {
            title: 'Vagas',
            description: 'Gerenciar vagas abertas',
            href: '/modulos/gente/vagas',
            icon: Briefcase,
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-500/10',
          },
          {
            title: 'Nova Vaga',
            description: 'Publicar vaga',
            href: '/modulos/gente/vagas/nova',
            icon: FileStack,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
          },
        ];

      default:
        return commonActions;
    }
  };

  const actions = getActionsForArea();

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4">Atalhos Rápidos</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <Link key={action.href} to={action.href}>
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${action.bgColor}`}>
                    <action.icon className={`h-5 w-5 ${action.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{action.title}</CardTitle>
                    <CardDescription className="text-xs">
                      {action.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center text-xs text-primary">
                  Acessar
                  <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
