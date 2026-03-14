import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, AlertTriangle, Info, FileText, Download } from 'lucide-react';
import { DOCS_REGISTRY, DOC_CATEGORIES } from '@/data/docs/registry';
import { getDocContent } from '@/data/docs/content';
import { runHealthCheck, type DocsHealthIssue } from '@/services/docsSyncService';

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'error') return <XCircle className="h-4 w-4 text-destructive" />;
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  return <Info className="h-4 w-4 text-blue-500" />;
}

export default function DocsAdminHealthPage() {
  const issues = useMemo(() => runHealthCheck(), []);

  const totalDocs = DOCS_REGISTRY.length;
  const docsWithContent = DOCS_REGISTRY.filter(d => getDocContent(d.file)).length;
  const downloadableDocs = DOCS_REGISTRY.filter(d => d.downloadable).length;
  const visibleDocs = DOCS_REGISTRY.filter(d => d.visibleInMenu).length;
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;

  const healthScore = totalDocs > 0 ? Math.round((docsWithContent / totalDocs) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Saúde da Wiki</h1>
        <p className="text-muted-foreground">Diagnóstico de integridade da documentação interna.</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-foreground">{healthScore}%</p>
            <p className="text-xs text-muted-foreground">Health Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalDocs}</p>
            <p className="text-xs text-muted-foreground">Total Docs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-foreground">{docsWithContent}</p>
            <p className="text-xs text-muted-foreground">Com Conteúdo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-destructive">{errors}</p>
            <p className="text-xs text-muted-foreground">Erros</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-yellow-500">{warnings}</p>
            <p className="text-xs text-muted-foreground">Avisos</p>
          </CardContent>
        </Card>
      </div>

      {/* Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Problemas Detectados</CardTitle>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-muted-foreground">Nenhum problema detectado. Wiki saudável!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">Sev.</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Slug</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue, idx) => (
                  <TableRow key={idx}>
                    <TableCell><SeverityIcon severity={issue.severity} /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{issue.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{issue.message}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{issue.slug ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Document Registry */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registry Completo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Conteúdo</TableHead>
                <TableHead>Download</TableHead>
                <TableHead>Visível</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DOCS_REGISTRY.map(doc => {
                const hasContent = !!getDocContent(doc.file);
                return (
                  <TableRow key={doc.slug}>
                    <TableCell className="text-sm font-medium">{doc.title}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{doc.slug}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{doc.category}</Badge>
                    </TableCell>
                    <TableCell>
                      {hasContent ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell>
                      {doc.downloadable ? (
                        <Download className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {doc.visibleInMenu ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
