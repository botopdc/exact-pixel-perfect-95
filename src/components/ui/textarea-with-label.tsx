import * as React from "react";

import { LabelSecondary } from "./LabelSecondary";
import { Textarea } from "./textarea";

export interface TextareaWithLabelProps {
  className?: string;
  placeholder?: string;
  sub?: string;
  type?: string;
  value?: any;
  setValue?: (value: any) => void;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  label?: string;
  step?: number;
  readOnly?: boolean;
}

export const TextareaWithLabel = React.forwardRef<
  HTMLTextAreaElement,
  TextareaWithLabelProps
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
      <Textarea
        value={value}
        onChange={handleChange}
        readOnly={props.readOnly}
        className="bg-input border-border"
        placeholder={placeholder}
      />
      {!!sub?.length && (
        <span className="text-xs text-muted-foreground">{sub}</span>
      )}
    </div>
  );
});
TextareaWithLabel.displayName = "TextareaWithLabel";
