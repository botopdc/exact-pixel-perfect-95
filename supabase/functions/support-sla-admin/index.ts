// ============================================================================
// EDGE FUNCTION: support-sla-admin
// CRUD for SLA policies — admin/manager only
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

    // LIST
    if (req.method === "GET") {
      const { data, error } = await db
        .from("support_sla_policies")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) return jsonResponse({ success: false, message: error.message }, 500);
      return jsonResponse({ success: true, data });
    }

    // POST / PUT / DELETE
    if (req.method === "POST") {
      const body = await req.json();
      const action = body.action || "list";

      // Check admin permission
      if (action !== "list" && (body.user_level || 0) < 950) {
        return jsonResponse({ success: false, message: "Apenas admin/gerência pode gerenciar SLA" }, 403);
      }

      if (action === "list") {
        const { data, error } = await db
          .from("support_sla_policies")
          .select("*")
          .order("sort_order", { ascending: true });
        if (error) return jsonResponse({ success: false, message: error.message }, 500);
        return jsonResponse({ success: true, data });
      }

      if (action === "create") {
        const { code, name, severity, ticket_type, category, customer_plan,
          business_hours_only, first_response_minutes, resolution_minutes,
          pause_on_waiting_customer, pause_on_waiting_third_party, sort_order } = body;

        if (!code || !name || !first_response_minutes || !resolution_minutes) {
          return jsonResponse({ success: false, message: "code, name, first_response_minutes, resolution_minutes obrigatórios" }, 422);
        }

        const { data, error } = await db
          .from("support_sla_policies")
          .insert({
            code, name, severity, ticket_type, category, customer_plan,
            business_hours_only: business_hours_only || false,
            first_response_minutes, resolution_minutes,
            pause_on_waiting_customer: pause_on_waiting_customer !== false,
            pause_on_waiting_third_party: pause_on_waiting_third_party !== false,
            sort_order: sort_order || 0,
            is_active: true,
          })
          .select()
          .single();

        if (error) return jsonResponse({ success: false, message: error.message }, 500);
        return jsonResponse({ success: true, data, message: "Política SLA criada" }, 201);
      }

      if (action === "update") {
        const { id, ...fields } = body;
        if (!id) return jsonResponse({ success: false, message: "id obrigatório" }, 422);

        // Remove non-SLA fields
        delete fields.action;
        delete fields.user_level;

        const { data, error } = await db
          .from("support_sla_policies")
          .update(fields)
          .eq("id", id)
          .select()
          .single();

        if (error) return jsonResponse({ success: false, message: error.message }, 500);
        return jsonResponse({ success: true, data, message: "Política SLA atualizada" });
      }

      if (action === "delete") {
        if (!body.id) return jsonResponse({ success: false, message: "id obrigatório" }, 422);

        const { error } = await db
          .from("support_sla_policies")
          .delete()
          .eq("id", body.id);

        if (error) return jsonResponse({ success: false, message: error.message }, 500);
        return jsonResponse({ success: true, message: "Política SLA removida" });
      }

      return jsonResponse({ success: false, message: `Ação desconhecida: ${action}` }, 422);
    }

    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  } catch (err) {
    console.error("support-sla-admin error:", err);
    return jsonResponse({ success: false, message: "Erro interno", errors: [String(err)] }, 500);
  }
});
