// ============================================================================
// LINK PROPOSAL MODAL - Modal para vincular proposta a um ativo
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Search, FileText, Check, Loader2, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProposalSearch, useProposalById } from '@/hooks/useProposalSearch';
import { useLinkProposal } from '@/hooks/useBirthCertificate';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface LinkProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  assetId: string;
  onSuccess?: () => void;
}

export function LinkProposalModal({
  open,
  onOpenChange,
  customerId,
  assetId,
  onSuccess,
}: LinkProposalModalProps) {
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  
  const { searchTerm, setSearchTerm, results, isLoading, hasMinChars } = useProposalSearch({
    minChars: 3,
    perPage: 50,
    onlyApproved: true,
  });
  
  const { data: proposalDetails, isLoading: isLoadingDetails } = useProposalById(selectedProposalId);
  const linkProposal = useLinkProposal();

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setSelectedProposalId(null);
      setSearchTerm('');
    }
  }, [open, setSearchTerm]);

  const handleSelectProposal = (proposalId: number) => {
    setSelectedProposalId(proposalId);
  };

  const handleConfirmLink = async () => {
    if (!selectedProposalId || !proposalDetails) {
      toast.error('Selecione uma proposta primeiro');
      return;
    }

    setIsLinking(true);
    try {
      await linkProposal.mutateAsync({
        customer_id: customerId,
        asset_id: assetId,
        proposal_id: String(proposalDetails.id),
        proposal_uuid: proposalDetails.uuid || undefined,
        proposal_status: proposalDetails.status || undefined,
        proposal_total: proposalDetails.total || undefined,
        proposal_term_months: proposalDetails.contract_duration || undefined,
        proposal_company: proposalDetails.company || undefined,
        snapshot_json: proposalDetails,
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao vincular proposta:', error);
    } finally {
      setIsLinking(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Vincular Proposta
          </DialogTitle>
          <DialogDescription>
            Busque e selecione uma proposta aprovada para vincular a este ativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Campo de Busca */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite ao menos 3 caracteres para buscar (ID, empresa, nome...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {!hasMinChars && searchTerm.length > 0 && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                Digite ao menos 3 caracteres para buscar
              </p>
            )}
          </div>

          {/* Resultados */}
          <div className="flex-1 overflow-auto border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/50 mb-2" />
                {hasMinChars ? (
                  <p className="text-muted-foreground">
                    Nenhuma proposta aprovada encontrada para "{searchTerm}"
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Busque por ID, empresa ou nome do responsável
                  </p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">ID</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Prazo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((proposal) => (
                    <TableRow
                      key={proposal.id}
                      className={selectedProposalId === proposal.id ? 'bg-primary/10' : ''}
                    >
                      <TableCell className="font-mono">{proposal.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{proposal.company}</p>
                          <p className="text-xs text-muted-foreground">{proposal.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(proposal.total)}
                      </TableCell>
                      <TableCell className="text-center">
                        {proposal.contract_duration}m
                      </TableCell>
                      <TableCell className="text-sm">
                        {proposal.created_at
                          ? format(new Date(proposal.created_at), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                          Aprovada
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={selectedProposalId === proposal.id ? 'default' : 'outline'}
                          onClick={() => handleSelectProposal(proposal.id)}
                        >
                          {selectedProposalId === proposal.id ? (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Selecionada
                            </>
                          ) : (
                            'Selecionar'
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Preview da Proposta Selecionada */}
          {selectedProposalId && (
            <div className="p-4 bg-muted/50 rounded-lg border">
              {isLoadingDetails ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Carregando detalhes...</span>
                </div>
              ) : proposalDetails ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Proposta #{proposalDetails.id}</p>
                    <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                      {proposalDetails.status || 'Aprovada'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Empresa</p>
                      <p className="font-medium">{proposalDetails.company}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Valor Total</p>
                      <p className="font-medium">{formatCurrency(proposalDetails.total || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Prazo</p>
                      <p className="font-medium">{proposalDetails.contract_duration || 1} meses</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmLink}
            disabled={!selectedProposalId || isLoadingDetails || isLinking}
          >
            {isLinking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Vinculando...
              </>
            ) : (
              'Vincular Proposta'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
