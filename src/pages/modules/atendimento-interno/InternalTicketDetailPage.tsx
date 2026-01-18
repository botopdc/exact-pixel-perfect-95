// ============================================================================
// INTERNAL TICKET DETAIL PAGE - Detalhes do Chamado Interno
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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useInternalTickets } from '@/hooks/useInternalTickets';
import {
  InternalTicket,
  TICKET_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_PRIORITY_COLORS,
} from '@/types/internalTicket';

export default function InternalTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getTicket, addComment, refresh } = useInternalTickets();
  
  const [ticket, setTicket] = useState<InternalTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (id) {
      loadTicket();
    }
  }, [id]);

  function loadTicket() {
    setLoading(true);
    const found = getTicket(id!);
    setTicket(found || null);
    setLoading(false);
  }

  const handleAddComment = async () => {
    if (!comment.trim() || !ticket) return;
    
    setSubmittingComment(true);
    try {
      addComment(ticket.id, comment.trim());
      setComment('');
      loadTicket(); // Recarregar para mostrar novo comentário
      toast({
        title: 'Comentário adicionado',
        description: 'Seu comentário foi registrado no chamado.',
      });
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      toast({
        title: 'Erro ao adicionar comentário',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Chamado não encontrado</h2>
        <p className="text-muted-foreground mb-4">O chamado solicitado não existe ou foi removido.</p>
        <Button onClick={() => navigate('/modulos/atendimentos/interno')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const slaStatus = ticket.sla_breached ? 'breached' : 'ok';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/modulos/atendimentos/interno')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold font-mono">{ticket.id}</h1>
            <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
              {TICKET_STATUS_LABELS[ticket.status]}
            </Badge>
            <Badge className={TICKET_PRIORITY_COLORS[ticket.priority]}>
              {TICKET_PRIORITY_LABELS[ticket.priority]}
            </Badge>
          </div>
          <h2 className="text-lg">{ticket.title}</h2>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Detalhes do Chamado */}
        <div className="md:col-span-2 space-y-6">
          {/* Descrição */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
            </CardContent>
          </Card>

          {/* Histórico */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticket.history.map((item, idx) => (
                <div key={item.id} className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    {item.type === 'comentario' ? (
                      <MessageSquare className="h-4 w-4" />
                    ) : item.type === 'mudanca_status' ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{item.author}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(new Date(item.date), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{item.content}</p>
                  </div>
                </div>
              ))}
              
              {ticket.history.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
              )}
            </CardContent>
          </Card>

          {/* Adicionar Comentário */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Adicionar Comentário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Digite seu comentário..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={1000}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {comment.length}/1000 caracteres
                </span>
                <Button 
                  onClick={handleAddComment} 
                  disabled={!comment.trim() || submittingComment}
                  size="sm"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {submittingComment ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Informações */}
        <div className="space-y-4">
          {/* Status do SLA */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Status do SLA</CardTitle>
            </CardHeader>
            <CardContent>
              {slaStatus === 'breached' ? (
                <div className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Atrasado</p>
                    <p className="text-xs text-muted-foreground">
                      Prazo excedido
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-500">
                  <Timer className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Dentro do prazo</p>
                    <p className="text-xs text-muted-foreground">
                      SLA: {ticket.sla_hours}h
                    </p>
                  </div>
                </div>
              )}
              <Separator className="my-3" />
              <p className="text-xs text-muted-foreground">
                Prazo: {format(new Date(ticket.sla_deadline), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </CardContent>
          </Card>

          {/* Informações */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Tipo</p>
                <p className="font-medium">{TICKET_TYPE_LABELS[ticket.type]}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Responsável</p>
                <p className="font-medium">
                  {ticket.assignee_name || 'Não atribuído'}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Criado por</p>
                <p className="font-medium">{ticket.created_by_name}</p>
                <p className="text-xs text-muted-foreground">{ticket.created_by_email}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Criado em</p>
                <p className="font-medium">
                  {format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Última atualização</p>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(ticket.updated_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
