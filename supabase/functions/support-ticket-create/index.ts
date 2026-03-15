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
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const authResult = await validateExternalToken(token);
    if (!authResult.valid) {
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const db = getSupabaseAdmin();

    // Validate required fields
    const required = ["requester_name", "ticket_type", "category", "title", "description"];
    for (const field of required) {
      if (!body[field]) {
        return jsonResponse({ success: false, message: `Campo obrigatório: ${field}` }, 422);
      }
    }

    const severity = body.severity || "S4";
    const priority = body.priority || SEVERITY_PRIORITY_MAP[severity] || "medium";

    // ── Resolve N1 queue (source of truth) ──────────────────────────────
    const { data: defaultQueue } = await db
      .from("support_queues")
      .select("id")
      .eq("code", "N1")
      .eq("is_active", true)
      .single();

    const currentQueueId = defaultQueue?.id || null;

    // ── SLA policy matching ─────────────────────────────────────────────
    let sla_policy_id = null;
    let first_response_due_at = null;
    let resolution_due_at = null;

    const { data: policies } = await db
      .from("support_sla_policies")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

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
      }
    }

    const validChannels = ["portal", "internal_portal", "zabbix", "api", "email"];
    const origin_channel = validChannels.includes(body.origin_channel) ? body.origin_channel : "portal";
    const requester_level = body.requester_level || 1;

    const ticketPayload = {
      company_id: body.company_id || null,
      requester_user_id: body.requester_user_id || null,
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
      // No assignee on creation
      assigned_to_user_id: null,
      assigned_to_name: null,
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
      metadata: body.metadata || {},
    };

    const { data: ticket, error: insertError } = await db
      .from("support_tickets")
      .insert(ticketPayload)
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return jsonResponse({ success: false, message: "Erro ao criar ticket", errors: [insertError.message] }, 500);
    }

    // Record status history
    await db.from("support_ticket_status_history").insert({
      ticket_id: ticket.id,
      old_status: null,
      new_status: "novo",
      changed_by_user_id: body.requester_user_id || null,
      changed_by_name: body.requester_name,
      reason: "Ticket criado",
    });

    // Record queue history
    if (currentQueueId) {
      await db.from("support_ticket_queue_history").insert({
        ticket_id: ticket.id,
        from_queue_id: null,
        to_queue_id: currentQueueId,
        from_support_level: null,
        to_support_level: "N1",
        changed_by_name: body.requester_name,
        reason: "Ticket criado - entrada na fila N1",
      });
    }

    // Record event
    await db.from("support_ticket_events").insert({
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

    // ── Notify N1 queue members ─────────────────────────────────────────
    if (currentQueueId) {
      const { data: members } = await db
        .from("support_queue_members")
        .select("user_id, user_level")
        .eq("queue_id", currentQueueId)
        .eq("is_active", true);

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
        await db.from("support_notifications").insert(notifications);
      }
    }

    return jsonResponse({
      success: true,
      data: ticket,
      message: `Ticket ${ticket.public_code} criado com sucesso`,
    }, 201);
  } catch (err) {
    console.error("support-ticket-create error:", err);
    return jsonResponse({ success: false, message: "Erro interno", errors: [String(err)] }, 500);
  }
});
