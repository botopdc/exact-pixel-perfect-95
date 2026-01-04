import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9 rounded-lg transition-colors hover:bg-accent"
        >
          {theme === 'dark' ? (
            <Moon className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Sun className="h-5 w-5 text-muted-foreground" />
          )}
          <span className="sr-only">
            {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</p>
      </TooltipContent>
    </Tooltip>
  );
}
