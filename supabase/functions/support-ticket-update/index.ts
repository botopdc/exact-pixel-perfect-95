// ============================================================================
// EDGE FUNCTION: support-ticket-update
// Queue-based model: status ≠ queue, escalation = queue change
// Source of truth: current_queue_id + current_support_level
// Legacy fields (support_level enum, current_queue enum) written for compat
//
// CRITICAL: Legacy auth uses integer user IDs (e.g. 5).
// All *_user_id columns in support_tickets/assignments/status_history are UUID.
// We MUST NOT write integer IDs to UUID columns — use null + metadata instead.
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

// UUID regex for validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val: unknown): boolean {
  return typeof val === "string" && UUID_RE.test(val);
}

/** Safely convert actor_user_id to UUID or null (for UUID columns) */
function toUuidOrNull(val: unknown): string | null {
  return isValidUuid(val) ? String(val) : null;
}

/** Safely convert actor_user_id to integer or null (for integer columns) */
function toIntOrNull(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

type ActionHandler = (db: any, ticket: any, body: any, req: Request) => Promise<Response>;

async function recordStatusChange(db: any, ticketId: string, oldStatus: string, newStatus: string, actorId: unknown, actorName: string | null, reason?: string) {
  const result = await db.from("support_ticket_status_history").insert({
    ticket_id: ticketId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by_user_id: toUuidOrNull(actorId),
    changed_by_name: actorName,
    reason: reason || null,
  });
  if (result.error) console.error("recordStatusChange error:", result.error.message);
}

async function recordEvent(db: any, eventName: string, entityId: string, actorType: string, actorId: unknown, metadata: any, req: Request) {
  const result = await db.from("support_ticket_events").insert({
    event_name: eventName,
    entity_type: "support_ticket",
    entity_id: entityId,
    actor_type: actorType,
    actor_id: String(actorId ?? ""),
    user_id: String(actorId ?? ""),
    metadata,
    ip_address: req.headers.get("x-forwarded-for") || null,
    user_agent: req.headers.get("user-agent") || null,
  });
  if (result.error) console.error("recordEvent error:", result.error.message);
}

async function updateTicket(db: any, ticketId: string, fields: any) {
  console.log("support-ticket-update updateTicket payload:", JSON.stringify(fields));
  const { data, error } = await db.from("support_tickets").update(fields).eq("id", ticketId).select().single();
  if (error) console.error("support-ticket-update updateTicket error:", error.message);
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

/** Resolve actor UUID: if already UUID return it, if integer look up profiles.legacy_user_id */
async function resolveActorUuid(db: any, actorId: unknown): Promise<string | null> {
  if (isValidUuid(actorId)) return String(actorId);
  const intId = toIntOrNull(actorId);
  if (intId === null) return null;
  const { data } = await db.from("profiles").select("id").eq("legacy_user_id", intId).limit(1).single();
  return data?.id || null;
}

// Helper: notify queue members about an event
async function notifyQueueMembers(db: any, queueId: string, eventName: string, title: string, body: string | null, ticketId: string, publicCode: string) {
  const { data: members } = await db
    .from("support_queue_members")
    .select("user_id, user_id_uuid, user_level")
    .eq("queue_id", queueId)
    .eq("is_active", true);

  if (!members || members.length === 0) return;

  const notifications = members.map((m: any) => ({
    user_id: m.user_id_uuid || String(m.user_id),
    user_level: m.user_level,
    event_name: eventName,
    title,
    body,
    ticket_id: ticketId,
    ticket_public_code: publicCode,
    metadata: {},
  }));

  const result = await db.from("support_notifications").insert(notifications);
  if (result.error) console.error("notifyQueueMembers error:", result.error.message);
}

// Helper: notify specific user
async function notifyUser(db: any, userId: string, userLevel: number, eventName: string, title: string, body: string | null, ticketId: string, publicCode: string) {
  const result = await db.from("support_notifications").insert({
    user_id: String(userId),
    user_level: userLevel,
    event_name: eventName,
    title,
    body,
    ticket_id: ticketId,
    ticket_public_code: publicCode,
    metadata: {},
  });
  if (result.error) console.error("notifyUser error:", result.error.message);
}

// Helper: insert assignment record (UUID columns → null for integer IDs)
async function recordAssignment(db: any, ticketId: string, opts: {
  fromUserId?: unknown;
  fromUserName?: string | null;
  toUserId?: unknown;
  toUserName?: string | null;
  fromQueue?: string | null;
  toQueue?: string | null;
  fromSupportLevel?: string | null;
  toSupportLevel?: string | null;
  reason?: string | null;
  assignedById?: unknown;
  assignedByName?: string | null;
}) {
  const result = await db.from("support_ticket_assignments").insert({
    ticket_id: ticketId,
    from_user_id: toUuidOrNull(opts.fromUserId),
    from_user_name: opts.fromUserName || null,
    to_user_id: toUuidOrNull(opts.toUserId),
    to_user_name: opts.toUserName || null,
    from_queue: opts.fromQueue || null,
    to_queue: opts.toQueue || null,
    from_support_level: opts.fromSupportLevel || null,
    to_support_level: opts.toSupportLevel || null,
    reason: opts.reason || null,
    assigned_by_user_id: toUuidOrNull(opts.assignedById),
    assigned_by_name: opts.assignedByName || null,
  });
  if (result.error) console.error("recordAssignment error:", result.error.message);
}

// ── assign: user assumes ticket ─────────────────────────────────────────
const handleAssign: ActionHandler = async (db, ticket, body, req) => {
  console.log("support-ticket-update [assign]", { actor: body.actor_user_id, actorName: body.actor_name, actorLevel: body.actor_level });
  if ((body.actor_level || 0) < 900) return jsonResponse({ success: false, message: "Sem permissão" }, 403);

  const now = new Date().toISOString();
  // Resolve actor UUID from profiles if integer ID provided
  const actorUuid = await resolveActorUuid(db, body.actor_user_id);
  const updates: any = {
    assigned_to_user_id: actorUuid,
    assigned_to_name: body.actor_name || null,
    assigned_at: now,
    metadata: {
      ...(ticket.metadata || {}),
      assigned_to_legacy_user_id: toIntOrNull(body.actor_user_id),
      assigned_to_uuid: actorUuid,
    },
  };
  if (ticket.status === "novo" || ticket.status === "reaberto") {
    updates.status = "em_atendimento";
  }
  if (!ticket.first_response_at) {
    updates.first_response_at = now;
  }

  const { data, error } = await updateTicket(db, ticket.id, updates);
  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordAssignment(db, ticket.id, {
    fromUserId: ticket.assigned_to_user_id,
    fromUserName: ticket.assigned_to_name,
    toUserId: body.actor_user_id,
    toUserName: body.actor_name,
    fromQueue: ticket.current_support_level,
    toQueue: ticket.current_support_level,
    reason: "Assumiu o ticket",
    assignedById: body.actor_user_id,
    assignedByName: body.actor_name,
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
  console.log("support-ticket-update [start]", { actor: body.actor_user_id, actorName: body.actor_name, actorLevel: body.actor_level });
  if ((body.actor_level || 0) < 900) return jsonResponse({ success: false, message: "Sem permissão" }, 403);

  const now = new Date().toISOString();
  const actorUuid = await resolveActorUuid(db, body.actor_user_id);
  const updates: any = {
    status: "em_atendimento",
    assigned_to_user_id: actorUuid,
    assigned_to_name: body.actor_name || null,
    assigned_at: now,
    metadata: {
      ...(ticket.metadata || {}),
      assigned_to_legacy_user_id: toIntOrNull(body.actor_user_id),
      assigned_to_uuid: actorUuid,
    },
  };
  if (!ticket.first_response_at) updates.first_response_at = now;

  const { data, error } = await updateTicket(db, ticket.id, updates);
  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordStatusChange(db, ticket.id, ticket.status, "em_atendimento", body.actor_user_id, body.actor_name);
  await recordAssignment(db, ticket.id, {
    fromUserId: ticket.assigned_to_user_id,
    fromUserName: ticket.assigned_to_name,
    toUserId: body.actor_user_id,
    toUserName: body.actor_name,
    reason: "Assumiu o ticket",
    assignedById: body.actor_user_id,
    assignedByName: body.actor_name,
  });
  await recordEvent(db, "ticket.status_changed", ticket.id, getActorType(body.actor_level), body.actor_user_id, {
    old_status: ticket.status, new_status: "em_atendimento",
  }, req);

  return jsonResponse({ success: true, data, message: "Ticket em atendimento" });
};

// ── escalate: change queue, keep status as em_atendimento ───────────────
const handleEscalate: ActionHandler = async (db, ticket, body, req) => {
  console.log("support-ticket-update [escalate]", { actor: body.actor_user_id, targetLevel: body.target_level });
  if ((body.actor_level || 0) < 900) return jsonResponse({ success: false, message: "Sem permissão para escalar" }, 403);

  const targetLevel = body.target_level;
  if (!["N2", "N3"].includes(targetLevel)) {
    return jsonResponse({ success: false, message: "target_level deve ser N2 ou N3" }, 422);
  }

  const targetQueueId = await resolveQueueId(db, targetLevel);
  if (!targetQueueId) return jsonResponse({ success: false, message: `Fila ${targetLevel} não encontrada` }, 422);

  const newStatus = ticket.status === "novo" || ticket.status === "reaberto" ? "em_atendimento" : ticket.status;
  const { data, error } = await updateTicket(db, ticket.id, {
    current_queue_id: targetQueueId,
    current_support_level: targetLevel,
    support_level: targetLevel,
    current_queue: targetLevel,
    assigned_to_user_id: null,
    assigned_to_name: null,
    assigned_at: null,
    status: newStatus,
  });

  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await db.from("support_ticket_queue_history").insert({
    ticket_id: ticket.id,
    from_queue_id: ticket.current_queue_id,
    to_queue_id: targetQueueId,
    from_support_level: ticket.current_support_level,
    to_support_level: targetLevel,
    changed_by_user_id: toIntOrNull(body.actor_user_id),
    changed_by_name: body.actor_name,
    reason: body.reason || `Escalado para ${targetLevel}`,
  });

  await recordAssignment(db, ticket.id, {
    fromUserId: ticket.assigned_to_user_id,
    fromUserName: ticket.assigned_to_name,
    fromQueue: ticket.current_support_level,
    toQueue: targetLevel,
    fromSupportLevel: ticket.current_support_level,
    toSupportLevel: targetLevel,
    reason: body.reason || `Escalado para ${targetLevel}`,
    assignedById: body.actor_user_id,
    assignedByName: body.actor_name,
  });

  if (newStatus !== ticket.status) {
    await recordStatusChange(db, ticket.id, ticket.status, newStatus, body.actor_user_id, body.actor_name, `Escalado para ${targetLevel}`);
  }

  await recordEvent(db, "ticket.escalated", ticket.id, getActorType(body.actor_level), body.actor_user_id, {
    from_level: ticket.current_support_level, to_level: targetLevel, reason: body.reason,
  }, req);

  await notifyQueueMembers(db, targetQueueId, "ticket.escalated",
    `Ticket ${ticket.public_code} escalado para ${targetLevel}`,
    `${ticket.title}`, ticket.id, ticket.public_code);

  return jsonResponse({ success: true, data, message: `Ticket escalado para ${targetLevel}` });
};

// ── resolve: mark as resolved, move to CS queue ─────────────────────────
const handleResolve: ActionHandler = async (db, ticket, body, req) => {
  console.log("support-ticket-update [resolve]", { actor: body.actor_user_id, actorLevel: body.actor_level });
  if ((body.actor_level || 0) < 900) return jsonResponse({ success: false, message: "Sem permissão para resolver" }, 403);
  if (!body.reason?.trim()) return jsonResponse({ success: false, message: "resolution_summary (reason) obrigatório" }, 422);

  const csQueueId = await resolveQueueId(db, "CS");
  const now = new Date().toISOString();
  const actorUuid = await resolveActorUuid(db, body.actor_user_id);

  const { data, error } = await updateTicket(db, ticket.id, {
    status: "resolvido_suporte",
    resolved_at: now,
    support_resolved_by: actorUuid,
    // Integer column — safe to store
    resolved_by_user_id: toIntOrNull(body.actor_user_id),
    resolution_summary: body.reason.trim(),
    current_queue_id: csQueueId,
    current_support_level: "CS",
    current_queue: "CS",
    support_level: "N1", // legacy enum doesn't have CS
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
      from_support_level: ticket.current_support_level,
      to_support_level: "CS",
      changed_by_user_id: toIntOrNull(body.actor_user_id),
      changed_by_name: body.actor_name,
      reason: "Ticket resolvido — movido para CS",
    });

    await notifyQueueMembers(db, csQueueId, "ticket.resolved",
      `Ticket ${ticket.public_code} resolvido — aguardando fechamento`,
      `${ticket.title}`, ticket.id, ticket.public_code);
  }

  await recordStatusChange(db, ticket.id, ticket.status, "resolvido_suporte", body.actor_user_id, body.actor_name, body.reason);
  await recordEvent(db, "ticket.resolved", ticket.id, "support", body.actor_user_id, {
    resolution_summary: body.reason,
  }, req);

  return jsonResponse({ success: true, data, message: "Ticket resolvido pelo suporte — aguardando CS" });
};

// ── close (CS only) ─────────────────────────────────────────────────────
const handleClose: ActionHandler = async (db, ticket, body, req) => {
  console.log("support-ticket-update [close]", { actor: body.actor_user_id, actorLevel: body.actor_level });
  if ((body.actor_level || 0) < 775) return jsonResponse({ success: false, message: "Apenas CS pode encerrar" }, 403);
  if (!body.reason?.trim()) return jsonResponse({ success: false, message: "close_reason (reason) obrigatório" }, 422);

  const now = new Date().toISOString();
  const actorUuid = await resolveActorUuid(db, body.actor_user_id);
  const { data, error } = await updateTicket(db, ticket.id, {
    status: "encerrado_cs",
    closed_at: now,
    cs_closed_by: actorUuid,
    closed_by_user_id: toIntOrNull(body.actor_user_id),
    close_reason: body.reason.trim(),
  });

  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordStatusChange(db, ticket.id, ticket.status, "encerrado_cs", body.actor_user_id, body.actor_name, body.reason);
  await recordEvent(db, "ticket.closed", ticket.id, "cs", body.actor_user_id, { close_reason: body.reason }, req);

  return jsonResponse({ success: true, data, message: "Ticket encerrado pelo CS" });
};

// ── reopen ──────────────────────────────────────────────────────────────
const handleReopen: ActionHandler = async (db, ticket, body, req) => {
  console.log("support-ticket-update [reopen]", { actor: body.actor_user_id, actorLevel: body.actor_level });
  if ((body.actor_level || 0) < 775) return jsonResponse({ success: false, message: "Sem permissão para reabrir" }, 403);

  const n1QueueId = await resolveQueueId(db, "N1");

  const { data, error } = await updateTicket(db, ticket.id, {
    status: "reaberto",
    current_queue_id: n1QueueId,
    current_support_level: "N1",
    current_queue: "N1",
    support_level: "N1",
    resolved_at: null,
    closed_at: null,
    support_resolved_by: null,
    cs_closed_by: null,
    resolved_by_user_id: null,
    closed_by_user_id: null,
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
      changed_by_user_id: toIntOrNull(body.actor_user_id),
      changed_by_name: body.actor_name,
      reason: body.reason || "Ticket reaberto",
    });

    await notifyQueueMembers(db, n1QueueId, "ticket.reopened",
      `Ticket ${ticket.public_code} reaberto`,
      `${ticket.title}`, ticket.id, ticket.public_code);
  }

  await recordStatusChange(db, ticket.id, ticket.status, "reaberto", body.actor_user_id, body.actor_name, body.reason);
  await recordEvent(db, "ticket.reopened", ticket.id, getActorType(body.actor_level), body.actor_user_id, { reason: body.reason }, req);

  return jsonResponse({ success: true, data, message: "Ticket reaberto" });
};

// ── cancel ──────────────────────────────────────────────────────────────
const handleCancel: ActionHandler = async (db, ticket, body, req) => {
  console.log("support-ticket-update [cancel]", { actor: body.actor_user_id, actorLevel: body.actor_level });
  if ((body.actor_level || 0) < 950) return jsonResponse({ success: false, message: "Sem permissão para cancelar" }, 403);

  const { data, error } = await updateTicket(db, ticket.id, { status: "cancelado" });
  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordStatusChange(db, ticket.id, ticket.status, "cancelado", body.actor_user_id, body.actor_name, body.reason);
  await recordEvent(db, "ticket.cancelled", ticket.id, getActorType(body.actor_level), body.actor_user_id, { reason: body.reason }, req);

  return jsonResponse({ success: true, data, message: "Ticket cancelado" });
};

// ── waiting ─────────────────────────────────────────────────────────────
const handleWaiting: ActionHandler = async (db, ticket, body, req) => {
  console.log("support-ticket-update [waiting]", { actor: body.actor_user_id, action: body.action });
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

// ── transfer: move to another user or queue ─────────────────────────────
const handleTransfer: ActionHandler = async (db, ticket, body, req) => {
  console.log("support-ticket-update [transfer]", { actor: body.actor_user_id, toQueue: body.to_queue, toUser: body.to_user_id });
  if ((body.actor_level || 0) < 900) return jsonResponse({ success: false, message: "Sem permissão para transferir" }, 403);

  const updates: any = {};
  let targetQueueCode = ticket.current_support_level;

  if (body.to_queue) {
    const queueId = await resolveQueueId(db, body.to_queue);
    if (queueId) {
      updates.current_queue_id = queueId;
      updates.current_support_level = body.to_queue;
      if (["N1", "N2", "N3"].includes(body.to_queue)) {
        updates.support_level = body.to_queue;
        updates.current_queue = body.to_queue;
      } else if (body.to_queue === "CS") {
        updates.current_queue = "CS";
      }
      targetQueueCode = body.to_queue;
    }
  }

  if (body.to_user_id !== undefined) {
    updates.assigned_to_user_id = toUuidOrNull(body.to_user_id);
    updates.assigned_to_name = body.to_user_name || null;
    updates.assigned_at = body.to_user_id ? new Date().toISOString() : null;
    if (!isValidUuid(body.to_user_id) && body.to_user_id) {
      updates.metadata = {
        ...(ticket.metadata || {}),
        assigned_to_legacy_user_id: toIntOrNull(body.to_user_id),
      };
    }
  }

  const { data, error } = await updateTicket(db, ticket.id, updates);
  if (error) return jsonResponse({ success: false, message: error.message }, 500);

  await recordAssignment(db, ticket.id, {
    fromUserId: ticket.assigned_to_user_id,
    fromUserName: ticket.assigned_to_name,
    toUserId: body.to_user_id,
    toUserName: body.to_user_name,
    fromQueue: ticket.current_support_level,
    toQueue: targetQueueCode,
    reason: body.reason,
    assignedById: body.actor_user_id,
    assignedByName: body.actor_name,
  });

  if (body.to_queue && body.to_queue !== ticket.current_support_level) {
    const toQueueId = await resolveQueueId(db, body.to_queue);
    if (toQueueId) {
      await db.from("support_ticket_queue_history").insert({
        ticket_id: ticket.id,
        from_queue_id: ticket.current_queue_id,
        to_queue_id: toQueueId,
        from_support_level: ticket.current_support_level,
        to_support_level: body.to_queue,
        changed_by_user_id: toIntOrNull(body.actor_user_id),
        changed_by_name: body.actor_name,
        reason: body.reason,
      });
    }
  }

  if (body.to_user_id) {
    await notifyUser(db, String(body.to_user_id), body.to_user_level || 900,
      "ticket.assigned",
      `Ticket ${ticket.public_code} atribuído a você`,
      `${ticket.title}`, ticket.id, ticket.public_code);
  }

  await recordEvent(db, "ticket.transferred", ticket.id, "manager", body.actor_user_id, {
    from_queue: ticket.current_support_level, to_queue: body.to_queue,
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

    console.log("support-ticket-update start", {
      action,
      ticket_id,
      actor_user_id: body.actor_user_id,
      actor_name: body.actor_name,
      actor_level: body.actor_level,
      isActorUuid: isValidUuid(body.actor_user_id),
    });

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
  } catch (err: any) {
    console.error("support-ticket-update FATAL error:", {
      message: err?.message,
      stack: err?.stack,
      details: String(err),
    });
    return jsonResponse({ success: false, message: err?.message || "Erro interno", errors: [String(err)] }, 500);
  }
});
