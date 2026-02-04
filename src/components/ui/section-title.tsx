import { tw } from "@matheuscaetano/helprs";

export interface SectionTitleProps {
  className?: string;
  children?: React.ReactNode;
}

export function SectionTitle({
  className,
  children,
  ...props
}: SectionTitleProps) {
  return (
    <h2
      className={tw("text-lg font-semibold text-foreground mb-4", className)}
      {...props}
    >
      {children}
    </h2>
  );
}
