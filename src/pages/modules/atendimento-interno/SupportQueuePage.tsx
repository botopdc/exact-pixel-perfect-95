// ============================================================================
// SUPPORT QUEUE PAGE - Fila de Suporte para Técnicos (level 900+)
// Gestão completa de todos os chamados internos abertos
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Inbox,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  Timer,
  Phone,
  Search,
  Users,
  Pause,
  ArrowUpCircle,
  Filter,
  SortAsc,
  SortDesc,
  UserCheck,
  ArrowRight,
  XCircle,
} from 'lucide-react';

import { ModuleHeader, KPICard, SectionTitle } from '@/components/navigation/ModuleCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

import { useInternalTickets } from '@/hooks/useInternalTickets';
import { getCurrentOnCallUsers } from '@/services/techOpsService';
import { authService } from '@/services/authService';
import type { TechOnCallShift } from '@/types/techOps';
import {
  InternalTicket,
  InternalTicketStatus,
  InternalTicketType,
  InternalTicketPriority,
  TICKET_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_PRIORITY_COLORS,
  SUPPORT_LEVELS,
} from '@/types/internalTicket';

type SortField = 'created_at' | 'priority' | 'sla_deadline' | 'updated_at';
type SortDirection = 'asc' | 'desc';
type SLAFilter = 'all' | 'ok' | 'urgent' | 'breached' | 'paused';

