// ============================================================================
// CERTIDÃO DE NASCIMENTO - NEW CUSTOMER PAGE
// Form to create a new customer using /api/company
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
import { useCreateCompany } from '@/hooks/useCompanies';
import { authService } from '@/services/authService';

export default function CertidaoNewCustomerPage() {
  const navigate = useNavigate();
  const createCompany = useCreateCompany();
  
  // Form com campos da API /api/company
  const [form, setForm] = useState({
    name: '',           // nome_fantasia → name
    legal_name: '',     // razao_social → legal_name
    docnum: '',         // cnpj → docnum
    work_area: '',      // segmento → work_area
    city: '',
    uf: '',
    has_support: true,  // tem_suporte → has_support
    obs: '',            // observacoes → obs
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
    
    if (!form.name.trim()) {
      return;
    }

    const company = await createCompany.mutateAsync({
      name: form.name,
      legal_name: form.legal_name || null,
      docnum: form.docnum || null,
      work_area: form.work_area || null,
      city: form.city || null,
      uf: form.uf || null,
      has_support: form.has_support,
      obs: form.obs || null,
    });

    navigate(`/modulos/atendimentos/certidoes/${company.id}`);
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
              <Label>Nome Fantasia *</Label>
              <Input
                required
                placeholder="Nome comercial da empresa"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <Label>Razão Social</Label>
              <Input
                placeholder="Nome completo da empresa"
                value={form.legal_name}
                onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
              />
            </div>

            <div>
              <Label>CNPJ</Label>
              <Input
                placeholder="00.000.000/0000-00"
                value={form.docnum}
                onChange={(e) => setForm({ ...form, docnum: e.target.value })}
              />
            </div>

            <div>
              <Label>Segmento</Label>
              <Input
                placeholder="Ex: Tecnologia, Varejo, Indústria"
                value={form.work_area}
                onChange={(e) => setForm({ ...form, work_area: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cidade</Label>
                <Input
                  placeholder="São Paulo"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
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
                checked={form.has_support}
                onCheckedChange={(checked) => setForm({ ...form, has_support: checked })}
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                placeholder="Informações adicionais sobre o cliente..."
                rows={4}
                value={form.obs}
                onChange={(e) => setForm({ ...form, obs: e.target.value })}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                type="submit" 
                disabled={!form.name.trim() || createCompany.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {createCompany.isPending ? 'Salvando...' : 'Criar Cliente'}
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
