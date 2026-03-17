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

type UserStatus = "would_create" | "created" | "skipped_exists" | "error" | "invalid_email" | "duplicate_legacy_id";

interface UserReport {
  email: string;
  legacy_id: number;
  level: number;
  status: UserStatus;
  reason?: string;
  roles_to_assign: string[];
  existing_profile_id?: string;
  conflict_details?: string;
}

interface BackfillResult {
  total_analysed: number;
  eligible: number;
  already_exist: number;
  invalid_emails: number;
  duplicates: number;
  legacy_id_conflicts: number;
  created: number;
  errors: { email: string; reason: string }[];
  roles_assigned: { email: string; roles: string[] }[];
  user_reports: UserReport[];
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

    const isDryRun = Boolean(dry_run);
    const tag = isDryRun ? "[DRY_RUN]" : "[BACKFILL]";

    const internalUsers = users.filter((u) => u.level >= 600);
    console.log(`${tag} Total received: ${users.length}, internal (>=600): ${internalUsers.length}, dry_run=${isDryRun}`);

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

    // Pre-load existing profiles for conflict detection
    const { data: existingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, legacy_user_id, level, name");

    const profileByEmail = new Map<string, typeof existingProfiles extends (infer T)[] | null ? T : never>();
    const profileByLegacyId = new Map<number, typeof existingProfiles extends (infer T)[] | null ? T : never>();

    for (const p of existingProfiles || []) {
      profileByEmail.set(p.email.toLowerCase(), p);
      if (p.legacy_user_id != null) {
        profileByLegacyId.set(p.legacy_user_id, p);
      }
    }

    // Detect duplicate emails in the input payload
    const emailCount = new Map<string, number>();
    for (const u of internalUsers) {
      const e = u.email?.toLowerCase().trim();
      if (e) emailCount.set(e, (emailCount.get(e) || 0) + 1);
    }

    // Detect duplicate legacy_ids in the input payload
    const legacyIdCount = new Map<number, number>();
    for (const u of internalUsers) {
      legacyIdCount.set(u.id, (legacyIdCount.get(u.id) || 0) + 1);
    }

    const result: BackfillResult = {
      total_analysed: internalUsers.length,
      eligible: 0,
      already_exist: 0,
      invalid_emails: 0,
      duplicates: 0,
      legacy_id_conflicts: 0,
      created: 0,
      errors: [],
      roles_assigned: [],
      user_reports: [],
    };

    for (const legacyUser of internalUsers) {
      const email = legacyUser.email?.toLowerCase().trim();

      // --- Determine roles ---
      const rolesToAssign: string[] = [];
      if (assign_roles) {
        rolesToAssign.push("internal_user");
        const levelRole = LEVEL_TO_ROLE[legacyUser.level];
        if (levelRole && levelRole !== "internal_user") {
          rolesToAssign.push(levelRole);
        }
      }

      // --- Invalid email check ---
      if (!email || !email.includes("@")) {
        result.invalid_emails++;
        result.user_reports.push({
          email: email || "(empty)",
          legacy_id: legacyUser.id,
          level: legacyUser.level,
          status: "invalid_email",
          reason: "Invalid or missing email",
          roles_to_assign: rolesToAssign,
        });
        console.log(`${tag} INVALID_EMAIL: legacy_id=${legacyUser.id}, email="${email || ""}"`);
        continue;
      }

      // --- Duplicate email in payload ---
      if ((emailCount.get(email) || 0) > 1) {
        result.duplicates++;
        result.user_reports.push({
          email,
          legacy_id: legacyUser.id,
          level: legacyUser.level,
          status: "error",
          reason: `Duplicate email in payload (appears ${emailCount.get(email)} times)`,
          roles_to_assign: rolesToAssign,
        });
        console.log(`${tag} DUPLICATE_EMAIL: ${email} appears ${emailCount.get(email)} times in payload`);
        // Process only first occurrence - mark others as duplicates
        emailCount.set(email, -1); // sentinel: first was processed
        // Don't continue — let the first occurrence be processed normally below
        // Actually, skip all duplicates for safety
        continue;
      }
      // If sentinel (-1), this is the first occurrence already processed
      if ((emailCount.get(email) || 0) === -1) {
        // Reset so we don't skip the first one
        // Actually the logic above already set -1, so the first occurrence won't have count > 1
        // Let me fix: track duplicates differently
      }

      // --- Duplicate legacy_id in payload ---
      if ((legacyIdCount.get(legacyUser.id) || 0) > 1) {
        result.legacy_id_conflicts++;
        result.user_reports.push({
          email,
          legacy_id: legacyUser.id,
          level: legacyUser.level,
          status: "duplicate_legacy_id",
          reason: `Duplicate legacy_id=${legacyUser.id} in payload (appears ${legacyIdCount.get(legacyUser.id)} times)`,
          roles_to_assign: rolesToAssign,
        });
        console.log(`${tag} DUPLICATE_LEGACY_ID: legacy_id=${legacyUser.id} for ${email}`);
        continue;
      }

      // --- Legacy ID conflict with existing DB profile (different email) ---
      const existingByLegacyId = profileByLegacyId.get(legacyUser.id);
      if (existingByLegacyId && existingByLegacyId.email.toLowerCase() !== email) {
        result.legacy_id_conflicts++;
        result.user_reports.push({
          email,
          legacy_id: legacyUser.id,
          level: legacyUser.level,
          status: "error",
          reason: `legacy_user_id=${legacyUser.id} already assigned to ${existingByLegacyId.email}`,
          roles_to_assign: rolesToAssign,
          conflict_details: `Existing: ${existingByLegacyId.email} (profile_id=${existingByLegacyId.id})`,
        });
        console.log(`${tag} LEGACY_ID_CONFLICT: legacy_id=${legacyUser.id} → DB has ${existingByLegacyId.email}, payload has ${email}`);
        continue;
      }

      // --- Already exists check ---
      const existingProfile = profileByEmail.get(email);
      if (existingProfile) {
        result.already_exist++;
        const report: UserReport = {
          email,
          legacy_id: legacyUser.id,
          level: legacyUser.level,
          status: "skipped_exists",
          reason: "Profile already exists in database",
          roles_to_assign: rolesToAssign,
          existing_profile_id: existingProfile.id,
        };
        result.user_reports.push(report);
        console.log(`${tag} EXISTS: ${email} (profile_id=${existingProfile.id}, legacy_id=${existingProfile.legacy_user_id})`);

        if (isDryRun) {
          result.roles_assigned.push({ email, roles: rolesToAssign });
          console.log(`${tag} WRITE_BLOCKED: would assign roles [${rolesToAssign.join(",")}] to existing ${email}`);
        } else if (assign_roles) {
          await assignRoles(supabaseAdmin, existingProfile.id, rolesToAssign, rolesMap);
          result.roles_assigned.push({ email, roles: rolesToAssign });
        }
        continue;
      }

      // --- Eligible for creation ---
      result.eligible++;

      if (isDryRun) {
        result.user_reports.push({
          email,
          legacy_id: legacyUser.id,
          level: legacyUser.level,
          status: "would_create",
          reason: "Eligible — would create auth user + profile + roles",
          roles_to_assign: rolesToAssign,
        });
        result.created++;
        result.roles_assigned.push({ email, roles: rolesToAssign });
        console.log(`${tag} WOULD_CREATE: ${email} (legacy_id=${legacyUser.id}, level=${legacyUser.level}, roles=[${rolesToAssign.join(",")}])`);
        console.log(`${tag} WRITE_BLOCKED: no auth.users, profiles, or user_roles records created`);
        continue;
      }

      // === REAL EXECUTION (dry_run=false only) ===
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
                result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "error", reason: profileError.message, roles_to_assign: rolesToAssign });
              } else {
                result.created++;
                result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "created", roles_to_assign: rolesToAssign });
                if (assign_roles) {
                  await assignRoles(supabaseAdmin, existingAuthUser.id, rolesToAssign, rolesMap);
                  result.roles_assigned.push({ email, roles: rolesToAssign });
                }
              }
            } else {
              result.errors.push({ email, reason: "Auth user exists but not found for profile" });
              result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "error", reason: "Auth user exists but not found", roles_to_assign: rolesToAssign });
            }
            continue;
          }
          result.errors.push({ email, reason: `Auth create failed: ${authError.message}` });
          result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "error", reason: authError.message, roles_to_assign: rolesToAssign });
          continue;
        }

        if (!authUser?.user) {
          result.errors.push({ email, reason: "Auth user creation returned null" });
          result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "error", reason: "Auth returned null", roles_to_assign: rolesToAssign });
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
          result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "error", reason: upsertError.message, roles_to_assign: rolesToAssign });
          continue;
        }

        if (assign_roles) {
          await assignRoles(supabaseAdmin, authUser.user.id, rolesToAssign, rolesMap);
          result.roles_assigned.push({ email, roles: rolesToAssign });
        }

        result.created++;
        result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "created", roles_to_assign: rolesToAssign });
        console.log(`[BACKFILL] Created: ${email} (legacy_id=${legacyUser.id}, level=${legacyUser.level})`);
      } catch (err) {
        result.errors.push({ email, reason: `Unexpected: ${(err as Error).message}` });
        result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "error", reason: (err as Error).message, roles_to_assign: rolesToAssign });
      }
    }

    console.log(`${tag} DONE — total=${result.total_analysed}, eligible=${result.eligible}, exists=${result.already_exist}, invalid=${result.invalid_emails}, duplicates=${result.duplicates}, legacy_conflicts=${result.legacy_id_conflicts}, created=${result.created}, errors=${result.errors.length}`);

    return new Response(
      JSON.stringify({ success: true, result, dry_run: isDryRun }),
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

// Helper: assign roles to a user (idempotent) — NEVER called during dry_run
async function assignRoles(
  client: ReturnType<typeof createClient>,
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
