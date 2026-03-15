// ============================================================================
// EDGE FUNCTION: support-dashboard-stats
// Returns operational KPIs for the Atendimentos dashboard
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

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const authResult = await validateExternalToken(token);
    if (!authResult.valid) {
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const db = getSupabaseAdmin();
    const now = new Date().toISOString();

    // 1. Open tickets count
    const { count: openCount } = await db
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("status", ["novo", "triagem", "em_atendimento", "aguardando_cliente", "aguardando_terceiro", "reaberto"]);

    // 2. SLA breached tickets (open + past due)
    const { count: slaBreachedCount } = await db
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .is("resolved_at", null)
      .in("status", ["novo", "triagem", "em_atendimento", "aguardando_cliente", "aguardando_terceiro", "reaberto"])
      .or(`resolution_due_at.lt.${now},first_response_due_at.lt.${now}`);

    // 3. Distribution by queue
    const { data: allQueues } = await db
      .from("support_queues")
      .select("id, code, name")
      .eq("is_active", true);

    const queueMap: Record<string, { code: string; name: string }> = {};
    (allQueues || []).forEach((q: any) => {
      queueMap[q.id] = { code: q.code, name: q.name };
    });

    // Get ticket counts per queue
    const { data: openTickets } = await db
      .from("support_tickets")
      .select("current_queue_id, current_support_level")
      .is("deleted_at", null)
      .in("status", ["novo", "triagem", "em_atendimento", "aguardando_cliente", "aguardando_terceiro", "reaberto"]);

    const queueDistribution: Record<string, number> = { N1: 0, N2: 0, N3: 0, CS: 0 };
    (openTickets || []).forEach((t: any) => {
      const code = t.current_queue_id ? queueMap[t.current_queue_id]?.code : t.current_support_level;
      if (code && queueDistribution[code] !== undefined) {
        queueDistribution[code]++;
      }
    });

    // 4. Critical incidents (S1/S2 open)
    const { count: criticalCount } = await db
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("status", ["novo", "triagem", "em_atendimento", "aguardando_cliente", "aguardando_terceiro", "reaberto"])
      .in("severity", ["S1", "S2"]);

    // 5. Average first response time (last 30 days, resolved tickets)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: respondedTickets } = await db
      .from("support_tickets")
      .select("created_at, first_response_at")
      .is("deleted_at", null)
      .not("first_response_at", "is", null)
      .gte("created_at", thirtyDaysAgo)
      .limit(500);

    let avgFirstResponseMinutes = 0;
    if (respondedTickets && respondedTickets.length > 0) {
      const totalMinutes = respondedTickets.reduce((sum: number, t: any) => {
        const diff = new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime();
        return sum + diff / 60000;
      }, 0);
      avgFirstResponseMinutes = Math.round(totalMinutes / respondedTickets.length);
    }

    // 6. Average resolution time (last 30 days)
    const { data: resolvedTickets } = await db
      .from("support_tickets")
      .select("created_at, resolved_at")
      .is("deleted_at", null)
      .not("resolved_at", "is", null)
      .gte("created_at", thirtyDaysAgo)
      .limit(500);

    let avgResolutionMinutes = 0;
    if (resolvedTickets && resolvedTickets.length > 0) {
      const totalMinutes = resolvedTickets.reduce((sum: number, t: any) => {
        const diff = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
        return sum + diff / 60000;
      }, 0);
      avgResolutionMinutes = Math.round(totalMinutes / resolvedTickets.length);
    }

    // 7. On-call shifts
    const { data: onCallShifts } = await db
      .from("support_oncall")
      .select("*")
      .eq("is_active", true)
      .order("team");

    return jsonResponse({
      success: true,
      data: {
        open_tickets: openCount || 0,
        sla_ok: Math.max(0, (openCount || 0) - (slaBreachedCount || 0)),
        sla_breached: slaBreachedCount || 0,
        critical_count: criticalCount || 0,
        avg_first_response_minutes: avgFirstResponseMinutes,
        avg_resolution_minutes: avgResolutionMinutes,
        queue_distribution: queueDistribution,
        oncall_shifts: onCallShifts || [],
      },
    });
  } catch (err) {
    console.error("support-dashboard-stats error:", err);
    return jsonResponse({ success: false, message: "Erro interno", errors: [String(err)] }, 500);
  }
});
