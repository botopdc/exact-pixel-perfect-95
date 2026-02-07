/**
 * CORE Token Validation via Backend Introspection
 * 
 * The CORE system uses OPAQUE tokens (not JWT).
 * We validate by calling the Laravel backend's /auth/me endpoint.
 * If it returns 200, the token is valid.
 */

// Default CORE API URL (can be overridden via env)
const DEFAULT_CORE_API_URL = "https://apiv2.opendata.center/api";

export interface CoreUser {
  id: number;
  uuid?: string;
  email: string;
  name: string;
  level: number;
  [key: string]: unknown;
}

export interface AuthResult {
  valid: boolean;
  user?: CoreUser;
  error?: string;
}

/**
 * Get the CORE API base URL from environment
 */
function getCoreApiUrl(): string {
  return Deno.env.get("CORE_API_BASE_URL") || DEFAULT_CORE_API_URL;
}

/**
 * Validate CORE token by calling the backend /auth/me endpoint
 */
async function validateTokenWithBackend(token: string): Promise<AuthResult> {
  const apiUrl = getCoreApiUrl();
  const meUrl = `${apiUrl}/auth/me`;

  console.log("[requireCoreAuth] Validating token with backend:", meUrl);

  try {
    const response = await fetch(meUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.error("[requireCoreAuth] Backend returned non-200:", response.status);
      return { 
        valid: false, 
        error: response.status === 401 ? "Token inválido ou expirado" : `Backend error: ${response.status}` 
      };
    }

    const user = await response.json() as CoreUser;
    
    console.log("[requireCoreAuth] Token valid, user:", {
      id: user.id,
      email: user.email,
      level: user.level,
    });

    return { valid: true, user };
  } catch (err) {
    console.error("[requireCoreAuth] Error calling backend:", err);
    return { valid: false, error: `Failed to validate token: ${err}` };
  }
}

/**
 * Middleware-style function that validates CORE token via backend introspection.
 * Returns the user if valid, or an error Response if invalid.
 */
export async function requireCoreAuth(req: Request): Promise<{ user: CoreUser } | { error: Response }> {
  const authHeader = req.headers.get("authorization");

  // Check header exists
  if (!authHeader) {
    console.error("[requireCoreAuth] Missing Authorization header");
    return {
      error: new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  // Check Bearer format
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    console.error("[requireCoreAuth] Invalid Authorization format");
    return {
      error: new Response(
        JSON.stringify({ success: false, error: "Invalid Authorization format (expected Bearer)" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  // Extract token (everything after "Bearer ")
  const token = authHeader.substring(7).trim();

  if (!token) {
    console.error("[requireCoreAuth] Empty token");
    return {
      error: new Response(
        JSON.stringify({ success: false, error: "Empty token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  // Validate with backend
  const result = await validateTokenWithBackend(token);

  if (!result.valid || !result.user) {
    return {
      error: new Response(
        JSON.stringify({ success: false, error: result.error || "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  return { user: result.user };
}
