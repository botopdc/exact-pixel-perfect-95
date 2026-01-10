import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import DashboardLayout from '@/layouts/DashboardLayout';
import PartnerLayout from '@/layouts/PartnerLayout';
import ExecutiveLayout from '@/layouts/ExecutiveLayout';

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
import PropostasParceiro from '@/pages/parceiros/PropostasParceiro';
import GestaoParceiroAdmin from '@/pages/parceiros/GestaoParceiroAdmin';
import GestaoComissoes from '@/pages/parceiros/GestaoComissoes';
import DashboardExecutivoParceiros from '@/pages/parceiros/DashboardExecutivoParceiros';
import PropostasAdmin from '@/pages/parceiros/PropostasAdmin';
import ApiTest from '@/pages/ApiTest';

// Comercial (Executivos) Pages
import Executivos from '@/pages/comercial/Executivos';
import GestaoExecutivos from '@/pages/comercial/GestaoExecutivos';
import PropostasExecutivos from '@/pages/comercial/PropostasExecutivos';
import ComissoesExecutivos from '@/pages/comercial/ComissoesExecutivos';

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
          <Route path="/api-test" element={<ApiTest />} />
          
          {/* Partner public routes */}
          <Route path="/parceiro/cadastro" element={<CadastroParceiro />} />
          <Route path="/parceiro/login" element={<LoginParceiro />} />
          <Route path="/parceiro/contrato" element={<AceiteContrato />} />
          
          {/* Partner protected routes - uses same OpenCalculator component within PartnerLayout */}
          <Route element={<PartnerLayout />}>
            <Route path="/parceiro/dashboard" element={<DashboardParceiro />} />
            <Route path="/parceiro/calculadora" element={<CalculadoraParceiro />} />
            <Route path="/parceiro/propostas" element={<PropostasParceiro />} />
            <Route path="/parceiro/indicacoes" element={<IndicacoesParceiro />} />
          </Route>
          
          {/* Executive protected routes (user_level 700/750) - dedicated layout */}
          <Route element={<ExecutiveLayout />}>
            <Route path="/executivo/dashboard" element={<DashboardHome />} />
            <Route path="/executivo/calculadora" element={<Calculadora />} />
            <Route path="/executivo/propostas" element={<PropostasExecutivos />} />
          </Route>
          
          {/* Admin/internal protected dashboard routes (non-executive levels) */}
          <Route element={<DashboardLayout />}>
            {/* Menu Principal */}
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/ceo" element={<DashboardExecutivo />} />
            
            {/* Comercial (Admin only) */}
            <Route path="/calculadora" element={<Calculadora />} />
            <Route path="/comercial/executivos" element={<Executivos />} />
            <Route path="/comercial/gestao-executivos" element={<GestaoExecutivos />} />
            <Route path="/comercial/propostas" element={<PropostasExecutivos />} />
            <Route path="/comercial/comissoes" element={<ComissoesExecutivos />} />
            
            {/* Parceiros */}
            <Route path="/parceiros/executivo" element={<DashboardExecutivoParceiros />} />
            <Route path="/parceiros/gestao" element={<GestaoParceiroAdmin />} />
            <Route path="/parceiros/propostas" element={<PropostasAdmin />} />
            <Route path="/parceiros/comissoes" element={<GestaoComissoes />} />
            
            {/* Atendimentos */}
            <Route path="/atendimentos" element={<Navigate to="/atendimentos/suporte" replace />} />
            <Route path="/atendimentos/suporte" element={<FilaSuporte />} />
            <Route path="/atendimentos/cs" element={<CustomerSuccess />} />
            <Route path="/atendimentos/novo" element={<TicketForm />} />
            <Route path="/atendimentos/:id" element={<TicketDetalhe />} />
            
            {/* KPIs de Atendimento */}
            <Route path="/kpis" element={<Navigate to="/kpis/gestao" replace />} />
            <Route path="/kpis/suporte" element={<KPIsSuporte />} />
            <Route path="/kpis/cs" element={<KPIsCS />} />
            <Route path="/kpis/gestao" element={<KPIsGestao />} />
            
            {/* Health Score */}
            <Route path="/health" element={<Navigate to="/health/cs" replace />} />
            <Route path="/health/cs" element={<HealthScoreCS />} />
            <Route path="/health/executivo" element={<HealthScoreExecutivo />} />
            
            {/* Conteúdo & Documentação */}
            <Route path="/artigos" element={<Artigos />} />
            <Route path="/artigos/novo" element={<ArtigoForm />} />
            <Route path="/artigos/:id" element={<ArtigoView />} />
            <Route path="/artigos/:id/editar" element={<ArtigoForm isEdit />} />
            
            {/* Gente & Gestão */}
            <Route path="/rh/vagas" element={<VagasRH />} />
            <Route path="/rh/vagas/nova" element={<JobForm />} />
            <Route path="/rh/vagas/:id" element={<VagaDetalhe />} />
            <Route path="/rh/vagas/:id/editar" element={<JobForm isEdit />} />
            
            {/* Rotas legadas (redirects) */}
            <Route path="/propostas" element={<Propostas />} />
            <Route path="/precos" element={<Precos />} />
            <Route path="/executivo" element={<Navigate to="/ceo" replace />} />
            <Route path="/health-score/cs" element={<Navigate to="/health/cs" replace />} />
            <Route path="/health-score/executivo" element={<Navigate to="/health/executivo" replace />} />
            <Route path="/admin/parceiros" element={<Navigate to="/parceiros/gestao" replace />} />
            <Route path="/admin/comissoes" element={<Navigate to="/parceiros/comissoes" replace />} />
            <Route path="/admin/parceiros/executivo" element={<Navigate to="/parceiros/executivo" replace />} />
            <Route path="/admin/parceiros/propostas" element={<Navigate to="/parceiros/propostas" replace />} />
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
