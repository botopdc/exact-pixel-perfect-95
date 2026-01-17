// ============================================================================
// INCIDENTS LIST PAGE
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Clock,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ModuleHeader, SectionTitle } from '@/components/navigation/ModuleCard';
import { getIncidents } from '@/services/techOpsService';
import type { TechIncident, IncidentStatus, IncidentSeverity } from '@/types/techOps';
import {
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_SEVERITY_COLORS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_COLORS,
  INCIDENT_TYPE_LABELS,
} from '@/types/techOps';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function IncidentsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [incidents, setIncidents] = useState<TechIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | 'all'>('all');

  useEffect(() => {
    loadIncidents();
  }, [statusFilter, severityFilter]);

  async function loadIncidents() {
    try {
      setLoading(true);
      const filters: { status?: IncidentStatus; severidade?: IncidentSeverity } = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (severityFilter !== 'all') filters.severidade = severityFilter;
      
      const data = await getIncidents(filters);
      setIncidents(data);
    } catch (error) {
      console.error('Erro ao carregar incidentes:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredIncidents = incidents.filter((incident) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      incident.title.toLowerCase().includes(query) ||
      incident.client?.razao_social?.toLowerCase().includes(query) ||
      incident.client?.nome_fantasia?.toLowerCase().includes(query) ||
      incident.asset?.identificador?.toLowerCase().includes(query) ||
      incident.asset?.ip_principal?.toLowerCase().includes(query) ||
      incident.id.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Incidentes"
        description="Lista de todos os incidentes registrados"
        icon={AlertTriangle}
        actions={
          <Link to="/modulos/atendimentos/suporte-tecnico/incidentes/criar">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Incidente
            </Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, cliente, IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as IncidentStatus | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ABERTO">Aberto</SelectItem>
            <SelectItem value="CLASSIFICADO">Classificado</SelectItem>
            <SelectItem value="EM_ATENDIMENTO">Em Atendimento</SelectItem>
            <SelectItem value="ESCALADO">Escalado</SelectItem>
            <SelectItem value="RESOLVIDO">Resolvido</SelectItem>
            <SelectItem value="ENCERRADO">Encerrado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as IncidentSeverity | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas severidades</SelectItem>
            <SelectItem value="S1">S1 - Crítico</SelectItem>
            <SelectItem value="S2">S2 - Alto</SelectItem>
            <SelectItem value="S3">S3 - Médio</SelectItem>
            <SelectItem value="S4">S4 - Baixo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Severidade</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Abertura</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredIncidents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum incidente encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredIncidents.map((incident) => (
                <TableRow key={incident.id} className="cursor-pointer hover:bg-accent/50">
                  <TableCell>
                    <Badge className={INCIDENT_SEVERITY_COLORS[incident.severidade]}>
                      {incident.severidade}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/modulos/atendimentos/suporte-tecnico/incidentes/${incident.id}`}
                      className="font-medium hover:underline"
                    >
                      {incident.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {INCIDENT_TYPE_LABELS[incident.tipo]}
                    </p>
                  </TableCell>
                  <TableCell>
                    {incident.client?.nome_fantasia || incident.client?.razao_social || '-'}
                  </TableCell>
                  <TableCell>
                    {incident.asset ? (
                      <span className="text-sm">
                        {incident.asset.identificador}
                        {incident.asset.ip_principal && (
                          <span className="text-muted-foreground ml-1">
                            ({incident.asset.ip_principal})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={INCIDENT_STATUS_COLORS[incident.status]}>
                      {INCIDENT_STATUS_LABELS[incident.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {incident.owner ? (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="text-sm">{incident.owner.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Não atribuído</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(incident.opened_at), { addSuffix: true, locale: ptBR })}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
