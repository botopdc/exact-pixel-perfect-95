/// <reference path="../_shared/deno.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

// ============================================================================
// SEED DATA - Default pricing configurations
// Source: tmp/calculator_configs.csv converted to JSON
// ============================================================================

const SEED_CONFIGS = [
  {
    category: "VM",
    section: "Preços de VM",
    config: [
      { label: "vCPU", by: "unit", type: "BRL", value: 45 },
      { label: "RAM", by: "GB", type: "BRL", value: 9 },
      { label: "NVMe", by: "GB", type: "BRL", value: 0.9 },
      { label: "IP Público", by: "unit", type: "BRL", value: 30 }
    ]
  },
  {
    category: "BareMetal",
    section: "Modelos de CPU",
    config: [
      { label: "2x Intel Xeon E5-2680v4 28c/56t 2.4GHz/3.3GHz - Disponível", type: "BRL", value: 700 },
      { label: "2x Intel Xeon Gold 5418Y 2G, 48C/96T DDR5", type: "BRL", value: 3600 },
      { label: "2 x Intel Xeon Gold 6138 40c/80t 2.0GHz/3.7GHz - Disponível", type: "BRL", value: 850 }
    ]
  },
  {
    category: "BareMetal",
    section: "Opções de RAM",
    config: [
      { label: "128GB", type: "BRL", value: 400 },
      { label: "256GB", type: "BRL", value: 800 },
      { label: "384GB", type: "BRL", value: 1200 },
      { label: "512GB", type: "BRL", value: 1500 }
    ]
  },
  {
    category: "BareMetal",
    section: "Opções de Disco",
    config: [
      { label: "1TB NVMe", by: "unit", type: "BRL", value: 150 },
      { label: "2TB NVMe", by: "unit", type: "BRL", value: 300 },
      { label: "4TB NVMe", by: "unit", type: "BRL", value: 580 }
    ]
  },
  {
    category: "GPU",
    section: "Preços de GPU",
    config: [
      { label: "Sem GPU", type: "USD", value: 0 },
      { label: "NVIDIA T4", type: "USD", value: 1090 },
      { label: "NVIDIA A100 40GB", type: "USD", value: 2400 },
      { label: "NVIDIA A100 80GB", type: "USD", value: 3200 },
      { label: "NVIDIA H100 80GB", type: "USD", value: 7600 }
    ]
  },
  {
    category: "Add-ons",
    section: "Add-ons",
    config: [
      { label: "Antivirus", by: "unit", type: "BRL", value: 69.9 },
      { label: "Firewall pfSense", type: "BRL", value: 199.9 },
      { label: "TSplus", by: "unit", type: "BRL", value: 40 },
      { label: "CAL", by: "unit", type: "BRL", value: 55 },
      { label: "Veeam VM", by: "unit", type: "BRL", value: 50 },
      { label: "Veeam Agent", by: "unit", type: "BRL", value: 45 }
    ]
  },
  {
    category: "SQL Server",
    section: "SQL Server",
    config: [
      { label: "Nenhum", type: "BRL", value: 0 },
      { label: "WEB", type: "BRL", value: 200 },
      { label: "WE", type: "BRL", value: 265 },
      { label: "STD", type: "BRL", value: 2240 }
    ]
  },
  {
    category: "Storage",
    section: "Storage SAS",
    config: {
      "Brasil": [
        { label: "1-10 TB", by: "TB", type: "BRL", value: 119 },
        { label: "11-100 TB", by: "TB", type: "BRL", value: 99 },
        { label: "101-500 TB", by: "TB", type: "BRL", value: 75 },
        { label: "501-1024 TB", by: "TB", type: "BRL", value: 55 },
        { label: ">1024 TB", by: "TB", type: "BRL", value: 45 }
      ],
      "Estados Unidos": [
        { label: "1-10 TB", by: "TB", type: "BRL", value: 99 },
        { label: "11-100 TB", by: "TB", type: "BRL", value: 79 },
        { label: "101-500 TB", by: "TB", type: "BRL", value: 55 },
        { label: "501-1024 TB", by: "TB", type: "BRL", value: 45 },
        { label: ">1024 TB", by: "TB", type: "BRL", value: 42 }
      ]
    }
  },
  {
    category: "Storage",
    section: "SSD NVMe",
    config: [
      { label: "Preço por GB", by: "GB", type: "BRL", value: 0.9 }
    ]
  },
  {
    category: "Kubernetes",
    section: "Preços Base dos Planos",
    config: [
      { label: "SMALL", description: "3 nodes + 4 vCPU / 8 GB RAM / 100 GB Disco", type: "BRL", by: "month", value: 3200 },
      { label: "MEDIUM", description: "5 nodes + 6 vCPU / 16 GB RAM / 150 GB Disco", type: "BRL", by: "month", value: 6200 },
      { label: "LARGE", description: "7 nodes + 8 vCPU / 32 GB RAM / 200 GB Disco", type: "BRL", by: "month", value: 11900 }
    ]
  },
  {
    category: "Kubernetes",
    section: "Add-ons Kubernetes",
    config: [
      { label: "Suporte 24x7", type: "BRL", by: "month", value: 1200 },
      { label: "Backup (Velero)", type: "BRL", by: "month", value: 600 },
      { label: "DR multi-site", type: "BRL", by: "month", value: 2500 },
      { label: "Observabilidade avançada", type: "BRL", by: "month", value: 900 },
      { label: "CI/CD gerenciado", type: "BRL", by: "month", value: 1500 },
      { label: "Horas DevOps", type: "BRL", by: "hour", value: 250 }
    ]
  },
  {
    category: "Geral",
    section: "Taxa de Câmbio",
    config: [
      { label: "Cotação Padrão", type: "BRL", value: 5 }
    ]
  },
  {
    category: "Geral",
    section: "Descontos por Vigência",
    config: [
      { label: "1 mês", type: "percentage", value: 0 },
      { label: "12 meses", type: "percentage", value: 5 },
      { label: "36 meses", type: "percentage", value: 12 },
      { label: "48 meses", type: "percentage", value: 15 }
    ]
  },
  {
    category: "Geral",
    section: "OPEN SaaS",
    config: [
      { label: "Preço por Usuário", by: "user", type: "BRL", value: 85 }
    ]
  }
];

