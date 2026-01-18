// ============================================================================
// CERTIDÃO DE NASCIMENTO - CUSTOMER DETAIL PAGE
// View customer info and their assets
// ============================================================================

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Server,
  Plus,
  Phone,
  Mail,
  User,
  MapPin,
  Edit,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCertCustomer,
  useUpdateCertCustomer,
  useCreateCertAsset,
} from '@/hooks/useBirthCertificate';
import {
  CERT_ASSET_TYPE_LABELS,
  CERT_ASSET_STATUS_LABELS,
  CERT_ASSET_STATUS_COLORS,
  CERT_DATACENTER_LABELS,
  type CertAssetType,
  type CertDatacenter,
} from '@/types/birthCertificate';
import { authService } from '@/services/authService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CertidaoCustomerPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [showNewAssetDialog, setShowNewAssetDialog] = useState(false);
  
  const { data: customer, isLoading, refetch } = useCertCustomer(customerId);
  const updateCustomer = useUpdateCertCustomer();
  const createAsset = useCreateCertAsset();
  
  // Form states
  const [editForm, setEditForm] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    segmento: '',
    cidade: '',
    uf: '',
    tem_suporte: true,
    observacoes: '',
  });

  const [newAssetForm, setNewAssetForm] = useState({
    asset_code: '',
    tipo: 'VM' as CertAssetType,
    datacenter: 'DC1_SP' as CertDatacenter,
    sistema_operacional: '',
    hostname: '',
  });
  
  // Access control
  const session = authService.getSession();
  const userLevel = session?.level || 0;
  
  if (userLevel < 900) {
    return (
      <div className="container mx-auto p-6">
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">Acesso restrito ao time de Suporte (nível 900+)</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleStartEdit = () => {
    if (customer) {
      setEditForm({
        razao_social: customer.razao_social,
        nome_fantasia: customer.nome_fantasia || '',
        cnpj: customer.cnpj || '',
        segmento: customer.segmento || '',
        cidade: customer.cidade || '',
        uf: customer.uf || '',
        tem_suporte: customer.tem_suporte,
        observacoes: customer.observacoes || '',
      });
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!customerId) return;
    await updateCustomer.mutateAsync({ id: customerId, data: editForm });
    setIsEditing(false);
  };

  const handleCreateAsset = async () => {
    if (!customerId) return;
    const asset = await createAsset.mutateAsync({
      customer_id: customerId,
      ...newAssetForm,
      status: 'PROVISIONANDO',
      observacoes: null,
    });
    setShowNewAssetDialog(false);
    setNewAssetForm({
      asset_code: '',
      tipo: 'VM',
      datacenter: 'DC1_SP',
      sistema_operacional: '',
      hostname: '',
    });
    navigate(`/modulos/atendimentos/certidoes/asset/${asset.id}`);
  };

  const handleOpenAsset = (assetId: string) => {
    navigate(`/modulos/atendimentos/certidoes/asset/${assetId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Cliente não encontrado</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate('/modulos/atendimentos/certidoes')}
            >
              Voltar para lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryContact = customer.contacts?.find(c => c.is_primary) || customer.contacts?.[0];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/modulos/atendimentos/certidoes')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            {customer.nome_fantasia || customer.razao_social}
          </h1>
          {customer.nome_fantasia && (
            <p className="text-muted-foreground">{customer.razao_social}</p>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={handleStartEdit}>
          <Edit className="h-4 w-4 mr-2" />
          Editar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label>Razão Social</Label>
                  <Input
                    value={editForm.razao_social}
                    onChange={(e) => setEditForm({ ...editForm, razao_social: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input
                    value={editForm.nome_fantasia}
                    onChange={(e) => setEditForm({ ...editForm, nome_fantasia: e.target.value })}
                  />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input
                    value={editForm.cnpj}
                    onChange={(e) => setEditForm({ ...editForm, cnpj: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Segmento</Label>
                  <Input
                    value={editForm.segmento}
                    onChange={(e) => setEditForm({ ...editForm, segmento: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Cidade</Label>
                    <Input
                      value={editForm.cidade}
                      onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>UF</Label>
                    <Input
                      value={editForm.uf}
                      onChange={(e) => setEditForm({ ...editForm, uf: e.target.value })}
                      maxLength={2}
                    />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={editForm.observacoes}
                    onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveEdit} disabled={updateCustomer.isPending}>
                    Salvar
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">CNPJ</p>
                  <p className="font-mono">{customer.cnpj || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Segmento</p>
                  <p>{customer.segmento || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Localização</p>
                  <p className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {customer.cidade && customer.uf 
                      ? `${customer.cidade}/${customer.uf}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tem Suporte?</p>
                  <Badge variant={customer.tem_suporte ? 'default' : 'secondary'}>
                    {customer.tem_suporte ? (
                      <><CheckCircle className="h-3 w-3 mr-1" /> Sim</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" /> Não</>
                    )}
                  </Badge>
                </div>

                {/* Primary Contact */}
                {primaryContact && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Contato Principal</p>
                    <div className="space-y-1">
                      <p className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {primaryContact.nome}
                        {primaryContact.cargo && (
                          <span className="text-muted-foreground">({primaryContact.cargo})</span>
                        )}
                      </p>
                      {primaryContact.email && (
                        <p className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4" />
                          {primaryContact.email}
                        </p>
                      )}
                      {primaryContact.telefone && (
                        <p className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4" />
                          {primaryContact.telefone}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {customer.observacoes && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm">{customer.observacoes}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Assets Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5" />
              Ativos ({customer.assets?.length || 0})
            </CardTitle>
            <Dialog open={showNewAssetDialog} onOpenChange={setShowNewAssetDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Ativo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Ativo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Código do Ativo *</Label>
                    <Input
                      placeholder="Ex: VM-001, BM-002"
                      value={newAssetForm.asset_code}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, asset_code: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Tipo *</Label>
                    <Select
                      value={newAssetForm.tipo}
                      onValueChange={(v) => setNewAssetForm({ ...newAssetForm, tipo: v as CertAssetType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CERT_ASSET_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Datacenter *</Label>
                    <Select
                      value={newAssetForm.datacenter}
                      onValueChange={(v) => setNewAssetForm({ ...newAssetForm, datacenter: v as CertDatacenter })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CERT_DATACENTER_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Sistema Operacional</Label>
                    <Input
                      placeholder="Ex: Ubuntu 22.04 LTS"
                      value={newAssetForm.sistema_operacional}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, sistema_operacional: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Hostname</Label>
                    <Input
                      placeholder="Ex: srv-web-01"
                      value={newAssetForm.hostname}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, hostname: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setShowNewAssetDialog(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreateAsset}
                      disabled={!newAssetForm.asset_code || createAsset.isPending}
                    >
                      {createAsset.isPending ? 'Criando...' : 'Criar Ativo'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {customer.assets && customer.assets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customer.assets.map((asset) => (
                  <Card
                    key={asset.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => handleOpenAsset(asset.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{asset.asset_code}</p>
                          <p className="text-sm text-muted-foreground">
                            {CERT_ASSET_TYPE_LABELS[asset.tipo]} • {CERT_DATACENTER_LABELS[asset.datacenter]}
                          </p>
                          {asset.sistema_operacional && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {asset.sistema_operacional}
                            </p>
                          )}
                        </div>
                        <Badge className={CERT_ASSET_STATUS_COLORS[asset.status]}>
                          {CERT_ASSET_STATUS_LABELS[asset.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Atualizado em {format(new Date(asset.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum ativo cadastrado</p>
                <p className="text-sm">Clique em "Novo Ativo" para começar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
