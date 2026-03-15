import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';

interface Props {
  distribution: Record<string, number>;
  unassigned: Record<string, number>;
  breached: Record<string, number>;
  loading?: boolean;
}

const queueLabels: Record<string, string> = {
  N1: 'N1 — Triagem',
  N2: 'N2 — Técnico',
  N3: 'N3 — Engenharia',
  CS: 'CS — Validação',
};

export function TeamCapacityCard({ distribution, unassigned, breached, loading }: Props) {
  const queues = ['N1', 'N2', 'N3', 'CS'];

  if (loading) {
    return (
      <Card className="col-span-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" /> Capacidade do Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {queues.map(q => <Skeleton key={q} className="h-20 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" /> Capacidade do Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {queues.map(q => {
            const active = distribution[q] ?? 0;
            const unass = unassigned[q] ?? 0;
            const breach = breached[q] ?? 0;
            return (
              <div key={q} className="rounded-lg border p-3 space-y-1">
                <p className="text-sm font-semibold">{queueLabels[q] ?? q}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{active}</span>
                  <span className="text-xs text-muted-foreground">ativos</span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>{unass} não atribuídos</span>
                  {breach > 0 && (
                    <span className="text-destructive font-medium">{breach} vencidos</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
