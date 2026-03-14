// ============================================================================
// EDGE FUNCTION: support-ticket-list
// Lists tickets with filters, pagination, and role-based visibility
// ============================================================================

import { getSupabaseAdmin, validateExternalToken } from "../_shared/supabaseAdmin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const authResult = await validateExternalToken(token);
    if (!authResult.valid) {
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const db = getSupabaseAdmin();

    // Pagination
    const page = Math.max(1, body.page || 1);
    const per_page = Math.min(100, Math.max(1, body.per_page || 25));
    const offset = (page - 1) * per_page;

    // Build query
    let query = db
      .from("support_tickets")
      .select("*", { count: "exact" })
      .is("deleted_at", null);

    // Role-based visibility
    const userLevel = body.user_level || 1;
    const userId = body.user_id;

    if (userLevel < 600 && userId) {
      // Client: only own tickets
      query = query.eq("requester_user_id", userId);
    }
    // Internal users (>= 600): see all tickets (filtered by optional params below)

    // Filters
    if (body.status) {
      if (Array.isArray(body.status)) {
        query = query.in("status", body.status);
      } else {
        query = query.eq("status", body.status);
      }
    }

    if (body.current_queue) {
      query = query.eq("current_queue", body.current_queue);
    }

    if (body.assigned_to_user_id) {
      query = query.eq("assigned_to_user_id", body.assigned_to_user_id);
    }

    if (body.severity) {
      if (Array.isArray(body.severity)) {
        query = query.in("severity", body.severity);
      } else {
        query = query.eq("severity", body.severity);
      }
    }

    if (body.ticket_type) {
      query = query.eq("ticket_type", body.ticket_type);
    }

    if (body.category) {
      query = query.eq("category", body.category);
    }

    if (body.company_id) {
      query = query.eq("company_id", body.company_id);
    }

    if (body.requester_name) {
      query = query.ilike("requester_name", `%${body.requester_name}%`);
    }

    if (body.search) {
      query = query.or(
        `title.ilike.%${body.search}%,public_code.ilike.%${body.search}%,requester_name.ilike.%${body.search}%`
      );
    }

    if (body.date_from) {
      query = query.gte("created_at", body.date_from);
    }

    if (body.date_to) {
      query = query.lte("created_at", body.date_to);
    }

    // Sorting
    const sort_by = body.sort_by || "created_at";
    const sort_dir = body.sort_dir === "asc" ? true : false;
    query = query.order(sort_by, { ascending: sort_dir });

    // Pagination
    query = query.range(offset, offset + per_page - 1);

    const { data: tickets, error, count } = await query;

    if (error) {
      console.error("List error:", error);
      return jsonResponse({ success: false, message: "Erro ao listar tickets", errors: [error.message] }, 500);
    }

    return jsonResponse({
      success: true,
      data: tickets || [],
      meta: {
        current_page: page,
        per_page,
        total: count || 0,
        last_page: Math.ceil((count || 0) / per_page),
      },
    });
  } catch (err) {
    console.error("support-ticket-list error:", err);
    return jsonResponse({ success: false, message: "Erro interno", errors: [String(err)] }, 500);
  }
});
