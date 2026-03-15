// ============================================================================
// SLA BADGE — shows SLA state: ok, warning, breached
// ============================================================================

import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  dueAt: string | null;
  respondedAt?: string | null;
  label?: string;
  className?: string;
}

export function TicketSlaBadge({ dueAt, respondedAt, label = 'SLA', className }: Props) {
  if (!dueAt) return null;

  const now = Date.now();
  const due = new Date(dueAt).getTime();

  // Already responded
  if (respondedAt) {
    const responded = new Date(respondedAt).getTime();
    const ok = responded <= due;
    return (
      <Badge variant="outline" className={cn('text-xs border gap-1', ok ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30', className)}>
        {ok ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {label} {ok ? 'OK' : 'Estourado'}
      </Badge>
    );
  }

  const remainingMs = due - now;
  const breached = remainingMs <= 0;
  const warning = !breached && remainingMs < 30 * 60 * 1000; // <30min

  const formatRemaining = () => {
    if (breached) {
      const over = Math.abs(remainingMs);
      const h = Math.floor(over / 3600000);
      const m = Math.floor((over % 3600000) / 60000);
      return `−${h}h${m.toString().padStart(2, '0')}m`;
    }
    const h = Math.floor(remainingMs / 3600000);
    const m = Math.floor((remainingMs % 3600000) / 60000);
    return `${h}h${m.toString().padStart(2, '0')}m`;
  };

  const color = breached
    ? 'bg-red-600/20 text-red-400 border-red-600/30'
    : warning
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

  return (
    <Badge variant="outline" className={cn('text-xs border gap-1', color, className)}>
      {breached ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {label} {formatRemaining()}
    </Badge>
  );
}
