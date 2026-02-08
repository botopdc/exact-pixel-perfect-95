/**
 * Supabase Proposal PDF Service
 * 
 * Handles PDF generation and upload for Supabase-based proposals.
 * Uses the existing pdfGenerator to create real PDFs locally,
 * then uploads them to Supabase Storage.
 */

import { supabase } from '@/integrations/supabase/client';
import { generateOpenPDF, generateOpenPDFBlob } from '@/lib/pdfGenerator';
import { buildResultFromSnapshot, canBuildResult } from '@/lib/proposalResultBuilder';
import { getProposalWithItems, updatePdfPath } from '@/services/supabaseProposalService';
import type { CalculatorProposalWithRelations } from '@/types/calculatorProposal';

interface PdfGenerationResult {
  success: boolean;
  pdfPath?: string;
  signedUrl?: string;
  error?: string;
}

/**
 * Build dados_proposta structure from Supabase proposal with items
 */
function buildDadosPropostaFromSupabase(proposal: CalculatorProposalWithRelations): any {
  const dadosProposta: any = {
    items: [],
    addons: {},
  };

  // Convert servers to items
  if (Array.isArray(proposal.servers)) {
    proposal.servers.forEach((server, idx) => {
      const item: any = {
        type: server.server_type === 'vm' ? 'VM' : 
              server.server_type === 'bm' ? 'BareMetal' :
              server.server_type === 'storage' ? 'Storage' :
              server.server_type === 'kubernetes' ? 'Kubernetes' :
              server.server_type === 'opensaas' ? 'OpenSaaS' : 'VM',
        name: server.name || `Servidor ${idx + 1}`,
        qty: server.qty_servers || 1,
        unitPrice: server.unit_price || 0,
        totalPrice: server.total_price || 0,
      };

      if (server.server_type === 'vm') {
        item.vcpu = server.vcpu || 0;
        item.ram = server.ram_gb || 0;
        item.nvme = server.nvme_tb ? server.nvme_tb * 1024 : 0;
        item.ipQty = server.ips || 0;
        item.gpu = server.gpu || 'Sem GPU';
        item.gpuQty = server.gpu_qty || 0;
      } else if (server.server_type === 'bm') {
        item.cpu = server.bm_cpu || '';
        item.ramTier = server.bm_ram || '';
        item.disks = server.disks || [];
        item.ipQty = server.ips || 0;
      } else if (server.server_type === 'storage') {
        item.volumeTb = server.volume_tb || 0;
        item.storageType = server.storage_type || '';
        item.region = server.storage_region || '';
      }

      dadosProposta.items.push(item);
    });
  }

  // Convert addons
  if (Array.isArray(proposal.addons)) {
    proposal.addons.forEach((addon) => {
      const key = addon.addon_key || '';
      const qty = addon.quantity || 0;
      const price = addon.unit_price || 0;
      const totalPrice = addon.total_price || (price * qty);

      switch (key) {
        case 'antivirus':
          dadosProposta.addons.antivirus = qty;
          dadosProposta.addons.antivirusPrice = price;
          break;
        case 'firewall':
          dadosProposta.addons.firewall = qty;
          dadosProposta.addons.firewallPrice = price;
          break;
        case 'tsplus':
          dadosProposta.addons.tsplus = qty;
          dadosProposta.addons.tsplusPrice = price;
          break;
        case 'cal':
          dadosProposta.addons.cal = qty;
          dadosProposta.addons.calPrice = price;
          break;
        case 'winserver':
          dadosProposta.addons.winserver = qty;
          dadosProposta.addons.winserverPrice = price;
          break;
        case 'sql':
          dadosProposta.addons.sql = (addon.metadata as any)?.type || 'std';
          dadosProposta.addons.sqlPrice = totalPrice;
          break;
        case 'veeam_vm':
          dadosProposta.addons.veeamVm = qty;
          dadosProposta.addons.veeamVmPrice = price;
          break;
        case 'veeam_ag':
        case 'veeam_agent':
          dadosProposta.addons.veeamAgent = qty;
          dadosProposta.addons.veeamAgentPrice = price;
          break;
        case 'backup':
          dadosProposta.addons.backupPlan = '7';
          dadosProposta.addons.backupGb = qty;
          dadosProposta.addons.backupPrice = totalPrice;
          break;
      }
    });
  }

  console.log('[buildDadosPropostaFromSupabase] Built:', {
    itemsCount: dadosProposta.items.length,
    addonsKeys: Object.keys(dadosProposta.addons),
  });

  return dadosProposta;
}

/**
 * Build result rows from proposal servers and addons
 */
