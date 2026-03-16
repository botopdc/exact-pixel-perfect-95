// ============================================================================
// USER BACKFILL EDGE FUNCTION
// Imports legacy users into Supabase Auth + public.profiles + user_roles
// Strategy: Option A — no password migration, users must reset/set password
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
  roles_assigned: { email: string; roles: string[] }[];
}

// Level → role code mapping
const LEVEL_TO_ROLE: Record<number, string> = {
  1000: "admin",
  950: "gerente_suporte",
  900: "suporte_n1",
  775: "cs",
  750: "gerente_comercial",
  700: "comercial",
  600: "rh",
  200: "parceiro",
  1: "cliente",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { pin, users, dry_run = false, assign_roles = true } = body as {
      pin: string;
      users: LegacyUser[];
      dry_run?: boolean;
      assign_roles?: boolean;
    };

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

    const internalUsers = users.filter((u) => u.level >= 600);
    console.log(`[backfill] Total: ${users.length}, internal (>=600): ${internalUsers.length}`);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Pre-load roles map
    const { data: rolesData } = await supabaseAdmin
      .from("roles")
      .select("id, code")
      .eq("is_active", true);

    const rolesMap = new Map<string, string>();
    for (const r of rolesData || []) {
      rolesMap.set(r.code, r.id);
    }

    const result: BackfillResult = {
      total: internalUsers.length,
      created: 0,
      skipped: 0,
      errors: [],
      roles_assigned: [],
    };

    for (const legacyUser of internalUsers) {
      const email = legacyUser.email?.toLowerCase().trim();
      if (!email || !email.includes("@")) {
        result.errors.push({ email: email || "(empty)", reason: "Invalid email" });
        continue;
      }

      // Determine roles to assign
      const rolesToAssign: string[] = [];
      if (assign_roles) {
        rolesToAssign.push("internal_user");
        const levelRole = LEVEL_TO_ROLE[legacyUser.level];
        if (levelRole && levelRole !== "internal_user") {
          rolesToAssign.push(levelRole);
        }
      }

      // Check existing profile
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, email, legacy_user_id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        console.log(`[backfill] SKIP: ${email} already exists`);
        result.skipped++;

        // Even for existing profiles, assign roles if missing (dry_run aware)
        if (assign_roles && !dry_run) {
          await assignRoles(supabaseAdmin, existingProfile.id, rolesToAssign, rolesMap);
          result.roles_assigned.push({ email, roles: rolesToAssign });
        } else if (dry_run) {
          result.roles_assigned.push({ email, roles: rolesToAssign });
        }
        continue;
      }

      if (dry_run) {
        console.log(`[backfill] DRY_RUN: would create ${email} (legacy_id=${legacyUser.id}, level=${legacyUser.level}, roles=${rolesToAssign.join(",")})`);
        result.created++;
        result.roles_assigned.push({ email, roles: rolesToAssign });
        continue;
      }

      try {
        const tempPassword = crypto.randomUUID() + "Aa1!";
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            name: legacyUser.name,
            level: legacyUser.level,
            legacy_user_id: legacyUser.id,
          },
        });

        if (authError) {
          if (authError.message?.includes("already been registered")) {
            const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
            const existingAuthUser = listData?.users?.find(
              (u) => u.email?.toLowerCase() === email
            );
            if (existingAuthUser) {
              const { error: profileError } = await supabaseAdmin.from("profiles").insert({
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
                if (assign_roles) {
                  await assignRoles(supabaseAdmin, existingAuthUser.id, rolesToAssign, rolesMap);
                  result.roles_assigned.push({ email, roles: rolesToAssign });
                }
              }
            } else {
              result.errors.push({ email, reason: "Auth user exists but not found for profile" });
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

        const { error: upsertError } = await supabaseAdmin.from("profiles").upsert({
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

        // Assign roles
        if (assign_roles) {
          await assignRoles(supabaseAdmin, authUser.user.id, rolesToAssign, rolesMap);
          result.roles_assigned.push({ email, roles: rolesToAssign });
        }

        result.created++;
        console.log(`[backfill] Created: ${email} (legacy_id=${legacyUser.id}, level=${legacyUser.level}, roles=${rolesToAssign.join(",")})`);
      } catch (err) {
        result.errors.push({ email, reason: `Unexpected: ${(err as Error).message}` });
      }
    }

    console.log(`[backfill] DONE — created: ${result.created}, skipped: ${result.skipped}, errors: ${result.errors.length}, roles: ${result.roles_assigned.length}`);

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

// Helper: assign roles to a user (idempotent)
async function assignRoles(
  client: any,
  userId: string,
  roleCodes: string[],
  rolesMap: Map<string, string>
) {
  for (const code of roleCodes) {
    const roleId = rolesMap.get(code);
    if (!roleId) {
      console.warn(`[backfill] Role '${code}' not found in roles table`);
      continue;
    }
    const { error } = await client.from("user_roles").upsert(
      { user_id: userId, role_id: roleId, is_active: true },
      { onConflict: "user_id,role_id" }
    );
    if (error) {
      console.warn(`[backfill] Role assign failed for ${userId}/${code}: ${error.message}`);
    }
  }
}
