// ============================================================================
// SUPPORT QUEUE PAGE - Fila de Chamados
// ============================================================================

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Headphones,
  AlertTriangle,
  Clock,
  Users,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SupportTicketCard } from '@/components/support/SupportTicketCard';
import { useSupportTickets, QueueTab } from '@/hooks/useSupportTickets';
import { SupportTeam, TEAM_LABELS, canAccessSupportModule } from '@/types/supportTicket';
import { authService } from '@/services/authService';
import { toast } from 'sonner';

export default function SupportQueuePage() {
  const navigate = useNavigate();
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;

  // Check access
  if (!canAccessSupportModule(userLevel)) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar este módulo.
          </p>
        </Card>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<QueueTab>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<SupportTeam | '__all__'>('__all__');

  const {
    tickets,
    stats,
    isLoading,
    refetch,
    assignToMe,
    changeStatus,
    addInternalNote,
    isUpdating,
  } = useSupportTickets({
    tab: activeTab,
    filters: {
      search: searchQuery || undefined,
      assigned_team: teamFilter !== '__all__' ? teamFilter : undefined,
    },
  });

  const handleViewTicket = useCallback(
    (ticketNumber: string) => {
      navigate(`/modulos/atendimentos/chamados/${ticketNumber}`);
    },
    [navigate]
  );

  const handleAddNote = useCallback((ticketNumber: string) => {
    const note = prompt('Digite a nota interna:');
    if (note) {
      addInternalNote(ticketNumber, note);
    }
  }, [addInternalNote]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Headphones className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Fila de Chamados</h1>
            <p className="text-muted-foreground">Gerenciamento de tickets de suporte</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.p0_count}</p>
                <p className="text-xs text-muted-foreground">P0 Críticos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Clock className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.abertos + stats.em_andamento}</p>
                <p className="text-xs text-muted-foreground">Em Aberto</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <Users className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.unassigned_count}</p>
                <p className="text-xs text-muted-foreground">Não Atribuídos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/20">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sla_breach_count}</p>
                <p className="text-xs text-muted-foreground">SLA Estourado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="border-border/50">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, assunto ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={teamFilter} onValueChange={(v) => setTeamFilter(v as SupportTeam | '__all__')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Equipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {Object.entries(TEAM_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs and Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as QueueTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="p0" className="relative">
            P0 Produção
            {stats.p0_count > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                {stats.p0_count}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="aguardando">
            Aguardando Cliente
            {stats.aguardando_cliente > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {stats.aguardando_cliente}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="em_andamento">Em Andamento</TabsTrigger>
          <TabsTrigger value="todos">
            Todos Abertos
            <Badge variant="outline" className="ml-2 h-5 px-1.5 text-xs">
              {stats.total}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-border/50">
                  <CardContent className="p-4">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <Headphones className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum chamado encontrado</h3>
                <p className="text-muted-foreground mt-1">
                  Não há chamados nesta fila no momento.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <SupportTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onView={handleViewTicket}
                  onAssignToMe={assignToMe}
                  onChangeStatus={changeStatus}
                  onAddNote={handleAddNote}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Footer count */}
      {tickets.length > 0 && (
        <div className="flex justify-center">
          <span className="text-sm text-muted-foreground bg-muted px-4 py-2 rounded-full">
            {tickets.length} chamado{tickets.length !== 1 ? 's' : ''} na fila
          </span>
        </div>
      )}
    </div>
  );
}
