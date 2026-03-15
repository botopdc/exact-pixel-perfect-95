import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ActiveIncident } from '@/hooks/useSupportDashboard';

interface Props {
  incidents: ActiveIncident[];
  loading?: boolean;
}

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

export function ActiveIncidentsCard({ incidents, loading }: Props) {
  if (loading) {
    return (
      <Card className="col-span-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Incidentes Ativos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Incidentes Ativos
          {incidents.length > 0 && (
            <Badge variant="destructive" className="ml-2 text-xs">{incidents.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum incidente crítico ativo
          </p>
        ) : (
          <div className="space-y-2">
            {incidents.map(inc => (
              <Link
                key={inc.id}
                to={`/modulos/atendimentos/suporte-tecnico/${inc.id}`}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant={inc.severity === 'S1' ? 'destructive' : 'secondary'} className="text-xs shrink-0">
                    {inc.severity}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inc.title}</p>
                    <p className="text-xs text-muted-foreground">{inc.public_code}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {timeSince(inc.created_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