export default function SupportQueuePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;

  // Verificar se é suporte
  if (!SUPPORT_LEVELS.includes(userLevel)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <XCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground mb-4">
          Esta página é exclusiva para técnicos de suporte.
        </p>
        <Link to="/modulos/atendimentos/interno">
          <Button>Ir para Meus Chamados</Button>
        </Link>
      </div>
    );
  }

  // Ver todos os chamados (não filtrar por usuário)
  const {
    tickets,
    stats,
    loading,
    refresh,
    assumeTicket,
    updateStatus, 
    escalateToN2,
    userId 
  } = useInternalTickets({ viewMode: 'queue_support' });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InternalTicketStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<InternalTicketType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<InternalTicketPriority | 'all'>('all');
  const [queueFilter, setQueueFilter] = useState<'N1' | 'N2' | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'unassigned' | 'mine'>('all');
  const [slaFilter, setSlaFilter] = useState<SLAFilter>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

  // Filtrar e ordenar tickets
  const filteredTickets = useMemo(() => {
    let result = tickets.filter((ticket) => {
      // Busca por texto
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          ticket.id.toLowerCase().includes(query) ||
          ticket.title.toLowerCase().includes(query) ||
          ticket.created_by_name.toLowerCase().includes(query) ||
          ticket.created_by_email.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Filtros
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
      if (typeFilter !== 'all' && ticket.type !== typeFilter) return false;
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;
      if (queueFilter !== 'all' && ticket.queue !== queueFilter) return false;

      // Filtro de responsável
      if (assigneeFilter === 'unassigned' && ticket.assignee_id) return false;
      if (assigneeFilter === 'mine' && ticket.assignee_id !== userId) return false;

      // Filtro de SLA
      if (slaFilter === 'ok' && (ticket.sla_breached || ticket.sla_paused)) return false;
      if (slaFilter === 'urgent') {
        if (ticket.sla_breached || ticket.sla_paused) return false;
        const deadline = new Date(ticket.sla_deadline).getTime() + ticket.sla_accumulated_pause_ms;
        const hoursRemaining = (deadline - Date.now()) / (1000 * 60 * 60);
        if (hoursRemaining > 2) return false;
      }
      if (slaFilter === 'breached' && !ticket.sla_breached) return false;
      if (slaFilter === 'paused' && !ticket.sla_paused) return false;

      return true;
    });

    // Ordenação
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'updated_at':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        case 'sla_deadline':
          comparison = new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime();
          break;
        case 'priority':
          const priorityOrder = { critica: 0, alta: 1, media: 2, baixa: 3 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [tickets, searchQuery, statusFilter, typeFilter, priorityFilter, queueFilter, assigneeFilter, slaFilter, sortField, sortDirection, userId]);

  // Estatísticas adicionais para suporte
  const queueStats = useMemo(() => {
    const openTickets = tickets.filter(t => t.status !== 'resolvido' && t.status !== 'encerrado');
    return {
      n1: openTickets.filter(t => t.queue === 'N1').length,
      n2: openTickets.filter(t => t.queue === 'N2').length,
      unassigned: openTickets.filter(t => !t.assignee_id).length,
      mine: openTickets.filter(t => t.assignee_id === userId).length,
    };
  }, [tickets, userId]);

  const handleQuickAction = (ticket: InternalTicket, action: 'assume' | 'escalate' | 'resolve') => {
    switch (action) {
      case 'assume':
        assumeTicket(ticket.id);
        toast({ title: 'Chamado assumido' });
        break;
      case 'escalate':
        escalateToN2(ticket.id);
        toast({ title: 'Chamado escalado para N2' });
        break;
      case 'resolve':
        updateStatus(ticket.id, 'resolvido');
        toast({ title: 'Chamado marcado como resolvido' });
        break;
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Fila de Suporte"
        description="Gerencie todos os chamados internos abertos"
        icon={Inbox}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {/* KPIs do Suporte */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <KPICard
          title="Abertos"
          value={loading ? '...' : stats.abertos.toString()}
          description="Aguardando"
          icon={AlertTriangle}
          className={stats.abertos > 0 ? 'border-blue-500/30' : ''}
        />
        <KPICard
          title="Em Atendimento"
          value={loading ? '...' : stats.em_andamento.toString()}
          description="Sendo tratados"
          icon={Clock}
        />
        <KPICard
          title="Não Atribuídos"
          value={loading ? '...' : queueStats.unassigned.toString()}
          description="Na fila"
          icon={Users}
          className={queueStats.unassigned > 0 ? 'border-yellow-500/30' : ''}
        />
        <KPICard
          title="Meus Chamados"
          value={loading ? '...' : queueStats.mine.toString()}
          description="Atribuídos a mim"
          icon={UserCheck}
        />
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
          description="Atrasados"
          icon={AlertTriangle}
          className={stats.fora_sla > 0 ? 'border-red-500/30' : ''}
        />
      </div>

      {/* Plantão Ativo */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Phone className={`h-5 w-5 ${onCallUsers.length > 0 ? 'text-green-500' : 'text-muted-foreground'}`} />
            <span className="font-medium">Plantão:</span>
            {onCallLoading ? (
              <Skeleton className="h-5 w-32" />
            ) : onCallUsers.length === 0 ? (
              <span className="text-muted-foreground">Nenhum plantonista ativo</span>
            ) : (
              <div className="flex gap-2">
                {onCallUsers.map((shift) => (
                  <Badge 
                    key={shift.id} 
                    variant="outline" 
                    className="bg-green-500/10 text-green-600 border-green-500/30"
                  >
                    {shift.user?.name} ({shift.level})
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Filtros Avançados */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Linha 1: Busca e filtros principais */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, título, solicitante..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
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
                <SelectItem value="all">Todos Tipos</SelectItem>
                {Object.entries(TICKET_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as typeof priorityFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Linha 2: Filtros avançados */}
          <div className="flex flex-wrap gap-3">
            <Select value={queueFilter} onValueChange={(v) => setQueueFilter(v as typeof queueFilter)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Fila" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Filas</SelectItem>
                <SelectItem value="N1">N1 ({queueStats.n1})</SelectItem>
                <SelectItem value="N2">N2 ({queueStats.n2})</SelectItem>
              </SelectContent>
            </Select>

            <Select value={assigneeFilter} onValueChange={(v) => setAssigneeFilter(v as typeof assigneeFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="unassigned">Não Atribuídos ({queueStats.unassigned})</SelectItem>
                <SelectItem value="mine">Meus Chamados ({queueStats.mine})</SelectItem>
              </SelectContent>
            </Select>

            <Select value={slaFilter} onValueChange={(v) => setSlaFilter(v as SLAFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="SLA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos SLAs</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="urgent">Urgente (&lt;2h)</SelectItem>
                <SelectItem value="breached">Atrasado</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground">Ordenar:</span>
              <Button
                variant={sortField === 'created_at' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => toggleSort('created_at')}
              >
                Data {sortField === 'created_at' && (sortDirection === 'asc' ? <SortAsc className="h-3 w-3 ml-1" /> : <SortDesc className="h-3 w-3 ml-1" />)}
              </Button>
              <Button
                variant={sortField === 'priority' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => toggleSort('priority')}
              >
                Prioridade {sortField === 'priority' && (sortDirection === 'asc' ? <SortAsc className="h-3 w-3 ml-1" /> : <SortDesc className="h-3 w-3 ml-1" />)}
              </Button>
              <Button
                variant={sortField === 'sla_deadline' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => toggleSort('sla_deadline')}
              >
                SLA {sortField === 'sla_deadline' && (sortDirection === 'asc' ? <SortAsc className="h-3 w-3 ml-1" /> : <SortDesc className="h-3 w-3 ml-1" />)}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Chamados */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">ID</TableHead>
              <TableHead className="w-[140px]">Tipo</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="w-[100px]">Fila</TableHead>
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="w-[100px]">SLA</TableHead>
              <TableHead className="w-[130px]">Responsável</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {tickets.length === 0 
                    ? 'Nenhum chamado no sistema' 
                    : 'Nenhum chamado encontrado com os filtros aplicados'}
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket) => (
                <SupportTicketRow 
                  key={ticket.id} 
                  ticket={ticket} 
                  onAction={handleQuickAction}
                  currentUserId={userId}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Contador de resultados */}
      <div className="text-sm text-muted-foreground text-center">
        Mostrando {filteredTickets.length} de {tickets.length} chamados
      </div>
    </div>
  );
}

// ============================================================================
// SUPPORT TICKET ROW COMPONENT
// ============================================================================

interface SupportTicketRowProps {
  ticket: InternalTicket;
  onAction: (ticket: InternalTicket, action: 'assume' | 'escalate' | 'resolve') => void;
  currentUserId?: number;
}

function SupportTicketRow({ ticket, onAction, currentUserId }: SupportTicketRowProps) {
  const isClosed = ticket.status === 'resolvido' || ticket.status === 'encerrado';
  const isAssignedToMe = ticket.assignee_id === currentUserId;
  const canAssume = !ticket.assignee_id && !isClosed;
  const canEscalate = ticket.queue === 'N1' && !isClosed;
  const canResolve = isAssignedToMe && !isClosed;

  return (
    <TableRow className={`hover:bg-muted/50 ${ticket.sla_breached ? 'bg-red-500/5' : ''}`}>
      <TableCell>
        <Link 
          to={`/modulos/atendimentos/interno/${ticket.id}`}
          className="font-mono text-sm text-primary hover:underline"
        >
          {ticket.id}
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {TICKET_TYPE_LABELS[ticket.type]}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          <p className="font-medium truncate max-w-[150px]">{ticket.created_by_name}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[150px]">{ticket.created_by_email}</p>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge className={TICKET_PRIORITY_COLORS[ticket.priority]}>
            {ticket.priority.charAt(0).toUpperCase()}
          </Badge>
          <span className="truncate max-w-[200px]">{ticket.title}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{ticket.queue}</Badge>
      </TableCell>
      <TableCell>
        <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
          {TICKET_STATUS_LABELS[ticket.status]}
        </Badge>
      </TableCell>
      <TableCell>
        <SLABadge ticket={ticket} />
      </TableCell>
      <TableCell>
        {ticket.assignee_name ? (
          <span className={`text-sm ${isAssignedToMe ? 'font-medium text-primary' : ''}`}>
            {isAssignedToMe ? 'Eu' : ticket.assignee_name}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground italic">—</span>
        )}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/modulos/atendimentos/interno/${ticket.id}`}>
                Ver Detalhes
              </Link>
            </DropdownMenuItem>
            {canAssume && (
              <DropdownMenuItem onClick={() => onAction(ticket, 'assume')}>
                <UserCheck className="h-4 w-4 mr-2" />
                Assumir
              </DropdownMenuItem>
            )}
            {canEscalate && (
              <DropdownMenuItem onClick={() => onAction(ticket, 'escalate')}>
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Escalar N2
              </DropdownMenuItem>
            )}
            {canResolve && (
              <DropdownMenuItem onClick={() => onAction(ticket, 'resolve')}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Resolver
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// SLA BADGE COMPONENT
// ============================================================================

function SLABadge({ ticket }: { ticket: InternalTicket }) {
  if (ticket.status === 'resolvido' || ticket.status === 'encerrado') {
    return (
      <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
        <CheckCircle className="h-3 w-3 mr-1" />
        —
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

  const effectiveDeadline = new Date(
    new Date(ticket.sla_deadline).getTime() + ticket.sla_accumulated_pause_ms
  );
  const remainingMs = effectiveDeadline.getTime() - Date.now();
  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

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
