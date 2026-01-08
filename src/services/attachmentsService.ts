// ============================================================================
// ATTACHMENTS SERVICE - API integration for proposal attachments
// ============================================================================

import axios from 'axios';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://apiv2.opendata.center/api';
const AUTH_TOKEN_KEY = 'open_access_token';
const LEGACY_AUTH_TOKEN_KEY = 'open_api_token';

// ============================================================================
// TYPES
// ============================================================================

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
  created_at: string;
  order: number;
}

export interface AttachmentUploadResponse {
  attachment: Attachment;
}

export interface AttachmentsListResponse {
  attachments: Attachment[];
}

// Allowed file types
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_ATTACHMENTS = 3;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
};

const handleAuthError = () => {
  const pathname = window.location.pathname;
  const isPartner = pathname.startsWith('/parceiro');
  const loginPath = isPartner ? '/parceiro/login' : '/login';
  
  if (!pathname.startsWith(loginPath)) {
    toast.error('Sessão expirada. Faça login novamente.');
    window.location.replace(loginPath);
  }
};

// Extract numeric ID from proposal ID string (e.g., "OPEN-1234" -> 1234)
const extractNumericId = (proposalId: string): number => {
  const match = proposalId.match(/\d+/);
  if (!match) {
    throw new Error('ID de proposta inválido');
  }
  return parseInt(match[0], 10);
};

// ============================================================================
// VALIDATION
// ============================================================================

export const validateFile = (file: File): { valid: boolean; error?: string } => {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido. Tipos aceitos: PDF, PNG, JPG`,
    };
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Arquivo muito grande. Tamanho máximo: 20MB`,
    };
  }
  
  return { valid: true };
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Upload an attachment for a proposal
 */
export const uploadAttachment = async (
  proposalId: string,
  file: File
): Promise<Attachment> => {
  const token = getToken();
  if (!token) {
    handleAuthError();
    throw new Error('Não autenticado');
  }

  const numericId = extractNumericId(proposalId);
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await axios.post<AttachmentUploadResponse>(
      `${API_BASE_URL}/calculator/proposal/${numericId}/attachments`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          // Let browser set Content-Type with boundary for multipart
        },
        timeout: 60000, // 60s timeout for large files
      }
    );
    
    return response.data.attachment;
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      handleAuthError();
    }
    throw error;
  }
};

/**
 * List all attachments for a proposal
 */
export const listAttachments = async (proposalId: string): Promise<Attachment[]> => {
  const token = getToken();
  if (!token) {
    handleAuthError();
    throw new Error('Não autenticado');
  }

  const numericId = extractNumericId(proposalId);
  
  try {
    const response = await axios.get<AttachmentsListResponse | Attachment[]>(
      `${API_BASE_URL}/calculator/proposal/${numericId}/attachments`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );
    
    // Handle both response formats
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return response.data.attachments || [];
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      handleAuthError();
    }
    // If 404, return empty array (no attachments)
    if (error.response?.status === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Delete an attachment from a proposal
 */
export const deleteAttachment = async (
  proposalId: string,
  attachmentId: string
): Promise<void> => {
  const token = getToken();
  if (!token) {
    handleAuthError();
    throw new Error('Não autenticado');
  }

  const numericId = extractNumericId(proposalId);
  
  try {
    await axios.delete(
      `${API_BASE_URL}/calculator/proposal/${numericId}/attachments/${attachmentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      handleAuthError();
    }
    throw error;
  }
};

/**
 * Reorder attachments for a proposal (optional feature)
 */
export const reorderAttachments = async (
  proposalId: string,
  orderedIds: string[]
): Promise<Attachment[]> => {
  const token = getToken();
  if (!token) {
    handleAuthError();
    throw new Error('Não autenticado');
  }

  const numericId = extractNumericId(proposalId);
  
  try {
    const response = await axios.put<AttachmentsListResponse | Attachment[]>(
      `${API_BASE_URL}/calculator/proposal/${numericId}/attachments/reorder`,
      { order: orderedIds },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return response.data.attachments || [];
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      handleAuthError();
    }
    throw error;
  }
};
