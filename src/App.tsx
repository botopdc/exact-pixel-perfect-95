import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import DashboardLayout from '@/layouts/DashboardLayout';

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
import NotFound from '@/pages/NotFound';

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
