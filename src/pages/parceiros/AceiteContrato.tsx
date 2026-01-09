import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { partnersService, partnerAuthService } from '@/services/partnersService';
import { PARTNER_CONTRACTS, PartnerType } from '@/types/partner';
import logoWhite from '@/assets/logo-white.png';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, FileText, ScrollText, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AceiteContrato() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [partnerType, setPartnerType] = useState<PartnerType | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const session = partnerAuthService.getSession();
    if (!session) {
      navigate('/parceiro/login', { replace: true });
      return;
    }

    if (session.contrato_aceito) {
      navigate('/parceiro/dashboard', { replace: true });
      return;
    }

    if (session.status !== 'Ativo') {
      partnerAuthService.logout();
      navigate('/parceiro/login', { replace: true });
      return;
    }

    setPartnerType(session.tipo_parceria);
    setPartnerName(session.empresa);
  }, [navigate]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) < 10;
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const getIpAddress = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'Não disponível';
    }
  };

  const handleAccept = async () => {
    if (!accepted || !partnerType || isLoading) return;

    setIsLoading(true);
    setError('');

    try {
      const session = partnerAuthService.getSession();
      if (!session) {
        navigate('/parceiro/login', { replace: true });
        return;
      }

      // Check if contract is already accepted (idempotency)
      if (session.contrato_aceito) {
        navigate('/parceiro/dashboard', { replace: true });
        return;
      }

      const ipAddress = await getIpAddress();
      const contract = PARTNER_CONTRACTS[partnerType];

      // Persist contract acceptance via API
      const result = await partnersService.acceptContract(
        session.partnerId, 
        ipAddress, 
        contract.versao
      );

      if (!result.success) {
        console.error('[AceiteContrato] Failed to accept contract:', result.error);
        setError(result.error || 'Erro ao registrar aceite. Tente novamente.');
        setIsLoading(false);
        return;
      }

      // Update session with contract accepted flag
      partnerAuthService.updateSessionContractAccepted();

      // Redirect to dashboard
      navigate('/parceiro/dashboard', { replace: true });
    } catch (err: any) {
      console.error('[AceiteContrato] Unexpected error:', err);
      setError('Erro inesperado ao registrar aceite. Tente novamente.');
      setIsLoading(false);
    }
  };

  if (!partnerType) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            <p className="text-sm font-medium text-foreground">{partnerName}</p>
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
                Leia atentamente o contrato abaixo antes de aceitar
              </span>
            </div>

            {/* Contract Content */}
            <ScrollArea 
              className="h-[400px] rounded-lg border border-border bg-muted/30 p-6"
              onScrollCapture={handleScroll}
            >
              <div ref={scrollRef} className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                  {contract.conteudo}
                </pre>
              </div>
            </ScrollArea>

            {!hasScrolledToBottom && (
              <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Role até o final do contrato para habilitar o aceite
              </p>
            )}
          </div>

          {/* Accept Section */}
          <div className="open-card">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-start gap-3 mb-6">
              <Checkbox
                id="accept"
                checked={accepted}
                onCheckedChange={(checked) => setAccepted(checked === true)}
                disabled={!hasScrolledToBottom || isLoading}
              />
              <Label
                htmlFor="accept"
                className={`text-sm leading-relaxed cursor-pointer ${
                  !hasScrolledToBottom ? 'text-muted-foreground' : 'text-foreground'
                }`}
              >
                Li e concordo integralmente com os termos e condições do contrato de parceria {partnerType} 
                estabelecido pela OPEN Datacenter, comprometendo-me a cumprir todas as obrigações nele descritas.
              </Label>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleAccept}
                disabled={!accepted || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Aceitar e Prosseguir
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  partnerAuthService.logout();
                  navigate('/parceiro/login');
                }}
                disabled={isLoading}
              >
                Cancelar
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-4 text-center">
              Ao aceitar, você confirma que leu e concorda com todos os termos do contrato.
              A data, hora e IP serão registrados para fins de auditoria.
            </p>
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
