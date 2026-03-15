// ============================================================================
// TICKET TIMELINE — status history + assignments chronologically
// ============================================================================

import { Clock, ArrowRight, User, AlertCircle } from 'lucide-react';
import { STATUS_LABELS } from '@/lib/ticketPermissions';
import type { CoreTicketStatusHistory, CoreTicketAssignment } from '@/services/supportTicketCoreService';

interface Props {
  statusHistory: CoreTicketStatusHistory[];
  assignments: CoreTicketAssignment[];
}

type TimelineEntry = {
  type: 'status' | 'assignment';
  date: string;
  data: CoreTicketStatusHistory | CoreTicketAssignment;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function TicketTimeline({ statusHistory, assignments }: Props) {
  // Merge and sort chronologically
  const entries: TimelineEntry[] = [
    ...statusHistory.map(s => ({ type: 'status' as const, date: s.created_at, data: s })),
    ...assignments.map(a => ({ type: 'assignment' as const, date: a.created_at, data: a })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Sem histórico</p>;
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, i) => (
        <div key={`${entry.type}-${i}`} className="flex gap-3 py-2 border-b border-border/30 last:border-0">
          <div className="pt-0.5">
            {entry.type === 'status' ? (
              <AlertCircle className="h-4 w-4 text-primary" />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {entry.type === 'status' ? (
              <StatusEntry data={entry.data as CoreTicketStatusHistory} />
            ) : (
              <AssignmentEntry data={entry.data as CoreTicketAssignment} />
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(entry.date)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusEntry({ data }: { data: CoreTicketStatusHistory }) {
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">Status: </span>
      {data.old_status && (
        <>
          <span>{STATUS_LABELS[data.old_status as keyof typeof STATUS_LABELS] || data.old_status}</span>
          <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
        </>
      )}
      <span className="font-medium">{STATUS_LABELS[data.new_status as keyof typeof STATUS_LABELS] || data.new_status}</span>
      {data.changed_by_name && (
        <span className="text-muted-foreground"> por {data.changed_by_name}</span>
      )}
      {data.reason && <p className="text-xs text-muted-foreground mt-0.5 italic">"{data.reason}"</p>}
    </div>
  );
}

function AssignmentEntry({ data }: { data: CoreTicketAssignment }) {
  return (
    <div className="text-sm">
      {data.to_user_name ? (
        <>
          <span className="text-muted-foreground">Atribuído para </span>
          <span className="font-medium">{data.to_user_name}</span>
          {data.from_user_name && <span className="text-muted-foreground"> (de {data.from_user_name})</span>}
        </>
      ) : data.to_queue ? (
        <>
          <span className="text-muted-foreground">Transferido para fila </span>
          <span className="font-medium">{data.to_queue}</span>
          {data.from_queue && <span className="text-muted-foreground"> (de {data.from_queue})</span>}
        </>
      ) : (
        <span className="text-muted-foreground">Atribuição alterada</span>
      )}
      {data.assigned_by_name && (
        <span className="text-muted-foreground"> por {data.assigned_by_name}</span>
      )}
      {data.reason && <p className="text-xs text-muted-foreground mt-0.5 italic">"{data.reason}"</p>}
    </div>
  );
}
