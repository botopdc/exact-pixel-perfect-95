/**
 * Area Specific Cards Component
 * Displays the 2 area-specific KPI cards based on user's area
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  TrendingUp, 
  Target, 
  AlertTriangle, 
  Calendar,
  Clock,
  Ticket,
  Receipt,
  AlertCircle,
  BarChart3,
  Shield,
  HelpCircle,
} from 'lucide-react';
import type { UserArea } from '@/lib/userArea';
import type { DashboardKPIsData } from '@/hooks/useDashboardKPIs';

interface AreaSpecificCardsProps {
  area: UserArea;
  data: DashboardKPIsData;
  loading: boolean;
}

export function AreaSpecificCards({ area, data, loading }: AreaSpecificCardsProps) {
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

  const formatMinutes = (value: number) => {
    if (value < 60) return `${value}min`;
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    return `${hours}h ${mins}min`;
  };

  const getCardsForArea = () => {
    switch (area) {
      case 'comercial':
        return [
          {
            title: 'Pipeline do Mês',
            value: data.comercial.pipeline,
            formatter: formatCurrency,
            icon: TrendingUp,
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-500/10',
          },
          {
            title: 'Taxa de Conversão',
            value: data.comercial.taxaConversao,
            formatter: formatPercent,
            suffix: 'propostas fechadas',
            icon: Target,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
          },
        ];

      case 'customer_success':
        return [
          {
            title: 'Clientes em Risco',
            value: data.cs.clientesRisco,
            formatter: (v: number) => v.toString(),
            icon: AlertTriangle,
            color: 'text-red-500',
            bgColor: 'bg-red-500/10',
          },
          {
            title: 'Renovações em 30 dias',
            value: data.cs.renovacoes30Dias,
            formatter: (v: number) => v.toString(),
            icon: Calendar,
            color: 'text-amber-500',
            bgColor: 'bg-amber-500/10',
          },
        ];

      case 'suporte_tecnico':
        return [
          {
            title: 'Incidentes Abertos',
            value: data.suporte.incidentesAbertos,
            formatter: (v: number) => v.toString(),
            suffix: 'backlog atual',
            icon: Ticket,
            color: 'text-orange-500',
            bgColor: 'bg-orange-500/10',
          },
          {
            title: 'Tempo Médio 1ª Resposta',
            value: data.suporte.tempoMedioResposta,
            formatter: formatMinutes,
            suffix: 'este mês',
            icon: Clock,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
          },
        ];

      case 'financeiro':
        return [
          {
            title: 'Recebimentos do Mês',
            value: data.financeiro.recebimentosMes,
            formatter: formatCurrency,
            icon: Receipt,
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-500/10',
          },
          {
            title: 'Inadimplência',
            value: data.financeiro.inadimplencia,
            formatter: formatPercent,
            icon: AlertCircle,
            color: 'text-red-500',
            bgColor: 'bg-red-500/10',
          },
        ];

      case 'lideranca':
        return [
          {
            title: 'Meta vs Realizado',
            value: data.lideranca.metaVsRealizado 
              ? ((data.lideranca.metaVsRealizado.realizado / data.lideranca.metaVsRealizado.meta) * 100)
              : null,
            formatter: formatPercent,
            suffix: 'atingimento',
            icon: BarChart3,
            color: 'text-primary',
            bgColor: 'bg-primary/10',
          },
          {
            title: 'Riscos Críticos',
            value: data.lideranca.topRiscos.length > 0 ? data.lideranca.topRiscos.length : null,
            formatter: (v: number) => v.toString(),
            suffix: 'itens requerem atenção',
            icon: Shield,
            color: 'text-red-500',
            bgColor: 'bg-red-500/10',
          },
        ];

      case 'rh':
        return [
          {
            title: 'Vagas Abertas',
            value: null, // TODO: integrate with jobs API
            formatter: (v: number) => v.toString(),
            icon: Target,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
          },
          {
            title: 'Candidatos Ativos',
            value: null,
            formatter: (v: number) => v.toString(),
            icon: AlertTriangle,
            color: 'text-amber-500',
            bgColor: 'bg-amber-500/10',
          },
        ];

      default:
        return [];
    }
  };

  const cards = getCardsForArea();

  if (cards.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((card) => (
        <Card key={card.title} className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : card.value !== null ? (
              <>
                <div className="text-2xl font-bold">
                  {card.formatter(card.value)}
                </div>
                {card.suffix && (
                  <p className="text-xs text-muted-foreground mt-1">{card.suffix}</p>
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
