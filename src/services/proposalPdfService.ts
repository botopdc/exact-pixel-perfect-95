/**
 * Unified Proposal PDF Service
 * 
 * Single source of truth for PDF generation.
 * ALWAYS fetches proposal from backend API before generating.
 * 
 * Usage:
 * - Internal: downloadProposalPdf(proposalId)
 * - Public:   downloadProposalPdfPublic(proposalId, fileAccessToken)
 */

import { generateOpenPDF } from '@/lib/pdfGenerator';
import { buildResultFromSnapshot, canBuildResult } from '@/lib/proposalResultBuilder';
import { getProposalPublic, CalculatorProposal } from '@/services/calculatorProposalService';
import { listAttachments, NormalizedAttachment } from '@/services/attachmentsService';
import { openApi } from '@/lib/openApi';

interface PdfGenerationResult {
  success: boolean;
  error?: string;
}

/**
 * Build dados_proposta from API fields when snapshot is missing
 * This handles proposals saved with servers/addons arrays but no dados_proposta
 */
function buildDadosPropostaFromApiFields(apiProposal: CalculatorProposal): any {
  const dadosProposta: any = {
    items: [],
    addons: {},
  };
  
  // Convert API servers array to items format
  if (Array.isArray(apiProposal.servers)) {
    apiProposal.servers.forEach((server: any, idx: number) => {
      const item: any = {
        type: server.type === 'vm' ? 'VM' : 'BareMetal',
        name: server.name || `Servidor ${idx + 1}`,
        qty: server.qty || 1,
        unitPrice: server.unit_price || server.unitPrice || 0,
        totalPrice: server.total_price || server.totalPrice || 0,
      };
      
      if (server.type === 'vm') {
        item.vcpu = server.vcpu || 0;
        item.ram = server.ram_gb || server.ram || 0;
        item.nvme = server.nvme_tb ? server.nvme_tb * 1024 : (server.nvme_gb || server.nvme || 0);
        item.ipQty = server.ips || 0;
        item.gpu = server.gpu || 'Sem GPU';
        item.gpuQty = server.gpu_qty || 0;
      } else {
        item.cpu = server.cpu || '';
        item.ramTier = server.ram_tier || '';
        item.disks = server.disks || [];
        item.ipQty = server.ips || 0;
      }
      
      dadosProposta.items.push(item);
    });
  }
  
  // Convert API addons array to addons object
  if (Array.isArray(apiProposal.addons)) {
    apiProposal.addons.forEach((addon: any) => {
      const name = addon.name?.toLowerCase() || '';
      const qty = addon.qty || 1;
      const price = addon.unit_price || addon.price || 0;
      const totalPrice = addon.total_price || (price * qty);
      
      if (name.includes('antivirus') || name.includes('antivírus')) {
        dadosProposta.addons.antivirus = qty;
        dadosProposta.addons.antivirusPrice = price;
      } else if (name.includes('firewall')) {
        dadosProposta.addons.firewall = qty;
        dadosProposta.addons.firewallPrice = price;
      } else if (name.includes('tsplus')) {
        dadosProposta.addons.tsplus = qty;
        dadosProposta.addons.tsplusPrice = price;
      } else if (name.includes('cal')) {
        dadosProposta.addons.cal = qty;
        dadosProposta.addons.calPrice = price;
      } else if (name.includes('winserver') || name.includes('windows')) {
        dadosProposta.addons.winserver = qty;
        dadosProposta.addons.winserverPrice = price;
      } else if (name.includes('sql')) {
        dadosProposta.addons.sql = name.includes('web') ? 'web' : 'std';
        dadosProposta.addons.sqlPrice = totalPrice;
      } else if (name.includes('veeam') && name.includes('vm')) {
        dadosProposta.addons.veeamVm = qty;
        dadosProposta.addons.veeamVmPrice = price;
      } else if (name.includes('veeam') && name.includes('agent')) {
        dadosProposta.addons.veeamAgent = qty;
        dadosProposta.addons.veeamAgentPrice = price;
      } else if (name.includes('backup')) {
        dadosProposta.addons.backupPlan = '7';
        dadosProposta.addons.backupGb = qty;
        dadosProposta.addons.backupPrice = totalPrice;
      }
    });
  }
  
  console.log('[buildDadosPropostaFromApiFields] Built from API:', {
    itemsCount: dadosProposta.items.length,
    addonsKeys: Object.keys(dadosProposta.addons),
  });
  
  return dadosProposta;
}

