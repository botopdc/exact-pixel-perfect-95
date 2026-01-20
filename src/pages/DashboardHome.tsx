import { useEffect, useState } from 'react';
import { Clock, Rocket, Heart, Ticket, Users, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { seedSampleTickets, listarTickets } from '@/services/ticketsService';
import { getAllClientHealthScores, getHealthScoreDistribution  } from '@/services/healthScoreService';
import { HealthScoreBadge } from '@/components/health/HealthScoreBadge';
import { getHealthStatus } from '@/types/healthScore';
import { toast } from 'sonner';

export default function DashboardHome() {
  const [ticketCount, setTicketCount] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [distribution, setDistribution] = useState({ saudavel: 0, atencao: 0, risco: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const tickets = listarTickets();
    setTicketCount(tickets.length);
    
    const clients = getAllClientHealthScores();
    setClientCount(clients.length);
    
    setDistribution(getHealthScoreDistribution());
  };

  const handleSeedData = () => {
    seedSampleTickets();
    loadData();
    toast.success('Tickets de exemplo criados com sucesso!');
  };

  return (
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tickets</p>
                <p className="text-3xl font-bold">{ticketCount}</p>
              </div>
              <Ticket className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes</p>
                <p className="text-3xl font-bold">{clientCount}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes Saudáveis</p>
                <p className="text-3xl font-bold text-green-600">{distribution.saudavel}</p>
              </div>
              <Heart className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes em Risco</p>
                <p className="text-3xl font-bold text-red-600">{distribution.risco}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seed Data Button (only if no tickets) */}
      {ticketCount === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="py-8 text-center">
            <Rocket className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Sem dados para exibir</h3>
            <p className="text-muted-foreground mb-4">
              Crie tickets de exemplo para testar os dashboards de KPIs e Health Score
            </p>
            <Button onClick={handleSeedData}>
              Criar Tickets de Exemplo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Coming Soon Card */}
      <div className="open-card max-w-lg w-full mx-auto text-center">
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
        </div>
      </div>

      {/* Quick Links */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-2">
          Explore os módulos:
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link 
            to="/modulos/atendimentos/suporte" 
            className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
          >
            Fila de Suporte →
          </Link>
          <Link 
            to="/modulos/atendimentos/health/cs" 
            className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
          >
            Health Score →
          </Link>
          <Link 
            to="/modulos/atendimentos/kpis/gestao" 
            className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
          >
            KPIs de Gestão →
          </Link>
          <Link 
            to="/modulos/comercial/propostas/criar" 
            className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
          >
            Calculadora de Preços →
          </Link>
        </div>
      </div>
    </div>
  );
}
