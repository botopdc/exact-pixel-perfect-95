// ============================================================================
// SUPPORT TICKET STATUS BADGE
// ============================================================================

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_LABELS, STATUS_VARIANT } from '@/lib/ticketPermissions';
import type { TicketStatus } from '@/services/supportTicketCoreService';

interface Props {
  status: TicketStatus;
  className?: string;
}

export function TicketStatusBadge({ status, className }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium border', STATUS_VARIANT[status] || '', className)}
    >
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}
