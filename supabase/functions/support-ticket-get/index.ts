// ============================================================================
// EDGE FUNCTION: support-ticket-get
// Get single ticket with messages, attachments, status history, queue history
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

    const ticketId = body.ticket_id;
    const publicCode = body.public_code;
    const userLevel = body.user_level || 1;
    const userId = body.user_id;

    if (!ticketId && !publicCode) {
      return jsonResponse({ success: false, message: "ticket_id ou public_code obrigatório" }, 422);
    }

    // Fetch ticket
    let ticketQuery = db.from("support_tickets").select("*").is("deleted_at", null);
    if (ticketId) ticketQuery = ticketQuery.eq("id", ticketId);
    else ticketQuery = ticketQuery.eq("public_code", publicCode);

    const { data: ticket, error: ticketError } = await ticketQuery.single();
    if (ticketError || !ticket) {
      return jsonResponse({ success: false, message: "Ticket não encontrado" }, 404);
    }

    // Access check: client can only see own tickets
    if (userLevel < 600 && userId && ticket.requester_user_id !== userId) {
      return jsonResponse({ success: false, message: "Acesso negado" }, 403);
    }

    // For internal non-manager users: check queue membership
    if (userLevel >= 600 && userLevel < 950 && userId) {
      const { data: memberships } = await db
        .from("support_queue_members")
        .select("queue_id")
        .eq("user_id", parseInt(userId))
        .eq("is_active", true);

      const queueIds = (memberships || []).map((m: any) => m.queue_id);
      const isAssigned = ticket.assigned_to_user_id === userId;
      const isInQueue = ticket.current_queue_id && queueIds.includes(ticket.current_queue_id);

      if (!isAssigned && !isInQueue) {
        return jsonResponse({ success: false, message: "Acesso negado — você não faz parte da fila deste ticket" }, 403);
      }
    }

    // Fetch messages
    let messagesQuery = db.from("support_ticket_messages").select("*")
      .eq("ticket_id", ticket.id).order("created_at", { ascending: true });
    if (userLevel < 600) messagesQuery = messagesQuery.eq("is_internal_note", false);
    const { data: messages } = await messagesQuery;

    // Fetch attachments
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

    // Resolve queue name
    let queueName = ticket.current_queue;
    if (ticket.current_queue_id) {
      const { data: q } = await db.from("support_queues").select("code, name")
        .eq("id", ticket.current_queue_id).single();
      if (q) queueName = q.code;
    }

    // SLA
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
        current_queue: queueName,
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
