// ============================================================================
// RBAC HELPERS — Centralized permission checks based on profile.level
// Source of truth: public.profiles.level
// ============================================================================

import type { UserProfile } from '@/contexts/AuthContext';

// Re-export levels for convenience
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
// ROLE CHECKS
// ============================================================================

/** User level >= 1000 */
export function isAdmin(profile: UserProfile | null): boolean {
  return (profile?.level ?? 0) >= LEVELS.ADMIN;
}

/** User level >= 950 */
export function isSupportManager(profile: UserProfile | null): boolean {
  return (profile?.level ?? 0) >= LEVELS.GERENTE_SUPORTE;
}

/** User level === 900 */
export function isSupport(profile: UserProfile | null): boolean {
  return profile?.level === LEVELS.SUPORTE;
}

/** User level === 775 */
export function isCS(profile: UserProfile | null): boolean {
  return profile?.level === LEVELS.SUCESSO_CLIENTE;
}

/** User level === 700 */
export function isComercial(profile: UserProfile | null): boolean {
  return profile?.level === LEVELS.COMERCIAL;
}

/** User level >= 750 (gerente comercial or above) */
export function isGerenteComercial(profile: UserProfile | null): boolean {
  return (profile?.level ?? 0) >= LEVELS.GERENTE_COMERCIAL;
}

/** User level >= 600 (any internal user) */
export function isInternal(profile: UserProfile | null): boolean {
  return (profile?.level ?? 0) >= LEVELS.RH;
}

/** User level === 200 */
export function isPartner(profile: UserProfile | null): boolean {
  return profile?.level === LEVELS.PARCEIRO;
}

/** User level === 1 */
export function isClient(profile: UserProfile | null): boolean {
  return profile?.level === LEVELS.CLIENTE;
}

// ============================================================================
// GENERIC CHECKS
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
