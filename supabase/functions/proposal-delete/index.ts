import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { requireCoreAuth } from "../_shared/requireCoreAuth.ts";

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
    // Validate CORE token via backend introspection
    const authResult = await requireCoreAuth(req);
    if ("error" in authResult) {
      const errorBody = await authResult.error.text();
      return new Response(errorBody, {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user } = authResult;
    console.log("[proposal-delete] Authenticated user:", user.id, user.email);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { proposalId } = body as { proposalId?: string };

    if (!proposalId) {
      return json({ success: false, error: "proposalId is required" }, 400);
    }

    console.log("[proposal-delete] Deleting proposal:", proposalId);

    // Create Supabase client with Service Role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Delete servers first (foreign key constraint)
    const { error: serversError } = await supabase
      .from("calculator_proposal_servers")
      .delete()
      .eq("proposal_id", proposalId);

    if (serversError) {
      console.error("[proposal-delete] Servers delete error:", serversError);
    }

    // Delete addons
    const { error: addonsError } = await supabase
      .from("calculator_proposal_addons")
      .delete()
      .eq("proposal_id", proposalId);

    if (addonsError) {
      console.error("[proposal-delete] Addons delete error:", addonsError);
    }

    // Delete proposal
    const { error: proposalError } = await supabase
      .from("calculator_proposals")
      .delete()
      .eq("id", proposalId);

    if (proposalError) {
      console.error("[proposal-delete] Proposal delete error:", proposalError);
      return json({ success: false, error: proposalError.message }, 500);
    }

    console.log("[proposal-delete] Successfully deleted proposal:", proposalId);

    return json({
      success: true,
      message: "Proposal deleted",
    });
  } catch (err) {
    console.error("[proposal-delete] Error:", err);
    return json({ success: false, error: String(err) }, 500);
  }
});
