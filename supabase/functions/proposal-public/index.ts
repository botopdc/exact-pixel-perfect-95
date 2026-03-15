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

// ─── OPEN brand colors ──────────────────────────────────────
const BRAND = {
  navy: rgb(0.059, 0.071, 0.306),       // #0F1250 - primary dark navy
  navyLight: rgb(0.118, 0.141, 0.420),   // #1E2460 - lighter navy for accents
  accent: rgb(0.220, 0.557, 0.878),      // #388EE0 - blue accent
  white: rgb(1, 1, 1),
  lightGray: rgb(0.945, 0.949, 0.961),   // #F1F2F5 - alternating row bg
  medGray: rgb(0.720, 0.737, 0.780),     // #B8BCC7 - borders
  darkGray: rgb(0.310, 0.333, 0.400),    // #4F5566 - body text
  black: rgb(0.133, 0.149, 0.200),       // #222633 - headings
};

const A4W = 595.28;
const A4H = 841.89;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const CONTENT_WIDTH = A4W - MARGIN_LEFT - MARGIN_RIGHT;
const HEADER_HEIGHT = 60;
const FOOTER_HEIGHT = 40;
const MARGIN_TOP = HEADER_HEIGHT + 30;
const MARGIN_BOTTOM = FOOTER_HEIGHT + 20;

