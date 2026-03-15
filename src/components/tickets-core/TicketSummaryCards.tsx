// ============================================================================
// TICKET SUMMARY CARDS — KPI cards for queue view
// ============================================================================

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Clock, UserCheck, CheckCircle, RotateCcw, Inbox } from 'lucide-react';
import type { CoreTicket } from '@/services/supportTicketCoreService';

interface Props {
  tickets: CoreTicket[];
}

export function TicketSummaryCards({ tickets }: Props) {
  const novo = tickets.filter(t => t.status === 'novo' || t.status === 'reaberto').length;
  const emAtendimento = tickets.filter(t => t.status === 'em_atendimento' || t.status === 'triagem').length;
  const aguardando = tickets.filter(t => t.status === 'aguardando_cliente' || t.status === 'aguardando_terceiro').length;
  const resolvido = tickets.filter(t => t.status === 'resolvido_suporte').length;
  const semResp = tickets.filter(t => !t.assigned_to_user_id && !['encerrado_cs', 'cancelado'].includes(t.status)).length;
  const slaVencido = tickets.filter(t => {
    if (!t.resolution_due_at) return false;
    return new Date(t.resolution_due_at).getTime() < Date.now() && !['encerrado_cs', 'cancelado', 'resolvido_suporte'].includes(t.status);
  }).length;

  const cards = [
    { label: 'Novos / Reabertos', value: novo, icon: Inbox, color: 'text-blue-400', bg: 'bg-blue-500/15' },
    { label: 'Em Atendimento', value: emAtendimento, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
    { label: 'Aguardando', value: aguardando, icon: RotateCcw, color: 'text-orange-400', bg: 'bg-orange-500/15' },
    { label: 'Resolvido (Suporte)', value: resolvido, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    { label: 'Sem Responsável', value: semResp, icon: UserCheck, color: 'text-purple-400', bg: 'bg-purple-500/15' },
    { label: 'SLA Vencido', value: slaVencido, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/15' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => (
        <Card key={c.label} className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-md ${c.bg}`}>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold leading-none">{c.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{c.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
