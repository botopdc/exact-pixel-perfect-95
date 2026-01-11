import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldX, ArrowLeft } from 'lucide-react';

interface AccessDeniedProps {
  message?: string;
  redirectTo?: string;
  redirectLabel?: string;
}

export function AccessDenied({ 
  message = 'Você não tem permissão para acessar esta página.',
  redirectTo = '/dashboard',
  redirectLabel = 'Voltar ao Dashboard'
}: AccessDeniedProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="open-card text-center py-12 px-8 max-w-md">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Acesso não autorizado
        </h2>
        <p className="text-muted-foreground mb-6">
          {message}
        </p>
        <Button asChild>
          <Link to={redirectTo}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {redirectLabel}
          </Link>
        </Button>
      </div>
    </div>
  );
}