// ─── Branded summary page renderer ─────────────────────────
async function generateBrandedSummaryPdfBytes(
  proposal: any,
  servers: any[],
  addons: any[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([A4W, A4H]);
  let y = A4H - MARGIN_TOP;
  let pageNum = 1;

  // ── Draw branded header on current page ──────────────────
  function drawHeader() {
    // Navy header bar
    page.drawRectangle({
      x: 0, y: A4H - HEADER_HEIGHT,
      width: A4W, height: HEADER_HEIGHT,
      color: BRAND.navy,
    });
    // OPEN text
    page.drawText("OPEN", {
      x: MARGIN_LEFT, y: A4H - 38,
      font: fontBold, size: 20, color: BRAND.white,
    });
    // Subtitle
    page.drawText("PROPOSTA COMERCIAL", {
      x: MARGIN_LEFT + 80, y: A4H - 35,
      font, size: 10, color: rgb(0.6, 0.65, 0.85),
    });
    // Accent line below header
    page.drawRectangle({
      x: 0, y: A4H - HEADER_HEIGHT - 3,
      width: A4W, height: 3,
      color: BRAND.accent,
    });
  }

  // ── Draw branded footer on current page ──────────────────
  function drawFooter() {
    // Footer line
    page.drawLine({
      start: { x: MARGIN_LEFT, y: FOOTER_HEIGHT },
      end: { x: A4W - MARGIN_RIGHT, y: FOOTER_HEIGHT },
      thickness: 0.5, color: BRAND.medGray,
    });
    page.drawText("OPEN Datacenter — Proposta Comercial", {
      x: MARGIN_LEFT, y: FOOTER_HEIGHT - 14,
      font, size: 7, color: BRAND.medGray,
    });
    page.drawText(`Página ${pageNum}`, {
      x: A4W - MARGIN_RIGHT - 45, y: FOOTER_HEIGHT - 14,
      font, size: 7, color: BRAND.medGray,
    });
  }

  // ── New page with branding ───────────────────────────────
  function newBrandedPage() {
    drawFooter(); // finish current page
    page = doc.addPage([A4W, A4H]);
    pageNum++;
    drawHeader();
    drawFooter();
    y = A4H - MARGIN_TOP;
  }

  function checkNewPage(needed = 30) {
    if (y < MARGIN_BOTTOM + needed) {
      newBrandedPage();
    }
  }

  // ── Draw section title ───────────────────────────────────
  function drawSectionTitle(title: string) {
    checkNewPage(50);
    // Section title with accent left bar
    page.drawRectangle({
      x: MARGIN_LEFT, y: y - 4,
      width: 4, height: 18,
      color: BRAND.accent,
    });
    page.drawText(title, {
      x: MARGIN_LEFT + 12, y: y,
      font: fontBold, size: 12, color: BRAND.navy,
    });
    y -= 26;
  }

  // ── Draw table header row ────────────────────────────────
  function drawTableHeader(columns: { label: string; x: number; width: number }[]) {
    checkNewPage(40);
    // Header background
    page.drawRectangle({
      x: MARGIN_LEFT, y: y - 5,
      width: CONTENT_WIDTH, height: 20,
      color: BRAND.navy,
    });
    for (const col of columns) {
      page.drawText(col.label, {
        x: col.x, y: y,
        font: fontBold, size: 8, color: BRAND.white,
      });
    }
    y -= 22;
  }

  // ── Draw table row ───────────────────────────────────────
  function drawTableRow(values: { text: string; x: number }[], rowIndex: number, rowHeight = 16) {
    checkNewPage(rowHeight + 5);
    // Alternating background
    if (rowIndex % 2 === 0) {
      page.drawRectangle({
        x: MARGIN_LEFT, y: y - 4,
        width: CONTENT_WIDTH, height: rowHeight,
        color: BRAND.lightGray,
      });
    }
    for (const v of values) {
      page.drawText(v.text, {
        x: v.x, y: y,
        font, size: 8.5, color: BRAND.darkGray,
      });
    }
    y -= rowHeight;
  }

  // ── Start first page ─────────────────────────────────────
  drawHeader();

  // ── Page title ───────────────────────────────────────────
  page.drawText("RESUMO DE PREÇOS", {
    x: MARGIN_LEFT, y: y + 2,
    font: fontBold, size: 18, color: BRAND.navy,
  });
  y -= 10;
  // Subtle line under title
  page.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: A4W - MARGIN_RIGHT, y },
    thickness: 1, color: BRAND.accent,
  });
  y -= 20;

  // Proposal ID and date
  page.drawText(`Proposta: ${proposal.display_id || proposal.id?.substring(0, 8) || "—"}`, {
    x: MARGIN_LEFT, y, font: fontBold, size: 10, color: BRAND.black,
  });
  const dateStr = new Date().toLocaleDateString("pt-BR");
  page.drawText(`Gerado em: ${dateStr}`, {
    x: A4W - MARGIN_RIGHT - 120, y, font, size: 8, color: BRAND.medGray,
  });
  y -= 28;

  // ── Client info card ─────────────────────────────────────
  drawSectionTitle("DADOS DO CLIENTE");

  const clientFields = [
    ["Empresa", proposal.company || "—"],
    ["Contato", proposal.name || "—"],
    ["Email", proposal.email || "—"],
    ["Telefone", proposal.phone || "—"],
    ["Datacenter", proposal.datacenter || "SP1"],
    ["Moeda", proposal.currency || "BRL"],
    ["Duração do Contrato", `${proposal.contract_duration || 12} meses`],
    ["Desconto", `${proposal.discount_pct || 0}%`],
  ];

  // Info card background
  const cardHeight = clientFields.length * 16 + 10;
  page.drawRectangle({
    x: MARGIN_LEFT, y: y - cardHeight + 10,
    width: CONTENT_WIDTH, height: cardHeight,
    color: BRAND.lightGray,
    borderColor: BRAND.medGray,
    borderWidth: 0.5,
  });

  for (const [label, value] of clientFields) {
    page.drawText(`${label}:`, {
      x: MARGIN_LEFT + 12, y: y - 2,
      font: fontBold, size: 9, color: BRAND.navy,
    });
    page.drawText(String(value), {
      x: MARGIN_LEFT + 150, y: y - 2,
      font, size: 9, color: BRAND.darkGray,
    });
    y -= 16;
  }
  y -= 16;

  // ── Servers table ────────────────────────────────────────
  if (servers.length > 0) {
    drawSectionTitle("SERVIDORES / RECURSOS");

    const srvCols = [
      { label: "Nome", x: MARGIN_LEFT + 6, width: 130 },
      { label: "Tipo", x: MARGIN_LEFT + 140, width: 60 },
      { label: "vCPU", x: MARGIN_LEFT + 205, width: 40 },
      { label: "RAM", x: MARGIN_LEFT + 250, width: 50 },
      { label: "Qtd", x: MARGIN_LEFT + 305, width: 30 },
      { label: "Valor Unit.", x: MARGIN_LEFT + 380, width: 80 },
    ];
    drawTableHeader(srvCols);

    servers.forEach((srv: any, idx: number) => {
      drawTableRow([
        { text: (srv.name || "Servidor").substring(0, 24), x: srvCols[0].x },
        { text: (srv.server_type || "vm").toUpperCase(), x: srvCols[1].x },
        { text: String(srv.vcpu || "—"), x: srvCols[2].x },
        { text: srv.ram_gb ? `${srv.ram_gb} GB` : "—", x: srvCols[3].x },
        { text: String(srv.qty_servers || 1), x: srvCols[4].x },
        { text: formatBRL(srv.unit_price || 0), x: srvCols[5].x },
      ], idx);
    });

    y -= 12;
  }

  // ── Addons table ─────────────────────────────────────────
  const enabledAddons = addons.filter((a: any) => a.enabled && a.total_price > 0);
  if (enabledAddons.length > 0) {
    drawSectionTitle("SERVIÇOS ADICIONAIS");

    const addonCols = [
      { label: "Serviço", x: MARGIN_LEFT + 6, width: 220 },
      { label: "Qtd", x: MARGIN_LEFT + 240, width: 40 },
      { label: "Valor Unit.", x: MARGIN_LEFT + 300, width: 80 },
      { label: "Total", x: MARGIN_LEFT + 400, width: 80 },
    ];
    drawTableHeader(addonCols);

    enabledAddons.forEach((addon: any, idx: number) => {
      drawTableRow([
        { text: (addon.label || addon.addon_key || "Serviço").substring(0, 38), x: addonCols[0].x },
        { text: String(addon.quantity || 1), x: addonCols[1].x },
        { text: formatBRL(addon.unit_price || 0), x: addonCols[2].x },
        { text: formatBRL(addon.total_price || 0), x: addonCols[3].x },
      ], idx);
    });

    y -= 12;
  }

  // ── Total box ────────────────────────────────────────────
  checkNewPage(60);
  y -= 8;

  // Total highlight box
  const totalBoxH = 44;
  page.drawRectangle({
    x: MARGIN_LEFT, y: y - totalBoxH + 14,
    width: CONTENT_WIDTH, height: totalBoxH,
    color: BRAND.navy,
  });
  page.drawText("VALOR TOTAL MENSAL", {
    x: MARGIN_LEFT + 16, y: y - 6,
    font: fontBold, size: 12, color: BRAND.white,
  });
  page.drawText(formatBRL(proposal.total || 0), {
    x: A4W - MARGIN_RIGHT - 160, y: y - 6,
    font: fontBold, size: 16, color: BRAND.white,
  });

  // Accent bar at bottom of total box
  page.drawRectangle({
    x: MARGIN_LEFT, y: y - totalBoxH + 14,
    width: CONTENT_WIDTH, height: 3,
    color: BRAND.accent,
  });

  y -= totalBoxH + 16;

  // ── Observations ─────────────────────────────────────────
  if (proposal.observations) {
    drawSectionTitle("OBSERVAÇÕES");
    const obsLines = String(proposal.observations).split("\n");
    for (const line of obsLines) {
      checkNewPage(16);
      page.drawText(line.substring(0, 90), {
        x: MARGIN_LEFT + 12, y,
        font, size: 9, color: BRAND.darkGray,
      });
      y -= 14;
    }
  }

  // Final footer on last page
  drawFooter();

  const pdfBytes = await doc.save();

  console.log(`[proposal-pdf] generation_mode=official_standard_template_full`);
  console.log(`[proposal-pdf] used_alternative_price_renderer=false`);
  console.log(`[proposal-pdf] output_page_count=${doc.getPageCount()}`);

  return new Uint8Array(pdfBytes);
}

