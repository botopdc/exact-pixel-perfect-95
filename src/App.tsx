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
import Calculadora from '@/pages/Calculadora';
import PropostaView from '@/pages/PropostaView';
import PropostaAceite from '@/pages/PropostaAceite';
import Propostas from '@/pages/Propostas';
import Precos from '@/pages/Precos';
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
          
          {/* Protected dashboard routes */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/rh/vagas" element={<VagasRH />} />
            <Route path="/calculadora" element={<Calculadora />} />
            <Route path="/propostas" element={<Propostas />} />
            <Route path="/precos" element={<Precos />} />
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
