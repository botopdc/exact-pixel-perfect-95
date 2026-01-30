// ============================================================================
// PAGE: Precos - Pricing Configuration using FLAT API structure
// All data comes from API - labels, categories, values, etc.
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Shield,
  ShieldOff,
  History,
  Lock,
  AlertTriangle,
  Check,
  Plus,
  Trash2,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { usePricingConfig } from '@/hooks/usePricingConfig';
import { PricingCategorySection } from '@/components/pricing/PricingCategorySection';
import { PricingItemRow } from '@/components/pricing/PricingItemRow';
import { CalculatorConfigItem, CONFIG_CATEGORIES, ConfigMeta } from '@/services/calculatorConfigService';

// ============ CONSTANTS ============
const ADMIN_PIN = 'OPEN2026';
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

interface NewItemForm {
  label: string;
  value: number;
  meta: Partial<ConfigMeta>;
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

// ============ COMPONENT ============
const Precos = () => {
  // Hook for API persistence
  const {
    items,
    groupedItems,
    isLoading,
    isSaving,
    isDirty: hasLocalChanges,
    updateItemValue,
    addItem,
    removeItem,
    saveChanges,
    resetToApi,
    getItemsByCategory,
    getItemsByCategoryAndSection,
  } = usePricingConfig();

  // Admin state
  const [isAdmin, setIsAdmin] = useState<boolean>(loadAdminState);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Log state
  const [changeLog, setChangeLog] = useState<PriceChangeLog[]>(loadChangeLog);
  const [showLogModal, setShowLogModal] = useState(false);

  // Add item modal state
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemCategory, setAddItemCategory] = useState<string>('');
  const [addItemSection, setAddItemSection] = useState<string>('');
  const [newItemForm, setNewItemForm] = useState<NewItemForm>({
    label: '',
    value: 0,
    meta: {},
  });

  // Persist admin state
  useEffect(() => {
    saveAdminState(isAdmin);
  }, [isAdmin]);

  // Persist log changes
  useEffect(() => {
    saveChangeLog(changeLog);
  }, [changeLog]);

  // Add log entry
  const addLogEntry = useCallback(
    (
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

      setChangeLog((prev) => [entry, ...prev]);
      return true;
    },
    [isAdmin]
  );

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

  // ============ ITEM HANDLERS ============
  const handleValueChange = useCallback(
    (item: CalculatorConfigItem, newValue: number) => {
      if (!isAdmin) {
        toast({
          title: 'Ação bloqueada',
          description: 'Ação permitida somente em Modo Admin',
          variant: 'destructive',
        });
        return;
      }

      const oldValue = item.value;
      updateItemValue(item.id, newValue);
      addLogEntry('UPDATE_ITEM', item.meta?.section || item.meta?.category || 'Geral', item.label, oldValue, newValue);
    },
    [isAdmin, updateItemValue, addLogEntry]
  );

  const handleRemoveItem = useCallback(
    (item: CalculatorConfigItem) => {
      if (!isAdmin) return;

      removeItem(item.id);
      addLogEntry('REMOVE_ITEM', item.meta?.section || item.meta?.category || 'Geral', item.label, item.value, undefined);
      toast({ title: 'Item removido', description: item.label });
    },
    [isAdmin, removeItem, addLogEntry]
  );

  const openAddItemModal = useCallback((category: string, section: string) => {
    setAddItemCategory(category);
    setAddItemSection(section);
    setNewItemForm({ label: '', value: 0, meta: {} });
    setShowAddItemModal(true);
  }, []);

  const handleAddItem = useCallback(() => {
    if (!isAdmin || !newItemForm.label) return;

    const newItem: Omit<CalculatorConfigItem, 'id'> = {
      label: newItemForm.label,
      value: newItemForm.value,
      meta: {
        category: addItemCategory,
        section: addItemSection,
        type: 'BRL',
        by: 'unit',
        ...newItemForm.meta,
      },
    };

    addItem(newItem);
    addLogEntry('ADD_ITEM', addItemSection || addItemCategory, newItemForm.label, undefined, newItemForm.value);
    setShowAddItemModal(false);
    toast({ title: 'Item adicionado', description: newItemForm.label });
  }, [isAdmin, newItemForm, addItemCategory, addItemSection, addItem, addLogEntry]);

