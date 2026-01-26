/**
 * PropostaPdfPublic - Public PDF Download Page
 * 
 * Allows clients to download proposal PDF using a link from email.
 * Does NOT require login - uses file_access_token for access control.
 * 
 * URL Format: /proposta/pdf?proposalId={id}&token={file_access_token}
 * 
 * Flow:
 * 1. Read proposalId and token from URL query params
 * 2. Validate token exists
 * 3. Fetch proposal from API
 * 4. Generate and auto-download PDF
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, FileDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import OpenLogo from '@/components/OpenLogo';
import { downloadProposalPdfPublic } from '@/services/proposalPdfService';
import { Button } from '@/components/ui/button';

type DownloadState = 'loading' | 'success' | 'error';

const PropostaPdfPublic: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  // URL params
  const proposalId = searchParams.get('proposalId');
  const token = searchParams.get('token') || '';
  
  // State
  const [state, setState] = useState<DownloadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Auto-download on mount
  useEffect(() => {
    if (!proposalId || !token) {
      setState('error');
      setErrorMessage('Link inválido ou incompleto');
      return;
    }
    
    handleDownload();
  }, [proposalId, token]);
  
  const handleDownload = async () => {
    if (!proposalId || !token) return;
    
    setState('loading');
    setIsRetrying(false);
    
    const result = await downloadProposalPdfPublic(proposalId, token);
    
    if (result.success) {
      setState('success');
    } else {
      setState('error');
      setErrorMessage(result.error || 'Erro ao baixar PDF');
    }
  };
  
  const handleRetry = () => {
    setIsRetrying(true);
    handleDownload();
  };
  
  // Loading state
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6 p-8 max-w-md">
          <OpenLogo />
          <div className="flex items-center justify-center gap-3 text-primary">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-xl font-medium">Gerando PDF...</span>
          </div>
          <p className="text-muted-foreground">
            O download iniciará automaticamente em alguns segundos.
          </p>
        </div>
      </div>
    );
  }
  
  // Success state
  if (state === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6 p-8 max-w-md">
          <OpenLogo />
          <div className="flex items-center justify-center gap-3 text-green-600">
            <CheckCircle2 className="w-8 h-8" />
            <span className="text-xl font-medium">PDF gerado!</span>
          </div>
          <p className="text-muted-foreground">
            O download do PDF foi iniciado. Verifique sua pasta de downloads.
          </p>
          <Button 
            onClick={handleRetry}
            variant="outline"
            className="mt-4"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Baixar novamente
          </Button>
        </div>
      </div>
    );
  }
  
  // Error state
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6 p-8 max-w-md">
        <OpenLogo />
        <div className="flex items-center justify-center gap-3 text-destructive">
          <AlertCircle className="w-8 h-8" />
          <span className="text-xl font-medium">Erro ao gerar PDF</span>
        </div>
        <p className="text-muted-foreground">
          {errorMessage}
        </p>
        <div className="space-y-3 pt-4">
          <Button 
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full"
          >
            {isRetrying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Tentando novamente...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 mr-2" />
                Tentar novamente
              </>
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            Se o problema persistir, entre em contato com o comercial da OPEN.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PropostaPdfPublic;
