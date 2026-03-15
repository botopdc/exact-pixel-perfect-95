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

// ─── OPEN brand colors ──────────────────────────────────────
const BRAND = {
  navy: rgb(0.059, 0.071, 0.306),
  navyLight: rgb(0.118, 0.141, 0.420),
  accent: rgb(0.220, 0.557, 0.878),
  white: rgb(1, 1, 1),
  lightGray: rgb(0.945, 0.949, 0.961),
  medGray: rgb(0.720, 0.737, 0.780),
  darkGray: rgb(0.310, 0.333, 0.400),
  black: rgb(0.133, 0.149, 0.200),
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
const TEMPLATE_PDF_PATH = "templates/proposta_modelo_OPEN.pdf";

// ─── Branded summary renderer (same as proposal-public) ─────
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

  function drawHeader() {
    page.drawRectangle({ x: 0, y: A4H - HEADER_HEIGHT, width: A4W, height: HEADER_HEIGHT, color: BRAND.navy });
    page.drawText("OPEN", { x: MARGIN_LEFT, y: A4H - 38, font: fontBold, size: 20, color: BRAND.white });
    page.drawText("PROPOSTA COMERCIAL", { x: MARGIN_LEFT + 80, y: A4H - 35, font, size: 10, color: rgb(0.6, 0.65, 0.85) });
    page.drawRectangle({ x: 0, y: A4H - HEADER_HEIGHT - 3, width: A4W, height: 3, color: BRAND.accent });
  }

  function drawFooter() {
    page.drawLine({ start: { x: MARGIN_LEFT, y: FOOTER_HEIGHT }, end: { x: A4W - MARGIN_RIGHT, y: FOOTER_HEIGHT }, thickness: 0.5, color: BRAND.medGray });
    page.drawText("OPEN Datacenter — Proposta Comercial", { x: MARGIN_LEFT, y: FOOTER_HEIGHT - 14, font, size: 7, color: BRAND.medGray });
    page.drawText(`Página ${pageNum}`, { x: A4W - MARGIN_RIGHT - 45, y: FOOTER_HEIGHT - 14, font, size: 7, color: BRAND.medGray });
  }

  function newBrandedPage() {
    drawFooter();
    page = doc.addPage([A4W, A4H]);
    pageNum++;
    drawHeader();
    drawFooter();
    y = A4H - MARGIN_TOP;
  }

  function checkNewPage(needed = 30) {
    if (y < MARGIN_BOTTOM + needed) newBrandedPage();
  }

  function drawSectionTitle(title: string) {
    checkNewPage(50);
    page.drawRectangle({ x: MARGIN_LEFT, y: y - 4, width: 4, height: 18, color: BRAND.accent });
    page.drawText(title, { x: MARGIN_LEFT + 12, y, font: fontBold, size: 12, color: BRAND.navy });
    y -= 26;
  }

  function drawTableHeader(columns: { label: string; x: number; width: number }[]) {
    checkNewPage(40);
    page.drawRectangle({ x: MARGIN_LEFT, y: y - 5, width: CONTENT_WIDTH, height: 20, color: BRAND.navy });
    for (const col of columns) {
      page.drawText(col.label, { x: col.x, y, font: fontBold, size: 8, color: BRAND.white });
    }
    y -= 22;
  }

  function drawTableRow(values: { text: string; x: number }[], rowIndex: number, rowHeight = 16) {
    checkNewPage(rowHeight + 5);
    if (rowIndex % 2 === 0) {
      page.drawRectangle({ x: MARGIN_LEFT, y: y - 4, width: CONTENT_WIDTH, height: rowHeight, color: BRAND.lightGray });
    }
    for (const v of values) {
      page.drawText(v.text, { x: v.x, y, font, size: 8.5, color: BRAND.darkGray });
    }
    y -= rowHeight;
  }

  drawHeader();

  page.drawText("RESUMO DE PREÇOS", { x: MARGIN_LEFT, y: y + 2, font: fontBold, size: 18, color: BRAND.navy });
  y -= 10;
  page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: A4W - MARGIN_RIGHT, y }, thickness: 1, color: BRAND.accent });
  y -= 20;

  page.drawText(`Proposta: ${proposal.display_id || proposal.id?.substring(0, 8) || "—"}`, { x: MARGIN_LEFT, y, font: fontBold, size: 10, color: BRAND.black });
  const dateStr = new Date().toLocaleDateString("pt-BR");
  page.drawText(`Gerado em: ${dateStr}`, { x: A4W - MARGIN_RIGHT - 120, y, font, size: 8, color: BRAND.medGray });
  y -= 28;

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
  const cardHeight = clientFields.length * 16 + 10;
  page.drawRectangle({ x: MARGIN_LEFT, y: y - cardHeight + 10, width: CONTENT_WIDTH, height: cardHeight, color: BRAND.lightGray, borderColor: BRAND.medGray, borderWidth: 0.5 });
  for (const [label, value] of clientFields) {
    page.drawText(`${label}:`, { x: MARGIN_LEFT + 12, y: y - 2, font: fontBold, size: 9, color: BRAND.navy });
    page.drawText(String(value), { x: MARGIN_LEFT + 150, y: y - 2, font, size: 9, color: BRAND.darkGray });
    y -= 16;
  }
  y -= 16;

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

  checkNewPage(60);
  y -= 8;
  const totalBoxH = 44;
  page.drawRectangle({ x: MARGIN_LEFT, y: y - totalBoxH + 14, width: CONTENT_WIDTH, height: totalBoxH, color: BRAND.navy });
  page.drawText("VALOR TOTAL MENSAL", { x: MARGIN_LEFT + 16, y: y - 6, font: fontBold, size: 12, color: BRAND.white });
  page.drawText(formatBRL(proposal.total || 0), { x: A4W - MARGIN_RIGHT - 160, y: y - 6, font: fontBold, size: 16, color: BRAND.white });
  page.drawRectangle({ x: MARGIN_LEFT, y: y - totalBoxH + 14, width: CONTENT_WIDTH, height: 3, color: BRAND.accent });
  y -= totalBoxH + 16;

  if (proposal.observations) {
    drawSectionTitle("OBSERVAÇÕES");
    const obsLines = String(proposal.observations).split("\n");
    for (const line of obsLines) {
      checkNewPage(16);
      page.drawText(line.substring(0, 90), { x: MARGIN_LEFT + 12, y, font, size: 9, color: BRAND.darkGray });
      y -= 14;
    }
  }

  drawFooter();
  const pdfBytes = await doc.save();
  return new Uint8Array(pdfBytes);
}

