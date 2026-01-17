// ============================================================================
// ASSET DETAIL PAGE
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Server,
  ArrowLeft,
  Key,
  AlertTriangle,
  Clock,
  Eye,
  EyeOff,
  Building2,
  Cpu,
  HardDrive,
  MemoryStick,
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
  getTechAsset,
  getTechCredentials,
  getIncidents,
} from '@/services/techOpsService';
import type { TechAsset, TechCredential, TechIncident, TechRole } from '@/types/techOps';
import {
  ASSET_TYPE_LABELS,
  ASSET_STATUS_LABELS,
  ASSET_STATUS_COLORS,
  ASSET_ENVIRONMENT_LABELS,
  CREDENTIAL_TYPE_LABELS,
  CREDENTIAL_VISIBILITY_LABELS,
  INCIDENT_SEVERITY_COLORS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_COLORS,
  canViewSecret,
} from '@/types/techOps';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const [asset, setAsset] = useState<TechAsset | null>(null);
  const [credentials, setCredentials] = useState<TechCredential[]>([]);
  const [incidents, setIncidents] = useState<TechIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  
  // Mock user role - in real app, get from auth context
  const userRole: TechRole = 'N3';

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const [assetData, credsData] = await Promise.all([
        getTechAsset(id!),
        getTechCredentials(id!),
      ]);
      setAsset(assetData);
      setCredentials(credsData);
      
      // Load incidents for this asset
      const incidentsData = await getIncidents();
      setIncidents(incidentsData.filter(i => i.asset_id === id));
    } catch (error) {
      console.error('Erro ao carregar asset:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar o asset', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function toggleSecretVisibility(credId: string) {
    setVisibleSecrets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(credId)) {
        newSet.delete(credId);
      } else {
        newSet.add(credId);
      }
      return newSet;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="text-center py-12">
        <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">Asset não encontrado</h2>
        <Link to="/modulos/atendimentos/suporte-tecnico/infra">
          <Button variant="outline">Voltar para lista</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/modulos/atendimentos/suporte-tecnico/infra">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline">{ASSET_TYPE_LABELS[asset.tipo]}</Badge>
            <Badge className={ASSET_STATUS_COLORS[asset.status]}>
              {ASSET_STATUS_LABELS[asset.status]}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold">{asset.identificador}</h1>
          {asset.ip_principal && (
            <p className="text-muted-foreground">IP: {asset.ip_principal}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Specs */}
          <Card>
            <CardHeader>
              <CardTitle>Especificações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {asset.cpu && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
                    <Cpu className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">CPU</p>
                      <p className="font-medium">{asset.cpu}</p>
                    </div>
                  </div>
                )}
                {asset.memoria_gb && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
                    <MemoryStick className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Memória</p>
                      <p className="font-medium">{asset.memoria_gb} GB</p>
                    </div>
                  </div>
                )}
                {asset.disco_gb && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
                    <HardDrive className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Disco</p>
                      <p className="font-medium">{asset.disco_gb} GB</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-muted-foreground">Ambiente</label>
                  <p className="font-medium">{ASSET_ENVIRONMENT_LABELS[asset.ambiente]}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Tipo</label>
                  <p className="font-medium">{ASSET_TYPE_LABELS[asset.tipo]}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credentials */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Credenciais ({credentials.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {credentials.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">Nenhuma credencial cadastrada</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Senha</TableHead>
                      <TableHead>Visibilidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credentials.map(cred => {
                      const canView = canViewSecret(userRole, cred.visibility_level);
                      const isVisible = visibleSecrets.has(cred.id);
                      
                      return (
                        <TableRow key={cred.id}>
                          <TableCell>
                            <Badge variant="outline">
                              {CREDENTIAL_TYPE_LABELS[cred.cred_type]}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{cred.username}</TableCell>
                          <TableCell>
                            {canView ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono">
                                  {isVisible ? (cred.secret_value || cred.secret_ref || '***') : '••••••••'}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => toggleSecretVisibility(cred.id)}
                                >
                                  {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Sem permissão</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {CREDENTIAL_VISIBILITY_LABELS[cred.visibility_level]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Incidents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Incidentes Relacionados
              </CardTitle>
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

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Client */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {asset.client ? (
                <Link
                  to={`/modulos/atendimentos/suporte-tecnico/clientes/${asset.client_id}`}
                  className="hover:underline"
                >
                  <p className="font-medium">{asset.client.nome_fantasia || asset.client.razao_social}</p>
                </Link>
              ) : (
                <p className="text-muted-foreground">Cliente não encontrado</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
