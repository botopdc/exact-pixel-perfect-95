// ============================================================================
// INTERNAL TICKET DETAIL PAGE - Detalhes do Chamado Interno
// Com ações de suporte para níveis 900+
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Clock,
  User,
  MessageSquare,
  Send,
  AlertTriangle,
  Timer,
  CheckCircle,
  Pause,
  ArrowUpCircle,
  UserCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useInternalTickets } from '@/hooks/useInternalTickets';
import {
  InternalTicket,
  InternalTicketStatus,
  TICKET_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_PRIORITY_COLORS,
  SUPPORT_LEVELS,
} from '@/types/internalTicket';

export default function InternalTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getTicket, addComment, updateStatus, assumeTicket, escalateToN2, isSupport, refresh } = useInternalTickets();
  
  const [ticket, setTicket] = useState<InternalTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [newStatus, setNewStatus] = useState<InternalTicketStatus | undefined>(undefined);

  useEffect(() => {
    if (id) loadTicket();
  }, [id]);

  function loadTicket() {
    setLoading(true);
    const found = getTicket(id!);
    setTicket(found || null);
    if (found) setNewStatus(found.status);
    setLoading(false);
  }

  const handleAddComment = async () => {
    if (!comment.trim() || !ticket) return;
    setSubmittingComment(true);
    try {
      addComment(ticket.id, comment.trim());
      setComment('');
      loadTicket();
      toast({ title: 'Comentário adicionado' });
    } catch (error) {
      toast({ title: 'Erro ao adicionar comentário', variant: 'destructive' });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStatusChange = (status: InternalTicketStatus) => {
    if (!ticket) return;
    updateStatus(ticket.id, status);
    loadTicket();
    toast({ title: `Status alterado para ${TICKET_STATUS_LABELS[status]}` });
  };

  const handleAssume = () => {
    if (!ticket) return;
    assumeTicket(ticket.id);
    loadTicket();
    toast({ title: 'Chamado assumido com sucesso' });
  };

  const handleEscalate = () => {
    if (!ticket) return;
    escalateToN2(ticket.id);
    loadTicket();
    toast({ title: 'Chamado escalado para N2' });
  };

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!ticket) return (
    <div className="text-center py-12">
      <h2 className="text-xl font-semibold mb-2">Chamado não encontrado</h2>
      <Button onClick={() => navigate('/modulos/atendimentos/interno')}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
    </div>
  );

  const canManage = isSupport && ticket.status !== 'encerrado';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/modulos/atendimentos/interno')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold font-mono">{ticket.id}</h1>
            <Badge className={TICKET_STATUS_COLORS[ticket.status]}>{TICKET_STATUS_LABELS[ticket.status]}</Badge>
            <Badge className={TICKET_PRIORITY_COLORS[ticket.priority]}>{TICKET_PRIORITY_LABELS[ticket.priority]}</Badge>
            <Badge variant="outline">Fila {ticket.queue}</Badge>
          </div>
          <h2 className="text-lg">{ticket.title}</h2>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Descrição</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap text-sm">{ticket.description}</p></CardContent>
          </Card>

          {/* Ações do Suporte */}
          {canManage && (
            <Card className="border-primary/30">
              <CardHeader><CardTitle className="text-base">Ações do Suporte</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {!ticket.assignee_id && (
                    <Button size="sm" onClick={handleAssume}><UserCheck className="h-4 w-4 mr-1" />Assumir</Button>
                  )}
                  {ticket.queue === 'N1' && (
                    <Button size="sm" variant="outline" onClick={handleEscalate}><ArrowUpCircle className="h-4 w-4 mr-1" />Escalar N2</Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Alterar Status:</span>
                  <Select value={ticket.status} onValueChange={(v) => handleStatusChange(v as InternalTicketStatus)}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TICKET_STATUS_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" />Histórico</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {ticket.history.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    {item.type === 'comentario' ? <MessageSquare className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{item.author}</span>
                      <span className="text-muted-foreground">{formatDistanceToNow(new Date(item.date), { addSuffix: true, locale: ptBR })}</span>
                    </div>
                    <p className="text-sm mt-1">{item.content}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Adicionar Comentário</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder="Digite seu comentário..." value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
              <Button onClick={handleAddComment} disabled={!comment.trim() || submittingComment} size="sm">
                <Send className="h-4 w-4 mr-2" />{submittingComment ? 'Enviando...' : 'Enviar'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">SLA</CardTitle></CardHeader>
            <CardContent>
              {ticket.sla_paused ? (
                <div className="flex items-center gap-2 text-orange-500"><Pause className="h-5 w-5" /><p className="font-medium">Pausado</p></div>
              ) : ticket.sla_breached ? (
                <div className="flex items-center gap-2 text-red-500"><AlertTriangle className="h-5 w-5" /><p className="font-medium">Atrasado</p></div>
              ) : (
                <div className="flex items-center gap-2 text-green-500"><Timer className="h-5 w-5" /><p className="font-medium">Dentro do prazo ({ticket.sla_hours}h)</p></div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Informações</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><p className="text-muted-foreground">Tipo</p><p className="font-medium">{TICKET_TYPE_LABELS[ticket.type]}</p></div>
              <Separator />
              <div><p className="text-muted-foreground">Responsável</p><p className="font-medium">{ticket.assignee_name || `Fila ${ticket.queue}`}</p></div>
              <Separator />
              <div><p className="text-muted-foreground">Criado por</p><p className="font-medium">{ticket.created_by_name}</p></div>
              <Separator />
              <div><p className="text-muted-foreground">Criado em</p><p className="font-medium">{format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