// ─── Generate full visual PDF (template + summary) ──────────
async function generateFullVisualProposalPdf(
  adminClient: any,
  proposal: any,
  servers: any[],
  addons: any[],
): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.create();

  let templateLoaded = false;
  try {
    const { data: templateFile, error: templateErr } = await adminClient.storage
      .from("proposal-files")
      .download(TEMPLATE_PDF_PATH);

    if (templateFile && !templateErr) {
      const templateBytes = new Uint8Array(await templateFile.arrayBuffer());
      const templateDoc = await PDFDocument.load(templateBytes);
      const templatePages = await mergedDoc.copyPages(templateDoc, templateDoc.getPageIndices());
      for (const p of templatePages) mergedDoc.addPage(p);
      templateLoaded = true;
      console.log(`[proposal-download] template_loaded=true pages=${templatePages.length}`);
    } else {
      console.warn(`[proposal-download] template_download_failed: ${templateErr?.message}`);
    }
  } catch (err: any) {
    console.warn(`[proposal-download] template_load_exception: ${err?.message}`);
  }

  if (!templateLoaded) {
    console.warn("[proposal-download] FALLBACK: generating branded placeholder cover pages");
    const font = await mergedDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await mergedDoc.embedFont(StandardFonts.Helvetica);
    const coverTitles = ["PROPOSTA COMERCIAL", "OPEN DATACENTER", "SOBRE A EMPRESA", "INFRAESTRUTURA", "NOSSOS SERVIÇOS", "DIFERENCIAIS", "TERMOS E CONDIÇÕES"];
    for (let i = 0; i < 7; i++) {
      const coverPage = mergedDoc.addPage([A4W, A4H]);
      coverPage.drawRectangle({ x: 0, y: 0, width: A4W, height: A4H, color: BRAND.navy });
      coverPage.drawRectangle({ x: 0, y: A4H / 2 + 30, width: A4W, height: 4, color: BRAND.accent });
      coverPage.drawText(coverTitles[i], { x: MARGIN_LEFT, y: A4H / 2, font, size: 28, color: BRAND.white });
      coverPage.drawText("OPEN", { x: MARGIN_LEFT, y: A4H - 60, font, size: 24, color: BRAND.white });
      coverPage.drawText("Datacenter", { x: MARGIN_LEFT + 85, y: A4H - 57, font: fontReg, size: 14, color: BRAND.accent });
    }
  }

  const summaryBytes = await generateBrandedSummaryPdfBytes(proposal, servers, addons);
  const summaryDoc = await PDFDocument.load(summaryBytes);
  const summaryPages = await mergedDoc.copyPages(summaryDoc, summaryDoc.getPageIndices());
  for (const p of summaryPages) mergedDoc.addPage(p);

  console.log(`[proposal-download] merged_total_pages=${mergedDoc.getPageCount()}`);
  const finalBytes = await mergedDoc.save();
  return new Uint8Array(finalBytes);
}

