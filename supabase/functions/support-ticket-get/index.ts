// ============================================================================
// EDGE FUNCTION: support-ticket-get
// Get single ticket with messages, attachments, status history, queue history
// Source of truth: current_queue_id (FK) + support_queue_members for access
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
      return jsonResponse({ success: false, message: "Falha ao identificar usuário autenticado" }, 401);
    }

    const body = await req.json();
    const db = getSupabaseAdmin();

    const ticketId = body.ticket_id;
    const publicCode = body.public_code;
    const userLevel = body.user_level || 1;
    const userId = body.user_id;

    console.log("support-ticket-get user context", { userId, userLevel, ticketId, publicCode });

    if (!ticketId && !publicCode) {
      return jsonResponse({ success: false, message: "ticket_id ou public_code obrigatório" }, 422);
    }

    // Fetch ticket
    let ticketQuery = db.from("support_tickets").select("*").is("deleted_at", null);
    if (ticketId) ticketQuery = ticketQuery.eq("id", ticketId);
    else ticketQuery = ticketQuery.eq("public_code", publicCode);

    const { data: ticket, error: ticketError } = await ticketQuery.single();
    if (ticketError || !ticket) {
      console.log("support-ticket-get ticket not found", { ticketId, publicCode, error: ticketError?.message });
      return jsonResponse({ success: false, message: "Chamado não encontrado" }, 404);
    }

    // ── ACCESS CHECK ────────────────────────────────────────────────────
    // Client (level < 600): own tickets only
    if (userLevel < 600 && userId && String(ticket.requester_user_id) !== String(userId)) {
      console.log("support-ticket-get access denied (client)", { userId, requesterUserId: ticket.requester_user_id });
      return jsonResponse({ success: false, message: "Acesso negado" }, 403);
    }

    // Internal non-manager (600-949): check requester OR assignment OR queue membership
    if (userLevel >= 600 && userLevel < 950 && userId) {
      const isRequester = String(ticket.requester_user_id) === String(userId);
      const isAssigned = ticket.assigned_to_user_id && String(ticket.assigned_to_user_id) === String(userId);

      let isInQueue = false;
      let memberQueueIds: string[] = [];
      if (!isRequester && !isAssigned && ticket.current_queue_id) {
        const userIdInt = parseInt(userId);
        if (Number.isFinite(userIdInt)) {
          const { data: memberships } = await db
            .from("support_queue_members")
            .select("queue_id")
            .eq("user_id", userIdInt)
            .eq("is_active", true);
          memberQueueIds = (memberships || []).map((m: any) => m.queue_id);
          isInQueue = memberQueueIds.includes(ticket.current_queue_id);
        }
      }

      console.log("support-ticket-get access check", {
        ticketId: ticket.id,
        requesterUserId: ticket.requester_user_id,
        assignedToUserId: ticket.assigned_to_user_id,
        currentQueueId: ticket.current_queue_id,
        memberQueueIds,
        userId,
        userLevel,
        isRequester,
        isAssigned,
        isInQueue,
      });

      if (!isRequester && !isAssigned && !isInQueue) {
        return jsonResponse({
          success: false,
          message: "Você não tem permissão para acessar este chamado",
          debug: { reason: "not_requester_not_assigned_not_in_queue" },
        }, 403);
      }
    }
    // Manager (950+) and Admin (1000): full access — no filter

    // ── Fetch related data ──────────────────────────────────────────────

    // Messages (filter internal notes for clients)
    let messagesQuery = db.from("support_ticket_messages").select("*")
      .eq("ticket_id", ticket.id).order("created_at", { ascending: true });
    if (userLevel < 600) messagesQuery = messagesQuery.eq("is_internal_note", false);
    const { data: messages } = await messagesQuery;

    // Attachments (filter internal for clients)
    let attachmentsQuery = db.from("support_ticket_attachments").select("*")
      .eq("ticket_id", ticket.id).order("created_at", { ascending: true });
    if (userLevel < 600) attachmentsQuery = attachmentsQuery.eq("is_internal", false);
    const { data: attachments } = await attachmentsQuery;

    // Internal-only data
    let statusHistory: any[] = [];
    let assignments: any[] = [];
    let watchers: any[] = [];
    let queueHistory: any[] = [];

    if (userLevel >= 600) {
      const { data: sh } = await db.from("support_ticket_status_history").select("*")
        .eq("ticket_id", ticket.id).order("created_at", { ascending: true });
      statusHistory = sh || [];

      const { data: a } = await db.from("support_ticket_assignments").select("*")
        .eq("ticket_id", ticket.id).order("created_at", { ascending: true });
      assignments = a || [];

      const { data: w } = await db.from("support_ticket_watchers").select("*")
        .eq("ticket_id", ticket.id);
      watchers = w || [];

      const { data: qh } = await db.from("support_ticket_queue_history").select("*")
        .eq("ticket_id", ticket.id).order("created_at", { ascending: true });
      queueHistory = qh || [];
    }

    // ── Resolve queue name from current_queue_id ────────────────────────
    let queueCode = ticket.current_support_level || "N1";
    let queueName = queueCode;
    if (ticket.current_queue_id) {
      const { data: q } = await db.from("support_queues").select("code, name")
        .eq("id", ticket.current_queue_id).single();
      if (q) {
        queueCode = q.code;
        queueName = q.name;
      }
    }

    // Enrich queue_history with queue names
    if (queueHistory.length > 0) {
      const { data: allQueues } = await db.from("support_queues").select("id, code, name");
      const qMap: Record<string, { code: string; name: string }> = {};
      (allQueues || []).forEach((q: any) => { qMap[q.id] = { code: q.code, name: q.name }; });

      queueHistory = queueHistory.map((qh: any) => ({
        ...qh,
        from_queue_code: qh.from_queue_id ? qMap[qh.from_queue_id]?.code : null,
        from_queue_name: qh.from_queue_id ? qMap[qh.from_queue_id]?.name : null,
        to_queue_code: qMap[qh.to_queue_id]?.code || qh.to_support_level,
        to_queue_name: qMap[qh.to_queue_id]?.name || qh.to_support_level,
      }));
    }

    // ── SLA calculation ─────────────────────────────────────────────────
    const now = new Date();
    const sla = {
      is_first_response_breached: ticket.first_response_due_at
        ? !ticket.first_response_at && now > new Date(ticket.first_response_due_at) : false,
      is_resolution_breached: ticket.resolution_due_at
        ? !ticket.resolved_at && now > new Date(ticket.resolution_due_at) : false,
      sla_first_response_remaining_seconds: ticket.first_response_due_at && !ticket.first_response_at
        ? Math.max(0, Math.floor((new Date(ticket.first_response_due_at).getTime() - now.getTime()) / 1000)) : null,
      sla_resolution_remaining_seconds: ticket.resolution_due_at && !ticket.resolved_at
        ? Math.max(0, Math.floor((new Date(ticket.resolution_due_at).getTime() - now.getTime()) / 1000)) : null,
    };

    // ── Permissions ─────────────────────────────────────────────────────
    const permissions = {
      can_add_message: true,
      can_add_internal_note: userLevel >= 775,
      can_assign: userLevel >= 900,
      can_escalate: userLevel >= 900,
      can_resolve: userLevel >= 900,
      can_close: userLevel >= 775,
      can_reopen: userLevel >= 775,
      can_cancel: userLevel >= 950,
      can_change_priority: userLevel >= 950,
      can_transfer: userLevel >= 900,
      can_view_internal_notes: userLevel >= 775,
      can_view_audit: userLevel >= 775,
    };

    return jsonResponse({
      success: true,
      data: {
        ...ticket,
        queue_code: queueCode,
        queue_name: queueName,
        messages: messages || [],
        attachments: attachments || [],
        status_history: statusHistory,
        assignments,
        watchers,
        queue_history: queueHistory,
        sla,
        permissions,
      },
    });
  } catch (err) {
    console.error("support-ticket-get error:", err);
    return jsonResponse({ success: false, message: "Erro interno", errors: [String(err)] }, 500);
  }
});
