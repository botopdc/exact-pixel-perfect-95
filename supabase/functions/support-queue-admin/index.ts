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
  return ["add_member", "remove_member", "toggle_member"].includes(action);
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

      const insertPayload = {
        queue_id,
        user_id: memberUserId,
        user_name,
        user_email,
        user_level: toInt(memberLevel) || 900,
        is_primary: Boolean(is_primary),
        is_active: true,
      };
      console.log("support-queue-admin add_member insert payload", insertPayload);

      const { data: member, error } = await db
        .from("support_queue_members")
        .upsert(insertPayload, { onConflict: "queue_id,user_id" })
        .select()
        .single();

      if (error) return jsonResponse({ success: false, message: error.message }, 500);
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
