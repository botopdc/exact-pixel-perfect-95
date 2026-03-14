import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";
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

function fmtCurrency(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

// ─── DOCX template merge ────────────────────────────────────
async function mergeDocxTemplate(
  templateBytes: Uint8Array,
  placeholders: Record<string, string>
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(templateBytes);

  // Process all XML files in the DOCX
  const xmlFiles = [
    "word/document.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/header3.xml",
    "word/footer1.xml",
    "word/footer2.xml",
    "word/footer3.xml",
  ];

  for (const path of xmlFiles) {
    const file = zip.file(path);
    if (!file) continue;

    let xml = await file.async("string");

    // Replace placeholders — handle Word splitting tags across runs
    for (const [key, value] of Object.entries(placeholders)) {
      const tag = `{{${key}}}`;
      // Direct replacement first
      xml = xml.split(tag).join(escapeXml(value));

      // Also try regex that handles Word splitting the placeholder across multiple <w:r> elements
      // Pattern: {{ may be split as {{, key, }} across runs
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── Annex I PDF generation from structured data ────────────
async function generateAnnexPdf(
  contract: any,
  servers: any[],
  addons: any[],
  currency: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    size = 10,
    bold = false
  ) => {
    page.drawText(text, {
      x,
      y: yPos,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
  };

  const drawLine = (yPos: number) => {
    page.drawLine({
      start: { x: margin, y: yPos },
      end: { x: pageWidth - margin, y: yPos },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
  };

  const checkNewPage = () => {
    if (y < margin + 60) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  // Title
  drawText("ANEXO I — RESUMO DA PROPOSTA", margin, y, 16, true);
  y -= 30;
  drawLine(y);
  y -= 20;

  // Client info
  drawText("IDENTIFICAÇÃO DO CLIENTE", margin, y, 11, true);
  y -= 18;
  const clientInfo = [
    ["Cliente:", contract.client_name || ""],
    ["Empresa:", contract.company || ""],
    ["E-mail:", contract.email || ""],
    ["Telefone:", contract.phone || ""],
    ["CNPJ:", contract.has_no_cnpj ? "Isento" : (contract.cnpj || "—")],
  ];
  for (const [label, value] of clientInfo) {
    drawText(label, margin, y, 9, true);
    drawText(value, margin + 70, y, 9);
    y -= 15;
  }
  y -= 10;

  // Proposal info
  drawText("DADOS DA PROPOSTA", margin, y, 11, true);
  y -= 18;
  const proposalInfo = [
    ["Proposta:", contract.proposal_uuid || contract.proposal_id?.substring(0, 8) || ""],
    ["Datacenter:", contract.datacenter || "—"],
    ["Vigência:", `${contract.contract_duration || 12} meses`],
    ["Ciclo:", contract.billing_cycle || "mensal"],
    ["Data contrato:", dateShort(contract.contract_date)],
  ];
  for (const [label, value] of proposalInfo) {
    drawText(label, margin, y, 9, true);
    drawText(value, margin + 90, y, 9);
    y -= 15;
  }
  y -= 10;
  drawLine(y);
  y -= 20;

  // Items table
  drawText("ITENS CONTRATADOS", margin, y, 11, true);
  y -= 20;

  // Table header
  const colX = [margin, margin + 180, margin + 260, margin + 320, margin + 380, margin + 440];
  const headers = ["Item", "Tipo", "vCPU", "RAM", "Qtd", "Valor/mês"];
  headers.forEach((h, i) => drawText(h, colX[i], y, 8, true));
  y -= 5;
  drawLine(y);
  y -= 15;

  // Server rows
  for (const s of servers) {
    checkNewPage();
    const name = s.name || "Servidor";
    const type = s.server_type || s.type || "vm";
    const vcpu = String(s.vcpu || 0);
    const ram = `${s.ram_gb || 0} GB`;
    const qty = String(s.qty_servers || 1);
    const price = fmtCurrency(s.total_price || 0, currency);

    drawText(name.substring(0, 28), colX[0], y, 8);
    drawText(type.toUpperCase(), colX[1], y, 8);
    drawText(vcpu, colX[2], y, 8);
    drawText(ram, colX[3], y, 8);
    drawText(qty, colX[4], y, 8);
    drawText(price, colX[5], y, 8);
    y -= 14;
  }

  // Addons
  const enabledAddons = addons.filter((a) => a.enabled);
  if (enabledAddons.length > 0) {
    y -= 5;
    drawLine(y);
    y -= 15;
    drawText("ADD-ONS", margin, y, 9, true);
    y -= 15;
    for (const a of enabledAddons) {
      checkNewPage();
      drawText(`${a.label} × ${a.quantity}`, colX[0], y, 8);
      drawText(fmtCurrency(a.total_price || 0, currency), colX[5], y, 8);
      y -= 14;
    }
  }

  // Total
  y -= 10;
  drawLine(y);
  y -= 20;
  drawText("TOTAL MENSAL:", margin, y, 12, true);
  drawText(fmtCurrency(contract.total || 0, currency), colX[5] - 20, y, 12, true);
  y -= 30;

  // Footer
  drawLine(y);
  y -= 15;
  drawText(
    `Documento gerado automaticamente em ${new Date().toLocaleDateString("pt-BR")}`,
    margin,
    y,
    7
  );

  return doc.save();
}

// ─── Fallback: trim proposal PDF (remove pages 1-7) ────────
async function trimProposalPdf(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();

  if (totalPages <= 7) {
    // If 7 or fewer pages, return as-is (nothing to trim)
    return pdfBytes;
  }

  const newDoc = await PDFDocument.create();
  // Copy pages 8+ (index 7+)
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

    // 2. Load proposal servers + addons
    const proposalId = contract.proposal_id;
    const [serversRes, addonsRes] = await Promise.all([
      supabase
        .from("calculator_proposal_servers")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("sort_order"),
      supabase
        .from("calculator_proposal_addons")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("sort_order"),
    ]);

    const servers = serversRes.data || [];
    const addons = addonsRes.data || [];

    console.log("[contract-generate-document] Loaded:", {
      servers: servers.length,
      addons: addons.length,
    });

    const contractCode = contract.contract_number || contract.id.substring(0, 8).toUpperCase();
    const basePath = `contracts/${contract.id}`;

    // 3. Build placeholders for DOCX merge
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
    let generationStrategy = "structured";

    // 4. Try DOCX template merge
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
        console.warn("[contract-generate-document] Template not found in storage, skipping DOCX merge");
      }
    }

    // 5. Generate Annex I PDF from structured data (PRIMARY strategy)
    const annexBytes = await generateAnnexPdf(contract, servers, addons, contract.currency || "BRL");
    const annexStoragePath = `${basePath}/anexo-i-${contractCode}.pdf`;

    const { error: annexUpErr } = await supabase.storage
      .from("contracts-generated")
      .upload(annexStoragePath, annexBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    let annexPdfPath: string | null = null;
    if (!annexUpErr) {
      annexPdfPath = annexStoragePath;
      console.log("[contract-generate-document] Annex I PDF saved:", annexPdfPath);
    } else {
      console.error("[contract-generate-document] Annex upload error:", annexUpErr);
    }

    // 6. Fallback: If proposal has existing PDF, also create trimmed version
    let proposalPdfSourcePath: string | null = null;
    const { data: proposalRow } = await supabase
      .from("calculator_proposals")
      .select("pdf_path")
      .eq("id", proposalId)
      .single();

    if (proposalRow?.pdf_path) {
      const { data: proposalPdfFile } = await supabase.storage
        .from("proposal-files")
        .download(proposalRow.pdf_path);

      if (proposalPdfFile) {
        try {
          const proposalPdfBytes = new Uint8Array(await proposalPdfFile.arrayBuffer());
          const trimmedBytes = await trimProposalPdf(proposalPdfBytes);
          const trimmedPath = `${basePath}/anexo-i-fallback-${contractCode}.pdf`;

          const { error: trimUpErr } = await supabase.storage
            .from("contracts-generated")
            .upload(trimmedPath, trimmedBytes, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (!trimUpErr) {
            proposalPdfSourcePath = trimmedPath;
            generationStrategy = "structured+fallback";
            console.log("[contract-generate-document] Fallback PDF saved:", trimmedPath);
          }
        } catch (e) {
          console.warn("[contract-generate-document] Fallback PDF trim failed:", e);
        }
      }
    }

    // 7. Update contract record with file paths
    const { error: updateErr } = await supabase
      .from("contracts")
      .update({
        docx_path: docxPath,
        annex_pdf_path: annexPdfPath,
        proposal_pdf_source_path: proposalPdfSourcePath,
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
      proposal_pdf_source_path: proposalPdfSourcePath,
      generation_strategy: generationStrategy,
    });
  } catch (err) {
    console.error("[contract-generate-document] Error:", err);
    return json({ success: false, error: String(err) }, 500);
  }
});
