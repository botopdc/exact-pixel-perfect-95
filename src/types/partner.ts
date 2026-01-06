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

// Contrato unificado para todos os tipos de parceria
const CONTRATO_PARCEIRO = `TERMO DE PARCEIRO DE NEGÓCIOS – OPEN DATACENTER (VERSÃO FINAL)

PELO PRESENTE INSTRUMENTO PARTICULAR, as partes abaixo qualificadas resolvem celebrar o presente TERMO DE PARCERIA COMERCIAL, que se regerá pelas cláusulas e condições a seguir, obrigando-se por si, seus sócios, representantes, sucessores e herdeiros.

PARTES

OPEN DATACENTER BRASIL LTDA, pessoa jurídica de direito privado, inscrita no CNPJ nº 06.860.022/0001-08, com sede na Rua 11, nº 250, Qd. 76, Lt. 02/08, 13º Andar, Ed. Goiânia Corporate, Setor Central, Goiânia/GO, CEP 74.015-170, doravante denominada OPEN DATACENTER.

E, de outro lado,

PARCEIRO, pessoa jurídica de direito privado, inscrita no CNPJ nº ____________, com sede em ____________, doravante denominada simplesmente PARCEIRO.

CLÁUSULA PRIMEIRA – OBJETO

1.1. O presente contrato tem por objeto a formalização de parceria comercial para prospecção, indicação, intermediação ou revenda dos produtos e serviços da OPEN DATACENTER, conforme o modelo de parceria adotado pelo PARCEIRO.

CLÁUSULA SEGUNDA – MODELOS DE PARCERIA

2.1. O PARCEIRO será enquadrado em um dos seguintes modelos, conforme classificação definida e registrada pela OPEN DATACENTER:

• ISV (Independent Software Vendor)
• VAR (Value Added Reseller)
• FINDER

2.2. A alteração do modelo de parceria poderá ser realizada exclusivamente pela OPEN DATACENTER, mediante registro em sistema próprio.

2.3. O presente contrato não estabelece exclusividade entre as partes.

CLÁUSULA TERCEIRA – REMUNERAÇÃO E CONDIÇÕES COMERCIAIS

3.1 ISV

O PARCEIRO ISV fará jus a 15% (quinze por cento) de desconto sobre os valores padrão da price list da OPEN DATACENTER.

3.2 VAR

O PARCEIRO VAR fará jus a 5% (cinco por cento) de margem sobre os valores padrão da price list.

3.2.1. Qualquer aplicação de overprice deverá ser previamente validada pela OPEN DATACENTER.

3.3 FINDER – Comissão por Indicação

3.3.1. O PARCEIRO FINDER fará jus a 100% (cem por cento) do valor do MRR integral do primeiro mês completo após a ativação do cliente, sem consideração de pró-rata, descontos temporários ou períodos parciais.

3.3.2. A comissão será paga em 03 (três) parcelas mensais, iguais e sucessivas, condicionadas ao efetivo recebimento pela OPEN DATACENTER.

3.3.3. As parcelas vencerão sempre no dia 20 dos meses subsequentes ao recebimento do cliente pela OPEN DATACENTER.

CLÁUSULA QUARTA – PROCEDIMENTOS COMERCIAIS

4.1. Toda indicação deverá ser previamente registrada junto à OPEN DATACENTER, por meio de seus canais oficiais ou sistema eletrônico.

4.2. A OPEN DATACENTER conduzirá a negociação técnica e comercial com o cliente final.

CLÁUSULA QUINTA – PAGAMENTO

5.1. Toda remuneração está condicionada ao efetivo recebimento do valor correspondente pela OPEN DATACENTER.

5.2. O pagamento obedecerá ao modelo de parceria definido na Cláusula Terceira.

CLÁUSULA SEXTA – USO DE MARCA E PROPRIEDADE INTELECTUAL

6.1. O PARCEIRO não poderá utilizar a marca, nome, logotipo ou qualquer elemento de propriedade intelectual da OPEN DATACENTER sem autorização prévia e expressa.

6.2. Qualquer material de divulgação deverá ser previamente aprovado pela OPEN DATACENTER.

CLÁUSULA SÉTIMA – CONFIDENCIALIDADE E LGPD

7.1. As partes comprometem-se a manter sigilo sobre todas as informações confidenciais a que tiverem acesso em razão deste contrato.

7.2. O PARCEIRO compromete-se a tratar os dados pessoais em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

7.3. O PARCEIRO não poderá compartilhar, vender ou transferir dados de clientes ou prospects sem autorização expressa.

CLÁUSULA OITAVA – VIGÊNCIA

8.1. O presente contrato terá vigência de 12 (doze) meses, renovando-se automaticamente, salvo manifestação contrária.

CLÁUSULA NONA – ACEITE ELETRÔNICO

9.1. As partes reconhecem como válido e eficaz o aceite eletrônico deste contrato realizado por meio de plataforma digital da OPEN DATACENTER, com registro de data, hora, endereço IP e versão do contrato.`;

// Contratos por tipo de parceria
export const PARTNER_CONTRACTS: Record<PartnerType, { titulo: string; conteudo: string; versao: string }> = {
  ISV: {
    titulo: 'Termo de Parceiro de Negócios – ISV',
    versao: '2.0',
    conteudo: CONTRATO_PARCEIRO,
  },
  VAR: {
    titulo: 'Termo de Parceiro de Negócios – VAR',
    versao: '2.0',
    conteudo: CONTRATO_PARCEIRO,
  },
  FINDER: {
    titulo: 'Termo de Parceiro de Negócios – FINDER',
    versao: '2.0',
    conteudo: CONTRATO_PARCEIRO,
  },
};
