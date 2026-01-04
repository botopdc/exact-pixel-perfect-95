import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTickets } from '@/hooks/useTickets';
import { TicketCard } from '@/components/tickets/TicketCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  Search, 
  Headphones, 
  Heart,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3
} from 'lucide-react';
import { 
  STATUS_LABELS, 
  PRIORIDADE_LABELS,
  Ticket 
} from '@/types/ticket';

export default function Atendimentos() {
  const navigate = useNavigate();
  const { tickets, refreshSuporte, refreshCS, refresh } = useTickets();
  const [activeTab, setActiveTab] = useState<'suporte' | 'cs'>('suporte');
  const [searchQuery, setSearchQuery] = useState('');
  const [displayTickets, setDisplayTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    if (activeTab === 'suporte') {
      refreshSuporte();
    } else {
      refreshCS();
    }
  }, [activeTab]);

  useEffect(() => {
    // Filter tickets based on search
    const filtered = tickets.filter(t => 
      t.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.empresa.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setDisplayTickets(filtered);
  }, [tickets, searchQuery]);

  const handleViewTicket = (id: string) => {
    navigate(`/atendimentos/${id}`);
  };

  // Stats
  const stats = {
    novos: tickets.filter(t => t.status === 'novo').length,
    emAtendimento: tickets.filter(t => t.status === 'em_atendimento').length,
    criticos: tickets.filter(t => t.prioridade === 'critica' || t.prioridade === 'alta').length,
    resolvidos: tickets.filter(t => t.status === 'resolvido_tecnico' || t.status === 'encerrado').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Atendimentos</h1>
          <p className="text-muted-foreground">Gerencie chamados técnicos e de relacionamento</p>
        </div>
        <Button onClick={() => navigate('/atendimentos/novo')}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Ticket
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.novos}</p>
                <p className="text-xs text-muted-foreground">Novos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emAtendimento}</p>
                <p className="text-xs text-muted-foreground">Em Atendimento</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.criticos}</p>
                <p className="text-xs text-muted-foreground">Alta Prioridade</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.resolvidos}</p>
                <p className="text-xs text-muted-foreground">Resolvidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título, ID ou empresa..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs: Suporte / CS */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'suporte' | 'cs')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="suporte" className="flex items-center gap-2">
            <Headphones className="h-4 w-4" />
            Suporte
          </TabsTrigger>
          <TabsTrigger value="cs" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Customer Success
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suporte" className="mt-4 space-y-3">
          {displayTickets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Headphones className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum ticket na fila</h3>
                <p className="text-muted-foreground mt-1">
                  Os tickets do Suporte aparecerão aqui
                </p>
              </CardContent>
            </Card>
          ) : (
            displayTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onView={handleViewTicket}
                variant="suporte"
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="cs" className="mt-4 space-y-3">
          {displayTickets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum ticket para validação</h3>
                <p className="text-muted-foreground mt-1">
                  Os tickets resolvidos pelo Suporte aparecerão aqui para validação do CS
                </p>
              </CardContent>
            </Card>
          ) : (
            displayTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onView={handleViewTicket}
                variant="cs"
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
