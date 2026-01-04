import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTickets } from '@/hooks/useTickets';
import { TicketCard } from '@/components/tickets/TicketCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  Search, 
  Wrench,
  AlertTriangle,
  Clock,
  Filter
} from 'lucide-react';
import { Ticket } from '@/types/ticket';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function FilaSuporte() {
  const navigate = useNavigate();
  const { tickets, refreshSuporte } = useTickets();
  const [searchQuery, setSearchQuery] = useState('');
  const [displayTickets, setDisplayTickets] = useState<Ticket[]>([]);
  const [filterCategoria, setFilterCategoria] = useState<string>('todas');
  const [filterPrioridade, setFilterPrioridade] = useState<string>('todos');

  useEffect(() => {
    refreshSuporte();
  }, []);

  useEffect(() => {
    let filtered = tickets.filter(t => 
      t.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.empresa.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filterCategoria !== 'todas') {
      filtered = filtered.filter(t => t.categoria === filterCategoria);
    }

    if (filterPrioridade !== 'todos') {
      filtered = filtered.filter(t => t.prioridade === filterPrioridade);
    }

    setDisplayTickets(filtered);
  }, [tickets, searchQuery, filterCategoria, filterPrioridade]);

  const handleViewTicket = (id: string) => {
    navigate(`/atendimentos/${id}`);
  };

  // Stats para Suporte
  const stats = {
    novos: tickets.filter(t => t.status === 'novo').length,
    emAtendimento: tickets.filter(t => t.status === 'em_atendimento').length,
    criticos: tickets.filter(t => t.prioridade === 'critica').length,
    altaPrioridade: tickets.filter(t => t.prioridade === 'alta').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Wrench className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Fila de Suporte</h1>
            <p className="text-muted-foreground">Gerenciamento de tickets técnicos</p>
          </div>
        </div>
        <Button onClick={() => navigate('/atendimentos/novo')}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Ticket
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
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
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emAtendimento}</p>
                <p className="text-xs text-muted-foreground">Em Atendimento</p>
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
                <p className="text-2xl font-bold">{stats.criticos}</p>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.altaPrioridade}</p>
                <p className="text-xs text-muted-foreground">Alta Prioridade</p>
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
                placeholder="Buscar por ID, título ou empresa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="incidente">Incidente</SelectItem>
                  <SelectItem value="requisicao">Requisição</SelectItem>
                  <SelectItem value="problema">Problema</SelectItem>
                  <SelectItem value="mudanca">Mudança</SelectItem>
                  <SelectItem value="projeto">Projeto</SelectItem>
                  <SelectItem value="duvida">Dúvida</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          {displayTickets.length === 0 ? (
            <div className="py-12 text-center">
              <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum ticket encontrado</h3>
              <p className="text-muted-foreground mt-1">
                Não há tickets na fila de suporte no momento.
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/atendimentos/novo')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Novo Ticket
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {displayTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onView={handleViewTicket}
                  variant="suporte"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer count */}
      {displayTickets.length > 0 && (
        <div className="flex justify-center">
          <span className="text-sm text-muted-foreground bg-muted px-4 py-2 rounded-full">
            {displayTickets.length} ticket{displayTickets.length !== 1 ? 's' : ''} na fila de suporte
          </span>
        </div>
      )}
    </div>
  );
}
