// ============================================================================
// RBAC HELPERS — Hybrid permission checks: roles + profile.level fallback
// Source of truth: public.user_roles → fallback: public.profiles.level
// ============================================================================

import type { UserProfile } from '@/contexts/AuthContext';

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

// Level → role code mapping (used for backfill and fallback)
export const LEVEL_TO_ROLE: Record<number, string> = {
  1000: 'admin',
  950: 'gerente_suporte',
  900: 'suporte_n1',
  775: 'cs',
  750: 'gerente_comercial',
  700: 'comercial',
  600: 'rh',
  200: 'parceiro',
  1: 'cliente',
};

// ============================================================================
// ROLE-BASED CHECKS (new model)
// ============================================================================

export interface UserRole {
  role_id: string;
  role_code: string;
  is_active: boolean;
}

/** Check if user has a specific role by code */
export function hasRole(roles: UserRole[] | null | undefined, code: string): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some(r => r.role_code === code && r.is_active);
}

/** Check if user has any of the specified roles */
export function hasAnyRole(roles: UserRole[] | null | undefined, codes: string[]): boolean {
  if (!roles || roles.length === 0) return false;
  return codes.some(code => hasRole(roles, code));
}

/** Check if user has all of the specified roles */
export function hasAllRoles(roles: UserRole[] | null | undefined, codes: string[]): boolean {
  if (!roles || roles.length === 0) return false;
  return codes.every(code => hasRole(roles, code));
}

// ============================================================================
// HYBRID CHECKS — Roles first, level fallback
// ============================================================================

/** User is admin: role 'admin' OR level >= 1000 */
export function isAdmin(profile: UserProfile | null, roles?: UserRole[] | null): boolean {
  if (hasRole(roles, 'admin')) return true;
  return (profile?.level ?? 0) >= LEVELS.ADMIN;
}

/** User is support manager: role OR level >= 950 */
export function isSupportManager(profile: UserProfile | null, roles?: UserRole[] | null): boolean {
  if (hasAnyRole(roles, ['gerente_suporte', 'admin'])) return true;
  return (profile?.level ?? 0) >= LEVELS.GERENTE_SUPORTE;
}

/** User is support: role OR level === 900 */
export function isSupport(profile: UserProfile | null, roles?: UserRole[] | null): boolean {
  if (hasAnyRole(roles, ['suporte_n1', 'suporte_n2', 'suporte_n3', 'gerente_suporte', 'admin'])) return true;
  return profile?.level === LEVELS.SUPORTE;
}

/** User is CS: role OR level === 775 */
export function isCS(profile: UserProfile | null, roles?: UserRole[] | null): boolean {
  if (hasRole(roles, 'cs')) return true;
  return profile?.level === LEVELS.SUCESSO_CLIENTE;
}

/** User is comercial: role OR level === 700 */
export function isComercial(profile: UserProfile | null, roles?: UserRole[] | null): boolean {
  if (hasAnyRole(roles, ['comercial', 'gerente_comercial'])) return true;
  return profile?.level === LEVELS.COMERCIAL;
}

/** User is gerente comercial: role OR level >= 750 */
export function isGerenteComercial(profile: UserProfile | null, roles?: UserRole[] | null): boolean {
  if (hasAnyRole(roles, ['gerente_comercial', 'admin'])) return true;
  return (profile?.level ?? 0) >= LEVELS.GERENTE_COMERCIAL;
}

/** User is internal: role OR level >= 600 */
export function isInternal(profile: UserProfile | null, roles?: UserRole[] | null): boolean {
  if (hasRole(roles, 'internal_user')) return true;
  return (profile?.level ?? 0) >= LEVELS.RH;
}

/** User is partner: role OR level === 200 */
export function isPartner(profile: UserProfile | null, roles?: UserRole[] | null): boolean {
  if (hasRole(roles, 'parceiro')) return true;
  return profile?.level === LEVELS.PARCEIRO;
}

/** User is client: role OR level === 1 */
export function isClient(profile: UserProfile | null, roles?: UserRole[] | null): boolean {
  if (hasRole(roles, 'cliente')) return true;
  return profile?.level === LEVELS.CLIENTE;
}

// ============================================================================
// GENERIC CHECKS (backward compat)
// ============================================================================

/** Check if user has at least the given level */
export function hasMinimumLevel(profile: UserProfile | null, requiredLevel: number): boolean {
  return (profile?.level ?? 0) >= requiredLevel;
}

/** Check if user can access a module based on allowed levels array */
export function canAccessModule(profile: UserProfile | null, allowedLevels: number[]): boolean {
  if (!profile) return false;
  return allowedLevels.includes(profile.level);
}

/** Get human-readable level name */
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

/** Get the redirect path based on level */
export function getRedirectByLevel(level: number): string {
  if (level === LEVELS.PARCEIRO) return '/parceiro/dashboard';
  if (level === LEVELS.CLIENTE) return '/portal/tickets';
  return '/modulos/dashboard';
}
