import { Zap } from 'lucide-react';

export function CultureTagline() {
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70 truncate">
      <Zap className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">
        Quando o problema aparece, a <span className="text-foreground/70">OPEN</span> resolve.
      </span>
    </p>
  );
}
