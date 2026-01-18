/**
 * Global KPI Cards Component
 * Displays the 5 global KPIs visible to all non-client users
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  DollarSign, 
  Users, 
  TrendingDown, 
  ShieldCheck, 
  Star,
  HelpCircle,
} from 'lucide-react';
import type { GlobalKPIs } from '@/hooks/useDashboardKPIs';

interface GlobalKPICardsProps {
  data: GlobalKPIs;
  loading: boolean;
}

export function GlobalKPICards({ data, loading }: GlobalKPICardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const kpis = [
    {
      title: 'MRR Total',
      value: data.mrrTotal,
      formatter: formatCurrency,
      icon: DollarSign,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Novos Clientes',
      value: data.novosClientes,
      formatter: (v: number) => v.toString(),
      suffix: 'este mês',
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Churn Rate',
      value: data.churnRate,
      formatter: formatPercent,
      suffix: 'este mês',
      icon: TrendingDown,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      invertColor: true,
    },
    {
      title: 'SLA Compliance',
      value: data.slaCompliance,
      formatter: formatPercent,
      suffix: 'este mês',
      icon: ShieldCheck,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'NPS Score',
      value: data.npsScore,
      formatter: (v: number) => v.toString(),
      suffix: 'últimos 90 dias',
      icon: Star,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {kpis.map((kpi) => (
        <Card key={kpi.title} className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {kpi.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : kpi.value !== null ? (
              <>
                <div className={`text-2xl font-bold ${kpi.invertColor ? kpi.color : ''}`}>
                  {kpi.formatter(kpi.value)}
                </div>
                {kpi.suffix && (
                  <p className="text-xs text-muted-foreground mt-1">{kpi.suffix}</p>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg text-muted-foreground">Sem dados</span>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Aguardando integração</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
