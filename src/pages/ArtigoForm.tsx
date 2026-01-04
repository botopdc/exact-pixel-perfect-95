import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useArticle, useCreateArticle, useUpdateArticle } from '@/hooks/useArticles';
import { ARTICLE_CATEGORIES, ARTICLE_TEMPLATE, ArticleCategory } from '@/types/article';
import { authService } from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, Send, X } from 'lucide-react';

const articleSchema = z.object({
  title: z.string().min(5, 'O título deve ter pelo menos 5 caracteres').max(200),
  category: z.string().min(1, 'Selecione uma categoria'),
  visibility: z.enum(['private', 'internal']),
  content: z.string().min(50, 'O conteúdo deve ter pelo menos 50 caracteres'),
});

type ArticleFormData = z.infer<typeof articleSchema>;

export default function ArtigoForm({ isEdit = false }: { isEdit?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: existingArticle, isLoading } = useArticle(isEdit ? id : undefined);
  const createArticle = useCreateArticle();
  const updateArticle = useUpdateArticle();

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const form = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: '',
      category: '',
      visibility: 'private',
      content: ARTICLE_TEMPLATE,
    },
  });

  // Load existing article for editing
  useEffect(() => {
    if (existingArticle && isEdit) {
      form.reset({
        title: existingArticle.title,
        category: existingArticle.category,
        visibility: existingArticle.visibility,
        content: existingArticle.content,
      });
      setTags(existingArticle.tags);
    }
  }, [existingArticle, isEdit, form]);

  const handleAddTag = () => {
    const tag = tagInput.trim().replace(/^#/, '');
    if (tag && tags.length < 5 && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const onSubmit = (data: ArticleFormData, status: 'draft' | 'published') => {
    const user = authService.getCurrentUser();
    const author = user?.email || 'Anônimo';

    const articleData = {
      title: data.title,
      content: data.content,
      category: data.category as ArticleCategory,
      visibility: data.visibility,
      tags,
      status,
      author,
    };

    if (isEdit && id) {
      updateArticle.mutate(
        { id, ...articleData },
        {
          onSuccess: () => navigate(`/artigos/${id}`),
        }
      );
    } else {
      createArticle.mutate(articleData, {
        onSuccess: (newArticle) => navigate(`/artigos/${newArticle.id}`),
      });
    }
  };

  if (isEdit && isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-6">
        <Link to="/artigos">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Artigos
        </Link>
      </Button>

      <div className="open-card">
        <h1 className="text-2xl font-bold text-foreground mb-6">
          {isEdit ? 'Editar Artigo' : 'Criar Novo Artigo'}
        </h1>

        <Form {...form}>
          <form className="space-y-6">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título do artigo *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Como resolver erro de conexão no Acronis"
                      className="bg-input border-border"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category & Visibility */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ARTICLE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibilidade *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="private">🔒 Privado</SelectItem>
                        <SelectItem value="internal">🏢 Interno</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <FormLabel>Tags (máx. 5)</FormLabel>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:bg-secondary/80 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              {tags.length < 5 && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: #Windows, #Backup, #Acronis"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="bg-input border-border flex-1"
                  />
                  <Button type="button" variant="secondary" onClick={handleAddTag}>
                    Adicionar
                  </Button>
                </div>
              )}
            </div>

            {/* Content Editor */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conteúdo *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Digite o conteúdo do artigo..."
                      className="bg-input border-border min-h-[400px] font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={form.handleSubmit((data) => onSubmit(data, 'draft'))}
                disabled={createArticle.isPending || updateArticle.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar rascunho
              </Button>
              <Button
                type="button"
                onClick={form.handleSubmit((data) => onSubmit(data, 'published'))}
                disabled={createArticle.isPending || updateArticle.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Publicar artigo
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
