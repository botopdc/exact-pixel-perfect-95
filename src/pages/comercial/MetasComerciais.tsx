/**
 * Metas Comerciais - Commercial Goals Management
 * 
 * Allows Admin (1000) and Manager (750) to define yearly sales goals:
 * - Global annual target with quarterly distribution
 * - Monthly distribution (editable)
 * - Executive-level goals allocation
 * 
 * Persists via calculator/config API with category="Metas", section="Comercial"
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import {
  Target,
  Calendar,
  Users,
  Plus,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Wand2,
  Trash2,
  PieChart,
  TrendingUp,
  DollarSign,
  Building2,
  UserPlus,
} from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/calculatorConfig';
import {
  useMetasComerciais,
  YearGoalData,
  ExecutiveGoal,
  MonthlyTargets,
  QuarterWeights,
  MONTH_LABELS,
  MONTH_KEYS,
  DEFAULT_QUARTER_WEIGHTS,
  DEFAULT_MONTHLY_TARGETS,
  createEmptyYearGoal,
  calculateMonthlyFromQuarters,
  calculateQuarterTargets,
  sumMonthlyTargets,
} from '@/hooks/useMetasComerciais';
import { openApi } from '@/lib/openApi';
import { Checkbox } from '@/components/ui/checkbox';

const MetasComerciais = () => {
  const [userLevel, setUserLevel] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [localData, setLocalData] = useState<YearGoalData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddYear, setShowAddYear] = useState(false);
  const [newYearValue, setNewYearValue] = useState<number>(2027);
  const [showAddExecutive, setShowAddExecutive] = useState(false);
  const [availableExecutives, setAvailableExecutives] = useState<any[]>([]);
  const [selectedExecutiveIds, setSelectedExecutiveIds] = useState<number[]>([]);
  const [loadingExecutives, setLoadingExecutives] = useState(false);
  const [executiveToDelete, setExecutiveToDelete] = useState<number | null>(null);

  const {
    yearsData,
    isLoading,
    isError,
    error,
    refetch,
    getYearData,
    getAvailableYears,
    saveYear,
    isSaving,
  } = useMetasComerciais();

  // Check user level
  useEffect(() => {
    openApi.getCurrentUser().then((user) => {
      setUserLevel(user.level);
    }).catch(() => {
      setUserLevel(0);
    });
  }, []);

  // Load year data when selected year changes
  useEffect(() => {
    if (!isLoading) {
      const data = getYearData(selectedYear);
      setLocalData(data);
      setHasChanges(false);
    }
  }, [selectedYear, yearsData, isLoading, getYearData]);

  const canEdit = userLevel === 1000 || userLevel === 750;
  const availableYears = getAvailableYears();

  // Calculations
  const globalSumMonths = useMemo(() => {
    if (!localData) return 0;
    return sumMonthlyTargets(localData.global.monthlyTargets);
  }, [localData]);

  const executivesSumAnnual = useMemo(() => {
    if (!localData) return 0;
    return localData.executives.reduce((sum, e) => sum + (e.annualTarget || 0), 0);
  }, [localData]);

  const distributionDiff = useMemo(() => {
    if (!localData) return 0;
    return localData.global.annualTarget - executivesSumAnnual;
  }, [localData, executivesSumAnnual]);

  const monthsMatchAnnual = useMemo(() => {
    if (!localData) return true;
    return Math.abs(globalSumMonths - localData.global.annualTarget) < 1;
  }, [localData, globalSumMonths]);

  // Update functions
  const updateGlobalField = (field: keyof typeof localData.global, value: number) => {
    if (!localData) return;
    setLocalData({
      ...localData,
      global: { ...localData.global, [field]: value },
    });
    setHasChanges(true);
  };

  const updateQuarterWeight = (quarter: keyof QuarterWeights, value: number) => {
    if (!localData) return;
    const newWeights = { ...localData.global.quarterWeights, [quarter]: value };
    // Recalculate monthly from quarters
    const newMonthly = calculateMonthlyFromQuarters(localData.global.annualTarget, newWeights);
    setLocalData({
      ...localData,
      global: {
        ...localData.global,
        quarterWeights: newWeights,
        monthlyTargets: newMonthly,
      },
    });
    setHasChanges(true);
  };

  const updateMonthlyTarget = (month: keyof MonthlyTargets, value: number) => {
    if (!localData) return;
    setLocalData({
      ...localData,
      global: {
        ...localData.global,
        monthlyTargets: { ...localData.global.monthlyTargets, [month]: value },
      },
    });
    setHasChanges(true);
  };

  const recalculateMonthlyFromQuarters = () => {
    if (!localData) return;
    const newMonthly = calculateMonthlyFromQuarters(
      localData.global.annualTarget,
      localData.global.quarterWeights
    );
    setLocalData({
      ...localData,
      global: { ...localData.global, monthlyTargets: newMonthly },
    });
    setHasChanges(true);
  };

  const updateExecutiveField = (
    execId: number,
    field: keyof ExecutiveGoal,
    value: any
  ) => {
    if (!localData) return;
    setLocalData({
      ...localData,
      executives: localData.executives.map((e) =>
        e.id === execId ? { ...e, [field]: value } : e
      ),
    });
    setHasChanges(true);
  };

  const updateExecutiveAnnual = (execId: number, value: number) => {
    if (!localData) return;
    const mrr = value / 12;
    // Calculate monthly based on global distribution
    const globalAnnual = localData.global.annualTarget || 1;
    const monthlyTargets: MonthlyTargets = { ...DEFAULT_MONTHLY_TARGETS };
    const quarterTargets: QuarterWeights = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

    MONTH_KEYS.forEach((m) => {
      const globalMonthValue = localData.global.monthlyTargets[m] || 0;
      const proportion = globalAnnual > 0 ? globalMonthValue / globalAnnual : 1 / 12;
      monthlyTargets[m] = value * proportion;
    });

    // Calculate quarters
    quarterTargets.Q1 = monthlyTargets.jan + monthlyTargets.feb + monthlyTargets.mar;
    quarterTargets.Q2 = monthlyTargets.apr + monthlyTargets.may + monthlyTargets.jun;
    quarterTargets.Q3 = monthlyTargets.jul + monthlyTargets.aug + monthlyTargets.sep;
    quarterTargets.Q4 = monthlyTargets.oct + monthlyTargets.nov + monthlyTargets.dec;

    setLocalData({
      ...localData,
      executives: localData.executives.map((e) =>
        e.id === execId
          ? { ...e, annualTarget: value, monthlyMRRTarget: mrr, monthlyTargets, quarterTargets }
          : e
      ),
    });
    setHasChanges(true);
  };

  const distributeAutomatically = () => {
    if (!localData || localData.executives.length === 0) return;
    const count = localData.executives.length;
    const perExec = localData.global.annualTarget / count;
    const mrr = perExec / 12;

    const globalAnnual = localData.global.annualTarget || 1;
    const newExecutives = localData.executives.map((e) => {
      const monthlyTargets: MonthlyTargets = { ...DEFAULT_MONTHLY_TARGETS };
      MONTH_KEYS.forEach((m) => {
        const proportion = globalAnnual > 0
          ? (localData.global.monthlyTargets[m] || 0) / globalAnnual
          : 1 / 12;
        monthlyTargets[m] = perExec * proportion;
      });
      const quarterTargets: QuarterWeights = {
        Q1: monthlyTargets.jan + monthlyTargets.feb + monthlyTargets.mar,
        Q2: monthlyTargets.apr + monthlyTargets.may + monthlyTargets.jun,
        Q3: monthlyTargets.jul + monthlyTargets.aug + monthlyTargets.sep,
        Q4: monthlyTargets.oct + monthlyTargets.nov + monthlyTargets.dec,
      };
      return { ...e, annualTarget: perExec, monthlyMRRTarget: mrr, monthlyTargets, quarterTargets };
    });

    setLocalData({ ...localData, executives: newExecutives });
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!localData) return;
    saveYear({ ...localData, updatedAt: new Date().toISOString() });
    setHasChanges(false);
  };

  const handleAddYear = () => {
    if (availableYears.includes(newYearValue)) {
      return;
    }
    const newData = createEmptyYearGoal(newYearValue);
    setLocalData(newData);
    setSelectedYear(newYearValue);
    setHasChanges(true);
    setShowAddYear(false);
  };

  const loadAvailableExecutives = async () => {
    setLoadingExecutives(true);
    try {
      const response = await openApi.getUsers({ level: 700, __perPage: 100 });
      const users = response.data || [];
      // Filter out already added executives
      const existingIds = localData?.executives.map((e) => e.id) || [];
      const available = users.filter((u: any) => !existingIds.includes(u.id));
      setAvailableExecutives(available);
      setSelectedExecutiveIds([]);
    } catch (err) {
      console.error('Error loading executives:', err);
    } finally {
      setLoadingExecutives(false);
    }
  };

  const handleAddExecutives = () => {
    if (!localData || selectedExecutiveIds.length === 0) return;
    const newExecs: ExecutiveGoal[] = selectedExecutiveIds.map((id) => {
      const user = availableExecutives.find((u) => u.id === id);
      return {
        id,
        name: user?.name || `Executivo ${id}`,
        email: user?.email || '',
        teamType: 'interno',
        annualTarget: 0,
        monthlyMRRTarget: 0,
        monthlyTargets: { ...DEFAULT_MONTHLY_TARGETS },
        quarterTargets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
      };
    });
    setLocalData({
      ...localData,
      executives: [...localData.executives, ...newExecs],
    });
    setHasChanges(true);
    setShowAddExecutive(false);
    setSelectedExecutiveIds([]);
  };

  const handleRemoveExecutive = (execId: number) => {
    if (!localData) return;
    setLocalData({
      ...localData,
      executives: localData.executives.filter((e) => e.id !== execId),
    });
    setHasChanges(true);
    setExecutiveToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Target className="h-8 w-8 text-primary" />
            Metas Comerciais
          </h1>
          <p className="text-muted-foreground">
            Defina metas anuais globais e distribua entre executivos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving || !canEdit}>
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </div>

      {isError && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-destructive">{error?.message || 'Erro ao carregar metas'}</p>
          </CardContent>
        </Card>
      )}

      {!canEdit && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <p className="text-amber-600 dark:text-amber-400">
              Você não tem permissão para editar metas. Apenas Admin e Gerente Comercial podem alterar.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Year Tabs */}
      <Tabs value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
        <div className="flex items-center gap-4">
          <TabsList>
            {availableYears.map((year) => (
              <TabsTrigger key={year} value={String(year)}>
                {year}
              </TabsTrigger>
            ))}
          </TabsList>
          <Dialog open={showAddYear} onOpenChange={setShowAddYear}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!canEdit}>
                <Plus className="h-4 w-4 mr-1" />
                Novo Ano
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Ano</DialogTitle>
                <DialogDescription>
                  Crie metas para um novo ano fiscal
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label>Ano</Label>
                <Input
                  type="number"
                  min={2024}
                  max={2050}
                  value={newYearValue}
                  onChange={(e) => setNewYearValue(parseInt(e.target.value) || 2027)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddYear(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddYear}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {availableYears.map((year) => (
          <TabsContent key={year} value={String(year)} className="space-y-6">
            {/* Block A: Global Goal */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Meta Global — {year}
                </CardTitle>
                <CardDescription>
                  Defina a meta anual global e a distribuição por trimestres
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Meta Anual (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={10000}
                      value={localData?.global.annualTarget || ''}
                      onChange={(e) => updateGlobalField('annualTarget', parseFloat(e.target.value) || 0)}
                      disabled={!canEdit}
                      className="text-lg font-semibold"
                    />
                    <p className="text-xs text-muted-foreground">
                      Valor total anual de vendas esperado
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Meta MRR Global (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={localData?.global.globalMRRTarget || ''}
                      onChange={(e) => updateGlobalField('globalMRRTarget', parseFloat(e.target.value) || 0)}
                      disabled={!canEdit}
                      placeholder={`Auto: ${formatCurrencyBRL((localData?.global.annualTarget || 0) / 12)}`}
                    />
                    <p className="text-xs text-muted-foreground">
                      Opcional. Se vazio, usa Anual/12
                    </p>
                  </div>
                </div>

                {/* Quarter Distribution */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Distribuição por Trimestres (%)</Label>
                    <span className="text-sm text-muted-foreground">
                      Total:{' '}
                      <span
                        className={
                          Object.values(localData?.global.quarterWeights || {}).reduce((a, b) => a + b, 0) === 100
                            ? 'text-green-500'
                            : 'text-amber-500'
                        }
                      >
                        {Object.values(localData?.global.quarterWeights || {}).reduce((a, b) => a + b, 0)}%
                      </span>
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                      <div key={q} className="space-y-1">
                        <Label className="text-sm">{q}</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={localData?.global.quarterWeights[q] || ''}
                          onChange={(e) => updateQuarterWeight(q, parseFloat(e.target.value) || 0)}
                          disabled={!canEdit}
                          className="text-center"
                        />
                        <p className="text-xs text-center text-muted-foreground">
                          {formatCurrencyBRL(
                            ((localData?.global.annualTarget || 0) *
                              (localData?.global.quarterWeights[q] || 0)) /
                              100
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={recalculateMonthlyFromQuarters}
                    disabled={!canEdit}
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Recalcular Meses pelos Trimestres
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Block B: Monthly Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Distribuição Mensal — {year}
                </CardTitle>
                <CardDescription>
                  Ajuste os valores mensais manualmente se necessário
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {MONTH_KEYS.map((m) => (
                        <TableHead key={m} className="text-center text-xs px-2">
                          {MONTH_LABELS[m]}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      {MONTH_KEYS.map((m) => (
                        <TableCell key={m} className="p-1">
                          <Input
                            type="number"
                            min={0}
                            step={1000}
                            value={Math.round(localData?.global.monthlyTargets[m] || 0)}
                            onChange={(e) => updateMonthlyTarget(m, parseFloat(e.target.value) || 0)}
                            disabled={!canEdit}
                            className="text-center text-xs h-8"
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      {MONTH_KEYS.map((m) => {
                        const val = localData?.global.monthlyTargets[m] || 0;
                        const pct = localData?.global.annualTarget
                          ? ((val / localData.global.annualTarget) * 100).toFixed(1)
                          : '0.0';
                        return (
                          <TableCell key={m} className="text-center text-xs text-muted-foreground p-1">
                            {pct}%
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={6} className="text-right font-semibold">
                        Total:
                      </TableCell>
                      <TableCell
                        colSpan={6}
                        className={`text-left font-bold ${monthsMatchAnnual ? 'text-green-500' : 'text-amber-500'}`}
                      >
                        {formatCurrencyBRL(globalSumMonths)}
                        {!monthsMatchAnnual && (
                          <span className="ml-2 text-xs font-normal">
                            (Meta: {formatCurrencyBRL(localData?.global.annualTarget || 0)})
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>

            {/* Block C: Executives */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Metas por Executivo — {year}
                    </CardTitle>
                    <CardDescription>
                      Adicione executivos e defina metas individuais
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={distributeAutomatically}
                      disabled={!canEdit || (localData?.executives.length || 0) === 0}
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      Distribuir Automaticamente
                    </Button>
                    <Dialog open={showAddExecutive} onOpenChange={(open) => {
                      setShowAddExecutive(open);
                      if (open) loadAvailableExecutives();
                    }}>
                      <DialogTrigger asChild>
                        <Button size="sm" disabled={!canEdit}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Adicionar Executivo
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Adicionar Executivos</DialogTitle>
                          <DialogDescription>
                            Selecione os executivos (nível 700) para adicionar às metas
                          </DialogDescription>
                        </DialogHeader>
                        {loadingExecutives ? (
                          <div className="py-8 flex justify-center">
                            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                          </div>
                        ) : availableExecutives.length === 0 ? (
                          <p className="text-center py-8 text-muted-foreground">
                            Todos os executivos já foram adicionados
                          </p>
                        ) : (
                          <div className="max-h-64 overflow-y-auto space-y-2">
                            {availableExecutives.map((exec) => (
                              <div
                                key={exec.id}
                                className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer"
                                onClick={() => {
                                  setSelectedExecutiveIds((prev) =>
                                    prev.includes(exec.id)
                                      ? prev.filter((id) => id !== exec.id)
                                      : [...prev, exec.id]
                                  );
                                }}
                              >
                                <Checkbox
                                  checked={selectedExecutiveIds.includes(exec.id)}
                                  onCheckedChange={(checked) => {
                                    setSelectedExecutiveIds((prev) =>
                                      checked
                                        ? [...prev, exec.id]
                                        : prev.filter((id) => id !== exec.id)
                                    );
                                  }}
                                />
                                <div className="flex-1">
                                  <p className="font-medium">{exec.name}</p>
                                  <p className="text-xs text-muted-foreground">{exec.email}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowAddExecutive(false)}>
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleAddExecutives}
                            disabled={selectedExecutiveIds.length === 0}
                          >
                            Adicionar {selectedExecutiveIds.length > 0 && `(${selectedExecutiveIds.length})`}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Distribution Status */}
                <div className="mb-4 p-3 rounded-lg border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {distributionDiff === 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    )}
                    <div>
                      <p className="font-medium">
                        {distributionDiff === 0
                          ? 'Distribuição completa'
                          : distributionDiff > 0
                          ? `Falta distribuir: ${formatCurrencyBRL(distributionDiff)}`
                          : `Excedeu: ${formatCurrencyBRL(Math.abs(distributionDiff))}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Executivos: {formatCurrencyBRL(executivesSumAnnual)} / Meta Global:{' '}
                        {formatCurrencyBRL(localData?.global.annualTarget || 0)}
                      </p>
                    </div>
                  </div>
                  <Progress
                    value={
                      localData?.global.annualTarget
                        ? Math.min((executivesSumAnnual / localData.global.annualTarget) * 100, 100)
                        : 0
                    }
                    className="w-32"
                  />
                </div>

                {/* Executives Table */}
                {(localData?.executives.length || 0) === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum executivo adicionado</p>
                    <p className="text-sm">Clique em "Adicionar Executivo" para começar</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Executivo</TableHead>
                        <TableHead>Equipe</TableHead>
                        <TableHead className="text-right">Meta Anual (R$)</TableHead>
                        <TableHead className="text-right">Meta MRR (R$)</TableHead>
                        <TableHead className="text-center">Q1</TableHead>
                        <TableHead className="text-center">Q2</TableHead>
                        <TableHead className="text-center">Q3</TableHead>
                        <TableHead className="text-center">Q4</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {localData?.executives.map((exec) => (
                        <TableRow key={exec.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{exec.name}</p>
                              <p className="text-xs text-muted-foreground">{exec.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={exec.teamType}
                              onValueChange={(v) => updateExecutiveField(exec.id, 'teamType', v)}
                              disabled={!canEdit}
                            >
                              <SelectTrigger className="w-28 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="interno">Interno</SelectItem>
                                <SelectItem value="externo">Externo</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={10000}
                              value={Math.round(exec.annualTarget || 0)}
                              onChange={(e) =>
                                updateExecutiveAnnual(exec.id, parseFloat(e.target.value) || 0)
                              }
                              disabled={!canEdit}
                              className="w-32 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrencyBRL(exec.monthlyMRRTarget || 0)}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {formatCurrencyBRL(exec.quarterTargets?.Q1 || 0)}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {formatCurrencyBRL(exec.quarterTargets?.Q2 || 0)}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {formatCurrencyBRL(exec.quarterTargets?.Q3 || 0)}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {formatCurrencyBRL(exec.quarterTargets?.Q4 || 0)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExecutiveToDelete(exec.id)}
                              disabled={!canEdit}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className="font-semibold">
                          Total Executivos
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrencyBRL(executivesSumAnnual)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrencyBRL(executivesSumAnnual / 12)}
                        </TableCell>
                        <TableCell colSpan={5}></TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog open={executiveToDelete !== null} onOpenChange={() => setExecutiveToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Executivo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este executivo das metas? A meta individual será perdida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executiveToDelete && handleRemoveExecutive(executiveToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MetasComerciais;
