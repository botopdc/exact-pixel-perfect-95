import { tw } from "@matheuscaetano/helprs";
import { Button } from "./button";
import { LabelSecondary } from "./LabelSecondary";

export interface ToggleOptionsProps {
  className?: string;
  value?: number;
  setValue?: (value: number) => void;
  onChange?: ({ target: { value } }: { target: { value: number } }) => void;
  options: { value: number; label: string }[];
  label?: string;
}

export function ToggleOptions({
  className,
  value,
  setValue,
  onChange,
  label,
  options,
}: ToggleOptionsProps) {
  function handleChange(newValue: number) {
    if (onChange) {
      onChange({ target: { value: newValue } });
    }

    if (setValue) {
      setValue(newValue);
    }
  }

  return (
    <div className={tw("", className)}>
      <LabelSecondary>{label}</LabelSecondary>
      <div className="flex gap-2 flex-wrap">
        {options.map((option) => (
          <Button
            key={option.value}
            variant={value === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
