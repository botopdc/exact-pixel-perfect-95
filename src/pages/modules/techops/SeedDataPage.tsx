// ============================================================================
// SEED DATA PAGE - Admin Only
// ============================================================================

import React, { useState } from 'react';
import { Database, Play, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ModuleHeader } from '@/components/navigation/ModuleCard';
import { useToast } from '@/hooks/use-toast';
import { runSeed, clearSeedData, type SeedStep } from '@/services/seedService';
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

export default function SeedDataPage() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<SeedStep[]>([]);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleRunSeed() {
    setRunning(true);
    setResult(null);
    setSteps([]);

    try {
      const seedResult = await runSeed((updatedSteps) => {
        setSteps([...updatedSteps]);
      });

      setResult({ success: seedResult.success, error: seedResult.error });
      
      if (seedResult.success) {
        toast({ title: 'Sucesso!', description: 'Dados de exemplo inseridos com sucesso.' });
      } else {
        toast({ title: 'Erro', description: seedResult.error || 'Falha ao inserir dados', variant: 'destructive' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setResult({ success: false, error: errorMessage });
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  }

  async function handleClearData() {
    setClearing(true);
    try {
      const clearResult = await clearSeedData();
      if (clearResult.success) {
        toast({ title: 'Sucesso', description: 'Dados limpos com sucesso.' });
        setSteps([]);
        setResult(null);
      } else {
        toast({ title: 'Erro', description: clearResult.error || 'Falha ao limpar dados', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao limpar dados', variant: 'destructive' });
    } finally {
      setClearing(false);
      setClearDialogOpen(false);
    }
  }

  const completedSteps = steps.filter(s => s.status === 'success').length;
  const totalSteps = steps.length || 6;
  const progress = (completedSteps / totalSteps) * 100;

  return (
    <div className="space-y-6 max-w-3xl">
      <ModuleHeader
        title="Dados de Exemplo"
        description="Inserir dados de teste para o módulo TechOps (ADMIN)"
        icon={Database}
      />

      <Card>
        <CardHeader>
          <CardTitle>Seed de Dados</CardTitle>
          <CardDescription>
            Esta ferramenta insere dados de exemplo nas tabelas do sistema TechOps para fins de teste e demonstração.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Admin Warning */}
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
              ⚠️ Apenas usuários ADMIN podem executar o seed de dados.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              A verificação de permissão é feita automaticamente antes de iniciar a inserção.
            </p>
          </div>

          <div className="p-4 bg-accent/30 rounded-lg">
            <h4 className="font-medium mb-2">O que será inserido:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 5 usuários técnicos (Admin, N1, N2, N3, CS)</li>
              <li>• 5 clientes com diferentes níveis de SLA</li>
              <li>• 7+ assets (VMs, Bare Metal, GPU, Kubernetes)</li>
              <li>• 4+ incidentes em diferentes status</li>
              <li>• 3 plantões ativos</li>
            </ul>
          </div>

          {/* Progress */}
          {steps.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>Progresso: {completedSteps}/{totalSteps} etapas</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />

              {/* Steps */}
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div
                    key={step.table}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      step.status === 'success' ? 'bg-green-500/10 border-green-500/30' :
                      step.status === 'error' ? 'bg-destructive/10 border-destructive/30' :
                      step.status === 'running' ? 'bg-primary/10 border-primary/30' :
                      'bg-muted/50 border-muted'
                    }`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center">
                      {step.status === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : step.status === 'error' ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : step.status === 'running' ? (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{step.name}</span>
                        <Badge variant="outline" className="text-xs">{step.table}</Badge>
                      </div>
                      {step.message && (
                        <p className={`text-sm ${step.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {step.message}
                          {step.count !== undefined && ` (${step.count} registros)`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`p-4 rounded-lg border ${result.success ? 'bg-green-500/10 border-green-500/30' : 'bg-destructive/10 border-destructive/30'}`}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-medium text-green-600 dark:text-green-400">Seed concluído com sucesso!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="font-medium text-destructive">Falha no seed</span>
                  </>
                )}
              </div>
              {result.error && (
                <p className="mt-2 text-sm text-destructive font-mono">{result.error}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handleRunSeed} disabled={running} className="flex-1">
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Inserindo...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Inserir Dados de Exemplo
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setClearDialogOpen(true)}
              disabled={running || clearing}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todos os dados?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover TODOS os dados das tabelas TechOps (usuários, clientes, assets, incidentes, etc.).
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {clearing ? 'Limpando...' : 'Sim, limpar tudo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
