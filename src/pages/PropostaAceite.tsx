import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileDown, Check, X, Loader2 } from 'lucide-react';
import OpenLogo from '@/components/OpenLogo';
import { useProposal, useUpdateProposalStatus } from '@/hooks/useProposals';
import { useTrackEvent } from '@/hooks/useProposalEvents';
import { generateOpenPDF } from '@/lib/pdfGenerator';
import { formatCurrency, getValidityDate } from '@/lib/calculatorConfig';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const PropostaAceite: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [finalStatus, setFinalStatus] = useState<'A' | 'R' | null>(null);
  
  const { data: proposal, isLoading } = useProposal(id);
  const updateStatusMutation = useUpdateProposalStatus();
  const trackEvent = useTrackEvent();

  // Track public view on mount
  useEffect(() => {
    if (id) {
      trackEvent.mutate({ 
        proposalId: id, 
        type: 'view_public', 
        channel: 'public_url' 
      });
    }
  }, [id]);

  // Check if already approved/rejected - uses "Approved"/"Rejected" from API
  useEffect(() => {
    const status = proposal?.status;
    if (status === 'Approved' || status === 'A') {
      setFinalStatus('A');
    } else if (status === 'Rejected' || status === 'R') {
      setFinalStatus('R');
    }
  }, [proposal?.status]);

  const handleDownloadPDF = () => {
    if (!proposal?.result) {
      toast({ title: 'Erro', description: 'Dados da proposta incompletos', variant: 'destructive' });
      return;
    }
    
    // Track PDF download
    if (id) {
      trackEvent.mutate({ proposalId: id, type: 'pdf_download', channel: 'public_url' });
    }
    
    generateOpenPDF({
      client: proposal.client,
      proposal: proposal.proposal,
      result: proposal.result,
      selectedTerm: proposal.selectedTerm,
    });
    toast({ title: 'PDF gerado', description: 'O download do PDF foi iniciado' });
  };

  const handleAcceptProposal = async () => {
    if (!proposal || !id) return;
    
    setIsAccepting(true);
    try {
      // Get the numeric API ID for proper update
      const apiId = proposal.id ? String(proposal.id) : id;
      
      console.log('[PropostaAceite] Accepting proposal with status="Approved":', { 
        urlId: id, 
        apiId, 
        numericId: proposal.id,
      });

      // Update proposal status using ONLY the "Approved" status field
      // API will automatically set approved_at and status_at
      await updateStatusMutation.mutateAsync({
        id: apiId,
        status: 'Approved',
      });

      // Track accept event
      trackEvent.mutate({ 
        proposalId: id, 
        type: 'accept', 
        channel: 'public_url',
      });

      // Send confirmation email
      const clientName = proposal.client?.name || proposal.client?.company || 'Cliente';
      const proposalDisplayId = proposal.proposal?.id || '-';
      const totalValue = formatCurrency(proposal.result?.grandTotal || 0);
      const validityDateStr = proposal.proposal?.createdAt && proposal.proposal?.validityDays 
        ? getValidityDate(proposal.proposal.createdAt, proposal.proposal.validityDays).toLocaleDateString('pt-BR')
        : '-';

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      await fetch(`${supabaseUrl}/functions/v1/send-proposal-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          clientEmail: 'comercial@opendata.center',
          proposalId: proposalDisplayId,
          proposalLink: window.location.href,
          totalValue,
          validityDate: validityDateStr,
          isAcceptance: true,
        }),
      });

      setFinalStatus('A');
      toast({ 
        title: 'Proposta aceita!', 
        description: 'A confirmação foi enviada para nossa equipe comercial.' 
      });
    } catch (error: any) {
      console.error('[PropostaAceite] Error accepting proposal:', error);
      toast({ 
        title: 'Erro ao aceitar proposta', 
        description: error.message || 'Tente novamente mais tarde', 
        variant: 'destructive' 
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleRejectProposal = async () => {
    if (!proposal || !id) return;
    
    setIsRejecting(true);
    try {
      // Get the numeric API ID for proper update
      const apiId = proposal.id ? String(proposal.id) : id;
      
      console.log('[PropostaAceite] Rejecting proposal with status="Rejected":', { 
        urlId: id, 
        apiId, 
        numericId: proposal.id,
      });

      // Update proposal status using ONLY the "Rejected" status field
      await updateStatusMutation.mutateAsync({
        id: apiId,
        status: 'Rejected',
      });

      // Track reject event
      trackEvent.mutate({ 
        proposalId: id, 
        type: 'reject', 
        channel: 'public_url',
      });

      setFinalStatus('R');
      toast({ 
        title: 'Proposta recusada', 
        description: 'Sua decisão foi registrada.' 
      });
    } catch (error: any) {
      console.error('[PropostaAceite] Error rejecting proposal:', error);
      toast({ 
        title: 'Erro ao recusar proposta', 
        description: error.message || 'Tente novamente mais tarde', 
        variant: 'destructive' 
      });
    } finally {
      setIsRejecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <OpenLogo />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <OpenLogo />
          <h1 className="text-2xl font-bold text-foreground">Proposta não encontrada</h1>
          <p className="text-muted-foreground">A proposta solicitada não existe ou foi removida.</p>
        </div>
      </div>
    );
  }

  const clientName = proposal.client?.name || proposal.client?.company || 'Cliente';
  const proposalId = proposal.proposal?.id || '-';
  const totalValue = formatCurrency(proposal.result?.grandTotal || 0);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <OpenLogo />
        </div>

        <div className="open-card space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Proposta Comercial</h1>
            <p className="text-primary font-mono text-lg">#{proposalId}</p>
          </div>

          {/* Resumo da Proposta */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Cliente</p>
                <p className="text-foreground font-medium">{clientName}</p>
              </div>
              {proposal.client?.company && proposal.client.company !== clientName && (
                <div>
                  <p className="text-muted-foreground">Empresa</p>
                  <p className="text-foreground font-medium">{proposal.client.company}</p>
                </div>
              )}
              {proposal.client?.email && (
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="text-foreground font-medium">{proposal.client.email}</p>
                </div>
              )}
              {proposal.client?.phone && (
                <div>
                  <p className="text-muted-foreground">Telefone</p>
                  <p className="text-foreground font-medium">{proposal.client.phone}</p>
                </div>
              )}
            </div>

            {/* Itens da proposta */}
            {proposal.result?.rows && proposal.result.rows.length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-muted-foreground text-sm mb-2">Itens da Proposta</p>
                <div className="space-y-2">
                  {proposal.result.rows.map((row, index) => (
                    <div key={index} className="flex justify-between items-center text-sm py-1 border-b border-border/50 last:border-0">
                      <span className="text-foreground">{row.label} (x{row.qty})</span>
                      <span className="text-primary font-medium">{formatCurrency(row.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prazo contratual */}
            {proposal.selectedTerm && (
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Prazo Contratual</span>
                  <span className="text-foreground font-medium">{proposal.selectedTerm} meses</span>
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

            {finalStatus === 'A' ? (
              <div className="text-center py-3 bg-success/10 border border-success/30 rounded-lg">
                <Check className="w-6 h-6 text-success mx-auto mb-1" />
                <p className="text-success font-medium">Proposta Aceita</p>
                <p className="text-success/80 text-sm">Confirmação enviada para nossa equipe</p>
              </div>
            ) : finalStatus === 'R' ? (
              <div className="text-center py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <X className="w-6 h-6 text-destructive mx-auto mb-1" />
                <p className="text-destructive font-medium">Proposta Recusada</p>
                <p className="text-destructive/80 text-sm">Sua decisão foi registrada</p>
              </div>
            ) : (
              <Button 
                variant="success"
                className="w-full"
                onClick={handleAcceptProposal}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Aceitando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    ACEITAR PROPOSTA
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-muted-foreground text-xs">
          © {new Date().getFullYear()} OPEN Data Center. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default PropostaAceite;