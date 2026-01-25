// ============================================================================
// SUPPORT TICKET CARD - Compact card for queue list
// ============================================================================

import { formatDistanceToNow, differenceInMinutes, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Clock,
  AlertTriangle,
  User,
  Server,
  Building2,
  MessageSquare,
  UserPlus,
  ArrowRight,
  MoreHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SupportTicket,
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
} from '@/types/supportTicket';
import { cn } from '@/lib/utils';

interface SupportTicketCardProps {
  ticket: SupportTicket;
  onView: (ticketNumber: string) => void;
  onAssignToMe?: (ticketNumber: string) => void;
  onChangeStatus?: (ticketNumber: string, status: SupportTicketStatus) => void;
  onAddNote?: (ticketNumber: string) => void;
  showActions?: boolean;
}

export function SupportTicketCard({
  ticket,
  onView,
  onAssignToMe,
  onChangeStatus,
  onAddNote,
  showActions = true,
}: SupportTicketCardProps) {
  // Calculate SLA timer
  const now = new Date();
  const resolutionDue = parseISO(ticket.sla.resolution_due);
  const minutesRemaining = differenceInMinutes(resolutionDue, now);
  const hoursRemaining = Math.floor(minutesRemaining / 60);
  const isBreached = ticket.sla.resolution_breached || minutesRemaining < 0;
  const isAtRisk = !isBreached && minutesRemaining < 120; // Less than 2 hours

  const getSlaColor = () => {
    if (isBreached) return 'text-red-500';
    if (isAtRisk) return 'text-orange-500';
    return 'text-green-500';
  };

  const getSlaText = () => {
    if (isBreached) {
      return `SLA estourado há ${Math.abs(hoursRemaining)}h`;
    }
    if (hoursRemaining < 1) {
      return `${minutesRemaining}min restantes`;
    }
    return `${hoursRemaining}h restantes`;
  };

  return (
    <Card
      className={cn(
        'border-border/50 hover:border-primary/50 transition-colors cursor-pointer',
        isBreached && 'border-red-500/50 bg-red-500/5',
        isAtRisk && !isBreached && 'border-orange-500/30'
      )}
      onClick={() => onView(ticket.ticket_number)}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: Main info */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">
                {ticket.ticket_number}
              </span>
              <Badge variant="outline" className={cn('text-xs', PRIORITY_COLORS[ticket.priority])}>
                {PRIORITY_LABELS[ticket.priority]}
              </Badge>
              <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[ticket.status])}>
                {STATUS_LABELS[ticket.status]}
              </Badge>
              {ticket.priority === 'P0' && (
                <Badge variant="destructive" className="text-xs animate-pulse">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  PRODUÇÃO PARADA
                </Badge>
              )}
            </div>

            {/* Subject */}
            <h3 className="font-medium text-foreground line-clamp-1">{ticket.subject}</h3>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {ticket.client.name}
              </span>
              {ticket.resource && (
                <span className="flex items-center gap-1">
                  <Server className="h-3 w-3" />
                  {ticket.resource.code}
                </span>
              )}
              <Badge variant="outline" className={cn('text-xs', TEAM_COLORS[ticket.assigned_team])}>
                {TEAM_LABELS[ticket.assigned_team]}
              </Badge>
              {ticket.assigned_to_user_name ? (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {ticket.assigned_to_user_name}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-orange-500">
                  <User className="h-3 w-3" />
                  Não atribuído
                </span>
              )}
              {ticket.messages_count !== undefined && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {ticket.messages_count}
                </span>
              )}
            </div>
          </div>

          {/* Right: SLA timer and actions */}
          <div className="flex items-center gap-3 sm:flex-col sm:items-end">
            {/* SLA Timer */}
            <div className={cn('flex items-center gap-1 text-sm font-medium', getSlaColor())}>
              <Clock className="h-4 w-4" />
              <span>{getSlaText()}</span>
            </div>

            {/* Quick actions */}
            {showActions && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {!ticket.assigned_to_user_id && onAssignToMe && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => onAssignToMe(ticket.ticket_number)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Assumir
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(ticket.ticket_number)}>
                      Ver detalhes
                    </DropdownMenuItem>
                    {onAddNote && (
                      <DropdownMenuItem onClick={() => onAddNote(ticket.ticket_number)}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Nota interna
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {onChangeStatus && ticket.status === 'aberto' && (
                      <DropdownMenuItem
                        onClick={() => onChangeStatus(ticket.ticket_number, 'em_andamento')}
                      >
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Iniciar atendimento
                      </DropdownMenuItem>
                    )}
                    {onChangeStatus && ticket.status === 'em_andamento' && (
                      <>
                        <DropdownMenuItem
                          onClick={() => onChangeStatus(ticket.ticket_number, 'aguardando_cliente')}
                        >
                          Aguardando cliente
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onChangeStatus(ticket.ticket_number, 'resolvido')}
                        >
                          Marcar como resolvido
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
