import { tw } from "@matheuscaetano/helprs";

export interface LabelSecondaryProps {
  className?: string;
  children?: React.ReactNode;
}

export function LabelSecondary({
  className,
  children,
  ...props
}: LabelSecondaryProps) {
  return (
    <label
      className={tw("block text-xs text-muted-foreground mb-1", className)}
      {...props}
    >
      {children}
    </label>
  );
}
