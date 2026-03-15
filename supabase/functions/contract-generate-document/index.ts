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

// ─── Structured JSON response ───────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errorResponse(code: string, message: string, status: number) {
  console.error(`[contract-docs] ERROR code=${code} message=${message}`);
  return json({ success: false, code, message }, status);
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
async function trimProposalPdf(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();

  console.log(`[contract-docs] pdf_page_count=${totalPages}`);

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

  return newDoc.save();
}

// ─── Main handler ────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    console.log(`[contract-docs] contract_id=${contract_id}`);

    // ── Step 1: Load contract ───────────────────────────────
    let contract: any;
    try {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", contract_id)
        .is("deleted_at", null)
        .single();

      if (error || !data) {
        console.error("[contract-docs] contract_load_error", error);
        return errorResponse("contract_not_found", "Contrato não encontrado.", 404);
      }
      contract = data;
    } catch (e) {
      console.error("[contract-docs] step1_exception", e);
      return errorResponse("contract_load_failed", `Erro ao carregar contrato: ${e}`, 500);
    }

    // ── Step 2: Validate proposal_id ────────────────────────
    const proposalId = contract.proposal_id;
    console.log(`[contract-docs] proposal_id=${proposalId}`);

    if (!proposalId) {
      return errorResponse(
        "contract_without_proposal_id",
        "Contrato sem proposta vinculada (proposal_id).",
        400
      );
    }

    // ── Step 3: Load proposal ───────────────────────────────
    let proposal: any;
    try {
      const { data, error } = await supabase
        .from("calculator_proposals")
        .select("id, pdf_path, display_id")
        .eq("id", proposalId)
        .single();

      if (error || !data) {
        console.error("[contract-docs] proposal_load_error", error);
        return errorResponse("proposal_not_found", "Proposta vinculada não encontrada.", 404);
      }
      proposal = data;
    } catch (e) {
      console.error("[contract-docs] step3_exception", e);
      return errorResponse("proposal_load_failed", `Erro ao carregar proposta: ${e}`, 500);
    }

    console.log(`[contract-docs] proposal_display_id=${proposal.display_id}`);
    console.log(`[contract-docs] proposal_pdf_path=${proposal.pdf_path}`);

    const contractCode = contract.contract_number || contract.id.substring(0, 8).toUpperCase();
    const basePath = `contracts/${contract.id}`;

    // ── Step 4: DOCX template merge ─────────────────────────
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
        console.log(`[contract-docs] loading_template code=${templateCode} path=${template.path}`);
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
            console.log(`[contract-docs] docx_saved path=${docxPath}`);
          } else {
            console.error("[contract-docs] docx_upload_error", upErr);
          }
        } else {
          console.warn(`[contract-docs] template_file_not_found bucket=${template.bucket} path=${template.path}`, dlErr);
        }
      } else {
        console.warn(`[contract-docs] no_active_template code=${templateCode}`);
      }
    } catch (e) {
      console.error("[contract-docs] step4_docx_exception", e);
      // DOCX failure is non-fatal — continue to annex
    }

    // ── Step 5: Validate proposal pdf_path ──────────────────
    let annexPdfPath: string | null = null;
    let annexGenerated = false;
    const generationStrategy = "proposal_pdf_trim";

    if (!proposal.pdf_path) {
      console.warn("[contract-docs] proposal_pdf_path_missing");
      // Annex cannot be generated but we still return success for DOCX
      // Update contract with whatever we have
      await updateContractRecord(supabase, contract_id, docxPath, null, null, generationStrategy, contract.template_code || "opdc-cloud-default");

      return json({
        success: true,
        contract_id,
        proposal_id: proposalId,
        annex_strategy: generationStrategy,
        annex_generated: false,
        annex_skip_reason: "A proposta vinculada não possui PDF oficial gerado. Gere o PDF da proposta antes.",
        contract_docx_generated: docxGenerated,
        docx_path: docxPath,
        annex_pdf_path: null,
      });
    }

    // ── Step 6: Download source PDF from storage ────────────
    let proposalPdfBytes: Uint8Array;
    try {
      console.log(`[contract-docs] downloading_pdf path=${proposal.pdf_path}`);
      const { data: pdfFile, error: pdfDlErr } = await supabase.storage
        .from("proposal-files")
        .download(proposal.pdf_path);

      if (!pdfFile || pdfDlErr) {
        console.error("[contract-docs] pdf_download_error", pdfDlErr);
        return errorResponse(
          "proposal_pdf_file_not_found",
          "PDF oficial da proposta não foi encontrado no storage.",
          404
        );
      }

      proposalPdfBytes = new Uint8Array(await pdfFile.arrayBuffer());
      console.log(`[contract-docs] pdf_downloaded size=${proposalPdfBytes.length}`);

      // Validate it's actually a PDF (starts with %PDF)
      const header = new TextDecoder().decode(proposalPdfBytes.slice(0, 5));
      if (!header.startsWith("%PDF")) {
        console.error(`[contract-docs] file_is_not_pdf header=${header}`);
        return errorResponse(
          "proposal_pdf_invalid_format",
          "O arquivo vinculado à proposta não é um PDF válido. Regenere o PDF da proposta.",
          422
        );
      }
    } catch (e) {
      console.error("[contract-docs] step6_download_exception", e);
      return errorResponse(
        "proposal_pdf_download_failed",
        `Erro ao baixar PDF da proposta: ${e}`,
        500
      );
    }

    // ── Step 7: Inspect page count & trim ───────────────────
    let trimmedBytes: Uint8Array;
    try {
      trimmedBytes = await trimProposalPdf(proposalPdfBytes);
      console.log(`[contract-docs] pdf_trimmed size=${trimmedBytes.length}`);
    } catch (trimErr) {
      const errMsg = String(trimErr);
      if (errMsg.includes("proposal_pdf_page_count_invalid")) {
        return errorResponse(
          "proposal_pdf_page_count_invalid",
          "O PDF da proposta possui 7 ou menos páginas. Impossível gerar Anexo I por recorte.",
          422
        );
      }
      console.error("[contract-docs] step7_trim_exception", trimErr);
      return errorResponse(
        "proposal_pdf_trim_failed",
        `Erro ao processar PDF da proposta: ${trimErr}`,
        500
      );
    }

    // ── Step 8: Save annex PDF ──────────────────────────────
    try {
      const annexStoragePath = `${basePath}/anexo-i-${contractCode}.pdf`;
      const { error: annexUpErr } = await supabase.storage
        .from("contracts-generated")
        .upload(annexStoragePath, trimmedBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (annexUpErr) {
        console.error("[contract-docs] annex_upload_error", annexUpErr);
        return errorResponse(
          "annex_upload_failed",
          `Erro ao salvar Anexo I no storage: ${annexUpErr.message}`,
          500
        );
      }

      annexPdfPath = annexStoragePath;
      annexGenerated = true;
      console.log(`[contract-docs] annex_saved path=${annexPdfPath}`);
    } catch (e) {
      console.error("[contract-docs] step8_save_exception", e);
      return errorResponse("annex_save_failed", `Erro ao salvar Anexo I: ${e}`, 500);
    }

    // ── Step 9: Update contract record ──────────────────────
    const templateCode = contract.template_code || "opdc-cloud-default";
    await updateContractRecord(supabase, contract_id, docxPath, annexPdfPath, proposal.pdf_path, generationStrategy, templateCode);

    console.log(`[contract-docs] completed contract_id=${contract_id} docx=${docxGenerated} annex=${annexGenerated}`);

    return json({
      success: true,
      contract_id,
      proposal_id: proposalId,
      annex_strategy: generationStrategy,
      annex_generated: annexGenerated,
      contract_docx_generated: docxGenerated,
      docx_path: docxPath,
      annex_pdf_path: annexPdfPath,
      proposal_pdf_source_path: proposal.pdf_path,
    });
  } catch (err) {
    console.error("[contract-docs] unhandled_error", err);
    return errorResponse(
      "internal_error",
      `Erro interno inesperado: ${err}`,
      500
    );
  }
});

// ─── Helper: update contract record ─────────────────────────
async function updateContractRecord(
  supabase: any,
  contractId: string,
  docxPath: string | null,
  annexPdfPath: string | null,
  proposalPdfSourcePath: string | null,
  generationStrategy: string,
  templateCode: string,
) {
  try {
    const { error } = await supabase
      .from("contracts")
      .update({
        docx_path: docxPath,
        annex_pdf_path: annexPdfPath,
        proposal_pdf_source_path: proposalPdfSourcePath,
        generation_strategy: generationStrategy,
        template_code: templateCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId);

    if (error) {
      console.error("[contract-docs] contract_update_error", error);
    } else {
      console.log(`[contract-docs] contract_record_updated id=${contractId}`);
    }
  } catch (e) {
    console.error("[contract-docs] step9_update_exception", e);
  }
}
