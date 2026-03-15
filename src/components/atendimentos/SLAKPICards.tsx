import { AlertTriangle, CheckCircle, Clock, TicketIcon } from 'lucide-react';
import { KPICard } from '@/components/navigation/ModuleCard';

interface Props {
  openTickets: number;
  slaOk: number;
  slaBreached: number;
  criticalCount: number;
  loading?: boolean;
}

export function SLAKPICards({ openTickets, slaOk, slaBreached, criticalCount, loading }: Props) {
  const v = (n: number) => (loading ? '...' : n.toString());

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Tickets Abertos"
        value={v(openTickets)}
        description="Em andamento hoje"
        icon={TicketIcon}
      />
      <KPICard
        title="Dentro do SLA"
        value={v(slaOk)}
        description="Prazo respeitado"
        icon={CheckCircle}
        className={slaOk > 0 ? 'border-green-500/30' : ''}
      />
      <KPICard
        title="Fora do SLA"
        value={v(slaBreached)}
        description="Prazo excedido"
        icon={Clock}
        className={slaBreached > 0 ? 'border-red-500/30' : ''}
      />
      <KPICard
        title="Incidentes Críticos"
        value={v(criticalCount)}
        description="S1 / S2 ativos"
        icon={AlertTriangle}
        className={criticalCount > 0 ? 'border-orange-500/30' : ''}
      />
    </div>
  );
}
