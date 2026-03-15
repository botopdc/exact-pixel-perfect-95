// ============================================================================
// TICKET CREATE MODAL — opens ticket creation form
// ============================================================================

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCreateTicket } from '@/hooks/useSupportTicketCore';
import { CATEGORY_LABELS, TICKET_TYPE_LABELS, SEVERITY_LABELS } from '@/lib/ticketPermissions';
import type { CreateTicketPayload, TicketSeverity } from '@/services/supportTicketCoreService';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (ticketId: string) => void;
}

export function TicketCreateModal({ open, onOpenChange, onCreated }: Props) {
  const { createTicket, isCreating, session } = useCreateTicket();

  const [form, setForm] = useState({
    title: '',
    description: '',
    ticket_type: 'incidente',
    category: 'infraestrutura',
    severity: 'S3' as TicketSeverity,
    service_name: '',
    asset_label: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Título obrigatório';
    if (!form.description.trim()) e.description = 'Descrição obrigatória';
    if (form.title.length > 200) e.title = 'Máximo 200 caracteres';
    if (form.description.length > 5000) e.description = 'Máximo 5000 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !session) return;

    const payload: CreateTicketPayload = {
      title: form.title.trim(),
      description: form.description.trim(),
      ticket_type: form.ticket_type,
      category: form.category,
      severity: form.severity,
      service_name: form.service_name || undefined,
      asset_label: form.asset_label || undefined,
      requester_name: session.name,
      requester_email: session.email,
      requester_user_id: session.userId,
      requester_level: session.level,
      origin_channel: session.level >= 600 ? 'internal_portal' : 'portal',
    };

    try {
      const ticket = await createTicket(payload);
      setForm({ title: '', description: '', ticket_type: 'incidente', category: 'infraestrutura', severity: 'S3', service_name: '', asset_label: '' });
      onOpenChange(false);
      onCreated?.(ticket.id);
    } catch {
      // toast is handled by hook
    }
  };

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Abrir Chamado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Resumo do problema"
              maxLength={200}
            />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>

          <div>
            <Label>Descrição *</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Descreva o problema em detalhes..."
              rows={4}
              maxLength={5000}
            />
            {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.ticket_type} onValueChange={(v) => set('ticket_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TICKET_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Severidade</Label>
            <Select value={form.severity} onValueChange={(v) => set('severity', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Serviço afetado (opcional)</Label>
            <Input
              value={form.service_name}
              onChange={(e) => set('service_name', e.target.value)}
              placeholder="Ex: VM-001, Backup Diário"
            />
          </div>

          <div>
            <Label>Ativo / Hostname (opcional)</Label>
            <Input
              value={form.asset_label}
              onChange={(e) => set('asset_label', e.target.value)}
              placeholder="Ex: srv-web-01"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating ? 'Criando...' : 'Abrir Chamado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
