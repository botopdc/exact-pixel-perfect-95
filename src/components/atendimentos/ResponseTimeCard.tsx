import { Timer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  avgFirstResponseMinutes: number;
  avgResolutionMinutes: number;
  loading?: boolean;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function ResponseTimeCard({ avgFirstResponseMinutes, avgResolutionMinutes, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Timer className="h-4 w-4 text-muted-foreground" />
          Tempo Médio (últimos 30 dias)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">{formatMinutes(avgFirstResponseMinutes)}</p>
              <p className="text-xs text-muted-foreground">Primeira resposta</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{formatMinutes(avgResolutionMinutes)}</p>
              <p className="text-xs text-muted-foreground">Resolução</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
