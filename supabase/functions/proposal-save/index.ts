import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { requireCoreToken } from "../_shared/requireCoreToken.ts";

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
    // Validate CORE JWT token (MVP - no signature verification)
    const tokenResult = requireCoreToken(req);
    if ("error" in tokenResult) {
      const errorBody = await tokenResult.error.text();
      return new Response(errorBody, {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payload } = tokenResult;
    console.log("[proposal-save] Authenticated user:", payload.sub || payload.user_id);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { proposal, servers = [], addons = [] } = body as {
      proposal: Record<string, unknown>;
      servers?: Record<string, unknown>[];
      addons?: Record<string, unknown>[];
    };

    if (!proposal) {
      return json({ success: false, error: "proposal is required" }, 400);
    }

    console.log("[proposal-save] Saving proposal:", {
      id: proposal.id,
      company: proposal.company,
      serversCount: servers.length,
      addonsCount: addons.length,
      user: payload.sub || payload.user_id,
    });

    // Create Supabase client with Service Role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let proposalId: string;

    // Check if update or insert
    if (proposal.id && typeof proposal.id === "string" && proposal.id.length > 0) {
      // UPDATE existing proposal
      proposalId = proposal.id as string;

      const { id, created_at, ...updateData } = proposal;
      
      const { error: updateError } = await supabase
        .from("calculator_proposals")
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposalId);

      if (updateError) {
        console.error("[proposal-save] Update error:", updateError);
        return json({ success: false, error: updateError.message }, 500);
      }

      // Delete existing servers and addons
      await supabase
        .from("calculator_proposal_servers")
        .delete()
        .eq("proposal_id", proposalId);

      await supabase
        .from("calculator_proposal_addons")
        .delete()
        .eq("proposal_id", proposalId);

      console.log("[proposal-save] Updated proposal:", proposalId);
    } else {
      // INSERT new proposal
      const { id, ...insertData } = proposal;
      
      const { data: newProposal, error: insertError } = await supabase
        .from("calculator_proposals")
        .insert({
          ...insertData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[proposal-save] Insert error:", insertError);
        return json({ success: false, error: insertError.message }, 500);
      }

      proposalId = newProposal.id;
      console.log("[proposal-save] Created new proposal:", proposalId);
    }

    // Insert servers
    if (servers.length > 0) {
      const serversToInsert = servers.map((server, idx) => ({
        ...server,
        proposal_id: proposalId,
        sort_order: idx,
        id: undefined, // Let DB generate new IDs
        created_at: new Date().toISOString(),
      }));

      const { error: serversError } = await supabase
        .from("calculator_proposal_servers")
        .insert(serversToInsert);

      if (serversError) {
        console.error("[proposal-save] Servers insert error:", serversError);
        return json({ success: false, error: `Servers: ${serversError.message}` }, 500);
      }

      console.log("[proposal-save] Inserted servers:", servers.length);
    }

    // Insert addons
    if (addons.length > 0) {
      const addonsToInsert = addons.map((addon, idx) => ({
        ...addon,
        proposal_id: proposalId,
        sort_order: idx,
        id: undefined, // Let DB generate new IDs
        created_at: new Date().toISOString(),
      }));

      const { error: addonsError } = await supabase
        .from("calculator_proposal_addons")
        .insert(addonsToInsert);

      if (addonsError) {
        console.error("[proposal-save] Addons insert error:", addonsError);
        return json({ success: false, error: `Addons: ${addonsError.message}` }, 500);
      }

      console.log("[proposal-save] Inserted addons:", addons.length);
    }

    return json({
      success: true,
      proposalId,
      message: proposal.id ? "Proposal updated" : "Proposal created",
    });
  } catch (err) {
    console.error("[proposal-save] Error:", err);
    return json({ success: false, error: String(err) }, 500);
  }
});
