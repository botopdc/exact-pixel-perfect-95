// ============================================================================
// EDGE FUNCTION: support-ticket-messages
// Add messages (public or internal notes) to tickets
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

function getAuthorType(level: number): string {
  if (level >= 950) return "manager";
  if (level >= 900) return "support";
  if (level >= 775) return "cs";
  if (level >= 600) return "support";
  return "client";
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

    const { ticket_id, body: messageBody, is_internal_note, author_user_id, author_name, author_email } = body;
    // Accept both author_level (from frontend) and user_level (legacy)
    const level = body.author_level || body.user_level || 1;

    console.log("support-ticket-messages user context", {
      author_user_id,
      author_name,
      author_email,
      level,
      raw_author_level: body.author_level,
      raw_user_level: body.user_level,
    });

    if (!ticket_id || !messageBody || !author_name) {
      return jsonResponse({ success: false, message: "ticket_id, body e author_name obrigatórios" }, 422);
    }

    // Fetch ticket to validate access
    const { data: ticket, error: fetchErr } = await db
      .from("support_tickets")
      .select("id, requester_user_id, status, current_queue_id, assigned_to_user_id")
      .eq("id", ticket_id)
      .is("deleted_at", null)
      .single();

    if (fetchErr || !ticket) {
      return jsonResponse({ success: false, message: "Ticket não encontrado" }, 404);
    }

    // ── PERMISSION CHECK ──────────────────────────────────────────────
    // Admin (1000) / Manager (950): full access
    // Support (900) / CS (775) / Internal (600+): can message if requester, assigned, or in queue
    // Client (< 600): own tickets only

    if (level < 600) {
      // Client: only own tickets
      if (author_user_id && String(ticket.requester_user_id) !== String(author_user_id)) {
        console.log("support-ticket-messages access denied (client)", { author_user_id, requesterUserId: ticket.requester_user_id });
        return jsonResponse({ success: false, message: "Acesso negado" }, 403);
      }
    } else if (level < 950) {
      // Internal non-manager: check requester, assignment, or queue membership
      const isRequester = author_user_id && String(ticket.requester_user_id) === String(author_user_id);
      const isAssigned = author_user_id && ticket.assigned_to_user_id && String(ticket.assigned_to_user_id) === String(author_user_id);

      let isInQueue = false;
      if (!isRequester && !isAssigned && ticket.current_queue_id && author_user_id) {
        const userIdInt = parseInt(author_user_id);
        if (Number.isFinite(userIdInt)) {
          const { data: memberships } = await db
            .from("support_queue_members")
            .select("queue_id")
            .eq("user_id", userIdInt)
            .eq("is_active", true);
          const memberQueueIds = (memberships || []).map((m: any) => m.queue_id);
          isInQueue = memberQueueIds.includes(ticket.current_queue_id);
        }
      }

      console.log("support-ticket-messages permission check", {
        author_user_id,
        level,
        isRequester,
        isAssigned,
        isInQueue,
        ticketRequester: ticket.requester_user_id,
        ticketAssigned: ticket.assigned_to_user_id,
        ticketQueue: ticket.current_queue_id,
      });

      if (!isRequester && !isAssigned && !isInQueue) {
        return jsonResponse({
          success: false,
          message: "Você não tem permissão para responder este chamado",
          debug: { reason: "not_requester_not_assigned_not_in_queue", level },
        }, 403);
      }
    }
    // 950+ (Manager/Admin): full access, no check needed

    // Internal notes only for level >= 775
    const isInternal = is_internal_note === true && level >= 775;

    // Clients cannot create internal notes
    if (is_internal_note === true && level < 775) {
      return jsonResponse({ success: false, message: "Sem permissão para nota interna" }, 403);
    }

    const authorType = body.author_type || getAuthorType(level);

    console.log("support-ticket-messages inserting", {
      ticket_id,
      author_user_id,
      author_name,
      authorType,
      isInternal,
      bodyLength: messageBody.length,
    });

    const { data: message, error: insertErr } = await db
      .from("support_ticket_messages")
      .insert({
        ticket_id,
        author_user_id: author_user_id || null,
        author_level: level,
        author_name,
        author_email: author_email || null,
        author_type: authorType,
        is_internal_note: isInternal,
        body: messageBody,
        metadata: body.metadata || {},
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert message error:", insertErr);
      return jsonResponse({ success: false, message: insertErr.message }, 500);
    }

    // Update ticket timestamps
    const updateFields: any = {};
    if (level < 600) {
      updateFields.last_customer_message_at = new Date().toISOString();
      // If ticket was aguardando_cliente, move back to em_atendimento
      if (ticket.status === "aguardando_cliente") {
        updateFields.status = "em_atendimento";
        await db.from("support_ticket_status_history").insert({
          ticket_id,
          old_status: "aguardando_cliente",
          new_status: "em_atendimento",
          changed_by_name: "Sistema",
          reason: "Cliente respondeu",
        });
      }
    } else {
      updateFields.last_internal_update_at = new Date().toISOString();
      // Record first response if not yet
      const { data: ticketFull } = await db
        .from("support_tickets")
        .select("first_response_at")
        .eq("id", ticket_id)
        .single();

      if (ticketFull && !ticketFull.first_response_at && !isInternal) {
        updateFields.first_response_at = new Date().toISOString();
      }
    }

    if (Object.keys(updateFields).length > 0) {
      await db.from("support_tickets").update(updateFields).eq("id", ticket_id);
    }

    // Record event
    await db.from("support_ticket_events").insert({
      event_name: "ticket.message_added",
      entity_type: "support_ticket",
      entity_id: ticket_id,
      actor_type: authorType,
      actor_id: author_user_id || null,
      user_id: author_user_id || null,
      metadata: {
        is_internal_note: isInternal,
        message_id: message.id,
      },
      ip_address: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return jsonResponse({
      success: true,
      data: message,
      message: isInternal ? "Nota interna adicionada" : "Mensagem adicionada",
    }, 201);
  } catch (err) {
    console.error("support-ticket-messages error:", err);
    return jsonResponse({ success: false, message: "Erro interno", errors: [String(err)] }, 500);
  }
});