function buildResultFromProposal(proposal: CalculatorProposalWithRelations): any {
  const rows: any[] = [];

  // Add server rows
  if (Array.isArray(proposal.servers)) {
    proposal.servers.forEach((server, idx) => {
      let label = server.name || `Item ${idx + 1}`;
      
      // Build descriptive label based on server type
      if (server.server_type === 'vm') {
        label = `VM: ${server.vcpu} vCPU, ${server.ram_gb}GB RAM, ${server.nvme_tb}TB NVMe`;
        if (server.gpu && server.gpu !== 'Sem GPU') {
          label += `, ${server.gpu_qty || 1}x ${server.gpu}`;
        }
      } else if (server.server_type === 'bm') {
        label = `BareMetal: ${server.bm_cpu || 'CPU'}, ${server.bm_ram || 'RAM'}`;
      } else if (server.server_type === 'storage') {
        label = `Storage: ${server.volume_tb || 0}TB ${server.storage_type || ''}`;
      } else if (server.server_type === 'kubernetes') {
        label = server.name || 'Kubernetes Gerenciado';
      } else if (server.server_type === 'opensaas') {
        label = server.name || 'OPEN SaaS';
      }

      rows.push({
        label,
        qty: server.qty_servers || 1,
        unitPrice: server.unit_price || 0,
        subtotal: server.total_price || 0,
        finalTotal: server.total_price || 0,
      });
    });
  }

  // Add addon rows
  if (Array.isArray(proposal.addons)) {
    proposal.addons.forEach((addon) => {
      if (!addon.enabled || !addon.total_price) return;

      rows.push({
        label: addon.label || addon.addon_key,
        qty: addon.quantity || 1,
        unitPrice: addon.unit_price || 0,
        subtotal: addon.total_price || 0,
        finalTotal: addon.total_price || 0,
      });
    });
  }

  // Calculate totals
  const grandTotal = proposal.total || rows.reduce((sum, r) => sum + (r.finalTotal || 0), 0);

  return {
    rows,
    subRec: grandTotal,
    subIps: 0,
    subServices: 0,
    subBackup: 0,
    subKubernetes: 0,
    subStorage: 0,
    subOpenSaas: 0,
    discountPct: proposal.discount_pct || 0,
    discountValue: 0,
    grandTotal,
    totalServers: rows.length,
    gpuUsdTotal: 0,
    gpuBrlTotal: 0,
    subtotalPriceList: grandTotal,
    overValue: proposal.commission_value || 0,
    overPercent: 0,
    totalWithOver: grandTotal + (proposal.commission_value || 0),
  };
}

/**
 * Generate PDF for a Supabase proposal and upload to Storage
 * Returns the storage path and signed URL
 */