// ============================================================================
// HELPERS
// ============================================================================

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
    throw Object.assign(new Error("Invalid admin PIN"), { status: 403 });
  }
}

async function validateExternalToken(token: string): Promise<boolean> {
  // Use shared validation from supabaseAdmin (Supabase JWT first, external fallback)
  const { validateExternalToken: sharedValidate } = await import("../_shared/supabaseAdmin.ts");
  const result = await sharedValidate(token);
  return result.valid;
}

function getQueryParam(url: string, key: string) {
  const u = new URL(url);
  return u.searchParams.get(key);
}

// ============================================================================
// SEED HANDLER
// ============================================================================

interface SeedResult {
  total: number;
  success: number;
  failures: Array<{ category: string; section: string; error: string }>;
}

async function handleSeed(req: Request): Promise<Response> {
  const supabase = getSupabaseAdmin();
  
  // Check if body has custom configs, otherwise use SEED_CONFIGS
  let configsToSeed = SEED_CONFIGS;
  
  try {
    const body = await req.json().catch(() => null);
    if (body && Array.isArray(body) && body.length > 0) {
      configsToSeed = body;
    }
  } catch {
    // Use default SEED_CONFIGS
  }
  
  const result: SeedResult = {
    total: configsToSeed.length,
    success: 0,
    failures: [],
  };
  
  for (const cfg of configsToSeed) {
    const { error } = await supabase
      .from("calculator_configs")
      .upsert(
        { 
          category: cfg.category, 
          section: cfg.section, 
          config: cfg.config, 
          deleted_at: null 
        },
        { onConflict: "category,section" }
      );
    
    if (error) {
      result.failures.push({
        category: cfg.category,
        section: cfg.section,
        error: error.message,
      });
    } else {
      result.success++;
    }
  }
  
  return json({
    message: "Seed completed",
    ...result,
  }, result.failures.length > 0 ? 207 : 200);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

async function handler(req: Request): Promise<Response> {
  try {
    if (req.method === "OPTIONS") return json({ ok: true }, 200);

    // GET is public — no auth or PIN required for reads
    if (req.method === "GET") {
      const supabase = getSupabaseAdmin();
      const id = getQueryParam(req.url, "id");

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

    // All write operations require auth + PIN
    const token = getBearerToken(req);
    if (!token) return json({ error: "Missing Authorization Bearer token" }, 401);

    const ok = await validateExternalToken(token);
    if (!ok) return json({ error: "Invalid token" }, 401);

    assertPin(req);

    // Check for seed operation
    const seed = getQueryParam(req.url, "seed");
    if (seed === "true" && req.method === "POST") {
      return handleSeed(req);
    }

    const supabase = getSupabaseAdmin();
    const id = getQueryParam(req.url, "id");

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
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    const status = error?.status ?? 500;
    return json({ error: error?.message ?? "Unknown error" }, status);
  }
}

serve(handler);
