import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-pin",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate X-Admin-PIN header (MVP security gate)
    const adminPin = req.headers.get("x-admin-pin");
    if (!adminPin || adminPin !== "5678") {
      return new Response(
        JSON.stringify({ error: "Invalid admin PIN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate Authorization header (token from external API auth)
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with SERVICE_ROLE_KEY (privileged access)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const url = new URL(req.url);
    const method = req.method;

    // GET /pricing-admin - List all configs
    if (method === "GET") {
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
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /pricing-admin - Create new config
    if (method === "POST") {
      const body = await req.json();
      const { category, section, config } = body;

      if (!category || !section) {
        return new Response(
          JSON.stringify({ error: "category and section are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("calculator_configs")
        .insert({ category, section, config: config || [] })
        .select()
        .single();

      if (error) {
        console.error("POST error:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PUT /pricing-admin?id=X - Update config
    if (method === "PUT") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(
          JSON.stringify({ error: "id query parameter is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const { category, section, config } = body;

      const updatePayload: Record<string, unknown> = {};
      if (category !== undefined) updatePayload.category = category;
      if (section !== undefined) updatePayload.section = section;
      if (config !== undefined) updatePayload.config = config;

      const { data, error } = await supabaseAdmin
        .from("calculator_configs")
        .update(updatePayload)
        .eq("id", parseInt(id, 10))
        .select()
        .single();

      if (error) {
        console.error("PUT error:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE /pricing-admin?id=X - Soft delete config
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(
          JSON.stringify({ error: "id query parameter is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("calculator_configs")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", parseInt(id, 10))
        .select()
        .single();

      if (error) {
        console.error("DELETE error:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ data, message: "Config soft-deleted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
