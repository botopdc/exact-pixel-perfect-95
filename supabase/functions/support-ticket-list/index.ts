// ============================================================================
// EDGE FUNCTION: support-ticket-list
// Lists tickets with filters, pagination, and QUEUE-BASED visibility
// OPTIMIZED: Parallel visibility resolution + reduced payload
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

// Columns needed for list view (excludes description, metadata, resolution_summary etc.)
const LIST_COLUMNS = [
  "id", "ticket_number", "public_code", "requester_name", "requester_email",
  "origin_channel", "ticket_type", "category", "subcategory", "severity", "priority",
  "status", "support_level", "current_queue", "current_queue_id", "current_support_level",
  "service_name", "asset_label", "title", "customer_visible",
  "assigned_to_user_id", "assigned_to_name", "assigned_at", "assigned_team",
  "first_response_due_at", "resolution_due_at", "first_response_at", "resolved_at", "closed_at",
  "created_at", "updated_at"
].join(",");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const userLevel = body.user_level || 1;
    const userId = body.user_id;
    const userLegacyId = body.user_legacy_id;
    const userEmail = body.user_email;

    const isUuidUser = userId && UUID_RE.test(userId);
    const userIdInt = userLegacyId ? parseInt(userLegacyId) : (userId ? parseInt(userId) : NaN);
    const isLegacyUser = !isUuidUser && Number.isFinite(userIdInt);

    // ── RESOLVE VISIBILITY + QUEUES IN PARALLEL ──────────────────────────
    // Start queue lookup immediately (needed for enrichment regardless)
    const queuesPromise = db.from("support_queues").select("id, code, name");

    // Resolve queue memberships for internal non-admin users
    let allQueueIds: string[] = [];
    if (userLevel >= 600 && userLevel < 950) {
      // Run membership + oncall lookups in parallel
      const now = new Date().toISOString();
      const membershipPromises: Promise<any>[] = [];

      if (userEmail) {
        membershipPromises.push(
          db.from("support_queue_members").select("queue_id").eq("user_email", userEmail).eq("is_active", true)
        );
        membershipPromises.push(
          db.from("support_oncall_shifts").select("team_code").eq("user_email", userEmail).eq("is_active", true).lte("starts_at", now).gte("ends_at", now)
        );
      } else {
        membershipPromises.push(Promise.resolve({ data: [] }));
        membershipPromises.push(Promise.resolve({ data: [] }));
      }

      if (isLegacyUser) {
        membershipPromises.push(
          db.from("support_queue_members").select("queue_id").eq("user_id", userIdInt).eq("is_active", true)
        );
      }

      const results = await Promise.all(membershipPromises);
      const memberQueueIds = (results[0]?.data || []).map((m: any) => m.queue_id);
      const oncallShifts = results[1]?.data || [];
      const legacyQueueIds = results[2]?.data?.map((m: any) => m.queue_id) || [];

      // Resolve oncall team_codes to queue IDs
      let oncallQueueIds: string[] = [];
      if (oncallShifts.length > 0) {
        const teamToQueue: Record<string, string> = { infra: "N1", cloud: "N2", cs: "CS" };
        const oncallQueueCodes = oncallShifts.map((s: any) => teamToQueue[s.team_code]).filter(Boolean);
        if (oncallQueueCodes.length > 0) {
          const { data: queues } = await db.from("support_queues").select("id").in("code", oncallQueueCodes);
          oncallQueueIds = (queues || []).map((q: any) => q.id);
        }
      }

      allQueueIds = [...new Set([...memberQueueIds, ...legacyQueueIds, ...oncallQueueIds])];
    }

    // Build query with reduced columns
    let query = db
      .from("support_tickets")
      .select(LIST_COLUMNS, { count: "exact" })
      .is("deleted_at", null);

    // ── VISIBILITY ─────────────────────────────────────────────────────
    if (userLevel < 600 && userId) {
      if (userEmail) {
        query = query.eq("requester_email", userEmail);
      } else if (isUuidUser) {
        query = query.eq("requester_user_id", userId);
      } else {
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      }
    } else if (userLevel >= 600 && userLevel < 950) {
      const orConditions: string[] = [];
      if (userEmail) orConditions.push(`requester_email.eq.${userEmail}`);
      if (isUuidUser) orConditions.push(`assigned_to_user_id.eq.${userId}`);
      if (allQueueIds.length > 0) orConditions.push(`current_queue_id.in.(${allQueueIds.join(",")})`);
      if (orConditions.length === 0) orConditions.push("id.eq.00000000-0000-0000-0000-000000000000");
      query = query.or(orConditions.join(","));
    }

    // ── FILTERS ────────────────────────────────────────────────────────
    if (body.status) {
      if (Array.isArray(body.status)) {
        query = query.in("status", body.status);
      } else {
        query = query.eq("status", body.status);
      }
    }

    if (body.current_queue) {
      // Resolve queue code → id using already-started promise
      const queuesResult = await queuesPromise;
      const queueRow = (queuesResult.data || []).find((q: any) => q.code === body.current_queue);
      if (queueRow) query = query.eq("current_queue_id", queueRow.id);
    }

    if (body.current_queue_id) query = query.eq("current_queue_id", body.current_queue_id);
    if (body.assigned_to_user_id) query = query.eq("assigned_to_user_id", body.assigned_to_user_id);
    if (body.only_unassigned) query = query.is("assigned_to_user_id", null);

    if (body.only_mine) {
      if (isUuidUser) {
        query = query.eq("assigned_to_user_id", userId);
      } else if (isLegacyUser) {
        const { data: profileRow } = await db
          .from("profiles").select("id").eq("legacy_user_id", userIdInt).limit(1).single();
        if (profileRow?.id) {
          query = query.eq("assigned_to_user_id", profileRow.id);
        } else {
          query = query.contains("metadata", { assigned_to_legacy_user_id: userIdInt });
        }
      }
    }

    if (body.severity) {
      Array.isArray(body.severity) ? query = query.in("severity", body.severity) : query = query.eq("severity", body.severity);
    }
    if (body.ticket_type) query = query.eq("ticket_type", body.ticket_type);
    if (body.category) query = query.eq("category", body.category);
    if (body.company_id) query = query.eq("company_id", body.company_id);
    if (body.requester_name) query = query.ilike("requester_name", `%${body.requester_name}%`);
    if (body.search) {
      query = query.or(`title.ilike.%${body.search}%,public_code.ilike.%${body.search}%,requester_name.ilike.%${body.search}%`);
    }
    if (body.date_from) query = query.gte("created_at", body.date_from);
    if (body.date_to) query = query.lte("created_at", body.date_to);
    if (body.only_sla_breached) {
      const nowStr = new Date().toISOString();
      query = query.or(`resolution_due_at.lt.${nowStr},first_response_due_at.lt.${nowStr}`).is("resolved_at", null);
    }

    // Sorting + pagination
    const sort_by = body.sort_by || "created_at";
    const sort_dir = body.sort_dir === "asc";
    query = query.order(sort_by, { ascending: sort_dir }).range(offset, offset + per_page - 1);

    // Execute ticket query + await queues (already started)
    const [ticketResult, queuesResult] = await Promise.all([query, queuesPromise]);

    const { data: tickets, error, count } = ticketResult;
    if (error) {
      console.error("List error:", error);
      return jsonResponse({ success: false, message: "Erro ao listar tickets", errors: [error.message] }, 500);
    }

    // Enrich with queue code/name
    const queueMap: Record<string, { code: string; name: string }> = {};
    (queuesResult.data || []).forEach((q: any) => { queueMap[q.id] = { code: q.code, name: q.name }; });

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
