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

/**
 * Attachment returned from the API
 * Matches the structure from /calculator/proposal?__with=files
 */
export interface Attachment {
  id: string;
  proposal_id: number;
  original_name: string;
  path: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  // Computed fields for UI compatibility
  name?: string;
  mime?: string;
  size?: number;
  url?: string;
}

/**
 * Normalized attachment for UI use
 */
export interface NormalizedAttachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
  path: string;
  created_at: string;
}

export interface AttachmentUploadResponse {
  id: number;
  proposal_id: number;
  original_name: string;
  path: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

// Allowed file types
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_ATTACHMENTS = 10;

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

// Extract numeric ID from proposal ID string (e.g., "PROP-32" -> 32, "OPEN-1234" -> 1234)
const extractNumericId = (proposalId: string): number => {
  const match = proposalId.match(/\d+/);
  if (!match) {
    throw new Error('ID de proposta inválido');
  }
  return parseInt(match[0], 10);
};

/**
 * Get the file URL for an attachment
 */
export const getAttachmentUrl = (path: string): string => {
  return `${API_BASE_URL}/calculator/proposal/file/${path}`;
};

/**
 * Infer MIME type from filename extension
 */
const inferMimeType = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
};

/**
 * Normalize API attachment to UI-friendly format
 */
export const normalizeAttachment = (file: Attachment): NormalizedAttachment => {
  return {
    id: String(file.id),
    name: file.original_name || file.name || 'Arquivo',
    mime: file.mime || inferMimeType(file.original_name || ''),
    size: file.size || 0,
    url: file.url || getAttachmentUrl(file.path),
    path: file.path,
    created_at: file.created_at,
  };
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
 * POST /calculator/proposal/{idOrUuid}/file
 * Content-Type: multipart/form-data
 */
export const uploadAttachment = async (
  proposalId: string,
  file: File
): Promise<NormalizedAttachment> => {
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
      `${API_BASE_URL}/calculator/proposal/${numericId}/file`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          // Let browser set Content-Type with boundary for multipart/form-data
        },
        timeout: 60000, // 60s timeout for large files
      }
    );
    
    // Normalize the response
    return normalizeAttachment({
      id: String(response.data.id),
      proposal_id: response.data.proposal_id,
      original_name: response.data.original_name,
      path: response.data.path,
      created_by: response.data.created_by,
      created_at: response.data.created_at,
      updated_at: response.data.updated_at,
    });
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      handleAuthError();
    }
    throw error;
  }
};

/**
 * List all attachments for a proposal
 * GET /calculator/proposal/{id}?__with=files
 * Response includes a "files" array
 */
export const listAttachments = async (proposalId: string): Promise<NormalizedAttachment[]> => {
  const token = getToken();
  if (!token) {
    handleAuthError();
    throw new Error('Não autenticado');
  }

  const numericId = extractNumericId(proposalId);
  
  try {
    // Fetch proposal with files included
    const response = await axios.get(
      `${API_BASE_URL}/calculator/proposal/${numericId}`,
      {
        params: {
          __with: 'files',
        },
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );
    
    // Extract files array from response
    const files: Attachment[] = response.data?.files || [];
    
    // Normalize each file for UI use
    return files.map(normalizeAttachment);
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
 * Note: The API may not support delete. If so, this will throw.
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
      `${API_BASE_URL}/calculator/proposal/${numericId}/file/${attachmentId}`,
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
 * Note: This may not be supported by the API
 */
export const reorderAttachments = async (
  proposalId: string,
  orderedIds: string[]
): Promise<NormalizedAttachment[]> => {
  const token = getToken();
  if (!token) {
    handleAuthError();
    throw new Error('Não autenticado');
  }

  const numericId = extractNumericId(proposalId);
  
  try {
    const response = await axios.put(
      `${API_BASE_URL}/calculator/proposal/${numericId}/files/reorder`,
      { order: orderedIds },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const files: Attachment[] = response.data?.files || response.data || [];
    return files.map(normalizeAttachment);
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      handleAuthError();
    }
    // If reorder is not supported, just return current order
    if (error.response?.status === 404 || error.response?.status === 405) {
      return listAttachments(proposalId);
    }
    throw error;
  }
};
