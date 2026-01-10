// ============================================================================
// PARTNERS SERVICE - LocalStorage Implementation
// ============================================================================

import {
  Partner,
  PartnerType,
  PartnerStatus,
  PartnerSession,
  Referral,
  ReferralStatus,
  Commission,
  CommissionInstallment,
  PaymentStatus,
} from '@/types/partner';
import { openApi } from '@/lib/openApi';

const PARTNERS_KEY = 'open_partners_v1';
const REFERRALS_KEY = 'open_referrals_v1';
const COMMISSIONS_KEY = 'open_commissions_v1';
const PARTNER_SESSION_KEY = 'open_partner_session_v1';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 horas

// ============================================================================
// HELPERS
// ============================================================================

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateId(): string {
  return crypto.randomUUID();
}

function generateToken(): string {
  return crypto.randomUUID();
}

// Calcula o dia 20 do mês subsequente
function getNextPaymentDate(baseDate: Date, monthsAhead: number): string {
  const date = new Date(baseDate);
  date.setMonth(date.getMonth() + monthsAhead);
  date.setDate(20);
  return date.toISOString().split('T')[0];
}

// ============================================================================
// PARTNERS CRUD
// ============================================================================

export const partnersService = {
  // Listar todos os parceiros
  getAll(): Partner[] {
    try {
      const data = localStorage.getItem(PARTNERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Buscar por ID
  getById(id: string): Partner | null {
    const partners = this.getAll();
    return partners.find(p => p.id === id) || null;
  },

  // Buscar por email
  getByEmail(email: string): Partner | null {
    const partners = this.getAll();
    return partners.find(p => p.email.toLowerCase() === email.toLowerCase()) || null;
  },

  // Buscar por CNPJ
  getByCnpj(cnpj: string): Partner | null {
    const partners = this.getAll();
    const cleanCnpj = cnpj.replace(/\D/g, '');
    return partners.find(p => p.cnpj.replace(/\D/g, '') === cleanCnpj) || null;
  },

  // Criar parceiro (cadastro)
  async create(data: Omit<Partner, 'id' | 'status' | 'contrato_aceito' | 'data_cadastro' | 'senha_hash'>, senha: string): Promise<Partner> {
    const partners = this.getAll();
    
    // Verificar se já existe
    if (this.getByEmail(data.email)) {
      throw new Error('Email já cadastrado');
    }
    if (this.getByCnpj(data.cnpj)) {
      throw new Error('CNPJ já cadastrado');
    }

    const senhaHash = await hashPassword(senha);
    
    const partner: Partner = {
      ...data,
      id: generateId(),
      status: 'Pendente',
      contrato_aceito: false,
      data_cadastro: new Date().toISOString(),
      senha_hash: senhaHash,
    };

    partners.push(partner);
    localStorage.setItem(PARTNERS_KEY, JSON.stringify(partners));
    
    return partner;
  },

  // Atualizar parceiro
  update(id: string, updates: Partial<Partner>): Partner | null {
    const partners = this.getAll();
    const index = partners.findIndex(p => p.id === id);
    if (index === -1) return null;

    partners[index] = { ...partners[index], ...updates };
    localStorage.setItem(PARTNERS_KEY, JSON.stringify(partners));
    
    return partners[index];
  },

  // Aceitar contrato via API
  async acceptContract(id: string, ip?: string, version?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const partnerId = parseInt(id, 10);
      if (isNaN(partnerId)) {
        return { success: false, error: 'ID de parceiro inválido' };
      }

      // Persist to API
      await openApi.updatePartner(partnerId, {
        contract_accepted: true,
        contract_accepted_at: new Date().toISOString(),
        contract_version: version || '2.0',
        contract_ip: ip || 'unknown',
      });

      // Also update localStorage for legacy support
      this.update(id, {
        contrato_aceito: true,
        data_hora_aceite: new Date().toISOString(),
        ip_aceite: ip || 'unknown',
        tipo_contrato: this.getById(id)?.tipo_parceria,
        versao_contrato: version || '2.0',
      });

      return { success: true };
    } catch (error: any) {
      console.error('[PartnersService] Error accepting contract:', error);
      const message = error?.response?.data?.message || 'Erro ao registrar aceite do contrato';
      return { success: false, error: message };
    }
  },

  // Deletar parceiro
  delete(id: string): boolean {
    const partners = this.getAll();
    const filtered = partners.filter(p => p.id !== id);
    if (filtered.length === partners.length) return false;
    
    localStorage.setItem(PARTNERS_KEY, JSON.stringify(filtered));
    return true;
  },

  // Estatísticas
  getStats() {
    const partners = this.getAll();
    return {
      total: partners.length,
      ativos: partners.filter(p => p.status === 'Ativo').length,
      pendentes: partners.filter(p => p.status === 'Pendente').length,
      inativos: partners.filter(p => p.status === 'Inativo').length,
      porTipo: {
        ISV: partners.filter(p => p.tipo_parceria === 'ISV').length,
        VAR: partners.filter(p => p.tipo_parceria === 'VAR').length,
        FINDER: partners.filter(p => p.tipo_parceria === 'FINDER').length,
      },
    };
  },
};

// ============================================================================
// PARTNER AUTH
// ============================================================================

export const partnerAuthService = {
  async login(email: string, password: string): Promise<{ success: boolean; session?: PartnerSession; error?: string }> {
    try {
      const normalizedEmail = email.toLowerCase().trim();

      if (!normalizedEmail || !password) {
        return { success: false, error: 'Email e senha são obrigatórios' };
      }

      // Validate credentials via API (also stores open_access_token)
      let apiLogin;
      try {
        apiLogin = await openApi.login(normalizedEmail, password);
      } catch (loginError: any) {
        console.error('[PartnerAuth] API Login error:', loginError);
        
        const status = loginError?.response?.status;
        const apiMessage = loginError?.response?.data?.message;
        
        // Check for specific error messages from API
        if (status === 401) {
          // Check if user is inactive
          if (apiMessage?.toLowerCase().includes('inativo') || apiMessage?.toLowerCase().includes('inactive')) {
            return { success: false, error: 'Sua conta está inativa. Entre em contato com a equipe OPEN.' };
          }
          if (apiMessage?.toLowerCase().includes('pendente') || apiMessage?.toLowerCase().includes('pending')) {
            return { success: false, error: 'Sua conta ainda está pendente de aprovação. Aguarde o contato da equipe OPEN.' };
          }
          return { success: false, error: 'Email ou senha incorretos' };
        }
        
        if (status === 403) {
          return { success: false, error: 'Acesso negado. Sua conta pode estar pendente ou inativa.' };
        }
        
        return { success: false, error: apiMessage || 'Erro ao fazer login. Verifique sua conexão.' };
      }

      // Check if user is a partner (level 200)
      if (apiLogin.user.level !== 200) {
        openApi.clearToken();
        return { success: false, error: 'Esta área é exclusiva para parceiros. Use o login administrativo.' };
      }

      // Get partner data from API
      let partnerData = apiLogin.user.partner;
      
      // If partner data not included, fetch it
      if (!partnerData) {
        try {
          const userData = await openApi.getCurrentUser({ __with: 'partner' });
          partnerData = userData.partner;
        } catch {
          // Continue without partner data
        }
      }

      // Check partner status
      const partnerStatus = partnerData?.status;
      
      if (partnerStatus === 'Pendente') {
        openApi.clearToken();
        return { success: false, error: 'Sua conta ainda está pendente de aprovação. Aguarde o contato da equipe OPEN.' };
      }

      if (partnerStatus === 'Reprovado') {
        openApi.clearToken();
        return { success: false, error: 'Sua conta está inativa. Entre em contato com a equipe OPEN.' };
      }

      // Check contract acceptance from API (source of truth)
      const contratoAceito = partnerData?.contract_accepted === true;

      const session: PartnerSession = {
        partnerId: partnerData?.id?.toString() || apiLogin.user.id.toString(),
        email: apiLogin.user.email,
        empresa: partnerData?.name || 'Parceiro',
        tipo_parceria: (partnerData?.type || 'VAR') as PartnerType,
        status: partnerStatus === 'Aprovado' ? 'Ativo' : (partnerStatus || 'Pendente') as PartnerStatus,
        contrato_aceito: contratoAceito,
        token: apiLogin.token,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
      };

      // IMPORTANT: avoid mixed sessions (admin logged-in previously in same browser)
      // Partner portal must not depend on the internal session.
      localStorage.removeItem('open_auth_session_v1');

      localStorage.setItem(PARTNER_SESSION_KEY, JSON.stringify(session));
      return { success: true, session };
    } catch (error: any) {
      console.error('[PartnerAuth] Unexpected login error:', error);
      return { success: false, error: 'Erro inesperado ao fazer login. Tente novamente.' };
    }
  },

  logout(): void {
    localStorage.removeItem(PARTNER_SESSION_KEY);
    openApi.clearToken();
  },

  // Get session from localStorage (does NOT mutate session based on old localStorage partner data)
  getSession(): PartnerSession | null {
    try {
      const data = localStorage.getItem(PARTNER_SESSION_KEY);
      if (!data) return null;

      const session: PartnerSession = JSON.parse(data);
      if (new Date(session.expiresAt) <= new Date()) {
        this.logout();
        return null;
      }

      // Return session as-is (source of truth from last API call/login)
      return session;
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return this.getSession() !== null;
  },

  canAccessCalculator(): boolean {
    const session = this.getSession();
    if (!session) return false;
    return session.status === 'Ativo' && session.contrato_aceito;
  },

  // Update session with contract accepted flag (after successful API call)
  updateSessionContractAccepted(): void {
    try {
      const data = localStorage.getItem(PARTNER_SESSION_KEY);
      if (!data) return;
      
      const session: PartnerSession = JSON.parse(data);
      session.contrato_aceito = true;
      localStorage.setItem(PARTNER_SESSION_KEY, JSON.stringify(session));
    } catch {
      // Ignore errors
    }
  },

  // Refresh session from API (re-fetch partner data to sync contract_accepted)
  async refreshSessionFromApi(): Promise<PartnerSession | null> {
    try {
      const currentSession = this.getSession();
      if (!currentSession) return null;

      // Fetch fresh user data from API
      const userData = await openApi.getCurrentUser({ __with: 'partner' });
      const partnerData = userData.partner;

      // If API didn't return partner info, do NOT clobber current session
      if (!partnerData) return currentSession;

      // IMPORTANT:
      // Some API responses may omit optional fields like `contract_accepted`.
      // In that case, we keep the previous value to avoid regressions/loops.
      const contratoAceitoFromApi =
        partnerData.contract_accepted === true
          ? true
          : partnerData.contract_accepted === false
            ? false
            : currentSession.contrato_aceito;

      // Update session with fresh API data
      const updatedSession: PartnerSession = {
        ...currentSession,
        empresa: partnerData.name || currentSession.empresa,
        tipo_parceria: (partnerData.type || currentSession.tipo_parceria) as PartnerType,
        status:
          partnerData.status === 'Aprovado'
            ? 'Ativo'
            : ((partnerData.status || 'Pendente') as PartnerStatus),
        contrato_aceito: contratoAceitoFromApi,
      };

      localStorage.setItem(PARTNER_SESSION_KEY, JSON.stringify(updatedSession));
      return updatedSession;
    } catch (error) {
      console.error('[PartnerAuth] Error refreshing session from API:', error);
      return this.getSession();
    }
  },
};

// ============================================================================
// REFERRALS CRUD
// ============================================================================

export const referralsService = {
  getAll(): Referral[] {
    try {
      const data = localStorage.getItem(REFERRALS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  getById(id: string): Referral | null {
    return this.getAll().find(r => r.id === id) || null;
  },

  getByPartnerId(partnerId: string): Referral[] {
    return this.getAll().filter(r => r.parceiro_id === partnerId);
  },

  create(data: Omit<Referral, 'id' | 'data_cadastro'>): Referral {
    const referrals = this.getAll();
    
    const referral: Referral = {
      ...data,
      id: generateId(),
      data_cadastro: new Date().toISOString(),
    };

    referrals.push(referral);
    localStorage.setItem(REFERRALS_KEY, JSON.stringify(referrals));
    
    return referral;
  },

  update(id: string, updates: Partial<Referral>): Referral | null {
    const referrals = this.getAll();
    const index = referrals.findIndex(r => r.id === id);
    if (index === -1) return null;

    const oldStatus = referrals[index].status_indicacao;
    referrals[index] = { ...referrals[index], ...updates };
    
    // Se mudou para "Fechado" e tem MRR, gerar comissão
    if (updates.status_indicacao === 'Fechado' && updates.valor_mrr_fechado && oldStatus !== 'Fechado') {
      referrals[index].data_fechamento = new Date().toISOString();
      commissionsService.createFromReferral(referrals[index]);
    }

    localStorage.setItem(REFERRALS_KEY, JSON.stringify(referrals));
    return referrals[index];
  },

  delete(id: string): boolean {
    const referrals = this.getAll();
    const filtered = referrals.filter(r => r.id !== id);
    if (filtered.length === referrals.length) return false;
    
    localStorage.setItem(REFERRALS_KEY, JSON.stringify(filtered));
    return true;
  },

  getStats(partnerId?: string) {
    let referrals = this.getAll();
    if (partnerId) {
      referrals = referrals.filter(r => r.parceiro_id === partnerId);
    }
    
    return {
      total: referrals.length,
      novo: referrals.filter(r => r.status_indicacao === 'Novo').length,
      emContato: referrals.filter(r => r.status_indicacao === 'Em contato').length,
      proposta: referrals.filter(r => r.status_indicacao === 'Proposta').length,
      fechado: referrals.filter(r => r.status_indicacao === 'Fechado').length,
      perdido: referrals.filter(r => r.status_indicacao === 'Perdido').length,
      mrrTotal: referrals
        .filter(r => r.status_indicacao === 'Fechado')
        .reduce((sum, r) => sum + (r.valor_mrr_fechado || 0), 0),
    };
  },
};

// ============================================================================
// COMMISSIONS CRUD
// ============================================================================

export const commissionsService = {
  getAll(): Commission[] {
    try {
      const data = localStorage.getItem(COMMISSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  getById(id: string): Commission | null {
    return this.getAll().find(c => c.id === id) || null;
  },

  getByPartnerId(partnerId: string): Commission[] {
    return this.getAll().filter(c => c.parceiro_id === partnerId);
  },

  getByReferralId(referralId: string): Commission | null {
    return this.getAll().find(c => c.indicacao_id === referralId) || null;
  },

  createFromReferral(referral: Referral): Commission | null {
    if (!referral.valor_mrr_fechado || referral.status_indicacao !== 'Fechado') {
      return null;
    }

    // Verificar se já existe comissão para esta indicação
    if (this.getByReferralId(referral.id)) {
      return null;
    }

    const partner = partnersService.getById(referral.parceiro_id);
    const mrrPrimeiraParcela = referral.valor_mrr_fechado;
    const comissaoTotal = mrrPrimeiraParcela; // 100% do MRR
    const valorParcela = comissaoTotal / 3;

    // Parcelas com vencimento pendente (será calculado quando OPEN receber)
    const parcelas: CommissionInstallment[] = [
      { numero: 1, valor: valorParcela, vencimento: '', status_pagamento: 'Pendente' },
      { numero: 2, valor: valorParcela, vencimento: '', status_pagamento: 'Pendente' },
      { numero: 3, valor: valorParcela, vencimento: '', status_pagamento: 'Pendente' },
    ];

    const commission: Commission = {
      id: generateId(),
      indicacao_id: referral.id,
      parceiro_id: referral.parceiro_id,
      parceiro_empresa: partner?.empresa,
      empresa_indicada: referral.empresa_indicada,
      mrr_primeira_parcela: mrrPrimeiraParcela,
      comissao_total: comissaoTotal,
      parcelas,
      data_criacao: new Date().toISOString(),
    };

    const commissions = this.getAll();
    commissions.push(commission);
    localStorage.setItem(COMMISSIONS_KEY, JSON.stringify(commissions));

    return commission;
  },

  // Admin marca data do primeiro recebimento pela OPEN
  setFirstReceiptDate(id: string, date: string): Commission | null {
    const commissions = this.getAll();
    const index = commissions.findIndex(c => c.id === id);
    if (index === -1) return null;

    const receiptDate = new Date(date);
    commissions[index].data_primeiro_recebimento_open = date;

    // Calcular vencimentos das 3 parcelas
    commissions[index].parcelas = commissions[index].parcelas.map((p, i) => ({
      ...p,
      vencimento: getNextPaymentDate(receiptDate, i + 1),
    }));

    localStorage.setItem(COMMISSIONS_KEY, JSON.stringify(commissions));
    return commissions[index];
  },

  // Admin marca parcela como paga
  markInstallmentPaid(commissionId: string, installmentNumber: 1 | 2 | 3, comprovante?: string): Commission | null {
    const commissions = this.getAll();
    const index = commissions.findIndex(c => c.id === commissionId);
    if (index === -1) return null;

    commissions[index].parcelas = commissions[index].parcelas.map(p => {
      if (p.numero === installmentNumber) {
        return {
          ...p,
          status_pagamento: 'Pago' as PaymentStatus,
          data_pagamento: new Date().toISOString(),
          comprovante,
        };
      }
      return p;
    });

    localStorage.setItem(COMMISSIONS_KEY, JSON.stringify(commissions));
    return commissions[index];
  },

  // Admin bloqueia parcela
  blockInstallment(commissionId: string, installmentNumber: 1 | 2 | 3, motivo: string): Commission | null {
    const commissions = this.getAll();
    const index = commissions.findIndex(c => c.id === commissionId);
    if (index === -1) return null;

    commissions[index].parcelas = commissions[index].parcelas.map(p => {
      if (p.numero === installmentNumber) {
        return {
          ...p,
          status_pagamento: 'Bloqueado' as PaymentStatus,
          motivo_bloqueio: motivo,
        };
      }
      return p;
    });

    localStorage.setItem(COMMISSIONS_KEY, JSON.stringify(commissions));
    return commissions[index];
  },

  // Admin desbloqueia parcela
  unblockInstallment(commissionId: string, installmentNumber: 1 | 2 | 3): Commission | null {
    const commissions = this.getAll();
    const index = commissions.findIndex(c => c.id === commissionId);
    if (index === -1) return null;

    commissions[index].parcelas = commissions[index].parcelas.map(p => {
      if (p.numero === installmentNumber) {
        return {
          ...p,
          status_pagamento: 'Pendente' as PaymentStatus,
          motivo_bloqueio: undefined,
        };
      }
      return p;
    });

    localStorage.setItem(COMMISSIONS_KEY, JSON.stringify(commissions));
    return commissions[index];
  },

  getStats() {
    const commissions = this.getAll();
    const allInstallments = commissions.flatMap(c => c.parcelas);
    
    return {
      totalComissoes: commissions.length,
      valorTotal: commissions.reduce((sum, c) => sum + c.comissao_total, 0),
      parcelasPendentes: allInstallments.filter(p => p.status_pagamento === 'Pendente').length,
      parcelasPagas: allInstallments.filter(p => p.status_pagamento === 'Pago').length,
      parcelasBloqueadas: allInstallments.filter(p => p.status_pagamento === 'Bloqueado').length,
      valorPago: allInstallments
        .filter(p => p.status_pagamento === 'Pago')
        .reduce((sum, p) => sum + p.valor, 0),
      valorPendente: allInstallments
        .filter(p => p.status_pagamento === 'Pendente')
        .reduce((sum, p) => sum + p.valor, 0),
    };
  },

  // Listar parcelas do mês
  getInstallmentsByMonth(year: number, month: number) {
    const commissions = this.getAll();
    const results: Array<{
      commission: Commission;
      installment: CommissionInstallment;
    }> = [];

    commissions.forEach(c => {
      c.parcelas.forEach(p => {
        if (p.vencimento) {
          const vDate = new Date(p.vencimento);
          if (vDate.getFullYear() === year && vDate.getMonth() === month) {
            results.push({ commission: c, installment: p });
          }
        }
      });
    });

    return results;
  },
};
