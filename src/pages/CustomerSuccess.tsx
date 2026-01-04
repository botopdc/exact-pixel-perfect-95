import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTickets } from '@/hooks/useTickets';
import { TicketCard } from '@/components/tickets/TicketCard';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  Users,
  Clock,
  CheckCircle2,
  CheckCircle,
  AlertCircle,
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

export default function CustomerSuccess() {
  const navigate = useNavigate();
  const { tickets, refreshCS } = useTickets();
  const [searchQuery, setSearchQuery] = useState('');
  const [displayTickets, setDisplayTickets] = useState<Ticket[]>([]);
  const [filterCategoria, setFilterCategoria] = useState<string>('todas');
  const [filterTipoDemanda, setFilterTipoDemanda] = useState<string>('todos');

  useEffect(() => {
    refreshCS();
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

    if (filterTipoDemanda !== 'todos') {
      filtered = filtered.filter(t => t.tipo_demanda === filterTipoDemanda);
    }

    setDisplayTickets(filtered);
  }, [tickets, searchQuery, filterCategoria, filterTipoDemanda]);

  const handleViewTicket = (id: string) => {
    navigate(`/atendimentos/${id}`);
  };

  // Stats para CS
  const stats = {
    aguardandoValidacao: tickets.filter(t => t.status === 'validacao_cs').length,
    resolvidosTecnico: tickets.filter(t => t.status === 'resolvido_tecnico').length,
    encerrados: tickets.filter(t => t.status === 'encerrado').length,
    clientesCriticos: tickets.filter(t => t.prioridade === 'critica' || t.prioridade === 'alta').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="h-7 w-7 text-purple-400" />
        <div>
          <h1 className="text-2xl font-bold">Customer Success</h1>
          <p className="text-muted-foreground">Validação de impacto e relacionamento com cliente</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Clock className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.aguardandoValidacao}</p>
                <p className="text-xs text-muted-foreground">Aguardando Validação</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.resolvidosTecnico}</p>
                <p className="text-xs text-muted-foreground">Resolvidos (Técnico)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <CheckCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.encerrados}</p>
                <p className="text-xs text-muted-foreground">Encerrados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <AlertCircle className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.clientesCriticos}</p>
                <p className="text-xs text-muted-foreground">Clientes Críticos</p>
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
              <Select value={filterTipoDemanda} onValueChange={setFilterTipoDemanda}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                  <SelectItem value="comunicacao">Comunicação</SelectItem>
                  <SelectItem value="risco">Risco</SelectItem>
                  <SelectItem value="expansao">Expansão</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
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
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum ticket para validação</h3>
              <p className="text-muted-foreground mt-1">
                Os tickets resolvidos pelo Suporte aparecerão aqui para validação.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onView={handleViewTicket}
                  variant="cs"
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
            {displayTickets.length} ticket{displayTickets.length !== 1 ? 's' : ''} na visão CS
          </span>
        </div>
      )}
    </div>
  );
}
