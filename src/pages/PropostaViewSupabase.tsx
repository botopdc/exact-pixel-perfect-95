/**
 * PropostaViewSupabase - Displays proposal from Supabase (source of truth)
 * 
 * This component shows the persisted servers and addons with unit_price
 * and total_price from the database - NO silent recalculations.
 */

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileDown, Link as LinkIcon, Mail, Loader2, Pencil } from 'lucide-react';
import OpenLogo from '@/components/OpenLogo';
import { useSupabaseProposal } from '@/hooks/useSupabaseProposals';
import { formatCurrency } from '@/lib/calculatorConfig';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/authService';
import { ROUTES, getProposalEditRoute } from '@/config/routes';
import { Badge } from '@/components/ui/badge';
import { supabaseToCalculatorState } from '@/services/proposalFormatConverters';
import type { CalculatorProposalServerRow, CalculatorProposalAddonRow } from '@/types/calculatorProposal';

// Format date to Brazilian format
function formatDateBR(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

// Get validity date
function getValidityDate(createdAt: string, daysToAdd: number = 30): Date {
  const date = new Date(createdAt);
  date.setDate(date.getDate() + daysToAdd);
  return date;
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; className: string }> = {
    Rascunho: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
    Enviado: { label: 'Enviado', className: 'bg-sky-500/20 text-sky-600' },
    Aprovado: { label: 'Aprovado', className: 'bg-green-500/20 text-green-600' },
    Recusado: { label: 'Recusado', className: 'bg-red-500/20 text-red-600' },
    Expirado: { label: 'Expirado', className: 'bg-orange-500/20 text-orange-600' },
    Cancelado: { label: 'Cancelado', className: 'bg-gray-500/20 text-gray-600' },
  };
  
  const config = statusMap[status] || statusMap.Rascunho;
  return <Badge className={`${config.className} font-medium`}>{config.label}</Badge>;
}

// Server row component for table
function ServerRow({ server, index }: { server: CalculatorProposalServerRow; index: number }) {
  const getServerLabel = () => {
    if (server.server_type === 'vm') {
      return `VM ${server.vcpu} vCPU / ${server.ram_gb}GB RAM / ${server.nvme_tb}TB NVMe`;
    }
    if (server.server_type === 'bm') {
      return `Bare Metal ${server.bm_cpu || ''} / ${server.bm_ram || ''}`;
    }
    if (server.server_type === 'storage') {
      return `Storage ${server.storage_type || ''} ${server.volume_tb || 0}TB (${server.storage_region || 'BR'})`;
    }
    return server.name || `Servidor ${index + 1}`;
  };

  return (
    <tr className="proposal-table-row border-b border-border/50">
      <td className="py-3 px-3">{getServerLabel()}</td>
      <td className="py-3 px-3 text-right tabular-nums">{server.qty_servers}</td>
      <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(server.unit_price)}</td>
      <td className="py-3 px-3 text-right font-medium tabular-nums">{formatCurrency(server.total_price)}</td>
    </tr>
  );
}

// Addon row component for table
function AddonRow({ addon }: { addon: CalculatorProposalAddonRow }) {
  if (!addon.enabled) return null;
  
  return (
    <tr className="proposal-table-row border-b border-border/50">
      <td className="py-3 px-3">{addon.label}</td>
      <td className="py-3 px-3 text-right tabular-nums">{addon.quantity}</td>
      <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(addon.unit_price)}</td>
      <td className="py-3 px-3 text-right font-medium tabular-nums">{formatCurrency(addon.total_price)}</td>
    </tr>
  );
}

