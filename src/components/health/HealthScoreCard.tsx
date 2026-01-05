import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientHealthScore, HEALTH_STATUS_CONFIG, COMPONENT_WEIGHTS } from '@/types/healthScore';
import { HealthScoreBadge } from './HealthScoreBadge';
import { HealthScoreTrend } from './HealthScoreTrend';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingUp, Clock, Server, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthScoreCardProps {
  client: ClientHealthScore;
  onClick?: () => void;
  expanded?: boolean;
}

export function HealthScoreCard({ client, onClick, expanded = false }: HealthScoreCardProps) {
  const config = HEALTH_STATUS_CONFIG[client.status_atual];
  
  const componentLabels = {
    sla: { label: 'SLA', icon: Clock, weight: '30%' },
    recorrencia: { label: 'Recorrência', icon: TrendingUp, weight: '25%' },
    impacto: { label: 'Impacto', icon: AlertTriangle, weight: '20%' },
    comportamento: { label: 'Comportamento', icon: UserCheck, weight: '15%' },
    estabilidade: { label: 'Estabilidade', icon: Server, weight: '10%' },
  };

  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        client.status_atual === 'risco' && 'border-red-300 bg-red-50/50',
        client.status_atual === 'atencao' && 'border-yellow-300 bg-yellow-50/50'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{client.cliente_nome}</CardTitle>
          <HealthScoreBadge 
            score={client.health_score_atual} 
            status={client.status_atual} 
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{client.tickets_periodo} tickets (90 dias)</span>
            <span>{client.servicos_impactados.length} serviços</span>
          </div>
          
          <div className="h-10">
            <HealthScoreTrend history={client.historico_scores} />
          </div>
          
          {expanded && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground">Componentes do Score</p>
              {Object.entries(client.componentes).map(([key, value]) => {
                const comp = componentLabels[key as keyof typeof componentLabels];
                const Icon = comp.icon;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs w-24">{comp.label} ({comp.weight})</span>
                    <Progress value={value} className="flex-1 h-1.5" />
                    <span className="text-xs font-medium w-8">{value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
