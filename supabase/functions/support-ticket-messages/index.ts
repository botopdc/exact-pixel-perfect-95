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

// UUID v4 regex for validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toUuidOrNull(val: unknown): string | null {
  if (!val) return null;
  const s = String(val);
  return UUID_RE.test(s) ? s : null;
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

    // ── Normalize payload ───────────────────────────────────────────────
    const ticket_id = body.ticket_id;
    const messageBody = body.body;
    const is_internal_note = body.is_internal_note;
    const author_name = body.author_name;
    const author_email = body.author_email || null;

    // Accept both naming conventions
    const rawAuthorUserId = body.author_user_id ?? body.user_id ?? null;
    const level = body.author_level ?? body.user_level ?? 1;

    // author_user_id column is UUID — only write valid UUIDs, else null
    const authorUserIdUuid = toUuidOrNull(rawAuthorUserId);
    // Keep the raw integer for permission checks and metadata
    const authorUserIdRaw = rawAuthorUserId != null ? String(rawAuthorUserId) : null;

    console.log("support-ticket-messages normalized context", {
      rawAuthorUserId,
      authorUserIdUuid,
      authorUserIdRaw,
      author_name,
      author_email,
      level,
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
    if (level < 600) {
      // Client: only own tickets
      if (authorUserIdRaw && String(ticket.requester_user_id) !== authorUserIdRaw) {
        console.log("support-ticket-messages access denied (client)", { authorUserIdRaw, requesterUserId: ticket.requester_user_id });
        return jsonResponse({ success: false, message: "Acesso negado" }, 403);
      }
    } else if (level < 950) {
      const isRequester = authorUserIdRaw && String(ticket.requester_user_id) === authorUserIdRaw;
      const isAssigned = authorUserIdRaw && ticket.assigned_to_user_id && String(ticket.assigned_to_user_id) === authorUserIdRaw;

      let isInQueue = false;
      if (!isRequester && !isAssigned && ticket.current_queue_id && authorUserIdRaw) {
        const userIdInt = parseInt(authorUserIdRaw);
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
        authorUserIdRaw, level, isRequester, isAssigned, isInQueue,
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
    // 950+ full access

    const isInternal = is_internal_note === true && level >= 775;
    if (is_internal_note === true && level < 775) {
      return jsonResponse({ success: false, message: "Sem permissão para nota interna" }, 403);
    }

    const authorType = body.author_type || getAuthorType(level);

    // ── Build message insert payload ────────────────────────────────────
    const messageInsertPayload = {
      ticket_id,
      author_user_id: authorUserIdUuid,       // UUID or null — NEVER integer
      author_level: level,
      author_name,
      author_email,
      author_type: authorType,
      is_internal_note: isInternal,
      body: messageBody,
      metadata: {
        ...(body.metadata || {}),
        // Preserve integer user id for traceability
        ...(authorUserIdRaw && !authorUserIdUuid ? { external_user_id: authorUserIdRaw } : {}),
      },
    };

    console.log("support-ticket-messages message insert payload", messageInsertPayload);

    const { data: message, error: insertErr } = await db
      .from("support_ticket_messages")
      .insert(messageInsertPayload)
      .select()
      .single();

    if (insertErr) {
      console.error("support-ticket-messages insert error:", insertErr);
      return jsonResponse({ success: false, message: insertErr.message }, 500);
    }

    // ── Update ticket timestamps ────────────────────────────────────────
    const updateFields: any = {};
    if (level < 600) {
      updateFields.last_customer_message_at = new Date().toISOString();
      if (ticket.status === "aguardando_cliente") {
        updateFields.status = "em_atendimento";
        const statusPayload = {
          ticket_id,
          old_status: "aguardando_cliente",
          new_status: "em_atendimento",
          changed_by_name: "Sistema",
          reason: "Cliente respondeu",
          // changed_by_user_id is UUID — only write valid UUID
          changed_by_user_id: authorUserIdUuid,
        };
        console.log("support-ticket-messages status history payload", statusPayload);
        await db.from("support_ticket_status_history").insert(statusPayload);
      }
    } else {
      updateFields.last_internal_update_at = new Date().toISOString();
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

    // ── Record event (actor_id and user_id are TEXT — safe for integers) ─
    const eventPayload = {
      event_name: "ticket.message_added",
      entity_type: "support_ticket",
      entity_id: ticket_id,
      actor_type: authorType,
      actor_id: authorUserIdRaw,   // TEXT column — integer string is fine
      user_id: authorUserIdRaw,    // TEXT column — integer string is fine
      metadata: {
        is_internal_note: isInternal,
        message_id: message.id,
      },
      ip_address: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    };
    console.log("support-ticket-messages event payload", eventPayload);
    await db.from("support_ticket_events").insert(eventPayload);

    return jsonResponse({
      success: true,
      data: message,
      message: isInternal ? "Nota interna adicionada" : "Mensagem adicionada",
    }, 201);
  } catch (err) {
    console.error("support-ticket-messages error:", err);
    return jsonResponse({ success: false, message: String(err), errors: [String(err)] }, 500);
  }
});
