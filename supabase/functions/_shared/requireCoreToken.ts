/**
 * MVP CORE JWT validation helper
 * 
 * MVP MODE: Auth is OPTIONAL to allow development without CORE login.
 * When AUTH_REQUIRED env is set to "true", auth becomes mandatory.
 * 
 * Validates token WITHOUT signature verification:
 * - Token exists in Authorization header
 * - Token has 3 parts (header.payload.signature)
 * - Payload has exp claim that's not expired (if present)
 * - Payload has sub or user_id claim
 */

export interface CoreTokenPayload {
  sub?: string | number;
  user_id?: string | number;
  exp?: number;
  email?: string;
  name?: string;
  level?: number;
  [key: string]: unknown;
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: CoreTokenPayload;
  error?: string;
}

// Default payload for anonymous access (MVP only)
const ANONYMOUS_PAYLOAD: CoreTokenPayload = {
  sub: "anonymous",
  user_id: 0,
  email: "anonymous@mvp.local",
  name: "Anonymous (MVP)",
  level: 0,
};

/**
 * Check if auth is required (default: false for MVP)
 */
function isAuthRequired(): boolean {
  const envValue = Deno.env.get("AUTH_REQUIRED");
  return envValue === "true" || envValue === "1";
}

/**
 * Decode base64url to string
 */
function base64UrlDecode(str: string): string {
  // Replace base64url characters with base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  
  // Add padding if needed
  const pad = base64.length % 4;
  if (pad) {
    base64 += '='.repeat(4 - pad);
  }
  
  // Decode
  return atob(base64);
}

/**
 * Validate CORE JWT token (MVP - no signature verification)
 */
export function validateCoreToken(authHeader: string | null): TokenValidationResult {
  // Check header exists
  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  // Check Bearer format
  if (!authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Invalid Authorization format (expected Bearer)" };
  }

  const token = authHeader.substring(7).trim(); // Remove "Bearer " and trim

  // Check token is not empty or "null"/"undefined"
  if (!token || token === "null" || token === "undefined") {
    return { valid: false, error: "Token is empty or null" };
  }

  // Check token has 3 parts
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: `Invalid token format (expected 3 parts, got ${parts.length})` };
  }

  try {
    // Decode payload (second part)
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as CoreTokenPayload;

    // Check expiration if present
    if (payload.exp !== undefined) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp < nowSeconds) {
        return { valid: false, error: "Token expired" };
      }
    }

    // Check subject identifier
    if (payload.sub === undefined && payload.user_id === undefined) {
      return { valid: false, error: "Token missing sub or user_id claim" };
    }

    // Valid!
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: `Failed to decode token: ${err}` };
  }
}

/**
 * Middleware-style function that validates token and returns error response if invalid.
 * 
 * MVP MODE: If AUTH_REQUIRED is not set to "true", allows anonymous access with a warning.
 * Returns the payload if valid, or an error response if auth is required but invalid.
 */
export function requireCoreToken(req: Request): { payload: CoreTokenPayload } | { error: Response } {
  const authHeader = req.headers.get("authorization");
  const result = validateCoreToken(authHeader);

  if (!result.valid) {
    // Check if auth is required
    if (isAuthRequired()) {
      console.error("[requireCoreToken] Auth REQUIRED but validation failed:", result.error);
      return {
        error: new Response(
          JSON.stringify({ success: false, error: result.error }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        ),
      };
    }

    // MVP MODE: Allow anonymous access with warning
    console.warn("[requireCoreToken] MVP MODE: Auth skipped.", result.error, "Using anonymous payload.");
    return { payload: ANONYMOUS_PAYLOAD };
  }

  console.log("[requireCoreToken] Token valid, payload:", {
    sub: result.payload?.sub,
    user_id: result.payload?.user_id,
    email: result.payload?.email,
  });

  return { payload: result.payload! };
}
