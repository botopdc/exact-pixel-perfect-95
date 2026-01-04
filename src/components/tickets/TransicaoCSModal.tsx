import React, { useState } from 'react';
import { TicketTransicaoCS } from '@/types/ticket';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';

interface TransicaoCSModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: Omit<TicketTransicaoCS, 'data_transicao'>) => void;
}

export function TransicaoCSModal({ open, onOpenChange, onConfirm }: TransicaoCSModalProps) {
  const [resumoTecnico, setResumoTecnico] = useState('');
  const [acaoTomada, setAcaoTomada] = useState('');
  const [impacto, setImpacto] = useState<'baixo' | 'medio' | 'alto'>('baixo');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!resumoTecnico.trim() || !acaoTomada.trim()) return;
    
    setIsSubmitting(true);
    onConfirm({
      resumo_tecnico: resumoTecnico,
      acao_tomada: acaoTomada,
      impacto,
      autor: 'Suporte', // In production, get from auth
    });
    
    // Reset form
    setResumoTecnico('');
    setAcaoTomada('');
    setImpacto('baixo');
    setIsSubmitting(false);
  };

  const isValid = resumoTecnico.trim().length > 0 && acaoTomada.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Encaminhar para Customer Success
          </DialogTitle>
          <DialogDescription>
            Preencha os campos obrigatórios para encaminhar o ticket ao CS para validação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="resumo">Resumo Técnico *</Label>
            <Textarea
              id="resumo"
              placeholder="Descreva o problema técnico identificado..."
              value={resumoTecnico}
              onChange={(e) => setResumoTecnico(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acao">Ação Tomada *</Label>
            <Textarea
              id="acao"
              placeholder="Descreva as ações realizadas para resolver o problema..."
              value={acaoTomada}
              onChange={(e) => setAcaoTomada(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="impacto">Impacto Identificado *</Label>
            <Select value={impacto} onValueChange={(v) => setImpacto(v as 'baixo' | 'medio' | 'alto')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="medio">Médio</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Encaminhar para CS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
