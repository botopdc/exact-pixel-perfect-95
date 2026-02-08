/**
 * proposal-pdf Edge Function
 * 
 * Generates PDF for a proposal on-demand from saved data.
 * Uses Service Role to bypass RLS and access all proposal data.
 * 
 * POST body: { proposalId: string }
 * Returns: { success: boolean, pdf_path?: string, signedUrl?: string, error?: string }
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Simple PDF generation using pdfmake-compatible structure
// We'll use a minimal approach that creates a valid PDF blob

interface ProposalData {
  id: string;
  display_id: string | null;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  channel_type: string;
  reseller_name: string | null;
  commission_value: number | null;
  commission_reason: string | null;
  observations: string | null;
  fx: number;
  datacenter: string;
  contract_duration: number;
  discount_pct: number;
  total: number;
  due_at: string;
  currency: string;
  created_at: string;
}

interface ServerData {
  server_type: string;
  name: string;
  gpu: string | null;
  gpu_qty: number;
  vcpu: number;
  ram_gb: number;
  nvme_tb: number;
  traffic_tb: number;
  ips: number;
  qty_servers: number;
  bm_cpu: string | null;
  bm_ram: string | null;
  disks: unknown;
  storage_type: string | null;
  storage_region: string | null;
  volume_tb: number | null;
  unit_price: number;
  total_price: number;
  specs: unknown;
}

interface AddonData {
  addon_key: string;
  label: string;
  enabled: boolean;
  quantity: number;
  unit_price: number;
  total_price: number;
  metadata: unknown;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

// Build HTML content for PDF
function buildPdfHtml(
  proposal: ProposalData,
  servers: ServerData[],
  addons: AddonData[]
): string {
  // Build items table rows
  let itemsHtml = '';
  let itemIndex = 1;

  // Process servers
  for (const server of servers) {
    if (!server.total_price && server.total_price !== 0) continue;
    
    let itemLabel = '';
    let qty = server.qty_servers || 1;
    
    if (server.server_type === 'vm') {
      itemLabel = `VM: ${server.vcpu} vCPU, ${server.ram_gb}GB RAM, ${server.nvme_tb}TB NVMe`;
      if (server.gpu && server.gpu !== 'Sem GPU') {
        itemLabel += `, ${server.gpu_qty}x ${server.gpu}`;
      }
    } else if (server.server_type === 'bm') {
      itemLabel = `BareMetal: ${server.bm_cpu || 'CPU'}, ${server.bm_ram || 'RAM'}`;
    } else if (server.server_type === 'storage') {
      itemLabel = `Storage: ${server.volume_tb || 0}TB ${server.storage_type || ''}`;
    } else if (server.server_type === 'kubernetes') {
      itemLabel = server.name || 'Kubernetes Gerenciado';
    } else if (server.server_type === 'opensaas') {
      itemLabel = server.name || 'OPEN SaaS';
    } else {
      itemLabel = server.name || `Item ${itemIndex}`;
    }

    itemsHtml += `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${itemLabel}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${qty}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(server.unit_price)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(server.total_price)}</td>
      </tr>
    `;
    itemIndex++;
  }

  // Process addons
  for (const addon of addons) {
    if (!addon.enabled) continue;
    if (!addon.total_price && addon.total_price !== 0) continue;

    itemsHtml += `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${addon.label}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${addon.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(addon.unit_price)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(addon.total_price)}</td>
      </tr>
    `;
  }

  // Calculate validity date (30 days from created_at or due_at)
  const validityDate = proposal.due_at 
    ? formatDate(proposal.due_at) 
    : formatDate(new Date(new Date(proposal.created_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString());

  const discountPct = proposal.discount_pct || 0;
  const discountLabel = discountPct > 0 ? ` (${discountPct.toFixed(1)}% de desconto aplicado)` : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Proposta ${proposal.display_id || proposal.id.substring(0, 8)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; margin: 40px; }
    h1 { color: #1e3a5f; font-size: 24px; margin-bottom: 4px; }
    h2 { color: #374151; font-size: 14px; margin-top: 0; font-weight: normal; }
    .meta { display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap; }
    .meta-item { font-size: 11px; color: #374151; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #1e3a5f; color: white; padding: 10px 8px; text-align: left; font-size: 11px; }
    th.center { text-align: center; }
    th.right { text-align: right; }
    .total-row { background: #f8fafc; font-weight: bold; }
    .total-row td { padding: 12px 8px; font-size: 14px; color: #1e3a5f; }
    .footer { margin-top: 30px; font-size: 10px; color: #6b7280; font-style: italic; }
    .section { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb; }
    .section-title { font-size: 11px; font-weight: bold; color: #1e3a5f; margin-bottom: 8px; }
  </style>
</head>
<body>
  <h1>OPEN — Proposta Comercial</h1>
  <h2>Resumo de Preços</h2>
  
  <div class="meta">
    <span class="meta-item"><strong>Cliente:</strong> ${proposal.name || '-'}</span>
    <span class="meta-item"><strong>Empresa:</strong> ${proposal.company || '-'}</span>
    <span class="meta-item"><strong>E-mail:</strong> ${proposal.email || '-'}</span>
    <span class="meta-item"><strong>Telefone:</strong> ${proposal.phone || '-'}</span>
  </div>
  
  <div class="meta">
    <span class="meta-item"><strong>Proposta:</strong> ${proposal.display_id || proposal.id.substring(0, 8)}</span>
    <span class="meta-item"><strong>Validade:</strong> ${validityDate}</span>
    <span class="meta-item"><strong>Vigência:</strong> ${proposal.contract_duration} ${proposal.contract_duration === 1 ? 'mês' : 'meses'}</span>
    <span class="meta-item"><strong>Datacenter:</strong> ${proposal.datacenter}</span>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Itens</th>
        <th class="center">Qt</th>
        <th class="right">Valor Unitário</th>
        <th class="right">Valor Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3" style="text-align: right; padding-right: 20px;">TOTAL MENSAL${discountLabel}</td>
        <td style="text-align: right;">${formatCurrency(proposal.total)}</td>
      </tr>
    </tfoot>
  </table>
  
  ${proposal.reseller_name ? `
  <div class="section">
    <div class="section-title">INFORMAÇÕES DO PARCEIRO</div>
    <p><strong>Parceiro:</strong> ${proposal.reseller_name}</p>
    ${proposal.commission_value ? `<p><strong>Comissão:</strong> ${formatCurrency(proposal.commission_value)}</p>` : ''}
    ${proposal.commission_reason ? `<p><strong>Motivo:</strong> ${proposal.commission_reason}</p>` : ''}
  </div>
  ` : ''}
  
  ${proposal.observations ? `
  <div class="section">
    <div class="section-title">OBSERVAÇÕES</div>
    <p>${proposal.observations}</p>
  </div>
  ` : ''}
  
  <div class="footer">
    <p>Proposta gerada automaticamente pelo sistema OPEN Datacenter.</p>
    <p>Data de geração: ${new Date().toLocaleString('pt-BR')}</p>
  </div>
</body>
</html>
  `;

  return html;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[proposal-pdf] Missing or invalid Authorization header");
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { proposalId } = body as { proposalId?: string };

    if (!proposalId) {
      return json({ success: false, error: "proposalId is required" }, 400);
    }

    console.log("[proposal-pdf] Generating PDF for proposal:", proposalId);

    // Create Supabase client with Service Role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Fetch proposal
    const { data: proposal, error: proposalError } = await supabase
      .from("calculator_proposals")
      .select("*")
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      console.error("[proposal-pdf] Proposal not found:", proposalError);
      return json({ success: false, error: "Proposal not found" }, 404);
    }

    // Fetch servers
    const { data: servers, error: serversError } = await supabase
      .from("calculator_proposal_servers")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("sort_order", { ascending: true });

    if (serversError) {
      console.error("[proposal-pdf] Servers error:", serversError);
    }

    // Fetch addons
    const { data: addons, error: addonsError } = await supabase
      .from("calculator_proposal_addons")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("sort_order", { ascending: true });

    if (addonsError) {
      console.error("[proposal-pdf] Addons error:", addonsError);
    }

    console.log("[proposal-pdf] Data fetched:", {
      proposalId,
      serversCount: servers?.length || 0,
      addonsCount: addons?.length || 0,
      total: proposal.total,
    });

    // Generate HTML content
    const htmlContent = buildPdfHtml(
      proposal as ProposalData,
      (servers || []) as ServerData[],
      (addons || []) as AddonData[]
    );

    // Convert HTML to PDF using a simple approach
    // Since Deno doesn't have pdfmake, we'll store the HTML as a "PDF"
    // In production, you'd use a proper PDF library or external service
    
    // For now, we'll use the html2pdf approach via a blob
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    
    // Generate filename
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const displayId = proposal.display_id || proposal.id.substring(0, 8);
    const fileName = `OPEN_${displayId}_${dateStr}.html`;
    const storagePath = `proposals/${proposalId}/${fileName}`;

    console.log("[proposal-pdf] Uploading to storage:", storagePath);

    // Upload to storage (as HTML for now - in production use proper PDF)
    const { error: uploadError } = await supabase.storage
      .from("proposal-files")
      .upload(storagePath, htmlBlob, {
        contentType: 'text/html',
        upsert: true,
      });

    if (uploadError) {
      console.error("[proposal-pdf] Upload error:", uploadError);
      return json({ success: false, error: `Upload failed: ${uploadError.message}` }, 500);
    }

    // Update proposal with pdf_path
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("calculator_proposals")
      .update({
        pdf_path: storagePath,
        pdf_generated_at: now,
        updated_at: now,
      })
      .eq("id", proposalId);

    if (updateError) {
      console.error("[proposal-pdf] Update error:", updateError);
      // Don't fail, PDF was still uploaded
    }

    // Generate signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("proposal-files")
      .createSignedUrl(storagePath, 60 * 60 * 24); // 24 hours

    if (signedUrlError) {
      console.error("[proposal-pdf] SignedUrl error:", signedUrlError);
      return json({ success: false, error: `Signed URL failed: ${signedUrlError.message}` }, 500);
    }

    console.log("[proposal-pdf] Success:", {
      proposalId,
      pdf_path: storagePath,
      hasSignedUrl: !!signedUrlData?.signedUrl,
    });

    return json({
      success: true,
      pdf_path: storagePath,
      signedUrl: signedUrlData.signedUrl,
    });
  } catch (err) {
    console.error("[proposal-pdf] Error:", err);
    return json({ success: false, error: String(err) }, 500);
  }
});
