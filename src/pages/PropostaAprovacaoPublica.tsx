/**
 * PropostaAprovacaoPublica — 100% Supabase public approval page
 * 
 * URL: /proposta/aprovacao/:token
 * 
 * No login required. Loads proposal by approval token from Supabase.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileDown, Check, X, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import OpenLogo from '@/components/OpenLogo';
import { formatCurrency } from '@/lib/calculatorConfig';
import { trackProposalEvent } from '@/services/proposalTrackingService';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  loadPublicProposalByToken,
  recordApprovalDecision,
  getPublicPdfSignedUrl,
  type PublicProposal,
  type LoadError,
} from '@/services/publicApprovalService';
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

type PageState = 'loading' | 'error' | 'ready' | 'decided';

const ERROR_MESSAGES: Record<LoadError, { title: string; description: string }> = {
  token_missing: { title: 'Token ausente', description: 'Token de aprovação ausente.' },
  token_invalid: { title: 'Token inválido', description: 'Token de aprovação inválido.' },
  token_expired: { title: 'Link expirado', description: 'Este link de aprovação expirou. Solicite um novo link ao comercial.' },
  already_approved: { title: 'Já aprovada', description: 'Esta proposta já foi aprovada.' },
  already_rejected: { title: 'Já recusada', description: 'Esta proposta já foi recusada.' },
  unknown: { title: 'Erro', description: 'Erro ao carregar proposta. Tente novamente mais tarde.' },
};

const PropostaAprovacaoPublica: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalDecision, setFinalDecision] = useState<'accepted' | 'rejected' | null>(null);
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);
  const actionInProgressRef = useRef(false);

  // Load proposal on mount
  useEffect(() => {
    loadProposal();
  }, [token]);

  const loadProposal = async () => {
    setPageState('loading');

    if (!token) {
      setLoadError('token_missing');
      setLoadErrorMessage('Token de aprovação ausente.');
      setPageState('error');
      return;
    }

    const result = await loadPublicProposalByToken(token);

    if (result.error) {
      setLoadError(result.error);
      setLoadErrorMessage(result.message || '');
      setPageState('error');
      return;
    }

    const p = result.proposal;
    setProposal(p);

    // Check if already decided
    const status = (p.status || '').toUpperCase();
    if (p.approval_decision === 'accepted' || status === 'APROVADO' || status === 'APPROVED') {
      setFinalDecision('accepted');
      setPageState('decided');
    } else if (p.approval_decision === 'rejected' || status === 'RECUSADO' || status === 'REPROVADO' || status === 'REJECTED') {
      setFinalDecision('rejected');
      setPageState('decided');
    } else {
      setPageState('ready');
    }

    // Track view
    trackProposalEvent({ proposalId: p.id, source: 'view_public' });
  };

  const handleApprove = async () => {
    if (actionInProgressRef.current || !proposal) return;
    actionInProgressRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await recordApprovalDecision(proposal.id, 'accepted');

      if (!result.success) {
        toast({ title: 'Erro', description: result.error || 'Não foi possível aprovar.', variant: 'destructive' });
        return;
      }

      trackProposalEvent({ proposalId: proposal.id, source: 'approved' });
      setFinalDecision('accepted');
      setPageState('decided');
      toast({ title: 'Proposta aprovada!', description: 'Nossa equipe comercial entrará em contato em breve.' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Erro inesperado.', variant: 'destructive' });
    } finally {
      actionInProgressRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirmed = async () => {
    if (actionInProgressRef.current || !proposal) return;
    actionInProgressRef.current = true;
    setConfirmRejectOpen(false);
    setIsSubmitting(true);

    try {
      const result = await recordApprovalDecision(proposal.id, 'rejected');

      if (!result.success) {
        toast({ title: 'Erro', description: result.error || 'Não foi possível recusar.', variant: 'destructive' });
        return;
      }

      trackProposalEvent({ proposalId: proposal.id, source: 'rejected' });
      setFinalDecision('rejected');
      setPageState('decided');
      toast({ title: 'Proposta recusada', description: 'Sua decisão foi registrada.' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Erro inesperado.', variant: 'destructive' });
    } finally {
      actionInProgressRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!proposal?.pdf_path) {
      toast({ title: 'PDF indisponível', description: 'O PDF desta proposta não está disponível no momento.', variant: 'destructive' });
      return;
    }

    const signedUrl = await getPublicPdfSignedUrl(proposal.pdf_path);
    if (!signedUrl) {
      toast({ title: 'PDF indisponível', description: 'Não foi possível gerar link de download do PDF.', variant: 'destructive' });
      return;
    }

    const a = document.createElement('a');
    a.href = signedUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = `OPEN_proposta_${proposal.display_id || proposal.id.substring(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    toast({ title: 'Download iniciado', description: 'O PDF foi aberto para download.' });
  };

  // ============================================================================
  // RENDER: Loading
  // ============================================================================
  if (pageState === 'loading') {
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

  // ============================================================================
  // RENDER: Error
  // ============================================================================
  if (pageState === 'error') {
    const errInfo = loadError ? ERROR_MESSAGES[loadError] : { title: 'Erro', description: loadErrorMessage };
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 p-8 max-w-md">
          <OpenLogo />
          <div className="flex items-center justify-center gap-2 text-destructive">
            <AlertCircle className="w-6 h-6" />
            <h1 className="text-xl font-bold">{errInfo.title}</h1>
          </div>
          <p className="text-muted-foreground">{loadErrorMessage || errInfo.description}</p>
          <p className="text-sm text-muted-foreground">
            Entre em contato com o comercial da OPEN caso precise de um novo link.
          </p>
        </div>
      </div>
    );
  }

  if (!proposal) return null;

  const clientName = proposal.name || proposal.company || 'Cliente';
  const totalValue = formatCurrency(proposal.total || 0);
  const isDecided = pageState === 'decided';

  // ============================================================================
  // RENDER: Proposal
  // ============================================================================
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <OpenLogo />
        </div>

        <div className="open-card space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Proposta Comercial</h1>
            <p className="text-primary font-mono text-lg">#{proposal.display_id || proposal.id.substring(0, 8)}</p>
          </div>

          {/* Summary */}
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

            {proposal.contract_duration && (
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Prazo Contratual</span>
                  <span className="text-foreground font-medium">{proposal.contract_duration} meses</span>
                </div>
              </div>
            )}

            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Total Mensal</span>
                <span className="text-2xl font-bold text-primary">{totalValue}</span>
              </div>
            </div>
          </div>

          {/* PDF Download */}
          <Button variant="outline" className="w-full gap-2" onClick={handleDownloadPdf}>
            <FileDown className="w-4 h-4" />
            Baixar PDF da Proposta
          </Button>

          {/* Decision result */}
          {isDecided && finalDecision === 'accepted' && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
              <p className="text-green-600 font-bold text-lg">Proposta Aprovada</p>
              <p className="text-sm text-muted-foreground">Nossa equipe comercial entrará em contato em breve.</p>
            </div>
          )}

          {isDecided && finalDecision === 'rejected' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center space-y-2">
              <XCircle className="w-8 h-8 text-red-500 mx-auto" />
              <p className="text-red-600 font-bold text-lg">Proposta Recusada</p>
              <p className="text-sm text-muted-foreground">Sua decisão foi registrada.</p>
            </div>
          )}

          {/* Action buttons — only when not decided */}
          {!isDecided && (
            <div className="space-y-3">
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApprove}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Aceitar Proposta
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2 border-red-500/50 text-red-500 hover:bg-red-500/10"
                onClick={() => setConfirmRejectOpen(true)}
                disabled={isSubmitting}
              >
                <X className="w-4 h-4" />
                Recusar Proposta
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          OPEN — Proposta válida até {new Date(proposal.due_at).toLocaleDateString('pt-BR')}
        </p>
      </div>

      {/* Rejection confirmation dialog */}
      <AlertDialog open={confirmRejectOpen} onOpenChange={setConfirmRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar recusa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja recusar esta proposta? Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirmed}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sim, recusar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PropostaAprovacaoPublica;