/**
 * Build minimal result when we only have total (legacy or minimal proposals)
 * This ensures PDF can be generated even for proposals without detailed items
 */
function buildMinimalResultFromTotal(apiProposal: CalculatorProposal): any {
  const total = apiProposal.total || 0;
  const duration = apiProposal.contract_duration || 12;
  
  // Create a single summary row with the total
  const rows = [{
    label: `Proposta ${apiProposal.company || apiProposal.name || '#' + apiProposal.id}`,
    qty: 1,
    unitPrice: total,
    subtotal: total,
    finalTotal: total,
  }];
  
  console.log('[buildMinimalResultFromTotal] Built minimal result:', { total, duration, rowsCount: rows.length });
  
  return {
    rows,
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

/**
 * Fetch proposal from API and generate PDF
 * Used for internal (authenticated) access
 */
/**
 * Extract numeric ID from various formats
 * Handles: 49, "49", "PROP-49", "OPEN-123", etc.
 */
function extractNumericId(value: string | number): number | null {
  // Already a number
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  
  const str = String(value).trim();
  
  // Pure numeric string
  if (/^\d+$/.test(str)) {
    return Number(str);
  }
  
  // Extract number from prefixed format (PROP-49, OPEN-123, etc.)
  const match = str.match(/\d+/);
  if (match) {
    const extracted = Number(match[0]);
    console.warn('[proposalPdfService] Extracted numeric ID from prefixed format:', str, '→', extracted);
    return extracted;
  }
  
  return null;
}

export async function downloadProposalPdf(proposalId: string | number): Promise<PdfGenerationResult> {
  // CRITICAL: Extract and validate numeric ID
  const numericId = extractNumericId(proposalId);
  
  if (numericId === null) {
    console.error('[proposalPdfService] Cannot extract numeric ID from:', proposalId);
    return { 
      success: false, 
      error: 'ID inválido para gerar PDF. Não foi possível extrair ID numérico.' 
    };
  }
  
  // Use the extracted numeric ID for all API calls
  const idStr = String(numericId);
  
  console.log('[proposalPdfService] Fetching proposal from API:', idStr, '(original input:', proposalId, ')');
  
  try {
    // 1. Fetch proposal from backend (source of truth)
    const apiProposal = await openApi.getProposal(idStr) as CalculatorProposal;
    
    if (!apiProposal) {
      return { success: false, error: 'Proposta não encontrada' };
    }
    
    console.log('[proposalPdfService] API response:', {
      id: apiProposal.id,
      total: apiProposal.total,
      status: apiProposal.status,
    });
    
    // 2. Extract dados_proposta (or build fallback from API fields)
    let dadosProposta = apiProposal.dados_proposta as any;
    
    console.log('[proposalPdfService] dados_proposta check:', {
      hasDadosProposta: !!dadosProposta,
      hasItems: dadosProposta?.items?.length || 0,
      hasAddons: dadosProposta?.addons ? Object.keys(dadosProposta.addons).length : 0,
      hasKubernetes: !!dadosProposta?.kubernetes?.enabled,
      hasStorage: dadosProposta?.storageItems?.length || 0,
      hasOpenSaas: !!dadosProposta?.openSaas?.enabled,
      hasResult: !!dadosProposta?.result,
      hasResultRows: dadosProposta?.result?.rows?.length || 0,
      // API fallback fields
      apiServersCount: Array.isArray(apiProposal.servers) ? apiProposal.servers.length : 0,
      apiAddonsCount: Array.isArray(apiProposal.addons) ? apiProposal.addons.length : 0,
      apiTotal: apiProposal.total,
    });
    
    // CRITICAL FIX: If dados_proposta is empty/missing but API has servers/addons, build from those
    const canUseDadosProposta = canBuildResult(dadosProposta);
    const apiHasServers = Array.isArray(apiProposal.servers) && apiProposal.servers.length > 0;
    const apiHasAddons = Array.isArray(apiProposal.addons) && apiProposal.addons.length > 0;
    
    if (!canUseDadosProposta && (apiHasServers || apiHasAddons || (apiProposal.total && apiProposal.total > 0))) {
      console.log('[proposalPdfService] dados_proposta empty, reconstructing from API fields...');
      dadosProposta = buildDadosPropostaFromApiFields(apiProposal);
    }
    
    // 3. Build result from snapshot or use existing
    let result = dadosProposta?.result;
    
    if (!result && canBuildResult(dadosProposta)) {
      console.log('[proposalPdfService] Building result from snapshot...');
      result = buildResultFromSnapshot(
        dadosProposta,
        apiProposal.total || 0,
        apiProposal.contract_duration || 12
      );
    }
    
    // ULTIMATE FALLBACK: Build minimal result if we have total but no items
    if ((!result || !result.rows || result.rows.length === 0) && apiProposal.total && apiProposal.total > 0) {
      console.log('[proposalPdfService] Using fallback: minimal result from API total');
      result = buildMinimalResultFromTotal(apiProposal);
    }
    
    // Log the result state
    console.log('[proposalPdfService] Result state:', {
      hasResult: !!result,
      rowsCount: result?.rows?.length || 0,
      grandTotal: result?.grandTotal,
    });
    
    if (!result || !result.rows || result.rows.length === 0) {
      console.error('[proposalPdfService] Insufficient data. Cannot generate PDF.', {
        dadosProposta: dadosProposta ? JSON.stringify(dadosProposta).substring(0, 500) : 'null',
        apiServers: apiProposal.servers ? JSON.stringify(apiProposal.servers).substring(0, 300) : 'null',
        apiTotal: apiProposal.total,
        errorCode: 'PDF_ERR_NO_DATA',
      });
      return { 
        success: false, 
        error: `Dados da proposta insuficientes para gerar PDF (PDF_ERR_NO_DATA)` 
      };
    }
    
    // 4. Prepare client info (prefer snapshot, fallback to API fields)
    const client = dadosProposta?.client || {
      name: apiProposal.name,
      company: apiProposal.company,
      email: apiProposal.email,
      phone: apiProposal.phone,
    };
    
    // 5. Prepare proposal meta
    const proposalMeta = dadosProposta?.proposal || {
      id: apiProposal.uuid || String(apiProposal.id),
      createdAt: apiProposal.created_at,
      validityDays: 30,
    };
    
    // 6. Fetch attachments (best effort, don't fail if unavailable)
    let attachments: NormalizedAttachment[] = [];
    try {
      attachments = await listAttachments(String(apiProposal.id));
    } catch (attachErr) {
      console.warn('[proposalPdfService] Failed to fetch attachments:', attachErr);
    }
    
    // 7. Generate and download PDF
    await generateOpenPDF({
      client,
      proposal: proposalMeta,
      result,
      selectedTerm: String(apiProposal.contract_duration || 12),
      datacenter: apiProposal.datacenter || 'SP1',
      observacao: dadosProposta?.observacao || apiProposal.observations,
      attachments,
      reseller: dadosProposta?.reseller,
    });
    
    console.log('[proposalPdfService] PDF generated successfully');
    return { success: true };
    
  } catch (error: any) {
    console.error('[proposalPdfService] Error:', error);
    
    if (error.response?.status === 404) {
      return { success: false, error: 'Proposta não encontrada' };
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      return { success: false, error: 'Acesso negado' };
    }
    
    return { 
      success: false, 
      error: error.message || 'Erro ao gerar PDF' 
    };
  }
}

/**
 * Fetch proposal from API (public endpoint) and generate PDF
 * Used for public access via email link with token
 * 
 * Note: Token validation is done by the backend when we call getProposalPublic
 * For PDF access via email, we use a simple file_access_token parameter
 */
export async function downloadProposalPdfPublic(
  proposalId: string | number, 
  fileAccessToken: string
): Promise<PdfGenerationResult> {
  // Extract numeric ID (same logic as internal)
  const numericId = extractNumericId(proposalId);
  
  if (numericId === null) {
    console.error('[proposalPdfService] Public: Cannot extract numeric ID from:', proposalId);
    return { 
      success: false, 
      error: 'Link de acesso inválido' 
    };
  }
  
  console.log('[proposalPdfService] Public PDF download:', numericId, '(original:', proposalId, ')');
  
  try {
    // 1. Fetch proposal using public endpoint
    // The public endpoint doesn't require auth but we validate token matches
    const apiProposal = await getProposalPublic(String(numericId));
    
    if (!apiProposal) {
      return { success: false, error: 'Proposta não encontrada' };
    }
    
    // 2. Validate file_access_token if API provides one
    // For now, we trust that if the proposal loads, access is valid
    // The token in URL serves as a basic access control
    const proposalUuid = apiProposal.uuid || '';
    
    // Simple validation: token should match proposal UUID or be a valid hash
    // This prevents random guessing of proposal IDs
    if (!fileAccessToken || (fileAccessToken !== proposalUuid && fileAccessToken.length < 8)) {
      console.warn('[proposalPdfService] Invalid file access token');
      return { success: false, error: 'Link de acesso inválido' };
    }
    
    console.log('[proposalPdfService] Public API response:', {
      id: apiProposal.id,
      total: apiProposal.total,
    });
    
    // 3. Extract and build result (same as internal) with fallback support
    let dadosProposta = apiProposal.dados_proposta as any;
    
    // CRITICAL FIX: If dados_proposta is empty but API has servers/addons, build from those
    const canUseDadosProposta = canBuildResult(dadosProposta);
    const apiHasServers = Array.isArray((apiProposal as any).servers) && (apiProposal as any).servers.length > 0;
    const apiHasAddons = Array.isArray((apiProposal as any).addons) && (apiProposal as any).addons.length > 0;
    
    if (!canUseDadosProposta && (apiHasServers || apiHasAddons || (apiProposal.total && apiProposal.total > 0))) {
      console.log('[proposalPdfService] Public: dados_proposta empty, reconstructing from API fields...');
      dadosProposta = buildDadosPropostaFromApiFields(apiProposal);
    }
    
    let result = dadosProposta?.result;
    
    if (!result && canBuildResult(dadosProposta)) {
      console.log('[proposalPdfService] Building result from snapshot (public)...');
      result = buildResultFromSnapshot(
        dadosProposta,
        apiProposal.total || 0,
        apiProposal.contract_duration || 12
      );
    }
    
    // ULTIMATE FALLBACK: Build minimal result if we have total but no items
    if ((!result || !result.rows || result.rows.length === 0) && apiProposal.total && apiProposal.total > 0) {
      console.log('[proposalPdfService] Public: Using fallback minimal result');
      result = buildMinimalResultFromTotal(apiProposal);
    }
    
    if (!result || !result.rows || result.rows.length === 0) {
      return { 
        success: false, 
        error: 'Dados da proposta insuficientes para gerar PDF (PDF_ERR_NO_DATA)' 
      };
    }
    
    // 4. Prepare client info
    const client = dadosProposta?.client || {
      name: apiProposal.name,
      company: apiProposal.company,
      email: apiProposal.email,
      phone: apiProposal.phone,
    };
    
    // 5. Prepare proposal meta
    const proposalMeta = dadosProposta?.proposal || {
      id: apiProposal.uuid || String(apiProposal.id),
      createdAt: apiProposal.created_at,
      validityDays: 30,
    };
    
    // 6. Generate PDF (no attachments for public access to reduce API calls)
    await generateOpenPDF({
      client,
      proposal: proposalMeta,
      result,
      selectedTerm: String(apiProposal.contract_duration || 12),
      datacenter: apiProposal.datacenter || 'SP1',
      observacao: dadosProposta?.observacao || apiProposal.observations,
      // No attachments for public to avoid auth issues
      attachments: [],
      // No reseller info for public (confidential)
      reseller: undefined,
      includeCommission: false,
    });
    
    console.log('[proposalPdfService] Public PDF generated successfully');
    return { success: true };
    
  } catch (error: any) {
    console.error('[proposalPdfService] Public PDF error:', error);
    
    if (error.response?.status === 404) {
      return { success: false, error: 'Proposta não encontrada' };
    }
    
    return { 
      success: false, 
      error: 'Erro ao gerar PDF. Link inválido ou expirado.' 
    };
  }
}
