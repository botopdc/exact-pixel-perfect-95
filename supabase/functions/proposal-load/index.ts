import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

/**
 * proposal-load - Unified Edge Function to load proposal + servers + addons
 * 
 * ANON mode: No authentication required
 * Single call: Returns all data needed for editing in one request
 * Always returns 200 with JSON (success: false on errors)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get proposal ID from query string or body
    let proposalId: string | null = null;
    
    const url = new URL(req.url);
    proposalId = url.searchParams.get("id");
    
    // Also try to get from body for POST requests
    if (!proposalId && req.method === "POST") {
      try {
        const body = await req.json();
        proposalId = body.proposalId || body.id;
      } catch {
        // Ignore JSON parse errors
      }
    }

    if (!proposalId) {
      return json({ 
        success: false, 
        error: "Proposal ID is required. Use ?id=<uuid> or POST body with proposalId" 
      });
    }

    console.log("[proposal-load] Loading proposal:", proposalId);

    // Create Supabase client with ANON KEY (no auth required)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    // Query 1: Fetch proposal
    const { data: proposal, error: proposalError } = await supabase
      .from("calculator_proposals")
      .select("*")
      .eq("id", proposalId)
      .single();

    if (proposalError) {
      console.error("[proposal-load] Proposal error:", proposalError);
      return json({ 
        success: false, 
        error: proposalError.message,
        code: proposalError.code 
      });
    }

    if (!proposal) {
      return json({ 
        success: false, 
        error: "Proposal not found" 
      });
    }

    // Query 2: Fetch servers (items)
    const { data: servers, error: serversError } = await supabase
      .from("calculator_proposal_servers")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("sort_order", { ascending: true });

    if (serversError) {
      console.error("[proposal-load] Servers error:", serversError);
      // Continue anyway - servers are optional
    }

    // Query 3: Fetch addons
    const { data: addons, error: addonsError } = await supabase
      .from("calculator_proposal_addons")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("sort_order", { ascending: true });

    if (addonsError) {
      console.error("[proposal-load] Addons error:", addonsError);
      // Continue anyway - addons are optional
    }

    console.log("[proposal-load] Loaded successfully:", {
      proposalId,
      serversCount: servers?.length || 0,
      addonsCount: addons?.length || 0,
    });

    return json({
      success: true,
      proposal,
      servers: servers || [],
      addons: addons || [],
    });

  } catch (err) {
    console.error("[proposal-load] Unexpected error:", err);
    return json({ 
      success: false, 
      error: err instanceof Error ? err.message : String(err) 
    });
  }
});
