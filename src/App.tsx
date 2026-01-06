import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import DashboardLayout from '@/layouts/DashboardLayout';
import PartnerLayout from '@/layouts/PartnerLayout';

// Pages
import Login from '@/pages/Login';
import DashboardHome from '@/pages/DashboardHome';
import VagasRH from '@/pages/VagasRH';
import JobForm from '@/pages/JobForm';
import VagasPublic from '@/pages/VagasPublic';
import VagaDetalhe from '@/pages/VagaDetalhe';
import VagasJson from '@/pages/VagasJson';
import Calculadora from '@/pages/Calculadora';
import PropostaView from '@/pages/PropostaView';
import PropostaAceite from '@/pages/PropostaAceite';
import Propostas from '@/pages/Propostas';
import Precos from '@/pages/Precos';
import Artigos from '@/pages/Artigos';
import ArtigoView from '@/pages/ArtigoView';
import ArtigoForm from '@/pages/ArtigoForm';
import FilaSuporte from '@/pages/FilaSuporte';
import CustomerSuccess from '@/pages/CustomerSuccess';
import TicketForm from '@/pages/TicketForm';
import TicketDetalhe from '@/pages/TicketDetalhe';
import KPIsSuporte from '@/pages/KPIsSuporte';
import KPIsCS from '@/pages/KPIsCS';
import KPIsGestao from '@/pages/KPIsGestao';
import HealthScoreCS from '@/pages/HealthScoreCS';
import HealthScoreExecutivo from '@/pages/HealthScoreExecutivo';
import DashboardExecutivo from '@/pages/DashboardExecutivo';
import NotFound from '@/pages/NotFound';

// Partner Pages
import CadastroParceiro from '@/pages/parceiros/CadastroParceiro';
import LoginParceiro from '@/pages/parceiros/LoginParceiro';
import AceiteContrato from '@/pages/parceiros/AceiteContrato';
import DashboardParceiro from '@/pages/parceiros/DashboardParceiro';
import CalculadoraParceiro from '@/pages/parceiros/CalculadoraParceiro';
import IndicacoesParceiro from '@/pages/parceiros/IndicacoesParceiro';
import GestaoParceiroAdmin from '@/pages/parceiros/GestaoParceiroAdmin';
import GestaoComissoes from '@/pages/parceiros/GestaoComissoes';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          
          {/* Public proposal routes (for clients) */}
          <Route path="/proposta/:id" element={<PropostaView />} />
          <Route path="/proposta/:id/aceite" element={<PropostaAceite />} />
          
          {/* Public job routes */}
          <Route path="/vagas" element={<VagasPublic />} />
          <Route path="/vagas/:slug" element={<VagaDetalhe />} />
          <Route path="/vagas.json" element={<VagasJson />} />
          
          {/* Partner public routes */}
          <Route path="/parceiro/cadastro" element={<CadastroParceiro />} />
          <Route path="/parceiro/login" element={<LoginParceiro />} />
          <Route path="/parceiro/contrato" element={<AceiteContrato />} />
          
          {/* Partner protected routes */}
          <Route element={<PartnerLayout />}>
            <Route path="/parceiro/dashboard" element={<DashboardParceiro />} />
            <Route path="/parceiro/calculadora" element={<CalculadoraParceiro />} />
            <Route path="/parceiro/indicacoes" element={<IndicacoesParceiro />} />
          </Route>
          
          {/* Protected dashboard routes */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/rh/vagas" element={<VagasRH />} />
            <Route path="/rh/vagas/nova" element={<JobForm />} />
            <Route path="/rh/vagas/:id/editar" element={<JobForm isEdit />} />
            <Route path="/calculadora" element={<Calculadora />} />
            <Route path="/propostas" element={<Propostas />} />
            <Route path="/precos" element={<Precos />} />
            <Route path="/artigos" element={<Artigos />} />
            <Route path="/artigos/novo" element={<ArtigoForm />} />
            <Route path="/artigos/:id" element={<ArtigoView />} />
            <Route path="/artigos/:id/editar" element={<ArtigoForm isEdit />} />
            <Route path="/atendimentos" element={<Navigate to="/atendimentos/suporte" replace />} />
            <Route path="/atendimentos/suporte" element={<FilaSuporte />} />
            <Route path="/atendimentos/cs" element={<CustomerSuccess />} />
            <Route path="/atendimentos/novo" element={<TicketForm />} />
            <Route path="/atendimentos/:id" element={<TicketDetalhe />} />
            <Route path="/kpis" element={<Navigate to="/kpis/gestao" replace />} />
            <Route path="/kpis/suporte" element={<KPIsSuporte />} />
            <Route path="/kpis/cs" element={<KPIsCS />} />
            <Route path="/kpis/gestao" element={<KPIsGestao />} />
            <Route path="/health-score" element={<Navigate to="/health-score/cs" replace />} />
            <Route path="/health-score/cs" element={<HealthScoreCS />} />
            <Route path="/health-score/executivo" element={<HealthScoreExecutivo />} />
            <Route path="/executivo" element={<DashboardExecutivo />} />
            <Route path="/admin/parceiros" element={<GestaoParceiroAdmin />} />
            <Route path="/admin/comissoes" element={<GestaoComissoes />} />
          </Route>
          
          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
