import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  distribution: Record<string, number>;
  loading?: boolean;
}

const QUEUE_COLORS: Record<string, string> = {
  N1: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  N2: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  N3: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  CS: 'bg-green-500/10 text-green-600 border-green-500/30',
};

export function QueueDistributionCard({ distribution, loading }: Props) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Distribuição por Fila
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(distribution).map(([queue, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={queue} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={QUEUE_COLORS[queue] || ''}>
                      {queue}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{count} ticket(s)</span>
                  </div>
                  <div className="flex items-center gap-2 w-32">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
