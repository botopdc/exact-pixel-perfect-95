import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pencil, Check, X, AlertTriangle } from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/calculatorConfig';

export interface PriceOverride {
  baseTotal: number;       // Valor original do price list (unitPrice * qty)
  overrideTotal: number | null;  // Valor ajustado (se houver)
}

interface EditablePriceCellProps {
  rowIndex: number;
  label: string;
  baseTotal: number;
  currentTotal: number;
  overrideTotal: number | null;
  canEdit: boolean;
  onOverrideChange: (rowIndex: number, newTotal: number | null) => void;
}

// Parse BRL currency input to number
const parseBRLInput = (value: string): number => {
  // Remove R$, spaces, and thousands separators (.)
  const cleaned = value
    .replace(/R\$\s*/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Format number to BRL input format
const formatBRLInput = (value: number): string => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const EditablePriceCell: React.FC<EditablePriceCellProps> = ({
  rowIndex,
  label,
  baseTotal,
  currentTotal,
  overrideTotal,
  canEdit,
  onOverrideChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasOverride = overrideTotal !== null && overrideTotal !== baseTotal;

  // Start editing
  const handleStartEdit = () => {
    if (!canEdit) return;
    setInputValue(formatBRLInput(currentTotal));
    setError(null);
    setIsEditing(true);
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Validate and apply change
  const handleConfirm = () => {
    const newValue = parseBRLInput(inputValue);
    
    // Validation rules
    if (newValue <= 0 || !Number.isFinite(newValue)) {
      setError('Valor inválido');
      return;
    }
    
    if (newValue < baseTotal) {
      setError(`Mínimo: ${formatCurrencyBRL(baseTotal)}`);
      return;
    }
    
    // Optional: cap at 10x base to prevent gross errors
    const maxAllowed = baseTotal * 10;
    if (newValue > maxAllowed) {
      setError(`Máximo: ${formatCurrencyBRL(maxAllowed)}`);
      return;
    }

    // Apply override (or clear if equal to base)
    if (Math.abs(newValue - baseTotal) < 0.01) {
      onOverrideChange(rowIndex, null); // Clear override if equal to base
    } else {
      onOverrideChange(rowIndex, newValue);
    }
    
    setIsEditing(false);
    setError(null);
  };

  // Cancel editing
  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Clear override on double click when has override
  const handleClearOverride = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOverrideChange(rowIndex, null);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              // Small delay to allow click on confirm button
              setTimeout(() => {
                if (isEditing) handleCancel();
              }, 200);
            }}
            className={`w-28 h-7 pl-8 pr-2 text-right text-sm ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
          />
        </div>
        <button
          onClick={handleConfirm}
          className="p-1 rounded hover:bg-green-500/20 text-green-500"
          title="Confirmar"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 rounded hover:bg-red-500/20 text-red-500"
          title="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        {error && (
          <TooltipProvider>
            <Tooltip open>
              <TooltipTrigger asChild>
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-red-500 text-white text-xs">
                {error}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center gap-1.5 ${canEdit ? 'cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1' : ''}`}
            onClick={canEdit ? handleStartEdit : undefined}
          >
            <span className={`font-medium ${hasOverride ? 'text-amber-500' : 'text-foreground'}`}>
              {formatCurrencyBRL(currentTotal)}
            </span>
            {canEdit && (
              <Pencil className={`w-3 h-3 ${hasOverride ? 'text-amber-500' : 'text-muted-foreground opacity-0 group-hover:opacity-100'} transition-opacity`} />
            )}
            {hasOverride && (
              <button
                onClick={handleClearOverride}
                className="p-0.5 rounded hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remover ajuste"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="space-y-1">
            <div className="text-muted-foreground">
              Price list: {formatCurrencyBRL(baseTotal)}
            </div>
            {hasOverride && (
              <div className="text-amber-400">
                Ajuste: +{formatCurrencyBRL((overrideTotal || 0) - baseTotal)}
              </div>
            )}
            {canEdit && !isEditing && (
              <div className="text-muted-foreground/70 text-[10px]">
                Clique para editar
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
