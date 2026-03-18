// ============================================================================
// RBAC HELPERS — Roles-first with level_legacy fallback
// Source of truth: public.user_roles → fallback: profile.level
// ============================================================================

import type { UserProfile } from '@/contexts/AuthContext';

// ============================================================================
// ROLE SLUGS — canonical list
// ============================================================================

export const ROLE_SLUGS = {
  ADMIN: 'admin',
  GERENTE_SUPORTE: 'gerente_suporte',
  SUPORTE: 'suporte',
  CS: 'cs',
  GERENTE_COMERCIAL: 'gerente_comercial',
  COMERCIAL: 'comercial',
  ARQUITETO: 'arquiteto',
  BDR: 'bdr',
  RH: 'rh',
  PARCEIRO: 'parceiro',
  CLIENTE: 'cliente',
  INTERNAL_USER: 'internal_user',
} as const;

// ============================================================================
// LEVEL → ROLE MAPPING (fallback when user_roles is empty)
// ============================================================================

export const LEVEL_TO_ROLES: Record<number, string[]> = {
  1000: [ROLE_SLUGS.ADMIN, ROLE_SLUGS.INTERNAL_USER],
  950:  [ROLE_SLUGS.GERENTE_SUPORTE, ROLE_SLUGS.INTERNAL_USER],
  900:  [ROLE_SLUGS.SUPORTE, ROLE_SLUGS.INTERNAL_USER],
  775:  [ROLE_SLUGS.CS, ROLE_SLUGS.INTERNAL_USER],
  750:  [ROLE_SLUGS.GERENTE_COMERCIAL, ROLE_SLUGS.INTERNAL_USER],
  700:  [ROLE_SLUGS.COMERCIAL, ROLE_SLUGS.INTERNAL_USER],
  690:  [ROLE_SLUGS.ARQUITETO, ROLE_SLUGS.INTERNAL_USER],
  680:  [ROLE_SLUGS.BDR, ROLE_SLUGS.INTERNAL_USER],
  600:  [ROLE_SLUGS.RH, ROLE_SLUGS.INTERNAL_USER],
  200:  [ROLE_SLUGS.PARCEIRO],
  1:    [ROLE_SLUGS.CLIENTE],
};

// Re-export levels for backward compat
export const LEVELS = {
  CLIENTE: 1,
  PARCEIRO: 200,
  RH: 600,
  BDR: 680,
  ARQUITETO: 690,
  COMERCIAL: 700,
  GERENTE_COMERCIAL: 750,
  SUCESSO_CLIENTE: 775,
  SUPORTE: 900,
  GERENTE_SUPORTE: 950,
  ADMIN: 1000,
} as const;

export type LevelKey = keyof typeof LEVELS;

// ============================================================================
// USER ROLE INTERFACE
// ============================================================================

export interface UserRole {
  role_slug: string;
}

// ============================================================================
// EFFECTIVE ROLES — Merges DB roles with level-derived fallback
// ============================================================================

/**
 * Returns the effective role slugs for a user.
 * If DB roles exist, use them. Otherwise derive from profile.level.
 */
export function getEffectiveRoles(
  dbRoles: UserRole[] | null | undefined,
  profile: UserProfile | null | undefined,
): string[] {
  // If user has DB roles, use them as source of truth
  if (dbRoles && dbRoles.length > 0) {
    return dbRoles.map(r => r.role_slug);
  }

  // Fallback: derive roles from level
  const level = profile?.level ?? profile?.level_legacy ?? 0;
  return LEVEL_TO_ROLES[level] || [];
}

// ============================================================================
// ROLE-BASED CHECKS (primary)
// ============================================================================

/** Check if effective roles include a specific role */
export function hasRole(roles: string[], code: string): boolean {
  return roles.includes(code);
}

/** Check if effective roles include any of the given roles */
export function hasAnyRole(roles: string[], codes: string[]): boolean {
  return codes.some(code => roles.includes(code));
}

/** Check if effective roles include all of the given roles */
export function hasAllRoles(roles: string[], codes: string[]): boolean {
  return codes.every(code => roles.includes(code));
}

// ============================================================================
// SEMANTIC CHECKS — Roles-first, level fallback
// ============================================================================

export function isAdmin(roles: string[]): boolean {
  return hasRole(roles, ROLE_SLUGS.ADMIN);
}

export function isSupportManager(roles: string[]): boolean {
  return hasAnyRole(roles, [ROLE_SLUGS.GERENTE_SUPORTE, ROLE_SLUGS.ADMIN]);
}

export function isSupport(roles: string[]): boolean {
  return hasAnyRole(roles, [ROLE_SLUGS.SUPORTE, ROLE_SLUGS.GERENTE_SUPORTE, ROLE_SLUGS.ADMIN]);
}

export function isCS(roles: string[]): boolean {
  return hasAnyRole(roles, [ROLE_SLUGS.CS, ROLE_SLUGS.ADMIN]);
}

