/**
 * Commission Override Service
 * 
 * Gerencia overrides de comissão por usuário armazenados no Lovable Cloud.
 * O campo commission_pct_override sobrescreve a regra padrão baseada em duração.
 * 
 * Nota: Usa raw queries porque a tabela foi criada recentemente e os tipos
 * do Supabase podem não estar sincronizados ainda.
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================
// TYPES
// ============================================

export interface CommissionOverride {
  id: string;
  external_user_id: number;
  commission_pct_override: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  created_by_email: string | null;
}

export interface UpsertCommissionOverrideParams {
  external_user_id: number;
  commission_pct_override: number | null;
  notes?: string | null;
  created_by_name?: string | null;
  created_by_email?: string | null;
}

// ============================================
// FETCH OPERATIONS (using rpc for type safety)
// ============================================

/**
 * Busca o override de comissão para um usuário específico
 */
export async function getCommissionOverride(externalUserId: number): Promise<CommissionOverride | null> {
  try {
    // Use raw fetch approach since types may not be synced
    const { data, error } = await (supabase as any)
      .from('user_commission_overrides')
      .select('*')
      .eq('external_user_id', externalUserId)
      .maybeSingle();

    if (error) {
      console.error('[CommissionOverride] Error fetching override:', error);
      return null;
    }

    return data as CommissionOverride | null;
  } catch (err) {
    console.error('[CommissionOverride] Exception:', err);
    return null;
  }
}

/**
 * Busca overrides de comissão para múltiplos usuários
 */
export async function getCommissionOverrides(externalUserIds: number[]): Promise<Map<number, CommissionOverride>> {
  const map = new Map<number, CommissionOverride>();
  
  if (externalUserIds.length === 0) {
    return map;
  }

  try {
    const { data, error } = await (supabase as any)
      .from('user_commission_overrides')
      .select('*')
      .in('external_user_id', externalUserIds);

    if (error) {
      console.error('[CommissionOverride] Error fetching overrides:', error);
      return map;
    }

    const overrides = (data || []) as CommissionOverride[];
    overrides.forEach((override) => {
      map.set(override.external_user_id, override);
    });

    return map;
  } catch (err) {
    console.error('[CommissionOverride] Exception:', err);
    return map;
  }
}

/**
 * Busca todos os overrides de comissão (para listagem admin)
 */
export async function getAllCommissionOverrides(): Promise<CommissionOverride[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('user_commission_overrides')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[CommissionOverride] Error fetching all overrides:', error);
      return [];
    }

    return (data || []) as CommissionOverride[];
  } catch (err) {
    console.error('[CommissionOverride] Exception:', err);
    return [];
  }
}

// ============================================
// UPSERT / DELETE OPERATIONS
// ============================================

/**
 * Cria ou atualiza um override de comissão
 */
export async function upsertCommissionOverride(params: UpsertCommissionOverrideParams): Promise<{ success: boolean; error?: string }> {
  const { external_user_id, commission_pct_override, notes, created_by_name, created_by_email } = params;

  // Se commission_pct_override é null, remove o registro
  if (commission_pct_override === null) {
    return deleteCommissionOverride(external_user_id);
  }

  // Valida o percentual (0-100% em decimal = 0-1)
  if (commission_pct_override < 0 || commission_pct_override > 1) {
    return { success: false, error: 'Percentual deve estar entre 0% e 100%' };
  }

  try {
    const { error } = await (supabase as any)
      .from('user_commission_overrides')
      .upsert(
        {
          external_user_id,
          commission_pct_override,
          notes: notes || null,
          created_by_name: created_by_name || null,
          created_by_email: created_by_email || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'external_user_id' }
      );

    if (error) {
      console.error('[CommissionOverride] Error upserting override:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[CommissionOverride] Exception:', err);
    return { success: false, error: err?.message || 'Erro desconhecido' };
  }
}

/**
 * Remove um override de comissão (volta à regra padrão)
 */
export async function deleteCommissionOverride(externalUserId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await (supabase as any)
      .from('user_commission_overrides')
      .delete()
      .eq('external_user_id', externalUserId);

    if (error) {
      console.error('[CommissionOverride] Error deleting override:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[CommissionOverride] Exception:', err);
    return { success: false, error: err?.message || 'Erro desconhecido' };
  }
}
