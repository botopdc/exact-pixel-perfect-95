// ============================================================================
// USER BACKFILL EDGE FUNCTION
// Supports: dry_run, reconcile_check, reconcile_fix, real backfill
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

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function validatePin(pin: string): boolean {
  const adminPin = Deno.env.get("ADMIN_PIN") || "5678";
  return pin === adminPin;
}

async function loadRolesMap(client: ReturnType<typeof createClient>) {
  const { data } = await client.from("roles").select("id, code").eq("is_active", true);
  const map = new Map<string, string>();
  for (const r of data || []) map.set(r.code, r.id);
  return map;
}

async function loadProfiles(client: ReturnType<typeof createClient>) {
  const { data } = await client.from("profiles").select("id, email, legacy_user_id, level, name");
  const byEmail = new Map<string, any>();
  const byLegacyId = new Map<number, any>();
  for (const p of data || []) {
    byEmail.set(p.email.toLowerCase(), p);
    if (p.legacy_user_id != null) byLegacyId.set(p.legacy_user_id, p);
  }
  return { byEmail, byLegacyId, all: data || [] };
}

// ============================================================================
// RECONCILE CHECK — read-only analysis of existing users
// ============================================================================
async function handleReconcileCheck(client: ReturnType<typeof createClient>, users: LegacyUser[]) {
  const profiles = await loadProfiles(client);
  const rolesMap = await loadRolesMap(client);
  const internalRoleId = rolesMap.get("internal_user");

  const results = [];
  for (const u of users.filter(u => u.level >= 600)) {
    const email = u.email?.toLowerCase().trim();
    if (!email || !email.includes("@")) continue;

    const profile = profiles.byEmail.get(email);
    const issues: string[] = [];

    let hasAuthUser = false;
    let hasInternalRole = false;

    if (profile) {
      // Check auth user exists
      const { data: listData } = await client.auth.admin.listUsers();
      const authUser = listData?.users?.find(au => au.email?.toLowerCase() === email);
      hasAuthUser = !!authUser;

      if (!hasAuthUser) issues.push("Profile existe mas auth.users ausente");
      if (profile.legacy_user_id == null) issues.push("legacy_user_id ausente no profile");
      else if (profile.legacy_user_id !== u.id) issues.push(`legacy_user_id diverge: DB=${profile.legacy_user_id}, payload=${u.id}`);
      if (profile.level !== u.level) issues.push(`Level diverge: DB=${profile.level}, payload=${u.level}`);

      // Check internal_user role
      if (internalRoleId) {
        const { data: ur } = await client.from("user_roles")
          .select("id")
          .eq("user_id", profile.id)
          .eq("role_id", internalRoleId)
          .eq("is_active", true)
          .maybeSingle();
        hasInternalRole = !!ur;
        if (!ur) issues.push("Role base 'internal_user' ausente");
      }
    } else {
      issues.push("Profile não existe — elegível para criação");
    }

    results.push({
      email,
      legacy_id: u.id,
      has_auth_user: hasAuthUser,
      has_profile: !!profile,
      has_internal_role: hasInternalRole,
      profile_level: profile?.level ?? null,
      legacy_user_id_in_profile: profile?.legacy_user_id ?? null,
      level_match: profile ? profile.level === u.level : false,
      legacy_id_match: profile ? profile.legacy_user_id === u.id : false,
      issues,
    });
  }

  return results;
}

// ============================================================================
// RECONCILE FIX — targeted safe fixes
// ============================================================================
async function handleReconcileFix(
  client: ReturnType<typeof createClient>,
  fixType: string,
  user: LegacyUser
) {
  const email = user.email?.toLowerCase().trim();
  const { data: profile } = await client.from("profiles")
    .select("id, email, legacy_user_id, level")
    .eq("email", email)
    .maybeSingle();

  if (!profile) return { success: false, error: `Profile não encontrado para ${email}` };

  switch (fixType) {
    case "assign_base_role": {
      const rolesMap = await loadRolesMap(client);
      const internalRoleId = rolesMap.get("internal_user");
      if (!internalRoleId) return { success: false, error: "Role 'internal_user' não encontrada" };

      const { error } = await client.from("user_roles").upsert(
        { user_id: profile.id, role_id: internalRoleId, is_active: true },
        { onConflict: "user_id,role_id" }
      );
      if (error) return { success: false, error: error.message };

      // Also assign level-specific role
      const levelRole = LEVEL_TO_ROLE[user.level];
      if (levelRole && levelRole !== "internal_user") {
        const levelRoleId = rolesMap.get(levelRole);
        if (levelRoleId) {
          await client.from("user_roles").upsert(
            { user_id: profile.id, role_id: levelRoleId, is_active: true },
            { onConflict: "user_id,role_id" }
          );
        }
      }

      console.log(`[RECONCILE] Assigned base role + ${levelRole || ''} to ${email}`);
      return { success: true, message: `Role base atribuída para ${email}` };
    }

    case "fix_legacy_id": {
      if (profile.legacy_user_id != null && profile.legacy_user_id !== user.id) {
        return {
          success: false,
          error: `Profile já tem legacy_user_id=${profile.legacy_user_id}. Remova manualmente antes de sobrescrever.`,
        };
      }
      const { error } = await client.from("profiles")
        .update({ legacy_user_id: user.id })
        .eq("id", profile.id);
      if (error) return { success: false, error: error.message };
      console.log(`[RECONCILE] Set legacy_user_id=${user.id} on profile ${email}`);
      return { success: true, message: `legacy_user_id=${user.id} vinculado para ${email}` };
    }

    case "fix_level": {
      const { error } = await client.from("profiles")
        .update({ level: user.level })
        .eq("id", profile.id);
      if (error) return { success: false, error: error.message };
      console.log(`[RECONCILE] Updated level from ${profile.level} to ${user.level} for ${email}`);
      return { success: true, message: `Level atualizado de ${profile.level} para ${user.level}` };
    }

    default:
      return { success: false, error: `Tipo de fix desconhecido: ${fixType}` };
  }
}

