import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocsRenderer } from '@/components/docs/DocsRenderer';
import { getDocContent } from '@/data/docs/content';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { fetchSyncRuns, type DocsSyncRun } from '@/services/docsSyncService';

export default function DocsAdminChangelogPage() {
  const [runs, setRuns] = useState<DocsSyncRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSyncRuns().then(setRuns).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const changelogContent = getDocContent('core/open_changelog');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Changelog</h1>
        <p className="text-muted-foreground">Histórico de alterações da documentação e sincronizações.</p>
      </div>

      <Tabs defaultValue="changelog">
        <TabsList>
          <TabsTrigger value="changelog">Changelog</TabsTrigger>
          <TabsTrigger value="sync-history">Sync History</TabsTrigger>
        </TabsList>

        <TabsContent value="changelog" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {changelogContent ? (
                <DocsRenderer content={changelogContent} />
              ) : (
                <p className="text-muted-foreground text-center py-8">Changelog não encontrado.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync-history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Execuções de Sync</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
              ) : runs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma execução registrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Comando</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Arquivos</TableHead>
                      <TableHead>Resumo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map(run => (
                      <TableRow key={run.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(run.created_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{run.command_name}</TableCell>
                        <TableCell>
                          <Badge variant={run.status === 'success' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">
                          {run.files_affected?.join(', ') ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{run.summary ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
