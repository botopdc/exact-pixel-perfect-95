// ============================================================================
// ACADEMY SERVICE - Service for OPEN Academy enrollment management
// ============================================================================

import { supabase } from '@/integrations/supabase/client';
import type {
  AcademyEnrollment,
  AcademyEnrollmentInsert,
  AcademyEnrollmentUpdate,
  AcademyKPIs,
  AcademyEnrollmentStatus,
  AcademyLevel,
} from '@/types/academy';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============================================================================
// FETCH ENROLLMENTS
// ============================================================================

export interface EnrollmentFilters {
  status?: AcademyEnrollmentStatus;
  academy_level?: AcademyLevel;
  search?: string;
  expiring_days?: number;
  institution?: string;
}

export async function fetchEnrollments(filters?: EnrollmentFilters): Promise<AcademyEnrollment[]> {
  let query = supabase
    .from('academy_enrollments')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.academy_level) {
    query = query.eq('academy_level', filters.academy_level);
  }

  if (filters?.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }

  if (filters?.institution) {
    query = query.ilike('institution_name', `%${filters.institution}%`);
  }

  if (filters?.expiring_days) {
    const today = new Date();
    const futureDate = addDays(today, filters.expiring_days);
    query = query
      .eq('status', 'active')
      .gte('valid_until', formatDate(today))
      .lte('valid_until', formatDate(futureDate));
  }

  const { data, error } = await query;

  if (error) {
    console.error('[AcademyService] Error fetching enrollments:', error);
    throw error;
  }

  return (data || []) as AcademyEnrollment[];
}

// ============================================================================
// FETCH SINGLE ENROLLMENT
// ============================================================================

export async function fetchEnrollment(id: string): Promise<AcademyEnrollment | null> {
  const { data, error } = await supabase
    .from('academy_enrollments')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[AcademyService] Error fetching enrollment:', error);
    throw error;
  }

  return data as AcademyEnrollment;
}

// ============================================================================
// FETCH KPIs
// ============================================================================

export async function fetchAcademyKPIs(): Promise<AcademyKPIs> {
  const today = new Date();
  const in30Days = addDays(today, 30);

  const { data: allEnrollments, error } = await supabase
    .from('academy_enrollments')
    .select('status, valid_until');

  if (error) {
    console.error('[AcademyService] Error fetching KPIs:', error);
    throw error;
  }

  const enrollments = allEnrollments || [];

  const kpis: AcademyKPIs = {
    pending: 0,
    active: 0,
    expiring_30_days: 0,
    expired: 0,
    suspended: 0,
  };

  for (const enrollment of enrollments) {
    switch (enrollment.status) {
      case 'pending':
        kpis.pending++;
        break;
      case 'active':
        kpis.active++;
        // Check if expiring within 30 days
        if (enrollment.valid_until) {
          const validUntil = new Date(enrollment.valid_until);
          if (validUntil >= today && validUntil <= in30Days) {
            kpis.expiring_30_days++;
          }
        }
        break;
      case 'expired':
        kpis.expired++;
        break;
      case 'suspended':
        kpis.suspended++;
        break;
    }
  }

  return kpis;
}

// ============================================================================
// CREATE ENROLLMENT
// ============================================================================

export async function createEnrollment(data: AcademyEnrollmentInsert): Promise<AcademyEnrollment> {
  const { data: enrollment, error } = await supabase
    .from('academy_enrollments')
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error('[AcademyService] Error creating enrollment:', error);
    throw error;
  }

  return enrollment as AcademyEnrollment;
}

// ============================================================================
// UPDATE ENROLLMENT
// ============================================================================

export async function updateEnrollment(
  id: string,
  data: AcademyEnrollmentUpdate
): Promise<AcademyEnrollment> {
  const { data: enrollment, error } = await supabase
    .from('academy_enrollments')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[AcademyService] Error updating enrollment:', error);
    throw error;
  }

  return enrollment as AcademyEnrollment;
}

// ============================================================================
// APPROVE ENROLLMENT
// ============================================================================

