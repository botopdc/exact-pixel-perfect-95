// ============================================================================
// EDGE FUNCTION: support-dashboard-stats
// Returns operational KPIs for the Atendimentos NOC dashboard
// OPTIMIZED: All independent queries run in parallel via Promise.all
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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const openStatuses = ["novo", "triagem", "em_atendimento", "aguardando_cliente", "aguardando_terceiro", "reaberto"];

    // ── ALL INDEPENDENT QUERIES IN PARALLEL ─────────────────────────────
    const [
      openCountRes,
      slaBreachedRes,
      queuesRes,
      openTicketsRes,
      criticalCountRes,
      activeIncidentsRes,
      respondedRes,
      resolvedRes,
      oncallRes,
      serviceStatusRes,
    ] = await Promise.all([
      // 1. Open tickets count
      db.from("support_tickets")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("status", openStatuses),

      // 2. SLA breached count
      db.from("support_tickets")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .is("resolved_at", null)
        .in("status", openStatuses)
        .or(`resolution_due_at.lt.${now},first_response_due_at.lt.${now}`),

      // 3. All active queues
      db.from("support_queues")
        .select("id, code, name")
        .eq("is_active", true),

      // 4. Open tickets (minimal columns for distribution calc)
      db.from("support_tickets")
        .select("current_queue_id, current_support_level, assigned_to_user_id, resolution_due_at, first_response_due_at")
        .is("deleted_at", null)
        .in("status", openStatuses),

      // 5. Critical count
      db.from("support_tickets")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("status", openStatuses)
        .in("severity", ["S1", "S2"]),

      // 6. Active critical incidents (top 5)
      db.from("support_tickets")
        .select("id, public_code, title, severity, priority, created_at, status")
        .is("deleted_at", null)
        .in("status", openStatuses)
        .in("severity", ["S1", "S2"])
        .order("created_at", { ascending: false })
        .limit(5),

      // 7. Responded tickets (last 30d) for avg first response
      db.from("support_tickets")
        .select("created_at, first_response_at")
        .is("deleted_at", null)
        .not("first_response_at", "is", null)
        .gte("created_at", thirtyDaysAgo)
        .limit(500),

      // 8. Resolved tickets (last 30d) for avg resolution
      db.from("support_tickets")
        .select("created_at, resolved_at")
        .is("deleted_at", null)
        .not("resolved_at", "is", null)
        .gte("created_at", thirtyDaysAgo)
        .limit(500),

      // 9. On-call shifts
      db.from("support_oncall_shifts")
        .select("id, team_code, user_id, user_name, user_email, starts_at, ends_at")
        .eq("is_active", true)
        .lte("starts_at", now)
        .gte("ends_at", now)
        .order("team_code"),

      // 10. Service status
      db.from("ops_service_status")
        .select("id, service_code, service_name, status, status_message, source, updated_at")
        .order("service_code"),
    ]);

    // ── PROCESS RESULTS ─────────────────────────────────────────────────

    const openCount = openCountRes.count || 0;
    const slaBreachedCount = slaBreachedRes.count || 0;
    const criticalCount = criticalCountRes.count || 0;

    // Queue map
    const queueMap: Record<string, { code: string; name: string }> = {};
    (queuesRes.data || []).forEach((q: any) => {
      queueMap[q.id] = { code: q.code, name: q.name };
    });

    // Distribution
    const queueDistribution: Record<string, number> = { N1: 0, N2: 0, N3: 0, CS: 0 };
    const queueUnassigned: Record<string, number> = { N1: 0, N2: 0, N3: 0, CS: 0 };
    const queueBreached: Record<string, number> = { N1: 0, N2: 0, N3: 0, CS: 0 };

    (openTicketsRes.data || []).forEach((t: any) => {
      const code = t.current_queue_id ? queueMap[t.current_queue_id]?.code : t.current_support_level;
      if (code && queueDistribution[code] !== undefined) {
        queueDistribution[code]++;
        if (!t.assigned_to_user_id) queueUnassigned[code]++;
        const isDue = (t.resolution_due_at && t.resolution_due_at < now) ||
                      (t.first_response_due_at && t.first_response_due_at < now);
        if (isDue) queueBreached[code]++;
      }
    });

    // Avg first response
    let avgFirstResponseMinutes = 0;
    const respondedTickets = respondedRes.data || [];
    if (respondedTickets.length > 0) {
      const totalMinutes = respondedTickets.reduce((sum: number, t: any) => {
        return sum + (new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / 60000;
      }, 0);
      avgFirstResponseMinutes = Math.round(totalMinutes / respondedTickets.length);
    }

    // Avg resolution
    let avgResolutionMinutes = 0;
    const resolvedTickets = resolvedRes.data || [];
    if (resolvedTickets.length > 0) {
      const totalMinutes = resolvedTickets.reduce((sum: number, t: any) => {
        return sum + (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 60000;
      }, 0);
      avgResolutionMinutes = Math.round(totalMinutes / resolvedTickets.length);
    }

    // On-call shifts
    let onCallShifts = (oncallRes.data || []).map((s: any) => ({
      id: s.id,
      team: s.team_code,
      user_id: s.user_id,
      user_name: s.user_name,
      user_email: s.user_email,
      start_at: s.starts_at,
      end_at: s.ends_at,
      is_active: true,
    }));

    // Fallback to legacy only if no new shifts found
    if (onCallShifts.length === 0) {
      const { data: legacyShifts } = await db
        .from("support_oncall")
        .select("*")
        .eq("is_active", true)
        .order("team");
      onCallShifts = legacyShifts || [];
    }

    return jsonResponse({
      success: true,
      data: {
        open_tickets: openCount,
        sla_ok: Math.max(0, openCount - slaBreachedCount),
        sla_breached: slaBreachedCount,
        critical_count: criticalCount,
        avg_first_response_minutes: avgFirstResponseMinutes,
        avg_resolution_minutes: avgResolutionMinutes,
        queue_distribution: queueDistribution,
        queue_unassigned: queueUnassigned,
        queue_breached: queueBreached,
        oncall_shifts: onCallShifts,
        active_incidents: activeIncidentsRes.data || [],
        service_status: serviceStatusRes.data || [],
      },
    });
  } catch (err) {
    console.error("support-dashboard-stats error:", err);
    return jsonResponse({ success: false, message: "Erro interno", errors: [String(err)] }, 500);
  }
});
