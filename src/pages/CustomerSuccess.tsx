// ============================================================================
// CUSTOMER SUCCESS — Operational validation/closure screen
// Route: /modulos/atendimentos/cs
// Source of truth: support_tickets via Edge Function support-ticket-list
// ============================================================================

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupportTicketList } from '@/hooks/useSupportTicketCore';
import { CoreTicket } from '@/services/supportTicketCoreService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TicketSeverityBadge } from '@/components/tickets-core/TicketSeverityBadge';
import { TicketStatusBadge } from '@/components/tickets-core/TicketStatusBadge';
import {
  Search,
  Users,
  Clock,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TICKET_DETAIL_ROUTE } from '@/lib/ticketPermissions';

type CSTab = 'aguardando' | 'encerrados' | 'reabertos';

export default function CustomerSuccess() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<CSTab>('aguardando');
  const [search, setSearch] = useState('');

  // Fetch CS tickets — status-based filtering
  const aguardandoQuery = useSupportTicketList({
    status: 'resolvido_suporte',
    current_queue: 'CS',
    search: search || undefined,
    per_page: 100,
  });

  const encerradosQuery = useSupportTicketList({
    status: 'encerrado_cs',
    search: search || undefined,
    per_page: 100,
  });

  const reabertosQuery = useSupportTicketList({
    status: 'reaberto',
    search: search || undefined,
    per_page: 100,
  });

  const aguardando = aguardandoQuery.tickets;
  const encerrados = encerradosQuery.tickets;
  const reabertos = reabertosQuery.tickets;
  const isLoading = aguardandoQuery.isLoading || encerradosQuery.isLoading;

  const handleRefresh = useCallback(() => {
    aguardandoQuery.refetch();
    encerradosQuery.refetch();
    reabertosQuery.refetch();
  }, [aguardandoQuery, encerradosQuery, reabertosQuery]);

  const handleViewTicket = (ticketId: string) => {
    navigate(TICKET_DETAIL_ROUTE(ticketId));
  };

  const currentTickets =
    activeTab === 'aguardando' ? aguardando :
    activeTab === 'encerrados' ? encerrados :
    reabertos;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Customer Success</h1>
            <p className="text-sm text-muted-foreground">
              Validação de resolução técnica e encerramento operacional
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{aguardando.length}</p>
                <p className="text-xs text-muted-foreground">Aguardando Validação</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{encerrados.length}</p>
                <p className="text-xs text-muted-foreground">Encerrados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <RefreshCw className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reabertos.length}</p>
                <p className="text-xs text-muted-foreground">Reabertos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, título ou solicitante..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CSTab)}>
        <TabsList>
          <TabsTrigger value="aguardando" className="text-xs">
            Aguardando Validação
            <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
              {aguardando.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="encerrados" className="text-xs">
            Encerrados
            <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
              {encerrados.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="reabertos" className="text-xs">
            Reabertos
            <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
              {reabertos.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {currentTickets.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">
                  {activeTab === 'aguardando'
                    ? 'Nenhum ticket aguardando validação'
                    : activeTab === 'encerrados'
                    ? 'Nenhum ticket encerrado no período'
                    : 'Nenhum ticket reaberto'}
                </h3>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {currentTickets.map((ticket) => (
                <CSTicketRow
                  key={ticket.id}
                  ticket={ticket}
                  onView={handleViewTicket}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Footer count */}
      {currentTickets.length > 0 && (
        <div className="flex justify-center">
          <span className="text-sm text-muted-foreground bg-muted px-4 py-2 rounded-full">
            {currentTickets.length} ticket{currentTickets.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

// ── CS Ticket Row ──────────────────────────────────────────────────────

function CSTicketRow({ ticket, onView }: { ticket: CoreTicket; onView: (id: string) => void }) {
  const resolvedAgo = ticket.resolved_at
    ? formatDistanceToNow(new Date(ticket.resolved_at), { addSuffix: true, locale: ptBR })
    : null;

  const createdAgo = formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR });

  return (
    <Card
      className="border-border/50 hover:border-primary/30 cursor-pointer transition-colors"
      onClick={() => onView(ticket.id)}
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-4">
          {/* Code + Severity */}
          <div className="flex items-center gap-2 min-w-[140px]">
            <span className="font-mono text-xs text-muted-foreground">
              {ticket.public_code || `#${ticket.ticket_number}`}
            </span>
            <TicketSeverityBadge severity={ticket.severity} />
          </div>

          {/* Title + Category */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{ticket.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {ticket.requester_name}
              {ticket.category && ` · ${ticket.category}`}
            </p>
          </div>

          {/* Status */}
          <TicketStatusBadge status={ticket.status} />

          {/* Timestamps */}
          <div className="hidden md:flex flex-col items-end text-xs text-muted-foreground min-w-[120px]">
            {resolvedAgo && (
              <span>Resolvido {resolvedAgo}</span>
            )}
            <span>Criado {createdAgo}</span>
          </div>

          {/* Action */}
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}