  // ============ SAVE HANDLER ============
  const handleSaveConfig = async () => {
    if (!isAdmin) return;
    await saveChanges();
  };

  const handleResetToApi = async () => {
    if (!isAdmin) return;
    await resetToApi();
    addLogEntry('UPDATE_ITEM', 'geral', 'Reset para API', 'configuração local', 'configuração API');
  };

  // ============ MEMOIZED CATEGORY DATA ============
  const vmItems = useMemo(() => getItemsByCategory(CONFIG_CATEGORIES.VM), [getItemsByCategory]);
  const gpuItems = useMemo(() => getItemsByCategory(CONFIG_CATEGORIES.GPU), [getItemsByCategory]);
  const baremetalItems = useMemo(() => getItemsByCategory(CONFIG_CATEGORIES.BAREMETAL), [getItemsByCategory]);
  const addonsItems = useMemo(() => getItemsByCategory(CONFIG_CATEGORIES.ADDONS), [getItemsByCategory]);
  const sqlItems = useMemo(() => getItemsByCategory(CONFIG_CATEGORIES.SQL_SERVER), [getItemsByCategory]);
  const storageItems = useMemo(() => getItemsByCategory(CONFIG_CATEGORIES.STORAGE), [getItemsByCategory]);
  const backupItems = useMemo(() => getItemsByCategory(CONFIG_CATEGORIES.BACKUP), [getItemsByCategory]);
  const kubernetesItems = useMemo(() => getItemsByCategory(CONFIG_CATEGORIES.KUBERNETES), [getItemsByCategory]);
  const geralItems = useMemo(() => getItemsByCategory(CONFIG_CATEGORIES.GERAL), [getItemsByCategory]);

  // Group baremetal by section
  const baremetalCpuItems = useMemo(
    () => baremetalItems.filter((i) => i.meta?.section?.toLowerCase().includes('cpu')),
    [baremetalItems]
  );
  const baremetalRamItems = useMemo(
    () => baremetalItems.filter((i) => i.meta?.section?.toLowerCase().includes('ram')),
    [baremetalItems]
  );
  const baremetalDiskItems = useMemo(
    () => baremetalItems.filter((i) => i.meta?.section?.toLowerCase().includes('disco')),
    [baremetalItems]
  );

  // Group addons by section
  const standardAddons = useMemo(
    () => addonsItems.filter((i) => i.meta?.section === 'Add-ons'),
    [addonsItems]
  );
  const specializedServices = useMemo(
    () => addonsItems.filter((i) => i.meta?.section === 'Serviços Especializados'),
    [addonsItems]
  );

  // Group storage by section
  const storageSasItems = useMemo(
    () => storageItems.filter((i) => i.meta?.section?.includes('SAS')),
    [storageItems]
  );
  const storageNvmeItems = useMemo(
    () => storageItems.filter((i) => i.meta?.section?.includes('NVMe')),
    [storageItems]
  );

  // Group storage SAS by region
  const storageSasBrasil = useMemo(
    () => storageSasItems.filter((i) => i.meta?.region === 'Brasil'),
    [storageSasItems]
  );
  const storageSasUsa = useMemo(
    () => storageSasItems.filter((i) => i.meta?.region === 'Estados Unidos'),
    [storageSasItems]
  );

  // Group backup by retention
  const backup7dias = useMemo(
    () => backupItems.filter((i) => i.meta?.retention === '7 dias'),
    [backupItems]
  );
  const backup15dias = useMemo(
    () => backupItems.filter((i) => i.meta?.retention === '15 dias'),
    [backupItems]
  );
  const backup30dias = useMemo(
    () => backupItems.filter((i) => i.meta?.retention === '30 dias'),
    [backupItems]
  );

