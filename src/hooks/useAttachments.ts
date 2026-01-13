// ============================================================================
// ATTACHMENTS HOOKS - React Query hooks for proposal attachments
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  reorderAttachments,
  validateFile,
  NormalizedAttachment,
  MAX_ATTACHMENTS,
} from '@/services/attachmentsService';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const attachmentKeys = {
  all: ['attachments'] as const,
  list: (proposalId: string) => [...attachmentKeys.all, 'list', proposalId] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to fetch attachments for a proposal
 */
export const useAttachments = (proposalId: string | undefined) => {
  return useQuery({
    queryKey: attachmentKeys.list(proposalId || ''),
    queryFn: () => listAttachments(proposalId!),
    enabled: !!proposalId,
    staleTime: 30000, // 30 seconds
  });
};

/**
 * Hook to upload an attachment
 */
export const useUploadAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      proposalId,
      file,
    }: {
      proposalId: string;
      file: File;
    }) => {
      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Check max attachments
      const existing = queryClient.getQueryData<NormalizedAttachment[]>(
        attachmentKeys.list(proposalId)
      );
      if (existing && existing.length >= MAX_ATTACHMENTS) {
        throw new Error(`Limite máximo de ${MAX_ATTACHMENTS} anexos atingido`);
      }

      return uploadAttachment(proposalId, file);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.list(variables.proposalId),
      });
      toast({
        title: 'Anexo enviado',
        description: 'O arquivo foi anexado à proposta com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao enviar anexo',
        description: error.message || 'Não foi possível enviar o arquivo.',
        variant: 'destructive',
      });
    },
  });
};

/**
 * Hook to delete an attachment
 */
export const useDeleteAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      proposalId,
      attachmentId,
    }: {
      proposalId: string;
      attachmentId: string;
    }) => {
      return deleteAttachment(proposalId, attachmentId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.list(variables.proposalId),
      });
      toast({
        title: 'Anexo removido',
        description: 'O arquivo foi removido da proposta.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover anexo',
        description: error.message || 'Não foi possível remover o arquivo.',
        variant: 'destructive',
      });
    },
  });
};

/**
 * Hook to reorder attachments
 */
export const useReorderAttachments = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      proposalId,
      orderedIds,
    }: {
      proposalId: string;
      orderedIds: string[];
    }) => {
      return reorderAttachments(proposalId, orderedIds);
    },
    onSuccess: (newAttachments, variables) => {
      queryClient.setQueryData(
        attachmentKeys.list(variables.proposalId),
        newAttachments
      );
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao reordenar',
        description: error.message || 'Não foi possível reordenar os anexos.',
        variant: 'destructive',
      });
    },
  });
};
