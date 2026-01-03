import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  useProposalEventStats, 
  getEventTypeLabel, 
  getEventTypeColor,
  ProposalEventStats 
} from '@/hooks/useProposalEvents';
import { Eye, Link, Mail, FileDown, Check, X, Clock, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ProposalAccessModalProps {
  proposalId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number; color?: string }> = ({
  icon,
  label,
  value,
  color = 'text-primary',
}) => (
  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
    <div className={`${color}`}>{icon}</div>
    <div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </div>
);

const ProposalAccessModal: React.FC<ProposalAccessModalProps> = ({
  proposalId,
  open,
  onOpenChange,
}) => {
  const { data: stats, isLoading } = useProposalEventStats(open ? proposalId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Histórico de Acessos
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : !stats || stats.timeline.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum evento registrado ainda.</p>
            <p className="text-sm">Os acessos aparecerão aqui conforme a proposta for visualizada.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={<Eye className="w-5 h-5" />}
                label="Visualizações"
                value={stats.totalViews}
                color="text-blue-500"
              />
              <StatCard
                icon={<Link className="w-5 h-5" />}
                label="Links Copiados"
                value={stats.linkCopies}
                color="text-purple-500"
              />
              <StatCard
                icon={<Mail className="w-5 h-5" />}
                label="Emails"
                value={stats.emailsSent}
                color="text-cyan-500"
              />
            </div>

            {/* Additional stats row */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={<FileDown className="w-5 h-5" />}
                label="PDFs"
                value={stats.pdfDownloads}
                color="text-orange-500"
              />
              <StatCard
                icon={<Check className="w-5 h-5" />}
                label={stats.accepted ? 'Aceita' : 'Aceites'}
                value={stats.accepted ? 1 : 0}
                color="text-green-500"
              />
              <StatCard
                icon={<X className="w-5 h-5" />}
                label={stats.rejected ? 'Recusada' : 'Recusas'}
                value={stats.rejected ? 1 : 0}
                color="text-red-500"
              />
            </div>

            {/* Last activity */}
            {stats.lastActivity && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/20 p-2 rounded">
                <Clock className="w-4 h-4" />
                <span>Última atividade:</span>
                <span className="font-medium text-foreground">
                  {getEventTypeLabel(stats.lastActivity.type)}
                </span>
                <span>em {formatTimestamp(stats.lastActivity.timestamp)}</span>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">Linha do Tempo</h4>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {stats.timeline.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between text-sm py-2 px-3 bg-muted/20 rounded"
                    >
                      <span className={`font-medium ${getEventTypeColor(event.type)}`}>
                        {getEventTypeLabel(event.type)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProposalAccessModal;