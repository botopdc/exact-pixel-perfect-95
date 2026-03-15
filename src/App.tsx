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
import PropostaViewSupabase from '@/pages/PropostaViewSupabase';
import PropostaAceite from '@/pages/PropostaAceite';
import PropostaAprovar from '@/pages/PropostaAprovar';
import PropostaAprovacaoPublica from '@/pages/PropostaAprovacaoPublica';
import PropostaPdfPublic from '@/pages/PropostaPdfPublic';
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
import MeuPotencialArquiteto from '@/pages/comercial/MeuPotencialArquiteto';
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

// Docs Module
import DocsLayout from '@/layouts/DocsLayout';
import DocsHome from '@/pages/modules/docs/DocsHome';
import DocsViewPage from '@/pages/modules/docs/DocsViewPage';
import DocsDownloadsPage from '@/pages/modules/docs/DocsDownloadsPage';
import DocsAdminSyncPage from '@/pages/modules/docs/DocsAdminSyncPage';
import DocsAdminChangelogPage from '@/pages/modules/docs/DocsAdminChangelogPage';
import DocsAdminCoveragePage from '@/pages/modules/docs/DocsAdminCoveragePage';
import DocsAdminHealthPage from '@/pages/modules/docs/DocsAdminHealthPage';

// Module Placeholder Pages
import ProcedimentosPage from '@/pages/modules/conteudo/ProcedimentosPage';
import MateriaisPage from '@/pages/modules/conteudo/MateriaisPage';
import BaseConhecimentoPage from '@/pages/modules/conteudo/BaseConhecimentoPage';
import EstruturaPage from '@/pages/modules/gente/EstruturaPage';
import MetasInternasPage from '@/pages/modules/gente/MetasInternasPage';
import AvaliacoesPage from '@/pages/modules/gente/AvaliacoesPage';
import AcademyPage from '@/pages/modules/gente/AcademyPage';
import VagasPage from '@/pages/modules/gente/VagasPage';

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
import ContratosListPage from '@/pages/modules/comercial/ContratosListPage';
import ContratoDetailPage from '@/pages/modules/comercial/ContratoDetailPage';

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

// Support Tickets Module (Client-facing)
import SupportTicketQueuePage from '@/pages/modules/atendimentos/SupportQueuePage';
import SupportTicketDetailPage from '@/pages/modules/atendimentos/SupportTicketDetailPage';
import MeusTicketsPage from '@/pages/modules/atendimentos/MeusTicketsPage';
import AnalistasSuportePage from '@/pages/modules/atendimentos/AnalistasSuportePage';
import SLAPoliciesPage from '@/pages/modules/atendimentos/SLAPoliciesPage';
import TicketReportsPage from '@/pages/modules/atendimentos/TicketReportsPage';

// Tickets CORE (Supabase-first)
import TicketsCoreListPage from '@/pages/modules/atendimentos/TicketsCoreListPage';
import TicketCoreDetailPage from '@/pages/modules/atendimentos/TicketCoreDetailPage';

