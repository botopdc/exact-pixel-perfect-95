// ============================================================================
// TICKET FILTERS — search, status, queue, severity, etc.
// ============================================================================

import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { STATUS_LABELS, CATEGORY_LABELS, SEVERITY_LABELS, QUEUE_LABELS, TICKET_TYPE_LABELS } from '@/lib/ticketPermissions';
import type { TicketListFilters } from '@/services/supportTicketCoreService';

interface Props {
  filters: TicketListFilters;
  onChange: (filters: TicketListFilters) => void;
  showQueueFilter?: boolean;
}

export function TicketFilters({ filters, onChange, showQueueFilter = true }: Props) {
  const [search, setSearch] = useState(filters.search || '');

  const set = (key: keyof TicketListFilters, value: string | undefined) => {
    onChange({ ...filters, [key]: value === '__all__' ? undefined : value });
  };

  const handleSearch = () => {
    onChange({ ...filters, search: search || undefined });
  };

  const clearAll = () => {
    setSearch('');
    onChange({});
  };

  const hasFilters = filters.status || filters.current_queue || filters.severity || filters.category || filters.ticket_type || filters.search;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, título ou solicitante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button variant="secondary" onClick={handleSearch} size="sm">
          <Filter className="h-4 w-4 mr-1" /> Filtrar
        </Button>
        {hasFilters && (
          <Button variant="ghost" onClick={clearAll} size="sm">
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filters.status || '__all__'} onValueChange={(v) => set('status', v)}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showQueueFilter && (
          <Select value={filters.current_queue || '__all__'} onValueChange={(v) => set('current_queue', v)}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Fila" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as filas</SelectItem>
              {Object.entries(QUEUE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={filters.severity || '__all__'} onValueChange={(v) => set('severity', v)}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas</SelectItem>
            {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.category || '__all__'} onValueChange={(v) => set('category', v)}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.ticket_type || '__all__'} onValueChange={(v) => set('ticket_type', v)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {Object.entries(TICKET_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
