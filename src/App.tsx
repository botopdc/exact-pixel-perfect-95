import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/components/AuthProvider';
import { ProtectedRoute } from '@/components/ProtectedRoute';
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
        <AuthProvider>
          <Routes>
            {/* Protected routes - require auth_token */}
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/propostas" element={<ProtectedRoute><Propostas /></ProtectedRoute>} />
            <Route path="/proposta/:id" element={<ProtectedRoute><PropostaView /></ProtectedRoute>} />
            <Route path="/precos" element={<ProtectedRoute><Precos /></ProtectedRoute>} />
            
            {/* Public route - proposal acceptance page */}
            <Route path="/proposta/:id/aceite" element={<PropostaAceite />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
