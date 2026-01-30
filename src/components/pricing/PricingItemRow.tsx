// ============================================================================
// COMPONENT: PricingItemRow - Renders a single pricing item with full width
// ============================================================================

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { CalculatorConfigItem } from '@/services/calculatorConfigService';

interface PricingItemRowProps {
  item: CalculatorConfigItem;
  isAdmin: boolean;
  onValueChange: (item: CalculatorConfigItem, newValue: number) => void;
  onRemoveItem?: (item: CalculatorConfigItem) => void;
  showRemoveButton?: boolean;
}

export function PricingItemRow({
  item,
  isAdmin,
  onValueChange,
  onRemoveItem,
  showRemoveButton = false,
}: PricingItemRowProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
      <div className="md:col-span-3">
        <Label>Descrição</Label>
        <Input
          value={item.label}
          readOnly
          disabled
          className="bg-muted/30"
        />
      </div>
      <div>
        <Label>Preço (R$)</Label>
        <Input
          type="number"
          step="0.01"
          value={item.value}
          readOnly={!isAdmin}
          disabled={!isAdmin}
          className={!isAdmin ? 'bg-muted/30' : ''}
          onChange={(e) => onValueChange(item, Number(e.target.value))}
        />
      </div>
      {isAdmin && showRemoveButton && onRemoveItem && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemoveItem(item)}
          className="text-red-500 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
