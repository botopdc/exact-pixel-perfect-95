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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate CORE JWT token (MVP - no signature verification)
    const tokenResult = requireCoreToken(req);
    if ("error" in tokenResult) {
      // Add CORS headers to error response
      const errorBody = await tokenResult.error.text();
      return new Response(errorBody, {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payload } = tokenResult;
    console.log("[proposal-list] Authenticated user:", payload.sub || payload.user_id);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { search, status, limit = 15, offset = 0 } = body as {
      search?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };

    console.log("[proposal-list] Request params:", { search, status, limit, offset });

    // Create Supabase client with Service Role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Build query
    let query = supabase
      .from("calculator_proposals")
      .select("id, display_id, name, company, email, phone, status, total, datacenter, channel_type, created_at, updated_at", { count: "exact" })
      .order("updated_at", { ascending: false });

    // Apply filters
    if (status && status !== "all" && status !== "Todos" && status.trim() !== "") {
      query = query.eq("status", status);
    }

    if (search && search.trim() !== "") {
      const term = search.trim();
      query = query.or(`company.ilike.%${term}%,name.ilike.%${term}%,email.ilike.%${term}%`);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[proposal-list] Supabase error:", error);
      return json({ success: false, error: error.message, code: error.code }, 500);
    }

    console.log("[proposal-list] Returned:", { count: data?.length, total: count });

    return json({
      success: true,
      proposals: data || [],
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      limit,
    });
  } catch (err) {
    console.error("[proposal-list] Error:", err);
    return json({ success: false, error: String(err) }, 500);
  }
});