const PropostaViewSupabase: React.FC = () => {
  const { id: proposalId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Auth check
  const session = authService.getSession();
  const userLevel = session?.level || 0;
  const canEdit = userLevel === 700 || userLevel === 750 || userLevel === 1000;
  
  // Fetch proposal from Supabase
  const { data: proposal, isLoading, error } = useSupabaseProposal(proposalId);
  
  const handleEdit = () => {
    if (!proposal || !proposalId) return;
    
    if (proposal.status === 'Aprovado' || proposal.status === 'Recusado') {
      toast({
        title: 'Edição bloqueada',
        description: `Propostas ${proposal.status.toLowerCase()}s não podem ser editadas`,
        variant: 'destructive',
      });
      return;
    }
    
    // Convert to calculator state and navigate
    const calculatorState = supabaseToCalculatorState(proposal);
    const editPath = getProposalEditRoute(proposalId, false);
    navigate(editPath, { state: { editProposal: calculatorState, supabaseId: proposalId } });
  };
  
  // Render loading
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
          </div>
        </main>
      </div>
    );
  }
  
  // Render not found
  if (!proposal || error) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <OpenLogo />
            <Button variant="outline" onClick={() => navigate(ROUTES.modulos.comercial.proposals)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Proposta não encontrada</h1>
          <p className="text-muted-foreground mb-6">
            {error instanceof Error ? error.message : 'A proposta solicitada não existe ou foi removida.'}
          </p>
          <Button onClick={() => navigate(ROUTES.modulos.comercial.proposals)}>Voltar para Propostas</Button>
        </main>
      </div>
    );
  }
  
  // Data extraction
  const servers = proposal.servers || [];
  const addons = (proposal.addons || []).filter(a => a.enabled);
  const validityDate = getValidityDate(proposal.created_at);
  const hasItems = servers.length > 0 || addons.length > 0;
  
  // Calculate totals from DB (no recalculation)
  const serversTotal = servers.reduce((sum, s) => sum + (s.total_price || 0), 0);
  const addonsTotal = addons.reduce((sum, a) => sum + (a.total_price || 0), 0);
  
  return (
    <div className="min-h-screen proposal-page-wrapper">
      {/* Header */}
      <header className="proposal-header-bar sticky top-0 z-10 border-b border-border bg-card/50 backdrop-blur-sm print:hidden">
        <div className="max-w-[960px] mx-auto px-6 py-3 flex items-center justify-between">
          <OpenLogo />
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Pencil className="w-4 h-4 mr-1" />
                Editar
              </Button>
            )}
            <Button variant="outline" size="sm">
              <FileDown className="w-4 h-4 mr-1" />
              PDF
            </Button>
          </div>
        </div>
      </header>
      
      {/* Document */}
      <main className="py-10 px-4 print:py-0">
        <div className="proposal-page proposal-document max-w-[960px] mx-auto bg-card rounded-lg shadow-sm border border-border print:shadow-none">
          <div className="p-8 space-y-8">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-6 border-b border-border">
              <div>
                <div className="mb-4">
                  <OpenLogo />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Proposta Comercial</h1>
                <p className="text-lg text-primary font-mono">{proposal.display_id || proposal.id.substring(0, 8)}</p>
                <div className="mt-2">
                  <StatusBadge status={proposal.status} />
                </div>
              </div>
              <div className="text-left md:text-right space-y-1 text-sm">
                <p className="text-muted-foreground">
                  Criada em: <span className="text-foreground">{formatDateBR(proposal.created_at)}</span>
                </p>
                <p className="text-muted-foreground">
                  Válida até: <span className="text-foreground">{validityDate.toLocaleDateString('pt-BR')}</span>
                </p>
                <p className="text-muted-foreground">
                  Vigência: <span className="text-foreground">{proposal.contract_duration} {proposal.contract_duration === 1 ? 'mês' : 'meses'}</span>
                </p>
                <p className="text-muted-foreground">
                  Datacenter: <span className="text-foreground">{proposal.datacenter}</span>
                </p>
              </div>
            </div>
            
            {/* Client data */}
            <div className="pb-6 border-b border-border">
              <h2 className="text-base font-semibold text-foreground mb-4 uppercase tracking-wide">
                Dados do Cliente
              </h2>
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome</span>
                  <p className="text-foreground mt-0.5">{proposal.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Empresa</span>
                  <p className="text-foreground mt-0.5">{proposal.company}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">E-mail</span>
                  <p className="text-foreground mt-0.5">{proposal.email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Telefone</span>
                  <p className="text-foreground mt-0.5">{proposal.phone}</p>
                </div>
              </div>
            </div>
            
            {/* Items table */}
            {hasItems ? (
              <div>
                <h2 className="text-base font-semibold text-foreground mb-4 uppercase tracking-wide">
                  Itens & Totais
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left py-3 px-3 text-xs uppercase tracking-wide text-muted-foreground">Item</th>
                        <th className="text-right py-3 px-3 text-xs uppercase tracking-wide text-muted-foreground">Qtd</th>
                        <th className="text-right py-3 px-3 text-xs uppercase tracking-wide text-muted-foreground">Preço Unit.</th>
                        <th className="text-right py-3 px-3 text-xs uppercase tracking-wide text-muted-foreground">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servers.map((server, i) => (
                        <ServerRow key={server.id} server={server} index={i} />
                      ))}
                      {addons.map((addon) => (
                        <AddonRow key={addon.id} addon={addon} />
                      ))}
                    </tbody>
                    <tfoot>
                      {servers.length > 0 && (
                        <tr className="border-t border-border">
                          <td colSpan={3} className="py-2 px-3 text-muted-foreground">Subtotal Servidores</td>
                          <td className="py-2 px-3 text-right font-medium tabular-nums">{formatCurrency(serversTotal)}</td>
                        </tr>
                      )}
                      {addons.length > 0 && (
                        <tr className="border-t border-border/50">
                          <td colSpan={3} className="py-2 px-3 text-muted-foreground">Subtotal Add-ons</td>
                          <td className="py-2 px-3 text-right font-medium tabular-nums">{formatCurrency(addonsTotal)}</td>
                        </tr>
                      )}
                      {proposal.discount_pct > 0 && (
                        <tr className="border-t border-border/50">
                          <td colSpan={3} className="py-2 px-3 text-muted-foreground">Desconto ({proposal.discount_pct}%)</td>
                          <td className="py-2 px-3 text-right text-green-600 tabular-nums">
                            -{formatCurrency((serversTotal + addonsTotal) * (proposal.discount_pct / 100))}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t-2 border-primary bg-primary/5">
                        <td colSpan={3} className="py-4 px-3 text-lg font-bold">TOTAL MENSAL</td>
                        <td className="py-4 px-3 text-right text-lg font-bold tabular-nums">
                          R$ {formatCurrency(proposal.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-muted-foreground/30 rounded-lg p-8 text-center">
                <h2 className="text-base font-semibold text-foreground mb-2 uppercase tracking-wide">
                  Itens & Totais
                </h2>
                <p className="text-muted-foreground">
                  Nenhum item encontrado para esta proposta.
                </p>
                {proposal.total > 0 && (
                  <p className="text-lg font-semibold mt-4">
                    Total: R$ {formatCurrency(proposal.total)}
                  </p>
                )}
              </div>
            )}
            
            {/* Observations */}
            {proposal.observations && (
              <div className="pt-6 border-t border-border">
                <h2 className="text-base font-semibold text-foreground mb-4 uppercase tracking-wide">
                  Observações
                </h2>
                <p className="text-sm text-foreground whitespace-pre-wrap">{proposal.observations}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex justify-center gap-4 mt-8 print:hidden">
          <Button variant="outline" onClick={() => navigate(ROUTES.modulos.comercial.proposals)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Propostas
          </Button>
        </div>
      </main>
    </div>
  );
};

export default PropostaViewSupabase;