// ─── Generate FULL visual proposal PDF ──────────────────────
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

  // Fallback: branded placeholder pages
  if (!templateLoaded) {
    console.warn("[proposal-pdf] FALLBACK: generating branded placeholder cover pages");
    const font = await mergedDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await mergedDoc.embedFont(StandardFonts.Helvetica);
    const coverTitles = [
      "PROPOSTA COMERCIAL", "OPEN DATACENTER", "SOBRE A EMPRESA",
      "INFRAESTRUTURA", "NOSSOS SERVIÇOS", "DIFERENCIAIS", "TERMOS E CONDIÇÕES",
    ];
    for (let i = 0; i < 7; i++) {
      const coverPage = mergedDoc.addPage([A4W, A4H]);
      // Full navy background
      coverPage.drawRectangle({ x: 0, y: 0, width: A4W, height: A4H, color: BRAND.navy });
      // Accent bar
      coverPage.drawRectangle({ x: 0, y: A4H / 2 + 30, width: A4W, height: 4, color: BRAND.accent });
      // Title
      coverPage.drawText(coverTitles[i], {
        x: MARGIN_LEFT, y: A4H / 2, font, size: 28, color: BRAND.white,
      });
      // OPEN branding
      coverPage.drawText("OPEN", {
        x: MARGIN_LEFT, y: A4H - 60, font, size: 24, color: BRAND.white,
      });
      coverPage.drawText("Datacenter", {
        x: MARGIN_LEFT + 85, y: A4H - 57, font: fontReg, size: 14, color: BRAND.accent,
      });
    }
  }

  // Step 2: Generate branded summary pages and append
  const summaryBytes = await generateBrandedSummaryPdfBytes(proposal, servers, addons);
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

    console.log("[proposal-pdf] proposal_id=", proposal.id);
    console.log("[proposal-pdf] proposal_status=", proposal.status);
    console.log("[proposal-pdf] proposal_pdf_path_before=", proposal.pdf_path);

    if (!proposalPdfPath) {
      console.log("[proposal-public] pdf_path missing, generating official visual proposal pdf");

      try {
        const pdfBytes = await generateFullVisualProposalPdf(adminClient, proposal, servers, addons);

        if (!pdfBytes || pdfBytes.length === 0) {
          console.error("[proposal-public] proposal_pdf_generation_failed: empty bytes");
        } else {
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
            const { error: updateError } = await adminClient
              .from("calculator_proposals")
              .update({ pdf_path: storagePath, pdf_generated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq("id", proposal.id);

            if (updateError) {
              console.error("[proposal-public] proposal_pdf_path_update_failed:", updateError.message);
            } else {
              proposalPdfPath = storagePath;
            }
          }
        }
      } catch (genErr: any) {
        console.error("[proposal-public] pdf_auto_generation_error:", genErr?.message || genErr);
      }
    }

    console.log("[proposal-pdf] pdf_generated=", !!proposalPdfPath);
    console.log("[proposal-pdf] proposal_pdf_path_after=", proposalPdfPath);

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