export async function approveEnrollment(
  id: string,
  approvedBy: string,
  discountPct?: number,
  validUntil?: string
): Promise<AcademyEnrollment> {
  const now = new Date().toISOString();
  
  const updateData: AcademyEnrollmentUpdate = {
    status: 'active',
    approved_by: approvedBy,
    approved_at: now,
  };

  if (discountPct !== undefined) {
    updateData.discount_pct = discountPct;
  }

  if (validUntil) {
    updateData.valid_until = validUntil;
  }

  // Add audit note
  const { data: current } = await supabase
    .from('academy_enrollments')
    .select('notes')
    .eq('id', id)
    .single();

  const timestamp = new Date().toLocaleString('pt-BR');
  const newNote = `[${timestamp}] APROVADO por ${approvedBy}`;
  updateData.notes = current?.notes ? `${current.notes}\n${newNote}` : newNote;

  return updateEnrollment(id, updateData);
}

// ============================================================================
// REJECT ENROLLMENT
// ============================================================================

export async function rejectEnrollment(
  id: string,
  rejectedBy: string,
  reason?: string
): Promise<AcademyEnrollment> {
  const { data: current } = await supabase
    .from('academy_enrollments')
    .select('notes')
    .eq('id', id)
    .single();

  const timestamp = new Date().toLocaleString('pt-BR');
  const newNote = `[${timestamp}] REJEITADO por ${rejectedBy}${reason ? ` - Motivo: ${reason}` : ''}`;
  const notes = current?.notes ? `${current.notes}\n${newNote}` : newNote;

  return updateEnrollment(id, { status: 'rejected', notes });
}

// ============================================================================
// SUSPEND ENROLLMENT
// ============================================================================

export async function suspendEnrollment(
  id: string,
  suspendedBy: string,
  reason?: string
): Promise<AcademyEnrollment> {
  const { data: current } = await supabase
    .from('academy_enrollments')
    .select('notes')
    .eq('id', id)
    .single();

  const timestamp = new Date().toLocaleString('pt-BR');
  const newNote = `[${timestamp}] SUSPENSO por ${suspendedBy}${reason ? ` - Motivo: ${reason}` : ''}`;
  const notes = current?.notes ? `${current.notes}\n${newNote}` : newNote;

  return updateEnrollment(id, { status: 'suspended', notes });
}

// ============================================================================
// RENEW ENROLLMENT
// ============================================================================

export async function renewEnrollment(
  id: string,
  renewedBy: string,
  newValidUntil: string,
  newDiscountPct?: number
): Promise<AcademyEnrollment> {
  const now = new Date().toISOString();

  const { data: current } = await supabase
    .from('academy_enrollments')
    .select('notes, status')
    .eq('id', id)
    .single();

  const timestamp = new Date().toLocaleString('pt-BR');
  const newNote = `[${timestamp}] RENOVADO por ${renewedBy} até ${newValidUntil}${newDiscountPct ? ` com ${newDiscountPct}% desconto` : ''}`;
  const notes = current?.notes ? `${current.notes}\n${newNote}` : newNote;

  const updateData: AcademyEnrollmentUpdate = {
    valid_until: newValidUntil,
    last_renewed_at: now,
    notes,
  };

  // If was expired or suspended, reactivate
  if (current?.status === 'expired' || current?.status === 'suspended') {
    updateData.status = 'active';
  }

  if (newDiscountPct !== undefined) {
    updateData.discount_pct = newDiscountPct;
  }

  return updateEnrollment(id, updateData);
}

// ============================================================================
// DELETE ENROLLMENT
// ============================================================================

export async function deleteEnrollment(id: string): Promise<void> {
  const { error } = await supabase
    .from('academy_enrollments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[AcademyService] Error deleting enrollment:', error);
    throw error;
  }
}

// ============================================================================
// CHECK AND UPDATE EXPIRED ENROLLMENTS
// ============================================================================

export async function updateExpiredEnrollments(): Promise<number> {
  const today = formatDate(new Date());

  const { data, error } = await supabase
    .from('academy_enrollments')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lt('valid_until', today)
    .select();

  if (error) {
    console.error('[AcademyService] Error updating expired enrollments:', error);
    throw error;
  }

  return data?.length || 0;
}

// ============================================================================
// GET UNIQUE INSTITUTIONS
// ============================================================================

export async function fetchUniqueInstitutions(): Promise<string[]> {
  const { data, error } = await supabase
    .from('academy_enrollments')
    .select('institution_name')
    .not('institution_name', 'is', null);

  if (error) {
    console.error('[AcademyService] Error fetching institutions:', error);
    throw error;
  }

  const institutions = [...new Set(data?.map(d => d.institution_name).filter(Boolean) as string[])];
  return institutions.sort();
}
