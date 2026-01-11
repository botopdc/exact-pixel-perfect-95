// ============================================================================
// EXTERNAL ARTICLES HOOK - Uses OPEN API (not Supabase)
// Access restricted to levels 900, 950, 1000
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { openApi, ApiArticle } from '@/lib/openApi';
import { ArticleCategory } from '@/types/article';
import { useToast } from '@/hooks/use-toast';

// Helper to calculate reading time
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

export function useExternalArticles(filters?: {
  category?: ArticleCategory;
  author?: string;
  search?: string;
  status?: 'draft' | 'published';
}) {
  return useQuery({
    queryKey: ['external-articles', filters],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        __perPage: 100,
      };

      if (filters?.category) {
        params.category = filters.category;
      }
      if (filters?.author) {
        params.author = filters.author;
      }
      if (filters?.status) {
        params.status = filters.status;
      }
      if (filters?.search) {
        params.title = filters.search; // API uses title field for search
      }

      const response = await openApi.getArticles(params);
      return response.data || [];
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useExternalArticle(id: number | undefined) {
  return useQuery({
    queryKey: ['external-article', id],
    queryFn: async () => {
      if (!id) return null;
      return await openApi.getArticle(id);
    },
    enabled: !!id,
  });
}

export function useExternalTopArticles() {
  return useQuery({
    queryKey: ['external-articles', 'top'],
    queryFn: async () => {
      const response = await openApi.getArticles({
        status: 'published',
        __perPage: 100,
      });
      // Sort by views_count client-side since API might not support sorting
      return (response.data || [])
        .sort((a, b) => (b.views_count || 0) - (a.views_count || 0))
        .slice(0, 5);
    },
    staleTime: 60000, // 1 minute
  });
}

export function useExternalBestRatedArticles() {
  return useQuery({
    queryKey: ['external-articles', 'best-rated'],
    queryFn: async () => {
      const response = await openApi.getArticles({
        status: 'published',
        __perPage: 100,
      });
      // Sort by helpful_yes client-side
      return (response.data || [])
        .sort((a, b) => (b.helpful_yes || 0) - (a.helpful_yes || 0))
        .slice(0, 5);
    },
    staleTime: 60000,
  });
}

export function useExternalRecentArticles() {
  return useQuery({
    queryKey: ['external-articles', 'recent'],
    queryFn: async () => {
      const response = await openApi.getArticles({
        status: 'published',
        __perPage: 5,
      });
      // Sort by created_at client-side
      return (response.data || [])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
    },
    staleTime: 60000,
  });
}

export function useExternalUniqueAuthors() {
  return useQuery({
    queryKey: ['external-articles', 'authors'],
    queryFn: async () => {
      const response = await openApi.getArticles({ __perPage: 500 });
      const unique = [...new Set((response.data || []).map(d => d.author))];
      return unique.filter(Boolean);
    },
    staleTime: 300000, // 5 minutes
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

export function useExternalCreateArticle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (article: {
      title: string;
      content: string;
      category: ArticleCategory;
      visibility: 'private' | 'internal';
      tags: string[];
      status: 'draft' | 'published';
      author: string;
    }) => {
      return await openApi.createArticle({
        ...article,
        category: article.category,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-articles'] });
      toast({
        title: 'Artigo criado',
        description: 'O artigo foi salvo com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar artigo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useExternalUpdateArticle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...article }: Partial<ApiArticle> & { id: number }) => {
      return await openApi.updateArticle(id, article);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['external-articles'] });
      queryClient.invalidateQueries({ queryKey: ['external-article', data.id] });
      toast({
        title: 'Artigo atualizado',
        description: 'As alterações foram salvas.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar artigo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useExternalDeleteArticle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      await openApi.deleteArticle(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-articles'] });
      toast({
        title: 'Artigo excluído',
        description: 'O artigo foi removido permanentemente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao excluir artigo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useExternalIncrementViews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await openApi.incrementArticleViews(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['external-article', id] });
    },
  });
}

export function useExternalRateArticle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, helpful }: { id: number; helpful: boolean }) => {
      await openApi.rateArticle(id, helpful);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['external-article', id] });
      toast({
        title: 'Obrigado!',
        description: 'Seu feedback foi registrado.',
      });
    },
  });
}
