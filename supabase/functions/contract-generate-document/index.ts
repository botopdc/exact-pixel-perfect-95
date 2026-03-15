// ============================================================================
// EDGE FUNCTION: contract-generate-document
// Generates Contract DOCX + Annex I PDF from proposal
// Strategy: proposal_pdf_trim (existing PDF) or proposal_pdf_generated (auto)
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

// ─── Locked statuses ────────────────────────────────────────
const LOCKED_STATUSES = ["assinado", "finalizado", "cancelado"];

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
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
        `\\{\\{[\\s]*(?:<[^>]*>)*[\\s]*${escapedKey}[\\s]*(?:<[^>]*>)*[\\s]*\\}\\}`,
        "g"
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

  if (totalPages <= 7) {
    throw new Error("proposal_pdf_page_count_invalid");
  }

  const newDoc = await PDFDocument.create();
  const pagesToCopy = Array.from(
    { length: totalPages - 7 },
    (_, i) => i + 7
  );
  const copiedPages = await newDoc.copyPages(srcDoc, pagesToCopy);
  for (const p of copiedPages) {
    newDoc.addPage(p);
  }

  const trimmedBytes = await newDoc.save();
  return { trimmedBytes: new Uint8Array(trimmedBytes), trimmedPageCount: copiedPages.length };
}

