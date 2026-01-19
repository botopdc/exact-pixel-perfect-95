// ============================================================================
// ACADEMY AUTH SERVICE - Authentication for OPEN Academy users
// ============================================================================

import { openApi, ApiUser } from '@/lib/openApi';
import { supabase } from '@/integrations/supabase/client';
import type { AcademyEnrollment, AcademyLevel } from '@/types/academy';
import { ACADEMY_LEVELS } from '@/types/academy';

const ACADEMY_SESSION_KEY = 'open_academy_session_v1';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

export interface AcademySession {
  userId: string;
  email: string;
  name: string;
  level: AcademyLevel;
  token: string;
  expiresAt: string;
  enrollment: AcademyEnrollment | null;
}

export interface AcademyAuthResult {
  success: boolean;
  session?: AcademySession;
  error?: string;
  pendingApproval?: boolean;
}

export interface AcademySignupData {
  full_name: string;
  email: string;
  password: string;
  academy_level: AcademyLevel;
  institution_name?: string;
  institution_type?: string;
  course_area?: string;
  proof_url?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isAcademyLevel(level: number): level is AcademyLevel {
  return level === ACADEMY_LEVELS.ALUNO || 
         level === ACADEMY_LEVELS.PROFESSOR || 
         level === ACADEMY_LEVELS.INSTITUICAO;
}

function isSessionExpired(session: AcademySession): boolean {
  return new Date(session.expiresAt) <= new Date();
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============================================================================
// ACADEMY AUTH SERVICE
// ============================================================================

export const academyAuthService = {
  // ============================================================================
  // SIGNUP - Create user + enrollment with pending status
  // ============================================================================
  async signup(data: AcademySignupData): Promise<AcademyAuthResult> {
    try {
      // Validate
      if (!data.email || !data.password || !data.full_name) {
        return { success: false, error: 'Nome, email e senha são obrigatórios' };
      }

      const normalizedEmail = data.email.toLowerCase().trim();

      // 1. Create user via API with academy level
      try {
        await openApi.createUser({
          name: data.full_name,
          email: normalizedEmail,
          password: data.password,
          password_confirmation: data.password,
          level: data.academy_level,
        });
      } catch (apiError: unknown) {
        const axiosError = apiError as { response?: { status?: number; data?: { message?: string } } };
        if (axiosError.response?.status === 422) {
          return { success: false, error: 'Este email já está cadastrado.' };
        }
        throw apiError;
      }

      // 2. Login to get user ID
      const loginResponse = await openApi.login(normalizedEmail, data.password);
      const userId = loginResponse.user.uuid || loginResponse.user.id.toString();

      // 3. Create academy enrollment with pending status
      const today = new Date();
      const validUntil = addDays(today, 90);

      const { error: enrollmentError } = await supabase
        .from('academy_enrollments')
        .insert({
          user_id: userId,
          academy_level: data.academy_level,
          full_name: data.full_name,
          email: normalizedEmail,
          institution_name: data.institution_name || null,
          institution_type: data.institution_type || null,
          course_area: data.course_area || null,
          proof_url: data.proof_url || null,
          status: 'pending',
          discount_pct: 50,
          valid_from: formatDate(today),
          valid_until: formatDate(validUntil),
        });

      if (enrollmentError) {
        console.error('[AcademyAuth] Enrollment error:', enrollmentError);
        // Enrollment failed but user was created
        // Still return success but note the issue
      }

      // Clear token - user shouldn't be logged in until approved
      openApi.clearToken();

      return { 
        success: true, 
        pendingApproval: true,
      };
    } catch (error) {
      console.error('[AcademyAuth] Signup error:', error);
      return { success: false, error: 'Erro ao criar conta. Tente novamente.' };
    }
  },

  // ============================================================================
  // LOGIN - Check enrollment status before allowing access
  // ============================================================================
  async login(email: string, password: string): Promise<AcademyAuthResult> {
    try {
      if (!email || !password) {
        return { success: false, error: 'Email e senha são obrigatórios' };
      }

      const normalizedEmail = email.toLowerCase().trim();

      // 1. Authenticate via API
      const response = await openApi.login(normalizedEmail, password);
      const user = response.user;

      // 2. Check if user is academy level
      if (!isAcademyLevel(user.level)) {
        openApi.clearToken();
        return { 
          success: false, 
          error: 'Esta área é exclusiva para alunos da OPEN Academy. Use o login principal.' 
        };
      }

      // 3. Fetch enrollment from Supabase
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('academy_enrollments')
        .select('*')
        .eq('email', normalizedEmail)
        .single();

      if (enrollmentError || !enrollment) {
        openApi.clearToken();
        return { 
          success: false, 
          error: 'Cadastro não encontrado. Faça sua inscrição na OPEN Academy.' 
        };
      }

      // 4. Check enrollment status
      const enrollmentTyped = enrollment as AcademyEnrollment;

      if (enrollmentTyped.status === 'pending') {
        openApi.clearToken();
        return { 
          success: false, 
          error: 'Seu cadastro ainda está pendente de aprovação. Aguarde o contato da equipe OPEN Academy.',
          pendingApproval: true,
        };
      }

      if (enrollmentTyped.status === 'rejected') {
        openApi.clearToken();
        return { 
          success: false, 
          error: 'Sua inscrição foi rejeitada. Entre em contato com a equipe OPEN Academy para mais informações.' 
        };
      }

      if (enrollmentTyped.status === 'suspended') {
        openApi.clearToken();
        return { 
          success: false, 
          error: 'Seu acesso está suspenso. Entre em contato com a equipe OPEN Academy.' 
        };
      }

      if (enrollmentTyped.status === 'expired') {
        openApi.clearToken();
        return { 
          success: false, 
          error: 'Seu benefício acadêmico expirou. Entre em contato para renovação.' 
        };
      }

      // 5. Status is active - create session
      const session: AcademySession = {
        userId: user.uuid || user.id.toString(),
        email: user.email,
        name: user.name,
        level: user.level as AcademyLevel,
        token: response.token,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
        enrollment: enrollmentTyped,
      };

      localStorage.setItem(ACADEMY_SESSION_KEY, JSON.stringify(session));

      return { success: true, session };
    } catch (error: unknown) {
      console.error('[AcademyAuth] Login error:', error);

      const axiosError = error as { response?: { status?: number; data?: { message?: string } } };
      if (axiosError.response?.status === 401) {
        return { success: false, error: 'Email ou senha incorretos' };
      }

      return { success: false, error: 'Erro ao fazer login. Verifique sua conexão.' };
    }
  },

  // ============================================================================
  // LOGOUT
  // ============================================================================
  logout(): void {
    localStorage.removeItem(ACADEMY_SESSION_KEY);
    openApi.clearToken();
  },

  // ============================================================================
  // GET SESSION
  // ============================================================================
  getSession(): AcademySession | null {
    try {
      const sessionStr = localStorage.getItem(ACADEMY_SESSION_KEY);
      if (!sessionStr) return null;

      const session: AcademySession = JSON.parse(sessionStr);
      
      if (isSessionExpired(session)) {
        this.logout();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  },

  // ============================================================================
  // IS AUTHENTICATED
  // ============================================================================
  isAuthenticated(): boolean {
    return this.getSession() !== null;
  },

  // ============================================================================
  // REQUEST PASSWORD RESET
  // ============================================================================
  async requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!email) {
        return { success: false, error: 'Email é obrigatório' };
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Call API password reset - always return success for security
      // This prevents exposing whether an email exists in the system
      try {
        await openApi.requestPasswordReset(normalizedEmail);
      } catch {
        // Silently ignore - we don't want to expose if email exists
      }

      // Always return success for security reasons
      return { success: true };
    } catch (error) {
      console.error('[AcademyAuth] Password reset error:', error);
      // Still return success for security
      return { success: true };
    }
  },
};
