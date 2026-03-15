// ============================================================================
// EDGE FUNCTION: support-ticket-update
// Queue-based model: status ≠ queue, escalation = queue change
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

type ActionHandler = (db: any, ticket: any, body: any, req: Request) => Promise<Response>;

async function recordStatusChange(db: any, ticketId: string, oldStatus: string, newStatus: string, userId: string | null, userName: string | null, reason?: string) {
  await db.from("support_ticket_status_history").insert({
    ticket_id: ticketId, old_status: oldStatus, new_status: newStatus,
    changed_by_user_id: userId, changed_by_name: userName, reason: reason || null,
  });
}

async function recordEvent(db: any, eventName: string, entityId: string, actorType: string, actorId: string | null, metadata: any, req: Request) {
  await db.from("support_ticket_events").insert({
    event_name: eventName, entity_type: "support_ticket", entity_id: entityId,
    actor_type: actorType, actor_id: actorId, user_id: actorId, metadata,
    ip_address: req.headers.get("x-forwarded-for") || null,
    user_agent: req.headers.get("user-agent") || null,
  });
}

async function updateTicket(db: any, ticketId: string, fields: any) {
  const { data, error } = await db.from("support_tickets").update(fields).eq("id", ticketId).select().single();
  return { data, error };
}

async function resolveQueueId(db: any, code: string): Promise<string | null> {
  const { data } = await db.from("support_queues").select("id").eq("code", code).single();
  return data?.id || null;
}

function getActorType(level: number): string {
  if (level >= 950) return "manager";
  if (level >= 900) return "support";
  if (level >= 775) return "cs";
  return "client";
}

// ── assign: user assumes ticket ─────────────────────────────────────────
const handleAssign: ActionHandler = async (db, ticket, body, req) => {
  if ((body.actor_level || 0) < 900) return jsonResponse({ success: false, message: "Sem permissão" }, 403);

  const now = new Date().toISOString();
  const updates: any = {
    assigned_to_user_id: body.actor_user_id,
    assigned_to_name: body.actor_name,
    assigned_at: now,
  };
  if (ticket.status === "novo" || ticket.status === "reaberto") {
    updates.status = "em_atendimento";
  }
  if (!ticket.first_response_at) {
    updates.first_response_at = now;
  }

  const { data, error } = await updateTicket(db, ticket.id, updates);
  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await db.from("support_ticket_assignments").insert({
    ticket_id: ticket.id,
    from_user_id: ticket.assigned_to_user_id, from_user_name: ticket.assigned_to_name,
    to_user_id: body.actor_user_id, to_user_name: body.actor_name,
    from_queue: ticket.current_queue, to_queue: ticket.current_queue,
    reason: "Assumiu o ticket",
    assigned_by_user_id: body.actor_user_id, assigned_by_name: body.actor_name,
  });

  if (updates.status && updates.status !== ticket.status) {
    await recordStatusChange(db, ticket.id, ticket.status, updates.status, body.actor_user_id, body.actor_name);
  }
  await recordEvent(db, "ticket.assigned", ticket.id, getActorType(body.actor_level), body.actor_user_id, {
    to_user_name: body.actor_name,
  }, req);

  return jsonResponse({ success: true, data, message: "Ticket assumido" });
};

// ── start: begin working ────────────────────────────────────────────────
const handleStart: ActionHandler = async (db, ticket, body, req) => {
  if ((body.actor_level || 0) < 900) return jsonResponse({ success: false, message: "Sem permissão" }, 403);

  const now = new Date().toISOString();
  const updates: any = {
    status: "em_atendimento",
    assigned_to_user_id: body.actor_user_id,
    assigned_to_name: body.actor_name,
    assigned_at: now,
  };
  if (!ticket.first_response_at) updates.first_response_at = now;

  const { data, error } = await updateTicket(db, ticket.id, updates);
  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordStatusChange(db, ticket.id, ticket.status, "em_atendimento", body.actor_user_id, body.actor_name);
  await db.from("support_ticket_assignments").insert({
    ticket_id: ticket.id,
    from_user_id: ticket.assigned_to_user_id, from_user_name: ticket.assigned_to_name,
    to_user_id: body.actor_user_id, to_user_name: body.actor_name,
    reason: "Assumiu o ticket",
    assigned_by_user_id: body.actor_user_id, assigned_by_name: body.actor_name,
  });
  await recordEvent(db, "ticket.status_changed", ticket.id, getActorType(body.actor_level), body.actor_user_id, {
    old_status: ticket.status, new_status: "em_atendimento",
  }, req);

  return jsonResponse({ success: true, data, message: "Ticket em atendimento" });
};

