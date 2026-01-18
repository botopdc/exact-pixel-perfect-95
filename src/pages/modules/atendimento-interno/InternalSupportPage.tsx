// ============================================================================
// INTERNAL SUPPORT PAGE - Atendimento Interno
// Acessível a todos os usuários internos (level != 1)
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  HeadphonesIcon,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  Timer,
  Phone,
  Search,
  Pause,
  Users,
  Inbox,
  UserCheck,
} from 'lucide-react';

import { ModuleHeader, KPICard, SectionTitle } from '@/components/navigation/ModuleCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { useInternalTickets, ViewMode } from '@/hooks/useInternalTickets';
import { getCurrentOnCallUsers } from '@/services/techOpsService';
import type { TechOnCallShift } from '@/types/techOps';
import {
  InternalTicket,
  InternalTicketStatus,
  InternalTicketType,
  InternalTicketPriority,
  TicketQueue,
  TICKET_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_PRIORITY_COLORS,
  QUEUE_LABELS,
  QUEUE_COLORS,
} from '@/types/internalTicket';

export default function InternalSupportPage() {
  const [activeTab, setActiveTab] = useState<ViewMode>('my_tickets');
  
  // Hook para "Meus Chamados"
  const myTicketsHook = useInternalTickets({ viewMode: 'my_tickets' });
  
  // Hook para "Fila do Suporte"
  const supportQueueHook = useInternalTickets({ viewMode: 'queue_support' });
  
  // Hook para "Fila do CS"
  const csQueueHook = useInternalTickets({ viewMode: 'queue_cs' });
  
  // Determinar qual hook usar baseado na aba ativa
  const activeHook = activeTab === 'my_tickets' 
    ? myTicketsHook 
    : activeTab === 'queue_support' 
      ? supportQueueHook 
      : csQueueHook;
  
  const { 
    tickets, 
    stats, 
    loading, 
    refresh, 
    isSupport, 
    isCS, 
    isAdmin,
    canManage,
  } = activeHook;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InternalTicketStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<InternalTicketType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<InternalTicketPriority | 'all'>('all');
  const [queueFilter, setQueueFilter] = useState<TicketQueue | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'unassigned' | 'mine'>('all');
  
  const [onCallUsers, setOnCallUsers] = useState<TechOnCallShift[]>([]);
  const [onCallLoading, setOnCallLoading] = useState(true);

  useEffect(() => {
    loadOnCall();
  }, []);

  async function loadOnCall() {
    try {
      const users = await getCurrentOnCallUsers();
      setOnCallUsers(users);
    } catch (error) {
      console.error('Erro ao carregar plantonistas:', error);
    } finally {
      setOnCallLoading(false);
    }
  }

  // Filtrar tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          ticket.id.toLowerCase().includes(query) ||
          ticket.title.toLowerCase().includes(query) ||
          ticket.description.toLowerCase().includes(query) ||
          ticket.created_by_name.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
      if (typeFilter !== 'all' && ticket.type !== typeFilter) return false;
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;
      if (queueFilter !== 'all' && ticket.queue !== queueFilter) return false;
      
      if (assigneeFilter === 'unassigned' && ticket.assignee_id) return false;
      if (assigneeFilter === 'mine' && ticket.assignee_id !== myTicketsHook.userId) return false;

      return true;
    });
    }, [tickets, searchQuery, statusFilter, typeFilter, priorityFilter, queueFilter, assigneeFilter, myTicketsHook.userId]);

  // Verificar se pode ver abas de fila (level >= 750 vê tudo)
  const canSeeQueues = myTicketsHook.userLevel >= 750;

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Atendimento Interno"
        description="Abra e acompanhe chamados internos com SLA garantido"
        icon={HeadphonesIcon}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Link to="/modulos/atendimentos/interno/novo">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Abrir Chamado
              </Button>
            </Link>
          </div>
        }
      />

      {/* Plantão Ativo */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <SectionTitle 
            title="Plantão Ativo" 
            description="Técnicos disponíveis"
          />
          {onCallLoading ? (
            <Skeleton className="h-6 w-48" />
          ) : onCallUsers.length === 0 ? (
            <div className="flex items-center gap-3 text-muted-foreground ml-4">
              <Phone className="h-5 w-5" />
              <span>Nenhum plantonista ativo</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-4">
              <Phone className="h-5 w-5 text-green-500" />
              {onCallUsers.map((shift) => (
                <Badge 
                  key={shift.id} 
                  variant="outline" 
                  className="bg-green-500/10 text-green-600 border-green-500/30"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {shift.user?.name} ({shift.level})
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Tabs para diferentes visões */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ViewMode)}>
        <TabsList className={`grid w-full lg:w-auto lg:inline-grid ${canSeeQueues ? 'grid-cols-3' : 'grid-cols-1'}`}>
          <TabsTrigger value="my_tickets" className="gap-2">
            <Inbox className="h-4 w-4" />
            Meus Chamados
          </TabsTrigger>
          {canSeeQueues && (
            <TabsTrigger value="queue_support" className="gap-2">
              <Users className="h-4 w-4" />
              Fila do Suporte
            </TabsTrigger>
          )}
          {canSeeQueues && (
            <TabsTrigger value="queue_cs" className="gap-2">
              <UserCheck className="h-4 w-4" />
              Fila do CS
            </TabsTrigger>
          )}
        </TabsList>

        {/* KPIs Section - Comum a todas as abas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mt-6">
          <KPICard
            title="Abertos"
            value={loading ? '...' : stats.abertos.toString()}
            description="Aguardando atendimento"
            icon={AlertTriangle}
            className={stats.abertos > 0 ? 'border-blue-500/30' : ''}
          />
          <KPICard
            title="Em Atendimento"
            value={loading ? '...' : stats.em_andamento.toString()}
            description="Sendo tratados"
            icon={Clock}
            className={stats.em_andamento > 0 ? 'border-yellow-500/30' : ''}
          />
          {activeTab !== 'my_tickets' && (
            <KPICard
              title="Não Atribuídos"
              value={loading ? '...' : stats.nao_atribuidos.toString()}
              description="Sem responsável"
              icon={Users}
              className={stats.nao_atribuidos > 0 ? 'border-orange-500/30' : ''}
            />
          )}
          <KPICard
            title="Dentro do SLA"
            value={loading ? '...' : stats.dentro_sla.toString()}
            description="No prazo"
            icon={Timer}
            className="border-green-500/30"
          />
          <KPICard
            title="Fora do SLA"
            value={loading ? '...' : stats.fora_sla.toString()}
            description="Prazo excedido"
            icon={AlertTriangle}
            className={stats.fora_sla > 0 ? 'border-red-500/30' : ''}
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-4 mt-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID, título, descrição ou solicitante..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              {Object.entries(TICKET_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as typeof priorityFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeTab !== 'my_tickets' && (
            <>
              <Select value={queueFilter} onValueChange={(v) => setQueueFilter(v as typeof queueFilter)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Fila" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Filas</SelectItem>
                  {Object.entries(QUEUE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={assigneeFilter} onValueChange={(v) => setAssigneeFilter(v as typeof assigneeFilter)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="unassigned">Não Atribuídos</SelectItem>
                  <SelectItem value="mine">Meus</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {/* Conteúdo da Tabela */}
        <TabsContent value="my_tickets" className="mt-4">
          <TicketsTable 
            tickets={filteredTickets} 
            loading={loading} 
            emptyMessage="Você ainda não abriu nenhum chamado"
            showQueue={false}
            showRequester={false}
          />
        </TabsContent>

        {canSeeQueues && (
          <TabsContent value="queue_support" className="mt-4">
            <TicketsTable 
              tickets={filteredTickets} 
              loading={loading} 
              emptyMessage="Nenhum chamado na fila do suporte"
              showQueue={true}
              showRequester={true}
            />
          </TabsContent>
        )}

        {canSeeQueues && (
          <TabsContent value="queue_cs" className="mt-4">
            <TicketsTable 
              tickets={filteredTickets} 
              loading={loading} 
              emptyMessage="Nenhum chamado na fila do CS"
              showQueue={true}
              showRequester={true}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ============================================================================
// TICKETS TABLE COMPONENT
// ============================================================================

interface TicketsTableProps {
  tickets: InternalTicket[];
  loading: boolean;
  emptyMessage: string;
  showQueue: boolean;
  showRequester: boolean;
}

function TicketsTable({ tickets, loading, emptyMessage, showQueue, showRequester }: TicketsTableProps) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">ID</TableHead>
            <TableHead className="w-[140px]">Tipo</TableHead>
            {showRequester && <TableHead className="w-[150px]">Solicitante</TableHead>}
            <TableHead>Título</TableHead>
            {showQueue && <TableHead className="w-[120px]">Fila</TableHead>}
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead className="w-[100px]">SLA</TableHead>
            <TableHead className="w-[150px]">Responsável</TableHead>
            <TableHead className="w-[130px]">Atualização</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                {showRequester && <TableCell><Skeleton className="h-4 w-28" /></TableCell>}
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                {showQueue && <TableCell><Skeleton className="h-4 w-20" /></TableCell>}
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
              </TableRow>
            ))
          ) : tickets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showQueue && showRequester ? 9 : showQueue || showRequester ? 8 : 7} className="text-center py-8 text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            tickets.map((ticket) => (
              <TicketRow 
                key={ticket.id} 
                ticket={ticket} 
                showQueue={showQueue}
                showRequester={showRequester}
              />
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

// ============================================================================
// TICKET ROW COMPONENT
// ============================================================================

interface TicketRowProps {
  ticket: InternalTicket;
  showQueue: boolean;
  showRequester: boolean;
}

function TicketRow({ ticket, showQueue, showRequester }: TicketRowProps) {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <Link 
          to={`/modulos/atendimentos/interno/${ticket.id}`}
          className="font-mono text-sm text-primary hover:underline"
        >
          {ticket.code || ticket.id.slice(0, 12)}
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {TICKET_TYPE_LABELS[ticket.type]}
        </Badge>
      </TableCell>
      {showRequester && (
        <TableCell>
          <span className="text-sm">{ticket.created_by_name}</span>
        </TableCell>
      )}
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge className={TICKET_PRIORITY_COLORS[ticket.priority]}>
            {ticket.priority.charAt(0).toUpperCase()}
          </Badge>
          <span className="truncate max-w-[300px]">{ticket.title}</span>
        </div>
      </TableCell>
      {showQueue && (
        <TableCell>
          <Badge className={QUEUE_COLORS[ticket.queue]}>
            {ticket.queue}
          </Badge>
        </TableCell>
      )}
      <TableCell>
        <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
          {TICKET_STATUS_LABELS[ticket.status]}
        </Badge>
      </TableCell>
      <TableCell>
        <SLAIndicator ticket={ticket} />
      </TableCell>
      <TableCell>
        {ticket.assignee_name ? (
          <span className="text-sm">{ticket.assignee_name}</span>
        ) : (
          <span className="text-sm text-muted-foreground italic">Não atribuído</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(ticket.updated_at), { 
            addSuffix: true, 
            locale: ptBR 
          })}
        </span>
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// SLA INDICATOR COMPONENT
// ============================================================================

function SLAIndicator({ ticket }: { ticket: InternalTicket }) {
  if (ticket.status === 'resolvido' || ticket.status === 'encerrado') {
    return (
      <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
        <CheckCircle className="h-3 w-3 mr-1" />
        OK
      </Badge>
    );
  }

  if (ticket.sla_paused) {
    return (
      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
        <Pause className="h-3 w-3 mr-1" />
        Pausado
      </Badge>
    );
  }

  if (ticket.sla_breached) {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Atrasado
      </Badge>
    );
  }

  // Calcular tempo restante
  const effectiveDeadline = new Date(
    new Date(ticket.sla_deadline).getTime() + ticket.sla_accumulated_pause_ms
  );
  const now = new Date();
  const remainingMs = effectiveDeadline.getTime() - now.getTime();
  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  // Cor baseada no tempo restante
  const isUrgent = remainingHours < 2;
  const colorClass = isUrgent 
    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    : 'bg-green-500/20 text-green-400 border-green-500/30';

  return (
    <Badge className={colorClass}>
      <Timer className="h-3 w-3 mr-1" />
      {remainingHours > 0 ? `${remainingHours}h` : `${remainingMinutes}m`}
    </Badge>
  );
}
