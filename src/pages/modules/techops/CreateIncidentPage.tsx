// ============================================================================
// CREATE INCIDENT PAGE
// ============================================================================

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  getTechAssets,
  createIncident,
} from '@/services/techOpsService';
import type { TechAsset, IncidentOrigin, IncidentType, IncidentSeverity, SLALevel } from '@/types/techOps';
import {
  INCIDENT_ORIGIN_LABELS,
  INCIDENT_TYPE_LABELS,
  INCIDENT_SEVERITY_LABELS,
} from '@/types/techOps';
import { useOpenApiClients } from '@/hooks/useOpenApiClients';
import type { ApiUser } from '@/lib/openApi';

export default function CreateIncidentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  // Get pre-selected client from URL params (from Clients list page)
  const preSelectedClientId = searchParams.get('client_user_id');
  
  // Fetch clients from OPEN API (level=1)
  const { clients, loading: clientsLoading, error: clientsError, refresh: refreshClients } = useOpenApiClients();
  
  const [assets, setAssets] = useState<TechAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state - use undefined instead of '' for Select components
  const [clientUserId, setClientUserId] = useState<string | undefined>(undefined);
  const [assetId, setAssetId] = useState<string | undefined>(undefined);
  const [originChannel, setOriginChannel] = useState<IncidentOrigin>('PORTAL_INTERNO');
  const [tipo, setTipo] = useState<IncidentType>('QUEDA');
  const [severidade, setSeveridade] = useState<IncidentSeverity>('S4');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Client search filter
  const [clientSearch, setClientSearch] = useState('');

  // Selected client from OPEN API
  const selectedClient = useMemo(() => {
    if (!clientUserId) return null;
    return clients.find(c => String(c.id) === clientUserId) || null;
  }, [clientUserId, clients]);

  // Filtered clients for search
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const search = clientSearch.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(search) ||
      c.email.toLowerCase().includes(search)
    );
  }, [clients, clientSearch]);

  // Pre-select client from URL param when clients are loaded
  useEffect(() => {
    if (preSelectedClientId && clients.length > 0 && !clientUserId) {
      const clientExists = clients.find(c => String(c.id) === preSelectedClientId);
      if (clientExists) {
        setClientUserId(preSelectedClientId);
      }
    }
  }, [preSelectedClientId, clients, clientUserId]);

  // Load assets when client changes (still from Supabase for infra)
  useEffect(() => {
    // Assets are tied to tech_clients in Supabase, not OPEN API users
    // For now, clear assets when client changes - in future, link via client_user_id
    setAssets([]);
    setAssetId(undefined);
  }, [clientUserId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!clientUserId || !title.trim()) {
      toast({ title: 'Erro', description: 'Cliente e título são obrigatórios', variant: 'destructive' });
      return;
    }

    try {
      setSubmitting(true);
      
      // Default SLA level (no tech_client linked yet)
      const slaLevel: SLALevel = 'PADRAO';
      
      // Create incident with client_user_id as reference to OPEN API user
      // Note: client_id field in tech_incidents expects UUID from tech_clients table
      // For now, we need to create/link a tech_client or use a placeholder approach
      // TODO: Implement proper tech_client creation/linking from OPEN API user
      
      // For MVP, we'll need to handle this - storing client info differently
      // Since createIncident expects client_id as UUID referencing tech_clients,
      // we need to either:
      // 1. Create a tech_client entry for this OPEN API user
      // 2. Modify the incident schema to accept external client references
      
      // For now, show error that this needs backend adjustment
      toast({ 
        title: 'Funcionalidade em desenvolvimento', 
        description: 'Integração com clientes OPEN API requer ajustes no backend de incidentes.', 
        variant: 'destructive' 
      });
      
      // Uncomment when backend is ready:
      // const incident = await createIncident({
      //   client_id: clientUserId, // Would need schema change
      //   asset_id: assetId || null,
      //   origin_channel: originChannel,
      //   tipo,
      //   severidade,
      //   sla_level_aplicado: slaLevel,
      //   title: title.trim(),
      //   description: description.trim() || null,
      // });
      // navigate(`/modulos/atendimentos/suporte-tecnico/incidentes/${incident.id}`);
      
    } catch (error) {
      console.error('Erro ao criar incidente:', error);
      toast({ title: 'Erro', description: 'Não foi possível criar o incidente', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/modulos/atendimentos/suporte-tecnico/incidentes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Criar Incidente</h1>
          <p className="text-muted-foreground">Registrar novo incidente técnico</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client & Asset */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Cliente e Infraestrutura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="client">Cliente *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => refreshClients()}
                  disabled={clientsLoading}
                >
                  <RefreshCw className={`h-3 w-3 ${clientsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              
              {/* Client search input */}
              <Input
                placeholder="Buscar cliente por nome ou email..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="mb-2"
              />
              
              <Select 
                value={clientUserId ?? ''} 
                onValueChange={(v) => setClientUserId(v || undefined)}
                disabled={clientsLoading || !!clientsError}
              >
                <SelectTrigger>
                  {clientsLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando clientes...
                    </div>
                  ) : clientsError ? (
                    <span className="text-destructive">Erro ao carregar clientes</span>
                  ) : (
                    <SelectValue placeholder="Selecione o cliente" />
                  )}
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {filteredClients.map(client => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.name}{client.email ? ` — ${client.email}` : ''}
                    </SelectItem>
                  ))}
                  {filteredClients.length === 0 && !clientsLoading && (
                    <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                      {clientSearch ? 'Nenhum cliente encontrado' : 'Nenhum cliente disponível'}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedClient && (
              <div className="p-3 rounded-lg bg-accent/30">
                <p className="text-sm">
                  <strong>Cliente:</strong> {selectedClient.name}
                </p>
                {selectedClient.email && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Email:</strong> {selectedClient.email}
                  </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="asset">Asset (opcional)</Label>
              <Select 
                value={assetId ?? '__none__'} 
                onValueChange={(v) => setAssetId(v === '__none__' ? undefined : v)} 
                disabled={!clientUserId || assets.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={clientUserId ? "Nenhum asset disponível" : "Selecione um cliente primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum asset específico</SelectItem>
                  {assets.map(asset => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.identificador} ({asset.tipo})
                      {asset.ip_principal && ` - ${asset.ip_principal}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Incident Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Detalhes do Incidente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Descreva brevemente o incidente"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes adicionais sobre o incidente..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Canal de Origem</Label>
                <Select value={originChannel} onValueChange={(v) => setOriginChannel(v as IncidentOrigin)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INCIDENT_ORIGIN_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as IncidentType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INCIDENT_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Severidade</Label>
              <Select value={severidade} onValueChange={(v) => setSeveridade(v as IncidentSeverity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INCIDENT_SEVERITY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link to="/modulos/atendimentos/suporte-tecnico/incidentes">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={submitting || !clientUserId || !title.trim()}>
            {submitting ? 'Criando...' : 'Criar Incidente'}
          </Button>
        </div>
      </form>
    </div>
  );
}