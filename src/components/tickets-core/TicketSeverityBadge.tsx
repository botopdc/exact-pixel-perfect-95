// ============================================================================
// SEVERITY + PRIORITY BADGES
// ============================================================================

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SEVERITY_LABELS, SEVERITY_VARIANT, PRIORITY_LABELS } from '@/lib/ticketPermissions';

export function TicketSeverityBadge({ severity, className }: { severity: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('text-xs font-medium border', SEVERITY_VARIANT[severity] || '', className)}>
      {SEVERITY_LABELS[severity] || severity}
    </Badge>
  );
}

export function TicketPriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-600/20 text-red-400 border-red-600/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
  };
  return (
    <Badge variant="outline" className={cn('text-xs font-medium border', colors[priority] || '', className)}>
      {PRIORITY_LABELS[priority] || priority}
    </Badge>
  );
}
