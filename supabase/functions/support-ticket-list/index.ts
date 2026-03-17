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
    const userLegacyId = body.user_legacy_id;
    const userEmail = body.user_email;

    // UUID regex for detecting legacy integer IDs
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuidUser = userId && UUID_RE.test(userId);
    const userIdInt = userLegacyId ? parseInt(userLegacyId) : (userId ? parseInt(userId) : NaN);
    const isLegacyUser = !isUuidUser && Number.isFinite(userIdInt);

    console.log("[visibility] context", { userId, userLegacyId, userLevel, userEmail, isUuidUser, isLegacyUser });

    if (userLevel < 600 && userId) {
      // Client (level 1): only own tickets — match by email (reliable for both UUID and legacy)
      if (userEmail) {
        query = query.eq("requester_email", userEmail);
      } else if (isUuidUser) {
        query = query.eq("requester_user_id", userId);
      } else {
        // Fallback: no tickets visible
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      }
    } else if (userLevel >= 600 && userLevel < 950) {
      // Internal user (not manager/admin): see tickets in their queues OR assigned to them OR opened by them

      // ── 1) Queue memberships by email ──
      let queueIds: string[] = [];
      if (userEmail) {
        const { data: memberships } = await db
          .from("support_queue_members")
          .select("queue_id")
          .eq("user_email", userEmail)
          .eq("is_active", true);
        queueIds = (memberships || []).map((m: any) => m.queue_id);
      }

      // Fallback: try integer user_id if email lookup returned nothing
      if (queueIds.length === 0 && isLegacyUser) {
        const { data: memberships } = await db
          .from("support_queue_members")
          .select("queue_id")
          .eq("user_id", userIdInt)
          .eq("is_active", true);
        queueIds = (memberships || []).map((m: any) => m.queue_id);
      }

      // ── 2) On-call shifts: add queue IDs from active shifts ──
      const now = new Date().toISOString();
      let oncallQueueIds: string[] = [];
      if (userEmail) {
        const { data: shifts } = await db
          .from("support_oncall_shifts")
          .select("team_code")
          .eq("user_email", userEmail)
          .eq("is_active", true)
          .lte("starts_at", now)
          .gte("ends_at", now);

        if (shifts && shifts.length > 0) {
          // Map team_code to queue code
          const teamToQueue: Record<string, string> = { infra: "N1", cloud: "N2", cs: "CS" };
          const oncallQueueCodes = shifts.map((s: any) => teamToQueue[s.team_code]).filter(Boolean);
          if (oncallQueueCodes.length > 0) {
            const { data: queues } = await db
              .from("support_queues")
              .select("id")
              .in("code", oncallQueueCodes);
            oncallQueueIds = (queues || []).map((q: any) => q.id);
          }
        }
      }

      // Merge queue IDs from memberships + oncall
      const allQueueIds = [...new Set([...queueIds, ...oncallQueueIds])];

      console.log("[visibility] memberships", { userId, userEmail, memberQueueIds: queueIds, oncallQueueIds, allQueueIds });

      // ── 3) Build OR conditions ──
      // CRITICAL: Do NOT use UUID columns (requester_user_id, assigned_to_user_id)
      // with legacy integer IDs — PostgREST will throw "invalid UUID" and break the entire query.
      const orConditions: string[] = [];

      // Requester match by email (reliable for both UUID and legacy users)
      if (userEmail) {
        orConditions.push(`requester_email.eq.${userEmail}`);
      }

      // Assigned match — UUID users can match directly, legacy users match by name
      if (isUuidUser) {
        orConditions.push(`assigned_to_user_id.eq.${userId}`);
      }
      // For legacy users, we can't filter by assigned_to_user_id (UUID column).
      // We rely on queue membership visibility instead — if the ticket is in your queue, you see it.

      // Queue membership + oncall
      if (allQueueIds.length > 0) {
        orConditions.push(`current_queue_id.in.(${allQueueIds.join(",")})`);
      }

      // Fallback: no conditions = see nothing
      if (orConditions.length === 0) {
        orConditions.push("id.eq.00000000-0000-0000-0000-000000000000");
      }

      console.log("[visibility] OR conditions", orConditions);
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

    if (body.only_mine) {
      if (isUuidUser) {
        query = query.eq("assigned_to_user_id", userId);
      } else if (isLegacyUser) {
        // Legacy users: assigned_to_user_id is NULL, legacy ID stored in metadata
        query = query.contains("metadata", { assigned_to_legacy_user_id: userIdInt });
      }
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
