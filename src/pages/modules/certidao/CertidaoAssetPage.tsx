// ============================================================================
// CERTIDÃO DE NASCIMENTO - ASSET DETAIL PAGE (Birth Certificate)
// Full infrastructure documentation for an asset
// ============================================================================

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Server,
  Building2,
  Cpu,
  HardDrive,
  Network,
  Key,
  FileText,
  History,
  Plus,
  Trash2,
  Save,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Edit,
  Check,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  useCertAsset,
  useUpdateCertAsset,
  useUpdateCertAssetResources,
  useCreateCertNetwork,
  useDeleteCertNetwork,
  useCreateCertDisk,
  useDeleteCertDisk,
  useCreateCertLicense,
  useDeleteCertLicense,
  useCreateCertAccess,
  useUpdateCertAccess,
  useDeleteCertAccess,
  useCertAuditLogs,
} from '@/hooks/useBirthCertificate';
import {
  CERT_ASSET_TYPE_LABELS,
  CERT_ASSET_STATUS_LABELS,
  CERT_ASSET_STATUS_COLORS,
  CERT_DATACENTER_LABELS,
  CERT_ACCESS_TYPES,
  CERT_DISK_TYPES,
  type CertAssetStatus,
  type CertAssetNetwork,
  type CertAssetDisk,
  type CertAssetLicense,
  type CertAssetAccess,
} from '@/types/birthCertificate';
import { authService } from '@/services/authService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function CertidaoAssetPage() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  
  const { data: asset, isLoading, refetch } = useCertAsset(assetId);
  const { data: auditLogs } = useCertAuditLogs('asset', assetId);
  
  // Mutations
  const updateAsset = useUpdateCertAsset();
  const updateResources = useUpdateCertAssetResources();
  const createNetwork = useCreateCertNetwork();
  const deleteNetwork = useDeleteCertNetwork();
  const createDisk = useCreateCertDisk();
  const deleteDisk = useDeleteCertDisk();
  const createLicense = useCreateCertLicense();
  const deleteLicense = useDeleteCertLicense();
  const createAccess = useCreateCertAccess();
  const updateAccess = useUpdateCertAccess();
  const deleteAccess = useDeleteCertAccess();
  
  // Form states for adding new items
  const [newIP, setNewIP] = useState({ ip_address: '', tipo: 'IPv4', is_primary: false, vlan: '', descricao: '' });
  const [newDisk, setNewDisk] = useState({ tamanho_gb: 0, tipo: 'SSD', mount_point: '', label: '' });
  const [newLicense, setNewLicense] = useState({ descricao: '', quantidade: 1, validade: '' });
  const [newAccess, setNewAccess] = useState({ tipo: 'SSH', host: '', porta: 22, usuario: '', senha_ref: '', instrucoes: '' });
  
  // Edit mode states
  const [editingResources, setEditingResources] = useState(false);
  const [resourcesForm, setResourcesForm] = useState({
    vcpu: 0,
    ram_gb: 0,
    backup_ativo: false,
    backup_retencao_dias: 7,
    backup_janela: '',
    firewall_ativo: false,
    servicos_adicionais: [] as string[],
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

  // Handlers
  const handleAddIP = async () => {
    if (!assetId || !newIP.ip_address) return;
    await createNetwork.mutateAsync({ asset_id: assetId, ...newIP });
    setNewIP({ ip_address: '', tipo: 'IPv4', is_primary: false, vlan: '', descricao: '' });
  };

  const handleDeleteIP = async (id: string) => {
    if (!assetId) return;
    await deleteNetwork.mutateAsync({ id, assetId });
  };

  const handleAddDisk = async () => {
    if (!assetId || newDisk.tamanho_gb <= 0) return;
    await createDisk.mutateAsync({ asset_id: assetId, ...newDisk });
    setNewDisk({ tamanho_gb: 0, tipo: 'SSD', mount_point: '', label: '' });
  };

  const handleDeleteDisk = async (id: string) => {
    if (!assetId) return;
    await deleteDisk.mutateAsync({ id, assetId });
  };

  const handleAddLicense = async () => {
    if (!assetId || !newLicense.descricao) return;
    await createLicense.mutateAsync({ 
      asset_id: assetId, 
      ...newLicense,
      validade: newLicense.validade || null,
    });
    setNewLicense({ descricao: '', quantidade: 1, validade: '' });
  };

  const handleDeleteLicense = async (id: string) => {
    if (!assetId) return;
    await deleteLicense.mutateAsync({ id, assetId });
  };

  const handleAddAccess = async () => {
    if (!assetId || !newAccess.tipo) return;
    await createAccess.mutateAsync({ asset_id: assetId, ...newAccess });
    setNewAccess({ tipo: 'SSH', host: '', porta: 22, usuario: '', senha_ref: '', instrucoes: '' });
  };

  const handleDeleteAccess = async (id: string) => {
    if (!assetId) return;
    await deleteAccess.mutateAsync({ id, assetId });
  };

  const handleStartEditResources = () => {
    if (asset?.resources) {
      setResourcesForm({
        vcpu: asset.resources.vcpu || 0,
        ram_gb: asset.resources.ram_gb || 0,
        backup_ativo: asset.resources.backup_ativo || false,
        backup_retencao_dias: asset.resources.backup_retencao_dias || 7,
        backup_janela: asset.resources.backup_janela || '',
        firewall_ativo: asset.resources.firewall_ativo || false,
        servicos_adicionais: asset.resources.servicos_adicionais || [],
      });
    }
    setEditingResources(true);
  };

  const handleSaveResources = async () => {
    if (!assetId) return;
    await updateResources.mutateAsync({ assetId, data: resourcesForm });
    setEditingResources(false);
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para área de transferência');
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Ativo não encontrado</p>
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/modulos/atendimentos/certidoes/${asset.customer_id}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Server className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{asset.asset_code}</h1>
            <Badge className={CERT_ASSET_STATUS_COLORS[asset.status]}>
              {CERT_ASSET_STATUS_LABELS[asset.status]}
            </Badge>
          </div>
          {asset.customer && (
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {asset.customer.nome_fantasia || asset.customer.razao_social}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Select
            value={asset.status}
            onValueChange={(value) => updateAsset.mutate({ id: asset.id, data: { status: value as CertAssetStatus } })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CERT_ASSET_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-2xl">
          <TabsTrigger value="visao-geral" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="rede" className="flex items-center gap-1">
            <Network className="h-4 w-4" />
            <span className="hidden sm:inline">Rede</span>
          </TabsTrigger>
          <TabsTrigger value="discos" className="flex items-center gap-1">
            <HardDrive className="h-4 w-4" />
            <span className="hidden sm:inline">Discos</span>
          </TabsTrigger>
          <TabsTrigger value="licencas" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Licenças</span>
          </TabsTrigger>
          <TabsTrigger value="acessos" className="flex items-center gap-1">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">Acessos</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
        </TabsList>

        {/* Visão Geral Tab */}
        <TabsContent value="visao-geral" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Asset Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dados do Ativo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo</p>
                    <p className="font-medium">{CERT_ASSET_TYPE_LABELS[asset.tipo]}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Datacenter</p>
                    <p className="font-medium">{CERT_DATACENTER_LABELS[asset.datacenter]}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sistema Operacional</p>
                    <p className="font-medium">{asset.sistema_operacional || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Hostname</p>
                    <p className="font-medium font-mono">{asset.hostname || '-'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="text-sm">{asset.observacoes || 'Nenhuma observação'}</p>
                </div>
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  <p>Criado em: {format(new Date(asset.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  <p>Atualizado em: {format(new Date(asset.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
              </CardContent>
            </Card>

            {/* Resources */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Recursos Contratados
                </CardTitle>
                {!editingResources && (
                  <Button variant="ghost" size="sm" onClick={handleStartEditResources}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {editingResources ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>vCPU</Label>
                        <Input
                          type="number"
                          min={0}
                          value={resourcesForm.vcpu}
                          onChange={(e) => setResourcesForm({ ...resourcesForm, vcpu: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>RAM (GB)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={resourcesForm.ram_gb}
                          onChange={(e) => setResourcesForm({ ...resourcesForm, ram_gb: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Backup Ativo</Label>
                      <Switch
                        checked={resourcesForm.backup_ativo}
                        onCheckedChange={(checked) => setResourcesForm({ ...resourcesForm, backup_ativo: checked })}
                      />
                    </div>
                    {resourcesForm.backup_ativo && (
                      <div className="grid grid-cols-2 gap-4 pl-4 border-l-2">
                        <div>
                          <Label>Retenção (dias)</Label>
                          <Input
                            type="number"
                            min={1}
                            value={resourcesForm.backup_retencao_dias}
                            onChange={(e) => setResourcesForm({ ...resourcesForm, backup_retencao_dias: parseInt(e.target.value) || 7 })}
                          />
                        </div>
                        <div>
                          <Label>Janela</Label>
                          <Input
                            placeholder="Ex: 00:00-04:00"
                            value={resourcesForm.backup_janela}
                            onChange={(e) => setResourcesForm({ ...resourcesForm, backup_janela: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <Label>Firewall Ativo</Label>
                      <Switch
                        checked={resourcesForm.firewall_ativo}
                        onCheckedChange={(checked) => setResourcesForm({ ...resourcesForm, firewall_ativo: checked })}
                      />
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button onClick={handleSaveResources} disabled={updateResources.isPending}>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar
                      </Button>
                      <Button variant="outline" onClick={() => setEditingResources(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted/50 p-3 rounded-lg text-center">
                        <p className="text-2xl font-bold">{asset.resources?.vcpu || 0}</p>
                        <p className="text-sm text-muted-foreground">vCPU</p>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-lg text-center">
                        <p className="text-2xl font-bold">{asset.resources?.ram_gb || 0} GB</p>
                        <p className="text-sm text-muted-foreground">RAM</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Backup</span>
                        <Badge variant={asset.resources?.backup_ativo ? 'default' : 'secondary'}>
                          {asset.resources?.backup_ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      {asset.resources?.backup_ativo && (
                        <p className="text-sm text-muted-foreground pl-4">
                          Retenção: {asset.resources.backup_retencao_dias} dias
                          {asset.resources.backup_janela && ` • Janela: ${asset.resources.backup_janela}`}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span>Firewall</span>
                        <Badge variant={asset.resources?.firewall_ativo ? 'default' : 'secondary'}>
                          {asset.resources?.firewall_ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Rede Tab */}
        <TabsContent value="rede" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Endereços IP</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>VLAN</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asset.network?.map((ip) => (
                    <TableRow key={ip.id}>
                      <TableCell className="font-mono">{ip.ip_address}</TableCell>
                      <TableCell>{ip.tipo}</TableCell>
                      <TableCell>{ip.vlan || '-'}</TableCell>
                      <TableCell>{ip.descricao || '-'}</TableCell>
                      <TableCell>
                        {ip.is_primary && <Badge>Principal</Badge>}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteIP(ip.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Add new row */}
                  <TableRow>
                    <TableCell>
                      <Input
                        placeholder="192.168.1.1"
                        value={newIP.ip_address}
                        onChange={(e) => setNewIP({ ...newIP, ip_address: e.target.value })}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={newIP.tipo} onValueChange={(v) => setNewIP({ ...newIP, tipo: v })}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IPv4">IPv4</SelectItem>
                          <SelectItem value="IPv6">IPv6</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="VLAN"
                        value={newIP.vlan}
                        onChange={(e) => setNewIP({ ...newIP, vlan: e.target.value })}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Descrição"
                        value={newIP.descricao}
                        onChange={(e) => setNewIP({ ...newIP, descricao: e.target.value })}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={newIP.is_primary}
                        onCheckedChange={(checked) => setNewIP({ ...newIP, is_primary: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={handleAddIP}
                        disabled={!newIP.ip_address || createNetwork.isPending}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Discos Tab */}
        <TabsContent value="discos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Discos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Mount Point</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asset.disks?.map((disk) => (
                    <TableRow key={disk.id}>
                      <TableCell className="font-mono">{disk.tamanho_gb} GB</TableCell>
                      <TableCell>{disk.tipo}</TableCell>
                      <TableCell className="font-mono">{disk.mount_point || '-'}</TableCell>
                      <TableCell>{disk.label || '-'}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteDisk(disk.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Add new row */}
                  <TableRow>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        placeholder="GB"
                        value={newDisk.tamanho_gb || ''}
                        onChange={(e) => setNewDisk({ ...newDisk, tamanho_gb: parseInt(e.target.value) || 0 })}
                        className="h-8 w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={newDisk.tipo} onValueChange={(v) => setNewDisk({ ...newDisk, tipo: v })}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CERT_DISK_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="/mnt/data"
                        value={newDisk.mount_point}
                        onChange={(e) => setNewDisk({ ...newDisk, mount_point: e.target.value })}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Label"
                        value={newDisk.label}
                        onChange={(e) => setNewDisk({ ...newDisk, label: e.target.value })}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={handleAddDisk}
                        disabled={newDisk.tamanho_gb <= 0 || createDisk.isPending}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Licenças Tab */}
        <TabsContent value="licencas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Licenças</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asset.licenses?.map((license) => (
                    <TableRow key={license.id}>
                      <TableCell>{license.descricao}</TableCell>
                      <TableCell>{license.quantidade}</TableCell>
                      <TableCell>
                        {license.validade 
                          ? format(new Date(license.validade), "dd/MM/yyyy", { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteLicense(license.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Add new row */}
                  <TableRow>
                    <TableCell>
                      <Input
                        placeholder="Windows Server 2022"
                        value={newLicense.descricao}
                        onChange={(e) => setNewLicense({ ...newLicense, descricao: e.target.value })}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={newLicense.quantidade}
                        onChange={(e) => setNewLicense({ ...newLicense, quantidade: parseInt(e.target.value) || 1 })}
                        className="h-8 w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={newLicense.validade}
                        onChange={(e) => setNewLicense({ ...newLicense, validade: e.target.value })}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={handleAddLicense}
                        disabled={!newLicense.descricao || createLicense.isPending}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Acessos Tab */}
        <TabsContent value="acessos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="h-5 w-5" />
                Credenciais de Acesso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {asset.access?.map((acc) => (
                <Card key={acc.id} className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge>{acc.tipo}</Badge>
                          {acc.host && (
                            <span className="font-mono text-sm">{acc.host}:{acc.porta}</span>
                          )}
                        </div>
                        {acc.usuario && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Usuário:</span>
                            <span className="font-mono">{acc.usuario}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={() => handleCopyToClipboard(acc.usuario!)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {acc.senha_ref && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Senha:</span>
                            <span className="font-mono">
                              {showPasswords[acc.id] ? acc.senha_ref : '••••••••'}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={() => togglePasswordVisibility(acc.id)}
                            >
                              {showPasswords[acc.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={() => handleCopyToClipboard(acc.senha_ref!)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {acc.instrucoes && (
                          <p className="text-sm text-muted-foreground">{acc.instrucoes}</p>
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteAccess(acc.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Add new access */}
              <Card className="border-dashed">
                <CardContent className="p-4 space-y-4">
                  <p className="text-sm font-medium">Adicionar novo acesso</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Tipo</Label>
                      <Select value={newAccess.tipo} onValueChange={(v) => setNewAccess({ ...newAccess, tipo: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CERT_ACCESS_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Host</Label>
                      <Input
                        placeholder="IP ou hostname"
                        value={newAccess.host}
                        onChange={(e) => setNewAccess({ ...newAccess, host: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Porta</Label>
                      <Input
                        type="number"
                        value={newAccess.porta}
                        onChange={(e) => setNewAccess({ ...newAccess, porta: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>Usuário</Label>
                      <Input
                        placeholder="root"
                        value={newAccess.usuario}
                        onChange={(e) => setNewAccess({ ...newAccess, usuario: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Senha/Chave</Label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={newAccess.senha_ref}
                        onChange={(e) => setNewAccess({ ...newAccess, senha_ref: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Instruções</Label>
                      <Input
                        placeholder="Instruções adicionais"
                        value={newAccess.instrucoes}
                        onChange={(e) => setNewAccess({ ...newAccess, instrucoes: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddAccess} disabled={createAccess.isPending}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Acesso
                  </Button>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Alterações</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs && auditLogs.length > 0 ? (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                      <History className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{log.action}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {log.entity_type}
                          </span>
                        </div>
                        {log.user_name && (
                          <p className="text-sm mt-1">por {log.user_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum log de auditoria registrado
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
