// ============================================================================
// TICKET TABLE — main list view for queue/operators
// ============================================================================

import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Inbox } from 'lucide-react';
import { TicketStatusBadge } from './TicketStatusBadge';
import { TicketSeverityBadge } from './TicketSeverityBadge';
import { TicketSlaBadge } from './TicketSlaBadge';
import type { CoreTicket } from '@/services/supportTicketCoreService';
import { CATEGORY_LABELS, TICKET_TYPE_LABELS, QUEUE_LABELS, TICKET_LIST_ROUTE } from '@/lib/ticketPermissions';

interface Props {
  tickets: CoreTicket[];
  isLoading: boolean;
  showQueue?: boolean;
  routePrefix?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function TicketTable({ tickets, isLoading, showQueue = true, routePrefix = TICKET_LIST_ROUTE }: Props) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum chamado encontrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Código</TableHead>
            <TableHead>Título</TableHead>
            <TableHead className="w-[100px]">Severidade</TableHead>
            <TableHead className="w-[130px]">Status</TableHead>
            {showQueue && <TableHead className="w-[80px]">Fila</TableHead>}
            <TableHead className="w-[110px]">Categoria</TableHead>
            <TableHead className="w-[120px]">Responsável</TableHead>
            <TableHead className="w-[100px]">SLA Resolução</TableHead>
            <TableHead className="w-[120px]">Criado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map(t => (
            <TableRow
              key={t.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => navigate(`${routePrefix}/${t.id}`)}
            >
              <TableCell className="font-mono text-xs text-primary">{t.public_code}</TableCell>
              <TableCell className="font-medium truncate max-w-[250px]">{t.title}</TableCell>
              <TableCell><TicketSeverityBadge severity={t.severity} /></TableCell>
              <TableCell><TicketStatusBadge status={t.status} /></TableCell>
              {showQueue && (
                <TableCell className="text-xs text-muted-foreground">{QUEUE_LABELS[t.current_queue] || t.current_queue}</TableCell>
              )}
              <TableCell className="text-xs">{CATEGORY_LABELS[t.category] || t.category}</TableCell>
              <TableCell className="text-xs truncate max-w-[100px]">{t.assigned_to_name || '—'}</TableCell>
              <TableCell>
                <TicketSlaBadge dueAt={t.resolution_due_at} label="" />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatDate(t.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ── Mobile card variant ─────────────────────────────────────────────────

export function TicketCardMobile({ ticket, routePrefix = TICKET_LIST_ROUTE }: { ticket: CoreTicket; routePrefix?: string }) {
  const navigate = useNavigate();
  return (
    <Card
      className="border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={() => navigate(`${routePrefix}/${ticket.id}`)}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-primary">{ticket.public_code}</span>
          <TicketStatusBadge status={ticket.status} />
        </div>
        <p className="font-medium text-sm">{ticket.title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <TicketSeverityBadge severity={ticket.severity} />
          <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
          <TicketSlaBadge dueAt={ticket.resolution_due_at} label="SLA" />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{ticket.requester_name}</span>
          <span>{formatDate(ticket.created_at)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
