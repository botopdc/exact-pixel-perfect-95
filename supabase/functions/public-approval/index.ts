import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

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
    const { action } = body as { action?: string };

    // =========================================================================
    // ACTION: load — Load proposal by approval token
    // =========================================================================
    if (action === "load") {
      const { token } = body as { token?: string };
      if (!token || token.trim() === "") {
        return json({ success: false, errorCode: "token_missing" }, 400);
      }

      const { data: proposal, error: fetchErr } = await supabase
        .from("calculator_proposals")
        .select("*")
        .eq("approval_token", token.trim())
        .maybeSingle();

      if (fetchErr) {
        console.error("[public-approval] fetch error:", fetchErr);
        return json({ success: false, errorCode: "unknown" }, 500);
      }
      if (!proposal) {
        return json({ success: false, errorCode: "token_invalid" }, 404);
      }

      // Check expiration
      if (proposal.approval_token_expires_at) {
        const expiresAt = new Date(proposal.approval_token_expires_at);
        if (expiresAt <= new Date()) {
          return json({ success: false, errorCode: "token_expired" }, 410);
        }
      }

      // Load servers + addons
      const [serversRes, addonsRes] = await Promise.all([
        supabase
          .from("calculator_proposal_servers")
          .select("*")
          .eq("proposal_id", proposal.id)
          .order("sort_order"),
        supabase
          .from("calculator_proposal_addons")
          .select("*")
          .eq("proposal_id", proposal.id)
          .order("sort_order"),
      ]);

      // PDF signed URL
      let pdfSignedUrl: string | null = null;
      if (proposal.pdf_path) {
        const { data: urlData } = await supabase.storage
          .from("proposal-files")
          .createSignedUrl(proposal.pdf_path, 60 * 30);
        pdfSignedUrl = urlData?.signedUrl ?? null;
      }

      return json({
        success: true,
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
          pdf_path: proposal.pdf_path,
          approval_decision: proposal.approval_decision,
          approved_at: proposal.approved_at,
          rejected_at: proposal.rejected_at,
        },
        servers: serversRes.data || [],
        addons: addonsRes.data || [],
        pdfSignedUrl,
      });
    }

    // =========================================================================
    // ACTION: decide — Record accept/reject decision
    // =========================================================================
    if (action === "decide") {
      const { token, decision, name, email, notes } = body as {
        token?: string;
        decision?: string;
        name?: string;
        email?: string;
        notes?: string;
      };

      if (!token || !decision) {
        return json({ success: false, error: "token and decision required" }, 400);
      }
      if (decision !== "accepted" && decision !== "rejected") {
        return json({ success: false, error: "decision must be accepted or rejected" }, 400);
      }

      // Find proposal by token
      const { data: proposal, error: fetchErr } = await supabase
        .from("calculator_proposals")
        .select("id, status, approval_decision, approval_token_expires_at")
        .eq("approval_token", token.trim())
        .maybeSingle();

      if (fetchErr || !proposal) {
        return json({ success: false, error: "Proposta não encontrada." }, 404);
      }

      // Check expiration
      if (proposal.approval_token_expires_at) {
        const expiresAt = new Date(proposal.approval_token_expires_at);
        if (expiresAt <= new Date()) {
          return json({ success: false, error: "Link expirado." }, 410);
        }
      }

      // Idempotency check
      const cd = proposal.approval_decision;
      const cs = (proposal.status || "").toUpperCase();
      if (cd === "accepted" || cs === "APROVADO") {
        return json({ success: false, error: "Esta proposta já foi aprovada." }, 409);
      }
      if (cd === "rejected" || cs === "RECUSADO" || cs === "REPROVADO") {
        return json({ success: false, error: "Esta proposta já foi recusada." }, 409);
      }

      const now = new Date().toISOString();
      const newStatus = decision === "accepted" ? "Aprovado" : "Recusado";

      const updatePayload: Record<string, unknown> = {
        approval_decision: decision,
        status: newStatus,
        updated_at: now,
      };

      if (decision === "accepted") updatePayload.approved_at = now;
      else updatePayload.rejected_at = now;

      if (name) updatePayload.approved_by_name = name;
      if (email) updatePayload.approved_by_email = email;
      if (notes) updatePayload.approval_notes = notes;

      const { error: updateErr } = await supabase
        .from("calculator_proposals")
        .update(updatePayload)
        .eq("id", proposal.id);

      if (updateErr) {
        console.error("[public-approval] update error:", updateErr);
        return json({ success: false, error: updateErr.message }, 500);
      }

      console.log("[public-approval] Decision recorded:", proposal.id, decision);
      return json({ success: true, status: newStatus });
    }

    return json({ success: false, error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[public-approval] Error:", err);
    return json({ success: false, error: String(err) }, 500);
  }
});
