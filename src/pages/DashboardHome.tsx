import { Clock, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardHome() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      {/* Coming Soon Card */}
      <div className="open-card max-w-lg w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Rocket className="h-10 w-10 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
              <Clock className="h-3 w-3 text-primary-foreground" />
            </div>
          </div>
        </div>
        
        <h2 className="text-2xl font-semibold text-foreground mb-3">
          Novos módulos em breve
        </h2>
        
        <p className="text-muted-foreground mb-6">
          Estamos trabalhando em novas funcionalidades para melhorar sua experiência.
          Fique atento às atualizações!
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm">
            Relatórios
          </span>
          <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm">
            Faturamento
          </span>
          <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm">
            Suporte
          </span>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground mb-2">
          Enquanto isso, explore:
        </p>
        <div className="flex gap-4">
          <Link 
            to="/calculadora" 
            className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
          >
            Calculadora de Preços →
          </Link>
          <Link 
            to="/rh/vagas" 
            className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
          >
            Vagas / RH →
          </Link>
        </div>
      </div>
    </div>
  );
}
