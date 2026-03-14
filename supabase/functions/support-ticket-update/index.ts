// ============================================================================
// EDGE FUNCTION: support-ticket-update
// Handles: status changes, assign, transfer, escalate, resolve, close, reopen
// Action-based router via body.action
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

type ActionHandler = (
  db: any,
  ticket: any,
  body: any,
  req: Request
) => Promise<Response>;

// ── helpers ──────────────────────────────────────────────────────────────

async function recordStatusChange(
  db: any,
  ticketId: string,
  oldStatus: string,
  newStatus: string,
  userId: string | null,
  userName: string | null,
  reason?: string
) {
  await db.from("support_ticket_status_history").insert({
    ticket_id: ticketId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by_user_id: userId,
    changed_by_name: userName,
    reason: reason || null,
  });
}

async function recordEvent(
  db: any,
  eventName: string,
  entityId: string,
  actorType: string,
  actorId: string | null,
  metadata: any,
  req: Request
) {
  await db.from("support_ticket_events").insert({
    event_name: eventName,
    entity_type: "support_ticket",
    entity_id: entityId,
    actor_type: actorType,
    actor_id: actorId,
    user_id: actorId,
    metadata,
    ip_address: req.headers.get("x-forwarded-for") || null,
    user_agent: req.headers.get("user-agent") || null,
  });
}

async function updateTicket(db: any, ticketId: string, fields: any) {
  const { data, error } = await db
    .from("support_tickets")
    .update(fields)
    .eq("id", ticketId)
    .select()
    .single();
  return { data, error };
}

function getActorType(level: number): string {
  if (level >= 1000) return "manager";
  if (level >= 950) return "manager";
  if (level >= 900) return "support";
  if (level >= 775) return "cs";
  return "client";
}

// ── action: assign ──────────────────────────────────────────────────────

const handleAssign: ActionHandler = async (db, ticket, body, req) => {
  if ((body.user_level || 0) < 900) {
    return jsonResponse({ success: false, message: "Sem permissão para atribuir" }, 403);
  }

  const updates: any = {
    assigned_to_user_id: body.to_user_id || null,
    assigned_to_name: body.to_user_name || null,
    assigned_team: body.assigned_team || ticket.assigned_team,
  };

  // If assigning for first time, move to triagem
  if (ticket.status === "novo") {
    updates.status = "triagem";
  }

  const { data, error } = await updateTicket(db, ticket.id, updates);
  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  // Record assignment
  await db.from("support_ticket_assignments").insert({
    ticket_id: ticket.id,
    from_user_id: ticket.assigned_to_user_id,
    from_user_name: ticket.assigned_to_name,
    to_user_id: body.to_user_id,
    to_user_name: body.to_user_name,
    from_queue: ticket.current_queue,
    to_queue: body.to_queue || ticket.current_queue,
    reason: body.reason || null,
    assigned_by_user_id: body.actor_user_id,
    assigned_by_name: body.actor_name,
  });

  if (updates.status && updates.status !== ticket.status) {
    await recordStatusChange(db, ticket.id, ticket.status, updates.status, body.actor_user_id, body.actor_name);
  }

  await recordEvent(db, "ticket.assigned", ticket.id, getActorType(body.user_level), body.actor_user_id, {
    to_user_id: body.to_user_id, to_user_name: body.to_user_name,
  }, req);

  return jsonResponse({ success: true, data, message: "Ticket atribuído" });
};

// ── action: start (assume and start working) ────────────────────────────

const handleStart: ActionHandler = async (db, ticket, body, req) => {
  if ((body.user_level || 0) < 900) {
    return jsonResponse({ success: false, message: "Sem permissão" }, 403);
  }

  const now = new Date().toISOString();
  const updates: any = {
    status: "em_atendimento",
    assigned_to_user_id: body.actor_user_id,
    assigned_to_name: body.actor_name,
  };

  // Record first response if not yet
  if (!ticket.first_response_at) {
    updates.first_response_at = now;
  }

  const { data, error } = await updateTicket(db, ticket.id, updates);
  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordStatusChange(db, ticket.id, ticket.status, "em_atendimento", body.actor_user_id, body.actor_name);

  await db.from("support_ticket_assignments").insert({
    ticket_id: ticket.id,
    from_user_id: ticket.assigned_to_user_id,
    from_user_name: ticket.assigned_to_name,
    to_user_id: body.actor_user_id,
    to_user_name: body.actor_name,
    reason: "Assumiu o ticket",
    assigned_by_user_id: body.actor_user_id,
    assigned_by_name: body.actor_name,
  });

  await recordEvent(db, "ticket.status_changed", ticket.id, getActorType(body.user_level), body.actor_user_id, {
    old_status: ticket.status, new_status: "em_atendimento",
  }, req);

  return jsonResponse({ success: true, data, message: "Ticket em atendimento" });
};

