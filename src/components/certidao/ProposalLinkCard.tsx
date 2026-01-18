// ============================================================================
// PROPOSAL LINK CARD - Card para exibir proposta vinculada
// ============================================================================

import React, { useState } from 'react';
import { FileText, RefreshCw, Unlink, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useUpdateProposalSnapshot, useUnlinkProposal } from '@/hooks/useBirthCertificate';
import { useProposalById } from '@/hooks/useProposalSearch';
import { birthCertificateService } from '@/services/birthCertificateService';
type CertProposalLink = Awaited<ReturnType<typeof birthCertificateService.getActiveProposalLink>>;
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { authService } from '@/services/authService';

interface ProposalLinkCardProps {
  link: NonNullable<CertProposalLink>;
  assetId: string;
  customerId?: string;
  onRefresh?: () => void;
}

export function ProposalLinkCard({ link, assetId, customerId, onRefresh }: ProposalLinkCardProps) {
  const [showJson, setShowJson] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const session = authService.getSession();
  const userLevel = session?.level || 0;
  const isAdmin = userLevel >= 1000;
  
  const updateSnapshot = useUpdateProposalSnapshot();
  const unlinkProposal = useUnlinkProposal();
  
  // Buscar dados atuais da proposta para atualizar snapshot
  const { data: currentProposal, refetch: refetchProposal } = useProposalById(
    isUpdating ? link.proposal_id : null
  );

  const handleUpdateSnapshot = async () => {
    setIsUpdating(true);
    try {
      await refetchProposal();
      
      if (currentProposal) {
        await updateSnapshot.mutateAsync({
          linkId: link.id,
          assetId,
          snapshot_json: currentProposal,
          additionalData: {
            proposal_status: currentProposal.status || undefined,
            proposal_total: currentProposal.total || undefined,
            proposal_term_months: currentProposal.contract_duration || undefined,
            proposal_company: currentProposal.company || undefined,
          },
        });
        onRefresh?.();
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnlink = async () => {
    await unlinkProposal.mutateAsync({
      linkId: link.id,
      assetId,
      customerId,
    });
    onRefresh?.();
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Extrair dados do snapshot
  const snapshot = link.snapshot_json as Record<string, unknown> | null;
  const snapshotCompany = snapshot?.company as string | undefined;
  const snapshotTotal = snapshot?.total as number | undefined;
  const snapshotTerm = snapshot?.contract_duration as number | undefined;
  const snapshotServers = snapshot?.servers as unknown[] | undefined;
  const snapshotAddons = snapshot?.addons as unknown[] | undefined;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Proposta Vinculada
        </CardTitle>
        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
          #{link.proposal_id}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dados da proposta */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Empresa</p>
            <p className="font-medium">{link.proposal_company || snapshotCompany || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
              {link.proposal_status || 'Aprovada'}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Valor Total</p>
            <p className="font-medium font-mono">
              {formatCurrency(link.proposal_total ?? snapshotTotal ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Prazo</p>
            <p className="font-medium">
              {link.proposal_term_months ?? snapshotTerm ?? 1} meses
            </p>
          </div>
        </div>

        {/* Resumo do snapshot */}
        {snapshot && (
          <div className="pt-3 border-t">
            <p className="text-sm text-muted-foreground mb-2">Resumo do Snapshot</p>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Servidores:</span>{' '}
                {snapshotServers?.length || 0} itens
              </p>
              <p>
                <span className="text-muted-foreground">Add-ons:</span>{' '}
                {snapshotAddons?.length || 0} itens
              </p>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="pt-3 border-t text-xs text-muted-foreground">
          <p>
            Vinculado em:{' '}
            {format(new Date(link.imported_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
          {link.updated_at !== link.imported_at && (
            <p>
              Atualizado em:{' '}
              {format(new Date(link.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
        </div>

        {/* JSON Completo (apenas admin) */}
        {isAdmin && (
          <div className="pt-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowJson(!showJson)}
              className="w-full justify-start"
            >
              {showJson ? (
                <><EyeOff className="h-4 w-4 mr-2" /> Ocultar JSON</>
              ) : (
                <><Eye className="h-4 w-4 mr-2" /> Ver JSON Completo</>
              )}
            </Button>
            {showJson && snapshot && (
              <pre className="mt-2 p-3 bg-muted/50 rounded-lg text-xs overflow-auto max-h-64">
                {JSON.stringify(snapshot, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpdateSnapshot}
            disabled={isUpdating || updateSnapshot.isPending}
          >
            {isUpdating || updateSnapshot.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar Snapshot
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Unlink className="h-4 w-4 mr-2" />
                Desvincular
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desvincular Proposta?</AlertDialogTitle>
                <AlertDialogDescription>
                  A proposta #{link.proposal_id} será desvinculada deste ativo. 
                  O histórico será mantido para consulta futura.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleUnlink}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Desvincular
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
