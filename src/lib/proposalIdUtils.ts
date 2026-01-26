/**
 * Proposal ID Utilities
 * 
 * CRITICAL: The API only accepts numeric IDs (integers).
 * Display prefixes like "PROP-" or "OPEN-" are for UI only.
 * 
 * This module provides utilities to:
 * - Extract numeric ID from any format
 * - Generate display IDs for UI
 * - Validate IDs before API calls
 */

/**
 * Extract numeric ID from various formats
 * Handles: 49, "49", "PROP-49", "OPEN-123ABC", etc.
 * 
 * @returns number or null if extraction fails
 */
export function extractNumericId(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  // Already a number
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  
  const str = String(value).trim();
  
  // Empty string
  if (!str) {
    return null;
  }
  
  // Pure numeric string
  if (/^\d+$/.test(str)) {
    return Number(str);
  }
  
  // Extract number from prefixed format (PROP-49, OPEN-123, etc.)
  const match = str.match(/\d+/);
  if (match) {
    return Number(match[0]);
  }
  
  return null;
}

/**
 * Get API-safe ID (always numeric string)
 * @throws Error if ID cannot be extracted
 */
export function toApiId(value: string | number | null | undefined): string {
  const numericId = extractNumericId(value);
  if (numericId === null) {
    throw new Error(`Invalid proposal ID: ${value}`);
  }
  return String(numericId);
}

/**
 * Check if a string has a display prefix (PROP-, OPEN-, etc.)
 */
export function hasDisplayPrefix(value: string): boolean {
  return /^(PROP|OPEN)-/i.test(value);
}

/**
 * Generate display ID for UI (e.g., "PROP-49")
 * Only use for display, never for API calls
 */
export function toDisplayId(numericId: number | string): string {
  const id = extractNumericId(numericId);
  return id !== null ? `PROP-${id}` : String(numericId);
}

/**
 * Validate and sanitize ID before API call
 * Returns numeric string or null
 */
export function sanitizeProposalId(value: string | number | null | undefined): string | null {
  const numericId = extractNumericId(value);
  return numericId !== null ? String(numericId) : null;
}
