// ============================================================================
// INTERNAL SUPPORT PAGE - Atendimento Interno
// Acessível a todos os usuários internos (level != 1)
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
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
} from 'lucide-react';

import { ModuleHeader, KPICard, SectionTitle } from '@/components/navigation/ModuleCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
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

import { useInternalTickets } from '@/hooks/useInternalTickets';
import { getCurrentOnCallUsers } from '@/services/techOpsService';
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
} from '@/types/internalTicket';

export default function InternalSupportPage() {
  const { tickets, stats, loading, refresh } = useInternalTickets(true); // Apenas meus chamados
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InternalTicketStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<InternalTicketType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<InternalTicketPriority | 'all'>('all');
  
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
      // Busca por texto
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          ticket.id.toLowerCase().includes(query) ||
          ticket.title.toLowerCase().includes(query) ||
          ticket.description.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Filtro por status
      if (statusFilter !== 'all' && ticket.status !== statusFilter) {
        return false;
      }

      // Filtro por tipo
      if (typeFilter !== 'all' && ticket.type !== typeFilter) {
        return false;
      }

      // Filtro por prioridade
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) {
        return false;
      }

      return true;
    });
  }, [tickets, searchQuery, statusFilter, typeFilter, priorityFilter]);

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

      {/* KPIs Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Chamados Abertos"
          value={loading ? '...' : stats.abertos.toString()}
          description="Aguardando atendimento"
          icon={AlertTriangle}
          className={stats.abertos > 0 ? 'border-blue-500/30' : ''}
        />
        <KPICard
          title="Em Andamento"
          value={loading ? '...' : stats.em_andamento.toString()}
          description="Sendo tratados"
          icon={Clock}
          className={stats.em_andamento > 0 ? 'border-yellow-500/30' : ''}
        />
        <KPICard
          title="Resolvidos (30 dias)"
          value={loading ? '...' : stats.resolvidos_30d.toString()}
          description="Últimos 30 dias"
          icon={CheckCircle}
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
          description="Prazo excedido"
          icon={AlertTriangle}
          className={stats.fora_sla > 0 ? 'border-red-500/30' : ''}
        />
      </div>

      {/* Plantão Ativo (apenas visualização) */}
      <div>
        <SectionTitle 
          title="Plantão Ativo" 
          description="Técnicos disponíveis para atendimento"
        />
        <Card className="p-4">
          {onCallLoading ? (
            <Skeleton className="h-6 w-48" />
          ) : onCallUsers.length === 0 ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Phone className="h-5 w-5" />
              <span>Nenhum plantonista ativo no momento</span>
            </div>
          ) : (
            <div className="flex items-center gap-4">
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
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID, título ou descrição..."
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
      </div>

      {/* Tabela de Chamados */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">ID</TableHead>
              <TableHead className="w-[140px]">Tipo</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[120px]">SLA</TableHead>
              <TableHead className="w-[150px]">Responsável</TableHead>
              <TableHead className="w-[150px]">Atualização</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                </TableRow>
              ))
            ) : filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {tickets.length === 0 
                    ? 'Você ainda não abriu nenhum chamado' 
                    : 'Nenhum chamado encontrado com os filtros aplicados'}
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} />
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ============================================================================
// TICKET ROW COMPONENT
// ============================================================================

function TicketRow({ ticket }: { ticket: InternalTicket }) {
  const slaStatus = ticket.sla_breached ? 'breached' : 'ok';
  
  return (
    <TableRow className="hover:bg-muted/50">
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
        <div className="flex items-center gap-2">
          <Badge className={TICKET_PRIORITY_COLORS[ticket.priority]}>
            {ticket.priority.charAt(0).toUpperCase()}
          </Badge>
          <span className="truncate max-w-[300px]">{ticket.title}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
          {TICKET_STATUS_LABELS[ticket.status]}
        </Badge>
      </TableCell>
      <TableCell>
        {slaStatus === 'breached' ? (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Atrasado
          </Badge>
        ) : (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <Timer className="h-3 w-3 mr-1" />
            OK
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {ticket.assignee_name ? (
          <span className="text-sm">{ticket.assignee_name}</span>
        ) : (
          <span className="text-sm text-muted-foreground">Não atribuído</span>
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
