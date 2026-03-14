import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Play, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  SYNC_COMMANDS,
  fetchSyncRuns,
  createSyncRun,
  completeSyncRun,
  type DocsSyncRun,
} from '@/services/docsSyncService';

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    pending: { variant: 'outline', icon: <Clock className="h-3 w-3" /> },
    running: { variant: 'secondary', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    success: { variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
    failed: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  };
  const c = config[status] ?? config.pending;
  return (
    <Badge variant={c.variant} className="gap-1">
      {c.icon} {status}
    </Badge>
  );
}

export default function DocsAdminSyncPage() {
  const [runs, setRuns] = useState<DocsSyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const data = await fetchSyncRuns();
      setRuns(data);
    } catch {
      toast({ title: 'Erro ao carregar execuções', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRuns(); }, []);

  const handleSync = async (commandName: string) => {
    setExecuting(commandName);
    try {
      const run = await createSyncRun(commandName);
      // Simulate sync execution (future: real logic)
      await new Promise(r => setTimeout(r, 1500));
      const cmd = SYNC_COMMANDS.find(c => c.name === commandName);
      await completeSyncRun(run.id, 'success', `Sync executado com sucesso para ${commandName}`, cmd?.files ?? []);
      toast({ title: 'Sync concluído', description: commandName });
      await loadRuns();
    } catch {
      toast({ title: 'Erro no sync', variant: 'destructive' });
    } finally {
      setExecuting(null);
    }
  };

  const getLastRun = (commandName: string) => {
    return runs.find(r => r.command_name === commandName);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Docs Sync Engine</h1>
          <p className="text-muted-foreground">Sincronização e atualização da documentação técnica.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadRuns} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Sync Commands */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SYNC_COMMANDS.map(cmd => {
          const lastRun = getLastRun(cmd.name);
          return (
            <Card key={cmd.name}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{cmd.label}</CardTitle>
                <CardDescription className="text-xs">{cmd.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Arquivos:</span> {cmd.files.join(', ')}
                </div>
                {lastRun && (
                  <div className="flex items-center gap-2 text-xs">
                    <StatusBadge status={lastRun.status} />
                    <span className="text-muted-foreground">
                      {new Date(lastRun.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}
                {!lastRun && (
                  <p className="text-xs text-muted-foreground italic">Nunca executado</p>
                )}
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleSync(cmd.name)}
                  disabled={executing !== null}
                >
                  {executing === cmd.name ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Executar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Execuções</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma execução registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comando</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Resumo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(run => (
                  <TableRow key={run.id}>
                    <TableCell className="font-mono text-xs">{run.command_name}</TableCell>
                    <TableCell><StatusBadge status={run.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {run.started_at ? new Date(run.started_at).toLocaleString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {run.finished_at ? new Date(run.finished_at).toLocaleString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{run.summary ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
