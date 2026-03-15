// ============================================================================
// EDGE FUNCTION: contract-generate-document
// Generates Contract DOCX + Annex I PDF from proposal
// Strategy: proposal_pdf_trim — always uses visual template PDF as source
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errorResponse(code: string, message: string, status: number, debug?: Record<string, unknown>) {
  console.error(`[contract-docs] ERROR code=${code} message=${message}`);
  return json({ success: false, code, message, debug: debug || {} }, status);
}

// ─── Constants ──────────────────────────────────────────────
const LOCKED_STATUSES = ["assinado", "finalizado", "cancelado"];
const TEMPLATE_PDF_PATH = "templates/proposta_modelo_OPEN.pdf";

// ─── OPEN brand colors (shared with proposal-public) ────────
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

// ─── Date helpers ───────────────────────────────────────────
function dateExtenso(dateStr: string | null): string {
  if (!dateStr) return "_____ de _____________ de _______";
  const d = new Date(dateStr + "T12:00:00");
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function dateShort(dateStr: string | null): string {
  if (!dateStr) return "__/__/____";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR");
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── DOCX template merge ────────────────────────────────────
async function mergeDocxTemplate(
  templateBytes: Uint8Array,
  placeholders: Record<string, string>
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(templateBytes);
  const xmlFiles = [
    "word/document.xml",
    "word/header1.xml", "word/header2.xml", "word/header3.xml",
    "word/footer1.xml", "word/footer2.xml", "word/footer3.xml",
  ];
  for (const path of xmlFiles) {
    const file = zip.file(path);
    if (!file) continue;
    let xml = await file.async("string");
    for (const [key, value] of Object.entries(placeholders)) {
      const tag = `{{${key}}}`;
      xml = xml.split(tag).join(escapeXml(value));
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const splitPattern = new RegExp(
        `\\{\\{[\\s]*(?:<[^>]*>)*[\\s]*${escapedKey}[\\s]*(?:<[^>]*>)*[\\s]*\\}\\}`, "g"
      );
      xml = xml.replace(splitPattern, escapeXml(value));
    }
    zip.file(path, xml);
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

// ─── Trim proposal PDF: remove pages 1–7, keep 8+ ──────────
async function trimProposalPdf(pdfBytes: Uint8Array): Promise<{ trimmedBytes: Uint8Array; trimmedPageCount: number }> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();
  if (totalPages <= 7) throw new Error("proposal_pdf_page_count_invalid");
  const newDoc = await PDFDocument.create();
  const pagesToCopy = Array.from({ length: totalPages - 7 }, (_, i) => i + 7);
  const copiedPages = await newDoc.copyPages(srcDoc, pagesToCopy);
  for (const p of copiedPages) newDoc.addPage(p);
  const trimmedBytes = await newDoc.save();
  return { trimmedBytes: new Uint8Array(trimmedBytes), trimmedPageCount: copiedPages.length };
}

// ─── Branded summary page renderer (same as proposal-public) ─
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

  function drawTableHeader(columns: { label: string; x: number }[]) {
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

  // Start
  drawHeader();

  page.drawText("RESUMO DE PREÇOS", { x: MARGIN_LEFT, y: y + 2, font: fontBold, size: 18, color: BRAND.navy });
  y -= 10;
  page.drawLine({ start: { x: MARGIN_LEFT, y }, end: { x: A4W - MARGIN_RIGHT, y }, thickness: 1, color: BRAND.accent });
  y -= 20;

  page.drawText(`Proposta: ${proposal.display_id || proposal.id?.substring(0, 8) || "—"}`, { x: MARGIN_LEFT, y, font: fontBold, size: 10, color: BRAND.black });
  const dateStr = new Date().toLocaleDateString("pt-BR");
  page.drawText(`Gerado em: ${dateStr}`, { x: A4W - MARGIN_RIGHT - 120, y, font, size: 8, color: BRAND.medGray });
  y -= 28;

  // Client info
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

  // Servers
  if (servers.length > 0) {
    drawSectionTitle("SERVIDORES / RECURSOS");
    const srvCols = [
      { label: "Nome", x: MARGIN_LEFT + 6 },
      { label: "Tipo", x: MARGIN_LEFT + 140 },
      { label: "vCPU", x: MARGIN_LEFT + 205 },
      { label: "RAM", x: MARGIN_LEFT + 250 },
      { label: "Qtd", x: MARGIN_LEFT + 305 },
      { label: "Valor Unit.", x: MARGIN_LEFT + 380 },
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

  // Addons
  const enabledAddons = addons.filter((a: any) => a.enabled && a.total_price > 0);
  if (enabledAddons.length > 0) {
    drawSectionTitle("SERVIÇOS ADICIONAIS");
    const addonCols = [
      { label: "Serviço", x: MARGIN_LEFT + 6 },
      { label: "Qtd", x: MARGIN_LEFT + 240 },
      { label: "Valor Unit.", x: MARGIN_LEFT + 300 },
      { label: "Total", x: MARGIN_LEFT + 400 },
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

  // Total box
  checkNewPage(60);
  y -= 8;
  const totalBoxH = 44;
  page.drawRectangle({ x: MARGIN_LEFT, y: y - totalBoxH + 14, width: CONTENT_WIDTH, height: totalBoxH, color: BRAND.navy });
  page.drawText("VALOR TOTAL MENSAL", { x: MARGIN_LEFT + 16, y: y - 6, font: fontBold, size: 12, color: BRAND.white });
  page.drawText(formatBRL(proposal.total || 0), { x: A4W - MARGIN_RIGHT - 160, y: y - 6, font: fontBold, size: 16, color: BRAND.white });
  page.drawRectangle({ x: MARGIN_LEFT, y: y - totalBoxH + 14, width: CONTENT_WIDTH, height: 3, color: BRAND.accent });
  y -= totalBoxH + 16;

  // Observations
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

  console.log(`[proposal-pdf] generation_mode=official_standard_template_full`);
  console.log(`[proposal-pdf] used_alternative_price_renderer=false`);
  console.log(`[proposal-pdf] output_page_count=${doc.getPageCount()}`);

  const pdfBytes = await doc.save();
  return new Uint8Array(pdfBytes);
}

// ─── Generate FULL visual proposal PDF ──────────────────────
async function generateFullVisualProposalPdf(
  supabase: any,
  proposal: any,
  servers: any[],
  addons: any[],
): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.create();

  let templateLoaded = false;
  try {
    const { data: templateFile, error: templateErr } = await supabase.storage
      .from("proposal-files")
      .download(TEMPLATE_PDF_PATH);

    if (templateFile && !templateErr) {
      const templateBytes = new Uint8Array(await templateFile.arrayBuffer());
      const templateDoc = await PDFDocument.load(templateBytes);
      const templatePages = await mergedDoc.copyPages(templateDoc, templateDoc.getPageIndices());
      for (const p of templatePages) mergedDoc.addPage(p);
      templateLoaded = true;
      console.log(`[contract-docs] template_loaded=true pages=${templatePages.length}`);
    } else {
      console.warn(`[contract-docs] template_download_failed: ${templateErr?.message}`);
    }
  } catch (err: any) {
    console.warn(`[contract-docs] template_load_exception: ${err?.message}`);
  }

  if (!templateLoaded) {
    console.warn("[contract-docs] FALLBACK: generating branded placeholder cover pages");
    const font = await mergedDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await mergedDoc.embedFont(StandardFonts.Helvetica);
    const coverTitles = [
      "PROPOSTA COMERCIAL", "OPEN DATACENTER", "SOBRE A EMPRESA",
      "INFRAESTRUTURA", "NOSSOS SERVIÇOS", "DIFERENCIAIS", "TERMOS E CONDIÇÕES",
    ];
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

  console.log(`[contract-docs] merged_total_pages=${mergedDoc.getPageCount()} template=${templateLoaded}`);

  const finalBytes = await mergedDoc.save();
  return new Uint8Array(finalBytes);
}

// ─── Build proposal snapshot ────────────────────────────────
function buildProposalSnapshot(proposal: any, servers: any[], addons: any[]): Record<string, unknown> {
  return {
    proposal_id: proposal.id,
    display_id: proposal.display_id,
    company: proposal.company,
    name: proposal.name,
    email: proposal.email,
    phone: proposal.phone,
    datacenter: proposal.datacenter,
    currency: proposal.currency,
    channel_type: proposal.channel_type,
    contract_duration: proposal.contract_duration,
    discount_pct: proposal.discount_pct,
    total: proposal.total,
    fx: proposal.fx,
    status: proposal.status,
    pdf_path: proposal.pdf_path,
    created_at: proposal.created_at,
    servers: servers.map((s: any) => ({
      id: s.id, server_type: s.server_type, name: s.name, vcpu: s.vcpu,
      ram_gb: s.ram_gb, nvme_tb: s.nvme_tb, traffic_tb: s.traffic_tb,
      ips: s.ips, qty_servers: s.qty_servers, gpu: s.gpu, gpu_qty: s.gpu_qty,
      bm_cpu: s.bm_cpu, bm_ram: s.bm_ram, disks: s.disks,
      storage_type: s.storage_type, storage_region: s.storage_region,
      volume_tb: s.volume_tb, unit_price: s.unit_price, total_price: s.total_price,
    })),
    addons: addons.map((a: any) => ({
      id: a.id, addon_key: a.addon_key, label: a.label, enabled: a.enabled,
      quantity: a.quantity, unit_price: a.unit_price, total_price: a.total_price,
    })),
    snapshot_taken_at: new Date().toISOString(),
    snapshot_strategy: "contract_document_generation",
  };
}

// ─── Main handler ────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const debug: Record<string, unknown> = {};

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const { contract_id } = body as { contract_id?: string };

    if (!contract_id) {
      return errorResponse("contract_id_required", "contract_id é obrigatório.", 400);
    }

    debug.contract_id = contract_id;

    // ── STEP 1: Load contract ───────────────────────────────
    console.log(`[contract-docs] [STEP 1] loading contract_id=${contract_id}`);
    const { data: contract, error: contractErr } = await supabase
      .from("contracts").select("*").eq("id", contract_id).is("deleted_at", null).single();

    if (contractErr || !contract) {
      return errorResponse("contract_not_found", "Contrato não encontrado.", 404, debug);
    }
    debug.contract_status = contract.status;

    if (LOCKED_STATUSES.includes(contract.status)) {
      return errorResponse("contract_documents_locked", `Contrato com status "${contract.status}" não permite regeração de documentos.`, 422, debug);
    }

    // ── STEP 2: Load proposal ────────────────────────────────
    const proposalId = contract.proposal_id;
    debug.proposal_id = proposalId;
    if (!proposalId) return errorResponse("contract_without_proposal_id", "Contrato sem proposta vinculada.", 400, debug);

    const { data: proposal, error: propErr } = await supabase
      .from("calculator_proposals").select("*").eq("id", proposalId).single();

    if (propErr || !proposal) return errorResponse("proposal_not_found", "Proposta vinculada não encontrada.", 404, debug);
    debug.proposal_pdf_path_before = proposal.pdf_path;

    // ── STEP 3: Load servers & addons ────────────────────────
    const [serversRes, addonsRes] = await Promise.all([
      supabase.from("calculator_proposal_servers").select("*").eq("proposal_id", proposalId).order("sort_order"),
      supabase.from("calculator_proposal_addons").select("*").eq("proposal_id", proposalId).order("sort_order"),
    ]);
    const servers = serversRes.data || [];
    const addons = addonsRes.data || [];
    debug.servers_count = servers.length;
    debug.addons_count = addons.length;

    // ── STEP 4: Resolve proposal PDF ─────────────────────────
    let proposalPdfPath = proposal.pdf_path || null;
    let pdfAutoGenerated = false;

    if (!proposalPdfPath) {
      const { data: existingFiles } = await supabase
        .from("calculator_proposal_files").select("file_path, file_type")
        .eq("proposal_id", proposalId).eq("file_type", "application/pdf").limit(1);

      if (existingFiles && existingFiles.length > 0) {
        proposalPdfPath = existingFiles[0].file_path;
      }
    }

    if (!proposalPdfPath) {
      console.log(`[contract-docs] [STEP 4] auto-generating FULL VISUAL proposal PDF...`);
      try {
        const fullPdfBytes = await generateFullVisualProposalPdf(supabase, proposal, servers, addons);
        const autoPath = `proposals/${proposalId}/proposal-official-${Date.now()}.pdf`;

        const { error: uploadErr } = await supabase.storage
          .from("proposal-files").upload(autoPath, fullPdfBytes, { contentType: "application/pdf", upsert: true });

        if (uploadErr) return errorResponse("proposal_pdf_auto_generation_failed", `Falha ao salvar PDF: ${uploadErr.message}`, 500, debug);

        await supabase.from("calculator_proposals")
          .update({ pdf_path: autoPath, pdf_generated_at: new Date().toISOString() })
          .eq("id", proposalId);

        proposalPdfPath = autoPath;
        pdfAutoGenerated = true;
        console.log(`[contract-docs] [STEP 4] OK auto-generated pdf_path=${autoPath}`);
      } catch (genErr) {
        return errorResponse("proposal_pdf_auto_generation_failed", `Erro ao gerar PDF: ${genErr}`, 500, debug);
      }
    }

    debug.proposal_pdf_path_after = proposalPdfPath;
    debug.pdf_auto_generated = pdfAutoGenerated;

    // ── STEP 5: Snapshot ─────────────────────────────────────
    const snapshot = buildProposalSnapshot(proposal, servers, addons);

    // ── STEP 6: Download source PDF ──────────────────────────
    console.log(`[contract-docs] [STEP 6] downloading source pdf path=${proposalPdfPath}`);
    const { data: pdfFile, error: pdfDlErr } = await supabase.storage
      .from("proposal-files").download(proposalPdfPath!);

    if (!pdfFile || pdfDlErr) return errorResponse("proposal_pdf_file_not_found", `PDF não encontrado (path=${proposalPdfPath})`, 404, debug);

    const proposalPdfBytes = new Uint8Array(await pdfFile.arrayBuffer());
    const header = new TextDecoder().decode(proposalPdfBytes.slice(0, 5));
    if (!header.startsWith("%PDF")) return errorResponse("proposal_pdf_invalid_format", `Arquivo não é PDF válido`, 422, debug);

    // ── STEP 7: Generate Annex I ─────────────────────────────
    const contractCode = contract.contract_number || contract.id.substring(0, 8).toUpperCase();
    const basePath = `contracts/${contract.id}`;

    const srcDoc = await PDFDocument.load(proposalPdfBytes);
    const totalPages = srcDoc.getPageCount();
    debug.source_pdf_page_count = totalPages;

    console.log(`[contract-docs] source_pdf_path=${proposalPdfPath}`);
    console.log(`[contract-docs] source_pdf_pages=${totalPages}`);
    console.log(`[contract-docs] trim_start_page=8`);

    if (totalPages <= 7) {
      return errorResponse("proposal_pdf_page_count_invalid", `PDF tem apenas ${totalPages} páginas, precisa >7.`, 422, debug);
    }

    const { trimmedBytes, trimmedPageCount } = await trimProposalPdf(proposalPdfBytes);
    if (trimmedPageCount < 1) return errorResponse("contract_annex_trim_empty", "Recorte resultou em zero páginas.", 500, debug);

    console.log(`[contract-docs] trimmed_pages=${trimmedPageCount}`);

    const annexStoragePath = `${basePath}/anexo-i-${contractCode}.pdf`;
    const { error: annexUpErr } = await supabase.storage
      .from("contracts-generated").upload(annexStoragePath, trimmedBytes, { contentType: "application/pdf", upsert: true });

    if (annexUpErr) return errorResponse("contract_annex_pdf_storage_failed", `Erro ao salvar Anexo I: ${annexUpErr.message}`, 500, debug);

    console.log(`[contract-docs] annex_saved_path=${annexStoragePath}`);
    console.log(`[contract-docs] annex_generation_strategy=proposal_pdf_trim`);

    debug.annex_pdf_path = annexStoragePath;
    debug.annex_page_count = trimmedPageCount;
    debug.generation_strategy = "proposal_pdf_trim";

    // ── STEP 8: Generate DOCX ────────────────────────────────
    let docxPath: string | null = null;
    let docxGenerated = false;

    try {
      const templateCode = contract.template_code || "opdc-cloud-default";
      const placeholders: Record<string, string> = {
        contract_code: contractCode,
        legal_name: contract.legal_name || contract.company || "",
        cnpj: contract.has_no_cnpj ? "ISENTO" : (contract.cnpj || ""),
        address: [contract.street, contract.neighborhood].filter(Boolean).join(", "),
        city: contract.city || "",
        uf: contract.state || "",
        city_contract: contract.contract_city || contract.city || "",
        date_extenso: dateExtenso(contract.contract_date),
        date_short: dateShort(contract.contract_date),
        open_legal_name: "OPEN DATACENTER LTDA",
        open_signer: contract.open_signer_name || "________________",
        open_signer_cpf: contract.open_signer_cpf || "___.___.___-__",
        w1_name: contract.witness_1_name || "________________",
        w1_cpf: contract.witness_1_cpf || "___.___.___-__",
        w2_name: contract.witness_2_name || "________________",
        w2_cpf: contract.witness_2_cpf || "___.___.___-__",
      };

      const { data: template } = await supabase
        .from("contract_templates").select("*").eq("code", templateCode).eq("is_active", true).single();

      if (template) {
        const { data: templateFile, error: dlErr } = await supabase.storage
          .from(template.bucket).download(template.path);

        if (templateFile && !dlErr) {
          const templateBytes = new Uint8Array(await templateFile.arrayBuffer());
          const mergedDocx = await mergeDocxTemplate(templateBytes, placeholders);
          const docxStoragePath = `${basePath}/contrato-${contractCode}.docx`;
          const { error: upErr } = await supabase.storage
            .from("contracts-generated").upload(docxStoragePath, mergedDocx, {
              contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              upsert: true,
            });
          if (!upErr) { docxPath = docxStoragePath; docxGenerated = true; }
          else console.error("[contract-docs] docx_upload_error", upErr);
        }
      }
    } catch (e) {
      console.error("[contract-docs] docx_generation_exception", e);
    }

    // ── STEP 9: Update contract ──────────────────────────────
    const updatePayload: Record<string, unknown> = {
      docx_path: docxPath,
      annex_pdf_path: annexStoragePath,
      proposal_pdf_source_path: proposalPdfPath,
      generation_strategy: "proposal_pdf_trim",
      template_code: contract.template_code || "opdc-cloud-default",
      updated_at: new Date().toISOString(),
      proposal_payload: snapshot,
      metadata: {
        ...(typeof contract.metadata === "object" && contract.metadata !== null ? contract.metadata : {}),
        document_generation: {
          generated_at: new Date().toISOString(),
          strategy: "proposal_pdf_trim",
          pdf_auto_generated: pdfAutoGenerated,
          source_pdf_page_count: totalPages,
          annex_page_count: trimmedPageCount,
          docx_generated: docxGenerated,
          annex_generated: true,
          snapshot_taken: true,
        },
      },
    };

    const { error: updateErr } = await supabase.from("contracts").update(updatePayload).eq("id", contract_id);
    if (updateErr) console.error("[contract-docs] contract_update_error", updateErr);

    // ── Response ─────────────────────────────────────────────
    const documents: Array<{ type: string; name: string; path: string }> = [];
    if (docxGenerated && docxPath) documents.push({ type: "contract_docx", name: "Contrato DOCX", path: docxPath });
    documents.push({ type: "annex_pdf", name: "Anexo I — Resumo da Proposta (PDF)", path: annexStoragePath });

    return json({
      success: true,
      contract_id,
      proposal_id: proposalId,
      generation_strategy: "proposal_pdf_trim",
      snapshot_created: true,
      annex_generated: true,
      contract_docx_generated: docxGenerated,
      docx_path: docxPath,
      annex_pdf_path: annexStoragePath,
      proposal_pdf_source_path: proposalPdfPath,
      pdf_auto_generated: pdfAutoGenerated,
      documents,
      debug,
    });

  } catch (err) {
    console.error("[contract-docs] UNHANDLED ERROR:", err);
    return errorResponse("internal_error", `Erro interno: ${err}`, 500, debug);
  }
});
