// ============================================================================
// CLIENT DETAIL PAGE
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Building2,
  ArrowLeft,
  Server,
  AlertTriangle,
  Clock,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/hooks/use-toast';
import {
  getTechClient,
  getTechAssets,
  getIncidents,
} from '@/services/techOpsService';
import type { TechClient, TechAsset, TechIncident } from '@/types/techOps';
import {
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_COLORS,
  SLA_LEVEL_LABELS,
  SLA_LEVEL_COLORS,
  ASSET_TYPE_LABELS,
  ASSET_STATUS_COLORS,
  INCIDENT_SEVERITY_COLORS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_COLORS,
} from '@/types/techOps';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const [client, setClient] = useState<TechClient | null>(null);
  const [assets, setAssets] = useState<TechAsset[]>([]);
  const [incidents, setIncidents] = useState<TechIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const [clientData, assetsData, incidentsData] = await Promise.all([
        getTechClient(id!),
        getTechAssets({ client_id: id! }),
        getIncidents({ client_id: id! }),
      ]);
      setClient(clientData);
      setAssets(assetsData);
      setIncidents(incidentsData);
    } catch (error) {
      console.error('Erro ao carregar cliente:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar o cliente', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">Cliente não encontrado</h2>
        <Link to="/modulos/atendimentos/suporte-tecnico/clientes">
          <Button variant="outline">Voltar para lista</Button>
        </Link>
      </div>
    );
  }

  const activeIncidents = incidents.filter(i => !['RESOLVIDO', 'ENCERRADO'].includes(i.status));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/modulos/atendimentos/suporte-tecnico/clientes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Badge className={CLIENT_STATUS_COLORS[client.status]}>
              {CLIENT_STATUS_LABELS[client.status]}
            </Badge>
            <Badge variant="outline" className={SLA_LEVEL_COLORS[client.sla_level]}>
              {SLA_LEVEL_LABELS[client.sla_level]}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold">{client.nome_fantasia || client.razao_social}</h1>
          {client.nome_fantasia && (
            <p className="text-muted-foreground">{client.razao_social}</p>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Server className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{assets.length}</p>
                <p className="text-sm text-muted-foreground">Assets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{activeIncidents.length}</p>
                <p className="text-sm text-muted-foreground">Incidentes Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <User className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">{client.cs_manager?.name || 'Não atribuído'}</p>
                <p className="text-sm text-muted-foreground">CS Manager</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-muted-foreground">Razão Social</label>
            <p className="font-medium">{client.razao_social}</p>
          </div>
          {client.nome_fantasia && (
            <div>
              <label className="text-sm text-muted-foreground">Nome Fantasia</label>
              <p className="font-medium">{client.nome_fantasia}</p>
            </div>
          )}
          <div>
            <label className="text-sm text-muted-foreground">Segmento</label>
            <p className="font-medium">{client.segmento || '-'}</p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">SLA</label>
            <p className="font-medium">{SLA_LEVEL_LABELS[client.sla_level]}</p>
          </div>
        </CardContent>
      </Card>

      {/* Assets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Assets ({assets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">Nenhum asset cadastrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identificador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map(asset => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <Link
                        to={`/modulos/atendimentos/suporte-tecnico/infra/${asset.id}`}
                        className="font-medium hover:underline"
                      >
                        {asset.identificador}
                      </Link>
                    </TableCell>
                    <TableCell>{ASSET_TYPE_LABELS[asset.tipo]}</TableCell>
                    <TableCell>{asset.ip_principal || '-'}</TableCell>
                    <TableCell>
                      <Badge className={ASSET_STATUS_COLORS[asset.status]}>
                        {asset.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Incidents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Incidentes Recentes
          </CardTitle>
          <Link to={`/modulos/atendimentos/suporte-tecnico/incidentes?client=${id}`}>
            <Button variant="ghost" size="sm">Ver todos</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">Nenhum incidente registrado</p>
          ) : (
            <div className="space-y-3">
              {incidents.slice(0, 5).map(incident => (
                <Link
                  key={incident.id}
                  to={`/modulos/atendimentos/suporte-tecnico/incidentes/${incident.id}`}
                  className="block p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={INCIDENT_SEVERITY_COLORS[incident.severidade]}>
                          {incident.severidade}
                        </Badge>
                        <Badge variant="outline" className={INCIDENT_STATUS_COLORS[incident.status]}>
                          {INCIDENT_STATUS_LABELS[incident.status]}
                        </Badge>
                      </div>
                      <p className="font-medium truncate">{incident.title}</p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {formatDistanceToNow(new Date(incident.opened_at), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
