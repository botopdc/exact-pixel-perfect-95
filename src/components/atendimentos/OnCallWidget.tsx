import { Phone, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OnCallShift } from '@/hooks/useSupportDashboard';

interface Props {
  shifts: OnCallShift[];
  loading?: boolean;
}

const TEAM_LABELS: Record<string, string> = {
  infra: 'Infraestrutura',
  cloud: 'Cloud',
  cs: 'Customer Success',
};

export function OnCallWidget({ shifts, loading }: Props) {
  const teams = ['infra', 'cloud', 'cs'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Phone className="h-4 w-4 text-muted-foreground" />
          Plantão Ativo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => {
              const shift = shifts.find((s) => s.team === team && s.is_active);
              return (
                <div key={team} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{TEAM_LABELS[team] || team}</span>
                  {shift ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {shift.user_name}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem plantonista</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
