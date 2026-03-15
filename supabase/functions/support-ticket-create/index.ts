// ============================================================================
// EDGE FUNCTION: support-ticket-create
// Creates a new support ticket with queue-based routing and SLA calculation
// Source of truth: current_queue_id (FK to support_queues)
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

const SEVERITY_PRIORITY_MAP: Record<string, string> = {
  S1: "critical",
  S2: "high",
  S3: "medium",
  S4: "low",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    console.log("support-ticket-create START");

    // ── Auth ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    console.log("support-ticket-create auth token present:", !!token);

    const authResult = await validateExternalToken(token);
    console.log("support-ticket-create auth result:", { valid: authResult.valid });
    if (!authResult.valid) {
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    // ── Parse body ──────────────────────────────────────────────────────
    const body = await req.json();
    console.log("support-ticket-create payload:", JSON.stringify(body));

    const db = getSupabaseAdmin();

    // ── Validate required fields ────────────────────────────────────────
    const required = ["requester_name", "ticket_type", "category", "title", "description"];
    for (const field of required) {
      if (!body[field]) {
        console.error(`support-ticket-create VALIDATION FAIL: missing ${field}`);
        return jsonResponse({ success: false, message: `Campo obrigatório: ${field}` }, 422);
      }
    }

    const severity = body.severity || "S4";
    const priority = body.priority || SEVERITY_PRIORITY_MAP[severity] || "medium";
    console.log("support-ticket-create severity/priority:", { severity, priority });

    // ── Resolve N1 queue (source of truth) ──────────────────────────────
    console.log("support-ticket-create looking up N1 queue...");
    const { data: defaultQueue, error: queueError } = await db
      .from("support_queues")
      .select("id, code, name")
      .eq("code", "N1")
      .eq("is_active", true)
      .single();

    if (queueError) {
      console.error("support-ticket-create QUEUE LOOKUP ERROR:", JSON.stringify(queueError));
    }
    console.log("support-ticket-create queue lookup result:", JSON.stringify(defaultQueue));

    if (!defaultQueue) {
      console.error("support-ticket-create FATAL: N1 queue not found in support_queues");
      return jsonResponse({
        success: false,
        message: "Fila N1 não encontrada em support_queues. Verifique se os seeds foram executados.",
        errors: [queueError?.message || "N1 queue row missing"],
      }, 500);
    }

    const currentQueueId = defaultQueue.id;

    // ── SLA policy matching ─────────────────────────────────────────────
    console.log("support-ticket-create looking up SLA policies...");
    let sla_policy_id: string | null = null;
    let first_response_due_at: string | null = null;
    let resolution_due_at: string | null = null;

    const { data: policies, error: slaError } = await db
      .from("support_sla_policies")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (slaError) {
      console.error("support-ticket-create SLA LOOKUP ERROR:", JSON.stringify(slaError));
    }
    console.log("support-ticket-create SLA policies found:", policies?.length ?? 0);

    if (policies && policies.length > 0) {
      let matched = policies.find(
        (p: any) => p.severity === severity && p.ticket_type === body.ticket_type && p.category === body.category
      );
      if (!matched) {
        matched = policies.find(
          (p: any) => p.severity === severity && p.ticket_type === body.ticket_type && !p.category
        );
      }
      if (!matched) {
        matched = policies.find((p: any) => p.severity === severity && !p.ticket_type && !p.category);
      }
      if (!matched) {
        matched = policies[0];
      }

      if (matched) {
        sla_policy_id = matched.id;
        const now = new Date();
        first_response_due_at = new Date(now.getTime() + matched.first_response_minutes * 60000).toISOString();
        resolution_due_at = new Date(now.getTime() + matched.resolution_minutes * 60000).toISOString();
        console.log("support-ticket-create SLA matched:", { id: matched.id, code: matched.code });
      }
    }

    // ── Build payload ───────────────────────────────────────────────────
    const validChannels = ["portal", "internal_portal", "zabbix", "api", "email"];
    const origin_channel = validChannels.includes(body.origin_channel) ? body.origin_channel : "portal";
    const requester_level = body.requester_level || 1;

    // ── User context (legacy integer IDs vs UUID columns) ───────────────
    // The CORE auth uses integer user.id. DB has both UUID legacy columns
    // and newer integer columns. We must NOT put integers into UUID columns.
    const rawUserId = body.requester_user_id;
    const isUuid = typeof rawUserId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawUserId);
    const isInteger = typeof rawUserId === "number" || (typeof rawUserId === "string" && /^\d+$/.test(rawUserId));

    console.log("support-ticket-create user context", {
      rawUserId,
      isUuid,
      isInteger,
      userLevel: requester_level,
      userEmail: body.requester_email,
      userName: body.requester_name,
    });

    // requester_user_id column is UUID → only set if we have a valid UUID
    const requesterUserIdUuid = isUuid ? rawUserId : null;

    // Store integer user id in metadata for traceability
    const ticketMetadata = {
      ...(body.metadata || {}),
      ...(isInteger ? { legacy_user_id: Number(rawUserId) } : {}),
    };

    const ticketPayload = {
      company_id: body.company_id || null,
      // UUID column – only accept valid UUIDs
      requester_user_id: requesterUserIdUuid,
      requester_level,
      requester_name: body.requester_name,
      requester_email: body.requester_email || null,
      requester_phone: body.requester_phone || null,
      origin_channel,
      ticket_type: body.ticket_type,
      category: body.category,
      subcategory: body.subcategory || null,
      severity,
      priority,
      status: "novo",
      // New model (source of truth)
      current_queue_id: currentQueueId,
      current_support_level: "N1",
      // Legacy compat writes
      support_level: "N1",
      current_queue: "N1",
      // No assignee on creation – all UUID columns null
      assigned_to_user_id: null,
      assigned_to_name: null,
      // Legacy UUID columns – explicitly null on creation
      support_resolved_by: null,
      cs_closed_by: null,
      // Integer columns – explicitly null on creation
      resolved_by_user_id: null,
      closed_by_user_id: null,
      resolved_at: null,
      closed_at: null,
      assigned_at: null,
      service_name: body.service_name || null,
      asset_id: body.asset_id || null,
      asset_label: body.asset_label || null,
      title: body.title,
      description: body.description,
      customer_visible: body.customer_visible !== false,
      sla_policy_id,
      first_response_due_at,
      resolution_due_at,
      source_system: body.source_system || null,
      external_reference: body.external_reference || null,
      metadata: ticketMetadata,
    };

    console.log("support-ticket-create INSERT payload:", JSON.stringify(ticketPayload));

    // ── Insert ticket ───────────────────────────────────────────────────
    const { data: ticket, error: insertError } = await db
      .from("support_tickets")
      .insert(ticketPayload)
      .select()
      .single();

    if (insertError) {
      console.error("support-ticket-create INSERT ERROR:", JSON.stringify({
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      }));
      return jsonResponse({
        success: false,
        message: "Erro ao criar ticket",
        errors: [insertError.message],
        debug: { code: insertError.code, details: insertError.details, hint: insertError.hint },
      }, 500);
    }

    console.log("support-ticket-create TICKET CREATED:", { id: ticket.id, public_code: ticket.public_code });

    // ── Record status history ───────────────────────────────────────────
    try {
      const { error: shError } = await db.from("support_ticket_status_history").insert({
        ticket_id: ticket.id,
        old_status: null,
        new_status: "novo",
        changed_by_user_id: body.requester_user_id || null,
        changed_by_name: body.requester_name,
        reason: "Ticket criado",
      });
      if (shError) {
        console.error("support-ticket-create STATUS_HISTORY INSERT ERROR:", JSON.stringify(shError));
      } else {
        console.log("support-ticket-create status_history OK");
      }
    } catch (shErr) {
      console.error("support-ticket-create STATUS_HISTORY EXCEPTION:", shErr);
    }

    // ── Record queue history ────────────────────────────────────────────
    try {
      const { error: qhError } = await db.from("support_ticket_queue_history").insert({
        ticket_id: ticket.id,
        from_queue_id: null,
        to_queue_id: currentQueueId,
        from_support_level: null,
        to_support_level: "N1",
        changed_by_name: body.requester_name,
        reason: "Ticket criado - entrada na fila N1",
      });
      if (qhError) {
        console.error("support-ticket-create QUEUE_HISTORY INSERT ERROR:", JSON.stringify(qhError));
      } else {
        console.log("support-ticket-create queue_history OK");
      }
    } catch (qhErr) {
      console.error("support-ticket-create QUEUE_HISTORY EXCEPTION:", qhErr);
    }

    // ── Record event ────────────────────────────────────────────────────
    try {
      const { error: evError } = await db.from("support_ticket_events").insert({
        event_name: "ticket.created",
        entity_type: "support_ticket",
        entity_id: ticket.id,
        actor_type: requester_level >= 600 ? "support" : "client",
        actor_id: body.requester_user_id || null,
        user_id: body.requester_user_id || null,
        metadata: {
          severity,
          priority,
          category: body.category,
          ticket_type: body.ticket_type,
          sla_policy_id,
          public_code: ticket.public_code,
          queue: "N1",
        },
        ip_address: req.headers.get("x-forwarded-for") || null,
        user_agent: req.headers.get("user-agent") || null,
      });
      if (evError) {
        console.error("support-ticket-create EVENT INSERT ERROR:", JSON.stringify(evError));
      } else {
        console.log("support-ticket-create event OK");
      }
    } catch (evErr) {
      console.error("support-ticket-create EVENT EXCEPTION:", evErr);
    }

    // ── Notify N1 queue members ─────────────────────────────────────────
    try {
      const { data: members, error: memError } = await db
        .from("support_queue_members")
        .select("user_id, user_level")
        .eq("queue_id", currentQueueId)
        .eq("is_active", true);

      if (memError) {
        console.error("support-ticket-create MEMBERS LOOKUP ERROR:", JSON.stringify(memError));
      }
      console.log("support-ticket-create N1 members found:", members?.length ?? 0);

      if (members && members.length > 0) {
        const notifications = members.map((m: any) => ({
          user_id: String(m.user_id),
          user_level: m.user_level,
          event_name: "ticket.created",
          title: `Novo ticket ${ticket.public_code}`,
          body: ticket.title,
          ticket_id: ticket.id,
          ticket_public_code: ticket.public_code,
          metadata: {},
        }));
        const { error: notifError } = await db.from("support_notifications").insert(notifications);
        if (notifError) {
          console.error("support-ticket-create NOTIFICATIONS INSERT ERROR:", JSON.stringify(notifError));
        } else {
          console.log("support-ticket-create notifications OK, count:", notifications.length);
        }
      }
    } catch (notifErr) {
      console.error("support-ticket-create NOTIFICATIONS EXCEPTION:", notifErr);
    }

    console.log("support-ticket-create SUCCESS:", ticket.public_code);
    return jsonResponse({
      success: true,
      data: ticket,
      message: `Ticket ${ticket.public_code} criado com sucesso`,
    }, 201);
  } catch (err: any) {
    console.error("support-ticket-create UNHANDLED ERROR:", JSON.stringify({
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
      raw: String(err),
    }));
    return jsonResponse({
      success: false,
      message: err?.message || "Erro interno ao criar ticket",
      errors: [String(err)],
    }, 500);
  }
});
