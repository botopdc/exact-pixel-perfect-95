import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileDown, Link as LinkIcon, Mail, Loader2 } from 'lucide-react';
import OpenLogo from '@/components/OpenLogo';
import { useProposal, useSendProposalEmail, useUpdateProposalStatus } from '@/hooks/useProposals';
import { useTrackEvent } from '@/hooks/useProposalEvents';
import { generateOpenPDF } from '@/lib/pdfGenerator';
import { formatCurrency, getValidityDate, formatDateBR } from '@/lib/calculatorConfig';
import { useToast } from '@/hooks/use-toast';

const PropostaView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  // Local storage hook
  const { data: proposal, isLoading } = useProposal(id);
  const sendEmailMutation = useSendProposalEmail();
  const updateStatusMutation = useUpdateProposalStatus();
  const trackEvent = useTrackEvent();

  // Track internal view on mount
  useEffect(() => {
    if (id) {
      trackEvent.mutate({ 
        proposalId: id, 
        type: 'view_internal', 
        channel: 'ui' 
      });
    }
  }, [id]);

  const handleDownloadPDF = () => {
    if (!proposal?.result) {
      toast({ title: 'Erro', description: 'Dados da proposta incompletos', variant: 'destructive' });
      return;
    }
    
    // Track PDF download
    if (id) {
      trackEvent.mutate({ proposalId: id, type: 'pdf_download', channel: 'ui' });
    }
    
    generateOpenPDF({
      client: proposal.client,
      proposal: proposal.proposal,
      result: proposal.result,
      selectedTerm: proposal.selectedTerm,
      datacenter: proposal.datacenter || 'SP1',
      observacao: proposal.observacao,
    });
    toast({ title: 'PDF gerado', description: 'O download do PDF foi iniciado' });
  };

  const handleCopyLink = async () => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/proposta/${id}/aceite`;
    navigator.clipboard.writeText(link);
    
    // Track link copy
    if (id) {
      trackEvent.mutate({ proposalId: id, type: 'link_copy', channel: 'ui' });
      
      // Update status to "E" (Enviado) if not already set
      if (!proposal?.status) {
        await updateStatusMutation.mutateAsync({ id, status: 'E' });
      }
    }
    
    toast({ title: 'Link copiado!', description: 'O link da tela de aceite foi copiado para a área de transferência' });
  };

  const handleSendEmail = async () => {
    if (!proposal?.client?.email?.trim()) {
      toast({ title: 'Erro', description: 'Esta proposta não possui e-mail do cliente', variant: 'destructive' });
      return;
    }

    const proposalId = proposal.proposal?.id || '';
    const baseUrl = window.location.origin;
    const proposalLink = `${baseUrl}/proposta/${proposalId}`;
    const validityDateStr = proposal.proposal?.createdAt && proposal.proposal?.validityDays 
      ? getValidityDate(proposal.proposal.createdAt, proposal.proposal.validityDays).toLocaleDateString('pt-BR')
      : '-';
    
    setIsSendingEmail(true);
    
    try {
      await sendEmailMutation.mutateAsync({
        clientName: proposal.client.name || proposal.client.company || 'Cliente',
        clientEmail: proposal.client.email,
        proposalId,
        proposalLink,
        totalValue: `R$ ${formatCurrency(proposal.result?.grandTotal || 0)}`,
        validityDate: validityDateStr,
      });
      
      // Track email send
      if (id) {
        trackEvent.mutate({ proposalId: id, type: 'email_send', channel: 'ui' });
        
        // Update status to "E" (Enviado) if not already set
        if (!proposal.status) {
          await updateStatusMutation.mutateAsync({ id, status: 'E' });
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
            <Button variant="open-outline" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Proposta não encontrada</h1>
          <p className="text-muted-foreground mb-6">A proposta solicitada não existe ou foi removida.</p>
          <Button variant="open" onClick={() => navigate('/')}>Ir para Calculadora</Button>
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
            <Button variant="open-outline" size="sm" onClick={handleCopyLink}>
              <LinkIcon className="w-4 h-4" />
              Copiar Link
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
            {result && (
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
                      <tr className="proposal-table-footer-row">
                        <td colSpan={3} className="py-2 px-3">IPs públicos</td>
                        <td className="py-2 px-3 text-right font-medium tabular-nums">{formatCurrency(result.subIps)}</td>
                      </tr>
                      <tr className="proposal-table-footer-row">
                        <td colSpan={3} className="py-2 px-3">Serviços adicionais</td>
                        <td className="py-2 px-3 text-right font-medium tabular-nums">{formatCurrency(result.subServices)}</td>
                      </tr>
                      <tr className="proposal-table-footer-row">
                        <td colSpan={3} className="py-2 px-3">Backup</td>
                        <td className="py-2 px-3 text-right font-medium tabular-nums">{formatCurrency(result.subBackup)}</td>
                      </tr>
                      <tr className="proposal-table-footer-row">
                        <td colSpan={3} className="py-2 px-3">Desconto</td>
                        <td className="py-2 px-3 text-right proposal-discount tabular-nums">-{formatCurrency(result.discountValue)}</td>
                      </tr>
                      <tr className="proposal-total-row">
                        <td colSpan={3} className="py-4 px-3 text-lg">TOTAL</td>
                        <td className="py-4 px-3 text-right text-lg tabular-nums">R$ {formatCurrency(result.grandTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
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
        </div>

        {/* Action buttons below document */}
        <div className="flex justify-center gap-4 mt-8 print:hidden">
          <Button variant="open-outline" onClick={() => navigate('/propostas')}>
            <ArrowLeft className="w-4 h-4" />
            Ver todas propostas
          </Button>
          <Button variant="open" onClick={handleDownloadPDF}>
            <FileDown className="w-4 h-4" />
            Baixar PDF
          </Button>
        </div>
      </main>
    </div>
  );
};

export default PropostaView;