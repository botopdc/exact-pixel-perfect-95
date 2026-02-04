import * as React from "react";

import { LabelSecondary } from "./LabelSecondary";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export interface InputWithLabelProps {
  className?: string;
  sub?: string;
  type?: string;
  value?: any;
  setValue?: (value: any) => void;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  label?: string | number;
  asNumber?: boolean;
  options?: ({ label: string | number; value: string | number })[];
}

export const SelectWithLabel = React.forwardRef<
  HTMLSelectElement,
  InputWithLabelProps
>(({ className, type, sub, value, options, asNumber, ...props }, ref) => {
  function handleChange(value) {
    if (props.onChange) {
      props.onChange({
        target: { value: asNumber ? Number(value) : value },
      } as React.ChangeEvent<HTMLSelectElement>);
    }

    if (props.setValue) {
      props.setValue(asNumber ? Number(value) : value);
    }
  }

  return (
    <div className="relative">
      <LabelSecondary>{props.label}</LabelSecondary>
      <Select value={String(value)} onValueChange={handleChange}>
        <SelectTrigger className="bg-input border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((config) => (
            <SelectItem key={config?.value} value={String(config?.value)}>
              {config?.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!!sub?.length && (
        <span className="text-xs text-muted-foreground">{sub}</span>
      )}
    </div>
  );
});
SelectWithLabel.displayName = "SelectWithLabel";
