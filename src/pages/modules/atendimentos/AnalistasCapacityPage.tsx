// ============================================================================
// ANALISTAS CAPACITY PAGE — Visão de produtividade por analista
// Rota: /modulos/atendimentos/analistas
// ============================================================================

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import { ModuleHeader } from '@/components/navigation/ModuleCard';

interface AnalystRow {
  user_name: string;
  user_email: string;
  queue_code: string;
  is_primary: boolean;
}

interface TicketRow {
  assigned_to_name: string | null;
  status: string;
  resolution_due_at: string | null;
  first_response_due_at: string | null;
  created_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
}

interface AnalystSummary {
  name: string;
  email: string;
  queue: string;
  isPrimary: boolean;
  activeTickets: number;
  breachedTickets: number;
  resolvedToday: number;
}

function useAnalystCapacity() {
  return useQuery({
    queryKey: ['analyst-capacity'],
    queryFn: async (): Promise<AnalystSummary[]> => {
      // Get queue members
      const { data: members } = await supabase
        .from('support_queue_members')
        .select('user_name, user_email, queue_id, is_primary, is_active')
        .eq('is_active', true);

      const { data: queues } = await supabase
        .from('support_queues')
        .select('id, code')
        .eq('is_active', true);

      const queueMap: Record<string, string> = {};
      (queues || []).forEach(q => { queueMap[q.id] = q.code; });

      // Get open tickets
      const now = new Date().toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: tickets } = await supabase
        .from('support_tickets')
        .select('assigned_to_name, status, resolution_due_at, first_response_due_at, created_at, first_response_at, resolved_at')
        .is('deleted_at', null);

      const openStatuses = ['novo', 'triagem', 'em_atendimento', 'aguardando_cliente', 'aguardando_terceiro', 'reaberto'];

      // Build analyst summaries
      const analystMap = new Map<string, AnalystSummary>();
      (members || []).forEach(m => {
        if (!analystMap.has(m.user_email)) {
          analystMap.set(m.user_email, {
            name: m.user_name,
            email: m.user_email,
            queue: queueMap[m.queue_id] || '—',
            isPrimary: m.is_primary,
            activeTickets: 0,
            breachedTickets: 0,
            resolvedToday: 0,
          });
        }
      });

      (tickets || []).forEach((t: any) => {
        if (!t.assigned_to_name) return;
        // Find analyst by name match
        for (const [, a] of analystMap) {
          if (a.name === t.assigned_to_name) {
            if (openStatuses.includes(t.status)) {
              a.activeTickets++;
              const isDue = (t.resolution_due_at && t.resolution_due_at < now) ||
                            (t.first_response_due_at && t.first_response_due_at < now);
              if (isDue) a.breachedTickets++;
            }
            if (t.resolved_at && new Date(t.resolved_at) >= todayStart) {
              a.resolvedToday++;
            }
          }
        }
      });

      return Array.from(analystMap.values()).sort((a, b) => b.activeTickets - a.activeTickets);
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export default function AnalistasCapacityPage() {
  const { data: analysts, isLoading } = useAnalystCapacity();

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Analistas"
        description="Capacidade e produtividade do time de suporte"
        icon={Users}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-36 w-full" />)}
        </div>
      ) : !analysts || analysts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum analista cadastrado nas filas de suporte.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {analysts.map(a => (
            <Card key={a.email}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{a.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">{a.queue}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{a.email}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xl font-bold">{a.activeTickets}</p>
                    <p className="text-xs text-muted-foreground">Ativos</p>
                  </div>
                  <div>
                    <p className={`text-xl font-bold ${a.breachedTickets > 0 ? 'text-destructive' : ''}`}>
                      {a.breachedTickets}
                    </p>
                    <p className="text-xs text-muted-foreground">Vencidos</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">{a.resolvedToday}</p>
                    <p className="text-xs text-muted-foreground">Resolvidos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