// ── action: escalate ────────────────────────────────────────────────────

const handleEscalate: ActionHandler = async (db, ticket, body, req) => {
  if ((body.user_level || 0) < 900) {
    return jsonResponse({ success: false, message: "Sem permissão para escalar" }, 403);
  }

  const targetLevel = body.target_level; // "N2" or "N3"
  if (!["N2", "N3"].includes(targetLevel)) {
    return jsonResponse({ success: false, message: "target_level deve ser N2 ou N3" }, 422);
  }

  const newStatus = targetLevel === "N2" ? "escalado_n2" : "escalado_n3";
  const { data, error } = await updateTicket(db, ticket.id, {
    status: newStatus,
    support_level: targetLevel,
    current_queue: targetLevel,
    assigned_to_user_id: null,
    assigned_to_name: null,
  });

  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordStatusChange(db, ticket.id, ticket.status, newStatus, body.actor_user_id, body.actor_name, body.reason);

  await db.from("support_ticket_assignments").insert({
    ticket_id: ticket.id,
    from_user_id: ticket.assigned_to_user_id,
    from_user_name: ticket.assigned_to_name,
    from_queue: ticket.current_queue,
    to_queue: targetLevel,
    from_support_level: ticket.support_level,
    to_support_level: targetLevel,
    reason: body.reason || `Escalado para ${targetLevel}`,
    assigned_by_user_id: body.actor_user_id,
    assigned_by_name: body.actor_name,
  });

  await recordEvent(db, "ticket.escalated", ticket.id, getActorType(body.user_level), body.actor_user_id, {
    from_level: ticket.support_level, to_level: targetLevel, reason: body.reason,
  }, req);

  return jsonResponse({ success: true, data, message: `Ticket escalado para ${targetLevel}` });
};

// ── action: resolve ─────────────────────────────────────────────────────

const handleResolve: ActionHandler = async (db, ticket, body, req) => {
  if ((body.user_level || 0) < 900) {
    return jsonResponse({ success: false, message: "Sem permissão para resolver" }, 403);
  }

  const now = new Date().toISOString();
  const { data, error } = await updateTicket(db, ticket.id, {
    status: "resolvido_suporte",
    resolved_at: now,
    support_resolved_by: body.actor_user_id,
  });

  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordStatusChange(db, ticket.id, ticket.status, "resolvido_suporte", body.actor_user_id, body.actor_name, body.reason);
  await recordEvent(db, "ticket.resolved", ticket.id, "support", body.actor_user_id, {
    resolution_note: body.reason,
  }, req);

  return jsonResponse({ success: true, data, message: "Ticket resolvido pelo suporte" });
};

// ── action: close (CS only) ─────────────────────────────────────────────

const handleClose: ActionHandler = async (db, ticket, body, req) => {
  if ((body.user_level || 0) < 775) {
    return jsonResponse({ success: false, message: "Apenas CS pode encerrar tickets" }, 403);
  }

  const now = new Date().toISOString();
  const { data, error } = await updateTicket(db, ticket.id, {
    status: "encerrado_cs",
    closed_at: now,
    cs_closed_by: body.actor_user_id,
  });

  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordStatusChange(db, ticket.id, ticket.status, "encerrado_cs", body.actor_user_id, body.actor_name, body.reason);
  await recordEvent(db, "ticket.closed", ticket.id, "cs", body.actor_user_id, {
    closure_note: body.reason,
  }, req);

  return jsonResponse({ success: true, data, message: "Ticket encerrado pelo CS" });
};

// ── action: reopen ──────────────────────────────────────────────────────

const handleReopen: ActionHandler = async (db, ticket, body, req) => {
  if ((body.user_level || 0) < 775) {
    return jsonResponse({ success: false, message: "Sem permissão para reabrir" }, 403);
  }

  const { data, error } = await updateTicket(db, ticket.id, {
    status: "reaberto",
    current_queue: ticket.current_queue || "N1",
    resolved_at: null,
    closed_at: null,
    support_resolved_by: null,
    cs_closed_by: null,
  });

  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordStatusChange(db, ticket.id, ticket.status, "reaberto", body.actor_user_id, body.actor_name, body.reason);
  await recordEvent(db, "ticket.reopened", ticket.id, getActorType(body.user_level), body.actor_user_id, {
    reason: body.reason,
  }, req);

  return jsonResponse({ success: true, data, message: "Ticket reaberto" });
};

