// ============================================================================
// CREATE INTERNAL TICKET PAGE - Formulário de Abertura de Chamado Interno
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Lightbulb } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useInternalTickets } from '@/hooks/useInternalTickets';
import { authService } from '@/services/authService';
import { getUserArea } from '@/lib/userArea';
import {
  InternalTicketType,
  InternalTicketPriority,
  TICKET_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
  AREA_SUGGESTIONS,
  CRITICAL_PRIORITY_LEVELS,
  calculateSLA,
} from '@/types/internalTicket';

export default function CreateInternalTicketPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createTicket } = useInternalTickets();
  
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;
  const userName = session?.name ?? 'Usuário';
  const userEmail = session?.email ?? '';
  const userArea = session ? getUserArea({ level: userLevel } as any) : 'comercial';
  const canUseCritical = CRITICAL_PRIORITY_LEVELS.includes(userLevel);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: undefined as InternalTicketType | undefined,
    priority: undefined as InternalTicketPriority | undefined,
  });
  const [submitting, setSubmitting] = useState(false);

  // Sugestões baseadas na área do usuário
  const suggestions = AREA_SUGGESTIONS[userArea] || [];

  // Calcular SLA em tempo real
  const calculatedSLA = formData.type && formData.priority 
    ? calculateSLA(formData.type, formData.priority)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Por favor, informe um título para o chamado.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.type) {
      toast({
        title: 'Tipo obrigatório',
        description: 'Por favor, selecione o tipo de solicitação.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.priority) {
      toast({
        title: 'Prioridade obrigatória',
        description: 'Por favor, selecione a prioridade.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.description.trim()) {
      toast({
        title: 'Descrição obrigatória',
        description: 'Por favor, descreva seu chamado.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    
    try {
      const ticket = createTicket({
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.type,
        priority: formData.priority,
      });
      
      toast({
        title: 'Chamado criado!',
        description: `Chamado ${ticket.id} aberto com sucesso. SLA: ${ticket.sla_hours}h.`,
      });
      
      navigate('/modulos/atendimentos/interno');
    } catch (error) {
      console.error('Erro ao criar chamado:', error);
      toast({
        title: 'Erro ao criar chamado',
        description: 'Ocorreu um erro. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const applySuggestion = (suggestion: { type: InternalTicketType; hint: string }) => {
    setFormData({
      ...formData,
      type: suggestion.type,
      title: suggestion.hint,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/modulos/atendimentos/interno')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Abrir Chamado</h1>
          <p className="text-muted-foreground">
            Preencha os dados abaixo para abrir um chamado interno
          </p>
        </div>
      </div>

      {/* Sugestões por Área */}
      {suggestions.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <CardTitle className="text-sm font-medium">Sugestões para sua área</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => applySuggestion(suggestion)}
                className="text-xs"
              >
                {suggestion.hint}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Chamado</CardTitle>
          <CardDescription>
            Todos os campos marcados com * são obrigatórios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Solicitante (read-only) */}
            <div className="space-y-2">
              <Label>Solicitante</Label>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{userName}</span>
                  <span className="text-xs text-muted-foreground">{userEmail}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                O chamado será aberto em seu nome
              </p>
            </div>

            {/* Tipo de Solicitação */}
            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Solicitação *</Label>
              <Select
                value={formData.type || ''}
                onValueChange={(v) => setFormData({ ...formData, type: v as InternalTicketType })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de solicitação" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TICKET_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Resumo do chamado"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                maxLength={200}
              />
            </div>

            {/* Prioridade */}
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade *</Label>
              <Select
                value={formData.priority || ''}
                onValueChange={(v) => setFormData({ ...formData, priority: v as InternalTicketPriority })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => {
                    if (value === 'critica' && !canUseCritical) {
                      return null;
                    }
                    return (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {calculatedSLA && (
                <p className="text-sm text-muted-foreground">
                  SLA estimado: Resolução em até <strong>{calculatedSLA} horas</strong>
                </p>
              )}
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="description">Descrição *</Label>
              <Textarea
                id="description"
                placeholder="Descreva detalhadamente o problema ou solicitação..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={6}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.description.length}/2000 caracteres
              </p>
            </div>

            {/* Botões */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/modulos/atendimentos/interno')}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>Criando...</>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Abrir Chamado
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
