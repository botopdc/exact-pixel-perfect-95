// ============================================================================
// SUPPORT TICKET DETAIL PAGE - Detalhes do Chamado
// ============================================================================

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Building2,
  Server,
  User,
  Clock,
  Send,
  MessageSquare,
  Lock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  UserPlus,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SLATimer } from '@/components/support/SLATimer';
import { useSupportTicket } from '@/hooks/useSupportTickets';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  IMPACT_LABELS,
  IMPACT_COLORS,
  TEAM_LABELS,
  TEAM_COLORS,
  SupportTicketStatus,
  SupportTeam,
  canAccessSupportModule,
  canOverridePriority,
} from '@/types/supportTicket';
import { cn } from '@/lib/utils';
import { authService } from '@/services/authService';

export default function SupportTicketDetailPage() {
  const { ticketNumber } = useParams<{ ticketNumber: string }>();
  const navigate = useNavigate();
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;

  const {
    ticket,
    isLoading,
    error,
    refetch,
    updateTicket,
    addMessage,
    isUpdating,
    isAddingMessage,
    userId,
  } = useSupportTicket(ticketNumber);

  const [newMessage, setNewMessage] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  // Check access
  if (!canAccessSupportModule(userLevel)) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar este módulo.
          </p>
        </Card>
      </div>
    );
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    await addMessage({ message: newMessage.trim(), is_internal_note: isInternalNote });
    setNewMessage('');
    setIsInternalNote(false);
  };

  const handleAssignToMe = async () => {
    if (!userId) return;
    await updateTicket({ assigned_to_user_id: userId });
  };

  const handleChangeStatus = async (status: SupportTicketStatus) => {
    await updateTicket({ status });
  };

  const handleEscalate = async (team: SupportTeam) => {
    await updateTicket({ assigned_team: team, assigned_to_user_id: null });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-96" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Chamado não encontrado</h2>
          <p className="text-muted-foreground mb-4">
            O chamado {ticketNumber} não foi encontrado ou você não tem permissão.
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-lg">{ticket.ticket_number}</span>
              <Badge variant="outline" className={cn('text-xs', PRIORITY_COLORS[ticket.priority])}>
                {PRIORITY_LABELS[ticket.priority]}
              </Badge>
              <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[ticket.status])}>
                {STATUS_LABELS[ticket.status]}
              </Badge>
            </div>
            <h1 className="text-xl font-bold">{ticket.subject}</h1>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          {/* Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Mensagens ({ticket.messages?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Message list */}
              {ticket.messages && ticket.messages.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {ticket.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'p-3 rounded-lg',
                        msg.is_internal_note
                          ? 'bg-yellow-500/10 border border-yellow-500/30'
                          : 'bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm">{msg.user_name}</span>
                        {msg.is_internal_note && (
                          <Badge variant="outline" className="text-xs bg-yellow-500/20 text-yellow-500">
                            <Lock className="h-3 w-3 mr-1" />
                            Nota Interna
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(parseISO(msg.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma mensagem ainda.
                </p>
              )}

              <Separator />

              {/* New message form */}
              <div className="space-y-3">
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="internal-note"
                      checked={isInternalNote}
                      onCheckedChange={(checked) => setIsInternalNote(!!checked)}
                    />
                    <Label htmlFor="internal-note" className="text-sm cursor-pointer">
                      <Lock className="h-3 w-3 inline mr-1" />
                      Nota interna (visível apenas para equipe)
                    </Label>
                  </div>
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isAddingMessage}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Enviar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* SLA */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                SLA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SLATimer sla={ticket.sla} variant="detailed" />
            </CardContent>
          </Card>

          {/* Client & Resource */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Contexto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{ticket.client.name}</p>
                  {ticket.client.cnpj && (
                    <p className="text-xs text-muted-foreground">{ticket.client.cnpj}</p>
                  )}
                </div>
              </div>
              {ticket.resource && (
                <div className="flex items-start gap-3">
                  <Server className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{ticket.resource.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.resource.type} • {ticket.resource.datacenter}
                    </p>
                    {ticket.resource.ip_principal && (
                      <p className="text-xs font-mono text-muted-foreground">
                        {ticket.resource.ip_principal}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Assignment */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Atribuído a</Label>
                {ticket.assigned_to_user_name ? (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{ticket.assigned_to_user_name}</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleAssignToMe}
                    disabled={isUpdating}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assumir Chamado
                  </Button>
                )}
              </div>

              {/* Status change */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Status</Label>
                <Select
                  value={ticket.status}
                  onValueChange={(v) => handleChangeStatus(v as SupportTicketStatus)}
                  disabled={isUpdating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Team escalation */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Equipe</Label>
                <Select
                  value={ticket.assigned_team}
                  onValueChange={(v) => handleEscalate(v as SupportTeam)}
                  disabled={isUpdating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TEAM_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quick actions */}
              {ticket.status !== 'resolvido' && ticket.status !== 'encerrado' && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleChangeStatus('resolvido')}
                  disabled={isUpdating}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                  Marcar como Resolvido
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Impacto</span>
                <Badge variant="outline" className={cn('text-xs', IMPACT_COLORS[ticket.impact])}>
                  {IMPACT_LABELS[ticket.impact]}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Origem</span>
                <span className="capitalize">{ticket.origin_channel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado em</span>
                <span>{format(parseISO(ticket.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
              </div>
              {ticket.resolved_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolvido em</span>
                  <span>{format(parseISO(ticket.resolved_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