// ============================================================================
// DRY RUN / REAL BACKFILL
// ============================================================================
async function handleBackfill(
  client: ReturnType<typeof createClient>,
  users: LegacyUser[],
  isDryRun: boolean,
  assignRoles: boolean
) {
  const rolesMap = await loadRolesMap(client);
  const profiles = await loadProfiles(client);
  const tag = isDryRun ? "[DRY_RUN]" : "[BACKFILL]";

  const internalUsers = users.filter(u => u.level >= 600);
  console.log(`${tag} Total: ${users.length}, internal: ${internalUsers.length}`);

  // Detect duplicates in payload
  const emailCount = new Map<string, number>();
  const legacyIdCount = new Map<number, number>();
  for (const u of internalUsers) {
    const e = u.email?.toLowerCase().trim();
    if (e) emailCount.set(e, (emailCount.get(e) || 0) + 1);
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
    const rolesToAssign: string[] = [];
    if (assignRoles) {
      rolesToAssign.push("internal_user");
      const lr = LEVEL_TO_ROLE[legacyUser.level];
      if (lr && lr !== "internal_user") rolesToAssign.push(lr);
    }

    // Invalid email
    if (!email || !email.includes("@")) {
      result.invalid_emails++;
      result.user_reports.push({
        email: email || "(empty)", legacy_id: legacyUser.id, level: legacyUser.level,
        status: "invalid_email", reason: "Email inválido ou vazio", roles_to_assign: rolesToAssign,
      });
      console.log(`${tag} INVALID_EMAIL: legacy_id=${legacyUser.id}`);
      continue;
    }

    // Duplicate email in payload
    if ((emailCount.get(email) || 0) > 1) {
      result.duplicates++;
      result.user_reports.push({
        email, legacy_id: legacyUser.id, level: legacyUser.level,
        status: "error", reason: `Email duplicado no payload (${emailCount.get(email)}x)`,
        roles_to_assign: rolesToAssign,
      });
      emailCount.set(email, -1);
      continue;
    }

    // Duplicate legacy_id in payload
    if ((legacyIdCount.get(legacyUser.id) || 0) > 1) {
      result.legacy_id_conflicts++;
      result.user_reports.push({
        email, legacy_id: legacyUser.id, level: legacyUser.level,
        status: "duplicate_legacy_id",
        reason: `legacy_id=${legacyUser.id} duplicado no payload (${legacyIdCount.get(legacyUser.id)}x)`,
        roles_to_assign: rolesToAssign,
      });
      continue;
    }

    // Legacy ID conflict with DB
    const existingByLegacyId = profiles.byLegacyId.get(legacyUser.id);
    if (existingByLegacyId && existingByLegacyId.email.toLowerCase() !== email) {
      result.legacy_id_conflicts++;
      result.user_reports.push({
        email, legacy_id: legacyUser.id, level: legacyUser.level,
        status: "error",
        reason: `legacy_user_id=${legacyUser.id} já atribuído a ${existingByLegacyId.email}`,
        roles_to_assign: rolesToAssign,
        conflict_details: `DB: ${existingByLegacyId.email} (profile=${existingByLegacyId.id})`,
      });
      continue;
    }

    // Already exists
    const existingProfile = profiles.byEmail.get(email);
    if (existingProfile) {
      result.already_exist++;
      result.user_reports.push({
        email, legacy_id: legacyUser.id, level: legacyUser.level,
        status: "skipped_exists", reason: "Profile já existe",
        roles_to_assign: rolesToAssign,
        existing_profile_id: existingProfile.id,
      });

      if (isDryRun) {
        result.roles_assigned.push({ email, roles: rolesToAssign });
        console.log(`${tag} EXISTS: ${email} — WRITE_BLOCKED`);
      } else if (assignRoles) {
        await assignRolesToUser(client, existingProfile.id, rolesToAssign, rolesMap);
        result.roles_assigned.push({ email, roles: rolesToAssign });
      }
      continue;
    }

    // Eligible
    result.eligible++;

    if (isDryRun) {
      result.user_reports.push({
        email, legacy_id: legacyUser.id, level: legacyUser.level,
        status: "would_create", reason: "Elegível — criaria auth + profile + roles",
        roles_to_assign: rolesToAssign,
      });
      result.created++;
      result.roles_assigned.push({ email, roles: rolesToAssign });
      console.log(`${tag} WOULD_CREATE: ${email} — WRITE_BLOCKED`);
      continue;
    }

    // === REAL CREATION ===
    try {
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: authUser, error: authError } = await client.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: legacyUser.name, level: legacyUser.level, legacy_user_id: legacyUser.id },
      });

      if (authError) {
        if (authError.message?.includes("already been registered")) {
          const { data: listData } = await client.auth.admin.listUsers();
          const existing = listData?.users?.find(u => u.email?.toLowerCase() === email);
          if (existing) {
            const { error: pErr } = await client.from("profiles").insert({
              id: existing.id, legacy_user_id: legacyUser.id, name: legacyUser.name,
              email, level: legacyUser.level, entity_id: legacyUser.entity_id || null,
              company_id: legacyUser.company_id || null, is_active: true,
            });
            if (pErr) {
              result.errors.push({ email, reason: pErr.message });
              result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "error", reason: pErr.message, roles_to_assign: rolesToAssign });
            } else {
              result.created++;
              result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "created", roles_to_assign: rolesToAssign });
              if (assignRoles) {
                await assignRolesToUser(client, existing.id, rolesToAssign, rolesMap);
                result.roles_assigned.push({ email, roles: rolesToAssign });
              }
            }
          }
          continue;
        }
        result.errors.push({ email, reason: authError.message });
        result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "error", reason: authError.message, roles_to_assign: rolesToAssign });
        continue;
      }

      if (!authUser?.user) {
        result.errors.push({ email, reason: "Auth retornou null" });
        result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "error", reason: "Auth retornou null", roles_to_assign: rolesToAssign });
        continue;
      }

      const { error: uErr } = await client.from("profiles").upsert({
        id: authUser.user.id, legacy_user_id: legacyUser.id, name: legacyUser.name,
        email, level: legacyUser.level, entity_id: legacyUser.entity_id || null,
        company_id: legacyUser.company_id || null, is_active: true,
      }, { onConflict: "id" });

      if (uErr) {
        result.errors.push({ email, reason: uErr.message });
        result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "error", reason: uErr.message, roles_to_assign: rolesToAssign });
        continue;
      }

      if (assignRoles) {
        await assignRolesToUser(client, authUser.user.id, rolesToAssign, rolesMap);
        result.roles_assigned.push({ email, roles: rolesToAssign });
      }

      result.created++;
      result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "created", roles_to_assign: rolesToAssign });
      console.log(`[BACKFILL] Created: ${email}`);
    } catch (err) {
      result.errors.push({ email, reason: (err as Error).message });
      result.user_reports.push({ email, legacy_id: legacyUser.id, level: legacyUser.level, status: "error", reason: (err as Error).message, roles_to_assign: rolesToAssign });
    }
  }

  console.log(`${tag} DONE — total=${result.total_analysed}, eligible=${result.eligible}, exists=${result.already_exist}, created=${result.created}, errors=${result.errors.length}`);
  return result;
}

