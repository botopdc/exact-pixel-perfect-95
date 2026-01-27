/**
 * Validation utilities for CPF, CNPJ, CEP
 */

/**
 * Validates CPF format and check digit
 */
export function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  
  if (cleaned.length !== 11) return false;
  
  // Check for known invalid sequences
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Validate check digits
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[10])) return false;
  
  return true;
}

/**
 * Validates CNPJ format and check digit
 */
export function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  
  if (cleaned.length !== 14) return false;
  
  // Check for known invalid sequences
  if (/^(\d)\1{13}$/.test(cleaned)) return false;
  
  // Validate first check digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleaned[12])) return false;
  
  // Validate second check digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cleaned[13])) return false;
  
  return true;
}

/**
 * Format CPF: 000.000.000-00
 */
export function formatCPF(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 11);
  
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
}

/**
 * Format CNPJ: 00.000.000/0000-00
 */
export function formatCNPJ(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 14);
  
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 5) return `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
  if (cleaned.length <= 8) return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5)}`;
  if (cleaned.length <= 12) return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8)}`;
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
}

/**
 * Format CEP: 00000-000
 */
export function formatCEP(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 8);
  
  if (cleaned.length <= 5) return cleaned;
  return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
}

/**
 * Validates CEP format (8 digits)
 */
export function isValidCEP(cep: string): boolean {
  const cleaned = cep.replace(/\D/g, '');
  return cleaned.length === 8;
}

/**
 * Fetch address from ViaCEP API
 */
export async function fetchAddressByCEP(cep: string): Promise<{
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
} | null> {
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length !== 8) return null;
  
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
    const data = await response.json();
    
    if (data.erro) return null;
    
    return {
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      uf: data.uf || '',
    };
  } catch {
    return null;
  }
}
