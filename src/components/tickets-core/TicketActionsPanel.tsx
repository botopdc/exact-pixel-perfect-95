// ============================================================================
// TICKET ACTIONS PANEL — contextual actions based on permissions
// ============================================================================

import { useState } from 'react';
import {
  UserCheck, Play, ArrowUpRight, Pause, CheckCircle, XCircle,
  RotateCcw, ArrowRightLeft, Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { TicketPermissions } from '@/lib/ticketPermissions';
import type { TicketAction, TicketActionPayload } from '@/services/supportTicketCoreService';

interface Props {
  permissions: TicketPermissions;
  onAction: (action: TicketAction, extra?: Partial<TicketActionPayload>) => Promise<void>;
  isActing: boolean;
}

type ModalConfig = {
  action: TicketAction;
  title: string;
  requireReason: boolean;
  showTargetLevel?: boolean;
  showQueue?: boolean;
} | null;

export function TicketActionsPanel({ permissions, onAction, isActing }: Props) {
  const [modal, setModal] = useState<ModalConfig>(null);
  const [reason, setReason] = useState('');
  const [targetLevel, setTargetLevel] = useState<'N2' | 'N3'>('N2');

  const handleQuickAction = async (action: TicketAction) => {
    await onAction(action);
  };

  const openModal = (config: ModalConfig) => {
    setReason('');
    setTargetLevel('N2');
    setModal(config);
  };

  const handleModalConfirm = async () => {
    if (!modal) return;
    if (modal.requireReason && !reason.trim()) return;
    const extra: Partial<TicketActionPayload> = { reason: reason.trim() || undefined };
    if (modal.showTargetLevel) extra.target_level = targetLevel;
    await onAction(modal.action, extra);
    setModal(null);
  };

  const actions = [
    { action: 'assign' as TicketAction, label: 'Assumir', icon: UserCheck, show: permissions.canAssign, quick: true },
    { action: 'start' as TicketAction, label: 'Iniciar Atendimento', icon: Play, show: permissions.canStart, quick: true },
    { action: 'escalate' as TicketAction, label: 'Escalar', icon: ArrowUpRight, show: permissions.canEscalate, quick: false,
      modal: { action: 'escalate' as TicketAction, title: 'Escalar Ticket', requireReason: true, showTargetLevel: true } },
    { action: 'transfer' as TicketAction, label: 'Transferir', icon: ArrowRightLeft, show: permissions.canTransfer, quick: false,
      modal: { action: 'transfer' as TicketAction, title: 'Transferir Ticket', requireReason: true } },
    { action: 'wait_customer' as TicketAction, label: 'Aguardando Cliente', icon: Pause, show: permissions.canWaitCustomer, quick: false,
      modal: { action: 'wait_customer' as TicketAction, title: 'Colocar em Espera (Cliente)', requireReason: true } },
    { action: 'wait_third_party' as TicketAction, label: 'Aguardando Terceiro', icon: Pause, show: permissions.canWaitThirdParty, quick: false,
      modal: { action: 'wait_third_party' as TicketAction, title: 'Colocar em Espera (Terceiro)', requireReason: true } },
    { action: 'resolve' as TicketAction, label: 'Resolver', icon: CheckCircle, show: permissions.canResolve, quick: false,
      modal: { action: 'resolve' as TicketAction, title: 'Resolver Chamado', requireReason: true } },
    { action: 'close' as TicketAction, label: 'Encerrar', icon: XCircle, show: permissions.canClose, quick: false,
      modal: { action: 'close' as TicketAction, title: 'Encerrar Chamado (CS)', requireReason: true } },
    { action: 'reopen' as TicketAction, label: 'Reabrir', icon: RotateCcw, show: permissions.canReopen, quick: false,
      modal: { action: 'reopen' as TicketAction, title: 'Reabrir Chamado', requireReason: true } },
    { action: 'cancel' as TicketAction, label: 'Cancelar', icon: Ban, show: permissions.canCancel, quick: false,
      modal: { action: 'cancel' as TicketAction, title: 'Cancelar Chamado', requireReason: true } },
  ];

  const visibleActions = actions.filter(a => a.show);
  if (visibleActions.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {visibleActions.map(a => (
          <Button
            key={a.action}
            size="sm"
            variant={a.action === 'cancel' ? 'destructive' : a.action === 'resolve' || a.action === 'close' ? 'default' : 'outline'}
            disabled={isActing}
            onClick={() => a.quick ? handleQuickAction(a.action) : openModal(a.modal!)}
          >
            <a.icon className="h-4 w-4 mr-1" />
            {a.label}
          </Button>
        ))}
      </div>

      {/* Confirmation Modal */}
      <Dialog open={!!modal} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{modal?.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {modal?.showTargetLevel && (
              <div>
                <Label>Nível de escalação</Label>
                <Select value={targetLevel} onValueChange={(v) => setTargetLevel(v as 'N2' | 'N3')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="N2">N2 — Análise Técnica</SelectItem>
                    <SelectItem value="N3">N3 — Engenharia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {modal?.requireReason && (
              <div>
                <Label>Motivo *</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Descreva o motivo..."
                  rows={3}
                  maxLength={1000}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)} disabled={isActing}>Cancelar</Button>
            <Button
              onClick={handleModalConfirm}
              disabled={isActing || (modal?.requireReason && !reason.trim())}
              variant={modal?.action === 'cancel' ? 'destructive' : 'default'}
            >
              {isActing ? 'Processando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
