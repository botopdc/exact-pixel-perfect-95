/// <reference path="../_shared/deno.d.ts" />

import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-admin-pin, content-type",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    },
  });
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function assertPin(req: Request) {
  const pin = req.headers.get("x-admin-pin");
  const expected = Deno.env.get("ADMIN_PIN");
  if (!expected) throw new Error("Missing ADMIN_PIN secret");
  if (!pin || pin !== expected) {
    // 403 (Forbidden)
    throw Object.assign(new Error("Invalid admin PIN"), { status: 403 });
  }
}

/**
 * Validação do token externo:
 * - Se EXTERNAL_AUTH_URL existir: chama `${EXTERNAL_AUTH_URL}/validate` (VOCÊ define no seu ambiente)
 * - Se não existir: fallback MVP (token length) e deixa TODO
 */
async function validateExternalToken(token: string): Promise<boolean> {
  const externalAuthUrl = Deno.env.get("EXTERNAL_AUTH_URL");
  if (externalAuthUrl) {
    const resp = await fetch(`${externalAuthUrl.replace(/\/$/, "")}/validate`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    return resp.ok;
  }
  // MVP fallback (não é segurança real; só evita token vazio)
  // TODO: substituir por validação real (endpoint da sua base de usuários / JWT verify)
  return token.length >= 20;
}

function getQueryParam(url: string, key: string) {
  const u = new URL(url);
  return u.searchParams.get(key);
}

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method === "OPTIONS") return json({ ok: true }, 200);

    const token = getBearerToken(req);
    if (!token) return json({ error: "Missing Authorization Bearer token" }, 401);

    const ok = await validateExternalToken(token);
    if (!ok) return json({ error: "Invalid token" }, 401);

    assertPin(req);

    const supabase = getSupabaseAdmin();
    const id = getQueryParam(req.url, "id");

    // GET
    if (req.method === "GET") {
      if (id) {
        const { data, error } = await supabase
          .from("calculator_configs")
          .select("*")
          .eq("id", Number(id))
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);
        return json(data ?? null, 200);
      }
      const { data, error } = await supabase
        .from("calculator_configs")
        .select("*")
        .is("deleted_at", null)
        .order("category", { ascending: true })
        .order("section", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json(data ?? [], 200);
    }

    // POST (upsert by category, section)
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: "Invalid JSON body" }, 400);

      const { category, section, config } = body;
      if (!category || !section || config === undefined) {
        return json({ error: "Missing category/section/config" }, 400);
      }

      const { data, error } = await supabase
        .from("calculator_configs")
        .upsert(
          { category, section, config, deleted_at: null },
          { onConflict: "category,section" }
        )
        .select("*")
        .single();

      if (error) return json({ error: error.message }, 500);
      return json(data, 200);
    }

    // PUT (update by id)
    if (req.method === "PUT") {
      if (!id) return json({ error: "Missing id query param" }, 400);

      const body = await req.json().catch(() => null);
      if (!body) return json({ error: "Invalid JSON body" }, 400);

      const patch: Record<string, unknown> = {};
      if (body.category !== undefined) patch.category = body.category;
      if (body.section !== undefined) patch.section = body.section;
      if (body.config !== undefined) patch.config = body.config;

      const { data, error } = await supabase
        .from("calculator_configs")
        .update(patch)
        .eq("id", Number(id))
        .select("*")
        .single();

      if (error) return json({ error: error.message }, 500);
      return json(data, 200);
    }

    // DELETE (soft delete)
    if (req.method === "DELETE") {
      if (!id) return json({ error: "Missing id query param" }, 400);

      const { data, error } = await supabase
        .from("calculator_configs")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", Number(id))
        .select("*")
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, deleted: data }, 200);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err: any) {
    const status = err?.status ?? 500;
    return json({ error: err?.message ?? "Unknown error" }, status);
  }
}
