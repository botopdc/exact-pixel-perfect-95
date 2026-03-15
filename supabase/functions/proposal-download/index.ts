import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

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

/**
 * proposal-download — Serves existing pdf_path from storage.
 * 
 * IMPORTANT: This function does NOT generate PDFs.
 * PDF generation uses the calculator renderer (client-side pdfMake).
 * If pdf_path is missing, the client must generate it first.
 */
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
      .select("id, pdf_path, display_id")
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      console.error("[proposal-download] proposal_not_found:", proposalError?.message);
      return json({ success: false, error: "Proposta não encontrada" }, 404);
    }

    console.log("[proposal-download] proposal_id=", proposal.id);
    console.log("[proposal-download] pdf_path=", proposal.pdf_path);

    const proposalPdfPath = proposal.pdf_path || null;

    if (!proposalPdfPath) {
      // No alternative renderer — client must generate using calculator renderer
      console.log("[proposal-download] pdf_path missing — client must generate");
      return json({
        success: false,
        error: "pdf_not_generated",
        message: "PDF ainda não foi gerado. O sistema irá gerar automaticamente.",
      }, 404);
    }

    // Generate signed URL
    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from("proposal-files")
      .createSignedUrl(proposalPdfPath, 60 * 30);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("[proposal-download] signed_url_failed:", signedUrlError?.message);
      return json({ success: false, error: "Falha ao gerar link de download do PDF" }, 500);
    }

    console.log("[proposal-download] signed_url_generated=true");
    console.log("[proposal-download] generator=calculator_renderer (pre-generated)");

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
