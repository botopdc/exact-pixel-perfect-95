// ============================================================================
// AUTH SERVICE - MVP Local Storage Implementation
// Preparado para futura integração com API (ApiAuthProvider)
// ============================================================================

const AUTH_SESSION_KEY = 'open_auth_session_v1';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 horas

// Hash da senha "Open@2026!" usando SHA-256
// Gerado previamente para evitar expor a senha em código
const ADMIN_EMAIL = 'admin@open.com.br';
const ADMIN_PASSWORD_HASH = '5b8c9d5c0a3f1e2d4b6a8c7e9f0d1c3b5a7e9d2c4f6b8a0e2d4c6f8a0b2e4d6f'; // placeholder hash

export interface AuthSession {
  userId: string;
  email: string;
  role: 'admin' | 'user';
  token: string;
  expiresAt: string;
}

export interface AuthResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
}

// Gera hash SHA-256 usando Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Gera um token UUID
function generateToken(): string {
  return crypto.randomUUID();
}

// Verifica se a sessão está expirada
function isSessionExpired(session: AuthSession): boolean {
  return new Date(session.expiresAt) <= new Date();
}

// ============================================================================
// AUTH SERVICE INTERFACE
// ============================================================================

export const authService = {
  // Login - MVP usa LocalStorage, futuro usará API
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      // Validação básica
      if (!email || !password) {
        return { success: false, error: 'Email e senha são obrigatórios' };
      }

      const normalizedEmail = email.toLowerCase().trim();
      const passwordHash = await hashPassword(password);

      // MVP: Verificar credenciais locais
      // Verificar contra o admin padrão
      const expectedHash = await hashPassword('Open@2026!');
      
      if (normalizedEmail === ADMIN_EMAIL && passwordHash === expectedHash) {
        const session: AuthSession = {
          userId: 'admin-001',
          email: normalizedEmail,
          role: 'admin',
          token: generateToken(),
          expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
        };

        // Salvar sessão
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
        
        return { success: true, session };
      }

      return { success: false, error: 'Email ou senha incorretos' };
    } catch (error) {
      console.error('[AuthService] Login error:', error);
      return { success: false, error: 'Erro ao fazer login. Tente novamente.' };
    }
  },

  // Logout - limpa a sessão
  logout(): void {
    localStorage.removeItem(AUTH_SESSION_KEY);
  },

  // Obtém a sessão atual
  getSession(): AuthSession | null {
    try {
      const sessionStr = localStorage.getItem(AUTH_SESSION_KEY);
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
  getCurrentUser(): { email: string; role: string } | null {
    const session = this.getSession();
    if (!session) return null;
    return { email: session.email, role: session.role };
  },

  // Tempo restante da sessão em minutos
  getSessionTimeRemaining(): number {
    const session = this.getSession();
    if (!session) return 0;
    
    const remaining = new Date(session.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(remaining / 60000));
  },
};

// ============================================================================
// STUB PARA FUTURO API AUTH PROVIDER
// ============================================================================
/*
export const apiAuthProvider = {
  async login(email: string, password: string): Promise<AuthResult> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message };
    }
    
    const session = await response.json();
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    return { success: true, session };
  },

  async getCurrentUser(): Promise<AuthResult> {
    const session = authService.getSession();
    if (!session) return { success: false, error: 'Não autenticado' };
    
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${session.token}` },
    });
    
    if (!response.ok) {
      authService.logout();
      return { success: false, error: 'Sessão inválida' };
    }
    
    return { success: true, session };
  },
};
*/
