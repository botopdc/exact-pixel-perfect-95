/**
 * PropostaAceite - Legacy Proposal Acceptance Page (Compatibility/Redirect)
 * 
 * This page handles the legacy route format: /proposta/:id/aceite
 * 
 * It attempts to:
 * 1. Fetch the proposal using the ID/UUID from URL
 * 2. Get the approval token from API
 * 3. Redirect to the canonical format: /proposta/aprovar?proposalId=X&token=Y
 * 
 * If redirect fails, shows an informative message asking user to request new link.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import OpenLogo from '@/components/OpenLogo';
import { Button } from '@/components/ui/button';
import { getProposalPublic, getApprovalToken } from '@/services/calculatorProposalService';
import { ROUTES } from '@/config/routes';

const PropostaAceite: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Link inválido: ID da proposta não encontrado');
      setIsLoading(false);
      return;
    }

    resolveAndRedirect();
  }, [id]);

  const resolveAndRedirect = async () => {
    if (!id) return;
    
    setIsLoading(true);
    setError(null);

    try {
      console.log('[PropostaAceite] Legacy route detected, resolving proposal:', id);
      
      // Step 1: Fetch proposal to get numeric ID
      let numericId: number;
      try {
        const proposal = await getProposalPublic(id);
        numericId = proposal.id;
        console.log('[PropostaAceite] Resolved proposal ID:', numericId);
      } catch (fetchError: any) {
        console.error('[PropostaAceite] Failed to fetch proposal:', fetchError);
        if (fetchError.response?.status === 404) {
          setError('Proposta não encontrada. O link pode estar incorreto ou a proposta foi removida.');
        } else {
          setError('Erro ao carregar proposta. Tente novamente.');
        }
        setIsLoading(false);
        return;
      }

      // Step 2: Get approval token
      let token: string;
      try {
        const tokenResponse = await getApprovalToken(String(numericId));
        token = tokenResponse.token;
        console.log('[PropostaAceite] Got approval token');
      } catch (tokenError: any) {
        console.error('[PropostaAceite] Failed to get approval token:', tokenError);
        setError('Não foi possível gerar link de aprovação. Solicite um novo link ao comercial.');
        setIsLoading(false);
        return;
      }

      // Step 3: Redirect to canonical format
      const canonicalPath = ROUTES.public.proposalApprove(String(numericId), token);
      console.log('[PropostaAceite] Redirecting to canonical path:', canonicalPath);
      navigate(canonicalPath, { replace: true });
      
    } catch (err: any) {
      console.error('[PropostaAceite] Unexpected error:', err);
      setError('Erro inesperado. Por favor, solicite um novo link ao comercial.');
      setIsLoading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <OpenLogo />
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando proposta...</p>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 p-8 max-w-md">
        <OpenLogo />
        <div className="flex items-center justify-center gap-2 text-destructive">
          <AlertCircle className="w-6 h-6" />
          <h1 className="text-xl font-bold">Link Inválido</h1>
        </div>
        <p className="text-muted-foreground">
          {error || 'Este link de proposta não é mais válido.'}
        </p>
        <p className="text-sm text-muted-foreground">
          Entre em contato com o comercial da OPEN para solicitar um novo link de aprovação.
        </p>
        <Button 
          variant="outline" 
          onClick={resolveAndRedirect}
          className="mt-4"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    </div>
  );
};

export default PropostaAceite;
