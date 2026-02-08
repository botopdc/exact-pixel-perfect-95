/**
 * Unified Proposal PDF Generator
 * 
 * Single source of truth for PDF generation.
 * Used by BOTH the Calculator (after save) and the Proposals List (download).
 * 
 * This ensures that PDFs generated from either location are IDENTICAL.
 */

import { generateOpenPDF, generateOpenPDFBlob } from '@/lib/pdfGenerator';
import { buildResultFromSnapshot, canBuildResult } from '@/lib/proposalResultBuilder';
import type { ProposalFull } from '@/services/supabase/fetchFullProposal';
import type { CalculationResult, SummaryRow, ClientInfo, ProposalMeta, ResellerState } from '@/lib/calculatorConfig';
import type { NormalizedAttachment } from '@/services/attachmentsService';

// ============================================================================
// TYPES
// ============================================================================

export interface GeneratePdfInput {
  proposal: ProposalFull;
  attachments?: NormalizedAttachment[];
}

export interface GeneratePdfResult {
  success: boolean;
  error?: string;
  blob?: Blob;
  filename?: string;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate and download PDF from a full proposal
 * 
 * @param input - ProposalFull from fetchFullProposal
 * @returns Promise that resolves when download starts
 */
export async function generateProposalPdf(input: GeneratePdfInput): Promise<GeneratePdfResult> {
  const { proposal, attachments = [] } = input;

  console.log('[generateProposalPdf] Starting for proposal:', {
    id: proposal.id,
    company: proposal.company,
    total: proposal.total,
    serversCount: proposal.servers.length,
    addonsCount: proposal.addons.length,
  });

  try {
    // 1. Build dados_proposta structure from Supabase data
    const dadosProposta = buildDadosPropostaFromFull(proposal);

    // 2. Build CalculationResult from snapshot
    let result = buildResultFromSnapshot(
      dadosProposta,
      proposal.total ?? 0,
      proposal.contract_duration ?? 12
    );

    // 3. Fallback: create minimal result if we only have total
    if (!result || !result.rows || result.rows.length === 0) {
      if (proposal.total && proposal.total > 0) {
        console.log('[generateProposalPdf] Using fallback: minimal result from total');
        result = buildMinimalResult(proposal);
      } else {
        console.error('[generateProposalPdf] No data available for PDF generation');
        return {
          success: false,
          error: 'Proposta incompleta para PDF — sem itens ou valor total',
        };
      }
    }

    // 4. Prepare client info
    const client: ClientInfo = {
      name: proposal.name,
      company: proposal.company,
      email: proposal.email,
      phone: proposal.phone,
    };

    // 5. Prepare proposal meta
    const proposalMeta: ProposalMeta = {
      id: proposal.display_id || proposal.id.substring(0, 8),
      createdAt: proposal.created_at,
      validityDays: 30,
    };

    // 6. Prepare reseller info if present
    const reseller: ResellerState | undefined = proposal.channel_type === 'PARCEIRO' && proposal.reseller_name
      ? {
          enabled: true,
          viewMode: 'INTERNO',
          resellerName: proposal.reseller_name,
          overValue: proposal.commission_value ?? 0,
          overReason: proposal.commission_reason || '',
          observations: proposal.observations || '',
          approvalRequired: (proposal.commission_value ?? 0) > 20,
          approvalStatus: 'Pendente',
          approver: '',
          approvedAt: null,
        }
      : undefined;

    // 7. Generate and trigger download
    await generateOpenPDF({
      client,
      proposal: proposalMeta,
      result,
      selectedTerm: String(proposal.contract_duration || 12),
      datacenter: proposal.datacenter || 'SP1',
      observacao: proposal.observations || '',
      attachments,
      reseller,
      includeCommission: !!reseller,
    });

    console.log('[generateProposalPdf] PDF download triggered successfully');
    return { success: true };

  } catch (error: any) {
    console.error('[generateProposalPdf] Error:', error);
    return {
      success: false,
      error: error.message || 'Erro ao gerar PDF',
    };
  }
}

/**
 * Generate PDF as Blob (for upload or storage)
 */
export async function generateProposalPdfBlob(input: GeneratePdfInput): Promise<GeneratePdfResult> {
  const { proposal, attachments = [] } = input;

  console.log('[generateProposalPdfBlob] Starting for proposal:', proposal.id);

  try {
    const dadosProposta = buildDadosPropostaFromFull(proposal);
    let result = buildResultFromSnapshot(
      dadosProposta,
      proposal.total ?? 0,
      proposal.contract_duration ?? 12
    );

    if (!result || !result.rows || result.rows.length === 0) {
      if (proposal.total && proposal.total > 0) {
        result = buildMinimalResult(proposal);
      } else {
        return {
          success: false,
          error: 'Proposta incompleta para PDF',
        };
      }
    }

    const client: ClientInfo = {
      name: proposal.name,
      company: proposal.company,
      email: proposal.email,
      phone: proposal.phone,
    };

    const proposalMeta: ProposalMeta = {
      id: proposal.display_id || proposal.id.substring(0, 8),
      createdAt: proposal.created_at,
      validityDays: 30,
    };

    const { blob, filename } = await generateOpenPDFBlob({
      client,
      proposal: proposalMeta,
      result,
      selectedTerm: String(proposal.contract_duration || 12),
      datacenter: proposal.datacenter || 'SP1',
      observacao: proposal.observations || '',
      attachments,
    });

    return { success: true, blob, filename };

  } catch (error: any) {
    console.error('[generateProposalPdfBlob] Error:', error);
    return {
      success: false,
      error: error.message || 'Erro ao gerar PDF',
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build dados_proposta structure from ProposalFull (Supabase data)
 * This is the bridge between Supabase schema and the PDF generator's expected format
 */
function buildDadosPropostaFromFull(proposal: ProposalFull): any {
  const dadosProposta: any = {
    items: [],
    addons: {},
    kubernetes: { enabled: false },
    storageItems: [],
    openSaas: { enabled: false },
  };

  // Process servers → items
  proposal.servers.forEach((server, idx) => {
    // Skip storage items (they go to storageItems array)
    if (server.server_type === 'storage') {
      dadosProposta.storageItems.push({
        type: server.storage_type || 'sas',
        region: server.storage_region || 'BR',
        size: server.volume_tb || 1,
        totalPrice: server.total_price || 0,
      });
      return;
    }

    const item: any = {
      type: server.server_type === 'vm' ? 'VM' : 'BareMetal',
      name: server.name || `Servidor ${idx + 1}`,
      qty: server.qty_servers || 1,
      unitPrice: server.unit_price || 0,
      totalPrice: server.total_price || 0,
    };

    if (server.server_type === 'vm') {
      item.vcpu = server.vcpu || 0;
      item.ram = server.ram_gb || 0;
      item.nvme = server.nvme_tb ? server.nvme_tb * 1024 : 0; // Convert TB to GB for display
      item.ipQty = server.ips || 0;
      item.gpu = server.gpu || 'Sem GPU';
      item.gpuQty = server.gpu_qty || 0;
    } else if (server.server_type === 'bm') {
      item.cpu = server.bm_cpu || '';
      item.ramTier = server.bm_ram || '';
      item.disks = server.disks || [];
      item.ipQty = server.ips || 0;
    }

    dadosProposta.items.push(item);
  });

  // Process addons
  proposal.addons.forEach((addon) => {
    if (!addon.enabled) return;

    const key = addon.addon_key || '';
    const qty = addon.quantity || 0;
    const unitPrice = addon.unit_price || 0;
    const totalPrice = addon.total_price || 0;
    const metadata = addon.metadata as any;

    switch (key) {
      case 'antivirus':
        dadosProposta.addons.antivirus = qty;
        dadosProposta.addons.antivirusPrice = unitPrice;
        break;
      case 'firewall':
        dadosProposta.addons.firewall = qty;
        dadosProposta.addons.firewallPrice = unitPrice;
        break;
      case 'tsplus':
        dadosProposta.addons.tsplus = qty;
        dadosProposta.addons.tsplusPrice = unitPrice;
        break;
      case 'cal':
        dadosProposta.addons.cal = qty;
        dadosProposta.addons.calPrice = unitPrice;
        break;
      case 'winserver':
        dadosProposta.addons.winserver = qty;
        dadosProposta.addons.winserverPrice = unitPrice;
        break;
      case 'sql':
        dadosProposta.addons.sql = metadata?.type || 'std';
        dadosProposta.addons.sqlPrice = totalPrice;
        break;
      case 'veeam_vm':
        dadosProposta.addons.veeamVm = qty;
        dadosProposta.addons.veeamVmPrice = unitPrice;
        break;
      case 'veeam_ag':
      case 'veeam_agent':
        dadosProposta.addons.veeamAgent = qty;
        dadosProposta.addons.veeamAgentPrice = unitPrice;
        break;
      case 'backup':
        dadosProposta.addons.backupPlan = metadata?.plan || '7';
        dadosProposta.addons.backupRetention = metadata?.retention || metadata?.plan || '7';
        dadosProposta.addons.backupGb = qty;
        dadosProposta.addons.backupPrice = totalPrice;
        break;
      case 'support':
        dadosProposta.addons.supportLevel = metadata?.level || 'basic';
        dadosProposta.addons.supportPrice = totalPrice;
        break;
      case 'consulting':
        dadosProposta.addons.consultingHours = qty;
        dadosProposta.addons.consultingPrice = totalPrice;
        break;
      case 'dba':
        dadosProposta.addons.dbaHours = qty;
        dadosProposta.addons.dbaPrice = totalPrice;
        break;
      case 'kubernetes':
        dadosProposta.kubernetes = {
          enabled: true,
          plan: metadata?.plan,
          workerNodes: qty,
          totalPrice,
        };
        break;
      case 'open_saas':
        dadosProposta.openSaas = {
          enabled: true,
          users: qty,
          pricePerUser: unitPrice || 85,
        };
        break;
    }
  });

  console.log('[buildDadosPropostaFromFull] Built:', {
    itemsCount: dadosProposta.items.length,
    addonsKeys: Object.keys(dadosProposta.addons),
    hasKubernetes: dadosProposta.kubernetes?.enabled,
    storageCount: dadosProposta.storageItems.length,
    hasOpenSaas: dadosProposta.openSaas?.enabled,
  });

  return dadosProposta;
}

/**
 * Build minimal result when only total is available
 */
function buildMinimalResult(proposal: ProposalFull): CalculationResult {
  const total = proposal.total ?? 0;

  return {
    rows: [{
      label: `Proposta ${proposal.company || proposal.name || '#' + proposal.id.substring(0, 8)}`,
      qty: 1,
      unitPrice: total,
      subtotal: total,
      finalTotal: total,
    }],
    subRec: total,
    subIps: 0,
    subServices: 0,
    subBackup: 0,
    subKubernetes: 0,
    subStorage: 0,
    subOpenSaas: 0,
    discountPct: 0,
    discountValue: 0,
    grandTotal: total,
    totalServers: 0,
    gpuUsdTotal: 0,
    gpuBrlTotal: 0,
    subtotalPriceList: total,
    overValue: 0,
    overPercent: 0,
    totalWithOver: total,
  };
}
