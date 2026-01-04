import { 
  Ticket, 
  TicketStatus, 
  PRIORIDADE_LABELS, 
  STATUS_LABELS, 
  CATEGORIA_LABELS,
  TIME_LABELS,
  TicketPrioridade
} from '@/types/ticket';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  AlertCircle, 
  Clock, 
  Building2, 
  Server, 
  Eye,
  ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TicketCardProps {
  ticket: Ticket;
  onView: (id: string) => void;
  variant?: 'suporte' | 'cs';
}

const prioridadeColors: Record<TicketPrioridade, string> = {
  baixa: 'bg-muted text-muted-foreground',
  media: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  alta: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critica: 'bg-destructive/20 text-destructive border-destructive/30',
};

const statusColors: Record<TicketStatus, string> = {
  novo: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  em_atendimento: 'bg-primary/20 text-primary border-primary/30',
  resolvido_tecnico: 'bg-green-500/20 text-green-400 border-green-500/30',
  validacao_cs: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  encerrado: 'bg-muted text-muted-foreground',
};

export function TicketCard({ ticket, onView, variant = 'suporte' }: TicketCardProps) {
  const tempoAberto = formatDistanceToNow(new Date(ticket.criado_em), { 
    addSuffix: true, 
    locale: ptBR 
  });

  const ultimaInteracao = formatDistanceToNow(new Date(ticket.ultima_interacao), { 
    addSuffix: true, 
    locale: ptBR 
  });

  return (
    <Card 
      className={cn(
        "p-4 hover:bg-accent/5 transition-colors cursor-pointer border-l-4",
        ticket.prioridade === 'critica' && "border-l-destructive",
        ticket.prioridade === 'alta' && "border-l-orange-500",
        ticket.prioridade === 'media' && "border-l-yellow-500",
        ticket.prioridade === 'baixa' && "border-l-muted-foreground",
        variant === 'cs' && ticket.status === 'resolvido_tecnico' && "border-l-green-500"
      )}
      onClick={() => onView(ticket.id)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header: ID + Title */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{ticket.id}</span>
            {ticket.privado && (
              <Badge variant="outline" className="text-xs">Privado</Badge>
            )}
          </div>
          <h3 className="font-semibold text-foreground truncate">{ticket.titulo}</h3>

          {/* Tags row */}
          <div className="flex flex-wrap gap-2">
            <Badge className={cn("text-xs", prioridadeColors[ticket.prioridade])}>
              {PRIORIDADE_LABELS[ticket.prioridade]}
            </Badge>
            <Badge className={cn("text-xs", statusColors[ticket.status])}>
              {STATUS_LABELS[ticket.status]}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {CATEGORIA_LABELS[ticket.categoria]}
            </Badge>
            {variant === 'cs' && (
              <Badge variant="secondary" className="text-xs">
                {TIME_LABELS[ticket.time_atual]}
              </Badge>
            )}
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {ticket.empresa}
            </span>
            <span className="flex items-center gap-1">
              <Server className="h-3 w-3" />
              {ticket.servico}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Aberto {tempoAberto}
            </span>
          </div>
        </div>

        {/* Action */}
        <Button variant="ghost" size="icon" className="shrink-0">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </Card>
  );
}
