import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

function getSupabase() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // Action: list — return events for a proposal
    if (action === "list") {
      const { proposalId } = body;
      if (!proposalId) {
        return json({ success: false, error: "proposalId is required" }, 400);
      }

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("proposal_views")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("viewed_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("[proposal-track] List error:", error);
        return json({ success: false, error: error.message }, 500);
      }

      return json({ success: true, events: data || [] });
    }

    // Default action: track/insert event
    const { proposalId, source, clientEmail } = body;

    if (!proposalId || !source) {
      return json({ success: false, error: "proposalId and source are required" }, 400);
    }

    console.log("[proposal-track] Recording event:", { proposalId, source, clientEmail });

    const supabase = getSupabase();

    const userAgent = req.headers.get("user-agent") || null;
    const xForwardedFor = req.headers.get("x-forwarded-for");
    const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : null;

    const { data, error } = await supabase
      .from("proposal_views")
      .insert({
        proposal_id: proposalId,
        source,
        client_email: clientEmail || null,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[proposal-track] Insert error:", error);
      return json({ success: false, error: error.message }, 500);
    }

    console.log("[proposal-track] Event recorded:", data.id);
    return json({ success: true, eventId: data.id });
  } catch (err) {
    console.error("[proposal-track] Error:", err);
    return json({ success: false, error: String(err) }, 500);
  }
});
