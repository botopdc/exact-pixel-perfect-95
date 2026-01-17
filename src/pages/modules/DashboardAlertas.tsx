import React from 'react';
import { AlertTriangle, Bell, Clock, CheckCircle, XCircle, Info } from 'lucide-react';
import { ModuleHeader, SectionTitle } from '@/components/navigation/ModuleCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  time: string;
  category: string;
}

const mockAlerts: Alert[] = [
  {
    id: '1',
    type: 'critical',
    title: '2 tickets com SLA estourado',
    description: 'Clientes Empresa ABC e Tech Solutions aguardam há mais de 8h',
    time: '10 min atrás',
    category: 'Suporte',
  },
  {
    id: '2',
    type: 'warning',
    title: '3 propostas expiram em 7 dias',
    description: 'Propostas pendentes de aprovação do cliente',
    time: '1h atrás',
    category: 'Comercial',
  },
  {
    id: '3',
    type: 'warning',
    title: 'Meta mensal em risco',
    description: 'Equipe comercial atingiu apenas 45% da meta de janeiro',
    time: '2h atrás',
    category: 'Comercial',
  },
  {
    id: '4',
    type: 'info',
    title: 'Novo parceiro cadastrado',
    description: 'TechPartners ISV aguarda aprovação de contrato',
    time: '3h atrás',
    category: 'Parceiros',
  },
  {
    id: '5',
    type: 'success',
    title: 'Proposta aprovada',
    description: 'Cliente DataCorp aprovou proposta de R$ 45.000/mês',
    time: '5h atrás',
    category: 'Comercial',
  },
];

const alertConfig = {
  critical: {
    icon: XCircle,
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-600 dark:text-red-400',
    iconColor: 'text-red-500',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    iconColor: 'text-yellow-500',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-600 dark:text-blue-400',
    iconColor: 'text-blue-500',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    textColor: 'text-green-600 dark:text-green-400',
    iconColor: 'text-green-500',
  },
};

export default function DashboardAlertas() {
  const criticalCount = mockAlerts.filter(a => a.type === 'critical').length;
  const warningCount = mockAlerts.filter(a => a.type === 'warning').length;

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Alertas"
        description="Itens que requerem sua atenção"
        icon={Bell}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Críticos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{criticalCount}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Atenção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{warningCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              Informativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Últimas 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{mockAlerts.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <div>
        <SectionTitle title="Todos os Alertas" description="Ordenados por prioridade" />
        <div className="space-y-3">
          {mockAlerts.map((alert) => {
            const config = alertConfig[alert.type];
            const Icon = config.icon;
            
            return (
              <div
                key={alert.id}
                className={cn(
                  "p-4 rounded-lg border transition-colors hover:bg-muted/50 cursor-pointer",
                  config.bgColor,
                  config.borderColor
                )}
              >
                <div className="flex items-start gap-4">
                  <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", config.iconColor)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={cn("font-medium", config.textColor)}>{alert.title}</p>
                      <Badge variant="outline" className="text-xs">{alert.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{alert.time}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