// ─── Main handler ───────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { proposalId } = body as { proposalId?: string };

    if (!proposalId) {
      return json({ success: false, error: "proposalId is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch proposal
    const { data: proposal, error: proposalError } = await adminClient
      .from("calculator_proposals")
      .select("*")
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      console.error("[proposal-download] proposal_not_found:", proposalError?.message);
      return json({ success: false, error: "Proposta não encontrada" }, 404);
    }

    console.log("[proposal-download] proposal_id=", proposal.id);
    console.log("[proposal-download] pdf_path_before=", proposal.pdf_path);

    let proposalPdfPath = proposal.pdf_path || null;

    if (!proposalPdfPath) {
      console.log("[proposal-download] pdf missing, generating official pdf");

      // Fetch servers and addons
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

      const pdfBytes = await generateFullVisualProposalPdf(adminClient, proposal, servers, addons);

      if (!pdfBytes || pdfBytes.length === 0) {
        console.error("[proposal-download] proposal_pdf_generation_failed");
        return json({ success: false, error: "Falha ao gerar o PDF da proposta" }, 500);
      }

      const timestamp = Date.now();
      const storagePath = `proposals/${proposal.id}/proposal-official-${timestamp}.pdf`;

      const { error: uploadError } = await adminClient.storage
        .from("proposal-files")
        .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });

      if (uploadError) {
        console.error("[proposal-download] proposal_pdf_storage_failed:", uploadError.message);
        return json({ success: false, error: "Falha ao salvar o PDF no storage" }, 500);
      }

      const { error: updateError } = await adminClient
        .from("calculator_proposals")
        .update({ pdf_path: storagePath, pdf_generated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", proposal.id);

      if (updateError) {
        console.error("[proposal-download] proposal_pdf_path_update_failed:", updateError.message);
      }

      proposalPdfPath = storagePath;
    }

    console.log("[proposal-download] pdf_generated=", !!proposalPdfPath);
    console.log("[proposal-download] pdf_path_after=", proposalPdfPath);

    // Generate signed URL
    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from("proposal-files")
      .createSignedUrl(proposalPdfPath, 60 * 30);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("[proposal-download] signed_url_failed:", signedUrlError?.message);
      return json({ success: false, error: "Falha ao gerar link de download do PDF" }, 500);
    }

    console.log("[proposal-download] signed_url_generated=true");

    return json({
      success: true,
      proposal_id: proposal.id,
      pdf_path: proposalPdfPath,
      pdfSignedUrl: signedUrlData.signedUrl,
    });
  } catch (err: any) {
    console.error("[proposal-download] error=", err);
    console.error("[proposal-download] error_message=", err?.message);
    return json({ success: false, error: String(err) }, 500);
  }
});
