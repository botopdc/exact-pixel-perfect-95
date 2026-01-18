// ============================================================================
// ANALISTAS PAGE - Gestão do time de suporte (similar a Executivos)
// ============================================================================

import React, { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users,
  HeadphonesIcon,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Clock,
  Timer,
  ArrowUpDown,
  Eye,
  ExternalLink,
  Mail,
  X,
} from 'lucide-react';

import { ModuleHeader, KPICard, SectionTitle } from '@/components/navigation/ModuleCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useAnalistas, AnalistaData, LevelFilter, SortField } from '@/hooks/useAnalistas';
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
} from '@/types/internalTicket';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AnalistasPage() {
  const {
    analistas,
    kpis,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    levelFilter,
    setLevelFilter,
    sortField,
    sortAsc,
    toggleSort,
    refresh,
    getAnalistaTickets,
    getTempoMedioResposta,
  } = useAnalistas();

  const [selectedAnalista, setSelectedAnalista] = useState<AnalistaData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleOpenDrawer = (analista: AnalistaData) => {
    setSelectedAnalista(analista);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedAnalista(null);
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Analistas de Suporte"
        description="Gestão do time de suporte técnico e atendimento"
        icon={HeadphonesIcon}
        actions={
          <Button variant="outline" onClick={refresh} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
        }
      />

      {/* KPIs Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Analistas Ativos"
          value={loading ? '...' : kpis.analistas_ativos.toString()}
          description="Disponíveis para atendimento"
          icon={Users}
        />
        <KPICard
          title="Chamados na Fila"
          value={loading ? '...' : kpis.chamados_fila.toString()}
          description="Aguardando triagem"
          icon={Clock}
          className={kpis.chamados_fila > 0 ? 'border-blue-500/30' : ''}
        />
        <KPICard
          title="Em Atendimento"
          value={loading ? '...' : kpis.em_atendimento.toString()}
          description="Sendo tratados agora"
          icon={Timer}
          className={kpis.em_atendimento > 0 ? 'border-yellow-500/30' : ''}
        />
        <KPICard
          title="SLA em Risco"
          value={loading ? '...' : kpis.sla_risco.toString()}
          description="Prioridade máxima"
          icon={AlertTriangle}
          className={kpis.sla_risco > 0 ? 'border-red-500/30' : ''}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={levelFilter}
              onValueChange={(v) => setLevelFilter(v as LevelFilter)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="900">Suporte (900)</SelectItem>
                <SelectItem value="950">Gerente de Suporte (950)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Analistas Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Equipe de Suporte ({analistas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive opacity-50" />
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button variant="outline" onClick={refresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          ) : analistas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum analista encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortButton
                        label="Analista"
                        field="name"
                        currentField={sortField}
                        asc={sortAsc}
                        onClick={() => toggleSort('name')}
                      />
                    </TableHead>
                    <TableHead>ID/Nível</TableHead>
                    <TableHead>
                      <SortButton
                        label="Atribuídos"
                        field="atribuidos"
                        currentField={sortField}
                        asc={sortAsc}
                        onClick={() => toggleSort('atribuidos')}
                      />
                    </TableHead>
                    <TableHead>Em Atend.</TableHead>
                    <TableHead>Dentro SLA</TableHead>
                    <TableHead>
                      <SortButton
                        label="Fora SLA"
                        field="fora_sla"
                        currentField={sortField}
                        asc={sortAsc}
                        onClick={() => toggleSort('fora_sla')}
                      />
                    </TableHead>
                    <TableHead>
                      <SortButton
                        label="Última Atividade"
                        field="ultima_atividade"
                        currentField={sortField}
                        asc={sortAsc}
                        onClick={() => toggleSort('ultima_atividade')}
                      />
                    </TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analistas.map((analista) => (
                    <TableRow
                      key={analista.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOpenDrawer(analista)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{analista.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            analista.level === 950
                              ? 'bg-purple-500/20 text-purple-400 border-purple-500/50'
                              : 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                          }
                        >
                          {analista.level === 950 ? 'Gerente' : 'Suporte'} ({analista.level})
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{analista.stats.atribuidos}</span>
                      </TableCell>
                      <TableCell>
                        <span className={analista.stats.em_atendimento > 0 ? 'text-yellow-500' : ''}>
                          {analista.stats.em_atendimento}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-green-500">{analista.stats.dentro_sla}</span>
                      </TableCell>
                      <TableCell>
                        <span className={analista.stats.fora_sla > 0 ? 'text-red-500 font-medium' : ''}>
                          {analista.stats.fora_sla}
                        </span>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              {analista.stats.ultima_atividade ? (
                                <span className="text-muted-foreground">
                                  {formatDistanceToNow(new Date(analista.stats.ultima_atividade), {
                                    addSuffix: true,
                                    locale: ptBR,
                                  })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              {analista.stats.ultima_atividade
                                ? format(new Date(analista.stats.ultima_atividade), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                                : 'Sem dados disponíveis'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDrawer(analista);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer do Analista */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedAnalista && (
            <AnalistaDrawer
              analista={selectedAnalista}
              tickets={getAnalistaTickets(selectedAnalista.id)}
              tempoMedio={getTempoMedioResposta(selectedAnalista.id)}
              onClose={handleCloseDrawer}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ============================================================================
// SORT BUTTON COMPONENT
// ============================================================================

interface SortButtonProps {
  label: string;
  field: SortField;
  currentField: SortField;
  asc: boolean;
  onClick: () => void;
}

function SortButton({ label, field, currentField, asc, onClick }: SortButtonProps) {
  const isActive = field === currentField;
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={onClick}
    >
      {label}
      <ArrowUpDown
        className={`h-3 w-3 ${isActive ? 'text-primary' : 'text-muted-foreground/50'}`}
      />
    </button>
  );
}

// ============================================================================
// ANALISTA DRAWER COMPONENT
// ============================================================================

interface AnalistaDrawerProps {
  analista: AnalistaData;
  tickets: any[];
  tempoMedio: string | null;
  onClose: () => void;
}

function AnalistaDrawer({ analista, tickets, tempoMedio, onClose }: AnalistaDrawerProps) {
  const openTickets = tickets.filter((t) => !['resolvido', 'encerrado'].includes(t.status));
  const recentTickets = [...tickets]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          {analista.name}
        </SheetTitle>
        <SheetDescription className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          {analista.email}
          <Badge
            variant="outline"
            className={
              analista.level === 950
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/50'
                : 'bg-blue-500/20 text-blue-400 border-blue-500/50'
            }
          >
            Level {analista.level}
          </Badge>
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{analista.stats.atribuidos}</p>
              <p className="text-xs text-muted-foreground">Atribuídos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-500">{analista.stats.em_atendimento}</p>
              <p className="text-xs text-muted-foreground">Em Atendimento</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{analista.stats.fora_sla}</p>
              <p className="text-xs text-muted-foreground">Fora do SLA</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{tempoMedio || '—'}</p>
              <p className="text-xs text-muted-foreground">Tempo Médio 1ª Resp.</p>
              {!tempoMedio && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="text-xs text-muted-foreground/50 cursor-help">(sem dados)</span>
                    </TooltipTrigger>
                    <TooltipContent>Sem dados disponíveis</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Tickets */}
        <div>
          <SectionTitle
            title="Últimos Chamados"
            description={`${recentTickets.length} chamado(s) mais recentes`}
          />
          {recentTickets.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhum chamado atribuído
            </p>
          ) : (
            <div className="space-y-2 mt-3">
              {recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/modulos/atendimentos/interno/${ticket.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-primary">
                      {ticket.code || ticket.id.slice(0, 12)}
                    </span>
                    <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
                      {TICKET_STATUS_LABELS[ticket.status]}
                    </Badge>
                  </div>
                  <p className="text-sm truncate mt-1">{ticket.title}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>
                      {formatDistanceToNow(new Date(ticket.updated_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                    {ticket.sla_breached && (
                      <Badge variant="destructive" className="text-xs">
                        SLA
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Action Button */}
        <Link
          to={`/modulos/atendimentos/interno?assignee=${analista.id}`}
          className="block"
        >
          <Button className="w-full" variant="outline">
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver chamados filtrados
          </Button>
        </Link>
      </div>
    </>
  );
}