// ── action: cancel ──────────────────────────────────────────────────────

const handleCancel: ActionHandler = async (db, ticket, body, req) => {
  if ((body.user_level || 0) < 950) {
    return jsonResponse({ success: false, message: "Sem permissão para cancelar" }, 403);
  }

  const { data, error } = await updateTicket(db, ticket.id, {
    status: "cancelado",
  });

  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordStatusChange(db, ticket.id, ticket.status, "cancelado", body.actor_user_id, body.actor_name, body.reason);
  await recordEvent(db, "ticket.cancelled", ticket.id, getActorType(body.user_level), body.actor_user_id, {
    reason: body.reason,
  }, req);

  return jsonResponse({ success: true, data, message: "Ticket cancelado" });
};

// ── action: waiting (aguardando_cliente or aguardando_terceiro) ─────────

const handleWaiting: ActionHandler = async (db, ticket, body, req) => {
  if ((body.user_level || 0) < 900) {
    return jsonResponse({ success: false, message: "Sem permissão" }, 403);
  }

  const waitType = body.wait_type === "third_party" ? "aguardando_terceiro" : "aguardando_cliente";

  const { data, error } = await updateTicket(db, ticket.id, { status: waitType });
  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordStatusChange(db, ticket.id, ticket.status, waitType, body.actor_user_id, body.actor_name, body.reason);
  await recordEvent(db, "ticket.status_changed", ticket.id, "support", body.actor_user_id, {
    old_status: ticket.status, new_status: waitType,
  }, req);

  return jsonResponse({ success: true, data, message: `Status alterado para ${waitType}` });
};

// ── action: transfer ────────────────────────────────────────────────────

const handleTransfer: ActionHandler = async (db, ticket, body, req) => {
  if ((body.user_level || 0) < 950) {
    return jsonResponse({ success: false, message: "Sem permissão para transferir" }, 403);
  }

  const updates: any = {};
  if (body.to_queue) updates.current_queue = body.to_queue;
  if (body.to_support_level) updates.support_level = body.to_support_level;
  if (body.to_user_id !== undefined) {
    updates.assigned_to_user_id = body.to_user_id || null;
    updates.assigned_to_name = body.to_user_name || null;
  }

  const { data, error } = await updateTicket(db, ticket.id, updates);
  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await db.from("support_ticket_assignments").insert({
    ticket_id: ticket.id,
    from_user_id: ticket.assigned_to_user_id,
    from_user_name: ticket.assigned_to_name,
    to_user_id: body.to_user_id || null,
    to_user_name: body.to_user_name || null,
    from_queue: ticket.current_queue,
    to_queue: body.to_queue || ticket.current_queue,
    from_support_level: ticket.support_level,
    to_support_level: body.to_support_level || ticket.support_level,
    reason: body.reason,
    assigned_by_user_id: body.actor_user_id,
    assigned_by_name: body.actor_name,
  });

  await recordEvent(db, "ticket.transferred", ticket.id, "manager", body.actor_user_id, {
    from_queue: ticket.current_queue, to_queue: body.to_queue,
  }, req);

  return jsonResponse({ success: true, data, message: "Ticket transferido" });
};

// ── router ──────────────────────────────────────────────────────────────

const ACTIONS: Record<string, ActionHandler> = {
  assign: handleAssign,
  start: handleStart,
  escalate: handleEscalate,
  resolve: handleResolve,
  close: handleClose,
  reopen: handleReopen,
  cancel: handleCancel,
  waiting: handleWaiting,
  transfer: handleTransfer,
};

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

    const { action, ticket_id } = body;

    if (!action || !ticket_id) {
      return jsonResponse({ success: false, message: "action e ticket_id obrigatórios" }, 422);
    }

    const handler = ACTIONS[action];
    if (!handler) {
      return jsonResponse({ success: false, message: `Ação desconhecida: ${action}` }, 422);
    }

    // Fetch ticket
    const { data: ticket, error: fetchError } = await db
      .from("support_tickets")
      .select("*")
      .eq("id", ticket_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !ticket) {
      return jsonResponse({ success: false, message: "Ticket não encontrado" }, 404);
    }

    return await handler(db, ticket, body, req);
  } catch (err) {
    console.error("support-ticket-update error:", err);
    return jsonResponse({ success: false, message: "Erro interno", errors: [String(err)] }, 500);
  }
});
