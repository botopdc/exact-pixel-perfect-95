import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { usePublicJobApplication } from '@/hooks/useJobApplications';

const applicationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  email: z
    .string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email deve ter no máximo 255 caracteres'),
  phone: z
    .string()
    .trim()
    .min(10, 'Telefone deve ter pelo menos 10 dígitos')
    .max(20, 'Telefone deve ter no máximo 20 caracteres')
    .regex(/^[\d\s\-\(\)\+]+$/, 'Telefone inválido'),
  linkedin_url: z
    .string()
    .trim()
    .url('URL do LinkedIn inválida')
    .optional()
    .or(z.literal('')),
  resume_url: z
    .string()
    .trim()
    .url('URL do currículo inválida')
    .optional()
    .or(z.literal('')),
  message: z
    .string()
    .trim()
    .max(1000, 'Mensagem deve ter no máximo 1000 caracteres')
    .optional(),
  lgpd_consent: z.literal(true, {
    errorMap: () => ({ message: 'Você deve concordar com a política de privacidade' }),
  }),
  // Honeypot field - should remain empty
  website: z.string().optional(),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

interface JobApplicationFormProps {
  jobId: string;
  jobSlug: string;
  jobTitle: string;
}

export function JobApplicationForm({ jobId, jobSlug, jobTitle }: JobApplicationFormProps) {
  const { submit, isSubmitting, isSuccess, error, reset } = usePublicJobApplication();
  
  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      linkedin_url: '',
      resume_url: '',
      message: '',
      lgpd_consent: undefined,
      website: '', // honeypot
    },
  });

  const onSubmit = async (data: ApplicationFormData) => {
    try {
      await submit(jobSlug, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        linkedin_url: data.linkedin_url || undefined,
        resume_url: data.resume_url || undefined,
        message: data.message || undefined,
        lgpd_consent: data.lgpd_consent,
        website: data.website, // honeypot
      });
    } catch (err) {
      // Error is handled in the hook
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h3 className="text-xl font-semibold text-foreground">Candidatura enviada!</h3>
        <p className="text-muted-foreground">
          Obrigado pelo interesse na vaga de <strong>{jobTitle}</strong>.
          <br />
          Analisaremos seu perfil e entraremos em contato em breve.
        </p>
        <Button variant="outline" onClick={reset}>
          Enviar outra candidatura
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome completo *</FormLabel>
              <FormControl>
                <Input placeholder="Seu nome completo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email *</FormLabel>
              <FormControl>
                <Input type="email" placeholder="seu@email.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone *</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="(11) 99999-9999" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="linkedin_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>LinkedIn (opcional)</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://linkedin.com/in/seu-perfil"
                  {...field}
                />
              </FormControl>
              <FormDescription>URL do seu perfil no LinkedIn</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="resume_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Link do currículo (opcional)</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Link para seu currículo (Google Drive, Dropbox, etc.)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mensagem (opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Conte-nos um pouco sobre você e por que se interessou pela vaga..."
                  className="min-h-[100px] resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {field.value?.length || 0}/1000 caracteres
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Honeypot field - hidden from real users */}
        <div className="hidden" aria-hidden="true">
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="lgpd_consent"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm font-normal">
                  Concordo com a{' '}
                  <a
                    href="https://opendatacenter.com.br/privacidade"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:no-underline"
                  >
                    Política de Privacidade
                  </a>{' '}
                  e autorizo o tratamento dos meus dados pessoais para fins de
                  processo seletivo. *
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Enviar candidatura
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Campos marcados com * são obrigatórios
        </p>
      </form>
    </Form>
  );
}