// ── escalate: change queue, keep status as em_atendimento ───────────────
const handleEscalate: ActionHandler = async (db, ticket, body, req) => {
  if ((body.actor_level || 0) < 900) return jsonResponse({ success: false, message: "Sem permissão para escalar" }, 403);

  const targetLevel = body.target_level;
  if (!["N2", "N3"].includes(targetLevel)) {
    return jsonResponse({ success: false, message: "target_level deve ser N2 ou N3" }, 422);
  }

  const targetQueueId = await resolveQueueId(db, targetLevel);
  if (!targetQueueId) return jsonResponse({ success: false, message: `Fila ${targetLevel} não encontrada` }, 422);

  // Escalation does NOT change status to "escalado_*"
  // Status stays as em_atendimento, queue changes
  const { data, error } = await updateTicket(db, ticket.id, {
    support_level: targetLevel,
    current_queue: targetLevel,
    current_queue_id: targetQueueId,
    current_support_level: targetLevel,
    assigned_to_user_id: null,
    assigned_to_name: null,
    assigned_at: null,
  });

  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  // Record queue history
  await db.from("support_ticket_queue_history").insert({
    ticket_id: ticket.id,
    from_queue_id: ticket.current_queue_id,
    to_queue_id: targetQueueId,
    from_support_level: ticket.current_support_level || ticket.support_level,
    to_support_level: targetLevel,
    changed_by_user_id: body.actor_user_id ? parseInt(body.actor_user_id) : null,
    changed_by_name: body.actor_name,
    reason: body.reason || `Escalado para ${targetLevel}`,
  });

  await db.from("support_ticket_assignments").insert({
    ticket_id: ticket.id,
    from_user_id: ticket.assigned_to_user_id, from_user_name: ticket.assigned_to_name,
    from_queue: ticket.current_queue, to_queue: targetLevel,
    from_support_level: ticket.support_level, to_support_level: targetLevel,
    reason: body.reason || `Escalado para ${targetLevel}`,
    assigned_by_user_id: body.actor_user_id, assigned_by_name: body.actor_name,
  });

  await recordEvent(db, "ticket.escalated", ticket.id, getActorType(body.actor_level), body.actor_user_id, {
    from_level: ticket.support_level, to_level: targetLevel, reason: body.reason,
    from_queue: ticket.current_queue, to_queue: targetLevel,
  }, req);

  return jsonResponse({ success: true, data, message: `Ticket escalado para ${targetLevel}` });
};

// ── resolve: mark as resolved, move to CS queue ─────────────────────────
const handleResolve: ActionHandler = async (db, ticket, body, req) => {
  if ((body.actor_level || 0) < 900) return jsonResponse({ success: false, message: "Sem permissão para resolver" }, 403);
  if (!body.reason?.trim()) return jsonResponse({ success: false, message: "resolution_summary (reason) obrigatório" }, 422);

  const csQueueId = await resolveQueueId(db, "CS");
  const now = new Date().toISOString();

  const { data, error } = await updateTicket(db, ticket.id, {
    status: "resolvido_suporte",
    resolved_at: now,
    support_resolved_by: body.actor_user_id,
    resolution_summary: body.reason.trim(),
    // Move to CS queue, clear assignee
    current_queue: "CS",
    current_queue_id: csQueueId,
    current_support_level: "CS",
    assigned_to_user_id: null,
    assigned_to_name: null,
    assigned_at: null,
  });

  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  if (csQueueId) {
    await db.from("support_ticket_queue_history").insert({
      ticket_id: ticket.id,
      from_queue_id: ticket.current_queue_id,
      to_queue_id: csQueueId,
      from_support_level: ticket.current_support_level || ticket.support_level,
      to_support_level: "CS",
      changed_by_user_id: body.actor_user_id ? parseInt(body.actor_user_id) : null,
      changed_by_name: body.actor_name,
      reason: "Ticket resolvido — movido para CS",
    });
  }

  await recordStatusChange(db, ticket.id, ticket.status, "resolvido_suporte", body.actor_user_id, body.actor_name, body.reason);
  await recordEvent(db, "ticket.resolved", ticket.id, "support", body.actor_user_id, {
    resolution_summary: body.reason,
  }, req);

  return jsonResponse({ success: true, data, message: "Ticket resolvido pelo suporte — aguardando CS" });
};

// ── close (CS only) ─────────────────────────────────────────────────────
const handleClose: ActionHandler = async (db, ticket, body, req) => {
  if ((body.actor_level || 0) < 775) return jsonResponse({ success: false, message: "Apenas CS pode encerrar" }, 403);
  if (!body.reason?.trim()) return jsonResponse({ success: false, message: "close_reason (reason) obrigatório" }, 422);

  const now = new Date().toISOString();
  const { data, error } = await updateTicket(db, ticket.id, {
    status: "encerrado_cs",
    closed_at: now,
    cs_closed_by: body.actor_user_id,
    close_reason: body.reason.trim(),
  });

  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordStatusChange(db, ticket.id, ticket.status, "encerrado_cs", body.actor_user_id, body.actor_name, body.reason);
  await recordEvent(db, "ticket.closed", ticket.id, "cs", body.actor_user_id, { close_reason: body.reason }, req);

  return jsonResponse({ success: true, data, message: "Ticket encerrado pelo CS" });
};