export function isComercial(roles: string[]): boolean {
  return hasAnyRole(roles, [ROLE_SLUGS.COMERCIAL, ROLE_SLUGS.GERENTE_COMERCIAL, ROLE_SLUGS.ADMIN]);
}

export function isGerenteComercial(roles: string[]): boolean {
  return hasAnyRole(roles, [ROLE_SLUGS.GERENTE_COMERCIAL, ROLE_SLUGS.ADMIN]);
}

export function isInternal(roles: string[]): boolean {
  return hasAnyRole(roles, [ROLE_SLUGS.INTERNAL_USER, ROLE_SLUGS.ADMIN]);
}

export function isPartner(roles: string[]): boolean {
  return hasRole(roles, ROLE_SLUGS.PARCEIRO);
}

export function isClient(roles: string[]): boolean {
  return hasRole(roles, ROLE_SLUGS.CLIENTE);
}

// ============================================================================
// MODULE ACCESS — Roles-based with level fallback for transition
// ============================================================================

/** 
 * Role → level mapping for backward compat with allowedLevels arrays.
 * Used by canAccessByLevel when roles are not yet in module configs.
 */
const ROLE_TO_LEVEL: Record<string, number> = {
  [ROLE_SLUGS.ADMIN]: 1000,
  [ROLE_SLUGS.GERENTE_SUPORTE]: 950,
  [ROLE_SLUGS.SUPORTE]: 900,
  [ROLE_SLUGS.CS]: 775,
  [ROLE_SLUGS.GERENTE_COMERCIAL]: 750,
  [ROLE_SLUGS.COMERCIAL]: 700,
  [ROLE_SLUGS.ARQUITETO]: 690,
  [ROLE_SLUGS.BDR]: 680,
  [ROLE_SLUGS.RH]: 600,
  [ROLE_SLUGS.PARCEIRO]: 200,
  [ROLE_SLUGS.CLIENTE]: 1,
};

/**
 * Check access using effective roles against an allowedLevels array.
 * Maps each role to its equivalent level and checks inclusion.
 * Admin role always passes.
 */
export function canAccessByAllowedLevels(
  effectiveRoles: string[],
  allowedLevels: number[],
): boolean {
  if (effectiveRoles.length === 0) return false;
  if (hasRole(effectiveRoles, ROLE_SLUGS.ADMIN)) return true;

  return effectiveRoles.some(role => {
    const equivalentLevel = ROLE_TO_LEVEL[role];
    return equivalentLevel !== undefined && allowedLevels.includes(equivalentLevel);
  });
}

// ============================================================================
// GENERIC CHECKS (backward compat)
// ============================================================================

/** Check if user has at least the given level (legacy) */
export function hasMinimumLevel(profile: UserProfile | null, requiredLevel: number): boolean {
  return (profile?.level ?? 0) >= requiredLevel;
}

/** Get human-readable role name */
export function getRoleName(roleSlug: string): string {
  const map: Record<string, string> = {
    admin: 'Administrador',
    gerente_suporte: 'Gerente de Suporte',
    suporte: 'Suporte',
    cs: 'Customer Success',
    gerente_comercial: 'Gerente Comercial',
    comercial: 'Executivo Comercial',
    arquiteto: 'Arquiteto de Soluções',
    bdr: 'BDR',
    rh: 'RH',
    parceiro: 'Parceiro',
    cliente: 'Cliente',
    internal_user: 'Usuário Interno',
  };
  return map[roleSlug] || roleSlug;
}

/** Get human-readable level name (legacy compat) */
export function getLevelName(level: number): string {
  const map: Record<number, string> = {
    1: 'Cliente',
    200: 'Parceiro',
    600: 'RH',
    680: 'BDR',
    690: 'Arquiteto de Soluções',
    700: 'Executivo Comercial',
    750: 'Gerente Comercial',
    775: 'Customer Success',
    900: 'Suporte',
    950: 'Gerente de Suporte',
    1000: 'Administrador',
  };
  return map[level] || `Nível ${level}`;
}

/** Get display name: prefer primary role, fallback to level */
export function getUserDisplayRole(effectiveRoles: string[], level?: number | null): string {
  // Filter out internal_user for display
  const displayRoles = effectiveRoles.filter(r => r !== ROLE_SLUGS.INTERNAL_USER);
  if (displayRoles.length > 0) {
    return getRoleName(displayRoles[0]);
  }
  if (level != null) {
    return getLevelName(level);
  }
  return 'Usuário';
}

/** Get the redirect path based on roles */
export function getRedirectByRoles(effectiveRoles: string[]): string {
  if (hasRole(effectiveRoles, ROLE_SLUGS.PARCEIRO)) return '/parceiro/dashboard';
  if (hasRole(effectiveRoles, ROLE_SLUGS.CLIENTE)) return '/portal/tickets';
  return '/modulos/dashboard';
}
