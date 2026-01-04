import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import Propostas from './pages/Propostas';
import PropostaView from './pages/PropostaView';
import PropostaAceite from './pages/PropostaAceite';
import Precos from './pages/Precos';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/propostas" element={<Propostas />} />
          <Route path="/proposta/:id" element={<PropostaView />} />
          <Route path="/precos" element={<Precos />} />
          <Route path="/proposta/:id/aceite" element={<PropostaAceite />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
