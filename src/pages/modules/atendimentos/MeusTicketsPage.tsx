// ============================================================================
// MY TICKETS PAGE - Meus Chamados (Tickets assigned to current user)
// ============================================================================

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SupportTicketCard } from '@/components/support/SupportTicketCard';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import { SupportTicketStatus, canAccessSupportModule } from '@/types/supportTicket';
import { authService } from '@/services/authService';

type MyTicketsTab = 'abertos' | 'aguardando' | 'resolvidos';

export default function MeusTicketsPage() {
  const navigate = useNavigate();
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;
  const userId = session?.userId ? parseInt(session.userId, 10) : undefined;

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

  const [activeTab, setActiveTab] = useState<MyTicketsTab>('abertos');
  const [searchQuery, setSearchQuery] = useState('');

  // Get tickets assigned to current user
  const getStatusForTab = (tab: MyTicketsTab): SupportTicketStatus[] => {
    switch (tab) {
      case 'abertos':
        return ['aberto', 'em_andamento'];
      case 'aguardando':
        return ['aguardando_cliente', 'aguardando_terceiro'];
      case 'resolvidos':
        return ['resolvido', 'encerrado'];
      default:
        return ['aberto', 'em_andamento'];
    }
  };

  const {
    tickets,
    isLoading,
    refetch,
    changeStatus,
    addInternalNote,
    stats,
    isUpdating,
  } = useSupportTickets({
    filters: {
      assigned_to: userId,
      status: getStatusForTab(activeTab),
      search: searchQuery || undefined,
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

  // Calculate counts for tabs
  const openCount = tickets.filter(t => 
    t.status === 'aberto' || t.status === 'em_andamento'
  ).length;
  
  const waitingCount = tickets.filter(t => 
    t.status === 'aguardando_cliente' || t.status === 'aguardando_terceiro'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <User className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Meus Chamados</h1>
            <p className="text-muted-foreground">Chamados atribuídos a você</p>
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
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Inbox className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tickets.length}</p>
                <p className="text-xs text-muted-foreground">Total Atribuídos</p>
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
                <p className="text-xs text-muted-foreground">Em Andamento</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <Clock className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.aguardando_cliente}</p>
                <p className="text-xs text-muted-foreground">Aguardando</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sla_breach_count}</p>
                <p className="text-xs text-muted-foreground">SLA Estourado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="border-border/50">
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, assunto ou cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs and Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MyTicketsTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="abertos" className="relative">
            Em Aberto
            {stats.abertos + stats.em_andamento > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {stats.abertos + stats.em_andamento}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="aguardando">
            Aguardando
            {stats.aguardando_cliente > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {stats.aguardando_cliente}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolvidos">
            Resolvidos
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
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum chamado</h3>
                <p className="text-muted-foreground mt-1">
                  {activeTab === 'abertos' && 'Você não tem chamados em aberto no momento.'}
                  {activeTab === 'aguardando' && 'Nenhum chamado aguardando resposta.'}
                  {activeTab === 'resolvidos' && 'Nenhum chamado resolvido recentemente.'}
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
            {tickets.length} chamado{tickets.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
