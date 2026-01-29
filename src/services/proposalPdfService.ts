/**
 * Unified Proposal PDF Service
 * 
 * Single source of truth for PDF generation and download.
 * Uses normalizeProposal for consistent data across all views.
 * 
 * PRIORITY ORDER for downloads:
 * 1. Try to download from API if file exists (GET /calculator/proposal/{id}/file/download?token=)
 * 2. Fallback: Generate PDF locally from normalized proposal data
 * 
 * For uploads (after save):
 * - Generate PDF locally and upload to API (POST /calculator/proposal/{id}/file)
 * 
 * Usage:
 * - Internal: downloadProposalPdf(proposalId)
 * - Public:   downloadProposalPdfPublic(proposalId, fileAccessToken)
 * - Upload:   uploadProposalPdf(proposalId, pdfBlob, filename)
 */

import { generateOpenPDF, generateOpenPDFBlob } from '@/lib/pdfGenerator';
import { buildResultFromSnapshot, canBuildResult } from '@/lib/proposalResultBuilder';
import { getProposalPublic, CalculatorProposal } from '@/services/calculatorProposalService';
import { listAttachments, NormalizedAttachment } from '@/services/attachmentsService';
import { openApi } from '@/lib/openApi';
import { extractNumericId } from '@/lib/proposalIdUtils';
import normalizeProposal from '@/lib/normalizeProposal';

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
 * Uses normalizeProposal for consistent data
 */
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
    
    // 2. NORMALIZE PROPOSAL DATA - Single source of truth
    const normalized = normalizeProposal(apiProposal as any);
    
    console.log('[proposalPdfService] Normalized proposal:', {
      displayId: normalized.displayId,
      serversCount: normalized.servers.length,
      addonsCount: normalized.addons.length,
      totalMensal: normalized.totals.totalMensal,
      hasDivergence: normalized.hasDivergence,
    });
    
    // 3. Check if we have enough data
    const hasItems = normalized.servers.length > 0 || normalized.addons.length > 0;
    const hasResult = normalized.result && normalized.result.rows && normalized.result.rows.length > 0;
    
    if (!hasResult && !hasItems && normalized.apiTotal <= 0) {
      console.error('[proposalPdfService] Insufficient data. Cannot generate PDF.', {
        serversCount: normalized.servers.length,
        addonsCount: normalized.addons.length,
        apiTotal: normalized.apiTotal,
        errorCode: 'PDF_ERR_NO_DATA',
      });
      return { 
        success: false, 
        error: `Dados da proposta insuficientes para gerar PDF (PDF_ERR_NO_DATA)` 
      };
    }
    
    // 4. Use normalized result or build minimal fallback
    let result = normalized.result;
    
    if ((!result || !result.rows || result.rows.length === 0) && normalized.apiTotal > 0) {
      console.log('[proposalPdfService] Using fallback: minimal result from API total');
      result = buildMinimalResultFromTotal(apiProposal);
    }
    
    // 5. Fetch attachments (best effort)
    let attachments: NormalizedAttachment[] = [];
    try {
      attachments = await listAttachments(String(apiProposal.id));
    } catch (attachErr) {
      console.warn('[proposalPdfService] Failed to fetch attachments:', attachErr);
    }
    
    // 6. Generate and download PDF using normalized data
    await generateOpenPDF({
      client: normalized.client,
      proposal: {
        id: normalized.displayId,
        createdAt: normalized.createdAt,
        validityDays: normalized.validityDays,
      },
      result,
      selectedTerm: normalized.selectedTerm,
      datacenter: normalized.datacenter,
      observacao: normalized.observacao,
      attachments,
      reseller: normalized.rawDadosProposta?.reseller as any,
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
 * Download proposal PDF from API using file_access_token
 * Used for public access via email link with token
 * 
 * Flow:
 * 1. Use the file_access_token provided in the URL
 * 2. Call GET /calculator/proposal/{id}/file/download?token={file_access_token}
 * 3. API returns the stored PDF file
 * 
 * This is the ONLY method for public PDF access - no fallback to local generation
 * since public users should only access officially saved PDFs.
 */
export async function downloadProposalPdfPublic(
  proposalId: string | number, 
  fileAccessToken: string
): Promise<PdfGenerationResult> {
  // Extract numeric ID
  const numericId = extractNumericId(proposalId);
  
  if (numericId === null) {
    console.error('[proposalPdfService] Public: Cannot extract numeric ID from:', proposalId);
    return { 
      success: false, 
      error: 'Link de acesso inválido' 
    };
  }
  
  if (!fileAccessToken) {
    console.error('[proposalPdfService] Public: Missing file_access_token');
    return { 
      success: false, 
      error: 'Token de acesso não fornecido' 
    };
  }
  
  console.log('[proposalPdfService] Public PDF download via API:', numericId, '(token:', fileAccessToken.substring(0, 8) + '...)');
  
  try {
    // Download file directly from API using the file_access_token
    const blob = await openApi.downloadProposalFile(numericId, fileAccessToken);
    
    if (!blob || blob.size === 0) {
      console.error('[proposalPdfService] Public: Empty blob received from API');
      return { 
        success: false, 
        error: 'Arquivo PDF não encontrado. O PDF pode ainda não ter sido gerado.' 
      };
    }
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `OPEN_proposta_${numericId}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    
    console.log('[proposalPdfService] Public PDF downloaded from API successfully');
    return { success: true };
    
  } catch (error: any) {
    console.error('[proposalPdfService] Public PDF download error:', error);
    
    if (error.response?.status === 404) {
      return { success: false, error: 'Proposta não encontrada ou PDF não disponível' };
    }
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      return { success: false, error: 'Token de acesso inválido ou expirado' };
    }
    
    return { 
      success: false, 
      error: 'Erro ao baixar PDF. Link inválido ou expirado.' 
    };
  }
}

// ============================================================================
// PDF UPLOAD FUNCTIONS
// ============================================================================

/**
 * Generate PDF from proposal data and return as blob for upload
 * Used after saving a proposal to persist the PDF to the API
 */
export async function generateProposalPdfBlob(proposalId: string | number): Promise<{ blob: Blob; filename: string } | null> {
  const numericId = extractNumericId(proposalId);
  
  if (numericId === null) {
    console.error('[proposalPdfService] Cannot generate PDF blob - invalid ID:', proposalId);
    return null;
  }
  
  const idStr = String(numericId);
  
  try {
    // Fetch proposal from backend
    const apiProposal = await openApi.getProposal(idStr) as CalculatorProposal;
    
    if (!apiProposal) {
      console.error('[proposalPdfService] Proposal not found for PDF generation:', idStr);
      return null;
    }
    
    // Extract dados_proposta
    let dadosProposta = apiProposal.dados_proposta as any;
    
    // Build from API fields if needed
    const canUseDadosProposta = canBuildResult(dadosProposta);
    const apiHasServers = Array.isArray(apiProposal.servers) && apiProposal.servers.length > 0;
    const apiHasAddons = Array.isArray(apiProposal.addons) && apiProposal.addons.length > 0;
    
    if (!canUseDadosProposta && (apiHasServers || apiHasAddons || (apiProposal.total && apiProposal.total > 0))) {
      dadosProposta = buildDadosPropostaFromApiFields(apiProposal);
    }
    
    // Build result
    let result = dadosProposta?.result;
    
    if (!result && canBuildResult(dadosProposta)) {
      result = buildResultFromSnapshot(
        dadosProposta,
        apiProposal.total || 0,
        apiProposal.contract_duration || 12
      );
    }
    
    // Fallback to minimal result
    if ((!result || !result.rows || result.rows.length === 0) && apiProposal.total && apiProposal.total > 0) {
      result = buildMinimalResultFromTotal(apiProposal);
    }
    
    if (!result || !result.rows || result.rows.length === 0) {
      console.error('[proposalPdfService] Insufficient data for PDF generation');
      return null;
    }
    
    // Prepare client info
    const client = dadosProposta?.client || {
      name: apiProposal.name,
      company: apiProposal.company,
      email: apiProposal.email,
      phone: apiProposal.phone,
    };
    
    // Prepare proposal meta
    const proposalMeta = dadosProposta?.proposal || {
      id: apiProposal.uuid || String(apiProposal.id),
      createdAt: apiProposal.created_at,
      validityDays: 30,
    };
    
    // Fetch attachments
    let attachments: NormalizedAttachment[] = [];
    try {
      attachments = await listAttachments(String(apiProposal.id));
    } catch (attachErr) {
      console.warn('[proposalPdfService] Failed to fetch attachments:', attachErr);
    }
    
    // Generate PDF as blob
    const { blob, filename } = await generateOpenPDFBlob({
      client,
      proposal: proposalMeta,
      result,
      selectedTerm: String(apiProposal.contract_duration || 12),
      datacenter: apiProposal.datacenter || 'SP1',
      observacao: dadosProposta?.observacao || apiProposal.observations,
      attachments,
      reseller: dadosProposta?.reseller,
    });
    
    console.log('[proposalPdfService] PDF blob generated:', { filename, size: blob.size });
    return { blob, filename };
    
  } catch (error) {
    console.error('[proposalPdfService] Error generating PDF blob:', error);
    return null;
  }
}

/**
 * Upload proposal PDF to API
 * Called after saving a proposal to persist the generated PDF
 */
export async function uploadProposalPdf(proposalId: string | number): Promise<{ success: boolean; error?: string }> {
  const numericId = extractNumericId(proposalId);
  
  if (numericId === null) {
    return { success: false, error: 'ID inválido para upload de PDF' };
  }
  
  try {
    // Generate PDF blob
    const pdfResult = await generateProposalPdfBlob(proposalId);
    
    if (!pdfResult) {
      return { success: false, error: 'Falha ao gerar PDF para upload' };
    }
    
    // Upload to API
    const uploadResult = await openApi.uploadProposalPdfBlob(numericId, pdfResult.blob, pdfResult.filename);
    
    console.log('[proposalPdfService] PDF uploaded successfully:', uploadResult);
    return { success: true };
    
  } catch (error: any) {
    console.error('[proposalPdfService] Error uploading PDF:', error);
    return { 
      success: false, 
      error: error.message || 'Erro ao fazer upload do PDF' 
    };
  }
}

/**
 * Try to download PDF from API, fallback to local generation
 * This is the preferred download method - uses API file if available
 */
export async function downloadProposalPdfFromApi(proposalId: string | number): Promise<PdfGenerationResult> {
  const numericId = extractNumericId(proposalId);
  
  if (numericId === null) {
    return { success: false, error: 'ID inválido para download de PDF' };
  }
  
  try {
    // Check if proposal has file
    const fileInfo = await openApi.getProposalFileInfo(numericId);
    
    if (fileInfo?.has_file && fileInfo.file_token) {
      // Try to download from API
      try {
        const blob = await openApi.downloadProposalFile(numericId, fileInfo.file_token);
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `OPEN_proposta_${numericId}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
        
        console.log('[proposalPdfService] PDF downloaded from API successfully');
        return { success: true };
      } catch (apiDownloadError) {
        console.warn('[proposalPdfService] API download failed, falling back to local generation:', apiDownloadError);
      }
    }
    
    // Fallback: Generate locally
    console.log('[proposalPdfService] No API file available, generating locally...');
    return downloadProposalPdf(proposalId);
    
  } catch (error: any) {
    console.error('[proposalPdfService] Error in downloadProposalPdfFromApi:', error);
    // Fallback to local generation
    return downloadProposalPdf(proposalId);
  }
}
