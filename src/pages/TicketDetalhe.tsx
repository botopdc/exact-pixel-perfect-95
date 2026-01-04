import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTickets } from '@/hooks/useTickets';
import { TicketStepper } from '@/components/tickets/TicketStepper';
import { TransicaoCSModal } from '@/components/tickets/TransicaoCSModal';
import { 
  Ticket,
  TicketStatus,
  STATUS_LABELS,
  PRIORIDADE_LABELS,
  CATEGORIA_LABELS,
  TIME_LABELS,
  TIPO_DEMANDA_LABELS,
  TicketTipoDemanda,
  TicketTransicaoCS
} from '@/types/ticket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  ArrowLeft, 
  Building2, 
  Server, 
  Layers, 
  Clock,
  Send,
  ArrowRight,
  CheckCircle,
  MessageSquare,
  Lock,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function TicketDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    getTicket, 
    atualizarStatus, 
    adicionarComentario, 
    encaminharParaCS,
    atualizarTipoDemanda,
    encerrarTicket 
  } = useTickets();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [novoComentario, setNovoComentario] = useState('');
  const [showTransicaoModal, setShowTransicaoModal] = useState(false);

  useEffect(() => {
    if (id) {
      const t = getTicket(id);
      if (t) {
        setTicket(t);
      } else {
        navigate('/atendimentos');
        toast.error('Ticket não encontrado');
      }
    }
  }, [id]);

  if (!ticket) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const isSuporte = ticket.time_atual === 'suporte';
  const isCS = ticket.time_atual === 'cs';
  const canEditStatus = isSuporte && ticket.status !== 'resolvido_tecnico' && ticket.status !== 'encerrado';
  const canEncaminharCS = isSuporte && (ticket.status === 'em_atendimento' || ticket.status === 'novo');
  const canEncerrar = isCS && ticket.status !== 'encerrado';

  const handleStatusChange = (novoStatus: TicketStatus) => {
    const updated = atualizarStatus(ticket.id, novoStatus, 'Suporte');
    if (updated) {
      setTicket(updated);
      toast.success(`Status alterado para ${STATUS_LABELS[novoStatus]}`);
    }
  };

  const handleAddComentario = () => {
    if (!novoComentario.trim()) return;
    const updated = adicionarComentario(ticket.id, novoComentario, isSuporte ? 'Suporte' : 'CS');
    if (updated) {
      setTicket(updated);
      setNovoComentario('');
      toast.success('Comentário adicionado');
    }
  };

  const handleTransicaoCS = (data: Omit<TicketTransicaoCS, 'data_transicao'>) => {
    const updated = encaminharParaCS(ticket.id, data, 'Suporte');
    if (updated) {
      setTicket(updated);
      setShowTransicaoModal(false);
      toast.success('Ticket encaminhado para Customer Success');
    }
  };

  const handleTipoDemandaChange = (tipo: TicketTipoDemanda) => {
    const updated = atualizarTipoDemanda(ticket.id, tipo, 'CS');
    if (updated) {
      setTicket(updated);
      toast.success('Tipo de demanda atualizado');
    }
  };

  const handleEncerrar = () => {
    const updated = encerrarTicket(ticket.id, 'CS');
    if (updated) {
      setTicket(updated);
      toast.success('Ticket encerrado com sucesso');
    }
  };

  const prioridadeColors = {
    baixa: 'bg-muted text-muted-foreground',
    media: 'bg-yellow-500/20 text-yellow-400',
    alta: 'bg-orange-500/20 text-orange-400',
    critica: 'bg-destructive/20 text-destructive',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/atendimentos')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-muted-foreground">{ticket.id}</span>
            {ticket.privado && (
              <Badge variant="outline" className="text-xs">
                <Lock className="h-3 w-3 mr-1" />
                Privado
              </Badge>
            )}
            <Badge className={cn("text-xs", prioridadeColors[ticket.prioridade])}>
              {PRIORIDADE_LABELS[ticket.prioridade]}
            </Badge>
          </div>
          <h1 className="text-xl font-bold mt-1">{ticket.titulo}</h1>
        </div>

        {/* Team indicator */}
        <Badge variant={isSuporte ? "default" : "secondary"} className="text-sm px-3 py-1">
          {TIME_LABELS[ticket.time_atual]}
        </Badge>
      </div>

      {/* Stepper */}
      <Card>
        <CardContent className="py-6">
          <TicketStepper currentStatus={ticket.status} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              {ticket.descricao ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground bg-transparent p-0">
                    {ticket.descricao}
                  </pre>
                </div>
              ) : (
                <p className="text-muted-foreground italic">Sem descrição</p>
              )}
            </CardContent>
          </Card>

          {/* Transição CS info (if exists) */}
          {ticket.transicao_cs && (
            <Card className="border-green-500/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Resolução Técnica
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Resumo Técnico</p>
                  <p className="text-sm">{ticket.transicao_cs.resumo_tecnico}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ação Tomada</p>
                  <p className="text-sm">{ticket.transicao_cs.acao_tomada}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Impacto</p>
                    <Badge variant={
                      ticket.transicao_cs.impacto === 'alto' ? 'destructive' :
                      ticket.transicao_cs.impacto === 'medio' ? 'default' : 'secondary'
                    }>
                      {ticket.transicao_cs.impacto.charAt(0).toUpperCase() + ticket.transicao_cs.impacto.slice(1)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Encaminhado em</p>
                    <p className="text-sm">{format(new Date(ticket.transicao_cs.data_transicao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Histórico */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticket.historico.map((item, index) => (
                <div key={item.id} className="flex gap-3">
                  <div className={cn(
                    "w-2 h-2 mt-2 rounded-full shrink-0",
                    item.tipo === 'transicao_time' ? "bg-purple-500" :
                    item.tipo === 'mudanca_status' ? "bg-blue-500" : "bg-muted-foreground"
                  )} />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-sm">{item.autor}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.data), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{item.conteudo}</p>
                  </div>
                </div>
              ))}

              <Separator className="my-4" />

              {/* Add comment */}
              <div className="space-y-3">
                <Textarea
                  placeholder="Adicionar comentário..."
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  rows={3}
                />
                <Button 
                  size="sm" 
                  onClick={handleAddComentario}
                  disabled={!novoComentario.trim()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Empresa</p>
                  <p className="text-sm font-medium">{ticket.empresa}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Server className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Serviço</p>
                  <p className="text-sm font-medium">{ticket.servico}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Setor</p>
                  <p className="text-sm font-medium">{ticket.setor}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Categoria</p>
                  <p className="text-sm font-medium">{CATEGORIA_LABELS[ticket.categoria]}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Criado em</p>
                  <p className="text-sm font-medium">
                    {format(new Date(ticket.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              {ticket.dispositivos && (
                <div>
                  <p className="text-xs text-muted-foreground">Dispositivos</p>
                  <p className="text-sm font-medium">{ticket.dispositivos}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions Card - Suporte */}
          {isSuporte && ticket.status !== 'encerrado' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ações do Suporte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canEditStatus && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Select 
                      value={ticket.status} 
                      onValueChange={(v) => handleStatusChange(v as TicketStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novo">Novo</SelectItem>
                        <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {canEncaminharCS && (
                  <Button 
                    className="w-full" 
                    onClick={() => setShowTransicaoModal(true)}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Encaminhar para CS
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions Card - CS */}
          {isCS && ticket.status !== 'encerrado' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ações do CS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Tipo de Demanda</p>
                  <Select 
                    value={ticket.tipo_demanda} 
                    onValueChange={(v) => handleTipoDemandaChange(v as TicketTipoDemanda)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_DEMANDA_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {canEncerrar && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full" variant="default">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Encerrar Ticket
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Encerrar ticket?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação irá encerrar o ticket definitivamente. O cliente será notificado da resolução.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleEncerrar}>
                          Encerrar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
          )}

          {/* Encerrado indicator */}
          {ticket.status === 'encerrado' && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="py-4 text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="font-medium text-green-500">Ticket Encerrado</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal de transição */}
      <TransicaoCSModal
        open={showTransicaoModal}
        onOpenChange={setShowTransicaoModal}
        onConfirm={handleTransicaoCS}
      />
    </div>
  );
}
