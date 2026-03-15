// ============================================================================
// TICKET DETAIL PAGE — full ticket view with timeline, messages, actions
// Route: /modulos/atendimentos/suporte-tecnico/:ticketId
// ============================================================================

import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { TicketStatusBadge } from '@/components/tickets-core/TicketStatusBadge';
import { TicketSeverityBadge, TicketPriorityBadge } from '@/components/tickets-core/TicketSeverityBadge';
import { TicketSlaBadge } from '@/components/tickets-core/TicketSlaBadge';
import { TicketTimeline } from '@/components/tickets-core/TicketTimeline';
import { TicketMessages, TicketMessageComposer } from '@/components/tickets-core/TicketMessages';
import { TicketActionsPanel } from '@/components/tickets-core/TicketActionsPanel';
import { TicketAttachments } from '@/components/tickets-core/TicketAttachments';
import { useSupportTicketDetail } from '@/hooks/useSupportTicketCore';
import { CATEGORY_LABELS, TICKET_TYPE_LABELS, QUEUE_LABELS, TICKET_LIST_ROUTE } from '@/lib/ticketPermissions';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function TicketCoreDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  const {
    ticket, isLoading, error, permissions, refetch,
    performAction, sendMessage, isActing, isSending,
  } = useSupportTicketDetail(ticketId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="text-center py-12">
        <FileWarning className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-lg font-medium">Chamado não encontrado</p>
        <p className="text-sm text-muted-foreground mb-4">{error?.message || 'O chamado solicitado não existe ou você não tem permissão.'}</p>
        <Button variant="outline" onClick={() => navigate(TICKET_LIST_ROUTE)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(TICKET_LIST_ROUTE)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-primary">{ticket.public_code}</span>
            <TicketStatusBadge status={ticket.status} />
            <TicketSeverityBadge severity={ticket.severity} />
            <TicketPriorityBadge priority={ticket.priority} />
          </div>
          <h1 className="text-lg font-bold mt-1 truncate">{ticket.title}</h1>
        </div>
      </div>

      {/* SLA badges */}
      <div className="flex flex-wrap gap-2">
        <TicketSlaBadge dueAt={ticket.first_response_due_at} respondedAt={ticket.first_response_at} label="1ª Resposta" />
        <TicketSlaBadge dueAt={ticket.resolution_due_at} respondedAt={ticket.resolved_at} label="Resolução" />
      </div>

      {/* Actions panel */}
      <TicketActionsPanel permissions={permissions} onAction={performAction} isActing={isActing} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-foreground/90">{ticket.description}</p>
            </CardContent>
          </Card>

          {/* Resolution summary */}
          {ticket.resolution_summary && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-emerald-500">Resumo da Resolução</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{ticket.resolution_summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Close reason */}
          {ticket.close_reason && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Motivo do Encerramento</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{ticket.close_reason}</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Conversação</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketMessages messages={ticket.messages || []} permissions={permissions} />
              <TicketMessageComposer onSend={sendMessage} permissions={permissions} isSending={isSending} />
            </CardContent>
          </Card>

          <TicketAttachments
            ticketId={ticket.id}
            attachments={ticket.attachments || []}
            permissions={permissions}
            onUploaded={refetch}
          />
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="Solicitante" value={ticket.requester_name} />
              {ticket.requester_email && <InfoRow label="Email" value={ticket.requester_email} />}
              <Separator />
              <InfoRow label="Tipo" value={TICKET_TYPE_LABELS[ticket.ticket_type] || ticket.ticket_type} />
              <InfoRow label="Categoria" value={CATEGORY_LABELS[ticket.category] || ticket.category} />
              {ticket.service_name && <InfoRow label="Serviço" value={ticket.service_name} />}
              {ticket.asset_label && <InfoRow label="Ativo" value={ticket.asset_label} />}
              <Separator />
              {permissions.isInternal && (
                <>
                  <InfoRow label="Fila" value={QUEUE_LABELS[ticket.current_queue] || ticket.current_queue} />
                  <InfoRow label="Nível" value={ticket.current_support_level || ticket.support_level} />
                  <InfoRow label="Responsável" value={ticket.assigned_to_name || 'Não atribuído'} />
                  {ticket.assigned_at && <InfoRow label="Atribuído em" value={formatDate(ticket.assigned_at)} />}
                  <Separator />
                </>
              )}
              <InfoRow label="Criado em" value={formatDate(ticket.created_at)} />
              <InfoRow label="Atualizado" value={formatDate(ticket.updated_at)} />
              {ticket.resolved_at && <InfoRow label="Resolvido em" value={formatDate(ticket.resolved_at)} />}
              {ticket.closed_at && <InfoRow label="Encerrado em" value={formatDate(ticket.closed_at)} />}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketTimeline
                statusHistory={ticket.status_history || []}
                assignments={ticket.assignments || []}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
