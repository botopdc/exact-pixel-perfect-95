// ============================================================================
// CERTIDÃO DE NASCIMENTO - NEW CUSTOMER PAGE
// Form to create a new customer
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCreateCertCustomer } from '@/hooks/useBirthCertificate';
import { authService } from '@/services/authService';

export default function CertidaoNewCustomerPage() {
  const navigate = useNavigate();
  const createCustomer = useCreateCertCustomer();
  
  const [form, setForm] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    segmento: '',
    cidade: '',
    uf: '',
    tem_suporte: true,
    observacoes: '',
  });

  // Access control
  const session = authService.getSession();
  const userLevel = session?.level || 0;
  
  if (userLevel < 900) {
    return (
      <div className="container mx-auto p-6">
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">Acesso restrito ao time de Suporte (nível 900+)</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.razao_social.trim()) {
      return;
    }

    const customer = await createCustomer.mutateAsync({
      razao_social: form.razao_social,
      nome_fantasia: form.nome_fantasia || null,
      cnpj: form.cnpj || null,
      segmento: form.segmento || null,
      cidade: form.cidade || null,
      uf: form.uf || null,
      tem_suporte: form.tem_suporte,
      observacoes: form.observacoes || null,
    });

    navigate(`/modulos/atendimentos/certidoes/${customer.id}`);
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/modulos/atendimentos/certidoes')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Novo Cliente
          </h1>
          <p className="text-muted-foreground">
            Cadastre um novo cliente para documentação de infraestrutura
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Razão Social *</Label>
              <Input
                required
                placeholder="Nome completo da empresa"
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
              />
            </div>

            <div>
              <Label>Nome Fantasia</Label>
              <Input
                placeholder="Nome comercial"
                value={form.nome_fantasia}
                onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
              />
            </div>

            <div>
              <Label>CNPJ</Label>
              <Input
                placeholder="00.000.000/0000-00"
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              />
            </div>

            <div>
              <Label>Segmento</Label>
              <Input
                placeholder="Ex: Tecnologia, Varejo, Indústria"
                value={form.segmento}
                onChange={(e) => setForm({ ...form, segmento: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cidade</Label>
                <Input
                  placeholder="São Paulo"
                  value={form.cidade}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                />
              </div>
              <div>
                <Label>UF</Label>
                <Input
                  placeholder="SP"
                  maxLength={2}
                  value={form.uf}
                  onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label>Tem Suporte Ativo?</Label>
                <p className="text-sm text-muted-foreground">
                  Cliente possui contrato de suporte
                </p>
              </div>
              <Switch
                checked={form.tem_suporte}
                onCheckedChange={(checked) => setForm({ ...form, tem_suporte: checked })}
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                placeholder="Informações adicionais sobre o cliente..."
                rows={4}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                type="submit" 
                disabled={!form.razao_social.trim() || createCustomer.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {createCustomer.isPending ? 'Salvando...' : 'Criar Cliente'}
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => navigate('/modulos/atendimentos/certidoes')}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
