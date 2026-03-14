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

    if (action === "load") {
      const { token } = body as { token?: string };
      if (!token || token.trim() === "") {
        return json({ success: false, errorCode: "token_missing", error: "Token de aprovação ausente." }, 400);
      }

      const normalizedToken = token.trim();
      console.log("[public-approval] load token:", normalizedToken);

      const { data: enabledProposal, error: fetchErr } = await supabase
        .from("calculator_proposals")
        .select("*")
        .eq("public_approval_token", normalizedToken)
        .eq("public_approval_enabled", true)
        .maybeSingle();

      if (fetchErr) {
        console.error("[public-approval] fetch error:", fetchErr);
        return json({ success: false, errorCode: "unknown", error: "Erro ao carregar proposta." }, 500);
      }

      let proposal = enabledProposal;
      if (!proposal) {
        const { data: maybeDisabled, error: disabledErr } = await supabase
          .from("calculator_proposals")
          .select("*")
          .eq("public_approval_token", normalizedToken)
          .maybeSingle();

        if (disabledErr) {
          console.error("[public-approval] disabled-check error:", disabledErr);
          return json({ success: false, errorCode: "unknown", error: "Erro ao carregar proposta." }, 500);
        }

        if (!maybeDisabled) {
          return json({ success: false, errorCode: "token_invalid", error: "Token de aprovação inválido." }, 404);
        }

        return json({ success: false, errorCode: "token_disabled", error: "Aprovação pública desabilitada para esta proposta." }, 403);
      }

      if (proposal.public_approval_expires_at) {
        const expiresAt = new Date(proposal.public_approval_expires_at);
        if (expiresAt <= new Date()) {
          return json({ success: false, errorCode: "token_expired", error: "Este link de aprovação expirou." }, 410);
        }
      }

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

      let pdfSignedUrl: string | null = null;
      if (proposal.pdf_path) {
        try {
          const { data: urlData, error: urlError } = await supabase.storage
            .from("proposal-files")
            .createSignedUrl(proposal.pdf_path, 60 * 30);

          if (urlError) {
            console.warn("[public-approval] pdf signed url error:", urlError.message);
          } else {
            pdfSignedUrl = urlData?.signedUrl ?? null;
          }
        } catch (err) {
          console.warn("[public-approval] pdf signed url exception:", err);
        }
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
          public_approval_token: proposal.public_approval_token,
          public_approval_enabled: proposal.public_approval_enabled,
          public_approval_expires_at: proposal.public_approval_expires_at,
        },
        servers: serversRes.data || [],
        addons: addonsRes.data || [],
        pdfSignedUrl,
      });
    }

    if (action === "decide") {
      const { token, decision, name, email, notes } = body as {
        token?: string;
        decision?: string;
        name?: string;
        email?: string;
        notes?: string;
      };

      if (!token || !decision) {
        return json({ success: false, errorCode: "token_missing", error: "token e decisão são obrigatórios." }, 400);
      }
      if (decision !== "accepted" && decision !== "rejected") {
        return json({ success: false, errorCode: "unknown", error: "decision must be accepted or rejected" }, 400);
      }

      const normalizedToken = token.trim();
      console.log("approval decision", decision);

      const { data: proposal, error: fetchErr } = await supabase
        .from("calculator_proposals")
        .select("id, status, approval_decision, public_approval_enabled, public_approval_expires_at")
        .eq("public_approval_token", normalizedToken)
        .maybeSingle();

      if (fetchErr) {
        console.error("[public-approval] decide fetch error:", fetchErr);
        return json({ success: false, errorCode: "unknown", error: "Erro ao carregar proposta." }, 500);
      }

      if (!proposal) {
        return json({ success: false, errorCode: "token_invalid", error: "Token de aprovação inválido." }, 404);
      }

      if (!proposal.public_approval_enabled) {
        return json({ success: false, errorCode: "token_disabled", error: "Aprovação pública desabilitada para esta proposta." }, 403);
      }

      if (proposal.public_approval_expires_at) {
        const expiresAt = new Date(proposal.public_approval_expires_at);
        if (expiresAt <= new Date()) {
          return json({ success: false, errorCode: "token_expired", error: "Este link de aprovação expirou." }, 410);
        }
      }

      const currentDecision = proposal.approval_decision;
      const currentStatus = (proposal.status || "").toUpperCase();
      if (currentDecision === "accepted" || currentStatus === "APROVADO" || currentStatus === "APPROVED") {
        return json({ success: false, errorCode: "already_approved", error: "Esta proposta já foi aprovada." }, 409);
      }
      if (
        currentDecision === "rejected" ||
        currentStatus === "RECUSADO" ||
        currentStatus === "REPROVADO" ||
        currentStatus === "REJECTED"
      ) {
        return json({ success: false, errorCode: "already_rejected", error: "Esta proposta já foi recusada." }, 409);
      }

      const now = new Date().toISOString();
      const newStatus = decision === "accepted" ? "Aprovado" : "Recusado";

      const updatePayload: Record<string, unknown> = {
        approval_decision: decision,
        status: newStatus,
        updated_at: now,
      };

      if (decision === "accepted") updatePayload.approved_at = now;
      if (decision === "rejected") updatePayload.rejected_at = now;

      if (name) updatePayload.approved_by_name = name;
      if (email) updatePayload.approved_by_email = email;
      if (notes) updatePayload.approval_notes = notes;

      console.log("proposal before update", proposal.id);

      const { data: updatedProposal, error: updateErr } = await supabase
        .from("calculator_proposals")
        .update(updatePayload)
        .eq("id", proposal.id)
        .select("id, status, approval_decision, approved_at, rejected_at")
        .maybeSingle();

      if (updateErr) {
        console.error("[public-approval] update error:", updateErr);
        return json({ success: false, errorCode: "unknown", error: updateErr.message }, 500);
      }

      console.log("proposal updated after decision", updatedProposal);
      return json({ success: true, status: newStatus, proposal: updatedProposal });
    }

    return json({ success: false, errorCode: "unknown", error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[public-approval] Error:", err);
    return json({ success: false, errorCode: "unknown", error: String(err) }, 500);
  }
});
