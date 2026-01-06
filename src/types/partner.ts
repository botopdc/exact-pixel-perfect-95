// ============================================================================
// PARTNER MODULE TYPES
// ============================================================================

export type PartnerType = 'ISV' | 'VAR' | 'FINDER';
export type PartnerStatus = 'Pendente' | 'Ativo' | 'Inativo';
export type ReferralStatus = 'Novo' | 'Em contato' | 'Proposta' | 'Fechado' | 'Perdido';
export type PaymentStatus = 'Pendente' | 'Pago' | 'Bloqueado';

// Desconto por tipo de parceiro
export const PARTNER_DISCOUNTS: Record<PartnerType, number> = {
  ISV: 0.15,    // 15% de desconto
  VAR: 0.05,    // 5% de desconto
  FINDER: 0,    // Sem desconto
};

// Labels para exibição
export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  ISV: 'ISV (Independent Software Vendor)',
  VAR: 'VAR (Value Added Reseller)',
  FINDER: 'FINDER (Indicador)',
};

export interface Partner {
  id: string;
  empresa: string;
  cnpj: string;
  responsavel: string;
  email: string;
  telefone: string;
  tipo_parceria: PartnerType;
  status: PartnerStatus;
  contrato_aceito: boolean;
  tipo_contrato?: PartnerType;
  data_hora_aceite?: string;
  ip_aceite?: string;
  versao_contrato?: string;
  data_cadastro: string;
  // Login credentials (MVP local)
  senha_hash?: string;
}

export interface PartnerSession {
  partnerId: string;
  email: string;
  empresa: string;
  tipo_parceria: PartnerType;
  status: PartnerStatus;
  contrato_aceito: boolean;
  token: string;
  expiresAt: string;
}

export interface Referral {
  id: string;
  parceiro_id: string;
  empresa_indicada: string;
  cnpj_indicado?: string;
  contato_nome: string;
  contato_email: string;
  contato_telefone: string;
  observacoes?: string;
  status_indicacao: ReferralStatus;
  valor_mrr_fechado?: number;
  data_fechamento?: string;
  data_cadastro: string;
}

export interface CommissionInstallment {
  numero: 1 | 2 | 3;
  valor: number;
  vencimento: string; // ISO date
  status_pagamento: PaymentStatus;
  data_pagamento?: string;
  comprovante?: string;
  motivo_bloqueio?: string;
}

export interface Commission {
  id: string;
  indicacao_id: string;
  parceiro_id: string;
  parceiro_empresa?: string; // For display
  empresa_indicada?: string; // For display
  mrr_primeira_parcela: number;
  comissao_total: number;
  parcelas: CommissionInstallment[];
  data_primeiro_recebimento_open?: string;
  data_criacao: string;
}

// Contratos por tipo de parceria
export const PARTNER_CONTRACTS: Record<PartnerType, { titulo: string; conteudo: string; versao: string }> = {
  ISV: {
    titulo: 'Contrato de Parceria ISV',
    versao: '1.0',
    conteudo: `
CONTRATO DE PARCERIA ISV
OPEN DATACENTER

1. OBJETO
Este contrato estabelece os termos e condições para a parceria ISV (Independent Software Vendor) entre a OPEN Datacenter e o Parceiro.

2. BENEFÍCIOS
- Desconto de 15% sobre todos os itens da price list OPEN
- Acesso à calculadora de preços personalizada
- Suporte técnico prioritário
- Materiais de co-marketing

3. OBRIGAÇÕES DO PARCEIRO
- Manter certificações técnicas atualizadas
- Seguir as diretrizes de marca OPEN
- Reportar vendas mensalmente
- Garantir qualidade no atendimento ao cliente final

4. VIGÊNCIA
Este contrato tem vigência de 12 meses, renovável automaticamente.

5. CONFIDENCIALIDADE
Todas as informações de preços e condições são confidenciais.

6. FORO
Fica eleito o foro da cidade de São Paulo para dirimir quaisquer questões.

OPEN DATACENTER
São Paulo, ${new Date().getFullYear()}
    `,
  },
  VAR: {
    titulo: 'Contrato de Parceria VAR',
    versao: '1.0',
    conteudo: `
CONTRATO DE PARCERIA VAR
OPEN DATACENTER

1. OBJETO
Este contrato estabelece os termos e condições para a parceria VAR (Value Added Reseller) entre a OPEN Datacenter e o Parceiro.

2. BENEFÍCIOS
- Desconto de 5% sobre todos os itens da price list OPEN
- Acesso à calculadora de preços personalizada
- Suporte técnico
- Treinamentos periódicos

3. OBRIGAÇÕES DO PARCEIRO
- Manter equipe comercial treinada
- Seguir as diretrizes de marca OPEN
- Reportar vendas mensalmente
- Garantir qualidade no atendimento ao cliente final

4. VIGÊNCIA
Este contrato tem vigência de 12 meses, renovável automaticamente.

5. CONFIDENCIALIDADE
Todas as informações de preços e condições são confidenciais.

6. FORO
Fica eleito o foro da cidade de São Paulo para dirimir quaisquer questões.

OPEN DATACENTER
São Paulo, ${new Date().getFullYear()}
    `,
  },
  FINDER: {
    titulo: 'Contrato de Parceria FINDER',
    versao: '1.0',
    conteudo: `
CONTRATO DE PARCERIA FINDER
OPEN DATACENTER

1. OBJETO
Este contrato estabelece os termos e condições para a parceria FINDER (Indicador) entre a OPEN Datacenter e o Parceiro.

2. COMISSIONAMENTO
- Comissão: 100% da primeira parcela (MRR) do contrato do cliente indicado
- Pagamento em 3 parcelas iguais
- Pagamento sempre no dia 20 do mês subsequente ao recebimento pela OPEN

3. DEFINIÇÃO DA PRIMEIRA PARCELA
- Primeira parcela = valor do MRR integral do primeiro mês completo após a ativação do cliente
- Não considerar pró-rata, descontos temporários, créditos ou testes
- O valor utilizado será sempre o MRR cheio faturado no primeiro ciclo mensal completo

4. CONDIÇÃO DE PAGAMENTO
- Pagamento condicionado ao recebimento efetivo pela OPEN
- Recebimento = pagamento compensado (boleto, cartão ou transferência confirmada)

5. OBRIGAÇÕES DO PARCEIRO
- Registrar indicações pelo sistema
- Fornecer informações corretas do lead
- Não interferir nas negociações comerciais

6. VIGÊNCIA
Este contrato tem vigência indeterminada.

7. CONFIDENCIALIDADE
Todas as informações são confidenciais.

8. FORO
Fica eleito o foro da cidade de São Paulo para dirimir quaisquer questões.

OPEN DATACENTER
São Paulo, ${new Date().getFullYear()}
    `,
  },
};
