// ============================================================================
// EDGE FUNCTION: contract-generate-document
// Generates Contract DOCX + Annex I PDF from proposal
// Strategy: proposal_pdf_trim — uses the calculator-generated PDF as source
// IMPORTANT: Does NOT generate PDFs. Uses existing pdf_path only.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
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
    debug.proposal_pdf_path = proposal.pdf_path;

    // ── STEP 3: Load servers & addons ────────────────────────
    const [serversRes, addonsRes] = await Promise.all([
      supabase.from("calculator_proposal_servers").select("*").eq("proposal_id", proposalId).order("sort_order"),
      supabase.from("calculator_proposal_addons").select("*").eq("proposal_id", proposalId).order("sort_order"),
    ]);
    const servers = serversRes.data || [];
    const addons = addonsRes.data || [];
    debug.servers_count = servers.length;
    debug.addons_count = addons.length;

    // ── STEP 4: Resolve proposal PDF (NO alternative renderer) ──
    let proposalPdfPath = proposal.pdf_path || null;

    if (!proposalPdfPath) {
      // Check calculator_proposal_files as fallback
      const { data: existingFiles } = await supabase
        .from("calculator_proposal_files").select("file_path, file_type")
        .eq("proposal_id", proposalId).eq("file_type", "application/pdf").limit(1);

      if (existingFiles && existingFiles.length > 0) {
        proposalPdfPath = existingFiles[0].file_path;
      }
    }

    if (!proposalPdfPath) {
      console.error("[contract-docs] pdf_path missing — calculator must generate PDF first");
      console.error("[proposal-pdf] invalid_alternative_renderer_used=false (blocked)");
      return errorResponse(
        "proposal_pdf_not_generated",
        "O PDF da proposta ainda não foi gerado. Abra a proposta na calculadora e salve para gerar o PDF oficial.",
        422,
        debug
      );
    }

    console.log("[proposal-pdf] proposal_id=", proposal.id);
    console.log("[proposal-pdf] source=", "contract");
    console.log("[proposal-pdf] reused_existing_pdf=", true);
    console.log("[proposal-pdf] generator=", "calculator_renderer");
    console.log("[proposal-pdf] saved_pdf_path=", proposalPdfPath);

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
      documents,
      debug,
    });

  } catch (err) {
    console.error("[contract-docs] UNHANDLED ERROR:", err);
    return errorResponse("internal_error", `Erro interno: ${err}`, 500, debug);
  }
});
