// ============================================================================
// CREATE INCIDENT PAGE
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Server,
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
  getTechClients,
  getTechAssets,
  createIncident,
} from '@/services/techOpsService';
import type { TechClient, TechAsset, IncidentOrigin, IncidentType, IncidentSeverity, SLALevel } from '@/types/techOps';
import {
  INCIDENT_ORIGIN_LABELS,
  INCIDENT_TYPE_LABELS,
  INCIDENT_SEVERITY_LABELS,
  SLA_LEVEL_LABELS,
} from '@/types/techOps';

export default function CreateIncidentPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [clients, setClients] = useState<TechClient[]>([]);
  const [assets, setAssets] = useState<TechAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state - use undefined instead of '' for Select components
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [assetId, setAssetId] = useState<string | undefined>(undefined);
  const [originChannel, setOriginChannel] = useState<IncidentOrigin>('PORTAL_INTERNO');
  const [tipo, setTipo] = useState<IncidentType>('QUEDA');
  const [severidade, setSeveridade] = useState<IncidentSeverity>('S4');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (clientId) {
      loadAssets(clientId);
    } else {
      setAssets([]);
      setAssetId(undefined);
    }
  }, [clientId]);

  async function loadClients() {
    try {
      const data = await getTechClients({ status: 'ATIVO' });
      setClients(data);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAssets(clientId: string) {
    try {
      const data = await getTechAssets({ client_id: clientId });
      setAssets(data);
    } catch (error) {
      console.error('Erro ao carregar assets:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!clientId || !title.trim()) {
      toast({ title: 'Erro', description: 'Cliente e título são obrigatórios', variant: 'destructive' });
      return;
    }

    try {
      setSubmitting(true);
      
      // Get client SLA for the incident
      const client = clients.find(c => c.id === clientId);
      const slaLevel = client?.sla_level || 'PADRAO';
      
      const incident = await createIncident({
        client_id: clientId,
        asset_id: assetId || null,
        origin_channel: originChannel,
        tipo,
        severidade,
        sla_level_aplicado: slaLevel,
        title: title.trim(),
        description: description.trim() || null,
      });
      
      toast({ title: 'Sucesso', description: 'Incidente criado com sucesso' });
      navigate(`/modulos/atendimentos/suporte-tecnico/incidentes/${incident.id}`);
    } catch (error) {
      console.error('Erro ao criar incidente:', error);
      toast({ title: 'Erro', description: 'Não foi possível criar o incidente', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  const selectedClient = clients.find(c => c.id === clientId);

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
              <Label htmlFor="client">Cliente *</Label>
              <Select value={clientId ?? ''} onValueChange={(v) => setClientId(v || undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.nome_fantasia || client.razao_social} ({SLA_LEVEL_LABELS[client.sla_level]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClient && (
              <div className="p-3 rounded-lg bg-accent/30">
                <p className="text-sm">
                  <strong>SLA:</strong> {SLA_LEVEL_LABELS[selectedClient.sla_level]}
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="asset">Asset (opcional)</Label>
              <Select 
                value={assetId ?? '__none__'} 
                onValueChange={(v) => setAssetId(v === '__none__' ? undefined : v)} 
                disabled={!clientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={clientId ? "Selecione o asset (opcional)" : "Selecione um cliente primeiro"} />
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
          <Button type="submit" disabled={submitting || !clientId || !title.trim()}>
            {submitting ? 'Criando...' : 'Criar Incidente'}
          </Button>
        </div>
      </form>
    </div>
  );
}
