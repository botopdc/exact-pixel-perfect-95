import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Template PDF path in storage ────────────────────────────
const TEMPLATE_PDF_PATH = "templates/proposta_modelo_OPEN.pdf";

// ─── Generate summary-only PDF pages using pdf-lib ──────────
// Returns a PDF document containing ONLY the summary/data pages
// (no cover pages — those come from the visual template)
async function generateSummaryPdfBytes(
  proposal: any,
  servers: any[],
  addons: any[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 10;
  const lineHeight = 14;
  const margin = 50;
  const A4W = 595.28;
  const A4H = 841.89;

  let page = doc.addPage([A4W, A4H]);
  let y = A4H - margin;

  function drawText(text: string, x: number, yPos: number, options?: { font?: any; size?: number; color?: any }) {
    const f = options?.font || font;
    const s = options?.size || fontSize;
    page.drawText(text, { x, y: yPos, font: f, size: s, color: options?.color || rgb(0, 0, 0) });
  }

  function checkNewPage() {
    if (y < margin + 40) {
      page = doc.addPage([A4W, A4H]);
      y = A4H - margin;
    }
  }

  // Header
  drawText("PROPOSTA COMERCIAL — RESUMO DE PREÇOS", margin, y, { font: fontBold, size: 14, color: rgb(0.1, 0.1, 0.5) });
  y -= 24;
  drawText(`Proposta: ${proposal.display_id || proposal.id?.substring(0, 8) || "—"}`, margin, y, { font: fontBold, size: 11 });
  y -= 16;
  drawText(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`, margin, y, { size: 8, color: rgb(0.4, 0.4, 0.4) });
  y -= 24;

  // Client info
  drawText("DADOS DO CLIENTE", margin, y, { font: fontBold, size: 11 });
  y -= lineHeight + 2;
  const clientFields = [
    ["Empresa", proposal.company || "—"],
    ["Contato", proposal.name || "—"],
    ["Email", proposal.email || "—"],
    ["Telefone", proposal.phone || "—"],
    ["Datacenter", proposal.datacenter || "SP1"],
    ["Moeda", proposal.currency || "BRL"],
    ["Duração", `${proposal.contract_duration || 12} meses`],
    ["Desconto", `${proposal.discount_pct || 0}%`],
  ];
  for (const [label, value] of clientFields) {
    drawText(`${label}:`, margin, y, { font: fontBold });
    drawText(String(value), margin + 100, y);
    y -= lineHeight;
  }
  y -= 10;

  // Servers table
  if (servers.length > 0) {
    checkNewPage();
    drawText("SERVIDORES / RECURSOS", margin, y, { font: fontBold, size: 11 });
    y -= lineHeight + 4;

    const colX = [margin, margin + 140, margin + 220, margin + 270, margin + 320, margin + 400];
    drawText("Nome", colX[0], y, { font: fontBold, size: 9 });
    drawText("Tipo", colX[1], y, { font: fontBold, size: 9 });
    drawText("vCPU", colX[2], y, { font: fontBold, size: 9 });
    drawText("RAM", colX[3], y, { font: fontBold, size: 9 });
    drawText("Qtd", colX[4], y, { font: fontBold, size: 9 });
    drawText("Valor Unit.", colX[5], y, { font: fontBold, size: 9 });
    y -= 2;
    page.drawLine({ start: { x: margin, y }, end: { x: A4W - margin, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= lineHeight;

    for (const srv of servers) {
      checkNewPage();
      drawText((srv.name || "Servidor").substring(0, 22), colX[0], y, { size: 9 });
      drawText(srv.server_type || "vm", colX[1], y, { size: 9 });
      drawText(String(srv.vcpu || "—"), colX[2], y, { size: 9 });
      drawText(srv.ram_gb ? `${srv.ram_gb}GB` : "—", colX[3], y, { size: 9 });
      drawText(String(srv.qty_servers || 1), colX[4], y, { size: 9 });
      drawText(formatBRL(srv.unit_price || 0), colX[5], y, { size: 9 });
      y -= lineHeight;
    }
    y -= 10;
  }

  // Addons table
  const enabledAddons = addons.filter((a: any) => a.enabled && a.total_price > 0);
  if (enabledAddons.length > 0) {
    checkNewPage();
    drawText("SERVIÇOS ADICIONAIS", margin, y, { font: fontBold, size: 11 });
    y -= lineHeight + 4;

    drawText("Serviço", margin, y, { font: fontBold, size: 9 });
    drawText("Qtd", margin + 250, y, { font: fontBold, size: 9 });
    drawText("Valor Unit.", margin + 310, y, { font: fontBold, size: 9 });
    drawText("Total", margin + 410, y, { font: fontBold, size: 9 });
    y -= 2;
    page.drawLine({ start: { x: margin, y }, end: { x: A4W - margin, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= lineHeight;

    for (const addon of enabledAddons) {
      checkNewPage();
      drawText((addon.label || addon.addon_key || "Addon").substring(0, 35), margin, y, { size: 9 });
      drawText(String(addon.quantity || 1), margin + 250, y, { size: 9 });
      drawText(formatBRL(addon.unit_price || 0), margin + 310, y, { size: 9 });
      drawText(formatBRL(addon.total_price || 0), margin + 410, y, { size: 9 });
      y -= lineHeight;
    }
    y -= 10;
  }

  // Total
  checkNewPage();
  y -= 10;
  page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: A4W - margin, y: y + 6 }, thickness: 1, color: rgb(0.1, 0.1, 0.5) });
  drawText("TOTAL MENSAL:", margin, y - 8, { font: fontBold, size: 13 });
  drawText(formatBRL(proposal.total || 0), margin + 200, y - 8, { font: fontBold, size: 13, color: rgb(0.1, 0.1, 0.5) });

  // Observations
  if (proposal.observations) {
    y -= 40;
    checkNewPage();
    drawText("OBSERVAÇÕES", margin, y, { font: fontBold, size: 11 });
    y -= lineHeight + 2;
    const obsLines = String(proposal.observations).split("\n");
    for (const line of obsLines) {
      checkNewPage();
      drawText(line.substring(0, 80), margin, y, { size: 9 });
      y -= lineHeight;
    }
  }

  const pdfBytes = await doc.save();
  return new Uint8Array(pdfBytes);
}

// ─── Generate FULL visual proposal PDF ──────────────────────
// Merges the visual template (7 cover pages) with generated summary pages
async function generateFullVisualProposalPdf(
  adminClient: any,
  proposal: any,
  servers: any[],
  addons: any[],
): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.create();

  // Step 1: Download and embed the visual template (7 branded cover pages)
  let templateLoaded = false;
  try {
    const { data: templateFile, error: templateErr } = await adminClient.storage
      .from("proposal-files")
      .download(TEMPLATE_PDF_PATH);

    if (templateFile && !templateErr) {
      const templateBytes = new Uint8Array(await templateFile.arrayBuffer());
      const templateDoc = await PDFDocument.load(templateBytes);
      const templatePages = await mergedDoc.copyPages(templateDoc, templateDoc.getPageIndices());
      for (const p of templatePages) {
        mergedDoc.addPage(p);
      }
      templateLoaded = true;
      console.log(`[proposal-pdf] template_loaded=true pages=${templatePages.length}`);
    } else {
      console.warn(`[proposal-pdf] template_download_failed: ${templateErr?.message}`);
    }
  } catch (err: any) {
    console.warn(`[proposal-pdf] template_load_exception: ${err?.message}`);
  }

  // Fallback: if template not available, create 7 minimal placeholder pages
  if (!templateLoaded) {
    console.warn("[proposal-pdf] FALLBACK: generating placeholder cover pages (template unavailable)");
    const font = await mergedDoc.embedFont(StandardFonts.HelveticaBold);
    const coverTitles = [
      "PROPOSTA COMERCIAL", "OPEN DATACENTER", "SOBRE A EMPRESA",
      "INFRAESTRUTURA", "NOSSOS SERVIÇOS", "DIFERENCIAIS", "TERMOS E CONDIÇÕES",
    ];
    for (let i = 0; i < 7; i++) {
      const coverPage = mergedDoc.addPage([595.28, 841.89]);
      coverPage.drawText(coverTitles[i], {
        x: 50, y: 420, font, size: 24, color: rgb(0.1, 0.1, 0.5),
      });
    }
  }

  // Step 2: Generate summary pages and append
  const summaryBytes = await generateSummaryPdfBytes(proposal, servers, addons);
  const summaryDoc = await PDFDocument.load(summaryBytes);
  const summaryPages = await mergedDoc.copyPages(summaryDoc, summaryDoc.getPageIndices());
  for (const p of summaryPages) {
    mergedDoc.addPage(p);
  }

  console.log(`[proposal-pdf] merged_total_pages=${mergedDoc.getPageCount()} template=${templateLoaded}`);

  const finalBytes = await mergedDoc.save();
  return new Uint8Array(finalBytes);
}

// ─── Main handler ───────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[proposal-public] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return json({ error: "Server configuration error" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const { token } = body as { token?: string };

    if (!token || token.trim() === "") {
      return json({ error: "Missing token" }, 400);
    }

    const normalizedToken = token.trim();
    console.log("[proposal-public] Looking up token:", normalizedToken);

    // Fetch proposal by public_approval_token
    const { data: proposal, error: fetchError } = await adminClient
      .from("calculator_proposals")
      .select("*")
      .eq("public_approval_token", normalizedToken)
      .maybeSingle();

    if (fetchError) {
      console.error("[proposal-public] DB error:", fetchError);
      return json({ error: "Internal server error" }, 500);
    }

    if (!proposal) {
      return json({ error: "Proposal not found" }, 404);
    }

    // Check expiration
    if (proposal.public_approval_expires_at) {
      const expiresAt = new Date(proposal.public_approval_expires_at);
      if (expiresAt <= new Date()) {
        return json({ error: "Link expired" }, 410);
      }
    }

    // Check if public approval is disabled
    if (proposal.public_approval_enabled === false) {
      return json({ error: "Public approval disabled for this proposal" }, 403);
    }

    // Fetch servers and addons in parallel
    const [serversRes, addonsRes] = await Promise.all([
      adminClient
        .from("calculator_proposal_servers")
        .select("*")
        .eq("proposal_id", proposal.id)
        .order("sort_order"),
      adminClient
        .from("calculator_proposal_addons")
        .select("*")
        .eq("proposal_id", proposal.id)
        .order("sort_order"),
    ]);

    const servers = serversRes.data || [];
    const addons = addonsRes.data || [];

    // ── STEP: Ensure PDF exists ─────────────────────────────
    let proposalPdfPath = proposal.pdf_path || null;

    console.log("[proposal-public] proposal_id=", proposal.id);
    console.log("[proposal-public] proposal_status=", proposal.status);
    console.log("[proposal-public] pdf_path_before=", proposal.pdf_path);

    if (!proposalPdfPath) {
      console.log("[proposal-public] pdf_path missing, generating official visual proposal pdf");

      try {
        // Generate FULL visual PDF (template cover pages + summary)
        const pdfBytes = await generateFullVisualProposalPdf(adminClient, proposal, servers, addons);

        if (!pdfBytes || pdfBytes.length === 0) {
          console.error("[proposal-public] proposal_pdf_generation_failed: empty bytes");
        } else {
          // Upload to storage
          const timestamp = Date.now();
          const storagePath = `proposals/${proposal.id}/proposal-official-${timestamp}.pdf`;

          const { error: uploadError } = await adminClient.storage
            .from("proposal-files")
            .upload(storagePath, pdfBytes, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (uploadError) {
            console.error("[proposal-public] proposal_pdf_storage_failed:", uploadError.message);
          } else {
            // Persist pdf_path on the proposal
            const { error: updateError } = await adminClient
              .from("calculator_proposals")
              .update({ pdf_path: storagePath, pdf_generated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq("id", proposal.id);

            if (updateError) {
              console.error("[proposal-public] proposal_pdf_path_update_failed:", updateError.message);
            } else {
              proposalPdfPath = storagePath;
              console.log("[proposal-public] proposal_pdf_generated=true");
              console.log("[proposal-public] proposal_pdf_path_after=", proposalPdfPath);
            }
          }
        }
      } catch (genErr: any) {
        console.error("[proposal-public] pdf_auto_generation_error:", genErr?.message || genErr);
        // Non-blocking: proposal data still returned even if PDF generation fails
      }
    }

    // Generate signed PDF URL if available
    let pdfSignedUrl: string | null = null;
    if (proposalPdfPath) {
      try {
        const { data: urlData, error: urlError } = await adminClient.storage
          .from("proposal-files")
          .createSignedUrl(proposalPdfPath, 60 * 30);

        if (!urlError && urlData?.signedUrl) {
          pdfSignedUrl = urlData.signedUrl;
        } else {
          console.warn("[proposal-public] PDF signed URL error:", urlError?.message);
        }
      } catch (err) {
        console.warn("[proposal-public] PDF signed URL exception:", err);
      }
    }

    console.log("[proposal-public] pdf_generated=", !!proposalPdfPath);
    console.log("[proposal-public] pdf_path_after=", proposalPdfPath);
    console.log("[proposal-public] public_token=", proposal.public_approval_token);
    console.log("[proposal-public] signed_url_generated=", !!pdfSignedUrl);

    return json({
      proposal: {
        id: proposal.id,
        display_id: proposal.display_id,
        name: proposal.name,
        company: proposal.company,
        email: proposal.email,
        phone: proposal.phone,
        datacenter: proposal.datacenter,
        contract_duration: proposal.contract_duration,
        discount_pct: proposal.discount_pct,
        total: proposal.total,
        currency: proposal.currency,
        status: proposal.status,
        channel_type: proposal.channel_type,
        reseller_name: proposal.reseller_name,
        observations: proposal.observations,
        due_at: proposal.due_at,
        created_at: proposal.created_at,
        pdf_path: proposalPdfPath,
        approval_decision: proposal.approval_decision,
        approved_at: proposal.approved_at,
        rejected_at: proposal.rejected_at,
        public_approval_token: proposal.public_approval_token,
        public_approval_enabled: proposal.public_approval_enabled,
        public_approval_expires_at: proposal.public_approval_expires_at,
      },
      servers,
      addons,
      pdfSignedUrl,
    });
  } catch (err) {
    console.error("[proposal-public] Unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