export async function generateAndUploadPdf(proposalId: string): Promise<PdfGenerationResult> {
  console.log('[supabaseProposalPdfService] Generating PDF for:', proposalId);

  try {
    // 1. Fetch full proposal with servers and addons
    const proposal = await getProposalWithItems(proposalId);

    if (!proposal) {
      return { success: false, error: 'Proposta não encontrada' };
    }

    console.log('[supabaseProposalPdfService] Proposal loaded:', {
      id: proposal.id,
      company: proposal.company,
      serversCount: proposal.servers?.length || 0,
      addonsCount: proposal.addons?.length || 0,
      total: proposal.total,
    });

    // 2. Build result from proposal data
    let result = buildResultFromProposal(proposal);

    // Fallback if no rows but has total
    if ((!result.rows || result.rows.length === 0) && proposal.total > 0) {
      console.log('[supabaseProposalPdfService] Using minimal result fallback');
      result = {
        rows: [{
          label: `Proposta ${proposal.company || proposal.name || '#' + proposalId.substring(0, 8)}`,
          qty: 1,
          unitPrice: proposal.total,
          subtotal: proposal.total,
          finalTotal: proposal.total,
        }],
        subRec: proposal.total,
        subIps: 0,
        subServices: 0,
        subBackup: 0,
        subKubernetes: 0,
        subStorage: 0,
        subOpenSaas: 0,
        discountPct: proposal.discount_pct || 0,
        discountValue: 0,
        grandTotal: proposal.total,
        totalServers: 0,
        gpuUsdTotal: 0,
        gpuBrlTotal: 0,
        subtotalPriceList: proposal.total,
        overValue: 0,
        overPercent: 0,
        totalWithOver: proposal.total,
      };
    }

    if (!result.rows || result.rows.length === 0) {
      return { success: false, error: 'Dados insuficientes para gerar PDF' };
    }

    // 3. Prepare client info
    const client = {
      name: proposal.name || '',
      company: proposal.company || '',
      email: proposal.email || '',
      phone: proposal.phone || '',
    };

    // 4. Prepare proposal meta
    const proposalMeta = {
      id: proposal.display_id || proposalId.substring(0, 8),
      createdAt: proposal.created_at,
      validityDays: 30,
    };

    // 5. Generate PDF blob using existing pdfMake generator
    console.log('[supabaseProposalPdfService] Generating PDF blob...');
    const { blob, filename } = await generateOpenPDFBlob({
      client,
      proposal: proposalMeta,
      result,
      selectedTerm: String(proposal.contract_duration || 12),
      datacenter: proposal.datacenter || 'SP1',
      observacao: proposal.observations || undefined,
      attachments: [],
      reseller: proposal.reseller_name ? {
        enabled: true,
        resellerName: proposal.reseller_name,
        viewMode: 'INTERNO',
        overValue: proposal.commission_value || 0,
        overReason: proposal.commission_reason || '',
        observations: proposal.observations || '',
        approvalRequired: false,
        approvalStatus: 'Pendente',
        approver: '',
        approvedAt: null,
      } : undefined,
      includeCommission: !!proposal.commission_value,
    });

    console.log('[supabaseProposalPdfService] PDF blob generated:', {
      filename,
      size: blob.size,
      type: blob.type,
    });

    // 6. Upload to Supabase Storage
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const displayId = proposal.display_id || proposalId.substring(0, 8);
    const storagePath = `proposals/${proposalId}/OPEN_${displayId}_${dateStr}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('proposal-files')
      .upload(storagePath, blob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[supabaseProposalPdfService] Upload error:', uploadError);
      return { success: false, error: `Erro ao fazer upload: ${uploadError.message}` };
    }

    // 7. Update proposal with pdf_path
    await updatePdfPath(proposalId, storagePath);

    // 8. Generate signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('proposal-files')
      .createSignedUrl(storagePath, 60 * 60 * 24); // 24 hours

    if (signedUrlError) {
      console.error('[supabaseProposalPdfService] SignedUrl error:', signedUrlError);
      return { success: false, error: `Erro ao gerar link: ${signedUrlError.message}` };
    }

    console.log('[supabaseProposalPdfService] PDF generated and uploaded successfully:', {
      path: storagePath,
      hasSignedUrl: !!signedUrlData?.signedUrl,
    });

    return {
      success: true,
      pdfPath: storagePath,
      signedUrl: signedUrlData.signedUrl,
    };
  } catch (error: any) {
    console.error('[supabaseProposalPdfService] Error:', error);
    return { success: false, error: error.message || 'Erro ao gerar PDF' };
  }
}

/**
 * Download PDF for a Supabase proposal
 * If pdf_path exists, downloads from storage
 * If not, generates PDF first, then downloads
 */
export async function downloadProposalPdf(proposalId: string): Promise<PdfGenerationResult> {
  console.log('[supabaseProposalPdfService] downloadProposalPdf:', proposalId);

  try {
    // 1. Check if proposal has pdf_path
    const { data: proposal, error: proposalError } = await supabase
      .from('calculator_proposals')
      .select('id, pdf_path, display_id')
      .eq('id', proposalId)
      .maybeSingle();

    if (proposalError || !proposal) {
      console.error('[supabaseProposalPdfService] Proposal not found:', proposalError);
      return { success: false, error: 'Proposta não encontrada' };
    }

    let signedUrl: string | null = null;
    let pdfPath = proposal.pdf_path;

    // 2. If pdf_path exists, try to get signed URL
    if (pdfPath) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('proposal-files')
        .createSignedUrl(pdfPath, 60 * 60); // 1 hour

      if (!signedUrlError && signedUrlData?.signedUrl) {
        // Verify the file exists by checking content-type
        try {
          const response = await fetch(signedUrlData.signedUrl, { method: 'HEAD' });
          const contentType = response.headers.get('content-type');
          
          if (response.ok && contentType?.includes('pdf')) {
            signedUrl = signedUrlData.signedUrl;
          } else {
            console.warn('[supabaseProposalPdfService] Existing file is not PDF:', contentType);
            pdfPath = null; // Force regeneration
          }
        } catch {
          pdfPath = null; // Force regeneration
        }
      } else {
        pdfPath = null; // Force regeneration
      }
    }

    // 3. If no valid PDF exists, generate it
    if (!signedUrl) {
      console.log('[supabaseProposalPdfService] Generating new PDF...');
      
      const genResult = await generateAndUploadPdf(proposalId);
      
      if (!genResult.success) {
        return genResult;
      }
      
      signedUrl = genResult.signedUrl || null;
      pdfPath = genResult.pdfPath;
    }

    if (!signedUrl) {
      return { success: false, error: 'Não foi possível obter URL do PDF' };
    }

    // 4. Trigger download
    const displayId = proposal.display_id || proposalId.substring(0, 8);
    const filename = `OPEN_proposta_${displayId}.pdf`;
    
    const a = document.createElement('a');
    a.href = signedUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    return { success: true, pdfPath, signedUrl };
  } catch (error: any) {
    console.error('[supabaseProposalPdfService] Error:', error);
    return { success: false, error: error.message || 'Erro ao baixar PDF' };
  }
}
