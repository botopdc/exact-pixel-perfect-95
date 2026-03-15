// ============================================================================
// EDGE FUNCTION: support-queue-admin
// Manages queues and queue members (CRUD)
// Actions: list_queues, list_members, my_queues, add_member, remove_member, toggle_member
// Auth pattern aligned with support-ticket-* functions: validateExternalToken + body user context
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

function toInt(val: unknown): number | null {
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function resolveUserContext(body: Record<string, unknown>) {
  // IMPORTANT: Use actor_* fields (the authenticated user performing the action)
  // NOT user_* fields which may refer to the target member in add_member actions
  const level = toInt(body.actor_level ?? (body.user as any)?.level);
  const id = body.actor_user_id ?? (body.user as any)?.id ?? null;
  const uuid = body.user_uuid ?? (body.user as any)?.uuid ?? null;
  const email = body.actor_email ?? (body.user as any)?.email ?? null;
  const name = body.actor_name ?? (body.user as any)?.name ?? null;

  return {
    id: id ? String(id) : null,
    uuid: uuid ? String(uuid) : null,
    level,
    email: email ? String(email) : null,
    name: name ? String(name) : null,
  };
}

function isReadAction(action: string): boolean {
  return ["list_queues", "list_members", "my_queues", "list_analyst_summary"].includes(action);
}

function isMutationAction(action: string): boolean {
  return ["add_member", "remove_member", "toggle_member", "create_oncall_shift", "delete_oncall_shift"].includes(action);
}

function normalizeName(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    console.log("support-queue-admin headers", {
      authorization: req.headers.get("authorization") ? "present" : "missing",
      apikey: req.headers.get("apikey") ? "present" : "missing",
    });

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const authResult = await validateExternalToken(token);

    console.log("support-queue-admin raw auth result", authResult);

    if (!authResult.valid) {
      return jsonResponse({
        success: false,
        message: "Falha ao identificar usuário autenticado",
        debug: {
          auth_resolved: false,
          auth_error: authResult.error || "invalid_token",
        },
      }, 401);
    }

    const body = await req.json();
    const db = getSupabaseAdmin();
    const action = String(body.action || "");
    const user = resolveUserContext(body || {});

    console.log("support-queue-admin resolved user", {
      id: user.id,
      uuid: user.uuid,
      level: user.level,
      email: user.email,
      name: user.name,
    });
    console.log("support-queue-admin action", action);

    if (!action) {
      return jsonResponse({ success: false, message: "Ação obrigatória" }, 422);
    }

    // Must resolve user context before permission checks
    if (user.level === null) {
      return jsonResponse({
        success: false,
        message: "Falha ao identificar usuário autenticado",
        debug: {
          auth_resolved: false,
          missing: ["user_level"],
        },
      }, 401);
    }

    const allowedLevels = isMutationAction(action) ? [950, 1000] : [900, 950, 1000];
    if ((isReadAction(action) || isMutationAction(action)) && !allowedLevels.includes(user.level)) {
      console.error("support-queue-admin denied", {
        resolvedUser: {
          id: user.id,
          uuid: user.uuid,
          level: user.level,
          email: user.email,
        },
        reason: "permission_check_failed",
        action,
      });

      return jsonResponse({
        success: false,
        message: "Acesso negado",
        debug: {
          received_level: user.level,
          allowed_levels: allowedLevels,
        },
      }, 403);
    }

    if (action === "list_queues") {
      const { data: queues, error } = await db
        .from("support_queues")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) return jsonResponse({ success: false, message: error.message }, 500);
      return jsonResponse({ success: true, data: queues });
    }

    if (action === "list_members") {
      let query = db.from("support_queue_members").select("*, support_queues(code, name)");
      if (body.queue_id) query = query.eq("queue_id", body.queue_id);
      if (body.queue_code) {
        const { data: q } = await db.from("support_queues").select("id").eq("code", body.queue_code).single();
        if (q) query = query.eq("queue_id", q.id);
      }
      query = query.order("user_name", { ascending: true });

      const { data: members, error } = await query;
      if (error) return jsonResponse({ success: false, message: error.message }, 500);
      return jsonResponse({ success: true, data: members });
    }

    if (action === "my_queues") {
      const lookupUserId = toInt(body.user_id ?? user.id);
      if (!lookupUserId) {
        return jsonResponse({ success: false, message: "user_id obrigatório para my_queues" }, 422);
      }

      const { data: memberships, error } = await db
        .from("support_queue_members")
        .select("*, support_queues(id, code, name)")
        .eq("user_id", lookupUserId)
        .eq("is_active", true);

      if (error) return jsonResponse({ success: false, message: error.message }, 500);
      return jsonResponse({ success: true, data: memberships });
    }

    if (action === "list_analyst_summary") {
      const nowIso = new Date().toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartIso = todayStart.toISOString();
      const openStatuses = ["novo", "triagem", "em_atendimento", "aguardando_cliente", "aguardando_terceiro", "reaberto"];

      const { data: queueMembers, error: membersError } = await db
        .from("support_queue_members")
        .select("id, queue_id, user_id, user_name, user_email, user_level, is_primary, is_active, support_queues(id, code, name)")
        .eq("is_active", true)
        .order("user_name", { ascending: true });

      if (membersError) return jsonResponse({ success: false, message: membersError.message }, 500);

      const { data: tickets, error: ticketsError } = await db
        .from("support_tickets")
        .select("id, assigned_to_name, status, first_response_due_at, resolution_due_at, first_response_at, resolved_at, created_at")
        .is("deleted_at", null);

      if (ticketsError) return jsonResponse({ success: false, message: ticketsError.message }, 500);

      const { data: shifts, error: shiftsError } = await db
        .from("support_oncall_shifts")
        .select("team_code, user_email, starts_at, ends_at, is_active")
        .eq("is_active", true)
        .lte("starts_at", nowIso)
        .gte("ends_at", nowIso);

      if (shiftsError) {
        console.warn("support-queue-admin list_analyst_summary oncall warning", shiftsError.message);
      }

      const onCallByEmail = new Map<string, string>();
      (shifts || []).forEach((shift: any) => {
        const email = String(shift.user_email || "").toLowerCase();
        if (!email) return;
        onCallByEmail.set(email, String(shift.team_code || ""));
      });

      const analystMap = new Map<string, any>();
      const analystKeyByNormalizedName = new Map<string, string>();

      (queueMembers || []).forEach((member: any) => {
        const email = String(member.user_email || "").toLowerCase();
        const key = `${member.user_id}:${email}`;
        const queue = {
          queue_id: member.queue_id,
          queue_code: member.support_queues?.code || "—",
          queue_name: member.support_queues?.name || "Fila",
          is_primary: Boolean(member.is_primary),
          is_active: Boolean(member.is_active),
          member_id: member.id,
        };

        if (!analystMap.has(key)) {
          analystMap.set(key, {
            name: member.user_name,
            email: member.user_email,
            user_id: member.user_id,
            level: member.user_level,
            queues: [queue],
            active_tickets: 0,
            breached_tickets: 0,
            resolved_today: 0,
            avg_first_response_minutes: null,
            avg_resolution_minutes: null,
            is_oncall: onCallByEmail.has(email),
            oncall_team: onCallByEmail.get(email) || null,
            _firstResponseSamples: [] as number[],
            _resolutionSamples: [] as number[],
          });
          analystKeyByNormalizedName.set(normalizeName(member.user_name), key);
          return;
        }

        const existing = analystMap.get(key);
        existing.queues.push(queue);
      });

      (tickets || []).forEach((ticket: any) => {
        const assignedName = normalizeName(ticket.assigned_to_name);
        if (!assignedName) return;

        const analystKey = analystKeyByNormalizedName.get(assignedName);
        if (!analystKey) return;

        const analyst = analystMap.get(analystKey);
        if (!analyst) return;

        if (openStatuses.includes(ticket.status)) {
          analyst.active_tickets += 1;
          const isBreached =
            (ticket.resolution_due_at && ticket.resolution_due_at < nowIso) ||
            (ticket.first_response_due_at && ticket.first_response_due_at < nowIso);
          if (isBreached) analyst.breached_tickets += 1;
        }

        if (ticket.resolved_at && ticket.resolved_at >= todayStartIso) {
          analyst.resolved_today += 1;
        }

        if (ticket.first_response_at && ticket.created_at) {
          const firstResponseMinutes = (new Date(ticket.first_response_at).getTime() - new Date(ticket.created_at).getTime()) / 60000;
          if (Number.isFinite(firstResponseMinutes) && firstResponseMinutes >= 0) {
            analyst._firstResponseSamples.push(firstResponseMinutes);
          }
        }

        if (ticket.resolved_at && ticket.created_at) {
          const resolutionMinutes = (new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()) / 60000;
          if (Number.isFinite(resolutionMinutes) && resolutionMinutes >= 0) {
            analyst._resolutionSamples.push(resolutionMinutes);
          }
        }
      });

      const data = Array.from(analystMap.values()).map((analyst) => {
        const firstCount = analyst._firstResponseSamples.length;
        const resolutionCount = analyst._resolutionSamples.length;

        const avgFirst = firstCount
          ? analyst._firstResponseSamples.reduce((sum: number, value: number) => sum + value, 0) / firstCount
          : null;
        const avgResolution = resolutionCount
          ? analyst._resolutionSamples.reduce((sum: number, value: number) => sum + value, 0) / resolutionCount
          : null;

        const { _firstResponseSamples, _resolutionSamples, ...publicData } = analyst;
        return {
          ...publicData,
          avg_first_response_minutes: avgFirst,
          avg_resolution_minutes: avgResolution,
        };
      });

      return jsonResponse({ success: true, data });
    }

    if (action === "add_member") {
      const { queue_id, user_id, user_name, user_email, user_level: memberLevel, is_primary } = body;

      console.log("support-queue-admin add_member actor", {
        actorId: user.id, actorLevel: user.level, actorEmail: user.email,
      });
      console.log("support-queue-admin add_member payload", {
        queue_id, user_id, user_name, user_email, user_level: memberLevel,
      });

      if (!queue_id || !user_id || !user_name || !user_email) {
        return jsonResponse({ success: false, message: "queue_id, user_id, user_name e user_email obrigatórios" }, 422);
      }

      const memberUserId = toInt(user_id);
      if (!memberUserId) {
        return jsonResponse({ success: false, message: "user_id inválido" }, 422);
      }

      const { data: existingRows, error: existingError } = await db
        .from("support_queue_members")
        .select("id, is_active")
        .eq("queue_id", String(queue_id))
        .eq("user_id", memberUserId)
        .order("created_at", { ascending: false });

      if (existingError) {
        return jsonResponse({ success: false, message: existingError.message }, 500);
      }

      const existingActive = (existingRows || []).find((row: any) => row.is_active);
      if (existingActive) {
        return jsonResponse({ success: false, message: "Usuário já pertence a esta fila" }, 409);
      }

      const existingInactive = (existingRows || [])[0];
      if (existingInactive) {
        const { data: reactivated, error: reactivateError } = await db
          .from("support_queue_members")
          .update({
            user_name,
            user_email,
            user_level: toInt(memberLevel) || 900,
            is_primary: Boolean(is_primary),
            is_active: true,
          })
          .eq("id", existingInactive.id)
          .select()
          .single();

        if (reactivateError) return jsonResponse({ success: false, message: reactivateError.message }, 500);
        return jsonResponse({ success: true, data: reactivated, message: "Membro reativado na fila" });
      }

      const insertPayload = {
        queue_id,
        user_id: memberUserId,
        user_name,
        user_email,
        user_level: toInt(memberLevel) || 900,
        is_primary: Boolean(is_primary),
        is_active: true,
      };

      const { data: member, error } = await db
        .from("support_queue_members")
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        if ((error as any).code === "23505") {
          return jsonResponse({ success: false, message: "Usuário já pertence a esta fila" }, 409);
        }
        return jsonResponse({ success: false, message: error.message }, 500);
      }

      return jsonResponse({ success: true, data: member, message: "Membro adicionado à fila" });
    }

    if (action === "remove_member") {
      if (!body.member_id) return jsonResponse({ success: false, message: "member_id obrigatório" }, 422);

      const { error } = await db
        .from("support_queue_members")
        .delete()
        .eq("id", body.member_id);

      if (error) return jsonResponse({ success: false, message: error.message }, 500);
      return jsonResponse({ success: true, message: "Membro removido" });
    }

    if (action === "toggle_member") {
      if (!body.member_id) return jsonResponse({ success: false, message: "member_id obrigatório" }, 422);

      const { data: current } = await db
        .from("support_queue_members")
        .select("is_active")
        .eq("id", body.member_id)
        .single();

      if (!current) return jsonResponse({ success: false, message: "Membro não encontrado" }, 404);

      const { data: updated, error } = await db
        .from("support_queue_members")
        .update({ is_active: !current.is_active })
        .eq("id", body.member_id)
        .select()
        .single();

      if (error) return jsonResponse({ success: false, message: error.message }, 500);
      return jsonResponse({ success: true, data: updated, message: updated.is_active ? "Membro ativado" : "Membro desativado" });
    }

    // ── On-call shifts ──────────────────────────────────────────────────

    if (action === "list_oncall_shifts") {
      let query = db
        .from("support_oncall_shifts")
        .select("*")
        .order("starts_at", { ascending: false })
        .limit(50);

      if (body.is_active !== undefined) {
        query = query.eq("is_active", body.is_active);
      }

      const { data: shifts, error } = await query;
      if (error) return jsonResponse({ success: false, message: error.message }, 500);
      return jsonResponse({ success: true, data: shifts });
    }

    if (action === "create_oncall_shift") {
      const { team_code, team_name, user_name: shiftUserName, user_email: shiftUserEmail, user_id: shiftUserId, starts_at, ends_at, notes } = body;

      if (!team_code || !shiftUserName || !starts_at || !ends_at) {
        return jsonResponse({ success: false, message: "team_code, user_name, starts_at e ends_at obrigatórios" }, 422);
      }

      // Deactivate existing active shifts for same user+team
      const shiftUserIdInt = toInt(shiftUserId);
      if (shiftUserIdInt) {
        await db
          .from("support_oncall_shifts")
          .update({ is_active: false })
          .eq("user_id", shiftUserIdInt)
          .eq("team_code", String(team_code))
          .eq("is_active", true);
      }

      const insertPayload: Record<string, unknown> = {
        team_code: String(team_code),
        team_name: String(team_name || team_code),
        user_name: String(shiftUserName),
        user_email: shiftUserEmail ? String(shiftUserEmail) : null,
        user_id: shiftUserIdInt,
        starts_at: String(starts_at),
        ends_at: String(ends_at),
        is_active: true,
        notes: notes ? String(notes) : null,
        created_by: toInt(user.id),
      };

      const { data: shift, error } = await db
        .from("support_oncall_shifts")
        .insert(insertPayload)
        .select()
        .single();

      if (error) return jsonResponse({ success: false, message: error.message }, 500);
      return jsonResponse({ success: true, data: shift, message: "Plantão criado" }, 201);
    }

    if (action === "delete_oncall_shift") {
      if (!body.shift_id) return jsonResponse({ success: false, message: "shift_id obrigatório" }, 422);

      const { error } = await db
        .from("support_oncall_shifts")
        .update({ is_active: false })
        .eq("id", String(body.shift_id));

      if (error) return jsonResponse({ success: false, message: error.message }, 500);
      return jsonResponse({ success: true, message: "Plantão encerrado" });
    }

    return jsonResponse({ success: false, message: `Ação desconhecida: ${action}` }, 422);
  } catch (err: any) {
    console.error("support-queue-admin error", {
      message: err?.message,
      stack: err?.stack,
      details: err,
    });
    return jsonResponse({ success: false, message: err?.message || "Erro interno" }, 500);
  }
});
