import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-open-module",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
};

const API_BASE_URL = "https://apiv2.opendata.center/api";

type Scope = "CLIENTE" | "PARCEIRO";

type MeResponse = {
  id: number;
  uuid: string;
  email: string;
  name: string;
  level: number;
  partner?: {
    id: number;
    name: string;
    status: string;
    type: string;
  } | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function fetchMe(token: string): Promise<MeResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/me?__with=partner`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("[proposal-gateway] /auth/me failed", { status: res.status, data });
    throw new Error("Unauthorized");
  }
  return data as MeResponse;
}

function inferScopeForUser(me: MeResponse, requestedScope: Scope | null, moduleHint: string | null): Scope {
  if (me.level === 200) return "PARCEIRO";

  if (me.level === 1000) {
    if (requestedScope) return requestedScope;
    if (moduleHint === "partner_portal") return "PARCEIRO";
    return "CLIENTE";
  }

  // 700+ (non-admin) defaults to CLIENTE
  return "CLIENTE";
}

function enforceOwnershipOrThrow(me: MeResponse, effectiveScope: Scope) {
  if (me.level === 200) {
    if (effectiveScope !== "PARCEIRO") {
      throw new Error("Invalid ownership for partner proposal");
    }
    if (!me.partner?.id) {
      throw new Error("Invalid ownership for partner proposal");
    }
  }
}

function applyOwnershipToPayload(me: MeResponse, scope: Scope, payload: Record<string, unknown>) {
  const next = { ...payload };

  // Always override channel_type server-side.
  next.channel_type = scope;

  if (scope === "PARCEIRO") {
    // reseller_name is the only stable ownership discriminator available in this API today.
    next.reseller_name = me.partner?.name ?? (next.reseller_name as string | null) ?? null;
  } else {
    // Ensure partner-only fields don't leak into executive proposals
    next.reseller_name = null;
  }

  return next;
}

async function forwardJson(token: string, url: string, method: "GET" | "POST" | "PUT", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return { res, data };
}

// ============================================================================
// RBAC RULES FOR PROPOSAL ACCESS
// ============================================================================
// Level 1000 (Admin): See ALL proposals (no filter)
// Level 750 (Gerente Comercial): See ALL proposals (no filter)
// Level 775 (CS): See only OWN proposals (created_by === user.id)
// Level 700 (Executivo): See only OWN proposals (created_by === user.id)
// Level 200 (Parceiro): See only OWN proposals (created_by === user.id AND channel_type === PARCEIRO)
// Level 1 (Cliente): See only proposals where proposal.email === user.email
// ============================================================================

function canSeeAllProposals(level: number): boolean {
  return level === 1000 || level === 750;
}

function filterProposalsByOwnership(
  proposals: any[],
  me: MeResponse,
  scope: Scope
): any[] {
  const level = me.level;
  
  // Admin (1000) and Gerente Comercial (750) see all
  if (canSeeAllProposals(level)) {
    console.log("[proposal-gateway] RBAC: Admin/Manager sees all proposals");
    return proposals;
  }
  
  // Client (1): Filter by email matching
  if (level === 1) {
    const filtered = proposals.filter((p) => {
      const clientEmail = (p.email || "").toLowerCase();
      const userEmail = me.email.toLowerCase();
      return clientEmail === userEmail;
    });
    console.log("[proposal-gateway] RBAC: Client filter by email", { 
      userEmail: me.email, 
      before: proposals.length, 
      after: filtered.length 
    });
    return filtered;
  }
  
  // Partner (200): Filter by created_by (user ID)
  if (level === 200) {
    const filtered = proposals.filter((p) => {
      // Primary: Check created_by field in dados_proposta
      const createdById = p.dados_proposta?.created_by_user_id;
      if (createdById !== undefined && createdById !== null) {
        return createdById === me.id;
      }
      // Fallback: Check if no creator info (legacy data) - show only if reseller matches partner
      if (me.partner?.name) {
        return p.reseller_name === me.partner.name;
      }
      return false;
    });
    console.log("[proposal-gateway] RBAC: Partner filter by created_by", { 
      userId: me.id, 
      partnerName: me.partner?.name,
      before: proposals.length, 
      after: filtered.length 
    });
    return filtered;
  }
  
  // Executives (700) and CS (775): Filter by created_by (user ID)
  if (level === 700 || level === 775) {
    const filtered = proposals.filter((p) => {
      // Primary: Check created_by field in dados_proposta
      const createdById = p.dados_proposta?.created_by_user_id;
      if (createdById !== undefined && createdById !== null) {
        return createdById === me.id;
      }
      // Fallback for legacy data: check email
      const creatorEmail = (p.dados_proposta?.created_by_email || "").toLowerCase();
      if (creatorEmail) {
        return creatorEmail === me.email.toLowerCase();
      }
      // Legacy without owner info - show to all executives for now
      console.log("[proposal-gateway] Legacy proposal without owner info:", p.id);
      return true;
    });
    console.log("[proposal-gateway] RBAC: Executive/CS filter by created_by", { 
      userId: me.id, 
      userEmail: me.email,
      before: proposals.length, 
      after: filtered.length 
    });
    return filtered;
  }
  
  // Other levels (600, 900, 950): No access to proposals
  console.log("[proposal-gateway] RBAC: Level", level, "has no proposal access");
  return [];
}

// Check if user can access a specific proposal
function canAccessProposal(proposal: any, me: MeResponse): boolean {
  const level = me.level;
  
  // Admin (1000) and Gerente Comercial (750) can access any
  if (canSeeAllProposals(level)) {
    return true;
  }
  
  // Client (1): Must match email
  if (level === 1) {
    const clientEmail = (proposal.email || "").toLowerCase();
    return clientEmail === me.email.toLowerCase();
  }
  
  // Partner (200): Must be the creator
  if (level === 200) {
    const createdById = proposal.dados_proposta?.created_by_user_id;
    if (createdById !== undefined && createdById !== null) {
      return createdById === me.id;
    }
    // Fallback: reseller_name match
    if (me.partner?.name) {
      return proposal.reseller_name === me.partner.name;
    }
    return false;
  }
  
  // Executives (700) and CS (775): Must be the creator
  if (level === 700 || level === 775) {
    const createdById = proposal.dados_proposta?.created_by_user_id;
    if (createdById !== undefined && createdById !== null) {
      return createdById === me.id;
    }
    // Fallback: email match
    const creatorEmail = (proposal.dados_proposta?.created_by_email || "").toLowerCase();
    if (creatorEmail) {
      return creatorEmail === me.email.toLowerCase();
    }
    // Legacy without owner info - allow for now
    return true;
  }
  
  // Other levels: No access
  return false;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = getBearerToken(req);
    if (!token) return json({ success: false, error: "Missing Authorization" }, 401);

    const url = new URL(req.url);
    const pathname = url.pathname;
    const moduleHint = req.headers.get("x-open-module");

    // Paths: /proposal-gateway/proposals, /proposal-gateway/proposal, /proposal-gateway/proposal/:id
    const parts = pathname.split("/proposal-gateway")[1]?.split("/").filter(Boolean) ?? [];

    const me = await fetchMe(token);

    // LIST
    if (req.method === "GET" && parts[0] === "proposals") {
      const requestedScope = (url.searchParams.get("scope") as Scope | null) ?? null;
      const scope = inferScopeForUser(me, requestedScope, moduleHint);
      enforceOwnershipOrThrow(me, scope);

      // Forward query params (pagination/email), but always force channel_type
      const forwardParams = new URLSearchParams(url.searchParams);
      forwardParams.set("channel_type", scope);
      forwardParams.delete("scope");

      const { res, data } = await forwardJson(
        token,
        `${API_BASE_URL}/calculator/proposal?${forwardParams.toString()}`,
        "GET",
      );

      if (!res.ok) {
        console.error("[proposal-gateway] list failed", { status: res.status, data });
        return json({ success: false, error: data?.message ?? "Failed to list proposals" }, res.status);
      }

      const rawList = (data?.data ?? []) as any[];
      
      // First filter by scope (channel_type)
      let filtered = rawList.filter((p) => p?.channel_type === scope);
      
      // Then apply RBAC ownership filter
      filtered = filterProposalsByOwnership(filtered, me, scope);

      const ownership = {
        session_user_id: me.id,
        session_user_email: me.email,
        session_user_level: me.level,
        session_partner_id: me.partner?.id ?? null,
        effective_scope: scope,
        can_see_all: canSeeAllProposals(me.level),
      };

      console.log("[proposal-gateway] LIST", {
        user_level: me.level,
        user_email: me.email,
        partner_id: me.partner?.id ?? null,
        scope,
        can_see_all: canSeeAllProposals(me.level),
        raw: rawList.length,
        filtered: filtered.length,
      });

      return json({ ...data, data: filtered, ownership }, 200);
    }

    // CREATE/UPDATE
    if ((req.method === "POST" || req.method === "PUT") && parts[0] === "proposal") {
      const id = parts[1] ? Number(parts[1]) : null;
      const requestedScope = (url.searchParams.get("scope") as Scope | null) ?? null;
      const scope = inferScopeForUser(me, requestedScope, moduleHint);
      enforceOwnershipOrThrow(me, scope);

      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const payload = applyOwnershipToPayload(me, scope, body);
      
      // Add creator info to dados_proposta for tracking ownership
      if (payload.dados_proposta && typeof payload.dados_proposta === 'object') {
        (payload.dados_proposta as Record<string, unknown>).created_by_user_id = me.id;
        (payload.dados_proposta as Record<string, unknown>).created_by_email = me.email;
        (payload.dados_proposta as Record<string, unknown>).created_by_name = me.name;
        (payload.dados_proposta as Record<string, unknown>).created_by_level = me.level;
      }

      console.log("[proposal-gateway] SAVE", {
        method: req.method,
        id,
        session_user_id: me.id,
        session_user_email: me.email,
        session_user_level: me.level,
        session_partner_id: me.partner?.id ?? null,
        payload_channel_type: payload.channel_type,
        payload_reseller_name: payload.reseller_name,
      });

      const targetUrl = id
        ? `${API_BASE_URL}/calculator/proposal/${id}`
        : `${API_BASE_URL}/calculator/proposal`;

      const { res, data } = await forwardJson(token, targetUrl, req.method as "POST" | "PUT", payload);

      if (!res.ok) {
        console.error("[proposal-gateway] save failed", { status: res.status, data });
        return json({ success: false, error: data?.message ?? "Failed to save proposal" }, res.status);
      }

      const ownership = {
        session_user_id: me.id,
        session_user_email: me.email,
        session_user_level: me.level,
        session_partner_id: me.partner?.id ?? null,
        effective_scope: scope,
        payload_channel_type: payload.channel_type,
        payload_reseller_name: payload.reseller_name,
        created_by_user_id: me.id,
        created_by_email: me.email,
        created_by_name: me.name,
      };

      // Return original API response plus ownership proof
      return json({ success: true, data, ownership }, 200);
    }

    return json({ success: false, error: "Not found" }, 404);
  } catch (err: any) {
    const msg = String(err?.message || err);
    const status = msg.includes("Invalid ownership") ? 400 : 500;
    console.error("[proposal-gateway] error", { msg });
    return json({ success: false, error: msg }, status);
  }
};

serve(handler);
