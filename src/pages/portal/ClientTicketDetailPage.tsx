// ============================================================================
// CLIENT PORTAL — Ticket detail page for external clients (level 1)
// Route: /portal/tickets/:ticketId
// Reuses TicketCoreDetailPage with client-specific route prefix
// ============================================================================

import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Paperclip, FileWarning, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { TicketStatusBadge } from '@/components/tickets-core/TicketStatusBadge';
import { TicketSeverityBadge, TicketPriorityBadge } from '@/components/tickets-core/TicketSeverityBadge';
import { TicketSlaBadge } from '@/components/tickets-core/TicketSlaBadge';
import { TicketMessages, TicketMessageComposer } from '@/components/tickets-core/TicketMessages';
import { TicketAttachments } from '@/components/tickets-core/TicketAttachments';
import { useSupportTicketDetail } from '@/hooks/useSupportTicketCore';
import { CATEGORY_LABELS, TICKET_TYPE_LABELS } from '@/lib/ticketPermissions';
import { authService } from '@/services/authService';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ClientTicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const session = authService.getSession();

  if (!session || session.level !== 1) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Acesso restrito a clientes.</p>
      </div>
    );
  }

  const {
    ticket, isLoading, error, permissions,
    sendMessage, isSending, refetch,
  } = useSupportTicketDetail(ticketId);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <FileWarning className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-lg font-medium">Chamado não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/portal/tickets')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Back + header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/tickets')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-primary">{ticket.public_code}</span>
              <TicketStatusBadge status={ticket.status} />
              <TicketSeverityBadge severity={ticket.severity} />
            </div>
            <h1 className="text-lg font-bold mt-1 truncate">{ticket.title}</h1>
          </div>
        </div>

        {/* SLA */}
        <div className="flex flex-wrap gap-2">
          <TicketSlaBadge dueAt={ticket.resolution_due_at} respondedAt={ticket.resolved_at} label="Prazo estimado" />
        </div>

        {/* Description */}
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Descrição</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-foreground/90">{ticket.description}</p>
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Informações</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span>{TICKET_TYPE_LABELS[ticket.ticket_type] || ticket.ticket_type}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Categoria</span><span>{CATEGORY_LABELS[ticket.category] || ticket.category}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Criado em</span><span>{formatDate(ticket.created_at)}</span></div>
            {ticket.resolved_at && <div className="flex justify-between"><span className="text-muted-foreground">Resolvido em</span><span>{formatDate(ticket.resolved_at)}</span></div>}
          </CardContent>
        </Card>

        {/* Messages — only public */}
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Conversação</CardTitle></CardHeader>
          <CardContent>
            <TicketMessages messages={ticket.messages || []} permissions={permissions} />
            <TicketMessageComposer onSend={sendMessage} permissions={permissions} isSending={isSending} />
          </CardContent>
        </Card>

        {/* Attachments */}
        <TicketAttachments
          ticketId={ticket.id}
          attachments={ticket.attachments || []}
          permissions={permissions}
          onUploaded={refetch}
        />
      </div>
    </div>
  );
}
