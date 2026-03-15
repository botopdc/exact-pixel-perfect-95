// ============================================================================
// EDGE FUNCTION: support-ticket-list
// Lists tickets with filters, pagination, and QUEUE-BASED visibility
// Source of truth: current_queue_id (FK) + support_queue_members
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

    // ── VISIBILITY ─────────────────────────────────────────────────────
    const userLevel = body.user_level || 1;
    const userId = body.user_id;

    console.log("support-ticket-list visibility context", { userId, userLevel });

    if (userLevel < 600 && userId) {
      // Client (level 1): only own tickets
      query = query.eq("requester_user_id", userId);
    } else if (userLevel >= 600 && userLevel < 950 && userId) {
      // Internal user (not manager/admin): see tickets in their queues OR assigned to them OR opened by them
      const userIdInt = parseInt(userId);
      const lookupId = Number.isFinite(userIdInt) ? userIdInt : null;

      let queueIds: string[] = [];
      if (lookupId) {
        const { data: memberships } = await db
          .from("support_queue_members")
          .select("queue_id")
          .eq("user_id", lookupId)
          .eq("is_active", true);
        queueIds = (memberships || []).map((m: any) => m.queue_id);
      }

      console.log("support-ticket-list membership", { userId, userIdInt: lookupId, queueIds });

      // Build OR conditions: requester OR assigned OR in queue
      const orConditions: string[] = [];
      orConditions.push(`requester_user_id.eq.${userId}`);
      orConditions.push(`assigned_to_user_id.eq.${userId}`);
      if (queueIds.length > 0) {
        orConditions.push(`current_queue_id.in.(${queueIds.join(",")})`);
      }

      console.log("support-ticket-list OR conditions", orConditions);
      query = query.or(orConditions.join(","));
    }
    // Manager (950+) and Admin (1000): see all tickets — no filter applied

    // ── FILTERS ────────────────────────────────────────────────────────
    if (body.status) {
      if (Array.isArray(body.status)) {
        query = query.in("status", body.status);
      } else {
        query = query.eq("status", body.status);
      }
    }

    // Filter by queue CODE — resolve to queue_id (new model)
    if (body.current_queue) {
      const { data: queueRow } = await db
        .from("support_queues")
        .select("id")
        .eq("code", body.current_queue)
        .single();

      if (queueRow) {
        query = query.eq("current_queue_id", queueRow.id);
      }
    }

    if (body.current_queue_id) {
      query = query.eq("current_queue_id", body.current_queue_id);
    }

    if (body.assigned_to_user_id) {
      query = query.eq("assigned_to_user_id", body.assigned_to_user_id);
    }

    if (body.only_unassigned) {
      query = query.is("assigned_to_user_id", null);
    }

    if (body.only_mine && userId) {
      query = query.eq("assigned_to_user_id", userId);
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

    if (body.only_sla_breached) {
      const now = new Date().toISOString();
      query = query.or(
        `resolution_due_at.lt.${now},first_response_due_at.lt.${now}`
      ).is("resolved_at", null);
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

    // ── ENRICH with queue code/name ────────────────────────────────────
    // Fetch all queues once for lookup
    const { data: allQueues } = await db
      .from("support_queues")
      .select("id, code, name");

    const queueMap: Record<string, { code: string; name: string }> = {};
    (allQueues || []).forEach((q: any) => {
      queueMap[q.id] = { code: q.code, name: q.name };
    });

    const enrichedTickets = (tickets || []).map((t: any) => ({
      ...t,
      queue_code: t.current_queue_id ? queueMap[t.current_queue_id]?.code || t.current_support_level : t.current_support_level,
      queue_name: t.current_queue_id ? queueMap[t.current_queue_id]?.name || t.current_support_level : t.current_support_level,
    }));

    return jsonResponse({
      success: true,
      data: enrichedTickets,
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
