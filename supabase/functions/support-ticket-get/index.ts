// ============================================================================
// EDGE FUNCTION: support-ticket-get
// Get single ticket with messages, attachments, status history, assignments
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

    if (ticketId) {
      ticketQuery = ticketQuery.eq("id", ticketId);
    } else {
      ticketQuery = ticketQuery.eq("public_code", publicCode);
    }

    const { data: ticket, error: ticketError } = await ticketQuery.single();

    if (ticketError || !ticket) {
      return jsonResponse({ success: false, message: "Ticket não encontrado" }, 404);
    }

    // Access check: client can only see own tickets
    if (userLevel < 600 && userId && ticket.requester_user_id !== userId) {
      return jsonResponse({ success: false, message: "Acesso negado" }, 403);
    }

    // Fetch messages (filter internal notes for clients)
    let messagesQuery = db
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });

    if (userLevel < 600) {
      messagesQuery = messagesQuery.eq("is_internal_note", false);
    }

    const { data: messages } = await messagesQuery;

    // Fetch attachments (filter internal for clients)
    let attachmentsQuery = db
      .from("support_ticket_attachments")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });

    if (userLevel < 600) {
      attachmentsQuery = attachmentsQuery.eq("is_internal", false);
    }

    const { data: attachments } = await attachmentsQuery;

    // Fetch status history (internal only for level >= 600)
    let statusHistory: any[] = [];
    if (userLevel >= 600) {
      const { data } = await db
        .from("support_ticket_status_history")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      statusHistory = data || [];
    }

    // Fetch assignment history (internal only)
    let assignments: any[] = [];
    if (userLevel >= 600) {
      const { data } = await db
        .from("support_ticket_assignments")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      assignments = data || [];
    }

    // Fetch watchers
    let watchers: any[] = [];
    if (userLevel >= 600) {
      const { data } = await db
        .from("support_ticket_watchers")
        .select("*")
        .eq("ticket_id", ticket.id);
      watchers = data || [];
    }

    // Compute SLA derived fields
    const now = new Date();
    const sla = {
      is_first_response_breached: ticket.first_response_due_at
        ? !ticket.first_response_at && now > new Date(ticket.first_response_due_at)
        : false,
      is_resolution_breached: ticket.resolution_due_at
        ? !ticket.resolved_at && now > new Date(ticket.resolution_due_at)
        : false,
      sla_first_response_remaining_seconds: ticket.first_response_due_at && !ticket.first_response_at
        ? Math.max(0, Math.floor((new Date(ticket.first_response_due_at).getTime() - now.getTime()) / 1000))
        : null,
      sla_resolution_remaining_seconds: ticket.resolution_due_at && !ticket.resolved_at
        ? Math.max(0, Math.floor((new Date(ticket.resolution_due_at).getTime() - now.getTime()) / 1000))
        : null,
    };

    // Derive permissions for the caller
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
      can_transfer: userLevel >= 950,
      can_view_internal_notes: userLevel >= 775,
      can_view_audit: userLevel >= 775,
    };

    return jsonResponse({
      success: true,
      data: {
        ...ticket,
        messages: messages || [],
        attachments: attachments || [],
        status_history: statusHistory,
        assignments,
        watchers,
        sla,
        permissions,
      },
    });
  } catch (err) {
    console.error("support-ticket-get error:", err);
    return jsonResponse({ success: false, message: "Erro interno", errors: [String(err)] }, 500);
  }
});
