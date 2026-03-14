import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import JSZip from "npm:jszip@3.10.1";

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

  if (totalPages <= 7) {
    throw new Error("contract_annex_invalid_pdf_page_count");
  }

  const newDoc = await PDFDocument.create();
  // Pages are zero-indexed: page 8 = index 7
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
      return json({ success: false, error: "contract_id is required" }, 400);
    }

    console.log("[contract-generate-document] Starting for:", contract_id);

    // 1. Load contract
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", contract_id)
      .is("deleted_at", null)
      .single();

    if (cErr || !contract) {
      return json({ success: false, error: "Contrato não encontrado" }, 404);
    }

    // 2. Validate proposal_id
    const proposalId = contract.proposal_id;
    if (!proposalId) {
      return json({ success: false, error: "contract_without_proposal_id" }, 400);
    }

    // 3. Load proposal
    const { data: proposal, error: pErr } = await supabase
      .from("calculator_proposals")
      .select("id, pdf_path, display_id")
      .eq("id", proposalId)
      .single();

    if (pErr || !proposal) {
      return json({ success: false, error: "proposal_not_found" }, 404);
    }

    const contractCode = contract.contract_number || contract.id.substring(0, 8).toUpperCase();
    const basePath = `contracts/${contract.id}`;

    // ── 4. DOCX template merge ──────────────────────────────
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

    let docxPath: string | null = null;

    const templateCode = contract.template_code || "opdc-cloud-default";
    const { data: template } = await supabase
      .from("contract_templates")
      .select("*")
      .eq("code", templateCode)
      .eq("is_active", true)
      .single();

    if (template) {
      console.log("[contract-generate-document] Loading template:", template.path);
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
          console.log("[contract-generate-document] DOCX saved:", docxPath);
        } else {
          console.error("[contract-generate-document] DOCX upload error:", upErr);
        }
      } else {
        console.warn("[contract-generate-document] Template not found in storage");
      }
    }

    // ── 5. Annex I — Trim proposal PDF (pages 1-7 removed) ──
    let annexPdfPath: string | null = null;
    const generationStrategy = "proposal_pdf_trim";

    if (!proposal.pdf_path) {
      console.warn("[contract-generate-document] contract_annex_source_pdf_not_found — proposal has no pdf_path");
      return json({
        success: false,
        error: "contract_annex_source_pdf_not_found",
        detail: "A proposta vinculada não possui PDF oficial gerado. Gere o PDF da proposta antes de gerar o contrato.",
      }, 400);
    }

    console.log("[contract-generate-document] Downloading proposal PDF:", proposal.pdf_path);
    const { data: proposalPdfFile, error: pdfDlErr } = await supabase.storage
      .from("proposal-files")
      .download(proposal.pdf_path);

    if (!proposalPdfFile || pdfDlErr) {
      console.error("[contract-generate-document] Failed to download proposal PDF:", pdfDlErr);
      return json({
        success: false,
        error: "contract_annex_source_pdf_not_found",
        detail: "Não foi possível baixar o PDF oficial da proposta.",
      }, 400);
    }

    const proposalPdfBytes = new Uint8Array(await proposalPdfFile.arrayBuffer());

    let trimmedBytes: Uint8Array;
    try {
      trimmedBytes = await trimProposalPdf(proposalPdfBytes);
    } catch (trimErr) {
      const errMsg = String(trimErr);
      if (errMsg.includes("contract_annex_invalid_pdf_page_count")) {
        return json({
          success: false,
          error: "contract_annex_invalid_pdf_page_count",
          detail: "O PDF da proposta possui 7 ou menos páginas, impossível gerar o Anexo I.",
        }, 400);
      }
      throw trimErr;
    }

    const annexStoragePath = `${basePath}/anexo-i-${contractCode}.pdf`;
    const { error: annexUpErr } = await supabase.storage
      .from("contracts-generated")
      .upload(annexStoragePath, trimmedBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (!annexUpErr) {
      annexPdfPath = annexStoragePath;
      console.log("[contract-generate-document] Annex I PDF saved:", annexPdfPath);
    } else {
      console.error("[contract-generate-document] Annex upload error:", annexUpErr);
    }

    // ── 6. Update contract record ───────────────────────────
    const { error: updateErr } = await supabase
      .from("contracts")
      .update({
        docx_path: docxPath,
        annex_pdf_path: annexPdfPath,
        proposal_pdf_source_path: proposal.pdf_path,
        generation_strategy: generationStrategy,
        template_code: templateCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contract_id);

    if (updateErr) {
      console.error("[contract-generate-document] Update error:", updateErr);
    }

    return json({
      success: true,
      contract_id,
      docx_path: docxPath,
      annex_pdf_path: annexPdfPath,
      proposal_pdf_source_path: proposal.pdf_path,
      generation_strategy: generationStrategy,
    });
  } catch (err) {
    console.error("[contract-generate-document] Error:", err);
    return json({ success: false, error: String(err) }, 500);
  }
});
