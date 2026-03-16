// ============================================================================
// USER BACKFILL EDGE FUNCTION
// Imports legacy users from CORE API into Supabase Auth + public.profiles
// Strategy: Opção A — no password migration, users must reset/set password
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LegacyUser {
  id: number;
  uuid?: string;
  name: string;
  email: string;
  level: number;
  entity_id?: number;
  company_id?: number;
  roles?: string[];
  created_at?: string;
}

interface BackfillResult {
  total: number;
  created: number;
  skipped: number;
  errors: { email: string; reason: string }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminPin = Deno.env.get("ADMIN_PIN") || "5678";

    const body = await req.json();
    const { pin, users, dry_run = false } = body as {
      pin: string;
      users: LegacyUser[];
      dry_run?: boolean;
    };

    // Validate admin PIN
    if (pin !== adminPin) {
      return new Response(
        JSON.stringify({ error: "Invalid admin PIN" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!users || !Array.isArray(users) || users.length === 0) {
      return new Response(
        JSON.stringify({ error: "No users provided. Send { pin, users: [...] }" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter only internal users (level >= 600)
    const internalUsers = users.filter((u) => u.level >= 600);
    console.log(`[backfill] Total users received: ${users.length}, internal (>=600): ${internalUsers.length}`);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const result: BackfillResult = {
      total: internalUsers.length,
      created: 0,
      skipped: 0,
      errors: [],
    };

    for (const legacyUser of internalUsers) {
      const email = legacyUser.email?.toLowerCase().trim();

      // Validate email
      if (!email || !email.includes("@")) {
        result.errors.push({ email: email || "(empty)", reason: "Invalid email" });
        continue;
      }

      // Check if profile already exists by email
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, email, legacy_user_id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        console.log(`[backfill] SKIP: ${email} already exists in profiles`);
        result.skipped++;
        continue;
      }

      if (dry_run) {
        console.log(`[backfill] DRY_RUN: would create ${email} (legacy_id=${legacyUser.id}, level=${legacyUser.level})`);
        result.created++;
        continue;
      }

      try {
        // Create user in auth.users with a random password (they must reset)
        const tempPassword = crypto.randomUUID() + "Aa1!";

        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true, // Mark email as confirmed since we know it from legacy
          user_metadata: {
            name: legacyUser.name,
            level: legacyUser.level,
            legacy_user_id: legacyUser.id,
          },
        });

        if (authError) {
          // If user already exists in auth but not in profiles
          if (authError.message?.includes("already been registered")) {
            // Try to find auth user by email and create profile
            const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
            const existingAuthUser = listData?.users?.find(
              (u) => u.email?.toLowerCase() === email
            );

            if (existingAuthUser) {
              // Create profile for existing auth user
              const { error: profileError } = await supabaseAdmin
                .from("profiles")
                .insert({
                  id: existingAuthUser.id,
                  legacy_user_id: legacyUser.id,
                  name: legacyUser.name,
                  email,
                  level: legacyUser.level,
                  entity_id: legacyUser.entity_id || null,
                  company_id: legacyUser.company_id || null,
                  is_active: true,
                });

              if (profileError) {
                result.errors.push({ email, reason: `Profile insert failed: ${profileError.message}` });
              } else {
                result.created++;
                console.log(`[backfill] Created profile for existing auth user: ${email}`);
              }
            } else {
              result.errors.push({ email, reason: "Auth user exists but couldn't be found for profile creation" });
            }
            continue;
          }

          result.errors.push({ email, reason: `Auth create failed: ${authError.message}` });
          continue;
        }

        if (!authUser?.user) {
          result.errors.push({ email, reason: "Auth user creation returned null" });
          continue;
        }

        // The trigger should auto-create the profile, but let's update it with full data
        const { error: upsertError } = await supabaseAdmin
          .from("profiles")
          .upsert({
            id: authUser.user.id,
            legacy_user_id: legacyUser.id,
            name: legacyUser.name,
            email,
            level: legacyUser.level,
            entity_id: legacyUser.entity_id || null,
            company_id: legacyUser.company_id || null,
            is_active: true,
          }, { onConflict: "id" });

        if (upsertError) {
          result.errors.push({ email, reason: `Profile upsert failed: ${upsertError.message}` });
          continue;
        }

        result.created++;
        console.log(`[backfill] Created: ${email} (legacy_id=${legacyUser.id}, level=${legacyUser.level})`);
      } catch (err) {
        result.errors.push({ email, reason: `Unexpected: ${(err as Error).message}` });
      }
    }

    console.log(`[backfill] DONE — created: ${result.created}, skipped: ${result.skipped}, errors: ${result.errors.length}`);

    return new Response(
      JSON.stringify({ success: true, result, dry_run }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[backfill] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
