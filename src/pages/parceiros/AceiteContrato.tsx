import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { partnerAuthService } from '@/services/partnersService';
import { PARTNER_CONTRACTS } from '@/types/partner';
import logoWhite from '@/assets/logo-white.png';
import { FileText, ScrollText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * Página de visualização do contrato (apenas leitura).
 * O fluxo de aceite obrigatório foi removido - parceiros vão direto ao dashboard após login.
 */
export default function AceiteContrato() {
  const navigate = useNavigate();
  const session = partnerAuthService.getSession();

  useEffect(() => {
    if (!session) {
      navigate('/parceiro/login', { replace: true });
    }
  }, [session, navigate]);

  if (!session) {
    return null;
  }

  const partnerType = session.tipo_parceria;
  const contract = PARTNER_CONTRACTS[partnerType];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoWhite} alt="OPEN Datacenter" className="h-8 w-auto" />
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-wider text-foreground">OPEN</span>
              <span className="text-[8px] tracking-[0.25em] text-muted-foreground uppercase">Parceiros</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">{session.empresa}</p>
            <p className="text-xs text-muted-foreground">{partnerType}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
              <ScrollText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{contract.titulo}</h1>
              <p className="text-sm text-muted-foreground">Versão {contract.versao}</p>
            </div>
          </div>

          {/* Contract Card */}
          <div className="open-card mb-6">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Contrato de parceria
              </span>
            </div>

            {/* Contract Content */}
            <ScrollArea className="h-[500px] rounded-lg border border-border bg-muted/30 p-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                  {contract.conteudo}
                </pre>
              </div>
            </ScrollArea>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border p-4 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} OPEN Datacenter. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
