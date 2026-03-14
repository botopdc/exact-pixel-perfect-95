import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  generateStaticCoverage,
  fetchCoverage,
  type DocsSyncCoverage,
} from '@/services/docsSyncService';

type CoverageItem = {
  source_type: string;
  source_name: string;
  doc_slug: string;
  is_covered: boolean;
  notes?: string | null;
};

const SOURCE_TYPES = [
  { id: 'module', label: 'Modules' },
  { id: 'table', label: 'Tables' },
  { id: 'edge_function', label: 'Edge Functions' },
  { id: 'event', label: 'Events' },
  { id: 'route', label: 'Routes' },
  { id: 'menu_item', label: 'Sidebar Items' },
];

function CoverageIcon({ covered }: { covered: boolean }) {
  return covered ? (
    <CheckCircle className="h-4 w-4 text-green-500" />
  ) : (
    <XCircle className="h-4 w-4 text-destructive" />
  );
}

export default function DocsAdminCoveragePage() {
  const [items, setItems] = useState<CoverageItem[]>([]);
  const [dbCoverage, setDbCoverage] = useState<DocsSyncCoverage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load static coverage + DB coverage
    const staticItems = generateStaticCoverage();
    setItems(staticItems);

    fetchCoverage()
      .then(setDbCoverage)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Merge DB data over static
  const mergedItems = items.map(item => {
    const dbItem = dbCoverage.find(
      d => d.source_type === item.source_type && d.source_name === item.source_name
    );
    if (dbItem) {
      return { ...item, is_covered: dbItem.is_covered, notes: dbItem.notes, doc_slug: dbItem.doc_slug };
    }
    return item;
  });

  const getItemsByType = (type: string) => mergedItems.filter(i => i.source_type === type);

  const totalCovered = mergedItems.filter(i => i.is_covered).length;
  const totalItems = mergedItems.length;
  const coveragePct = totalItems > 0 ? Math.round((totalCovered / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cobertura Documental</h1>
          <p className="text-muted-foreground">Visão de quais artefatos do sistema possuem documentação.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">{coveragePct}%</p>
            <p className="text-xs text-muted-foreground">{totalCovered}/{totalItems} documentados</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {SOURCE_TYPES.map(st => {
          const typeItems = getItemsByType(st.id);
          const covered = typeItems.filter(i => i.is_covered).length;
          return (
            <Card key={st.id}>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-lg font-bold text-foreground">{covered}/{typeItems.length}</p>
                <p className="text-xs text-muted-foreground">{st.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs per type */}
      <Tabs defaultValue="module">
        <TabsList className="flex-wrap">
          {SOURCE_TYPES.map(st => (
            <TabsTrigger key={st.id} value={st.id}>{st.label}</TabsTrigger>
          ))}
        </TabsList>

        {SOURCE_TYPES.map(st => (
          <TabsContent key={st.id} value={st.id} className="mt-4">
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">Status</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getItemsByType(st.id).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhum item nesta categoria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      getItemsByType(st.id).map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell><CoverageIcon covered={item.is_covered} /></TableCell>
                          <TableCell className="font-mono text-sm">{item.source_name}</TableCell>
                          <TableCell>
                            {item.doc_slug ? (
                              <Badge variant="outline" className="text-xs">{item.doc_slug}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">missing</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.notes ?? '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
