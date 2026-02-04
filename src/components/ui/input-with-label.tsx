import * as React from "react";

import { LabelSecondary } from "./LabelSecondary";
import { Input } from "./input";

export interface InputWithLabelProps {
  className?: string;
  placeholder?: string;
  sub?: string;
  type?: string;
  value?: any;
  setValue?: (value: any) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  step?: number;
  readOnly?: boolean;
}

export const InputWithLabel = React.forwardRef<
  HTMLInputElement,
  InputWithLabelProps
>(({ className, type, sub, value, setValue, placeholder, ...props }, ref) => {
  function handleChange(e) {
    if (props.onChange) {
      props.onChange(e);
    }

    if (setValue) {
      setValue(e.target.value);
    }
  }

  return (
    <div className="relative">
      <LabelSecondary>{props.label}</LabelSecondary>
      <Input
        type={type}
        value={value}
        onChange={handleChange}
        min={0}
        readOnly={props.readOnly}
        step={props.step || 1}
        className="bg-input border-border"
        placeholder={placeholder}
      />
      {!!sub?.length && (
        <span className="text-xs text-muted-foreground">{sub}</span>
      )}
    </div>
  );
});
Input.displayName = "Input";
