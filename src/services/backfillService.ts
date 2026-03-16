// ============================================================================
// BACKFILL SERVICE — Admin tool to import legacy users into Supabase Auth
// Called from Admin panel or CLI
// ============================================================================

import { supabase } from '@/integrations/supabase/client';
import { openApi } from '@/lib/openApi';

export interface BackfillReport {
  total: number;
  created: number;
  skipped: number;
  errors: { email: string; reason: string }[];
  dry_run: boolean;
}

/**
 * Fetch internal users from legacy API and send to backfill edge function.
 * Requires ADMIN_PIN and a valid legacy auth token.
 */
export async function runBackfill(opts: {
  pin: string;
  dryRun?: boolean;
  levelMin?: number;
}): Promise<BackfillReport> {
  const { pin, dryRun = true, levelMin = 600 } = opts;

  // 1. Fetch users from legacy API
  console.log('[backfill] Fetching users from legacy API...');
  const response = await openApi.getUsers({ __perPage: 500 });

  // Filter internal only
  const internal = response.data.filter((u) => u.level >= levelMin);
  console.log(`[backfill] Found ${internal.length} internal users (level >= ${levelMin})`);

  // 2. Map to backfill payload
  const usersPayload = internal.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    level: u.level,
    entity_id: u.entity_id || null,
    company_id: null, // Legacy API doesn't expose company_id directly
  }));

  // 3. Call edge function
  const { data, error } = await supabase.functions.invoke('user-backfill', {
    body: {
      pin,
      users: usersPayload,
      dry_run: dryRun,
    },
  });

  if (error) {
    throw new Error(`Backfill failed: ${error.message}`);
  }

  return data.result as BackfillReport;
}
