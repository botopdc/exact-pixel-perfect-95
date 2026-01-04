import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Article, ArticleCategory } from '@/types/article';
import { useToast } from '@/hooks/use-toast';

// Helper to calculate reading time
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export function useArticles(filters?: {
  category?: ArticleCategory;
  author?: string;
  search?: string;
  status?: 'draft' | 'published';
}) {
  return useQuery({
    queryKey: ['articles', filters],
    queryFn: async () => {
      let query = supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.author) {
        query = query.eq('author', filters.author);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Article[];
    },
  });
}

export function useArticle(id: string | undefined) {
  return useQuery({
    queryKey: ['article', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as Article | null;
    },
    enabled: !!id,
  });
}

export function useTopArticles() {
  return useQuery({
    queryKey: ['articles', 'top'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .order('views_count', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as Article[];
    },
  });
}

export function useBestRatedArticles() {
  return useQuery({
    queryKey: ['articles', 'best-rated'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .order('helpful_yes', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as Article[];
    },
  });
}

export function useRecentArticles() {
  return useQuery({
    queryKey: ['articles', 'recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as Article[];
    },
  });
}

export function useCreateArticle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (article: Omit<Article, 'id' | 'created_at' | 'updated_at' | 'views_count' | 'helpful_yes' | 'helpful_no' | 'reading_time_minutes'>) => {
      const reading_time_minutes = calculateReadingTime(article.content);
      const { data, error } = await supabase
        .from('articles')
        .insert([{ ...article, reading_time_minutes }])
        .select()
        .single();
      if (error) throw error;
      return data as Article;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      toast({
        title: 'Artigo criado',
        description: 'O artigo foi salvo com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar artigo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateArticle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...article }: Partial<Article> & { id: string }) => {
      const updates: Partial<Article> = { ...article };
      if (article.content) {
        updates.reading_time_minutes = calculateReadingTime(article.content);
      }
      const { data, error } = await supabase
        .from('articles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Article;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['article', data.id] });
      toast({
        title: 'Artigo atualizado',
        description: 'As alterações foram salvas.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar artigo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      toast({
        title: 'Artigo excluído',
        description: 'O artigo foi removido permanentemente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao excluir artigo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useIncrementViews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: article } = await supabase
        .from('articles')
        .select('views_count')
        .eq('id', id)
        .single();
      
      if (article) {
        const { error } = await supabase
          .from('articles')
          .update({ views_count: (article.views_count || 0) + 1 })
          .eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
    },
  });
}

export function useRateArticle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, helpful }: { id: string; helpful: boolean }) => {
      const { data: article } = await supabase
        .from('articles')
        .select('helpful_yes, helpful_no')
        .eq('id', id)
        .single();
      
      if (article) {
        const updates = helpful
          ? { helpful_yes: (article.helpful_yes || 0) + 1 }
          : { helpful_no: (article.helpful_no || 0) + 1 };
        
        const { error } = await supabase
          .from('articles')
          .update(updates)
          .eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      toast({
        title: 'Obrigado!',
        description: 'Seu feedback foi registrado.',
      });
    },
  });
}

export function useUniqueAuthors() {
  return useQuery({
    queryKey: ['articles', 'authors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('author');
      if (error) throw error;
      const unique = [...new Set(data.map(d => d.author))];
      return unique.filter(Boolean);
    },
  });
}
