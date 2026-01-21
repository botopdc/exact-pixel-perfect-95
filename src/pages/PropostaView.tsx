import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileDown, Link as LinkIcon, Mail, Loader2, ShieldX } from 'lucide-react';
import OpenLogo from '@/components/OpenLogo';
import { useProposal, useSendProposalEmail, useUpdateProposalStatus } from '@/hooks/useProposals';
import { useTrackEvent } from '@/hooks/useProposalEvents';
import { generateOpenPDF } from '@/lib/pdfGenerator';
import { formatCurrency, getValidityDate, formatDateBR } from '@/lib/calculatorConfig';
import { useToast } from '@/hooks/use-toast';
import { AttachmentsList } from '@/components/attachments/AttachmentsList';
import { useAttachments } from '@/hooks/useAttachments';
import { partnerAuthService } from '@/services/partnersService';
import { authService } from '@/services/authService';
import { ROUTES, getDashboardRoute } from '@/config/routes';
import { useApprovalLink } from '@/hooks/useApprovalLink';
import { copyToClipboard } from '@/lib/clipboard';
import { LinkCopyModal } from '@/components/LinkCopyModal';

// ============================================================================
// RBAC RULES FOR INDIVIDUAL PROPOSAL ACCESS (BASED ON API FIELDS)
// ============================================================================
// Source of truth: proposal.created_by (integer, nullable) from API
// Fallback: proposal.creator?.id (from __with=creator expansion)
//
// Level 1000 (Admin): Can access any proposal
// Level 750 (Gerente Comercial): Can access any proposal
// Level 775 (CS): Can access only OWN proposals (created_by === user.id)
// Level 700 (Executivo): Can access only OWN proposals (created_by === user.id)
// Level 200 (Parceiro): Can access only OWN proposals (created_by === user.id)
// Level 1 (Cliente): Can access only proposals where proposal.email === user.email
//
// IMPORTANT: Never show proposals with created_by=null to non-managers
// ============================================================================

// Helper to get owner ID from proposal - uses API fields only
function getProposalOwnerId(proposal: any): number | null {
  // The proposal comes from useProposal hook which now preserves API fields
  
  // Primary: created_by field from API (integer, nullable)
  if (proposal?.created_by !== undefined && proposal?.created_by !== null) {
    return Number(proposal.created_by);
  }
  
  // Fallback: creator object from __with=creator expansion
  if (proposal?.creator?.id !== undefined && proposal?.creator?.id !== null) {
    return Number(proposal.creator.id);
  }
  
  // Also check dados_proposta for saved ownership info (legacy from gateway)
  if (proposal?.dados_proposta?.created_by_user_id !== undefined && 
      proposal?.dados_proposta?.created_by_user_id !== null) {
    return Number(proposal.dados_proposta.created_by_user_id);
  }
  
  // No owner info available
  return null;
}

function canAccessProposal(proposal: any, userLevel: number, userId: number | string | null, userEmail: string | null): boolean {
  // Admin (1000) and Gerente Comercial (750) can access any
  if (userLevel === 1000 || userLevel === 750) {
    return true;
  }
  
  // Client (1): Must match email
  if (userLevel === 1) {
    const clientEmail = (proposal?.client?.email || '').toLowerCase();
    return userEmail ? clientEmail === userEmail.toLowerCase() : false;
  }
  
  // Partner (200), Executives (700), CS (775): Must be the creator
  if (userLevel === 200 || userLevel === 700 || userLevel === 775) {
    const ownerId = getProposalOwnerId(proposal);
    
    // If no owner info, deny access (security - never show proposals without owner)
    if (ownerId === null) {
      console.warn('[PropostaView] Proposal without owner info - access denied for security');
      return false;
    }
    
    if (userId === null) {
      return false;
    }
    
    return ownerId === Number(userId);
  }
  
  // Other levels (600, 900, 950): No access
  return false;
}