// ── reopen ──────────────────────────────────────────────────────────────
const handleReopen: ActionHandler = async (db, ticket, body, req) => {
  if ((body.actor_level || 0) < 775) return jsonResponse({ success: false, message: "Sem permissão para reabrir" }, 403);

  const n1QueueId = await resolveQueueId(db, "N1");

  const { data, error } = await updateTicket(db, ticket.id, {
    status: "reaberto",
    current_queue: "N1",
    current_queue_id: n1QueueId,
    current_support_level: "N1",
    support_level: "N1",
    resolved_at: null,
    closed_at: null,
    support_resolved_by: null,
    cs_closed_by: null,
    resolution_summary: null,
    close_reason: null,
    assigned_to_user_id: null,
    assigned_to_name: null,
    assigned_at: null,
  });

  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  if (n1QueueId) {
    await db.from("support_ticket_queue_history").insert({
      ticket_id: ticket.id,
      from_queue_id: ticket.current_queue_id,
      to_queue_id: n1QueueId,
      from_support_level: ticket.current_support_level || "CS",
      to_support_level: "N1",
      changed_by_user_id: body.actor_user_id ? parseInt(body.actor_user_id) : null,
      changed_by_name: body.actor_name,
      reason: body.reason || "Ticket reaberto",
    });
  }

  await recordStatusChange(db, ticket.id, ticket.status, "reaberto", body.actor_user_id, body.actor_name, body.reason);
  await recordEvent(db, "ticket.reopened", ticket.id, getActorType(body.actor_level), body.actor_user_id, { reason: body.reason }, req);

  return jsonResponse({ success: true, data, message: "Ticket reaberto" });
};

// ── cancel ──────────────────────────────────────────────────────────────
const handleCancel: ActionHandler = async (db, ticket, body, req) => {
  if ((body.actor_level || 0) < 950) return jsonResponse({ success: false, message: "Sem permissão para cancelar" }, 403);

  const { data, error } = await updateTicket(db, ticket.id, { status: "cancelado" });
  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordStatusChange(db, ticket.id, ticket.status, "cancelado", body.actor_user_id, body.actor_name, body.reason);
  await recordEvent(db, "ticket.cancelled", ticket.id, getActorType(body.actor_level), body.actor_user_id, { reason: body.reason }, req);

  return jsonResponse({ success: true, data, message: "Ticket cancelado" });
};

// ── waiting ─────────────────────────────────────────────────────────────
const handleWaiting: ActionHandler = async (db, ticket, body, req) => {
  if ((body.actor_level || 0) < 900) return jsonResponse({ success: false, message: "Sem permissão" }, 403);

  const waitType = body.action === "wait_third_party" ? "aguardando_terceiro" : "aguardando_cliente";
  const { data, error } = await updateTicket(db, ticket.id, { status: waitType });
  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordStatusChange(db, ticket.id, ticket.status, waitType, body.actor_user_id, body.actor_name, body.reason);
  await recordEvent(db, "ticket.status_changed", ticket.id, "support", body.actor_user_id, {
    old_status: ticket.status, new_status: waitType,
  }, req);

  return jsonResponse({ success: true, data, message: `Status alterado para ${waitType}` });
};

// ── transfer ────────────────────────────────────────────────────────────
const handleTransfer: ActionHandler = async (db, ticket, body, req) => {
  if ((body.actor_level || 0) < 900) return jsonResponse({ success: false, message: "Sem permissão para transferir" }, 403);

  const updates: any = {};
  if (body.to_queue) {
    const queueId = await resolveQueueId(db, body.to_queue);
    if (queueId) {
      updates.current_queue = body.to_queue;
      updates.current_queue_id = queueId;
      updates.current_support_level = body.to_queue;
      updates.support_level = body.to_queue;
    }
  }
  if (body.to_user_id !== undefined) {
    updates.assigned_to_user_id = body.to_user_id || null;
    updates.assigned_to_name = body.to_user_name || null;
    updates.assigned_at = body.to_user_id ? new Date().toISOString() : null;
  }

  const { data, error } = await updateTicket(db, ticket.id, updates);
  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await db.from("support_ticket_assignments").insert({
    ticket_id: ticket.id,
    from_user_id: ticket.assigned_to_user_id, from_user_name: ticket.assigned_to_name,
    to_user_id: body.to_user_id || null, to_user_name: body.to_user_name || null,
    from_queue: ticket.current_queue, to_queue: body.to_queue || ticket.current_queue,
    reason: body.reason,
    assigned_by_user_id: body.actor_user_id, assigned_by_name: body.actor_name,
  });

  if (body.to_queue && body.to_queue !== ticket.current_queue) {
    const toQueueId = await resolveQueueId(db, body.to_queue);
    if (toQueueId) {
      await db.from("support_ticket_queue_history").insert({
        ticket_id: ticket.id,
        from_queue_id: ticket.current_queue_id,
        to_queue_id: toQueueId,
        from_support_level: ticket.current_support_level,
        to_support_level: body.to_queue,
        changed_by_user_id: body.actor_user_id ? parseInt(body.actor_user_id) : null,
        changed_by_name: body.actor_name,
        reason: body.reason,
      });
    }
  }

  await recordEvent(db, "ticket.transferred", ticket.id, "manager", body.actor_user_id, {
    from_queue: ticket.current_queue, to_queue: body.to_queue,
    to_user_name: body.to_user_name,
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
  wait_customer: handleWaiting,
  wait_third_party: handleWaiting,
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
