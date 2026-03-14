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
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const {
      search,
      status,
      clientName,
      companyName,
      dateFrom,
      dateTo,
      sortField = "created_at",
      sortDirection = "desc",
      limit = 15,
      offset = 0,
    } = body as {
      search?: string;
      status?: string;
      clientName?: string;
      companyName?: string;
      dateFrom?: string;
      dateTo?: string;
      sortField?: string;
      sortDirection?: string;
      limit?: number;
      offset?: number;
    };

    console.log("[proposal-list] Request params:", { search, status, clientName, companyName, dateFrom, dateTo, sortField, sortDirection, limit, offset });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Map sortField to actual DB column
    const validSortFields: Record<string, string> = {
      created_at: "created_at",
      updated_at: "updated_at",
      name: "name",
      company: "company",
      total: "total",
      status: "status",
    };
    const dbSortField = validSortFields[sortField] || "created_at";
    const ascending = sortDirection === "asc";

    let query = supabase
      .from("calculator_proposals")
      .select("id, display_id, name, company, email, phone, status, total, datacenter, channel_type, contract_duration, approved_at, created_at, updated_at", { count: "exact" })
      .order(dbSortField, { ascending });

    // Status filter
    if (status && status !== "all" && status.trim() !== "") {
      query = query.eq("status", status);
    }

    // General search (ID, name, company, email)
    if (search && search.trim() !== "") {
      const term = search.trim();
      query = query.or(`company.ilike.%${term}%,name.ilike.%${term}%,email.ilike.%${term}%,display_id.ilike.%${term}%`);
    }

    // Specific client name filter
    if (clientName && clientName.trim() !== "") {
      query = query.ilike("name", `%${clientName.trim()}%`);
    }

    // Specific company name filter
    if (companyName && companyName.trim() !== "") {
      query = query.ilike("company", `%${companyName.trim()}%`);
    }

    // Date range filters (on created_at)
    if (dateFrom && dateFrom.trim() !== "") {
      query = query.gte("created_at", `${dateFrom.trim()}T00:00:00.000Z`);
    }
    if (dateTo && dateTo.trim() !== "") {
      query = query.lte("created_at", `${dateTo.trim()}T23:59:59.999Z`);
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