const PropostaView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalUrl, setLinkModalUrl] = useState('');
  const { getApprovalLink } = useApprovalLink();
  
  // Get current user info for RBAC
  const internalSession = authService.getSession();
  const partnerSession = partnerAuthService.getSession();
  const userLevel = internalSession?.level || (partnerSession ? 200 : 0);
  const userId = internalSession?.userId || partnerSession?.partnerId || null;
  const userEmail = internalSession?.email || partnerSession?.email || null;
  
  // Determine dashboard route based on user context
  // CRITICAL: Check internal session FIRST to prevent partner session from overriding executive context
  const dashboardRoute = useMemo(() => {
    // First check if this is an internal user (executive or admin)
    if (internalSession) {
      const level = internalSession.level || 0;
      
      // Executives (700/750) ALWAYS go to executive dashboard
      if (level === 700 || level === 750) {
        return ROUTES.executivo.dashboard;
      }
      
      // Admin and other internal users go to admin dashboard
      if (level >= 900 || level === 1000) {
        return ROUTES.admin.dashboard;
      }
      
      // Fallback for other authenticated internal users
      return ROUTES.admin.dashboard;
    }
    
    // Only check partner session if there's no valid internal session
    if (partnerSession) {
      return ROUTES.parceiro.dashboard;
    }
    
    // Default fallback
    return ROUTES.admin.dashboard;
  }, [internalSession, partnerSession]);
  
  // Local storage hook
  const { data: proposal, isLoading } = useProposal(id);
  const sendEmailMutation = useSendProposalEmail();
  const updateStatusMutation = useUpdateProposalStatus();
  const trackEvent = useTrackEvent();
  
  // Check access permission
  const hasAccess = useMemo(() => {
    if (!proposal) return true; // Don't block while loading
    return canAccessProposal(proposal, userLevel, userId, userEmail);
  }, [proposal, userLevel, userId, userEmail]);

  // Track internal view on mount
  useEffect(() => {
    if (id && hasAccess) {
      trackEvent.mutate({ 
        proposalId: id, 
        type: 'view_internal', 
        channel: 'ui' 
      });
    }
  }, [id, hasAccess]);

  // Fetch attachments for PDF generation
  const { data: attachments = [] } = useAttachments(id);

  const handleDownloadPDF = async () => {
    // Check if we have a valid result to generate PDF
    const hasValidResult = proposal?.result && 
      proposal.result.rows && 
      proposal.result.rows.length > 0;
    
    if (!hasValidResult) {
      toast({ title: 'Erro', description: 'Dados da proposta incompletos para gerar PDF', variant: 'destructive' });
      return;
    }
    
    // Track PDF download
    if (id) {
      trackEvent.mutate({ proposalId: id, type: 'pdf_download', channel: 'ui' });
    }
    
    try {
      await generateOpenPDF({
        client: proposal.client,
        proposal: proposal.proposal,
        result: proposal.result,
        selectedTerm: proposal.selectedTerm,
        datacenter: proposal.datacenter || 'SP1',
        observacao: proposal.observacao,
        attachments: attachments,
        reseller: proposal.reseller,
      });
      toast({ title: 'PDF gerado', description: 'O download do PDF foi iniciado' });
    } catch (error) {
      toast({ title: 'Erro ao gerar PDF', description: 'Não foi possível gerar o PDF', variant: 'destructive' });
    }
  };

  const handleCopyLink = async () => {
    if (!id) return;
    
    setIsCopyingLink(true);
    try {
      // Fetch approval token and generate link with it
      const approvalLink = await getApprovalLink(id);
      
      // Try to copy to clipboard (with Safari fallback)
      const copySuccess = await copyToClipboard(approvalLink);
      
      // Track link copy
      trackEvent.mutate({ proposalId: id, type: 'link_copy', channel: 'ui' });
      
      // Update status to SENT if still DRAFT
      if (!proposal?.status || proposal?.status === 'DRAFT') {
        await updateStatusMutation.mutateAsync({ id, status: 'SENT' });
      }
      
      if (copySuccess) {
        toast({ title: 'Link copiado!', description: 'O link de aprovação com token foi copiado' });
      } else {
        // Safari blocked copy - show modal with selectable link
        setLinkModalUrl(approvalLink);
        setLinkModalOpen(true);
        toast({ 
          title: 'Copie o link manualmente', 
          description: 'O Safari bloqueou a cópia automática. Use o modal para copiar o link.',
        });
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao gerar link', variant: 'destructive' });
    } finally {
      setIsCopyingLink(false);
    }
  };

  const handleSendEmail = async () => {
    if (!proposal?.client?.email?.trim()) {
      toast({ title: 'Erro', description: 'Esta proposta não possui e-mail do cliente', variant: 'destructive' });
      return;
    }

    const proposalId = proposal.proposal?.id || '';
    const validityDateStr = proposal.proposal?.createdAt && proposal.proposal?.validityDays 
      ? getValidityDate(proposal.proposal.createdAt, proposal.proposal.validityDays).toLocaleDateString('pt-BR')
      : '-';
    
    setIsSendingEmail(true);
    
    try {
      // CRITICAL: First fetch approval token and build tokenized link
      console.log('[PropostaView] Fetching approval link for email send:', id);
      let proposalLink: string;
      
      try {
        proposalLink = await getApprovalLink(id!);
        console.log('[PropostaView] Got tokenized approval link for email');
      } catch (linkError: any) {
        console.error('[PropostaView] Failed to get approval link:', linkError);
        toast({ 
          title: 'Erro ao gerar link', 
          description: linkError.message || 'Não foi possível gerar link de aprovação com token',
          variant: 'destructive' 
        });
        setIsSendingEmail(false);
        return; // Block email send if we can't get token
      }
      
      await sendEmailMutation.mutateAsync({
        clientName: proposal.client.name || proposal.client.company || 'Cliente',
        clientEmail: proposal.client.email,
        proposalId,
        proposalLink, // Now uses tokenized link
        totalValue: `R$ ${formatCurrency(proposal.result?.grandTotal || 0)}`,
        validityDate: validityDateStr,
      });
      
      // Track email send
      if (id) {
        trackEvent.mutate({ proposalId: id, type: 'email_send', channel: 'ui' });
        
        // Update status to SENT if still DRAFT
        if (!proposal.status || proposal.status === 'DRAFT') {
          await updateStatusMutation.mutateAsync({ id, status: 'SENT' });
        }
      }
      
      toast({ title: 'Email enviado!', description: `Proposta enviada para ${proposal.client.email}` });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao enviar email', 
        description: error.message || 'Falha ao enviar email',
        variant: 'destructive' 
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <OpenLogo />
            <div className="h-10 w-40 bg-muted/50 animate-pulse rounded" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="h-24 w-full bg-muted/50 animate-pulse rounded" />
            <div className="h-48 w-full bg-muted/50 animate-pulse rounded" />
            <div className="h-64 w-full bg-muted/50 animate-pulse rounded" />
          </div>
        </main>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <OpenLogo />
            <Button variant="open-outline" onClick={() => navigate('/modulos/comercial/propostas')}>
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Proposta não encontrada</h1>
          <p className="text-muted-foreground mb-6">A proposta solicitada não existe ou foi removida.</p>
          <Button variant="open" onClick={() => navigate('/modulos/comercial/propostas')}>Voltar para Propostas</Button>
        </main>
      </div>
    );
  }

  // RBAC: Access denied screen
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <OpenLogo />
            <Button variant="open-outline" onClick={() => navigate('/modulos/comercial/propostas')}>
              <ArrowLeft className="w-4 h-4" />
              Voltar para Propostas
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-16 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <ShieldX className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-4">Acesso negado</h1>
            <p className="text-muted-foreground mb-6">
              Você não tem permissão para visualizar esta proposta. 
              Apenas o criador da proposta ou gestores podem acessá-la.
            </p>
            <Button variant="open" onClick={() => navigate('/modulos/comercial/propostas')}>
              Voltar para Propostas
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const clientName = proposal.client?.name || proposal.client?.company || 'Sem nome';
  const clientCompany = proposal.client?.company || '';
  const clientEmail = proposal.client?.email || '';
  const clientPhone = proposal.client?.phone || '';
  const proposalId = proposal.proposal?.id || '-';
  const createdAt = proposal.proposal?.createdAt ? formatDateBR(proposal.proposal.createdAt) : '-';
  const validityDate = proposal.proposal?.createdAt && proposal.proposal?.validityDays 
    ? getValidityDate(proposal.proposal.createdAt, proposal.proposal.validityDays).toLocaleDateString('pt-BR')
    : '-';
  const result = proposal.result;

  return (
    <div className="min-h-screen proposal-page-wrapper">
      {/* Action bar - fixed at top */}
      <header className="proposal-header-bar sticky top-0 z-10 print:hidden">
        <div className="max-w-[960px] mx-auto px-6 py-3 flex items-center justify-between">
          <OpenLogo />
          <div className="flex items-center gap-2">
            <Button variant="open-outline" size="sm" onClick={handleCopyLink} disabled={isCopyingLink}>
              {isCopyingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
              {isCopyingLink ? 'Gerando...' : 'Copiar Link'}
            </Button>
            <Button variant="open" size="sm" onClick={handleSendEmail} disabled={!clientEmail || isSendingEmail}>
              {isSendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {isSendingEmail ? 'Enviando...' : 'Enviar Email'}
            </Button>
            <Button variant="open" size="sm" onClick={handleDownloadPDF}>
              <FileDown className="w-4 h-4" />
              Gerar PDF
            </Button>
          </div>
        </div>
      </header>

      {/* Proposal document - A4-like container */}
      <main className="py-10 px-4 print:py-0 print:px-0">
        <div className="proposal-page proposal-document max-w-[960px] mx-auto print:shadow-none print:border-none print:rounded-none">
          {/* Document content with consistent padding */}
          <div className="p-8 space-y-8">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-6 border-b proposal-divider">
              <div>
                <div className="mb-4">
                  <OpenLogo />
                </div>
                <h1 className="text-2xl font-bold proposal-heading mb-1">Proposta Comercial</h1>
                <p className="proposal-id text-lg">{proposalId}</p>
              </div>
              <div className="text-left md:text-right space-y-1">
                <p className="proposal-meta-label">
                  Criada em: <span className="proposal-meta-value">{createdAt}</span>
                </p>
                <p className="proposal-meta-label">
                  Válida até: <span className="proposal-meta-value">{validityDate}</span>
                </p>
                <p className="proposal-meta-label">
                  Vigência: <span className="proposal-meta-value">{proposal.selectedTerm || '1'} {parseInt(proposal.selectedTerm || '1') === 1 ? 'mês' : 'meses'}</span>
                </p>
                <p className="proposal-meta-label">
                  Datacenter: <span className="proposal-meta-value">{proposal.datacenter || 'SP1'}</span>
                </p>
              </div>
            </div>

            {/* Client data section */}
            <div className="pb-6 border-b proposal-divider">
              <h2 className="proposal-section-title text-base mb-4 uppercase tracking-wide">
                Dados do Cliente
              </h2>
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <span className="proposal-label">Nome</span>
                  <p className="proposal-value mt-0.5">{clientName}</p>
                </div>
                {clientCompany && (
                  <div>
                    <span className="proposal-label">Empresa</span>
                    <p className="proposal-value mt-0.5">{clientCompany}</p>
                  </div>
                )}
                {clientEmail && (
                  <div>
                    <span className="proposal-label">E-mail</span>
                    <p className="proposal-value mt-0.5">{clientEmail}</p>
                  </div>
                )}
                {clientPhone && (
                  <div>
                    <span className="proposal-label">Telefone</span>
                    <p className="proposal-value mt-0.5">{clientPhone}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Items and totals table */}
            {result && result.rows && result.rows.length > 0 ? (
              <div>
                <h2 className="proposal-section-title text-base mb-4 uppercase tracking-wide">
                  Resumo & Totais
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="proposal-table-header">
                        <th className="text-left py-3 px-3 text-xs uppercase tracking-wide">Item</th>
                        <th className="text-right py-3 px-3 text-xs uppercase tracking-wide">Qtd</th>
                        <th className="text-right py-3 px-3 text-xs uppercase tracking-wide">Preço unit.</th>
                        <th className="text-right py-3 px-3 text-xs uppercase tracking-wide">Subtotal (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i} className="proposal-table-row">
                          <td className="py-3 px-3">{row.label}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{row.qty}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(row.unitPrice)}</td>
                          <td className="py-3 px-3 text-right font-medium tabular-nums">{formatCurrency(row.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="proposal-table-footer-row border-t-2 border-[#E2E8F0]">
                        <td colSpan={3} className="py-2 px-3">Subtotal recursos</td>
                        <td className="py-2 px-3 text-right font-medium tabular-nums">{formatCurrency(result.subRec)}</td>
                      </tr>
                      {result.subIps > 0 && (
                        <tr className="proposal-table-footer-row">
                          <td colSpan={3} className="py-2 px-3">IPs públicos</td>
                          <td className="py-2 px-3 text-right font-medium tabular-nums">{formatCurrency(result.subIps)}</td>
                        </tr>
                      )}
                      {result.subServices > 0 && (
                        <tr className="proposal-table-footer-row">
                          <td colSpan={3} className="py-2 px-3">Serviços adicionais</td>
                          <td className="py-2 px-3 text-right font-medium tabular-nums">{formatCurrency(result.subServices)}</td>
                        </tr>
                      )}
                      {result.subBackup > 0 && (
                        <tr className="proposal-table-footer-row">
                          <td colSpan={3} className="py-2 px-3">Backup</td>
                          <td className="py-2 px-3 text-right font-medium tabular-nums">{formatCurrency(result.subBackup)}</td>
                        </tr>
                      )}
                      {result.discountValue > 0 && (
                        <tr className="proposal-table-footer-row">
                          <td colSpan={3} className="py-2 px-3">Desconto ({(result.discountPct * 100).toFixed(0)}%)</td>
                          <td className="py-2 px-3 text-right proposal-discount tabular-nums">-{formatCurrency(result.discountValue)}</td>
                        </tr>
                      )}
                      <tr className="proposal-total-row">
                        <td colSpan={3} className="py-4 px-3 text-lg">TOTAL MENSAL</td>
                        <td className="py-4 px-3 text-right text-lg tabular-nums">R$ {formatCurrency(result.grandTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-muted-foreground/30 rounded-lg p-8 text-center">
                <h2 className="proposal-section-title text-base mb-2 uppercase tracking-wide">
                  Resumo & Totais
                </h2>
                <p className="text-muted-foreground">
                  Itens da proposta não encontrados. Verifique se a proposta foi salva corretamente.
                </p>
                {proposal.total > 0 && (
                  <p className="text-lg font-semibold mt-4">
                    Total: R$ {formatCurrency(proposal.total)}
                  </p>
                )}
              </div>
            )}

            {/* Observações section - only if present */}
            {proposal.observacao && (
              <div className="pt-6 border-t proposal-divider">
                <h2 className="proposal-section-title text-base mb-4 uppercase tracking-wide">
                  Observações
                </h2>
                <p className="proposal-value text-sm whitespace-pre-wrap">{proposal.observacao}</p>
              </div>
            )}
          </div>

          {/* Attachments section - outside document styling */}
          <div className="p-8 pt-0">
            <AttachmentsList proposalId={id || ''} readOnly={false} />
          </div>
        </div>

        {/* Action buttons below document */}
        <div className="flex justify-center gap-4 mt-8 print:hidden">
          <Button variant="open-outline" onClick={() => navigate('/modulos/comercial/propostas')}>
            <ArrowLeft className="w-4 h-4" />
            Voltar para Propostas
          </Button>
          <Button variant="open" onClick={handleDownloadPDF}>
            <FileDown className="w-4 h-4" />
            Baixar PDF
          </Button>
        </div>
      </main>

      {/* Link Copy Modal for Safari fallback */}
      <LinkCopyModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        link={linkModalUrl}
      />
    </div>
  );
};

export default PropostaView;