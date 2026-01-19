import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import DashboardLayout from '@/layouts/DashboardLayout';
import PartnerLayout from '@/layouts/PartnerLayout';
import ExecutiveLayout from '@/layouts/ExecutiveLayout';
import ModuleLayout from '@/layouts/ModuleLayout';

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
import PropostaAprovar from '@/pages/PropostaAprovar';
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
import ResetPasswordParceiro from '@/pages/parceiros/ResetPasswordParceiro';
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
import MeuPotencial from '@/pages/comercial/MeuPotencial';
import MeuPotencialGerente from '@/pages/comercial/MeuPotencialGerente';
import MetasComerciais from '@/pages/comercial/MetasComerciais';
import GestaoUsuarios from '@/pages/GestaoUsuarios';

// Module Home Pages
import DashboardModuleHome from '@/pages/modules/DashboardModuleHome';
import DashboardAlertas from '@/pages/modules/DashboardAlertas';
import DashboardIndicadores from '@/pages/modules/DashboardIndicadores';
import ComercialModuleHome from '@/pages/modules/ComercialModuleHome';
import ParceirosModuleHome from '@/pages/modules/ParceirosModuleHome';
import AtendimentosModuleHome from '@/pages/modules/AtendimentosModuleHome';
import ConteudoModuleHome from '@/pages/modules/ConteudoModuleHome';
import GenteModuleHome from '@/pages/modules/GenteModuleHome';
import AdminModuleHome from '@/pages/modules/AdminModuleHome';

// Module Placeholder Pages
import ProcedimentosPage from '@/pages/modules/conteudo/ProcedimentosPage';
import MateriaisPage from '@/pages/modules/conteudo/MateriaisPage';
import BaseConhecimentoPage from '@/pages/modules/conteudo/BaseConhecimentoPage';
import EstruturaPage from '@/pages/modules/gente/EstruturaPage';
import MetasInternasPage from '@/pages/modules/gente/MetasInternasPage';
import AvaliacoesPage from '@/pages/modules/gente/AvaliacoesPage';
import AcademyPage from '@/pages/modules/gente/AcademyPage';

// Academy Pages (external users)
import AcademyLogin from '@/pages/academy/AcademyLogin';
import AcademySignup from '@/pages/academy/AcademySignup';
import AcademyResetPassword from '@/pages/academy/AcademyResetPassword';
import AcademyHome from '@/pages/academy/AcademyHome';
import PermissoesPage from '@/pages/modules/admin/PermissoesPage';
import ParametrosPage from '@/pages/modules/admin/ParametrosPage';
import LogsPage from '@/pages/modules/admin/LogsPage';
import PropostasTemplatesPage from '@/pages/modules/comercial/PropostasTemplatesPage';
import PropostasAprovacoesPage from '@/pages/modules/comercial/PropostasAprovacoesPage';

// TechOps (Centro de Operações Técnicas) Pages
import NOCHomePage from '@/pages/modules/techops/NOCHomePage';
import IncidentsListPage from '@/pages/modules/techops/IncidentsListPage';
import IncidentDetailPage from '@/pages/modules/techops/IncidentDetailPage';
import CreateIncidentPage from '@/pages/modules/techops/CreateIncidentPage';
import ClientsListPage from '@/pages/modules/techops/ClientsListPage';
import ClientDetailPage from '@/pages/modules/techops/ClientDetailPage';
import AssetsListPage from '@/pages/modules/techops/AssetsListPage';
import AssetDetailPage from '@/pages/modules/techops/AssetDetailPage';
import OnCallPage from '@/pages/modules/techops/OnCallPage';
import SeedDataPage from '@/pages/modules/techops/SeedDataPage';

// Internal Support Pages
import InternalSupportPage from '@/pages/modules/atendimento-interno/InternalSupportPage';
import CreateInternalTicketPage from '@/pages/modules/atendimento-interno/CreateInternalTicketPage';
import InternalTicketDetailPage from '@/pages/modules/atendimento-interno/InternalTicketDetailPage';
import SupportQueuePage from '@/pages/modules/atendimento-interno/SupportQueuePage';
import AnalistasPage from '@/pages/modules/atendimento-interno/AnalistasPage';

