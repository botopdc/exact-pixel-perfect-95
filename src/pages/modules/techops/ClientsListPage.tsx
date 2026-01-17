// ============================================================================
// CLIENTS LIST PAGE
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  Server,
  AlertTriangle,
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
import { ModuleHeader } from '@/components/navigation/ModuleCard';
import { getTechClients, getTechAssets, getIncidents } from '@/services/techOpsService';
import type { TechClient, ClientStatus, SLALevel } from '@/types/techOps';
import {
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_COLORS,
  SLA_LEVEL_LABELS,
  SLA_LEVEL_COLORS,
} from '@/types/techOps';

export default function ClientsListPage() {
  const [clients, setClients] = useState<TechClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
  const [slaFilter, setSlaFilter] = useState<SLALevel | 'all'>('all');
  const [assetCounts, setAssetCounts] = useState<Record<string, number>>({});
  const [incidentCounts, setIncidentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, [statusFilter, slaFilter]);

  async function loadData() {
    try {
      setLoading(true);
      const filters: { status?: ClientStatus; sla_level?: SLALevel } = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (slaFilter !== 'all') filters.sla_level = slaFilter;
      
      const [clientsData, assetsData, incidentsData] = await Promise.all([
        getTechClients(filters),
        getTechAssets(),
        getIncidents(),
      ]);
      
      setClients(clientsData);
      
      // Count assets per client
      const assetCountMap: Record<string, number> = {};
      assetsData.forEach(asset => {
        assetCountMap[asset.client_id] = (assetCountMap[asset.client_id] || 0) + 1;
      });
      setAssetCounts(assetCountMap);
      
      // Count active incidents per client
      const incidentCountMap: Record<string, number> = {};
      incidentsData
        .filter(i => !['RESOLVIDO', 'ENCERRADO'].includes(i.status))
        .forEach(incident => {
          incidentCountMap[incident.client_id] = (incidentCountMap[incident.client_id] || 0) + 1;
        });
      setIncidentCounts(incidentCountMap);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredClients = clients.filter((client) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      client.razao_social.toLowerCase().includes(query) ||
      client.nome_fantasia?.toLowerCase().includes(query) ||
      client.segmento?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Clientes"
        description="Gestão de clientes e suas infraestruturas"
        icon={Building2}
        actions={
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, razão social..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ClientStatus | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ATIVO">Ativo</SelectItem>
            <SelectItem value="SUSPENSO">Suspenso</SelectItem>
            <SelectItem value="ENCERRADO">Encerrado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={slaFilter} onValueChange={(v) => setSlaFilter(v as SLALevel | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="SLA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os SLAs</SelectItem>
            <SelectItem value="PADRAO">Padrão</SelectItem>
            <SelectItem value="PREMIUM">Premium</SelectItem>
            <SelectItem value="CRITICO">Crítico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Segmento</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead>Incidentes Ativos</TableHead>
              <TableHead>CS Manager</TableHead>
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
            ) : filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum cliente encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow key={client.id} className="cursor-pointer hover:bg-accent/50">
                  <TableCell>
                    <Link
                      to={`/modulos/atendimentos/suporte-tecnico/clientes/${client.id}`}
                      className="font-medium hover:underline"
                    >
                      {client.nome_fantasia || client.razao_social}
                    </Link>
                    {client.nome_fantasia && (
                      <p className="text-xs text-muted-foreground">{client.razao_social}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={CLIENT_STATUS_COLORS[client.status]}>
                      {CLIENT_STATUS_LABELS[client.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={SLA_LEVEL_COLORS[client.sla_level]}>
                      {SLA_LEVEL_LABELS[client.sla_level]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {client.segmento || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Server className="h-3 w-3 text-muted-foreground" />
                      <span>{assetCounts[client.id] || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {incidentCounts[client.id] ? (
                      <div className="flex items-center gap-1 text-orange-500">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{incidentCounts[client.id]}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.cs_manager?.name || <span className="text-muted-foreground">-</span>}
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
