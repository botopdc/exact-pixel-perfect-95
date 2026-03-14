import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseAdmin, validateExternalToken } from "../_shared/supabaseAdmin.ts";

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

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function createPublicApprovalToken() {
  return `pat_${crypto.randomUUID().replace(/-/g, "")}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bearerToken = getBearerToken(req);
    if (!bearerToken) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const validation = await validateExternalToken(bearerToken);
    if (!validation.valid) {
      return json({ success: false, error: validation.error || "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { proposalId, expiresInDays = 30 } = body as {
      proposalId?: string;
      expiresInDays?: number;
    };

    if (!proposalId || proposalId.trim() === "") {
      return json({ success: false, error: "proposalId is required" }, 400);
    }

    const safeDays = Number.isFinite(expiresInDays)
      ? Math.min(Math.max(Math.trunc(expiresInDays), 1), 90)
      : 30;

    const supabase = getSupabaseAdmin();

    const { data: proposal, error: fetchError } = await supabase
      .from("calculator_proposals")
      .select("id, display_id, public_approval_token, public_approval_enabled, public_approval_expires_at")
      .eq("id", proposalId.trim())
      .maybeSingle();

    if (fetchError) {
      console.error("[proposal-public-link] fetch error:", fetchError);
      return json({ success: false, error: "Internal server error" }, 500);
    }

    if (!proposal) {
      return json({ success: false, error: "Proposal not found" }, 404);
    }

    const now = new Date();
    const currentToken = proposal.public_approval_token?.trim();
    const currentExpiry = proposal.public_approval_expires_at
      ? new Date(proposal.public_approval_expires_at)
      : null;

    const canReuseCurrentToken =
      !!currentToken &&
      proposal.public_approval_enabled === true &&
      (!currentExpiry || currentExpiry > now);

    if (canReuseCurrentToken) {
      return json({
        success: true,
        reused: true,
        token: currentToken,
        expiresAt: proposal.public_approval_expires_at,
        proposalId: proposal.id,
        displayId: proposal.display_id,
      });
    }

    const newToken = createPublicApprovalToken();
    const expiresAt = new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: updatedProposal, error: updateError } = await supabase
      .from("calculator_proposals")
      .update({
        public_approval_token: newToken,
        public_approval_enabled: true,
        public_approval_expires_at: expiresAt,
        updated_at: now.toISOString(),
      })
      .eq("id", proposal.id)
      .select("id, display_id, public_approval_token, public_approval_expires_at")
      .maybeSingle();

    if (updateError) {
      console.error("[proposal-public-link] update error:", updateError);
      return json({ success: false, error: "Failed to persist public token" }, 500);
    }

    if (!updatedProposal?.public_approval_token) {
      console.error("[proposal-public-link] update succeeded without token", { proposalId: proposal.id });
      return json({ success: false, error: "Failed to persist public token" }, 500);
    }

    return json({
      success: true,
      reused: false,
      token: updatedProposal.public_approval_token,
      expiresAt: updatedProposal.public_approval_expires_at,
      proposalId: updatedProposal.id,
      displayId: updatedProposal.display_id,
    });
  } catch (err) {
    console.error("[proposal-public-link] unhandled error:", err);
    return json({ success: false, error: "Internal server error" }, 500);
  }
});