async function assignRolesToUser(
  client: ReturnType<typeof createClient>,
  userId: string,
  roleCodes: string[],
  rolesMap: Map<string, string>
) {
  for (const code of roleCodes) {
    const roleId = rolesMap.get(code);
    if (!roleId) { console.warn(`[backfill] Role '${code}' not found`); continue; }
    const { error } = await client.from("user_roles").upsert(
      { user_id: userId, role_id: roleId, is_active: true },
      { onConflict: "user_id,role_id" }
    );
    if (error) console.warn(`[backfill] Role assign failed ${userId}/${code}: ${error.message}`);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { pin, action, users, dry_run = false, assign_roles = true, fix_type, user } = body;

    if (!validatePin(pin)) {
      return new Response(JSON.stringify({ error: "Invalid admin PIN" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const client = getAdminClient();

    // Route by action
    if (action === "reconcile_check") {
      if (!users || !Array.isArray(users)) {
        return new Response(JSON.stringify({ error: "users array required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const results = await handleReconcileCheck(client, users);
      return new Response(JSON.stringify({ success: true, results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "reconcile_fix") {
      if (!fix_type || !user) {
        return new Response(JSON.stringify({ error: "fix_type and user required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const fixResult = await handleReconcileFix(client, fix_type, user);
      return new Response(JSON.stringify(fixResult),
        { status: fixResult.success ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Default: backfill (dry_run or real)
    if (!users || !Array.isArray(users) || users.length === 0) {
      return new Response(JSON.stringify({ error: "No users provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await handleBackfill(client, users, Boolean(dry_run), Boolean(assign_roles));
    return new Response(JSON.stringify({ success: true, result, dry_run: Boolean(dry_run) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[backfill] Fatal:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
