// ============================================================================
// TICKETS CORE — Main page (role-based) with queue tabs
// Route: /modulos/atendimentos/suporte-tecnico
// ============================================================================

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Headphones, Plus, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TicketTable, TicketCardMobile } from '@/components/tickets-core/TicketTable';
import { TicketFilters } from '@/components/tickets-core/TicketFilters';
import { TicketSummaryCards } from '@/components/tickets-core/TicketSummaryCards';
import { TicketCreateModal } from '@/components/tickets-core/TicketCreateModal';
import { useSupportTicketList } from '@/hooks/useSupportTicketCore';
import { authService } from '@/services/authService';
import { getTicketPermissions, TICKET_LIST_ROUTE, TICKET_DETAIL_ROUTE } from '@/lib/ticketPermissions';
import { useIsMobile } from '@/hooks/use-mobile';
import type { TicketListFilters } from '@/services/supportTicketCoreService';

type QueueTab = 'todos' | 'novos' | 'em_atendimento' | 'aguardando' | 'resolvido' | 'meus' | 'nao_atribuidos';

const TAB_FILTERS: Record<QueueTab, Partial<TicketListFilters>> = {
  todos: {},
  novos: { status: 'novo' },
  em_atendimento: { status: 'em_atendimento' },
  aguardando: { status: 'aguardando_cliente' },
  resolvido: { status: 'resolvido_suporte' },
  meus: { only_mine: true },
  nao_atribuidos: { only_unassigned: true },
};

export default function TicketsCoreListPage() {
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;
  const permissions = getTicketPermissions(userLevel);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [tab, setTab] = useState<QueueTab>(permissions.isInternal ? 'novos' : 'todos');
  const [filters, setFilters] = useState<TicketListFilters>({});
  const [createOpen, setCreateOpen] = useState(false);

  const mergedFilters: TicketListFilters = {
    ...TAB_FILTERS[tab],
    ...filters,
    ...(permissions.isClient ? { only_mine: true } : {}),
  };

  const { tickets, isLoading, error, refetch } = useSupportTicketList(mergedFilters);

  // Debug visibility
  console.log('[TicketsCoreListPage] render', {
    tab,
    mergedFilters,
    ticketCount: tickets.length,
    isLoading,
    hasError: !!error,
    errorMsg: error?.message,
  });

  const handleCreated = (ticketId: string) => {
    navigate(TICKET_DETAIL_ROUTE(ticketId));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <Headphones className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">
              {permissions.isClient ? 'Meus Chamados' : 'Fila de Chamados'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {permissions.isClient ? 'Acompanhe seus tickets de suporte' : 'Gerenciamento de tickets de suporte técnico'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {permissions.canManageQueues && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`${TICKET_LIST_ROUTE}/filas`}>
                <Settings className="h-4 w-4 mr-1" />
                Filas
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Abrir Chamado
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {permissions.isInternal && <TicketSummaryCards tickets={tickets} />}

      {/* Filters */}
      <TicketFilters
        filters={filters}
        onChange={setFilters}
        showQueueFilter={permissions.isInternal}
      />

      {/* Tabs — internal view */}
      {permissions.isInternal ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v as QueueTab)}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="novos" className="text-xs">
              Novos
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {tickets.filter(t => t.status === 'novo' || t.status === 'reaberto').length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="em_atendimento" className="text-xs">Em Atendimento</TabsTrigger>
            <TabsTrigger value="aguardando" className="text-xs">Aguardando</TabsTrigger>
            <TabsTrigger value="resolvido" className="text-xs">Resolvido</TabsTrigger>
            <TabsTrigger value="nao_atribuidos" className="text-xs">Não Atribuídos</TabsTrigger>
            <TabsTrigger value="meus" className="text-xs">Meus Tickets</TabsTrigger>
            <TabsTrigger value="todos" className="text-xs">Todos</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isMobile ? (
              <div className="space-y-2">
                {tickets.map(t => <TicketCardMobile key={t.id} ticket={t} routePrefix={TICKET_LIST_ROUTE} />)}
                {!isLoading && tickets.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhum chamado nesta aba</p>
                )}
              </div>
            ) : (
              <TicketTable tickets={tickets} isLoading={isLoading} routePrefix={TICKET_LIST_ROUTE} />
            )}
          </TabsContent>
        </Tabs>
      ) : (
        isMobile ? (
          <div className="space-y-2">
            {tickets.map(t => <TicketCardMobile key={t.id} ticket={t} routePrefix={TICKET_LIST_ROUTE} />)}
            {!isLoading && tickets.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Você ainda não possui chamados</p>
            )}
          </div>
        ) : (
          <TicketTable tickets={tickets} isLoading={isLoading} showQueue={false} routePrefix={TICKET_LIST_ROUTE} />
        )
      )}

      <TicketCreateModal open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreated} />
    </div>
  );
}
