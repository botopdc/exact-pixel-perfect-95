// ============================================================================
// TICKET MESSAGES — public messages + internal notes
// ============================================================================

import { useState } from 'react';
import { Send, Lock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { CoreTicketMessage } from '@/services/supportTicketCoreService';
import type { TicketPermissions } from '@/lib/ticketPermissions';

interface MessagesProps {
  messages: CoreTicketMessage[];
  permissions: TicketPermissions;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function TicketMessages({ messages, permissions }: MessagesProps) {
  const publicMessages = messages.filter(m => !m.is_internal_note);
  const internalNotes = permissions.canViewInternalNotes ? messages.filter(m => m.is_internal_note) : [];

  return (
    <div className="space-y-6">
      {/* Public messages */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Mensagens ({publicMessages.length})
        </h4>
        {publicMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
        ) : (
          <div className="space-y-3">
            {publicMessages.map(m => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      {/* Internal notes — only visible to internal users */}
      {permissions.canViewInternalNotes && internalNotes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-amber-400">
            <Lock className="h-4 w-4" /> Notas Internas ({internalNotes.length})
          </h4>
          <div className="space-y-3">
            {internalNotes.map(m => (
              <MessageBubble key={m.id} message={m} isInternal />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, isInternal }: { message: CoreTicketMessage; isInternal?: boolean }) {
  return (
    <div className={cn(
      'p-3 rounded-lg border text-sm',
      isInternal
        ? 'bg-amber-500/5 border-amber-500/20'
        : 'bg-card border-border/50',
    )}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-xs">{message.author_name}</span>
          {isInternal && <Lock className="h-3 w-3 text-amber-400" />}
          <span className="text-[10px] text-muted-foreground capitalize">({message.author_type})</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{formatDateTime(message.created_at)}</span>
      </div>
      <p className="whitespace-pre-wrap text-foreground/90">{message.body}</p>
    </div>
  );
}

// ── Composer ────────────────────────────────────────────────────────────

interface ComposerProps {
  onSend: (body: string, isInternal: boolean) => Promise<void>;
  permissions: TicketPermissions;
  isSending: boolean;
}

export function TicketMessageComposer({ onSend, permissions, isSending }: ComposerProps) {
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  if (!permissions.canAddPublicMessage && !permissions.canAddInternalNote) return null;

  const handleSend = async () => {
    if (!body.trim()) return;
    await onSend(body.trim(), isInternal);
    setBody('');
  };

  return (
    <div className="space-y-2 pt-3 border-t border-border/50">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isInternal ? 'Escreva uma nota interna...' : 'Escreva uma resposta...'}
        rows={3}
        maxLength={5000}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {permissions.canAddInternalNote && (
            <>
              <Switch
                checked={isInternal}
                onCheckedChange={setIsInternal}
                id="internal-toggle"
              />
              <Label htmlFor="internal-toggle" className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" /> Nota interna
              </Label>
            </>
          )}
        </div>
        <Button size="sm" onClick={handleSend} disabled={!body.trim() || isSending}>
          <Send className="h-4 w-4 mr-1" />
          {isSending ? 'Enviando...' : 'Enviar'}
        </Button>
      </div>
    </div>
  );
}
