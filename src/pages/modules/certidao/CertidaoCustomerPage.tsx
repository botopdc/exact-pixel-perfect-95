// ============================================================================
// CERTIDÃO DE NASCIMENTO - CUSTOMER DETAIL PAGE
// View customer info and their assets
// Using /api/company CRUD
// ============================================================================

import { useState } from 'react';
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
import { useCompany, useUpdateCompany } from '@/hooks/useCompanies';
import {
  useCertAssets,
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
  
  // Use API hooks - customerId pode ser number
  const companyId = customerId ? (isNaN(Number(customerId)) ? customerId : Number(customerId)) : undefined;
  const { data: company, isLoading, refetch } = useCompany(companyId);
  const updateCompany = useUpdateCompany();
  const createAsset = useCreateCertAsset();
  
  // Carregar assets do cliente (ainda via Supabase pois cert_assets não foi migrado)
  const { data: assets } = useCertAssets(customerId);
  
  // Form states - mapeado para campos da API
  const [editForm, setEditForm] = useState({
    name: '',
    legal_name: '',
    docnum: '',
    work_area: '',
    city: '',
    uf: '',
    has_support: true,
    obs: '',
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
    if (company) {
      setEditForm({
        name: company.name,
        legal_name: company.legal_name || '',
        docnum: company.docnum || '',
        work_area: company.work_area || '',
        city: company.city || '',
        uf: company.uf || '',
        has_support: company.has_support ?? true,
        obs: company.obs || '',
      });
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!companyId) return;
    await updateCompany.mutateAsync({ 
      id: companyId, 
      data: {
        name: editForm.name,
        legal_name: editForm.legal_name || null,
        docnum: editForm.docnum || null,
        work_area: editForm.work_area || null,
        city: editForm.city || null,
        uf: editForm.uf || null,
        has_support: editForm.has_support,
        obs: editForm.obs || null,
      }
    });
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

  if (!company) {
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

  // Campos mapeados da API para exibição
  const displayName = company.legal_name || company.name;
  const subtitle = company.legal_name ? company.name : null;

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
            {displayName}
          </h1>
          {subtitle && (
            <p className="text-muted-foreground">{subtitle}</p>
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
                  <Label>Nome Fantasia *</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Razão Social</Label>
                  <Input
                    value={editForm.legal_name}
                    onChange={(e) => setEditForm({ ...editForm, legal_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input
                    value={editForm.docnum}
                    onChange={(e) => setEditForm({ ...editForm, docnum: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Segmento</Label>
                  <Input
                    value={editForm.work_area}
                    onChange={(e) => setEditForm({ ...editForm, work_area: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Cidade</Label>
                    <Input
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
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
                    value={editForm.obs}
                    onChange={(e) => setEditForm({ ...editForm, obs: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveEdit} disabled={updateCompany.isPending}>
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
                  <p className="font-mono">{company.docnum || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Segmento</p>
                  <p>{company.work_area || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Localização</p>
                  <p className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {company.city && company.uf 
                      ? `${company.city}/${company.uf}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tem Suporte?</p>
                  <Badge variant={company.has_support ? 'default' : 'secondary'}>
                    {company.has_support ? (
                      <><CheckCircle className="h-3 w-3 mr-1" /> Sim</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" /> Não</>
                    )}
                  </Badge>
                </div>

                {company.obs && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm">{company.obs}</p>
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
              Ativos ({assets?.length || 0})
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
            {assets && assets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assets.map((asset) => (
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
                <p className="text-sm">Clique em "Novo Ativo" para adicionar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
