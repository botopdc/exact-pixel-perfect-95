/**
 * Metas Comerciais - Commercial Goals Management
 * 
 * Allows Admin (1000) and Manager (750) to define yearly sales goals:
 * - Global annual target with quarterly distribution
 * - Monthly distribution (editable)
 * - Executive-level goals allocation
 * 
 * Uses /api/annual-goal endpoint with structure:
 * - manager_id, year, goal, mrr_goal, q1-q4, jan-dec
 * - executives[] with executive_id, role, goal, mrr_goal, q1-q4, jan-dec
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
  QuarterTargets,
  MONTH_LABELS,
  MONTH_KEYS,
  DEFAULT_QUARTER_TARGETS,
  DEFAULT_MONTHLY_TARGETS,
  createEmptyYearGoal,
  sumMonthlyTargets,
  MonthKey,
} from '@/hooks/useMetasComerciais';
import { openApi } from '@/lib/openApi';
import { Checkbox } from '@/components/ui/checkbox';

const ROLE_OPTIONS = ['Comercial', 'BDR', 'Arquiteto de soluções', 'Gerente', 'Outro'];

const MetasComerciais = () => {
  const [userLevel, setUserLevel] = useState<number>(0);
  const [currentUserId, setCurrentUserId] = useState<number>(1);
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
    currentManagerId,
  } = useMetasComerciais();

  // Check user level
  useEffect(() => {
    openApi.getCurrentUser().then((user) => {
      setUserLevel(user.level);
      setCurrentUserId(user.id);
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
    return sumMonthlyTargets(localData.months);
  }, [localData]);

  const executivesSumAnnual = useMemo(() => {
    if (!localData) return 0;
    return localData.executives.reduce((sum, e) => sum + (e.goal || 0), 0);
  }, [localData]);

  const distributionDiff = useMemo(() => {
    if (!localData) return 0;
    return localData.goal - executivesSumAnnual;
  }, [localData, executivesSumAnnual]);

  const monthsMatchAnnual = useMemo(() => {
    if (!localData) return true;
    return Math.abs(globalSumMonths - localData.goal) < 1;
  }, [localData, globalSumMonths]);

  // Calculate quarter weights from quarters
  const quarterWeights = useMemo(() => {
    if (!localData || !localData.goal) return { Q1: 25, Q2: 25, Q3: 25, Q4: 25 };
    const total = localData.goal;
    return {
      Q1: total > 0 ? Math.round((localData.quarters.q1 / total) * 100) : 25,
      Q2: total > 0 ? Math.round((localData.quarters.q2 / total) * 100) : 25,
      Q3: total > 0 ? Math.round((localData.quarters.q3 / total) * 100) : 25,
      Q4: total > 0 ? Math.round((localData.quarters.q4 / total) * 100) : 25,
    };
  }, [localData]);

  // Update functions
  const updateGoalField = (field: 'goal' | 'mrrGoal', value: number) => {
    if (!localData) return;
    setLocalData({
      ...localData,
      [field]: value,
    });
    setHasChanges(true);
  };

  const updateQuarterValue = (quarter: keyof QuarterTargets, value: number) => {
    if (!localData) return;
    setLocalData({
      ...localData,
      quarters: { ...localData.quarters, [quarter]: value },
    });
    setHasChanges(true);
  };

  const updateMonthlyTarget = (month: MonthKey, value: number) => {
    if (!localData) return;
    setLocalData({
      ...localData,
      months: { ...localData.months, [month]: value },
    });
    setHasChanges(true);
  };

  const recalculateMonthlyFromQuarters = () => {
    if (!localData) return;
    const { q1, q2, q3, q4 } = localData.quarters;
    const q1Monthly = q1 / 3;
    const q2Monthly = q2 / 3;
    const q3Monthly = q3 / 3;
    const q4Monthly = q4 / 3;
    
    setLocalData({
      ...localData,
      months: {
        jan: q1Monthly, feb: q1Monthly, mar: q1Monthly,
        apr: q2Monthly, may: q2Monthly, jun: q2Monthly,
        jul: q3Monthly, aug: q3Monthly, sep: q3Monthly,
        oct: q4Monthly, nov: q4Monthly, dec: q4Monthly,
      },
    });
    setHasChanges(true);
  };

  const recalculateQuartersFromGoal = () => {
    if (!localData) return;
    const goal = localData.goal || 0;
    // Distribute evenly
    const quarterValue = goal / 4;
    setLocalData({
      ...localData,
      quarters: {
        q1: quarterValue,
        q2: quarterValue,
        q3: quarterValue,
        q4: quarterValue,
      },
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
        e.executiveId === execId ? { ...e, [field]: value } : e
      ),
    });
    setHasChanges(true);
  };

  const updateExecutiveGoal = (execId: number, value: number) => {
    if (!localData) return;
    const mrrGoal = value / 12;
    // Calculate monthly based on global distribution
    const globalGoal = localData.goal || 1;
    const months: MonthlyTargets = { ...DEFAULT_MONTHLY_TARGETS };
    const quarters: QuarterTargets = { q1: 0, q2: 0, q3: 0, q4: 0 };

    MONTH_KEYS.forEach((m) => {
      const globalMonthValue = localData.months[m] || 0;
      const proportion = globalGoal > 0 ? globalMonthValue / globalGoal : 1 / 12;
      months[m] = value * proportion;
    });

    // Calculate quarters
    quarters.q1 = months.jan + months.feb + months.mar;
    quarters.q2 = months.apr + months.may + months.jun;
    quarters.q3 = months.jul + months.aug + months.sep;
    quarters.q4 = months.oct + months.nov + months.dec;

    setLocalData({
      ...localData,
      executives: localData.executives.map((e) =>
        e.executiveId === execId
          ? { ...e, goal: value, mrrGoal, months, quarters }
          : e
      ),
    });
    setHasChanges(true);
  };

  const distributeAutomatically = () => {
    if (!localData || localData.executives.length === 0) return;
    const count = localData.executives.length;
    const perExec = localData.goal / count;
    const mrrGoal = perExec / 12;

    const globalGoal = localData.goal || 1;
    const newExecutives = localData.executives.map((e) => {
      const months: MonthlyTargets = { ...DEFAULT_MONTHLY_TARGETS };
      MONTH_KEYS.forEach((m) => {
        const proportion = globalGoal > 0
          ? (localData.months[m] || 0) / globalGoal
          : 1 / 12;
        months[m] = perExec * proportion;
      });
      const quarters: QuarterTargets = {
        q1: months.jan + months.feb + months.mar,
        q2: months.apr + months.may + months.jun,
        q3: months.jul + months.aug + months.sep,
        q4: months.oct + months.nov + months.dec,
      };
      return { ...e, goal: perExec, mrrGoal, months, quarters };
    });

    setLocalData({ ...localData, executives: newExecutives });
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!localData) return;
    // Ensure manager_id is set
    const dataToSave = {
      ...localData,
      managerId: localData.managerId || currentManagerId || currentUserId,
      updatedAt: new Date().toISOString(),
    };
    saveYear(dataToSave);
    setHasChanges(false);
  };

  const handleAddYear = () => {
    if (availableYears.includes(newYearValue)) {
      return;
    }
    const newData = createEmptyYearGoal(newYearValue, currentManagerId || currentUserId);
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
      const existingIds = localData?.executives.map((e) => e.executiveId) || [];
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
        executiveId: id,
        name: user?.name || `Executivo ${id}`,
        email: user?.email || '',
        role: 'Comercial',
        goal: 0,
        mrrGoal: 0,
        months: { ...DEFAULT_MONTHLY_TARGETS },
        quarters: { ...DEFAULT_QUARTER_TARGETS },
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
      executives: localData.executives.filter((e) => e.executiveId !== execId),
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
                      value={localData?.goal || ''}
                      onChange={(e) => updateGoalField('goal', parseFloat(e.target.value) || 0)}
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
                      value={localData?.mrrGoal || ''}
                      onChange={(e) => updateGoalField('mrrGoal', parseFloat(e.target.value) || 0)}
                      disabled={!canEdit}
                      placeholder={`Auto: ${formatCurrencyBRL((localData?.goal || 0) / 12)}`}
                    />
                    <p className="text-xs text-muted-foreground">
                      Opcional. Se vazio, usa Anual/12
                    </p>
                  </div>
                </div>

                {/* Quarter Values */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Valores por Trimestre (R$)</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={recalculateQuartersFromGoal}
                      disabled={!canEdit}
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      Distribuir Igualmente
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {(['q1', 'q2', 'q3', 'q4'] as const).map((q) => (
                      <div key={q} className="space-y-1">
                        <Label className="text-sm">{q.toUpperCase()}</Label>
                        <Input
                          type="number"
                          min={0}
                          step={10000}
                          value={Math.round(localData?.quarters[q] || 0)}
                          onChange={(e) => updateQuarterValue(q, parseFloat(e.target.value) || 0)}
                          disabled={!canEdit}
                          className="text-center"
                        />
                        <p className="text-xs text-center text-muted-foreground">
                          {quarterWeights[q.toUpperCase() as keyof typeof quarterWeights]}%
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
                            value={Math.round(localData?.months[m] || 0)}
                            onChange={(e) => updateMonthlyTarget(m, parseFloat(e.target.value) || 0)}
                            disabled={!canEdit}
                            className="text-center text-xs h-8"
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      {MONTH_KEYS.map((m) => {
                        const val = localData?.months[m] || 0;
                        const pct = localData?.goal
                          ? ((val / localData.goal) * 100).toFixed(1)
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
                            (Meta: {formatCurrencyBRL(localData?.goal || 0)})
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
                        {formatCurrencyBRL(localData?.goal || 0)}
                      </p>
                    </div>
                  </div>
                  <Progress
                    value={
                      localData?.goal
                        ? Math.min((executivesSumAnnual / localData.goal) * 100, 100)
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
                        <TableHead>Função</TableHead>
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
                        <TableRow key={exec.executiveId}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{exec.name}</p>
                              <p className="text-xs text-muted-foreground">{exec.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={exec.role}
                              onValueChange={(v) => updateExecutiveField(exec.executiveId, 'role', v)}
                              disabled={!canEdit}
                            >
                              <SelectTrigger className="w-40 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_OPTIONS.map((role) => (
                                  <SelectItem key={role} value={role}>{role}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={10000}
                              value={Math.round(exec.goal || 0)}
                              onChange={(e) =>
                                updateExecutiveGoal(exec.executiveId, parseFloat(e.target.value) || 0)
                              }
                              disabled={!canEdit}
                              className="w-32 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrencyBRL(exec.mrrGoal || 0)}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {formatCurrencyBRL(exec.quarters?.q1 || 0)}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {formatCurrencyBRL(exec.quarters?.q2 || 0)}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {formatCurrencyBRL(exec.quarters?.q3 || 0)}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {formatCurrencyBRL(exec.quarters?.q4 || 0)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExecutiveToDelete(exec.executiveId)}
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
      <AlertDialog
        open={executiveToDelete !== null}
        onOpenChange={() => setExecutiveToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Executivo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este executivo das metas? Esta ação não pode ser desfeita.
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
