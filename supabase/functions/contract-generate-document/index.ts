import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

// ─── Helpers ────────────────────────────────────────────────
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

  console.log(`[contract-docs] [STEP 5] source_pdf_page_count=${totalPages}`);

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
  const trimmedPageCount = copiedPages.length;
  console.log(`[contract-docs] [STEP 5] trimmed_pdf_page_count=${trimmedPageCount}`);
  return { trimmedBytes: new Uint8Array(trimmedBytes), trimmedPageCount };
}

// ─── Main handler ────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Debug object accumulated throughout the flow
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
    console.log(`[contract-docs] [STEP 1] loading contract_id=${contract_id}`);

    // ── STEP 1: Load contract ───────────────────────────────
    let contract: any;
    try {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", contract_id)
        .is("deleted_at", null)
        .single();

      if (error || !data) {
        console.error("[contract-docs] [STEP 1] FAILED contract_load_error", error);
        return errorResponse("contract_not_found", "Contrato não encontrado.", 404, debug);
      }
      contract = data;
      console.log(`[contract-docs] [STEP 1] OK contract loaded`);
    } catch (e) {
      console.error("[contract-docs] [STEP 1] EXCEPTION", e);
      return errorResponse("contract_load_failed", `Erro ao carregar contrato: ${e}`, 500, debug);
    }

    // ── STEP 2: Validate & load proposal ────────────────────
    const proposalId = contract.proposal_id;
    debug.proposal_id = proposalId;
    console.log(`[contract-docs] [STEP 2] proposal_id=${proposalId}`);

    if (!proposalId) {
      console.error("[contract-docs] [STEP 2] FAILED contract_without_proposal_id");
      return errorResponse(
        "contract_without_proposal_id",
        "Contrato sem proposta vinculada (proposal_id).",
        400,
        debug
      );
    }

    let proposal: any;
    try {
      const { data, error } = await supabase
        .from("calculator_proposals")
        .select("id, pdf_path, display_id")
        .eq("id", proposalId)
        .single();

      if (error || !data) {
        console.error("[contract-docs] [STEP 2] FAILED proposal_not_found", error);
        return errorResponse("proposal_not_found", "Proposta vinculada não encontrada.", 404, debug);
      }
      proposal = data;
      console.log(`[contract-docs] [STEP 2] OK proposal loaded display_id=${proposal.display_id}`);
    } catch (e) {
      console.error("[contract-docs] [STEP 2] EXCEPTION", e);
      return errorResponse("proposal_load_failed", `Erro ao carregar proposta: ${e}`, 500, debug);
    }

    debug.proposal_display_id = proposal.display_id;
    debug.source_pdf_path = proposal.pdf_path;
    console.log(`[contract-docs] [STEP 3] source_pdf_path=${proposal.pdf_path}`);

    const contractCode = contract.contract_number || contract.id.substring(0, 8).toUpperCase();
    const basePath = `contracts/${contract.id}`;

    // ── STEP 7: DOCX template merge ─────────────────────────
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
        console.log(`[contract-docs] [STEP 7] loading_template code=${templateCode} path=${template.path}`);
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
            console.log(`[contract-docs] [STEP 7] OK docx_saved path=${docxPath}`);
          } else {
            console.error("[contract-docs] [STEP 7] FAILED docx_upload_error", upErr);
          }
        } else {
          console.warn(`[contract-docs] [STEP 7] template_file_not_found bucket=${template.bucket} path=${template.path}`, dlErr);
        }
      } else {
        console.warn(`[contract-docs] [STEP 7] no_active_template code=${templateCode}`);
      }
    } catch (e) {
      console.error("[contract-docs] [STEP 7] EXCEPTION docx generation", e);
      // DOCX failure is non-fatal — continue to annex
    }

    debug.contract_docx_generated = docxGenerated;
    debug.contract_docx_path = docxPath;

    // ── STEP 3-6: Annex I PDF flow ──────────────────────────
    let annexPdfPath: string | null = null;
    let annexGenerated = false;
    let annexSkipReason: string | null = null;
    const generationStrategy = "proposal_pdf_trim";

    // STEP 3: Validate source pdf path
    if (!proposal.pdf_path) {
      annexSkipReason = "proposal_pdf_path_missing: A proposta vinculada não possui PDF oficial gerado (pdf_path=null). Gere o PDF da proposta antes.";
      console.warn(`[contract-docs] [STEP 3] SKIPPED source_pdf_path is null/empty`);
      debug.source_pdf_exists = false;
      debug.annex_skip_reason = annexSkipReason;
    } else {
      // STEP 4: Download source PDF
      console.log(`[contract-docs] [STEP 4] downloading source pdf path=${proposal.pdf_path}`);
      let proposalPdfBytes: Uint8Array | null = null;

      try {
        const { data: pdfFile, error: pdfDlErr } = await supabase.storage
          .from("proposal-files")
          .download(proposal.pdf_path);

        if (!pdfFile || pdfDlErr) {
          annexSkipReason = `proposal_pdf_file_not_found: Arquivo não encontrado no storage (path=${proposal.pdf_path})`;
          console.error(`[contract-docs] [STEP 4] FAILED pdf_download_error`, pdfDlErr);
          debug.source_pdf_exists = false;
          debug.annex_skip_reason = annexSkipReason;
        } else {
          proposalPdfBytes = new Uint8Array(await pdfFile.arrayBuffer());
          console.log(`[contract-docs] [STEP 4] OK source pdf downloaded size=${proposalPdfBytes.length}`);
          debug.source_pdf_exists = true;
          debug.source_pdf_size_bytes = proposalPdfBytes.length;

          // Validate PDF header
          const header = new TextDecoder().decode(proposalPdfBytes.slice(0, 5));
          if (!header.startsWith("%PDF")) {
            annexSkipReason = `proposal_pdf_invalid_format: Arquivo não é PDF válido (header=${header})`;
            console.error(`[contract-docs] [STEP 4] FAILED file_is_not_pdf header=${header}`);
            debug.source_pdf_valid = false;
            debug.annex_skip_reason = annexSkipReason;
            proposalPdfBytes = null;
          } else {
            debug.source_pdf_valid = true;
          }
        }
      } catch (e) {
        annexSkipReason = `proposal_pdf_download_exception: ${e}`;
        console.error("[contract-docs] [STEP 4] EXCEPTION", e);
        debug.source_pdf_exists = false;
        debug.annex_skip_reason = annexSkipReason;
      }

      // STEP 5: Trim PDF
      if (proposalPdfBytes) {
        try {
          console.log(`[contract-docs] [STEP 5] trimming pdf...`);
          const { trimmedBytes, trimmedPageCount } = await trimProposalPdf(proposalPdfBytes);
          debug.source_pdf_page_count = trimmedPageCount + 7;
          debug.trimmed_pdf_page_count = trimmedPageCount;

          // STEP 6: Save annex PDF
          console.log(`[contract-docs] [STEP 6] saving annex pdf...`);
          const annexStoragePath = `${basePath}/anexo-i-${contractCode}.pdf`;
          debug.annex_storage_path = annexStoragePath;

          const { error: annexUpErr } = await supabase.storage
            .from("contracts-generated")
            .upload(annexStoragePath, trimmedBytes, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (annexUpErr) {
            annexSkipReason = `annex_upload_failed: ${annexUpErr.message}`;
            console.error(`[contract-docs] [STEP 6] FAILED annex_upload_error`, annexUpErr);
            debug.annex_saved = false;
            debug.annex_skip_reason = annexSkipReason;
          } else {
            annexPdfPath = annexStoragePath;
            annexGenerated = true;
            console.log(`[contract-docs] [STEP 6] OK annex_saved path=${annexPdfPath}`);
            debug.annex_saved = true;
          }
        } catch (trimErr) {
          const errMsg = String(trimErr);
          if (errMsg.includes("proposal_pdf_page_count_invalid")) {
            annexSkipReason = "proposal_pdf_page_count_invalid: O PDF da proposta possui 7 ou menos páginas.";
            debug.annex_skip_reason = annexSkipReason;
          } else {
            annexSkipReason = `proposal_pdf_trim_failed: ${trimErr}`;
            debug.annex_skip_reason = annexSkipReason;
          }
          console.error(`[contract-docs] [STEP 5] FAILED trim error`, trimErr);
          debug.annex_saved = false;
        }
      }
    }

    debug.annex_generated = annexGenerated;
    debug.annex_pdf_path = annexPdfPath;

    // ── STEP 8: Update contract record ──────────────────────
    console.log(`[contract-docs] [STEP 8] updating contract record...`);
    const templateCode = contract.template_code || "opdc-cloud-default";
    try {
      const updatePayload = {
        docx_path: docxPath,
        annex_pdf_path: annexPdfPath,
        proposal_pdf_source_path: proposal.pdf_path,
        generation_strategy: generationStrategy,
        template_code: templateCode,
        updated_at: new Date().toISOString(),
      };
      debug.contract_update_payload = updatePayload;

      const { error } = await supabase
        .from("contracts")
        .update(updatePayload)
        .eq("id", contract_id);

      if (error) {
        console.error("[contract-docs] [STEP 8] FAILED contract_update_error", error);
        debug.contract_updated = false;
      } else {
        console.log(`[contract-docs] [STEP 8] OK contract_record_updated`);
        debug.contract_updated = true;
      }
    } catch (e) {
      console.error("[contract-docs] [STEP 8] EXCEPTION", e);
      debug.contract_updated = false;
    }

    // ── STEP 9: Build response documents ────────────────────
    const documents: Array<{ type: string; name: string; path: string }> = [];
    if (docxGenerated && docxPath) {
      documents.push({
        type: "contract_docx",
        name: "Contrato DOCX (modelo preenchido)",
        path: docxPath,
      });
    }
    if (annexGenerated && annexPdfPath) {
      documents.push({
        type: "annex_pdf",
        name: "Anexo I — Resumo da Proposta (PDF)",
        path: annexPdfPath,
      });
    }

    debug.documents_count = documents.length;
    debug.documents = documents;
    console.log(`[contract-docs] [STEP 9] response documents_count=${documents.length} docx=${docxGenerated} annex=${annexGenerated}`);
    console.log(`[contract-docs] [STEP 9] debug=`, JSON.stringify(debug));

    const responsePayload = {
      success: true,
      contract_id,
      proposal_id: proposalId,
      annex_strategy: generationStrategy,
      annex_generated: annexGenerated,
      annex_skip_reason: annexSkipReason,
      contract_docx_generated: docxGenerated,
      docx_path: docxPath,
      annex_pdf_path: annexPdfPath,
      proposal_pdf_source_path: proposal.pdf_path,
      documents,
      debug,
    };

    console.log(`[contract-docs] [STEP 9] COMPLETED`);
    return json(responsePayload);

  } catch (err) {
    console.error("[contract-docs] UNHANDLED_ERROR", err);
    console.error("[contract-docs] error_message=", (err as Error)?.message);
    console.error("[contract-docs] error_stack=", (err as Error)?.stack);
    return errorResponse("internal_error", `Erro interno inesperado: ${err}`, 500, debug);
  }
});