  // Group kubernetes by section
  const kubernetesPlanItems = useMemo(
    () => kubernetesItems.filter((i) => i.meta?.section?.includes('Planos')),
    [kubernetesItems]
  );
  const kubernetesAddonItems = useMemo(
    () => kubernetesItems.filter((i) => i.meta?.section?.includes('Add-ons')),
    [kubernetesItems]
  );

  // Group geral by section
  const discountItems = useMemo(
    () => geralItems.filter((i) => i.meta?.section?.includes('Desconto')),
    [geralItems]
  );
  const saasItems = useMemo(
    () => geralItems.filter((i) => i.meta?.section?.includes('SaaS')),
    [geralItems]
  );

  // ============ LOADING STATE ============
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
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
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
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
            <strong>{items.length} itens</strong> carregados da API. Todos os valores são em R$ (BRL).
            {isAdmin && <span className="text-green-500 ml-2">• Modo Admin: edição habilitada.</span>}
            {isSaving && <span className="text-blue-500 ml-2">• Salvando...</span>}
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="vm" className="space-y-6">
          <TabsList className="grid grid-cols-8 w-full max-w-5xl">
            <TabsTrigger value="vm">VM ({vmItems.length})</TabsTrigger>
            <TabsTrigger value="baremetal">BareMetal ({baremetalItems.length})</TabsTrigger>
            <TabsTrigger value="gpu">GPU ({gpuItems.length})</TabsTrigger>
            <TabsTrigger value="addons">Add-ons ({addonsItems.length + sqlItems.length})</TabsTrigger>
            <TabsTrigger value="storage">Storage ({storageItems.length})</TabsTrigger>
            <TabsTrigger value="backup">Backup ({backupItems.length})</TabsTrigger>
            <TabsTrigger value="kubernetes">K8s ({kubernetesItems.length})</TabsTrigger>
            <TabsTrigger value="geral">Geral ({geralItems.length})</TabsTrigger>
          </TabsList>

          {/* VM Tab */}
          <TabsContent value="vm">
            <PricingCategorySection
              title="Preços de VM (R$)"
              items={vmItems}
              isAdmin={isAdmin}
              onValueChange={handleValueChange}
              onAddItem={() => openAddItemModal(CONFIG_CATEGORIES.VM, 'Preços de VM')}
              showAddButton={true}
              columns={4}
            />
          </TabsContent>

