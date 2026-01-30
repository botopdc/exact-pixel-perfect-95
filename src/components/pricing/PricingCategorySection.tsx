// ============================================================================
// COMPONENT: PricingCategorySection - Renders a section of pricing items from API
// ============================================================================

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { CalculatorConfigItem } from '@/services/calculatorConfigService';

interface PricingCategorySectionProps {
  title: string;
  items: CalculatorConfigItem[];
  isAdmin: boolean;
  onValueChange: (item: CalculatorConfigItem, newValue: number) => void;
  onAddItem?: () => void;
  onRemoveItem?: (item: CalculatorConfigItem) => void;
  showAddButton?: boolean;
  showRemoveButton?: boolean;
  columns?: number;
  unitLabel?: string;
}

export function PricingCategorySection({
  title,
  items,
  isAdmin,
  onValueChange,
  onAddItem,
  onRemoveItem,
  showAddButton = false,
  showRemoveButton = false,
  columns = 4,
  unitLabel,
}: PricingCategorySectionProps) {
  const gridClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-5',
  }[columns] || 'grid-cols-2 md:grid-cols-4';

  const formatLabel = (item: CalculatorConfigItem): string => {
    // Use label from API, add unit suffix if available
    let label = item.label;
    if (item.meta?.by && unitLabel === undefined) {
      const byMap: Record<string, string> = {
        unit: '(unid.)',
        GB: '(GB)',
        TB: '(TB)',
        hour: '(hora)',
        month: '(mês)',
      };
      const suffix = byMap[item.meta.by];
      if (suffix && !label.includes(suffix) && !label.includes('(')) {
        label = `${label} ${suffix}`;
      }
    }
    return label;
  };

  const isPercentage = items.some(item => item.meta?.type === 'percentage');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {isAdmin && showAddButton && onAddItem && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddItem}
            className="gap-1 text-green-500 border-green-500/50"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        )}
      </CardHeader>
      <CardContent className={`grid ${gridClass} gap-4`}>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm col-span-full">
            Nenhum item configurado.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="space-y-2">
              <Label className="flex items-center justify-between text-sm">
                <span className="truncate">{formatLabel(item)}</span>
                {isAdmin && showRemoveButton && onRemoveItem && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveItem(item)}
                    className="h-6 w-6 text-red-500 hover:bg-red-500/10 ml-1 flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </Label>
              <Input
                type="number"
                step={isPercentage ? '0.1' : '0.01'}
                value={isPercentage ? (item.value || 0) : item.value}
                readOnly={!isAdmin}
                disabled={!isAdmin}
                className={!isAdmin ? 'bg-muted/30' : ''}
                onChange={(e) => onValueChange(item, Number(e.target.value))}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
