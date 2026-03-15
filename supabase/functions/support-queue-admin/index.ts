// ============================================================================
// EDGE FUNCTION: support-queue-admin
// Manages queues and queue members (CRUD)
// Actions: list_queues, list_members, add_member, remove_member, toggle_member
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
  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const authResult = await validateExternalToken(token);
    if (!authResult.valid) {
      console.error("support-queue-admin auth failed", { tokenLength: token?.length });
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const db = getSupabaseAdmin();
    const action = body.action;
    const userLevel = typeof body.user_level === 'number' ? body.user_level : parseInt(body.user_level) || 0;

    console.log("support-queue-admin request", {
      action,
      userLevel,
      rawUserLevel: body.user_level,
      userId: body.user_id,
    });

    // ── list_queues: all internal users can see ─────────────────────────
    if (action === "list_queues") {
      if (userLevel < 600) return jsonResponse({ success: false, message: "Acesso negado" }, 403);

      const { data: queues, error } = await db
        .from("support_queues")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) return jsonResponse({ success: false, message: error.message }, 500);
      return jsonResponse({ success: true, data: queues });
    }

    // ── list_members: list members of a queue or all ────────────────────
    if (action === "list_members") {
      if (userLevel < 600) return jsonResponse({ success: false, message: "Acesso negado" }, 403);

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

    // ── my_queues: get queues for current user ──────────────────────────
    if (action === "my_queues") {
      if (userLevel < 600 || !body.user_id) return jsonResponse({ success: false, message: "Acesso negado" }, 403);

      const { data: memberships, error } = await db
        .from("support_queue_members")
        .select("*, support_queues(id, code, name)")
        .eq("user_id", parseInt(body.user_id))
        .eq("is_active", true);

      if (error) return jsonResponse({ success: false, message: error.message }, 500);
      return jsonResponse({ success: true, data: memberships });
    }

    // ── Admin-only actions below (950+ for mutations) ─────────────────
    if (userLevel < 950) {
      console.warn("support-queue-admin mutation denied", { action, userLevel });
      return jsonResponse({
        success: false,
        message: "Apenas gerentes e admins podem gerenciar membros",
        debug: { required_levels: [950, 1000], received_level: userLevel },
      }, 403);
    }

    // ── add_member ──────────────────────────────────────────────────────
    if (action === "add_member") {
      const { queue_id, user_id, user_name, user_email, user_level: memberLevel, is_primary } = body;
      if (!queue_id || !user_id || !user_name || !user_email) {
        return jsonResponse({ success: false, message: "queue_id, user_id, user_name e user_email obrigatórios" }, 422);
      }

      const { data: member, error } = await db
        .from("support_queue_members")
        .upsert({
          queue_id,
          user_id: parseInt(user_id),
          user_name,
          user_email,
          user_level: memberLevel || 900,
          is_primary: is_primary || false,
          is_active: true,
        }, { onConflict: "queue_id,user_id" })
        .select()
        .single();

      if (error) return jsonResponse({ success: false, message: error.message }, 500);
      return jsonResponse({ success: true, data: member, message: "Membro adicionado à fila" });
    }

    // ── remove_member ───────────────────────────────────────────────────
    if (action === "remove_member") {
      if (!body.member_id) return jsonResponse({ success: false, message: "member_id obrigatório" }, 422);

      const { error } = await db
        .from("support_queue_members")
        .delete()
        .eq("id", body.member_id);

      if (error) return jsonResponse({ success: false, message: error.message }, 500);
      return jsonResponse({ success: true, message: "Membro removido" });
    }

    // ── toggle_member: activate/deactivate ──────────────────────────────
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
  } catch (err) {
    console.error("support-queue-admin error:", err);
    return jsonResponse({ success: false, message: "Erro interno", errors: [String(err)] }, 500);
  }
});