          {/* BareMetal Tab */}
          <TabsContent value="baremetal">
            <div className="space-y-6">
              {/* CPU Models */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Modelos de CPU ({baremetalCpuItems.length})</CardTitle>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAddItemModal(CONFIG_CATEGORIES.BAREMETAL, 'Modelos de CPU')}
                      className="gap-1 text-green-500 border-green-500/50"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {baremetalCpuItems.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum modelo configurado.</p>
                  ) : (
                    baremetalCpuItems.map((item) => (
                      <PricingItemRow
                        key={item.id}
                        item={item}
                        isAdmin={isAdmin}
                        onValueChange={handleValueChange}
                        onRemoveItem={handleRemoveItem}
                        showRemoveButton={true}
                      />
                    ))
                  )}
                </CardContent>
              </Card>

              {/* RAM Tiers */}
              <PricingCategorySection
                title={`Opções de RAM (${baremetalRamItems.length})`}
                items={baremetalRamItems}
                isAdmin={isAdmin}
                onValueChange={handleValueChange}
                onAddItem={() => openAddItemModal(CONFIG_CATEGORIES.BAREMETAL, 'Opções de RAM')}
                onRemoveItem={handleRemoveItem}
                showAddButton={true}
                showRemoveButton={true}
                columns={4}
              />

              {/* Disk Options */}
              <PricingCategorySection
                title={`Opções de Disco (${baremetalDiskItems.length})`}
                items={baremetalDiskItems}
                isAdmin={isAdmin}
                onValueChange={handleValueChange}
                onAddItem={() => openAddItemModal(CONFIG_CATEGORIES.BAREMETAL, 'Opções de Disco')}
                onRemoveItem={handleRemoveItem}
                showAddButton={true}
                showRemoveButton={true}
                columns={3}
              />
            </div>
          </TabsContent>

          {/* GPU Tab */}
          <TabsContent value="gpu">
            <PricingCategorySection
              title={`Preços de GPU (${gpuItems.length})`}
              items={gpuItems}
              isAdmin={isAdmin}
              onValueChange={handleValueChange}
              onAddItem={() => openAddItemModal(CONFIG_CATEGORIES.GPU, 'Preços de GPU')}
              onRemoveItem={handleRemoveItem}
              showAddButton={true}
              showRemoveButton={true}
              columns={3}
            />
          </TabsContent>

          {/* Add-ons Tab */}
          <TabsContent value="addons">
            <div className="space-y-6">
              {/* Standard Add-ons */}
              <PricingCategorySection
                title={`Add-ons (${standardAddons.length})`}
                items={standardAddons}
                isAdmin={isAdmin}
                onValueChange={handleValueChange}
                onAddItem={() => openAddItemModal(CONFIG_CATEGORIES.ADDONS, 'Add-ons')}
                onRemoveItem={handleRemoveItem}
                showAddButton={true}
                showRemoveButton={true}
                columns={4}
              />

              {/* Specialized Services */}
              <PricingCategorySection
                title={`Serviços Especializados (${specializedServices.length})`}
                items={specializedServices}
                isAdmin={isAdmin}
                onValueChange={handleValueChange}
                onAddItem={() => openAddItemModal(CONFIG_CATEGORIES.ADDONS, 'Serviços Especializados')}
                onRemoveItem={handleRemoveItem}
                showAddButton={true}
                showRemoveButton={true}
                columns={5}
              />

              {/* SQL Server */}
              <PricingCategorySection
                title={`SQL Server (${sqlItems.length})`}
                items={sqlItems}
                isAdmin={isAdmin}
                onValueChange={handleValueChange}
                onAddItem={() => openAddItemModal(CONFIG_CATEGORIES.SQL_SERVER, 'SQL Server')}
                onRemoveItem={handleRemoveItem}
                showAddButton={true}
                showRemoveButton={true}
                columns={4}
              />
            </div>
          </TabsContent>

          {/* Storage Tab */}
          <TabsContent value="storage">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Storage SAS (R$/TB)</CardTitle>
                  <p className="text-sm text-muted-foreground">Bucket S3 utiliza os mesmos preços do Storage SAS.</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Brasil */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Brasil ({storageSasBrasil.length})</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {storageSasBrasil.map((item) => (
                          <div key={item.id} className="space-y-1">
                            <Label className="text-xs">{item.label}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.value}
                              readOnly={!isAdmin}
                              disabled={!isAdmin}
                              className={!isAdmin ? 'bg-muted/30' : ''}
                              onChange={(e) => handleValueChange(item, Number(e.target.value))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* USA */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Estados Unidos ({storageSasUsa.length})</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {storageSasUsa.map((item) => (
                          <div key={item.id} className="space-y-1">
                            <Label className="text-xs">{item.label}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.value}
                              readOnly={!isAdmin}
                              disabled={!isAdmin}
                              className={!isAdmin ? 'bg-muted/30' : ''}
                              onChange={(e) => handleValueChange(item, Number(e.target.value))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <PricingCategorySection
                title={`SSD NVMe (${storageNvmeItems.length})`}
                items={storageNvmeItems}
                isAdmin={isAdmin}
                onValueChange={handleValueChange}
                columns={2}
              />
            </div>
          </TabsContent>

          {/* Backup Tab */}
          <TabsContent value="backup">
            <Card>
              <CardHeader>
                <CardTitle>Tabela de Backup (R$/GB/mês)</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Preços por faixa de volume para cada plano de retenção
                </p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="7" className="w-full">
                  <TabsList className="grid grid-cols-3 w-full max-w-sm">
                    <TabsTrigger value="7">7 dias ({backup7dias.length})</TabsTrigger>
                    <TabsTrigger value="15">15 dias ({backup15dias.length})</TabsTrigger>
                    <TabsTrigger value="30">30 dias ({backup30dias.length})</TabsTrigger>
                  </TabsList>

                  {[
                    { key: '7', items: backup7dias },
                    { key: '15', items: backup15dias },
                    { key: '30', items: backup30dias },
                  ].map(({ key, items: retentionItems }) => (
                    <TabsContent key={key} value={key} className="mt-4">
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-4 py-2 text-left text-sm font-medium">Faixa (GB)</th>
                              <th className="px-4 py-2 text-right text-sm font-medium">Preço (R$/GB)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {retentionItems.map((item) => (
                              <tr key={item.id} className="border-t">
                                <td className="px-4 py-2 text-sm text-muted-foreground">
                                  {item.meta?.min ?? 0} - {item.meta?.max ?? 0} GB
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <Input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={item.value}
                                    readOnly={!isAdmin}
                                    disabled={!isAdmin}
                                    className={`w-28 text-right ml-auto ${!isAdmin ? 'bg-muted/30' : ''}`}
                                    onChange={(e) => handleValueChange(item, Number(e.target.value))}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Kubernetes Tab */}
          <TabsContent value="kubernetes">
            <div className="space-y-6">
              <PricingCategorySection
                title={`Planos Kubernetes (${kubernetesPlanItems.length})`}
                items={kubernetesPlanItems}
                isAdmin={isAdmin}
                onValueChange={handleValueChange}
                onAddItem={() => openAddItemModal(CONFIG_CATEGORIES.KUBERNETES, 'Preços Base dos Planos')}
                showAddButton={true}
                columns={3}
              />

              <PricingCategorySection
                title={`Add-ons Kubernetes (${kubernetesAddonItems.length})`}
                items={kubernetesAddonItems}
                isAdmin={isAdmin}
                onValueChange={handleValueChange}
                onAddItem={() => openAddItemModal(CONFIG_CATEGORIES.KUBERNETES, 'Add-ons Kubernetes')}
                showAddButton={true}
                columns={3}
              />
            </div>
          </TabsContent>

          {/* General Tab */}
          <TabsContent value="geral">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informações</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-muted/30 rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground">
                      <strong>Todos os preços são em R$ (BRL).</strong>
                      <br />O sistema não utiliza conversão de câmbio.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <PricingCategorySection
                title={`Descontos por Vigência (${discountItems.length})`}
                items={discountItems}
                isAdmin={isAdmin}
                onValueChange={handleValueChange}
                columns={4}
              />

              <PricingCategorySection
                title={`OPEN SaaS (${saasItems.length})`}
                items={saasItems}
                isAdmin={isAdmin}
                onValueChange={handleValueChange}
                columns={2}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ============ MODALS ============ */}

      {/* PIN Modal */}
      <Dialog open={showPinModal} onOpenChange={setShowPinModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Entrar em Modo Admin
            </DialogTitle>
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
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                className={pinError ? 'border-destructive' : ''}
                autoFocus
              />
              {pinError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  PIN incorreto.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPinModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePinSubmit} disabled={!pinInput}>
              <Check className="h-4 w-4 mr-2" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Modal */}
      <Dialog open={showLogModal} onOpenChange={setShowLogModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Log de Alterações
            </DialogTitle>
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
                        {entry.oldValue !== undefined && (
                          <span className="text-red-400 line-through mr-2">{entry.oldValue}</span>
                        )}
                        {entry.newValue !== undefined && <span className="text-green-400">→ {entry.newValue}</span>}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Modal */}
      <Dialog open={showAddItemModal} onOpenChange={setShowAddItemModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
            <DialogDescription>
              Categoria: {addItemCategory} / Seção: {addItemSection}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                placeholder="Ex: vCPU Premium, NVIDIA A100..."
                value={newItemForm.label}
                onChange={(e) => setNewItemForm((prev) => ({ ...prev, label: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newItemForm.value || ''}
                onChange={(e) => setNewItemForm((prev) => ({ ...prev, value: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddItem} disabled={!newItemForm.label}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Precos;
