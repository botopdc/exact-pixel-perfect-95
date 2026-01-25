// ============================================================================
// SLA TIMER - Visual SLA countdown with breach indicator
// ============================================================================

import { differenceInMinutes, parseISO } from 'date-fns';
import { Clock, AlertTriangle, CheckCircle2, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SupportSLAInfo } from '@/types/supportTicket';

interface SLATimerProps {
  sla: SupportSLAInfo;
  variant?: 'compact' | 'detailed';
  className?: string;
}

export function SLATimer({ sla, variant = 'compact', className }: SLATimerProps) {
  const now = new Date();
  const resolutionDue = parseISO(sla.resolution_due);
  const firstResponseDue = parseISO(sla.first_response_due);

  const resolutionMinutesRemaining = differenceInMinutes(resolutionDue, now);
  const firstResponseMinutesRemaining = differenceInMinutes(firstResponseDue, now);

  const isResolutionBreached = sla.resolution_breached || resolutionMinutesRemaining < 0;
  const isFirstResponseBreached = sla.first_response_breached || (firstResponseMinutesRemaining < 0 && !sla.first_response_at);
  const isAtRisk = !isResolutionBreached && resolutionMinutesRemaining < 120;

  const formatTime = (minutes: number) => {
    if (minutes < 0) {
      const absMinutes = Math.abs(minutes);
      const hours = Math.floor(absMinutes / 60);
      if (hours < 1) return `-${absMinutes}min`;
      return `-${hours}h ${absMinutes % 60}min`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 1) return `${minutes}min`;
    if (hours < 24) return `${hours}h ${minutes % 60}min`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  const getColor = () => {
    if (sla.paused) return 'text-muted-foreground';
    if (isResolutionBreached) return 'text-red-500';
    if (isAtRisk) return 'text-orange-500';
    return 'text-green-500';
  };

  const getBgColor = () => {
    if (sla.paused) return 'bg-muted/50';
    if (isResolutionBreached) return 'bg-red-500/10';
    if (isAtRisk) return 'bg-orange-500/10';
    return 'bg-green-500/10';
  };

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-1.5', getColor(), className)}>
        {sla.paused ? (
          <Pause className="h-4 w-4" />
        ) : isResolutionBreached ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
        <span className="text-sm font-medium">
          {sla.paused ? 'Pausado' : formatTime(resolutionMinutesRemaining)}
        </span>
      </div>
    );
  }

  // Detailed variant
  return (
    <div className={cn('rounded-lg p-4 space-y-3', getBgColor(), className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">SLA: {sla.policy_name}</span>
        {sla.paused && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Pause className="h-3 w-3" />
            Pausado
          </span>
        )}
      </div>

      {/* First Response */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Primeira Resposta</span>
          {sla.first_response_at ? (
            <span className="flex items-center gap-1 text-green-500">
              <CheckCircle2 className="h-3 w-3" />
              Respondido
            </span>
          ) : isFirstResponseBreached ? (
            <span className="flex items-center gap-1 text-red-500">
              <AlertTriangle className="h-3 w-3" />
              Estourado
            </span>
          ) : (
            <span className={firstResponseMinutesRemaining < 60 ? 'text-orange-500' : 'text-green-500'}>
              {formatTime(firstResponseMinutesRemaining)}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Meta: {sla.first_response_hours}h
        </div>
      </div>

      {/* Resolution */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Resolução</span>
          {isResolutionBreached ? (
            <span className="flex items-center gap-1 text-red-500 font-medium">
              <AlertTriangle className="h-3 w-3" />
              {formatTime(resolutionMinutesRemaining)}
            </span>
          ) : (
            <span className={cn('font-medium', getColor())}>
              {formatTime(resolutionMinutesRemaining)}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Meta: {sla.resolution_hours}h
        </div>
      </div>

      {/* Accumulated pause */}
      {sla.accumulated_pause_minutes > 0 && (
        <div className="text-xs text-muted-foreground border-t border-border/50 pt-2">
          Tempo pausado: {Math.floor(sla.accumulated_pause_minutes / 60)}h {sla.accumulated_pause_minutes % 60}min
        </div>
      )}
    </div>
  );
}
