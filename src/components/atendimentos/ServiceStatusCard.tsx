import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity } from 'lucide-react';
import type { ServiceStatus } from '@/hooks/useSupportDashboard';

interface Props {
  services: ServiceStatus[];
  loading?: boolean;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; dot: string }> = {
  operational: { label: 'Operacional', variant: 'default', dot: 'bg-green-500' },
  degraded: { label: 'Degradado', variant: 'secondary', dot: 'bg-yellow-500' },
  down: { label: 'Indisponível', variant: 'destructive', dot: 'bg-red-500' },
  maintenance: { label: 'Manutenção', variant: 'outline', dot: 'bg-blue-500' },
};

export function ServiceStatusCard({ services, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" /> Status do Ambiente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" /> Status do Ambiente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum serviço configurado</p>
        ) : (
          <div className="space-y-3">
            {services.map(svc => {
              const cfg = statusConfig[svc.status] || statusConfig.operational;
              return (
                <div key={svc.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                    <span className="text-sm font-medium">{svc.service_name}</span>
                  </div>
                  <Badge variant={cfg.variant} className="text-xs">
                    {cfg.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
