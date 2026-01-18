/**
 * User Area Helper
 * Maps user levels to their respective corporate areas for dashboard personalization
 */

import { USER_LEVELS } from '@/config/modulesConfig';

export type UserArea = 
  | 'cliente'
  | 'comercial' 
  | 'customer_success' 
  | 'suporte_tecnico' 
  | 'financeiro' 
  | 'lideranca'
  | 'rh';

export interface AreaConfig {
  id: UserArea;
  label: string;
  description: string;
}

export const AREA_CONFIGS: Record<UserArea, AreaConfig> = {
  cliente: {
    id: 'cliente',
    label: 'Cliente',
    description: 'Dashboard simplificado para clientes',
  },
  comercial: {
    id: 'comercial',
    label: 'Comercial',
    description: 'Vendas, Propostas e Pipeline',
  },
  customer_success: {
    id: 'customer_success',
    label: 'Customer Success',
    description: 'Saúde da base, renovações e expansão',
  },
  suporte_tecnico: {
    id: 'suporte_tecnico',
    label: 'Suporte Técnico',
    description: 'NOC, Incidentes e Infraestrutura',
  },
  financeiro: {
    id: 'financeiro',
    label: 'Financeiro',
    description: 'Faturamento, recebimentos e inadimplência',
  },
  lideranca: {
    id: 'lideranca',
    label: 'Liderança',
    description: 'Visão executiva e alertas críticos',
  },
  rh: {
    id: 'rh',
    label: 'Recursos Humanos',
    description: 'Vagas, contratações e gestão de pessoas',
  },
};

/**
 * Determines the user's corporate area based on their level
 * 
 * @param userLevel - The numeric level of the user
 * @returns The user's area identifier
 */
export function getUserArea(userLevel: number | null | undefined): UserArea {
  if (!userLevel) return 'comercial'; // fallback

  // Cliente (level=1) - dashboard simplificado
  if (userLevel === USER_LEVELS.CLIENTE) {
    return 'cliente';
  }

  // Parceiro (200) - tratado separadamente no PartnerLayout
  if (userLevel === USER_LEVELS.PARCEIRO) {
    return 'comercial';
  }

  // RH (600) - Recursos Humanos
  if (userLevel === USER_LEVELS.RH) {
    return 'rh';
  }

  // BDR (680), Arquiteto (690), Comercial (700), Gerente Comercial (750)
  if (
    userLevel === USER_LEVELS.BDR ||
    userLevel === USER_LEVELS.ARQUITETO ||
    userLevel === USER_LEVELS.COMERCIAL ||
    userLevel === USER_LEVELS.GERENTE_COMERCIAL
  ) {
    return 'comercial';
  }

  // Customer Success (775)
  if (userLevel === USER_LEVELS.SUCESSO_CLIENTE) {
    return 'customer_success';
  }

  // Suporte (900), Gerente de Suporte (950)
  if (userLevel === USER_LEVELS.SUPORTE || userLevel === USER_LEVELS.GERENTE_SUPORTE) {
    return 'suporte_tecnico';
  }

  // Admin (1000) - Liderança com visão completa
  if (userLevel === USER_LEVELS.ADMIN) {
    return 'lideranca';
  }

  // Fallback para comercial
  return 'comercial';
}

/**
 * Check if user is a client (level=1)
 */
export function isClientUser(userLevel: number | null | undefined): boolean {
  return userLevel === USER_LEVELS.CLIENTE;
}

/**
 * Check if user should see corporate dashboard
 */
export function shouldShowCorporateDashboard(userLevel: number | null | undefined): boolean {
  return !isClientUser(userLevel) && userLevel !== null && userLevel !== undefined;
}
