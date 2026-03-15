// ============================================================================
// NOTIFICATION BELL — badge + dropdown for internal users
// ============================================================================

import { useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { TICKET_DETAIL_ROUTE } from '@/lib/ticketPermissions';
import { cn } from '@/lib/utils';

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, enabled } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!enabled) return null;

  const handleClick = (n: typeof notifications[0]) => {
    if (!n.is_read) markRead(n.id);
    if (n.ticket_id) {
      navigate(TICKET_DETAIL_ROUTE(n.ticket_id));
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium">Notificações</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => markAllRead()}>
              <CheckCheck className="h-3 w-3 mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem notificações</p>
          ) : (
            <div>
              {notifications.slice(0, 20).map(n => (
                <div
                  key={n.id}
                  className={cn(
                    'px-3 py-2 border-b border-border/30 cursor-pointer hover:bg-muted/50 transition-colors',
                    !n.is_read && 'bg-primary/5',
                  )}
                  onClick={() => handleClick(n)}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{n.title}</p>
                      {n.body && <p className="text-[11px] text-muted-foreground truncate">{n.body}</p>}
                      <div className="flex items-center gap-2 mt-0.5">
                        {n.ticket_public_code && (
                          <span className="text-[10px] font-mono text-primary">{n.ticket_public_code}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{formatRelativeTime(n.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
