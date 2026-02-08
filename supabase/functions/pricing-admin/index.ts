// ============================================================================
// PRICING ADMIN EDGE FUNCTION
// CRUD operations for calculator_configs table
// Protected by Authorization token + X-Admin-PIN
// ============================================================================

import { getSupabaseAdmin, validateExternalToken, validateAdminPin } from "../_shared/supabaseAdmin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-pin",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(error: string, status: number) {
  return jsonResponse({ error }, status);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ========================================================================
    // SECURITY VALIDATION
    // ========================================================================

    // 1. Validate Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse("Missing or invalid authorization token", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const tokenValidation = await validateExternalToken(token);
    if (!tokenValidation.valid) {
      return errorResponse(tokenValidation.error || "Invalid token", 401);
    }

    // 2. Validate X-Admin-PIN header
    const adminPin = req.headers.get("x-admin-pin");
    if (!validateAdminPin(adminPin)) {
      return errorResponse("Invalid admin PIN", 403);
    }

    // ========================================================================
    // DATABASE CLIENT
    // ========================================================================

    const supabaseAdmin = getSupabaseAdmin();
    const url = new URL(req.url);
    const method = req.method;
    const id = url.searchParams.get("id");

    // ========================================================================
    // GET - List all configs or get by ID
    // ========================================================================
    if (method === "GET") {
      // Get by ID
      if (id) {
        const { data, error } = await supabaseAdmin
          .from("calculator_configs")
          .select("*")
          .eq("id", parseInt(id, 10))
          .is("deleted_at", null)
          .single();

        if (error) {
          console.error("GET by ID error:", error);
          return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);
        }

        return jsonResponse({ data });
      }

      // List all with optional filters
      const category = url.searchParams.get("category");
      const section = url.searchParams.get("section");

      let query = supabaseAdmin
        .from("calculator_configs")
        .select("*")
        .is("deleted_at", null)
        .order("category")
        .order("section");

      if (category) {
        query = query.eq("category", category);
      }
      if (section) {
        query = query.eq("section", section);
      }

      const { data, error } = await query;

      if (error) {
        console.error("GET error:", error);
        return errorResponse(error.message, 500);
      }

      return jsonResponse({ data });
    }

    // ========================================================================
    // POST - Upsert by (category, section)
    // ========================================================================
    if (method === "POST") {
      const body = await req.json();
      const { category, section, config } = body;

      if (!category || !section) {
        return errorResponse("category and section are required", 400);
      }

      // Check if exists (including soft-deleted)
      const { data: existing } = await supabaseAdmin
        .from("calculator_configs")
        .select("id, deleted_at")
        .eq("category", category)
        .eq("section", section)
        .maybeSingle();

      if (existing) {
        // Update existing (reactivate if soft-deleted)
        const { data, error } = await supabaseAdmin
          .from("calculator_configs")
          .update({ 
            config: config || [], 
            deleted_at: null // reactivate if was soft-deleted
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) {
          console.error("POST update error:", error);
          return errorResponse(error.message, 500);
        }

        return jsonResponse({ data, action: "updated" }, 200);
      }

      // Insert new
      const { data, error } = await supabaseAdmin
        .from("calculator_configs")
        .insert({ category, section, config: config || [] })
        .select()
        .single();

      if (error) {
        console.error("POST insert error:", error);
        return errorResponse(error.message, 500);
      }

      return jsonResponse({ data, action: "created" }, 201);
    }

    // ========================================================================
    // PUT - Update by ID
    // ========================================================================
    if (method === "PUT") {
      if (!id) {
        return errorResponse("id query parameter is required", 400);
      }

      const body = await req.json();
      const { category, section, config } = body;

      const updatePayload: Record<string, unknown> = {};
      if (category !== undefined) updatePayload.category = category;
      if (section !== undefined) updatePayload.section = section;
      if (config !== undefined) updatePayload.config = config;

      if (Object.keys(updatePayload).length === 0) {
        return errorResponse("No fields to update", 400);
      }

      const { data, error } = await supabaseAdmin
        .from("calculator_configs")
        .update(updatePayload)
        .eq("id", parseInt(id, 10))
        .is("deleted_at", null)
        .select()
        .single();

      if (error) {
        console.error("PUT error:", error);
        return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);
      }

      return jsonResponse({ data });
    }

    // ========================================================================
    // DELETE - Soft delete by ID
    // ========================================================================
    if (method === "DELETE") {
      if (!id) {
        return errorResponse("id query parameter is required", 400);
      }

      const { data, error } = await supabaseAdmin
        .from("calculator_configs")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", parseInt(id, 10))
        .is("deleted_at", null)
        .select()
        .single();

      if (error) {
        console.error("DELETE error:", error);
        return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);
      }

      return jsonResponse({ data, message: "Config soft-deleted" });
    }

    return errorResponse("Method not allowed", 405);

  } catch (err) {
    console.error("Unexpected error:", err);
    return errorResponse("Internal server error", 500);
  }
});
