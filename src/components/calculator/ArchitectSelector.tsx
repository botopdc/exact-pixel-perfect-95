/**
 * Architect Selector Component
 * 
 * Dropdown for selecting a Solutions Architect (level 690) for a proposal.
 * Used in the OpenCalculator component for proposal creation/editing.
 */

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, Info } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { ApiUser } from '@/lib/openApi';

// ============================================================================
// TYPES
// ============================================================================

interface ArchitectSelectorProps {
  value: number | null;
  onChange: (architectId: number | null) => void;
  disabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ArchitectSelector({ value, onChange, disabled = false }: ArchitectSelectorProps) {
  // Fetch users with level 690 (Arquiteto de Soluções)
  const { data: usersResponse, isLoading, error } = useUsers({ level: 690 });
  
  const architects = (usersResponse?.data || []) as ApiUser[];
  
  // Handle selection change
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

  // If no architects available, show disabled state
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

  // Find selected architect name for display
  const selectedArchitect = architects.find(a => a.id === value);

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
        {value && <Badge variant="secondary" className="ml-2 text-xs">Vinculado</Badge>}
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
              <span>{architect.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default ArchitectSelector;
