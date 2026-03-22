/**
 * Architect Selector Component — Supabase-native
 *
 * Busca arquitetos (level 690) direto de public.profiles no Supabase.
 * Substitui a versão anterior que usava useUsers({ level: 690 })
 * → GET /api/user?level=690 (Laravel → 401 Unauthorized).
 */

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

interface Architect {
  id: number;       // legacy_user_id — mantido para compatibilidade com proposal_participants
  uuid: string;     // profiles.id (UUID Supabase)
  name: string;
  email: string;
}

interface ArchitectSelectorProps {
  value: number | null;       // legacy_user_id (compatibilidade com o restante do sistema)
  onChange: (architectId: number | null) => void;
  disabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ArchitectSelector({ value, onChange, disabled = false }: ArchitectSelectorProps) {
  const [architects, setArchitects] = useState<Architect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchArchitects() {
      setIsLoading(true);
      setError(null);
      try {
        // Busca perfis com level 690 (Arquiteto de Soluções) direto do Supabase
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('id, legacy_user_id, name, email')
          .eq('level', 690)
          .eq('is_active', true)
          .order('name');

        if (cancelled) return;

        if (fetchError) {
          console.error('[ArchitectSelector] Supabase error:', fetchError.message);
          setError(fetchError.message);
          return;
        }

        const mapped: Architect[] = (data || [])
          .filter((p: any) => p.legacy_user_id != null) // precisa de legacy_user_id para proposal_participants
          .map((p: any) => ({
            id: p.legacy_user_id as number,
            uuid: p.id,
            name: p.name || p.email || 'Sem nome',
            email: p.email,
          }));

        setArchitects(mapped);
      } catch (err: any) {
        if (!cancelled) {
          console.error('[ArchitectSelector] Unexpected error:', err);
          setError('Erro ao carregar arquitetos');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchArchitects();
    return () => { cancelled = true; };
  }, []);

  const handleValueChange = (selectedValue: string) => {
    if (selectedValue === 'none') {
      onChange(null);
    } else {
      const architectId = parseInt(selectedValue, 10);
      if (!isNaN(architectId)) {
        onChange(architectId);
      }
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Arquiteto de Soluções
        </Label>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          Arquiteto de Soluções
        </Label>
        <div className="text-sm text-destructive">Erro ao carregar arquitetos</div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (architects.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          Arquiteto de Soluções
        </Label>
        <div className="text-sm text-muted-foreground italic">
          Nenhum arquiteto disponível
        </div>
      </div>
    );
  }

  const selectedArchitect = architects.find(a => a.id === value);

  // ── Selector ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        Arquiteto de Soluções
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">
                Selecione um Arquiteto de Soluções para participar desta proposta.
                <br />
                <span className="text-muted-foreground">
                  Comissão: 12m = 1% | 24/36/48m = 0,5% do TCV
                </span>
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {value && (
          <Badge variant="secondary" className="ml-2 text-xs">Vinculado</Badge>
        )}
      </Label>

      <Select
        value={value ? String(value) : 'none'}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione um arquiteto (opcional)">
            {selectedArchitect ? selectedArchitect.name : 'Sem arquiteto'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">Sem arquiteto</span>
          </SelectItem>
          {architects.map((architect) => (
            <SelectItem key={architect.id} value={String(architect.id)}>
              {architect.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default ArchitectSelector;
