import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Paperclip,
  Upload,
  Trash2,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  useReorderAttachments,
} from '@/hooks/useAttachments';
import {
  Attachment,
  MAX_ATTACHMENTS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '@/services/attachmentsService';
import { cn } from '@/lib/utils';

interface AttachmentsListProps {
  proposalId: string;
  readOnly?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (isoDate: string): string => {
  return new Date(isoDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getFileIcon = (mime: string) => {
  if (mime === 'application/pdf') return FileText;
  if (mime.startsWith('image/')) return ImageIcon;
  return Paperclip;
};

export const AttachmentsList: React.FC<AttachmentsListProps> = ({
  proposalId,
  readOnly = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);

  const { data: attachments = [], isLoading, error } = useAttachments(proposalId);
  const uploadMutation = useUploadAttachment();
  const deleteMutation = useDeleteAttachment();
  const reorderMutation = useReorderAttachments();

  const canAddMore = attachments.length < MAX_ATTACHMENTS;
  const isUploading = uploadMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate({ proposalId, file });
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleView = (attachment: Attachment) => {
    window.open(attachment.url, '_blank');
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMutation.mutate(
        { proposalId, attachmentId: deleteTarget.id },
        { onSettled: () => setDeleteTarget(null) }
      );
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...attachments];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderMutation.mutate({
      proposalId,
      orderedIds: newOrder.map((a) => a.id),
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === attachments.length - 1) return;
    const newOrder = [...attachments];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderMutation.mutate({
      proposalId,
      orderedIds: newOrder.map((a) => a.id),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Paperclip className="w-5 h-5" />
            Anexos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Paperclip className="w-5 h-5" />
            Anexos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Erro ao carregar anexos. Tente novamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Paperclip className="w-5 h-5" />
                Anexos
              </CardTitle>
              <CardDescription>
                {attachments.length}/{MAX_ATTACHMENTS} anexos • Máx. 20MB por arquivo
              </CardDescription>
            </div>
            {!readOnly && (
              <Button
                variant="open-outline"
                size="sm"
                onClick={handleUploadClick}
                disabled={!canAddMore || isUploading}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {isUploading ? 'Enviando...' : 'Adicionar Anexo'}
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_MIME_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-muted-foreground/30 rounded-lg">
              <Paperclip className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum anexo adicionado
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tipos aceitos: PDF, PNG, JPG
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {attachments.map((attachment, index) => {
                const FileIcon = getFileIcon(attachment.mime);
                return (
                  <div
                    key={attachment.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors',
                      'hover:bg-muted/50'
                    )}
                  >
                    <FileIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.size)} • {formatDate(attachment.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!readOnly && attachments.length > 1 && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0 || reorderMutation.isPending}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === attachments.length - 1 || reorderMutation.isPending}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleView(attachment)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(attachment)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o arquivo "{deleteTarget?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AttachmentsList;
