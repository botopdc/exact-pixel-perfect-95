import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertCardProps {
  tipo: 'warning' | 'error';
  titulo: string;
  descricao: string;
}

export function AlertCard({ tipo, titulo, descricao }: AlertCardProps) {
  return (
    <Alert 
      variant={tipo === 'error' ? 'destructive' : 'default'}
      className={cn(
        tipo === 'warning' && 'border-yellow-500/50 bg-yellow-500/10'
      )}
    >
      {tipo === 'error' ? (
        <XCircle className="h-4 w-4" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
      )}
      <AlertTitle className={cn(tipo === 'warning' && 'text-yellow-600 dark:text-yellow-400')}>
        {titulo}
      </AlertTitle>
      <AlertDescription className={cn(tipo === 'warning' && 'text-yellow-600/80 dark:text-yellow-400/80')}>
        {descricao}
      </AlertDescription>
    </Alert>
  );
}
