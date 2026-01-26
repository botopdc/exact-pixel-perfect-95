/**
 * PropostaAprovar - Public Proposal Approval Page
 * 
 * This page allows clients to approve or reject proposals using an approval token.
 * It does NOT require login - the token provides authentication.
 * 
 * URL Format: /proposta/aprovar?proposalId={id}&token={approval_token}
 * 
 * Flow:
 * 1. Read proposalId and token from URL query params
 * 2. Fetch proposal data to display summary (token is NOT validated client-side)
 * 3. User clicks Approve/Reject
 * 4. POST to define-acceptance with proposal_id (INTEGER), approval_token, status
 * 5. Backend validates token - if invalid, returns 401/404/422
 */

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileDown, Check, X, Loader2, AlertCircle } from 'lucide-react';
import OpenLogo from '@/components/OpenLogo';
import { 
  getProposalPublic, 
  defineAcceptance, 
  CalculatorProposal 
} from '@/services/calculatorProposalService';
import { persistArchitectCommission } from '@/services/proposalParticipantService';
import { formatCurrency } from '@/lib/calculatorConfig';

import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadProposalPdfPublic } from '@/services/proposalPdfService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type FinalStatus = 'approved' | 'rejected' | null;

const PropostaAprovar: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  // URL params - read raw values
  const proposalIdParam = searchParams.get('proposalId');
  const rawToken = searchParams.get('token') || '';
  
  // CRITICAL: Normalize token - remove any "/aceite" or other suffixes that may have been added
  const approvalToken = rawToken.split('/')[0].trim();
  
  // Ref Guard to prevent double-click processing
  const actionInProgressRef = useRef(false);
  
  // States
  const [proposal, setProposal] = useState<CalculatorProposal | null>(null);
  const [isLoadingProposal, setIsLoadingProposal] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalStatus, setFinalStatus] = useState<FinalStatus>(null);
  // Keep dialog state only for rejection confirmation
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'Aprovado' | 'Reprovado' | null>(null);
  
  // Debug logging on mount
  useEffect(() => {
    console.log('[PropostaAprovar] === DEBUG ===');
    console.log('[PropostaAprovar] proposalId:', proposalIdParam);
    console.log('[PropostaAprovar] rawToken:', rawToken ? `${rawToken.substring(0, 12)}...` : '(empty)');
    console.log('[PropostaAprovar] normalizedToken:', approvalToken ? `${approvalToken.substring(0, 12)}...` : '(empty)');
  }, [proposalIdParam, rawToken, approvalToken]);
  
  // Validate URL params on mount
  useEffect(() => {
    // Validate proposalId
    if (!proposalIdParam) {
      console.error('[PropostaAprovar] ERROR: proposalId missing');
      setLoadError('Link inválido ou incompleto: ID da proposta não encontrado');
      setIsLoadingProposal(false);
      return;
    }
    
    // Validate token - must exist and be non-empty after normalization
    if (!approvalToken) {
      console.error('[PropostaAprovar] ERROR: token missing');
      setLoadError('Link inválido ou incompleto: Token de aprovação não encontrado');
      setIsLoadingProposal(false);
      return;
    }
    
    console.log('[PropostaAprovar] Params validated, fetching proposal...');
    
    // Fetch proposal data (NO token validation here - backend will validate on submit)
    fetchProposal();
  }, [proposalIdParam, approvalToken]);
  
  const fetchProposal = async () => {
    if (!proposalIdParam) return;
    
    setIsLoadingProposal(true);
    setLoadError(null);
    
    try {
      console.log('[PropostaAprovar] GET proposal:', proposalIdParam);
      const data = await getProposalPublic(proposalIdParam);
      console.log('[PropostaAprovar] GET proposal response:', {
        id: data.id,
        status: data.status,
        company: data.company,
      });
      
      setProposal(data);
      
      // Check if already approved/rejected
      const status = data.status?.toUpperCase();
      if (status === 'APROVADO' || status === 'APPROVED') {
        setFinalStatus('approved');
      } else if (status === 'REPROVADO' || status === 'REJECTED') {
        setFinalStatus('rejected');
      }
    } catch (error: any) {
      console.error('[PropostaAprovar] GET proposal ERROR:', error);
      console.error('[PropostaAprovar] Response status:', error.response?.status);
      console.error('[PropostaAprovar] Response data:', error.response?.data);
      
      if (error.response?.status === 404) {
        setLoadError('Proposta não encontrada');
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        setLoadError('Acesso negado. Link inválido ou expirado.');
      } else {
        setLoadError('Erro ao carregar proposta. Tente novamente mais tarde.');
      }
    } finally {
      setIsLoadingProposal(false);
    }
  };
  
  /**
   * Handle immediate approval - NO CONFIRMATION MODAL
   * Uses ref guard to prevent double-click processing
   */
  const handleApproveImmediate = async () => {
    // 1. Ref Guard - prevent double processing (sync check)
    if (actionInProgressRef.current) {
      console.log('[PropostaAprovar] Action already in progress, ignoring click');
      return;
    }
    
    // 2. Idempotency check - already approved?
    if (finalStatus === 'approved') {
      toast({
        title: 'Proposta já aprovada',
        description: 'Esta proposta já foi aprovada anteriormente.',
      });
      return;
    }
    
    // 3. Validate before proceeding
    if (!proposal) {
      toast({
        title: 'Erro',
        description: 'Dados da proposta não carregados.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!approvalToken) {
      toast({
        title: 'Erro',
        description: 'Token de aprovação não encontrado.',
        variant: 'destructive',
      });
      return;
    }
    
    const numericId = proposal.id;
    if (!Number.isInteger(numericId) || numericId <= 0) {
      toast({
        title: 'Erro',
        description: 'ID da proposta inválido.',
        variant: 'destructive',
      });
      return;
    }
    
    // 4. Lock immediately (sync) before any async work
    actionInProgressRef.current = true;
    setIsSubmitting(true);
    
    try {
      // 5. Fresh DB check - re-fetch to ensure not already approved
      console.log('[PropostaAprovar] Fresh check before approval...');
      const freshProposal = await getProposalPublic(proposalIdParam!);
      const freshStatus = freshProposal.status?.toUpperCase();
      
      if (freshStatus === 'APROVADO' || freshStatus === 'APPROVED') {
        console.log('[PropostaAprovar] Proposal already approved (fresh check)');
        setFinalStatus('approved');
        toast({
          title: 'Proposta já aprovada',
          description: 'Esta proposta já foi aprovada anteriormente.',
        });
        return;
      }
      
      // 6. Execute approval
      console.log('[PropostaAprovar] POST define-acceptance:', {
        proposal_id: numericId,
        status: 'Aprovado',
        tokenPreview: approvalToken.substring(0, 12) + '...',
      });
      
      await defineAcceptance({
        proposal_id: numericId,
        approval_token: approvalToken,
        status: 'Aprovado',
      });
      
      console.log('[PropostaAprovar] POST define-acceptance SUCCESS');
      
      // 7. Persist architect commission (non-blocking)
      try {
        const contractDuration = proposal.contract_duration || 12;
        await persistArchitectCommission(String(numericId), contractDuration);
        console.log('[PropostaAprovar] Architect commission persisted for proposal:', numericId);
      } catch (commissionError) {
        console.warn('[PropostaAprovar] Failed to persist architect commission (non-blocking):', commissionError);
      }
      
      // 8. Update UI immediately
      setFinalStatus('approved');
      
      toast({
        title: 'Proposta aprovada com sucesso!',
        description: 'Nossa equipe comercial entrará em contato em breve.',
      });
    } catch (error: any) {
      console.error('[PropostaAprovar] POST define-acceptance ERROR:', error);
      
      let errorMessage = 'Erro ao processar sua decisão. Tente novamente.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 404) {
        errorMessage = 'Proposta não encontrada ou link expirado.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Link inválido ou expirado. Solicite um novo link.';
      } else if (error.response?.status === 422) {
        const validationErrors = error.response?.data?.errors;
        if (validationErrors) {
          errorMessage = Object.values(validationErrors).flat().join(', ');
        } else {
          errorMessage = 'Dados inválidos. Verifique o link.';
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      actionInProgressRef.current = false;
      setIsSubmitting(false);
    }
  };
  
  /**
   * Handle rejection - KEEPS CONFIRMATION MODAL
   */
  const handleRejectWithConfirmation = () => {
    if (actionInProgressRef.current || finalStatus === 'rejected') return;
    setPendingAction('Reprovado');
    setConfirmDialogOpen(true);
  };
  
  /**
   * Submit rejection after confirmation
   */
  const handleSubmitRejection = async () => {
    if (actionInProgressRef.current) return;
    
    if (!proposal || !approvalToken) {
      toast({
        title: 'Erro',
        description: 'Dados incompletos.',
        variant: 'destructive',
      });
      return;
    }
    
    const numericId = proposal.id;
    if (!Number.isInteger(numericId) || numericId <= 0) {
      toast({
        title: 'Erro',
        description: 'ID da proposta inválido.',
        variant: 'destructive',
      });
      return;
    }
    
    actionInProgressRef.current = true;
    setConfirmDialogOpen(false);
    setIsSubmitting(true);
    
    try {
      console.log('[PropostaAprovar] POST define-acceptance (rejection):', {
        proposal_id: numericId,
        status: 'Reprovado',
      });
      
      await defineAcceptance({
        proposal_id: numericId,
        approval_token: approvalToken,
        status: 'Reprovado',
      });
      
      console.log('[PropostaAprovar] POST define-acceptance (rejection) SUCCESS');
      
      setFinalStatus('rejected');
      
      toast({
        title: 'Proposta recusada',
        description: 'Sua decisão foi registrada.',
      });
    } catch (error: any) {
      console.error('[PropostaAprovar] Rejection ERROR:', error);
      
      let errorMessage = 'Erro ao processar sua decisão. Tente novamente.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 404) {
        errorMessage = 'Proposta não encontrada ou link expirado.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Link inválido ou expirado. Solicite um novo link.';
      }
      
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      actionInProgressRef.current = false;
      setIsSubmitting(false);
      setPendingAction(null);
    }
  };
  
  const handleDownloadPDF = async () => {
    if (!proposal) return;
    
    // Use the approvalToken from URL to download PDF from API
    // The token (uuid) serves as file_access_token
    const fileToken = approvalToken || proposal.uuid || '';
    const numericId = proposal.id;
    
    if (!numericId || !fileToken) {
      toast({ 
        title: 'PDF indisponível', 
        description: 'Token de acesso não encontrado. Entre em contato com o comercial.',
        variant: 'destructive',
      });
      return;
    }
    
    console.log('[PropostaAprovar] Downloading PDF from API:', { numericId, tokenPreview: fileToken.substring(0, 8) + '...' });
    
    // Use the unified service that downloads from API using file_access_token
    const result = await downloadProposalPdfPublic(numericId, fileToken);
    
    if (result.success) {
      toast({ title: 'PDF baixado', description: 'O download do PDF foi iniciado' });
    } else {
      toast({ 
        title: 'PDF indisponível', 
        description: result.error || 'Não foi possível baixar o PDF. Entre em contato com o comercial.',
        variant: 'destructive',
      });
    }
  };
  
  // Loading state
  if (isLoadingProposal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <OpenLogo />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando proposta...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (loadError || !proposal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 p-8 max-w-md">
          <OpenLogo />
          <div className="flex items-center justify-center gap-2 text-destructive">
            <AlertCircle className="w-6 h-6" />
            <h1 className="text-xl font-bold">Link inválido</h1>
          </div>
          <p className="text-muted-foreground">
            {loadError || 'A proposta solicitada não existe ou o link de aprovação expirou.'}
          </p>
          <p className="text-sm text-muted-foreground">
            Entre em contato com o comercial da OPEN caso precise de um novo link.
          </p>
        </div>
      </div>
    );
  }
  
  const clientName = proposal.name || proposal.company || 'Cliente';
  const totalValue = formatCurrency(proposal.total || 0);
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <OpenLogo />
        </div>

        <div className="open-card space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Proposta Comercial</h1>
            <p className="text-primary font-mono text-lg">#{proposal.uuid || proposal.id}</p>
          </div>

          {/* Resumo da Proposta */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Cliente</p>
                <p className="text-foreground font-medium">{clientName}</p>
              </div>
              {proposal.company && proposal.company !== clientName && (
                <div>
                  <p className="text-muted-foreground">Empresa</p>
                  <p className="text-foreground font-medium">{proposal.company}</p>
                </div>
              )}
              {proposal.email && (
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="text-foreground font-medium">{proposal.email}</p>
                </div>
              )}
              {proposal.datacenter && (
                <div>
                  <p className="text-muted-foreground">Datacenter</p>
                  <p className="text-foreground font-medium">{proposal.datacenter}</p>
                </div>
              )}
            </div>

            {/* Prazo contratual */}
            {proposal.contract_duration && (
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Prazo Contratual</span>
                  <span className="text-foreground font-medium">{proposal.contract_duration} meses</span>
                </div>
              </div>
            )}

            {/* Total */}
            <div className="border-t border-border pt-4 text-center">
              <p className="text-muted-foreground text-sm">Valor Total Mensal</p>
              <p className="text-3xl font-bold text-primary">{totalValue}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <Button 
              variant="open-outline" 
              className="w-full" 
              onClick={handleDownloadPDF}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Baixar Proposta em PDF
            </Button>

            {finalStatus === 'approved' ? (
              <div className="text-center py-3 bg-success/10 border border-success/30 rounded-lg">
                <Check className="w-6 h-6 text-success mx-auto mb-1" />
                <p className="text-success font-medium">Proposta Aprovada</p>
                <p className="text-success/80 text-sm">Nossa equipe entrará em contato em breve</p>
              </div>
            ) : finalStatus === 'rejected' ? (
              <div className="text-center py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <X className="w-6 h-6 text-destructive mx-auto mb-1" />
                <p className="text-destructive font-medium">Proposta Recusada</p>
                <p className="text-destructive/80 text-sm">Sua decisão foi registrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Button 
                  variant="success"
                  className="w-full"
                  onClick={handleApproveImmediate}
                  disabled={isSubmitting || actionInProgressRef.current}
                >
                  {isSubmitting && !pendingAction ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Aprovando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      APROVAR PROPOSTA
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline"
                  className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
                  onClick={handleRejectWithConfirmation}
                  disabled={isSubmitting}
                >
                  {isSubmitting && pendingAction === 'Reprovado' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Recusar Proposta
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-muted-foreground text-xs">
          © {new Date().getFullYear()} OPEN Data Center. Todos os direitos reservados.
        </p>
      </div>
      
      {/* Confirmation Dialog - Only for rejection */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Recusa</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a RECUSAR esta proposta. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSubmitRejection}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              Sim, Recusar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PropostaAprovar;
