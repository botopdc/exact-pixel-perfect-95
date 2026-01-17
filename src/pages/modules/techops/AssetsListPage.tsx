// ============================================================================
// ASSETS LIST PAGE (INFRA)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Server,
  Plus,
  Search,
  Building2,
  Key,
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
import { getTechAssets, getTechCredentials } from '@/services/techOpsService';
import type { TechAsset, AssetType, AssetStatus } from '@/types/techOps';
import {
  ASSET_TYPE_LABELS,
  ASSET_STATUS_LABELS,
  ASSET_STATUS_COLORS,
  ASSET_ENVIRONMENT_LABELS,
} from '@/types/techOps';

export default function AssetsListPage() {
  const [assets, setAssets] = useState<TechAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [credentialCounts, setCredentialCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, [typeFilter, statusFilter]);

  async function loadData() {
    try {
      setLoading(true);
      const filters: { tipo?: AssetType; status?: AssetStatus } = {};
      if (typeFilter !== 'all') filters.tipo = typeFilter;
      if (statusFilter !== 'all') filters.status = statusFilter;
      
      const assetsData = await getTechAssets(filters);
      setAssets(assetsData);
      
      // Count credentials per asset
      const credCountMap: Record<string, number> = {};
      for (const asset of assetsData) {
        try {
          const creds = await getTechCredentials(asset.id);
          credCountMap[asset.id] = creds.length;
        } catch {
          credCountMap[asset.id] = 0;
        }
      }
      setCredentialCounts(credCountMap);
    } catch (error) {
      console.error('Erro ao carregar assets:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredAssets = assets.filter((asset) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      asset.identificador.toLowerCase().includes(query) ||
      asset.ip_principal?.toLowerCase().includes(query) ||
      asset.client?.razao_social?.toLowerCase().includes(query) ||
      asset.client?.nome_fantasia?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Infraestrutura (Assets)"
        description="Gestão de ativos de infraestrutura"
        icon={Server}
        actions={
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Novo Asset
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por identificador, IP, cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as AssetType | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="VM">Virtual Machine</SelectItem>
            <SelectItem value="BAREMETAL">Bare Metal</SelectItem>
            <SelectItem value="GPU">GPU Server</SelectItem>
            <SelectItem value="KUBERNETES">Kubernetes</SelectItem>
            <SelectItem value="STORAGE">Storage</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AssetStatus | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ATIVO">Ativo</SelectItem>
            <SelectItem value="MANUTENCAO">Em Manutenção</SelectItem>
            <SelectItem value="DESLIGADO">Desligado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Identificador</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Ambiente</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Credenciais</TableHead>
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
            ) : filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum asset encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => (
                <TableRow key={asset.id} className="cursor-pointer hover:bg-accent/50">
                  <TableCell>
                    <Link
                      to={`/modulos/atendimentos/suporte-tecnico/infra/${asset.id}`}
                      className="font-medium hover:underline"
                    >
                      {asset.identificador}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{ASSET_TYPE_LABELS[asset.tipo]}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">
                        {asset.client?.nome_fantasia || asset.client?.razao_social || '-'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {ASSET_ENVIRONMENT_LABELS[asset.ambiente]}
                  </TableCell>
                  <TableCell>
                    {asset.ip_principal || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <Badge className={ASSET_STATUS_COLORS[asset.status]}>
                      {ASSET_STATUS_LABELS[asset.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Key className="h-3 w-3 text-muted-foreground" />
                      <span>{credentialCounts[asset.id] || 0}</span>
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