// ─── Generate FULL proposal PDF (7 cover pages + summary pages) ──────
// Used when proposal has no pdf_path. Creates a document with 7+N pages
// so the standard trim flow (remove pages 1-7) produces the real summary.
// IMPORTANT: Uses ONLY proposal data — never contract data — to ensure
// the same PDF is generated regardless of context (public or contract).
async function generateFullProposalPdf(
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

  // ── Pages 1-7: Cover / placeholder pages ──────────────────
  const coverTitles = [
    "PROPOSTA COMERCIAL",
    "OPEN DATACENTER",
    "SOBRE A EMPRESA",
    "INFRAESTRUTURA",
    "NOSSOS SERVIÇOS",
    "DIFERENCIAIS",
    "TERMOS E CONDIÇÕES",
  ];
  for (let i = 0; i < 7; i++) {
    const coverPage = doc.addPage([A4W, A4H]);
    coverPage.drawText(coverTitles[i], {
      x: margin,
      y: A4H / 2,
      font: fontBold,
      size: 24,
      color: rgb(0.1, 0.1, 0.5),
    });
    coverPage.drawText(
      `Proposta: ${proposal.display_id || proposal.id?.substring(0, 8) || "—"}`,
      { x: margin, y: A4H / 2 - 40, font, size: 12, color: rgb(0.3, 0.3, 0.3) }
    );
    coverPage.drawText(
      `Página ${i + 1} de capa — gerada automaticamente`,
      { x: margin, y: margin, font, size: 8, color: rgb(0.6, 0.6, 0.6) }
    );
  }

  // ── Pages 8+: Real proposal summary content ───────────────
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
  drawText("ANEXO I — RESUMO DA PROPOSTA", margin, y, { font: fontBold, size: 14, color: rgb(0.1, 0.1, 0.5) });
  y -= 24;
  drawText(`Proposta: ${proposal.display_id || proposal.id?.substring(0, 8) || "—"}`, margin, y, { font: fontBold, size: 11 });
  y -= 16;
  drawText(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`, margin, y, { size: 8, color: rgb(0.4, 0.4, 0.4) });
  y -= 24;

  // Client info
  drawText("DADOS DO CLIENTE", margin, y, { font: fontBold, size: 11 });
  y -= lineHeight + 2;
  const clientFields = [
    ["Empresa", contract.company || proposal.company || "—"],
    ["Contato", contract.client_name || proposal.name || "—"],
    ["Email", contract.email || proposal.email || "—"],
    ["Datacenter", contract.datacenter || proposal.datacenter || "SP1"],
    ["Moeda", contract.currency || proposal.currency || "BRL"],
    ["Duração", `${contract.contract_duration || proposal.contract_duration || 12} meses`],
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
    drawText("Qtd", margin + 280, y, { font: fontBold, size: 9 });
    drawText("Valor", margin + 360, y, { font: fontBold, size: 9 });
    y -= 2;
    page.drawLine({ start: { x: margin, y }, end: { x: A4W - margin, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= lineHeight;

    for (const addon of enabledAddons) {
      checkNewPage();
      drawText((addon.label || addon.addon_key || "Serviço").substring(0, 40), margin, y, { size: 9 });
      drawText(String(addon.quantity || 1), margin + 280, y, { size: 9 });
      drawText(formatBRL(addon.total_price || 0), margin + 360, y, { size: 9 });
      y -= lineHeight;
    }
    y -= 10;
  }

  // Total
  checkNewPage();
  y -= 6;
  page.drawLine({ start: { x: margin, y: y + lineHeight }, end: { x: A4W - margin, y: y + lineHeight }, thickness: 1, color: rgb(0.1, 0.1, 0.5) });
  drawText("VALOR TOTAL MENSAL:", margin, y, { font: fontBold, size: 12 });
  drawText(formatBRL(proposal.total || contract.total || 0), margin + 280, y, { font: fontBold, size: 12, color: rgb(0.1, 0.1, 0.5) });
  y -= lineHeight * 2;

  checkNewPage();
  drawText("Este documento é um resumo gerado automaticamente a partir dos dados da proposta comercial.", margin, y, { size: 8, color: rgb(0.5, 0.5, 0.5) });
  y -= lineHeight;
  drawText("Os termos e condições completos estão definidos no contrato principal.", margin, y, { size: 8, color: rgb(0.5, 0.5, 0.5) });

  const bytes = await doc.save();
  return new Uint8Array(bytes);
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
      id: s.id,
      server_type: s.server_type,
      name: s.name,
      vcpu: s.vcpu,
      ram_gb: s.ram_gb,
      nvme_tb: s.nvme_tb,
      traffic_tb: s.traffic_tb,
      ips: s.ips,
      qty_servers: s.qty_servers,
      gpu: s.gpu,
      gpu_qty: s.gpu_qty,
      bm_cpu: s.bm_cpu,
      bm_ram: s.bm_ram,
      disks: s.disks,
      storage_type: s.storage_type,
      storage_region: s.storage_region,
      volume_tb: s.volume_tb,
      unit_price: s.unit_price,
      total_price: s.total_price,
    })),
    addons: addons.map((a: any) => ({
      id: a.id,
      addon_key: a.addon_key,
      label: a.label,
      enabled: a.enabled,
      quantity: a.quantity,
      unit_price: a.unit_price,
      total_price: a.total_price,
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
      .from("contracts")
      .select("*")
      .eq("id", contract_id)
      .is("deleted_at", null)
      .single();

    if (contractErr || !contract) {
      return errorResponse("contract_not_found", "Contrato não encontrado.", 404, debug);
    }
    console.log(`[contract-docs] [STEP 1] OK contract loaded status=${contract.status}`);
    debug.contract_status = contract.status;

    // ── CHECK LOCK: immutable after certain statuses ────────
    if (LOCKED_STATUSES.includes(contract.status)) {
      return errorResponse(
        "contract_documents_locked",
        `Contrato com status "${contract.status}" não permite regeração de documentos.`,
        422,
        debug
      );
    }

    // ── STEP 2: Validate & load proposal ────────────────────
    const proposalId = contract.proposal_id;
    debug.proposal_id = proposalId;

    if (!proposalId) {
      return errorResponse("contract_without_proposal_id", "Contrato sem proposta vinculada (proposal_id).", 400, debug);
    }

    console.log(`[contract-docs] [STEP 2] loading proposal_id=${proposalId}`);
    const { data: proposal, error: propErr } = await supabase
      .from("calculator_proposals")
      .select("*")
      .eq("id", proposalId)
      .single();

    if (propErr || !proposal) {
      return errorResponse("proposal_not_found", "Proposta vinculada não encontrada.", 404, debug);
    }
    console.log(`[contract-docs] [STEP 2] OK proposal loaded display_id=${proposal.display_id} pdf_path=${proposal.pdf_path}`);
    debug.proposal_display_id = proposal.display_id;
    debug.proposal_pdf_path_before = proposal.pdf_path;

    // ── STEP 3: Load proposal servers & addons ──────────────
    console.log(`[contract-docs] [STEP 3] loading proposal items...`);
    const [serversRes, addonsRes] = await Promise.all([
      supabase.from("calculator_proposal_servers").select("*").eq("proposal_id", proposalId).order("sort_order"),
      supabase.from("calculator_proposal_addons").select("*").eq("proposal_id", proposalId).order("sort_order"),
    ]);
    const servers = serversRes.data || [];
    const addons = addonsRes.data || [];
    console.log(`[contract-docs] [STEP 3] OK servers=${servers.length} addons=${addons.length}`);
    debug.servers_count = servers.length;
    debug.addons_count = addons.length;

    // ── STEP 4: Resolve proposal PDF ────────────────────────
    let proposalPdfPath = proposal.pdf_path || null;
    let pdfAutoGenerated = false;

    if (!proposalPdfPath) {
      // Check calculator_proposal_files for existing PDF
      console.log(`[contract-docs] [STEP 4] pdf_path is null, checking proposal_files...`);
      const { data: existingFiles } = await supabase
        .from("calculator_proposal_files")
        .select("file_path, file_type")
        .eq("proposal_id", proposalId)
        .eq("file_type", "application/pdf")
        .limit(1);

      if (existingFiles && existingFiles.length > 0) {
        proposalPdfPath = existingFiles[0].file_path;
        console.log(`[contract-docs] [STEP 4] found existing file in proposal_files: ${proposalPdfPath}`);
      }
    }

    if (!proposalPdfPath) {
      // Auto-generate a FULL proposal PDF (7 cover pages + summary pages)
      // This ensures the standard trim flow (remove pages 1-7) always works
      console.log(`[contract-docs] [STEP 4] auto-generating FULL proposal PDF (7 cover + summary)...`);
      try {
        const fullPdfBytes = await generateFullProposalPdf(proposal, servers, addons, contract);
        const autoPath = `proposals/${proposalId}/proposal-full-${Date.now()}.pdf`;

        const { error: uploadErr } = await supabase.storage
          .from("proposal-files")
          .upload(autoPath, fullPdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadErr) {
          console.error(`[contract-docs] [STEP 4] FAILED auto-upload`, uploadErr);
          return errorResponse("proposal_pdf_auto_generation_failed", `Falha ao salvar PDF gerado: ${uploadErr.message}`, 500, debug);
        }

        // Update proposal.pdf_path
        await supabase
          .from("calculator_proposals")
          .update({ pdf_path: autoPath, pdf_generated_at: new Date().toISOString() })
          .eq("id", proposalId);

        proposalPdfPath = autoPath;
        pdfAutoGenerated = true;
        console.log(`[contract-docs] [STEP 4] OK auto-generated FULL pdf_path=${autoPath}`);
      } catch (genErr) {
        console.error(`[contract-docs] [STEP 4] EXCEPTION auto-generation`, genErr);
        return errorResponse("proposal_pdf_auto_generation_failed", `Erro ao gerar PDF da proposta: ${genErr}`, 500, debug);
      }
    }

    debug.proposal_pdf_path_after = proposalPdfPath;
    debug.pdf_auto_generated = pdfAutoGenerated;

    // ── STEP 5: Create proposal snapshot ────────────────────
    console.log(`[contract-docs] [STEP 5] creating proposal snapshot...`);
    const snapshot = buildProposalSnapshot(proposal, servers, addons);
    debug.snapshot_created = true;

    // ── STEP 6: Download source PDF ─────────────────────────
    console.log(`[contract-docs] [STEP 6] downloading source pdf path=${proposalPdfPath}`);
    const { data: pdfFile, error: pdfDlErr } = await supabase.storage
      .from("proposal-files")
      .download(proposalPdfPath!);

    if (!pdfFile || pdfDlErr) {
      return errorResponse("proposal_pdf_file_not_found", `Arquivo PDF não encontrado no storage (path=${proposalPdfPath})`, 404, debug);
    }

    const proposalPdfBytes = new Uint8Array(await pdfFile.arrayBuffer());
    console.log(`[contract-docs] [STEP 6] OK downloaded size=${proposalPdfBytes.length}`);
    debug.source_pdf_exists = true;
    debug.source_pdf_size_bytes = proposalPdfBytes.length;

    // Validate PDF header
    const header = new TextDecoder().decode(proposalPdfBytes.slice(0, 5));
    if (!header.startsWith("%PDF")) {
      return errorResponse("proposal_pdf_invalid_format", `Arquivo não é PDF válido (header=${header})`, 422, debug);
    }

    // ── STEP 7: Generate Annex I PDF (ALWAYS via trim) ─────
    // Rule: Annex I = proposal PDF pages 8+, NEVER a synthetic summary
    const contractCode = contract.contract_number || contract.id.substring(0, 8).toUpperCase();
    const basePath = `contracts/${contract.id}`;
    let annexPdfPath: string | null = null;
    let annexGenerated = false;
    const generationStrategy = "proposal_pdf_trim";
    let annexPageCount = 0;

    const srcDoc = await PDFDocument.load(proposalPdfBytes);
    const totalPages = srcDoc.getPageCount();
    debug.source_pdf_page_count = totalPages;
    console.log(`[contract-docs] [STEP 7] proposal_pdf_path=${proposalPdfPath}`);
    console.log(`[contract-docs] [STEP 7] source_pdf_page_count=${totalPages} auto_generated=${pdfAutoGenerated}`);

    if (totalPages <= 7) {
      console.error(`[contract-docs] [STEP 7] BLOCKED: PDF has only ${totalPages} pages, need >7 for trim`);
      return errorResponse(
        "proposal_pdf_page_count_invalid",
        `O PDF da proposta possui apenas ${totalPages} páginas. São necessárias mais de 7 para gerar o Anexo I.`,
        422,
        { ...debug, source_pdf_page_count: totalPages }
      );
    }

    // ALWAYS trim pages 1-7, keep pages 8+
    console.log(`[contract-docs] [STEP 7] trim_started_from_page=8`);
    const { trimmedBytes, trimmedPageCount } = await trimProposalPdf(proposalPdfBytes);
    annexPageCount = trimmedPageCount;

    if (annexPageCount < 1) {
      return errorResponse("contract_annex_trim_empty", "O recorte do PDF resultou em zero páginas.", 500, debug);
    }

    console.log(`[contract-docs] [STEP 7] trimmed_pdf_page_count=${annexPageCount}`);

    const annexStoragePath = `${basePath}/anexo-i-${contractCode}.pdf`;
    const { error: annexUpErr } = await supabase.storage
      .from("contracts-generated")
      .upload(annexStoragePath, trimmedBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (annexUpErr) {
      return errorResponse("contract_annex_pdf_storage_failed", `Erro ao salvar Anexo I: ${annexUpErr.message}`, 500, debug);
    }

    annexPdfPath = annexStoragePath;
    annexGenerated = true;
    console.log(`[contract-docs] [STEP 7] OK annex saved (trimmed) path=${annexPdfPath} pages=${annexPageCount}`);

    debug.annex_generated = annexGenerated;
    debug.annex_pdf_path = annexPdfPath;
    debug.annex_page_count = annexPageCount;
    debug.generation_strategy = generationStrategy;

    // ── STEP 8: Generate DOCX ───────────────────────────────
    console.log(`[contract-docs] [STEP 8] generating DOCX...`);
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
        .from("contract_templates")
        .select("*")
        .eq("code", templateCode)
        .eq("is_active", true)
        .single();

      if (template) {
        const { data: templateFile, error: dlErr } = await supabase.storage
          .from(template.bucket)
          .download(template.path);

        if (templateFile && !dlErr) {
          const templateBytes = new Uint8Array(await templateFile.arrayBuffer());
          const mergedDocx = await mergeDocxTemplate(templateBytes, placeholders);

          const docxStoragePath = `${basePath}/contrato-${contractCode}.docx`;
          const { error: upErr } = await supabase.storage
            .from("contracts-generated")
            .upload(docxStoragePath, mergedDocx, {
              contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              upsert: true,
            });

          if (!upErr) {
            docxPath = docxStoragePath;
            docxGenerated = true;
            console.log(`[contract-docs] [STEP 8] OK docx_saved path=${docxPath}`);
          } else {
            console.error("[contract-docs] [STEP 8] FAILED docx_upload_error", upErr);
          }
        } else {
          console.warn(`[contract-docs] [STEP 8] template_file_not_found bucket=${template.bucket} path=${template.path}`);
        }
      } else {
        console.warn(`[contract-docs] [STEP 8] no_active_template code=${templateCode}`);
      }
    } catch (e) {
      console.error("[contract-docs] [STEP 8] EXCEPTION docx generation", e);
    }

    debug.contract_docx_generated = docxGenerated;
    debug.contract_docx_path = docxPath;

    // ── STEP 9: Validate completeness ───────────────────────
    if (!annexGenerated) {
      return errorResponse("contract_documents_incomplete", "Falha na geração do Anexo I. Documentos incompletos.", 500, debug);
    }

    // ── STEP 10: Update contract record with snapshot + paths
    console.log(`[contract-docs] [STEP 10] updating contract record with documents + snapshot...`);
    const updatePayload: Record<string, unknown> = {
      docx_path: docxPath,
      annex_pdf_path: annexPdfPath,
      proposal_pdf_source_path: proposalPdfPath,
      generation_strategy: generationStrategy,
      template_code: contract.template_code || "opdc-cloud-default",
      updated_at: new Date().toISOString(),
      // Store proposal snapshot so contract is independent of future proposal changes
      proposal_payload: snapshot,
      metadata: {
        ...(typeof contract.metadata === "object" && contract.metadata !== null ? contract.metadata : {}),
        document_generation: {
          generated_at: new Date().toISOString(),
          strategy: generationStrategy,
          pdf_auto_generated: pdfAutoGenerated,
          source_pdf_page_count: totalPages,
          annex_page_count: annexPageCount,
          docx_generated: docxGenerated,
          annex_generated: annexGenerated,
          snapshot_taken: true,
        },
      },
    };

    const { error: updateErr } = await supabase
      .from("contracts")
      .update(updatePayload)
      .eq("id", contract_id);

    if (updateErr) {
      console.error("[contract-docs] [STEP 10] FAILED contract_update_error", updateErr);
      debug.contract_updated = false;
    } else {
      console.log(`[contract-docs] [STEP 10] OK contract record updated with snapshot + document paths`);
      debug.contract_updated = true;
    }

    // ── STEP 11: Build response ─────────────────────────────
    const documents: Array<{ type: string; name: string; path: string }> = [];
    if (docxGenerated && docxPath) {
      documents.push({
        type: "contract_docx",
        name: "Contrato DOCX (modelo preenchido)",
        path: docxPath,
      });
    }
    documents.push({
      type: "annex_pdf",
      name: "Anexo I — Resumo da Proposta (PDF)",
      path: annexPdfPath!,
    });

    debug.documents_count = documents.length;
    debug.documents = documents;

    console.log(`[contract-docs] [STEP 11] COMPLETED strategy=${generationStrategy} docs=${documents.length}`);

    return json({
      success: true,
      contract_id,
      proposal_id: proposalId,
      generation_strategy: generationStrategy,
      snapshot_created: true,
      annex_generated: annexGenerated,
      contract_docx_generated: docxGenerated,
      docx_path: docxPath,
      annex_pdf_path: annexPdfPath,
      proposal_pdf_source_path: proposalPdfPath,
      pdf_auto_generated: pdfAutoGenerated,
      documents,
      debug,
    });

  } catch (err) {
    console.error("[contract-docs] UNHANDLED ERROR:", err);
    console.error("[contract-docs] error_stack:", (err as Error)?.stack);
    return errorResponse("internal_error", `Erro interno: ${err}`, 500, debug);
  }
});
