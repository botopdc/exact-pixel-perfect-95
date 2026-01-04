import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTickets } from '@/hooks/useTickets';
import { 
  TicketCategoria, 
  CATEGORIA_LABELS,
  PRIORIDADE_LABELS,
  TicketPrioridade
} from '@/types/ticket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Send, Paperclip } from 'lucide-react';
import { toast } from 'sonner';

// Sample data - in production would come from API
const EMPRESAS = ['OPEN Datacenter', 'Empresa ABC', 'TechCorp', 'CloudSystems', 'DataPro'];
const SERVICOS = ['Cloud Servers', 'Backup', 'Firewall', 'VPN', 'Storage', 'Kubernetes', 'Colocation'];
const SETORES = ['TI', 'Infraestrutura', 'Desenvolvimento', 'Suporte', 'Administrativo', 'Comercial'];

export default function TicketForm() {
  const navigate = useNavigate();
  const { criarTicket } = useTickets();

  const [formData, setFormData] = useState({
    titulo: '',
    prioridade: 'media' as TicketPrioridade,
    servico: '',
    setor: '',
    empresa: '',
    categoria: 'requisicao' as TicketCategoria,
    dispositivos: '',
    anexo: '',
    descricao: '',
    privado: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.titulo.trim()) {
      toast.error('O título é obrigatório');
      return;
    }
    if (!formData.servico) {
      toast.error('O serviço é obrigatório');
      return;
    }
    if (!formData.setor) {
      toast.error('O setor é obrigatório');
      return;
    }
    if (!formData.empresa) {
      toast.error('A empresa é obrigatória');
      return;
    }

    setIsSubmitting(true);

    try {
      const ticket = criarTicket({
        titulo: formData.titulo.trim(),
        descricao: formData.descricao,
        empresa: formData.empresa,
        servico: formData.servico,
        setor: formData.setor,
        categoria: formData.categoria,
        dispositivos: formData.dispositivos,
        anexo: formData.anexo,
        privado: formData.privado,
      });

      toast.success(`Ticket ${ticket.id} criado com sucesso!`);
      navigate('/atendimentos');
    } catch (error) {
      toast.error('Erro ao criar ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/atendimentos')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Novo Ticket</h1>
          <p className="text-muted-foreground">Preencha os dados do chamado</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Informações do Chamado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                placeholder="Descreva brevemente o problema ou solicitação"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                required
              />
            </div>

            {/* Row: Prioridade, Categoria */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prioridade">Prioridade</Label>
                <Select
                  value={formData.prioridade}
                  onValueChange={(value: TicketPrioridade) => setFormData({ ...formData, prioridade: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDADE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value: TicketCategoria) => setFormData({ ...formData, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row: Empresa, Serviço, Setor */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="empresa">Empresa *</Label>
                <Select
                  value={formData.empresa}
                  onValueChange={(value) => setFormData({ ...formData, empresa: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPRESAS.map((empresa) => (
                      <SelectItem key={empresa} value={empresa}>{empresa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="servico">Serviço *</Label>
                <Select
                  value={formData.servico}
                  onValueChange={(value) => setFormData({ ...formData, servico: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICOS.map((servico) => (
                      <SelectItem key={servico} value={servico}>{servico}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="setor">Setor *</Label>
                <Select
                  value={formData.setor}
                  onValueChange={(value) => setFormData({ ...formData, setor: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {SETORES.map((setor) => (
                      <SelectItem key={setor} value={setor}>{setor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dispositivos */}
            <div className="space-y-2">
              <Label htmlFor="dispositivos">Dispositivos</Label>
              <Input
                id="dispositivos"
                placeholder="Ex: Servidor-01, Router-Principal"
                value={formData.dispositivos}
                onChange={(e) => setFormData({ ...formData, dispositivos: e.target.value })}
              />
            </div>

            {/* Anexo */}
            <div className="space-y-2">
              <Label htmlFor="anexo">Anexo</Label>
              <div className="flex gap-2">
                <Input
                  id="anexo"
                  placeholder="URL do anexo (opcional)"
                  value={formData.anexo}
                  onChange={(e) => setFormData({ ...formData, anexo: e.target.value })}
                />
                <Button type="button" variant="outline" size="icon">
                  <Paperclip className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Descreva detalhadamente o problema ou solicitação. Suporta Markdown."
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Suporta formatação Markdown</p>
            </div>

            {/* Ticket Privado */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="privado">Ticket Privado</Label>
                <p className="text-sm text-muted-foreground">
                  Tickets privados são visíveis apenas para a equipe interna
                </p>
              </div>
              <Switch
                id="privado"
                checked={formData.privado}
                onCheckedChange={(checked) => setFormData({ ...formData, privado: checked })}
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/atendimentos')}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Criando...' : 'Criar Ticket'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
