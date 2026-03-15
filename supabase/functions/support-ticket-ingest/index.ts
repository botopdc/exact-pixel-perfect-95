// ============================================================================
// EDGE FUNCTION: support-ticket-ingest
// Webhook/API ingestion endpoint for external systems (Zabbix, monitoring, etc.)
// NOT ACTIVE IN PRODUCTION — prepared for Phase 2 integration
// ============================================================================

import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ingest-secret",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SEVERITY_MAP: Record<string, string> = {
  disaster: "S1",
  high: "S2",
  average: "S3",
  warning: "S4",
  information: "S4",
  not_classified: "S4",
};

const PRIORITY_MAP: Record<string, string> = {
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
    // Validate ingest secret
    const ingestSecret = Deno.env.get("SUPPORT_INGEST_SECRET");
    const providedSecret = req.headers.get("x-ingest-secret") || "";

    if (!ingestSecret) {
      return jsonResponse({
        success: false,
        message: "Ingest endpoint não configurado. Configure SUPPORT_INGEST_SECRET.",
      }, 503);
    }

    if (providedSecret !== ingestSecret) {
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const db = getSupabaseAdmin();

    // ── Expected payload contract ────────────────────────────────────
    // {
    //   source_system: "zabbix" | "api" | string,
    //   external_reference: "zabbix-trigger-12345",
    //   title: "CPU usage > 90% on srv-web-01",
    //   description: "Detailed alert description",
    //   severity: "disaster" | "high" | "average" | "warning",
    //   category: "infraestrutura",
    //   asset_label: "srv-web-01",
    //   asset_id: "uuid" (optional),
    //   company_id: "uuid" (optional),
    //   metadata: { ... } (optional)
    // }

    const required = ["source_system", "external_reference", "title"];
    for (const field of required) {
      if (!body[field]) {
        return jsonResponse({ success: false, message: `Campo obrigatório: ${field}` }, 422);
      }
    }

    // ── Deduplication check ──────────────────────────────────────────
    const { data: existing } = await db
      .from("support_tickets")
      .select("id, public_code, status")
      .eq("source_system", body.source_system)
      .eq("external_reference", body.external_reference)
      .is("deleted_at", null)
      .limit(1);

    if (existing && existing.length > 0) {
      const ticket = existing[0];
      // If ticket exists and is still active, skip creation
      const terminalStatuses = ["encerrado_cs", "cancelado"];
      if (!terminalStatuses.includes(ticket.status)) {
        return jsonResponse({
          success: true,
          data: ticket,
          message: `Ticket já existe: ${ticket.public_code} (status: ${ticket.status})`,
          deduplicated: true,
        });
      }
      // If terminal, allow creating a new one
    }

    // ── Map severity ─────────────────────────────────────────────────
    const severity = SEVERITY_MAP[body.severity] || body.severity || "S4";
    const priority = PRIORITY_MAP[severity] || "medium";

    // ── Find SLA policy ──────────────────────────────────────────────
    let sla_policy_id = null;
    let first_response_due_at = null;
    let resolution_due_at = null;

    const { data: policies } = await db
      .from("support_sla_policies")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (policies && policies.length > 0) {
      let matched = policies.find((p: any) => p.severity === severity) || policies[0];
      if (matched) {
        sla_policy_id = matched.id;
        const now = new Date();
        first_response_due_at = new Date(now.getTime() + matched.first_response_minutes * 60000).toISOString();
        resolution_due_at = new Date(now.getTime() + matched.resolution_minutes * 60000).toISOString();
      }
    }

    // ── Insert ticket ────────────────────────────────────────────────
    const { data: ticket, error: insertError } = await db
      .from("support_tickets")
      .insert({
        requester_name: body.requester_name || `[${body.source_system}] Auto`,
        requester_email: body.requester_email || null,
        origin_channel: body.source_system === "zabbix" ? "zabbix" : "api",
        ticket_type: body.ticket_type || "incidente",
        category: body.category || "infraestrutura",
        severity,
        priority,
        status: "novo",
        support_level: "N1",
        current_queue: "N1",
        title: body.title,
        description: body.description || body.title,
        company_id: body.company_id || null,
        asset_id: body.asset_id || null,
        asset_label: body.asset_label || null,
        source_system: body.source_system,
        external_reference: body.external_reference,
        sla_policy_id,
        first_response_due_at,
        resolution_due_at,
        metadata: {
          ...(body.metadata || {}),
          ingested_at: new Date().toISOString(),
          ingest_source: body.source_system,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Ingest insert error:", insertError);
      return jsonResponse({ success: false, message: "Erro ao criar ticket", errors: [insertError.message] }, 500);
    }

    // Record event
    await db.from("support_ticket_events").insert({
      event_name: "ticket.created",
      entity_type: "support_ticket",
      entity_id: ticket.id,
      actor_type: "integration",
      metadata: {
        source_system: body.source_system,
        external_reference: body.external_reference,
        public_code: ticket.public_code,
        ingested: true,
      },
    });

    // Record status history
    await db.from("support_ticket_status_history").insert({
      ticket_id: ticket.id,
      old_status: null,
      new_status: "novo",
      changed_by_name: `[${body.source_system}]`,
      reason: "Ticket criado via ingestão externa",
    });

    return jsonResponse({
      success: true,
      data: ticket,
      message: `Ticket ${ticket.public_code} criado via ingestão`,
    }, 201);
  } catch (err) {
    console.error("support-ticket-ingest error:", err);
    return jsonResponse({ success: false, message: "Erro interno", errors: [String(err)] }, 500);
  }
});