// Birth Certificate (Certidão de Nascimento) Pages
import CertidaoListPage from '@/pages/modules/certidao/CertidaoListPage';
import CertidaoCustomerPage from '@/pages/modules/certidao/CertidaoCustomerPage';
import CertidaoAssetPage from '@/pages/modules/certidao/CertidaoAssetPage';
import CertidaoNewCustomerPage from '@/pages/modules/certidao/CertidaoNewCustomerPage';

// Error Boundary
import { TechOpsErrorBoundary } from '@/components/techops/TechOpsErrorBoundary';

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
          <Route path="/proposta/aprovar" element={<PropostaAprovar />} />
          
          {/* Public job routes */}
          <Route path="/vagas" element={<VagasPublic />} />
          <Route path="/vagas/:slug" element={<VagaDetalhe />} />
          <Route path="/vagas.json" element={<VagasJson />} />
          <Route path="/api-test" element={<ApiTest />} />
          
          {/* Partner public routes */}
          <Route path="/parceiro/cadastro" element={<CadastroParceiro />} />
          <Route path="/parceiro/login" element={<LoginParceiro />} />
          <Route path="/parceiro/reset-password" element={<ResetPasswordParceiro />} />
          
          {/* Academy public routes */}
          <Route path="/academy/login" element={<AcademyLogin />} />
          <Route path="/academy/signup" element={<AcademySignup />} />
          <Route path="/academy/reset-password" element={<AcademyResetPassword />} />
          <Route path="/academy" element={<AcademyHome />} />
          
          {/* Partner protected routes */}
          <Route element={<PartnerLayout />}>
            <Route path="/parceiro/dashboard" element={<DashboardParceiro />} />
            <Route path="/parceiro/calculadora" element={<CalculadoraParceiro />} />
            <Route path="/parceiro/propostas" element={<PropostasParceiro />} />
            <Route path="/parceiro/indicacoes" element={<IndicacoesParceiro />} />
            <Route path="/parceiro/contrato" element={<AceiteContrato />} />
          </Route>
          
          {/* Executive protected routes (user_level 700 ONLY) */}
          <Route element={<ExecutiveLayout />}>
            <Route path="/executivo/dashboard" element={<DashboardHome />} />
            <Route path="/executivo/calculadora" element={<Calculadora />} />
            <Route path="/executivo/propostas" element={<PropostasExecutivos />} />
            <Route path="/executivo/potencial" element={<MeuPotencial />} />
          </Route>

          {/* ============================================================ */}
          {/* NEW MODULE ARCHITECTURE - /modulos/* */}
          {/* ============================================================ */}
          <Route element={<ModuleLayout />}>
            {/* Dashboard Module */}
            <Route path="/modulos/dashboard" element={<DashboardModuleHome />} />
            <Route path="/modulos/dashboard/alertas" element={<DashboardAlertas />} />
            <Route path="/modulos/dashboard/indicadores" element={<DashboardIndicadores />} />
            
            {/* Comercial Module */}
            <Route path="/modulos/comercial" element={<ComercialModuleHome />} />
            <Route path="/modulos/comercial/executivos" element={<Executivos />} />
            <Route path="/modulos/comercial/propostas" element={<PropostasExecutivos />} />
            <Route path="/modulos/comercial/propostas/criar" element={<Calculadora />} />
            <Route path="/modulos/comercial/propostas/templates" element={<PropostasTemplatesPage />} />
            <Route path="/modulos/comercial/propostas/aprovacoes" element={<PropostasAprovacoesPage />} />
            <Route path="/modulos/comercial/metas" element={<MetasComerciais />} />
            <Route path="/modulos/comercial/comissoes" element={<ComissoesExecutivos />} />
            <Route path="/modulos/comercial/potencial" element={<MeuPotencialGerente />} />
            
            {/* Parceiros Module */}
            <Route path="/modulos/parceiros" element={<ParceirosModuleHome />} />
            <Route path="/modulos/parceiros/gestao" element={<GestaoParceiroAdmin />} />
            <Route path="/modulos/parceiros/propostas" element={<PropostasAdmin />} />
            <Route path="/modulos/parceiros/comissoes" element={<GestaoComissoes />} />
            
            {/* Atendimentos Module */}
            <Route path="/modulos/atendimentos" element={<InternalSupportPage />} />
            
            {/* Internal Support (Atendimento Interno) */}
            <Route path="/modulos/atendimentos/interno" element={<InternalSupportPage />} />
            <Route path="/modulos/atendimentos/interno/novo" element={<CreateInternalTicketPage />} />
            <Route path="/modulos/atendimentos/interno/:id" element={<InternalTicketDetailPage />} />
            
            {/* Analistas (Gestão do time de suporte - 950+) */}
            <Route path="/modulos/atendimentos/analistas" element={<AnalistasPage />} />
            
            {/* Support Queue (Fila de Suporte - para técnicos 900+) */}
            <Route path="/modulos/atendimentos/suporte" element={<SupportQueuePage />} />

            {/* Suporte Técnico (Centro de Operações) - Wrapped with Error Boundary */}
            <Route path="/modulos/atendimentos/suporte-tecnico" element={<TechOpsErrorBoundary><NOCHomePage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/atendimentos/suporte-tecnico/incidentes" element={<TechOpsErrorBoundary><IncidentsListPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/atendimentos/suporte-tecnico/incidentes/criar" element={<TechOpsErrorBoundary><CreateIncidentPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/atendimentos/suporte-tecnico/incidentes/:id" element={<TechOpsErrorBoundary><IncidentDetailPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/atendimentos/suporte-tecnico/clientes" element={<TechOpsErrorBoundary><ClientsListPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/atendimentos/suporte-tecnico/clientes/:id" element={<TechOpsErrorBoundary><ClientDetailPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/atendimentos/suporte-tecnico/infra" element={<TechOpsErrorBoundary><AssetsListPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/atendimentos/suporte-tecnico/infra/:id" element={<TechOpsErrorBoundary><AssetDetailPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/atendimentos/suporte-tecnico/plantao" element={<TechOpsErrorBoundary><OnCallPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/atendimentos/suporte-tecnico/seed" element={<TechOpsErrorBoundary><SeedDataPage /></TechOpsErrorBoundary>} />
            
            {/* Certidão de Nascimento (Birth Certificate) */}
            <Route path="/modulos/atendimentos/certidoes" element={<CertidaoListPage />} />
            <Route path="/modulos/atendimentos/certidoes/novo-cliente" element={<CertidaoNewCustomerPage />} />
            <Route path="/modulos/atendimentos/certidoes/:customerId" element={<CertidaoCustomerPage />} />
            <Route path="/modulos/atendimentos/certidoes/asset/:assetId" element={<CertidaoAssetPage />} />
            
            {/* Legacy Atendimentos routes */}
            <Route path="/modulos/atendimentos/suporte" element={<FilaSuporte />} />
            <Route path="/modulos/atendimentos/cs" element={<CustomerSuccess />} />
            <Route path="/modulos/atendimentos/novo" element={<TicketForm />} />
            <Route path="/modulos/atendimentos/:id" element={<TicketDetalhe />} />
            <Route path="/modulos/atendimentos/kpis" element={<Navigate to="/modulos/atendimentos/kpis/gestao" replace />} />
            <Route path="/modulos/atendimentos/kpis/suporte" element={<KPIsSuporte />} />
            <Route path="/modulos/atendimentos/kpis/cs" element={<KPIsCS />} />
            <Route path="/modulos/atendimentos/kpis/gestao" element={<KPIsGestao />} />
            
            {/* Conteúdo Module */}
            <Route path="/modulos/conteudo" element={<ConteudoModuleHome />} />
            <Route path="/modulos/conteudo/artigos" element={<Artigos />} />
            <Route path="/modulos/conteudo/artigos/novo" element={<ArtigoForm />} />
            <Route path="/modulos/conteudo/artigos/:id" element={<ArtigoView />} />
            <Route path="/modulos/conteudo/artigos/:id/editar" element={<ArtigoForm isEdit />} />
            <Route path="/modulos/conteudo/procedimentos" element={<ProcedimentosPage />} />
            <Route path="/modulos/conteudo/materiais" element={<MateriaisPage />} />
            <Route path="/modulos/conteudo/base" element={<BaseConhecimentoPage />} />
            
            {/* Gente & Gestão Module */}
            <Route path="/modulos/gente" element={<GenteModuleHome />} />
            <Route path="/modulos/gente/vagas" element={<VagasRH />} />
            <Route path="/modulos/gente/vagas/nova" element={<JobForm />} />
            <Route path="/modulos/gente/vagas/:id" element={<VagaDetalhe />} />
            <Route path="/modulos/gente/vagas/:id/editar" element={<JobForm isEdit />} />
            <Route path="/modulos/gente/estrutura" element={<EstruturaPage />} />
            <Route path="/modulos/gente/metas" element={<MetasInternasPage />} />
            <Route path="/modulos/gente/avaliacoes" element={<AvaliacoesPage />} />
            <Route path="/modulos/gente/academy" element={<AcademyPage />} />
            
            {/* Admin Module */}
            <Route path="/modulos/admin" element={<AdminModuleHome />} />
            <Route path="/modulos/admin/usuarios" element={<GestaoUsuarios />} />
            <Route path="/modulos/admin/permissoes" element={<PermissoesPage />} />
            <Route path="/modulos/admin/precos" element={<Precos />} />
            <Route path="/modulos/admin/parametros" element={<ParametrosPage />} />
            <Route path="/modulos/admin/logs" element={<LogsPage />} />
          </Route>
          
          {/* Legacy Admin/internal dashboard routes */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/ceo" element={<DashboardExecutivo />} />
            <Route path="/calculadora" element={<Calculadora />} />
            <Route path="/comercial/executivos" element={<Executivos />} />
            <Route path="/comercial/gestao-executivos" element={<GestaoExecutivos />} />
            <Route path="/comercial/propostas" element={<PropostasExecutivos />} />
            <Route path="/comercial/metas" element={<MetasComerciais />} />
            <Route path="/comercial/comissoes" element={<ComissoesExecutivos />} />
            <Route path="/comercial/potencial-gerente" element={<MeuPotencialGerente />} />
            <Route path="/gestao-usuarios" element={<GestaoUsuarios />} />
            <Route path="/parceiros/executivo" element={<DashboardExecutivoParceiros />} />
            <Route path="/parceiros/gestao" element={<GestaoParceiroAdmin />} />
            <Route path="/parceiros/propostas" element={<PropostasAdmin />} />
            <Route path="/parceiros/comissoes" element={<GestaoComissoes />} />
            <Route path="/atendimentos" element={<Navigate to="/atendimentos/suporte" replace />} />
            <Route path="/atendimentos/suporte" element={<FilaSuporte />} />
            <Route path="/atendimentos/cs" element={<CustomerSuccess />} />
            <Route path="/atendimentos/novo" element={<TicketForm />} />
            <Route path="/atendimentos/:id" element={<TicketDetalhe />} />
            <Route path="/kpis" element={<Navigate to="/kpis/gestao" replace />} />
            <Route path="/kpis/suporte" element={<KPIsSuporte />} />
            <Route path="/kpis/cs" element={<KPIsCS />} />
            <Route path="/kpis/gestao" element={<KPIsGestao />} />
            <Route path="/health" element={<Navigate to="/health/cs" replace />} />
            <Route path="/health/cs" element={<HealthScoreCS />} />
            <Route path="/health/executivo" element={<HealthScoreExecutivo />} />
            <Route path="/artigos" element={<Artigos />} />
            <Route path="/artigos/novo" element={<ArtigoForm />} />
            <Route path="/artigos/:id" element={<ArtigoView />} />
            <Route path="/artigos/:id/editar" element={<ArtigoForm isEdit />} />
            <Route path="/rh/vagas" element={<VagasRH />} />
            <Route path="/rh/vagas/nova" element={<JobForm />} />
            <Route path="/rh/vagas/:id" element={<VagaDetalhe />} />
            <Route path="/rh/vagas/:id/editar" element={<JobForm isEdit />} />
            <Route path="/propostas" element={<Propostas />} />
            <Route path="/precos" element={<Precos />} />
          </Route>
          
          {/* Redirects */}
          <Route path="/" element={<Navigate to="/modulos/dashboard" replace />} />
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