// Client Portal
import ClientTicketsPage from '@/pages/portal/ClientTicketsPage';
import ClientTicketDetailPage from '@/pages/portal/ClientTicketDetailPage';

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
          <Route path="/proposta/aprovacao/:token" element={<PropostaAprovacaoPublica />} />
          <Route path="/proposta/pdf" element={<PropostaPdfPublic />} />
          
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
          
          {/* Client Portal routes (level 1 only) */}
          <Route path="/portal/tickets" element={<ClientTicketsPage />} />
          <Route path="/portal/tickets/:ticketId" element={<ClientTicketDetailPage />} />

          {/* Partner protected routes */}
          <Route element={<PartnerLayout />}>
            <Route path="/parceiro/dashboard" element={<DashboardParceiro />} />
            <Route path="/parceiro/calculadora" element={<CalculadoraParceiro />} />
            <Route path="/parceiro/propostas" element={<PropostasParceiro />} />
            <Route path="/parceiro/indicacoes" element={<IndicacoesParceiro />} />
            <Route path="/parceiro/contrato" element={<AceiteContrato />} />
          </Route>
          
          {/* LEGACY ROUTES - Redirect to modular routes */}
          {/* These redirects ensure old bookmarks/links still work */}
          <Route path="/executivo/dashboard" element={<Navigate to="/modulos/dashboard" replace />} />
          <Route path="/executivo/calculadora" element={<Navigate to="/modulos/comercial/propostas/criar" replace />} />
          <Route path="/executivo/propostas" element={<Navigate to="/modulos/comercial/propostas" replace />} />
          <Route path="/executivo/potencial" element={<Navigate to="/modulos/comercial/meu-potencial" replace />} />
          <Route path="/comercial/potencial-gerente" element={<Navigate to="/modulos/comercial/potencial-gerente" replace />} />
          {/* Redirect old potencial route to new gerente route */}
          <Route path="/modulos/comercial/potencial" element={<Navigate to="/modulos/comercial/potencial-gerente" replace />} />
          <Route path="/dashboard" element={<Navigate to="/modulos/dashboard" replace />} />
          <Route path="/calculadora" element={<Navigate to="/modulos/comercial/propostas/criar" replace />} />
          <Route path="/propostas" element={<Navigate to="/modulos/comercial/propostas" replace />} />

          {/* ============================================================ */}
          {/* NEW MODULE ARCHITECTURE - /modulos/* */}
          {/* ============================================================ */}
          <Route element={<ModuleLayout />}>
            {/* Dashboard Module */}
            <Route path="/modulos/dashboard" element={<DashboardModuleHome />} />
            <Route path="/modulos/dashboard/alertas" element={<DashboardAlertas />} />
            <Route path="/modulos/dashboard/indicadores" element={<DashboardIndicadores />} />
            <Route path="/modulos/dashboard/ceo" element={<DashboardExecutivo />} />
            
            {/* Comercial Module */}
            <Route path="/modulos/comercial" element={<ComercialModuleHome />} />
            <Route path="/modulos/comercial/executivos" element={<Executivos />} />
            <Route path="/modulos/comercial/gestao-executivos" element={<GestaoExecutivos />} />
            <Route path="/modulos/comercial/propostas" element={<Propostas />} />
            <Route path="/modulos/comercial/propostas/criar" element={<Calculadora />} />
            {/* Visualização de proposta via Supabase (source of truth) */}
            <Route path="/modulos/comercial/propostas/:id" element={<PropostaViewSupabase />} />
            <Route path="/modulos/comercial/propostas/templates" element={<PropostasTemplatesPage />} />
            <Route path="/modulos/comercial/propostas/aprovacoes" element={<PropostasAprovacoesPage />} />
            
            {/* Contratos Module */}
            <Route path="/modulos/comercial/contratos" element={<ContratosListPage />} />
            <Route path="/modulos/comercial/contratos/novo" element={<ContratoDetailPage />} />
            <Route path="/modulos/comercial/contratos/:id" element={<ContratoDetailPage />} />
            
            <Route path="/modulos/comercial/metas" element={<MetasComerciais />} />
            <Route path="/modulos/comercial/comissoes" element={<ComissoesExecutivos />} />
            <Route path="/modulos/comercial/meu-potencial" element={<MeuPotencial />} />
            <Route path="/modulos/comercial/potencial-arquiteto" element={<MeuPotencialArquiteto />} />
            <Route path="/modulos/comercial/potencial-gerente" element={<MeuPotencialGerente />} />
            
            {/* Parceiros Module */}
            <Route path="/modulos/parceiros" element={<ParceirosModuleHome />} />
            <Route path="/modulos/parceiros/executivo" element={<DashboardExecutivoParceiros />} />
            <Route path="/modulos/parceiros/gestao" element={<GestaoParceiroAdmin />} />
            <Route path="/modulos/parceiros/propostas" element={<PropostasAdmin />} />
            <Route path="/modulos/parceiros/comissoes" element={<GestaoComissoes />} />
            
            {/* Atendimentos Module */}
            <Route path="/modulos/atendimentos" element={<InternalSupportPage />} />
            
            {/* Internal Support (Atendimento Interno) */}
            <Route path="/modulos/atendimentos/interno" element={<InternalSupportPage />} />
            <Route path="/modulos/atendimentos/interno/novo" element={<CreateInternalTicketPage />} />
            <Route path="/modulos/atendimentos/interno/:id" element={<InternalTicketDetailPage />} />
            
            {/* Analistas (Gestão do time de suporte interno - 950+) */}
            <Route path="/modulos/atendimentos/analistas" element={<AnalistasPage />} />
            
            {/* Support Queue Interno (Fila de Suporte - para técnicos 900+) */}
            <Route path="/modulos/atendimentos/suporte" element={<SupportQueuePage />} />
            
            {/* Support Tickets (Chamados de Clientes - 900/1000) */}
            <Route path="/modulos/atendimentos/chamados" element={<SupportTicketQueuePage />} />
            <Route path="/modulos/atendimentos/chamados/:ticketNumber" element={<SupportTicketDetailPage />} />
            
            {/* Tickets CORE — novo sistema Supabase-first (rota oficial) */}
            <Route path="/modulos/atendimentos/suporte-tecnico" element={<TicketsCoreListPage />} />
            <Route path="/modulos/atendimentos/suporte-tecnico/:ticketId" element={<TicketCoreDetailPage />} />
            {/* Redirect old /tickets route to official route */}
            <Route path="/modulos/atendimentos/tickets" element={<Navigate to="/modulos/atendimentos/suporte-tecnico" replace />} />
            <Route path="/modulos/atendimentos/tickets/:ticketId" element={<Navigate to="/modulos/atendimentos/suporte-tecnico" replace />} />
            <Route path="/modulos/atendimentos/meus-chamados" element={<MeusTicketsPage />} />
            <Route path="/modulos/atendimentos/analistas-suporte" element={<AnalistasSuportePage />} />
            <Route path="/modulos/atendimentos/slas" element={<SLAPoliciesPage />} />
            <Route path="/modulos/atendimentos/relatorios" element={<TicketReportsPage />} />

            {/* TechOps (Centro de Operações Técnicas) — moved to /modulos/techops */}
            <Route path="/modulos/techops" element={<TechOpsErrorBoundary><NOCHomePage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/techops/incidentes" element={<TechOpsErrorBoundary><IncidentsListPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/techops/incidentes/criar" element={<TechOpsErrorBoundary><CreateIncidentPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/techops/incidentes/:id" element={<TechOpsErrorBoundary><IncidentDetailPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/techops/clientes" element={<TechOpsErrorBoundary><ClientsListPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/techops/clientes/:id" element={<TechOpsErrorBoundary><ClientDetailPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/techops/infra" element={<TechOpsErrorBoundary><AssetsListPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/techops/infra/:id" element={<TechOpsErrorBoundary><AssetDetailPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/techops/plantao" element={<TechOpsErrorBoundary><OnCallPage /></TechOpsErrorBoundary>} />
            <Route path="/modulos/techops/seed" element={<TechOpsErrorBoundary><SeedDataPage /></TechOpsErrorBoundary>} />
            
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
            
            {/* Health Score under atendimentos */}
            <Route path="/modulos/atendimentos/health" element={<Navigate to="/modulos/atendimentos/health/cs" replace />} />
            <Route path="/modulos/atendimentos/health/cs" element={<HealthScoreCS />} />
            <Route path="/modulos/atendimentos/health/executivo" element={<HealthScoreExecutivo />} />
            
            {/* Docs Module (Wiki) */}
            <Route path="/modulos/docs" element={<DocsLayout />}>
              <Route index element={<DocsHome />} />
              <Route path="downloads" element={<DocsDownloadsPage />} />
              <Route path="admin/sync" element={<DocsAdminSyncPage />} />
              <Route path="admin/changelog" element={<DocsAdminChangelogPage />} />
              <Route path="admin/coverage" element={<DocsAdminCoveragePage />} />
              <Route path="admin/health" element={<DocsAdminHealthPage />} />
              <Route path="*" element={<DocsViewPage />} />
            </Route>

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
            <Route path="/modulos/gente/vagas" element={<VagasPage />} />
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
          
          {/* Legacy route redirects - kept for backwards compatibility with bookmarks/external links */}
          {/* All legacy routes redirect to their modular equivalents */}
          <Route path="/dashboard" element={<Navigate to="/modulos/dashboard" replace />} />
          <Route path="/ceo" element={<Navigate to="/modulos/dashboard/ceo" replace />} />
          <Route path="/calculadora" element={<Navigate to="/modulos/comercial/propostas/criar" replace />} />
          <Route path="/comercial/executivos" element={<Navigate to="/modulos/comercial/executivos" replace />} />
          <Route path="/comercial/gestao-executivos" element={<Navigate to="/modulos/comercial/gestao-executivos" replace />} />
          <Route path="/comercial/propostas" element={<Navigate to="/modulos/comercial/propostas" replace />} />
          <Route path="/comercial/metas" element={<Navigate to="/modulos/comercial/metas" replace />} />
          <Route path="/comercial/comissoes" element={<Navigate to="/modulos/comercial/comissoes" replace />} />
          <Route path="/comercial/potencial-gerente" element={<Navigate to="/modulos/comercial/potencial-gerente" replace />} />
          <Route path="/gestao-usuarios" element={<Navigate to="/modulos/admin/usuarios" replace />} />
          <Route path="/parceiros/executivo" element={<Navigate to="/modulos/parceiros/executivo" replace />} />
          <Route path="/parceiros/gestao" element={<Navigate to="/modulos/parceiros/gestao" replace />} />
          <Route path="/parceiros/propostas" element={<Navigate to="/modulos/parceiros/propostas" replace />} />
          <Route path="/parceiros/comissoes" element={<Navigate to="/modulos/parceiros/comissoes" replace />} />
          <Route path="/atendimentos" element={<Navigate to="/modulos/atendimentos/suporte" replace />} />
          <Route path="/atendimentos/suporte" element={<Navigate to="/modulos/atendimentos/suporte" replace />} />
          <Route path="/atendimentos/cs" element={<Navigate to="/modulos/atendimentos/cs" replace />} />
          <Route path="/atendimentos/novo" element={<Navigate to="/modulos/atendimentos/novo" replace />} />
          <Route path="/atendimentos/:id" element={<Navigate to="/modulos/atendimentos/:id" replace />} />
          <Route path="/kpis" element={<Navigate to="/modulos/atendimentos/kpis/gestao" replace />} />
          <Route path="/kpis/suporte" element={<Navigate to="/modulos/atendimentos/kpis/suporte" replace />} />
          <Route path="/kpis/cs" element={<Navigate to="/modulos/atendimentos/kpis/cs" replace />} />
          <Route path="/kpis/gestao" element={<Navigate to="/modulos/atendimentos/kpis/gestao" replace />} />
          <Route path="/health" element={<Navigate to="/modulos/atendimentos/health/cs" replace />} />
          <Route path="/health/cs" element={<Navigate to="/modulos/atendimentos/health/cs" replace />} />
          <Route path="/health/executivo" element={<Navigate to="/modulos/atendimentos/health/executivo" replace />} />
          <Route path="/artigos" element={<Navigate to="/modulos/conteudo/artigos" replace />} />
          <Route path="/artigos/novo" element={<Navigate to="/modulos/conteudo/artigos/novo" replace />} />
          <Route path="/artigos/:id" element={<Navigate to="/modulos/conteudo/artigos/:id" replace />} />
          <Route path="/artigos/:id/editar" element={<Navigate to="/modulos/conteudo/artigos/:id/editar" replace />} />
          <Route path="/rh/vagas" element={<Navigate to="/modulos/gente/vagas" replace />} />
          <Route path="/rh/vagas/nova" element={<Navigate to="/modulos/gente/vagas/nova" replace />} />
          <Route path="/rh/vagas/:id" element={<Navigate to="/modulos/gente/vagas/:id" replace />} />
          <Route path="/rh/vagas/:id/editar" element={<Navigate to="/modulos/gente/vagas/:id/editar" replace />} />
          <Route path="/propostas" element={<Navigate to="/modulos/comercial/propostas" replace />} />
          <Route path="/precos" element={<Navigate to="/modulos/admin/precos" replace />} />
          
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
