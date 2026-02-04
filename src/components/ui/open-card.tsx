import { tw } from "@matheuscaetano/helprs";
import { SectionTitle } from "./section-title";

export interface OpenCardProps {
  className?: string;
  contentClassName?: string;
  children?: React.ReactNode;
  title: string;
}

export function OpenCard({
  className,
  contentClassName,
  children,
  ...props
}: OpenCardProps) {
  return (
    <div className={tw("open-card", className)} {...props}>
      <SectionTitle>{props.title}</SectionTitle>
      <main
        className={tw(
          contentClassName?.includes("grid") ? "" : "space-y-4 ",
          contentClassName,
        )}
      >
        {children}
      </main>
    </div>
  );
}
