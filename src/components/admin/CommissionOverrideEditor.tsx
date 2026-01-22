/**
 * Componente de edição de override de comissão para Admin
 * Usado dentro do formulário de edição de usuário
 */

import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Percent, Info, AlertCircle } from 'lucide-react';
import { useCommissionOverride, useUpsertCommissionOverride } from '@/hooks/useCommissionOverride';
import { getDefaultCommissionRate, formatCommissionPct } from '@/services/commissionCalculator';
import { useToast } from '@/hooks/use-toast';

interface CommissionOverrideEditorProps {
  externalUserId: number;
  userLevel: number;
  userName: string;
  adminEmail: string;
  adminName: string;
}

export function CommissionOverrideEditor({
  externalUserId,
  userLevel,
  userName,
  adminEmail,
  adminName,
}: CommissionOverrideEditorProps) {
  const { toast } = useToast();
  
  // Fetch current override
  const { data: currentOverride, isLoading } = useCommissionOverride(externalUserId);
  const upsertMutation = useUpsertCommissionOverride();
  
  // Local state
  const [useOverride, setUseOverride] = useState(false);
  const [overrideValue, setOverrideValue] = useState<number>(1); // Em percentual (1 = 1%)
  const [notes, setNotes] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Initialize from fetched data
  useEffect(() => {
    if (currentOverride) {
      setUseOverride(currentOverride.commission_pct_override !== null);
      if (currentOverride.commission_pct_override !== null) {
        setOverrideValue(currentOverride.commission_pct_override * 100);
      }
      setNotes(currentOverride.notes || '');
    } else {
      setUseOverride(false);
      setOverrideValue(1);
      setNotes('');
    }
    setIsDirty(false);
  }, [currentOverride]);

  // Get default rate for display
  const defaultRate = getDefaultCommissionRate(userLevel, 24); // Usamos 24 meses como referência

  const handleToggle = (checked: boolean) => {
    setUseOverride(checked);
    setIsDirty(true);
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setOverrideValue(value);
      setIsDirty(true);
    }
  };

  const handleSave = async () => {
    const finalValue = useOverride ? overrideValue / 100 : null;

    const result = await upsertMutation.mutateAsync({
      external_user_id: externalUserId,
      commission_pct_override: finalValue,
      notes: notes || null,
      created_by_name: adminName,
      created_by_email: adminEmail,
    });

    if (result.success) {
      toast({
        title: 'Comissão atualizada',
        description: useOverride 
          ? `Comissão personalizada de ${overrideValue.toFixed(1)}% aplicada para ${userName}`
          : `Comissão resetada para regra padrão para ${userName}`,
      });
      setIsDirty(false);
    } else {
      toast({
        title: 'Erro ao atualizar comissão',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  // Níveis que podem ter comissão (Comercial, CS)
  const eligibleLevels = [700, 750, 775];
  const isEligible = eligibleLevels.includes(userLevel);

  if (!isEligible) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Info className="h-4 w-4" />
          <span className="text-sm">
            Configuração de comissão não aplicável para este nível de usuário.
          </span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Percent className="h-5 w-5 text-primary" />
          <Label className="text-base font-medium">Comissão Personalizada</Label>
        </div>
        {currentOverride?.commission_pct_override !== null && currentOverride?.commission_pct_override !== undefined && (
          <Badge variant="outline" className="bg-primary/10 text-primary">
            Override Ativo
          </Badge>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        Regra padrão para este usuário: <strong>{formatCommissionPct(defaultRate)}</strong>
        {userLevel === 775 && ' (CS - 1% fixo)'}
        {(userLevel === 700 || userLevel === 750) && ' (baseado na duração do contrato)'}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={useOverride}
            onCheckedChange={handleToggle}
            id="commission-override-toggle"
          />
          <Label htmlFor="commission-override-toggle" className="text-sm">
            Usar comissão personalizada
          </Label>
        </div>
      </div>

      {useOverride && (
        <div className="space-y-4 pl-4 border-l-2 border-primary/30">
          <div className="flex items-center gap-2">
            <div className="flex-1 max-w-32">
              <Input
                type="number"
                value={overrideValue}
                onChange={handleValueChange}
                step="0.1"
                min="0"
                max="100"
                className="text-right"
              />
            </div>
            <span className="text-lg font-medium">%</span>
          </div>

          {overrideValue > 10 && (
            <div className="flex items-center gap-2 text-amber-500 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Valor acima de 10% - confirme se está correto</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="commission-notes" className="text-sm text-muted-foreground">
              Observações (opcional)
            </Label>
            <Input
              id="commission-notes"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setIsDirty(true); }}
              placeholder="Ex: Acordo especial para contratação"
              maxLength={200}
            />
          </div>
        </div>
      )}

      {isDirty && (
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={upsertMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {upsertMutation.isPending ? 'Salvando...' : 'Salvar Comissão'}
          </button>
        </div>
      )}

      {currentOverride && (
        <div className="text-xs text-muted-foreground pt-2 border-t border-border">
          Última alteração por: {currentOverride.created_by_name || 'Desconhecido'}
          {' - '}
          {new Date(currentOverride.updated_at).toLocaleDateString('pt-BR')}
        </div>
      )}
    </div>
  );
}
