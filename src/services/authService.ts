// ============================================================================
// AUTH SERVICE - API Implementation
// Integração com API OPDC para autenticação
// ============================================================================

import { openApi, ApiUser, USER_LEVELS } from '@/lib/openApi';
import { logDataSource } from '@/lib/logDataSource';

const AUTH_SESSION_KEY = 'open_auth_session_v1';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 horas

export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  role: 'admin' | 'comercial' | 'suporte' | 'cs' | 'rh' | 'user';
  level: number;
  token: string;
  expiresAt: string;
  apiUser?: ApiUser;
}

export interface AuthResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
}

// Map API level to role
function getLevelRole(level: number): AuthSession['role'] {
  if (level >= USER_LEVELS.ADMIN) return 'admin';
  if (level >= USER_LEVELS.GERENTE_SUPORTE) return 'admin';
  if (level >= USER_LEVELS.SUPORTE) return 'suporte';
  if (level >= USER_LEVELS.SUCESSO_CLIENTE) return 'cs';
  if (level >= USER_LEVELS.COMERCIAL) return 'comercial';
  if (level >= USER_LEVELS.RH) return 'rh';
  return 'user';
}

// Verifica se a sessão está expirada
function isSessionExpired(session: AuthSession): boolean {
  return new Date(session.expiresAt) <= new Date();
}

// ============================================================================
// AUTH SERVICE INTERFACE
// ============================================================================

export const authService = {
  // Login via API
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      // Validação básica
      if (!email || !password) {
        return { success: false, error: 'Email e senha são obrigatórios' };
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Chamar API de login
      logDataSource({ module: 'AuthService', source: 'API', operation: 'READ', endpoint: 'POST /api/auth/login' });
      const response = await openApi.login(normalizedEmail, password);

      // IMPORTANT: Partners (level 200) must use the partner portal login
      if (response.user.level === 200) {
        openApi.clearToken();
        return { success: false, error: 'Área exclusiva para parceiros. Use o login do Portal do Parceiro.' };
      }

      const session: AuthSession = {
        userId: response.user.uuid || response.user.id.toString(),
        email: response.user.email,
        name: response.user.name,
        role: getLevelRole(response.user.level),
        level: response.user.level,
        token: response.token,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
        apiUser: response.user,
      };

      // Salvar sessão
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      logDataSource({ module: 'AuthService', source: 'LocalStorage', operation: 'WRITE', key: AUTH_SESSION_KEY });

      return { success: true, session };
    } catch (error: unknown) {
      console.error('[AuthService] Login error:', error);

      // Handle axios error
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number; data?: { message?: string } } };
        if (axiosError.response?.status === 401) {
          return { success: false, error: 'Email ou senha incorretos' };
        }
        if (axiosError.response?.data?.message) {
          return { success: false, error: axiosError.response.data.message };
        }
      }

      return { success: false, error: 'Erro ao fazer login. Verifique sua conexão.' };
    }
  },

  // Logout - limpa a sessão
  logout(): void {
    localStorage.removeItem(AUTH_SESSION_KEY);
    logDataSource({ module: 'AuthService', source: 'LocalStorage', operation: 'DELETE', key: AUTH_SESSION_KEY });
    openApi.clearToken();
  },

  // Obtém a sessão atual
  getSession(): AuthSession | null {
    try {
      const sessionStr = localStorage.getItem(AUTH_SESSION_KEY);
      logDataSource({ module: 'AuthService', source: 'LocalStorage', operation: 'READ', key: AUTH_SESSION_KEY });
      if (!sessionStr) return null;

      const session: AuthSession = JSON.parse(sessionStr);
      
      // Verificar se expirou
      if (isSessionExpired(session)) {
        this.logout();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  },

  // Verifica se está autenticado
  isAuthenticated(): boolean {
    const session = this.getSession();
    return session !== null;
  },

  // Obtém o usuário atual
  getCurrentUser(): { email: string; role: string; name: string; level: number } | null {
    const session = this.getSession();
    if (!session) return null;
    return { 
      email: session.email, 
      role: session.role,
      name: session.name,
      level: session.level,
    };
  },

  // Verifica se é admin
  isAdmin(): boolean {
    const session = this.getSession();
    return session?.role === 'admin';
  },

  // Verifica o nível de acesso
  hasLevel(requiredLevel: number): boolean {
    const session = this.getSession();
    return (session?.level || 0) >= requiredLevel;
  },

  // Tempo restante da sessão em minutos
  getSessionTimeRemaining(): number {
    const session = this.getSession();
    if (!session) return 0;
    
    const remaining = new Date(session.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(remaining / 60000));
  },

  // Valida sessão com API (refresh)
  async validateSession(): Promise<boolean> {
    try {
      const session = this.getSession();
      if (!session) return false;

      // Verificar com API se token ainda é válido
      const user = await openApi.getCurrentUser();
      
      // Atualizar dados do usuário na sessão
      const updatedSession: AuthSession = {
        ...session,
        name: user.name,
        email: user.email,
        level: user.level,
        role: getLevelRole(user.level),
        apiUser: user,
      };
      
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(updatedSession));
      return true;
    } catch {
      // Token inválido - fazer logout
      this.logout();
      return false;
    }
  },
};
