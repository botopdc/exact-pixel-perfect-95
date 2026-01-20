import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Loader2, Shield, ShieldOff, History, Lock, AlertTriangle, Check, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfigPersistence } from '@/hooks/useConfigPersistence';
import { CalculatorConfig, CpuModel, RamTier, DiskOption, StorageRegionPricing } from '@/lib/calculatorConfig';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

// ============ CONSTANTS ============
const ADMIN_PIN = "OPEN2026";
const ADMIN_STORAGE_KEY = 'open_precos_isAdmin';
const LOG_STORAGE_KEY = 'open_precos_changeLog';

// ============ TYPES ============
interface PriceChangeLog {
  timestamp: string;
  actionType: 'ADD_ITEM' | 'REMOVE_ITEM' | 'UPDATE_ITEM';
  section: string;
  itemName: string;
  oldValue?: string | number;
  newValue?: string | number;
}

// ============ HELPERS ============
const loadAdminState = (): boolean => {
  try {
    return localStorage.getItem(ADMIN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const saveAdminState = (isAdmin: boolean): void => {
  try {
    localStorage.setItem(ADMIN_STORAGE_KEY, isAdmin ? 'true' : 'false');
  } catch {
    // Silent fail
  }
};

const loadChangeLog = (): PriceChangeLog[] => {
  try {
    const stored = localStorage.getItem(LOG_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveChangeLog = (log: PriceChangeLog[]): void => {
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // Silent fail
  }
};

const formatLogDate = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
};

const getActionLabel = (action: string): string => {
  const labels: Record<string, string> = {
    ADD_ITEM: 'Adicionado',
    REMOVE_ITEM: 'Removido',
    UPDATE_ITEM: 'Alterado',
  };
  return labels[action] || action;
};

const getActionColor = (action: string): string => {
  const colors: Record<string, string> = {
    ADD_ITEM: 'bg-green-500/20 text-green-500',
    REMOVE_ITEM: 'bg-red-500/20 text-red-500',
    UPDATE_ITEM: 'bg-amber-500/20 text-amber-500',
  };
  return colors[action] || 'bg-muted text-muted-foreground';
};

const generateId = () => Math.random().toString(36).substring(2, 10);

// ============ COMPONENT ============
const Precos = () => {
  // Hook for API persistence
  const { 
    config, 
    isLoading, 
    isSaving, 
    isDirty: hasLocalChanges, 
    updateConfig: updateConfigFromHook, 
    saveToApi, 
    resetToApi,
  } = useConfigPersistence();
  
  // Admin state
  const [isAdmin, setIsAdmin] = useState<boolean>(loadAdminState);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  
  // Log state
  const [changeLog, setChangeLog] = useState<PriceChangeLog[]>(loadChangeLog);
  const [showLogModal, setShowLogModal] = useState(false);

  // Add item modals
  const [showAddCpuModal, setShowAddCpuModal] = useState(false);
  const [showAddRamModal, setShowAddRamModal] = useState(false);
  const [showAddDiskModal, setShowAddDiskModal] = useState(false);
  const [showAddGpuModal, setShowAddGpuModal] = useState(false);
  const [showAddSqlModal, setShowAddSqlModal] = useState(false);
  const [showAddAddonModal, setShowAddAddonModal] = useState(false);

  // New item form states
  const [newCpu, setNewCpu] = useState<Partial<CpuModel>>({ label: '', price: 0 });
  const [newRam, setNewRam] = useState<Partial<RamTier>>({ label: '', gb: 0, price: 0 });
  const [newDisk, setNewDisk] = useState<Partial<DiskOption>>({ label: '', tb: 0, price: 0 });
  const [newGpu, setNewGpu] = useState({ name: '', price: 0 });
  const [newSql, setNewSql] = useState({ name: '', price: 0 });
  const [newAddon, setNewAddon] = useState({ key: '', label: '', price: 0 });

  // Confirmations
  const [showConfirmEmptyGpuSave, setShowConfirmEmptyGpuSave] = useState(false);

  // Persist admin state
  useEffect(() => {
    saveAdminState(isAdmin);
  }, [isAdmin]);

  // Persist log changes
  useEffect(() => {
    saveChangeLog(changeLog);
  }, [changeLog]);

  // Add log entry
  const addLogEntry = useCallback((
    actionType: PriceChangeLog['actionType'],
    section: string,
    itemName: string,
    oldValue?: string | number,
    newValue?: string | number
  ) => {
    if (!isAdmin) return false;
    
    const entry: PriceChangeLog = {
      timestamp: new Date().toISOString(),
      actionType,
      section,
      itemName,
      oldValue,
      newValue,
    };
    
    setChangeLog(prev => [entry, ...prev]);
    return true;
  }, [isAdmin]);

  // Update config with admin check
  const updateConfig = useCallback((updater: (prev: CalculatorConfig) => CalculatorConfig) => {
    if (!isAdmin || !config) {
      toast({
        title: 'Ação bloqueada',
        description: 'Ação permitida somente em Modo Admin',
        variant: 'destructive',
      });
      return;
    }
    updateConfigFromHook(updater);
  }, [isAdmin, config, updateConfigFromHook]);

  // ============ PIN HANDLERS ============
  const handlePinSubmit = () => {
    if (pinInput === ADMIN_PIN) {
      setIsAdmin(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError(false);
      toast({ title: 'Modo Admin Ativo', description: 'Você pode agora editar os preços.' });
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    toast({ title: 'Modo Admin Desativado', description: 'Edição de preços bloqueada.' });
  };

  const openPinModal = () => {
    setPinInput('');
    setPinError(false);
    setShowPinModal(true);
  };

  const handleResetToApi = async () => {
    if (!isAdmin) return;
    await resetToApi();
    addLogEntry('UPDATE_ITEM', 'geral', 'Reset para API', 'configuração local', 'configuração API');
  };

  // ============ BAREMETAL HANDLERS ============
  const handleAddCpu = () => {
    if (!isAdmin || !newCpu.label || newCpu.price === undefined) return;
    
    const cpu: CpuModel = { id: generateId(), label: newCpu.label, price: Number(newCpu.price) };
    updateConfig(prev => ({
      ...prev,
      baremetal: { ...prev.baremetal, cpu_models: [...prev.baremetal.cpu_models, cpu] },
    }));
    
    addLogEntry('ADD_ITEM', 'baremetal_cpu', cpu.label, undefined, cpu.price);
    setNewCpu({ label: '', price: 0 });
    setShowAddCpuModal(false);
    toast({ title: 'CPU adicionada', description: cpu.label });
  };

  const handleRemoveCpu = (cpu: CpuModel) => {
    if (!isAdmin) return;
    updateConfig(prev => ({
      ...prev,
      baremetal: { ...prev.baremetal, cpu_models: prev.baremetal.cpu_models.filter(c => c.id !== cpu.id) },
    }));
    addLogEntry('REMOVE_ITEM', 'baremetal_cpu', cpu.label, cpu.price, undefined);
    toast({ title: 'CPU removida', description: cpu.label });
  };

  const handleUpdateCpuPrice = (cpu: CpuModel, newPrice: number) => {
    if (!isAdmin) return;
    updateConfig(prev => ({
      ...prev,
      baremetal: {
        ...prev.baremetal,
        cpu_models: prev.baremetal.cpu_models.map(c => c.id === cpu.id ? { ...c, price: newPrice } : c),
      },
    }));
    addLogEntry('UPDATE_ITEM', 'baremetal_cpu', cpu.label, cpu.price, newPrice);
  };

  const handleAddRam = () => {
    if (!isAdmin || !newRam.label || newRam.price === undefined) return;
    
    const ram: RamTier = { id: generateId(), label: newRam.label, gb: Number(newRam.gb) || 0, price: Number(newRam.price) };
    updateConfig(prev => ({
      ...prev,
      baremetal: { ...prev.baremetal, ram_tiers: [...prev.baremetal.ram_tiers, ram] },
    }));
    
    addLogEntry('ADD_ITEM', 'baremetal_ram', ram.label, undefined, ram.price);
    setNewRam({ label: '', gb: 0, price: 0 });
    setShowAddRamModal(false);
    toast({ title: 'RAM adicionada', description: ram.label });
  };

  const handleRemoveRam = (ram: RamTier) => {
    if (!isAdmin) return;
    updateConfig(prev => ({
      ...prev,
      baremetal: { ...prev.baremetal, ram_tiers: prev.baremetal.ram_tiers.filter(r => r.id !== ram.id) },
    }));
    addLogEntry('REMOVE_ITEM', 'baremetal_ram', ram.label, ram.price, undefined);
    toast({ title: 'RAM removida', description: ram.label });
  };

  const handleUpdateRamPrice = (ram: RamTier, newPrice: number) => {
    if (!isAdmin) return;
    updateConfig(prev => ({
      ...prev,
      baremetal: {
        ...prev.baremetal,
        ram_tiers: prev.baremetal.ram_tiers.map(r => r.id === ram.id ? { ...r, price: newPrice } : r),
      },
    }));
    addLogEntry('UPDATE_ITEM', 'baremetal_ram', ram.label, ram.price, newPrice);
  };

  const handleAddDisk = () => {
    if (!isAdmin || !newDisk.label || newDisk.price === undefined) return;
    
    const disk: DiskOption = { id: generateId(), label: newDisk.label, tb: Number(newDisk.tb) || 0, price: Number(newDisk.price) };
    updateConfig(prev => ({
      ...prev,
      baremetal: { ...prev.baremetal, disks: [...prev.baremetal.disks, disk] },
    }));
    
    addLogEntry('ADD_ITEM', 'baremetal_disk', disk.label, undefined, disk.price);
    setNewDisk({ label: '', tb: 0, price: 0 });
    setShowAddDiskModal(false);
    toast({ title: 'Disco adicionado', description: disk.label });
  };

  const handleRemoveDisk = (disk: DiskOption) => {
    if (!isAdmin) return;
    updateConfig(prev => ({
      ...prev,
      baremetal: { ...prev.baremetal, disks: prev.baremetal.disks.filter(d => d.id !== disk.id) },
    }));
    addLogEntry('REMOVE_ITEM', 'baremetal_disk', disk.label, disk.price, undefined);
    toast({ title: 'Disco removido', description: disk.label });
  };

  const handleUpdateDiskPrice = (disk: DiskOption, newPrice: number) => {
    if (!isAdmin) return;
    updateConfig(prev => ({
      ...prev,
      baremetal: {
        ...prev.baremetal,
        disks: prev.baremetal.disks.map(d => d.id === disk.id ? { ...d, price: newPrice } : d),
      },
    }));
    addLogEntry('UPDATE_ITEM', 'baremetal_disk', disk.label, disk.price, newPrice);
  };

  // ============ GPU HANDLERS ============
  const handleAddGpu = () => {
    if (!isAdmin || !newGpu.name || newGpu.price === undefined) return;
    
    updateConfig(prev => ({
      ...prev,
      gpu_usd: { ...prev.gpu_usd, [newGpu.name]: Number(newGpu.price) },
    }));
    
    addLogEntry('ADD_ITEM', 'gpu', newGpu.name, undefined, newGpu.price);
    setNewGpu({ name: '', price: 0 });
    setShowAddGpuModal(false);
    toast({ title: 'GPU adicionada', description: newGpu.name });
  };

  const handleRemoveGpu = (gpuName: string, price: number) => {
    if (!isAdmin) return;
    
    updateConfig(prev => {
      const newGpuPrices = { ...prev.gpu_usd };
      delete newGpuPrices[gpuName];
      return { ...prev, gpu_usd: newGpuPrices };
    });
    
    addLogEntry('REMOVE_ITEM', 'gpu', gpuName, price, undefined);
    toast({ title: 'GPU removida', description: gpuName });
  };

  const handleUpdateGpuPrice = (gpuName: string, oldPrice: number, newPrice: number) => {
    if (!isAdmin) return;
    updateConfig(prev => ({
      ...prev,
      gpu_usd: { ...prev.gpu_usd, [gpuName]: newPrice },
    }));
    addLogEntry('UPDATE_ITEM', 'gpu', gpuName, oldPrice, newPrice);
  };

  // ============ SQL HANDLERS ============
  const handleAddSql = () => {
    if (!isAdmin || !newSql.name || newSql.price === undefined) return;
    
    const price = Number(newSql.price);
    if (isNaN(price)) {
      toast({ title: 'Preço inválido', description: 'O preço deve ser um número válido.', variant: 'destructive' });
      return;
    }
    
    updateConfig(prev => ({
      ...prev,
      addons_brl: {
        ...prev.addons_brl,
        sql: { ...(prev.addons_brl?.sql ?? {}), [newSql.name]: price },
      },
    }));
    
    addLogEntry('ADD_ITEM', 'sql', newSql.name, undefined, price);
    setNewSql({ name: '', price: 0 });
    setShowAddSqlModal(false);
    toast({ title: 'SQL adicionado', description: newSql.name });
  };

  const handleRemoveSql = (sqlType: string, price: number) => {
    if (!isAdmin || sqlType === 'none') return;
    
    updateConfig(prev => {
      const newSqlPrices = { ...(prev.addons_brl?.sql ?? {}) };
      delete newSqlPrices[sqlType];
      return { ...prev, addons_brl: { ...prev.addons_brl, sql: newSqlPrices } };
    });
    
    addLogEntry('REMOVE_ITEM', 'sql', sqlType, price, undefined);
    toast({ title: 'SQL removido', description: sqlType });
  };

  const handleUpdateSqlPrice = (sqlType: string, oldPrice: number, newPrice: number) => {
    if (!isAdmin) return;
    const price = Number(newPrice);
    if (isNaN(price)) return;
    
    updateConfig(prev => ({
      ...prev,
      addons_brl: {
        ...prev.addons_brl,
        sql: { ...(prev.addons_brl?.sql ?? {}), [sqlType]: price },
      },
    }));
    addLogEntry('UPDATE_ITEM', 'sql', sqlType, oldPrice, price);
  };

  // ============ ADDON HANDLERS ============
  const handleUpdateAddonPrice = (addonKey: string, addonLabel: string, oldPrice: number, newPrice: number) => {
    if (!isAdmin) return;
    updateConfig(prev => ({
      ...prev,
      addons_brl: { ...prev.addons_brl, [addonKey]: newPrice },
    }));
    addLogEntry('UPDATE_ITEM', 'addons', addonLabel, oldPrice, newPrice);
  };

  const handleAddAddon = () => {
    if (!isAdmin || !newAddon.key || !newAddon.label || newAddon.price === undefined) return;
    
    const addonKey = newAddon.key.toLowerCase().replace(/\s+/g, '_');
    updateConfig(prev => ({
      ...prev,
      addons_brl: { ...prev.addons_brl, [addonKey]: Number(newAddon.price) },
    }));
    
    addLogEntry('ADD_ITEM', 'addons', newAddon.label, undefined, newAddon.price);
    setNewAddon({ key: '', label: '', price: 0 });
    setShowAddAddonModal(false);
    toast({ title: 'Add-on adicionado', description: newAddon.label });
  };

  const handleRemoveAddon = (addonKey: string, addonLabel: string, price: number) => {
    if (!isAdmin) return;
    
    const standardAddonKeys = ['antivirus_unit', 'firewall_pfsense', 'tsplus_unit', 'cal_unit', 'sql', 'veeam_vm_unit', 'veeam_agent_unit', 'winserver_2vcpu_unit'];
    if (standardAddonKeys.includes(addonKey)) {
      toast({ title: 'Ação não permitida', description: 'Não é possível remover add-ons padrão.', variant: 'destructive' });
      return;
    }
    
    updateConfig(prev => {
      const newAddonsBrl = { ...prev.addons_brl };
      delete (newAddonsBrl as Record<string, unknown>)[addonKey];
      return { ...prev, addons_brl: newAddonsBrl as typeof prev.addons_brl };
    });
    
    addLogEntry('REMOVE_ITEM', 'addons', addonLabel, price, undefined);
    toast({ title: 'Add-on removido', description: addonLabel });
  };

  // ============ VM HANDLERS ============
  const handleUpdateVmPrice = (vmKey: string, vmLabel: string, oldPrice: number, newPrice: number) => {
    if (!isAdmin) return;
    updateConfig(prev => ({
      ...prev,
      vm_prices_brl: { ...prev.vm_prices_brl, [vmKey]: newPrice },
    }));
    addLogEntry('UPDATE_ITEM', 'vm', vmLabel, oldPrice, newPrice);
  };

  // ============ DISCOUNT HANDLERS ============
  const handleUpdateDiscount = (term: string, oldValue: number, newValue: number) => {
    if (!isAdmin) return;
    updateConfig(prev => ({
      ...prev,
      discount: { ...prev.discount, [term]: newValue / 100 },
    }));
    addLogEntry('UPDATE_ITEM', 'descontos', `${term} meses`, oldValue, newValue);
  };

  // ============ SAVE HANDLER ============
  const handleSaveConfig = async () => {
    if (!isAdmin) return;

    const gpuCount = Object.keys(config?.gpu_usd ?? {}).length;
    if (gpuCount === 0) {
      setShowConfirmEmptyGpuSave(true);
      return;
    }

    await saveToApi();
  };

  const confirmSaveEmptyGpuConfig = async () => {
    if (!isAdmin) return;
    setShowConfirmEmptyGpuSave(false);
    await saveToApi({ allowEmptyGpuSave: true });
  };

  // ============ LOADING STATE ============
  if (isLoading || !config) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
              <Skeleton className="h-8 w-64" />
            </div>
          </header>
          <div className="space-y-6">
            <Skeleton className="h-12 w-96" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // ============ RENDER ============
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
            <h1 className="text-2xl font-bold text-foreground">Configuração de Preços</h1>
            
            {isAdmin && (
              <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
                <Shield className="w-3 h-3 mr-1" />
                Modo Admin
              </Badge>
            )}
            
            {hasLocalChanges && (
              <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/50">
                <Save className="w-3 h-3 mr-1" />
                Alterações pendentes
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowLogModal(true)} className="gap-2">
              <History className="h-4 w-4" />
              Ver Log
            </Button>
            
            {isAdmin && hasLocalChanges && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="gap-2 border-green-500/50 text-green-500 hover:bg-green-500/10"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSaving ? 'Salvando...' : 'Salvar Preços'}
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleResetToApi}
                  className="gap-2 border-red-500/50 text-red-500 hover:bg-red-500/10"
                >
                  <RefreshCw className="h-4 w-4" />
                  Descartar
                </Button>
              </>
            )}
            
            {isAdmin ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleAdminLogout}
                className="gap-2 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
              >
                <ShieldOff className="h-4 w-4" />
                Sair Admin
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={openPinModal} className="gap-2 text-muted-foreground">
                <Lock className="h-4 w-4" />
                Entrar Admin
              </Button>
            )}
          </div>
        </header>

        {/* Read-only Warning */}
        {!isAdmin && (
          <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
            <Lock className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-500">
              Edição desabilitada. Entre em modo Admin para alterar preços.
            </AlertDescription>
          </Alert>
        )}

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">
            Preços carregados da API. Todos os valores são em R$ (BRL).
            {isAdmin && <span className="text-green-500 ml-2">• Modo Admin: edição habilitada.</span>}
            {isSaving && <span className="text-blue-500 ml-2">• Salvando...</span>}
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="vm" className="space-y-6">
          <TabsList className="grid grid-cols-7 w-full max-w-4xl">
            <TabsTrigger value="vm">VM</TabsTrigger>
            <TabsTrigger value="baremetal">BareMetal</TabsTrigger>
            <TabsTrigger value="gpu">GPU</TabsTrigger>
            <TabsTrigger value="addons">Add-ons</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="kubernetes">Kubernetes</TabsTrigger>
            <TabsTrigger value="geral">Geral</TabsTrigger>
          </TabsList>

          {/* VM Tab */}
          <TabsContent value="vm">
            <Card>
              <CardHeader><CardTitle>Preços de VM (R$)</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { key: 'vcpu', label: 'vCPU (unid.)', value: config.vm_prices_brl.vcpu },
                  { key: 'ram_per_gb', label: 'RAM (GB)', value: config.vm_prices_brl.ram_per_gb },
                  { key: 'nvme_per_gb', label: 'NVMe (GB)', value: config.vm_prices_brl.nvme_per_gb },
                  { key: 'ip_public', label: 'IP Público', value: config.vm_prices_brl.ip_public },
                ].map(({ key, label, value }) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={value}
                      readOnly={!isAdmin}
                      disabled={!isAdmin}
                      className={!isAdmin ? "bg-muted/30" : ""}
                      onChange={(e) => handleUpdateVmPrice(key, label, value, Number(e.target.value))}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BareMetal Tab */}
          <TabsContent value="baremetal">
            <div className="space-y-6">
              {/* CPU Models */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Modelos de CPU</CardTitle>
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => setShowAddCpuModal(true)} className="gap-1 text-green-500 border-green-500/50">
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {config.baremetal.cpu_models.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum modelo configurado.</p>
                  ) : (
                    config.baremetal.cpu_models.map((cpu) => (
                      <div key={cpu.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div className="md:col-span-3">
                          <Label>Descrição</Label>
                          <Input value={cpu.label} readOnly disabled className="bg-muted/30" />
                        </div>
                        <div>
                          <Label>Preço (R$)</Label>
                          <Input 
                            type="number" step="0.01" value={cpu.price} 
                            readOnly={!isAdmin} disabled={!isAdmin}
                            className={!isAdmin ? "bg-muted/30" : ""}
                            onChange={(e) => handleUpdateCpuPrice(cpu, Number(e.target.value))}
                          />
                        </div>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveCpu(cpu)} className="text-red-500 hover:bg-red-500/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* RAM Tiers */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Opções de RAM</CardTitle>
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => setShowAddRamModal(true)} className="gap-1 text-green-500 border-green-500/50">
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {config.baremetal.ram_tiers.length === 0 ? (
                    <p className="text-muted-foreground text-sm col-span-4">Nenhuma opção configurada.</p>
                  ) : (
                    config.baremetal.ram_tiers.map((ram) => (
                      <div key={ram.id} className="space-y-2">
                        <Label className="flex items-center justify-between">
                          {ram.label}
                          {isAdmin && <Button variant="ghost" size="icon" onClick={() => handleRemoveRam(ram)} className="h-6 w-6 text-red-500"><Trash2 className="h-3 w-3" /></Button>}
                        </Label>
                        <Input 
                          type="number" step="0.01" value={ram.price} 
                          readOnly={!isAdmin} disabled={!isAdmin}
                          className={!isAdmin ? "bg-muted/30" : ""}
                          onChange={(e) => handleUpdateRamPrice(ram, Number(e.target.value))}
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Disk Options */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Opções de Disco</CardTitle>
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => setShowAddDiskModal(true)} className="gap-1 text-green-500 border-green-500/50">
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {config.baremetal.disks.length === 0 ? (
                    <p className="text-muted-foreground text-sm col-span-3">Nenhuma opção configurada.</p>
                  ) : (
                    config.baremetal.disks.map((disk) => (
                      <div key={disk.id} className="space-y-2">
                        <Label className="flex items-center justify-between">
                          {disk.label}
                          {isAdmin && <Button variant="ghost" size="icon" onClick={() => handleRemoveDisk(disk)} className="h-6 w-6 text-red-500"><Trash2 className="h-3 w-3" /></Button>}
                        </Label>
                        <Input 
                          type="number" step="0.01" value={disk.price} 
                          readOnly={!isAdmin} disabled={!isAdmin}
                          className={!isAdmin ? "bg-muted/30" : ""}
                          onChange={(e) => handleUpdateDiskPrice(disk, Number(e.target.value))}
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* GPU Tab */}
          <TabsContent value="gpu">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Preços de GPU (R$)</CardTitle>
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => setShowAddGpuModal(true)} className="gap-1 text-green-500 border-green-500/50">
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                )}
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.keys(config.gpu_usd).length === 0 ? (
                  <p className="text-muted-foreground text-sm col-span-3">Nenhuma GPU configurada.</p>
                ) : (
                  Object.entries(config.gpu_usd).map(([gpu, price]) => (
                    <div key={gpu} className="space-y-2">
                      <Label className="flex items-center justify-between">
                        {gpu}
                        {isAdmin && gpu !== 'Sem GPU' && (
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveGpu(gpu, price)} className="h-6 w-6 text-red-500"><Trash2 className="h-3 w-3" /></Button>
                        )}
                      </Label>
                      <Input 
                        type="number" step="0.01" value={price} 
                        readOnly={!isAdmin} disabled={!isAdmin}
                        className={!isAdmin ? "bg-muted/30" : ""}
                        onChange={(e) => handleUpdateGpuPrice(gpu, price, Number(e.target.value))}
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Add-ons Tab */}
          <TabsContent value="addons">
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Add-ons (R$)</CardTitle>
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => setShowAddAddonModal(true)} className="gap-1 text-green-500 border-green-500/50">
                      <Plus className="h-4 w-4" />
                      Novo Add-on
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { key: 'antivirus_unit', label: 'Antivírus (unid.)', value: config.addons_brl.antivirus_unit },
                    { key: 'firewall_pfsense', label: 'Firewall pfSense', value: config.addons_brl.firewall_pfsense },
                    { key: 'tsplus_unit', label: 'TSplus (unid.)', value: config.addons_brl.tsplus_unit },
                    { key: 'cal_unit', label: 'CAL (unid.)', value: config.addons_brl.cal_unit },
                    { key: 'veeam_vm_unit', label: 'Veeam VM (unid.)', value: config.addons_brl.veeam_vm_unit },
                    { key: 'veeam_agent_unit', label: 'Veeam Agent (unid.)', value: config.addons_brl.veeam_agent_unit },
                    { key: 'winserver_2vcpu_unit', label: 'WinServer(2vCPU/unid.)', value: config.addons_brl.winserver_2vcpu_unit },
                  ].map(({ key, label, value }) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      <Input 
                        type="number" step="0.01" value={value} 
                        readOnly={!isAdmin} disabled={!isAdmin}
                        className={!isAdmin ? "bg-muted/30" : ""}
                        onChange={(e) => handleUpdateAddonPrice(key, label, value, Number(e.target.value))}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Custom Add-ons */}
              {(() => {
                const standardKeys = ['antivirus_unit', 'firewall_pfsense', 'tsplus_unit', 'cal_unit', 'sql', 'veeam_vm_unit', 'veeam_agent_unit', 'winserver_2vcpu_unit'];
                const customEntries = Object.entries(config.addons_brl).filter(
                  ([key, value]) => !standardKeys.includes(key) && typeof value === 'number'
                );
                
                if (customEntries.length === 0) return null;
                
                return (
                  <Card>
                    <CardHeader><CardTitle>Add-ons Customizados (R$)</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {customEntries.map(([key, price]) => (
                        <div key={key} className="space-y-2">
                          <Label className="flex items-center justify-between capitalize">
                            {key.replace(/_/g, ' ')}
                            {isAdmin && (
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveAddon(key, key.replace(/_/g, ' '), price as number)} className="h-6 w-6 text-red-500">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </Label>
                          <Input 
                            type="number" step="0.01" value={price as number} 
                            readOnly={!isAdmin} disabled={!isAdmin}
                            className={!isAdmin ? "bg-muted/30" : ""}
                            onChange={(e) => handleUpdateAddonPrice(key, key, price as number, Number(e.target.value))}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* SQL Server */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>SQL Server (R$)</CardTitle>
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => setShowAddSqlModal(true)} className="gap-1 text-green-500 border-green-500/50">
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.keys(config.addons_brl?.sql ?? {}).length === 0 ? (
                    <p className="text-muted-foreground text-sm col-span-4">Nenhuma opção configurada.</p>
                  ) : (
                    Object.entries(config.addons_brl?.sql ?? {}).map(([sqlType, price]) => (
                      <div key={sqlType} className="space-y-2">
                        <Label className="flex items-center justify-between">
                          {sqlType === 'none' ? 'Nenhum' : sqlType.toUpperCase()}
                          {isAdmin && sqlType !== 'none' && (
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveSql(sqlType, Number(price))} className="h-6 w-6 text-red-500"><Trash2 className="h-3 w-3" /></Button>
                          )}
                        </Label>
                        <Input 
                          type="number" step="0.01" value={Number(price)} 
                          readOnly={!isAdmin} disabled={!isAdmin}
                          className={!isAdmin ? "bg-muted/30" : ""}
                          onChange={(e) => handleUpdateSqlPrice(sqlType, Number(price), Number(e.target.value))}
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Storage Tab */}
          <TabsContent value="storage">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Storage SAS (R$/TB)</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">Bucket S3 utiliza os mesmos preços do Storage SAS.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Brasil */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Brasil</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {['1_10', '11_100', '101_500', '501_1024', 'gt_1024'].map((tier) => {
                          const label = tier === 'gt_1024' ? '>1024 TB' : tier.replace('_', '-') + ' TB';
                          const key = `pricePerTB_${tier}` as keyof StorageRegionPricing;
                          const value = config.storage_pricing?.sas?.br?.[key] || 0;
                          return (
                            <div key={tier} className="space-y-1">
                              <Label className="text-xs">{label}</Label>
                              <Input 
                                type="number" step="0.01" value={value} 
                                readOnly={!isAdmin} disabled={!isAdmin}
                                className={!isAdmin ? "bg-muted/30" : ""}
                                onChange={(e) => {
                                  if (!isAdmin) return;
                                  const newPrice = Number(e.target.value);
                                  updateConfig(prev => ({
                                    ...prev,
                                    storage_pricing: {
                                      ...prev.storage_pricing!,
                                      sas: { ...prev.storage_pricing!.sas, br: { ...prev.storage_pricing!.sas.br, [key]: newPrice } }
                                    }
                                  }));
                                  addLogEntry('UPDATE_ITEM', 'storage_sas_br', label, value, newPrice);
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* USA */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Estados Unidos</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {['1_10', '11_100', '101_500', '501_1024', 'gt_1024'].map((tier) => {
                          const label = tier === 'gt_1024' ? '>1024 TB' : tier.replace('_', '-') + ' TB';
                          const key = `pricePerTB_${tier}` as keyof StorageRegionPricing;
                          const value = config.storage_pricing?.sas?.usa?.[key] || 0;
                          return (
                            <div key={tier} className="space-y-1">
                              <Label className="text-xs">{label}</Label>
                              <Input 
                                type="number" step="0.01" value={value} 
                                readOnly={!isAdmin} disabled={!isAdmin}
                                className={!isAdmin ? "bg-muted/30" : ""}
                                onChange={(e) => {
                                  if (!isAdmin) return;
                                  const newPrice = Number(e.target.value);
                                  updateConfig(prev => ({
                                    ...prev,
                                    storage_pricing: {
                                      ...prev.storage_pricing!,
                                      sas: { ...prev.storage_pricing!.sas, usa: { ...prev.storage_pricing!.sas.usa, [key]: newPrice } }
                                    }
                                  }));
                                  addLogEntry('UPDATE_ITEM', 'storage_sas_usa', label, value, newPrice);
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>SSD NVMe (R$/GB)</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-w-xs space-y-2">
                    <Label>Preço por GB</Label>
                    <Input 
                      type="number" step="0.01" 
                      value={config.storage_pricing?.nvme?.pricePerGB || 0} 
                      readOnly={!isAdmin} disabled={!isAdmin}
                      className={!isAdmin ? "bg-muted/30" : ""}
                      onChange={(e) => {
                        if (!isAdmin) return;
                        const newPrice = Number(e.target.value);
                        const oldPrice = config.storage_pricing?.nvme?.pricePerGB || 0;
                        updateConfig(prev => ({
                          ...prev,
                          storage_pricing: { ...prev.storage_pricing!, nvme: { pricePerGB: newPrice } }
                        }));
                        addLogEntry('UPDATE_ITEM', 'storage_nvme', 'NVMe GB', oldPrice, newPrice);
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Kubernetes Tab */}
          <TabsContent value="kubernetes">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Planos Kubernetes (R$/mês)</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {config.kubernetes_pricing && Object.entries(config.kubernetes_pricing).map(([plan, data]) => {
                    const planData = data as { basePriceMonthly: number; description?: string };
                    return (
                      <div key={plan} className="space-y-2">
                        <Label>{plan}</Label>
                        <Input 
                          type="number" step="0.01" value={planData.basePriceMonthly || 0} 
                          readOnly={!isAdmin} disabled={!isAdmin}
                          className={!isAdmin ? "bg-muted/30" : ""}
                          onChange={(e) => {
                            if (!isAdmin) return;
                            const newPrice = Number(e.target.value);
                            updateConfig(prev => ({
                              ...prev,
                              kubernetes_pricing: {
                                ...prev.kubernetes_pricing,
                                [plan]: { ...planData, basePriceMonthly: newPrice }
                              }
                            }));
                            addLogEntry('UPDATE_ITEM', 'kubernetes_plans', plan, planData.basePriceMonthly, newPrice);
                          }}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Add-ons Kubernetes (R$)</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {config.kubernetes_addons_pricing && Object.entries(config.kubernetes_addons_pricing).map(([addon, price]) => (
                    <div key={addon} className="space-y-2">
                      <Label>{addon}</Label>
                      <Input 
                        type="number" step="0.01" value={price as number || 0} 
                        readOnly={!isAdmin} disabled={!isAdmin}
                        className={!isAdmin ? "bg-muted/30" : ""}
                        onChange={(e) => {
                          if (!isAdmin) return;
                          const newPrice = Number(e.target.value);
                          updateConfig(prev => ({
                            ...prev,
                            kubernetes_addons_pricing: { ...prev.kubernetes_addons_pricing, [addon]: newPrice }
                          }));
                          addLogEntry('UPDATE_ITEM', 'kubernetes_addons', addon, price as number, newPrice);
                        }}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* General Tab */}
          <TabsContent value="geral">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
                <CardContent>
                  <div className="p-4 bg-muted/30 rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground">
                      <strong>Todos os preços são em R$ (BRL).</strong><br />
                      O sistema não utiliza conversão de câmbio.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Descontos por Vigência (%)</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(config.discount).map(([term, discount]) => (
                    <div key={term} className="space-y-2">
                      <Label>{term} {parseInt(term) === 1 ? 'mês' : 'meses'}</Label>
                      <Input 
                        type="number" step="0.1" value={(discount * 100).toFixed(1)} 
                        readOnly={!isAdmin} disabled={!isAdmin}
                        className={!isAdmin ? "bg-muted/30" : ""}
                        onChange={(e) => handleUpdateDiscount(term, discount * 100, Number(e.target.value))}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>OPEN SaaS (R$)</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-w-xs space-y-2">
                    <Label>Preço por Usuário</Label>
                    <Input 
                      type="number" step="0.01" value={config.open_saas_price_per_user || 85} 
                      readOnly={!isAdmin} disabled={!isAdmin}
                      className={!isAdmin ? "bg-muted/30" : ""}
                      onChange={(e) => {
                        if (!isAdmin) return;
                        const newPrice = Number(e.target.value);
                        updateConfig(prev => ({ ...prev, open_saas_price_per_user: newPrice }));
                        addLogEntry('UPDATE_ITEM', 'open_saas', 'Preço/Usuário', config.open_saas_price_per_user || 85, newPrice);
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ============ MODALS ============ */}
      
      {/* PIN Modal */}
      <Dialog open={showPinModal} onOpenChange={setShowPinModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Entrar em Modo Admin</DialogTitle>
            <DialogDescription>Digite o PIN para habilitar edição.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-pin">PIN Admin</Label>
              <Input
                id="admin-pin"
                type="password"
                placeholder="Digite o PIN"
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                className={pinError ? 'border-destructive' : ''}
                autoFocus
              />
              {pinError && <p className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />PIN incorreto.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPinModal(false)}>Cancelar</Button>
            <Button onClick={handlePinSubmit} disabled={!pinInput}><Check className="h-4 w-4 mr-2" />Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Modal */}
      <Dialog open={showLogModal} onOpenChange={setShowLogModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" />Log de Alterações</DialogTitle>
            <DialogDescription>Histórico de alterações de preços.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            {changeLog.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma alteração registrada.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {changeLog.map((entry, index) => (
                  <div key={`${entry.timestamp}-${index}`} className="p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getActionColor(entry.actionType)}>{getActionLabel(entry.actionType)}</Badge>
                      <span className="text-xs text-muted-foreground">{formatLogDate(entry.timestamp)}</span>
                    </div>
                    <p className="text-sm font-medium">{entry.itemName}</p>
                    <p className="text-xs text-muted-foreground">Seção: {entry.section}</p>
                    {(entry.oldValue !== undefined || entry.newValue !== undefined) && (
                      <p className="text-xs">
                        {entry.oldValue !== undefined && <span className="text-red-400 line-through mr-2">{entry.oldValue}</span>}
                        {entry.newValue !== undefined && <span className="text-green-400">→ {entry.newValue}</span>}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter><Button variant="outline" onClick={() => setShowLogModal(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add CPU Modal */}
      <Dialog open={showAddCpuModal} onOpenChange={setShowAddCpuModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar CPU</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input placeholder="Ex: 2x Intel Xeon Gold..." value={newCpu.label || ''} onChange={(e) => setNewCpu(prev => ({ ...prev, label: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={newCpu.price || ''} onChange={(e) => setNewCpu(prev => ({ ...prev, price: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCpuModal(false)}>Cancelar</Button>
            <Button onClick={handleAddCpu} disabled={!newCpu.label}><Plus className="h-4 w-4 mr-2" />Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add RAM Modal */}
      <Dialog open={showAddRamModal} onOpenChange={setShowAddRamModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar RAM</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input placeholder="Ex: 768GB" value={newRam.label || ''} onChange={(e) => setNewRam(prev => ({ ...prev, label: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Capacidade (GB)</Label>
              <Input type="number" placeholder="768" value={newRam.gb || ''} onChange={(e) => setNewRam(prev => ({ ...prev, gb: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={newRam.price || ''} onChange={(e) => setNewRam(prev => ({ ...prev, price: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRamModal(false)}>Cancelar</Button>
            <Button onClick={handleAddRam} disabled={!newRam.label}><Plus className="h-4 w-4 mr-2" />Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Disk Modal */}
      <Dialog open={showAddDiskModal} onOpenChange={setShowAddDiskModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar Disco</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input placeholder="Ex: 8TB NVMe" value={newDisk.label || ''} onChange={(e) => setNewDisk(prev => ({ ...prev, label: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Capacidade (TB)</Label>
              <Input type="number" step="0.1" placeholder="8" value={newDisk.tb || ''} onChange={(e) => setNewDisk(prev => ({ ...prev, tb: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={newDisk.price || ''} onChange={(e) => setNewDisk(prev => ({ ...prev, price: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDiskModal(false)}>Cancelar</Button>
            <Button onClick={handleAddDisk} disabled={!newDisk.label}><Plus className="h-4 w-4 mr-2" />Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add GPU Modal */}
      <Dialog open={showAddGpuModal} onOpenChange={setShowAddGpuModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar GPU</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da GPU</Label>
              <Input placeholder="Ex: NVIDIA L40S" value={newGpu.name} onChange={(e) => setNewGpu(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={newGpu.price || ''} onChange={(e) => setNewGpu(prev => ({ ...prev, price: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddGpuModal(false)}>Cancelar</Button>
            <Button onClick={handleAddGpu} disabled={!newGpu.name}><Plus className="h-4 w-4 mr-2" />Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add SQL Modal */}
      <Dialog open={showAddSqlModal} onOpenChange={setShowAddSqlModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar SQL</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input placeholder="Ex: enterprise" value={newSql.name} onChange={(e) => setNewSql(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={newSql.price || ''} onChange={(e) => setNewSql(prev => ({ ...prev, price: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSqlModal(false)}>Cancelar</Button>
            <Button onClick={handleAddSql} disabled={!newSql.name}><Plus className="h-4 w-4 mr-2" />Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Addon Modal */}
      <Dialog open={showAddAddonModal} onOpenChange={setShowAddAddonModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar Add-on</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Chave (identificador)</Label>
              <Input placeholder="Ex: monitoring_unit" value={newAddon.key} onChange={(e) => setNewAddon(prev => ({ ...prev, key: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nome/Label</Label>
              <Input placeholder="Ex: Monitoramento (unid.)" value={newAddon.label} onChange={(e) => setNewAddon(prev => ({ ...prev, label: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={newAddon.price || ''} onChange={(e) => setNewAddon(prev => ({ ...prev, price: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAddonModal(false)}>Cancelar</Button>
            <Button onClick={handleAddAddon} disabled={!newAddon.key || !newAddon.label}><Plus className="h-4 w-4 mr-2" />Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Empty GPU Save */}
      <AlertDialog open={showConfirmEmptyGpuSave} onOpenChange={setShowConfirmEmptyGpuSave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Configuração vazia de GPU</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a salvar uma configuração sem nenhuma GPU. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSaveEmptyGpuConfig}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Precos;
