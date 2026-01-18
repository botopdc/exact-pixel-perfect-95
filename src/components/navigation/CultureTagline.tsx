import React from 'react';
import { Zap } from 'lucide-react';

interface CultureTaglineProps {
  showSubtext?: boolean;
}

export function CultureTagline({ showSubtext = false }: CultureTaglineProps) {
  return (
    <div className="sticky top-14 z-[5] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/50 px-6 py-2.5">
      <div className="flex items-start gap-2 max-w-full">
        <Zap className="h-3.5 w-3.5 text-primary/75 mt-0.5 flex-shrink-0" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-foreground/75 leading-tight">
            Quando o problema aparece, a <span className="font-semibold text-primary/90">OPEN</span> resolve.
          </p>
          {showSubtext && (
            <p className="text-[11px] sm:text-xs font-normal text-muted-foreground/70 leading-tight">
              Cliente não espera. Prioridade absoluta.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
