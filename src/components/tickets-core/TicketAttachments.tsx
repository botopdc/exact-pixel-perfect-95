// ============================================================================
// TICKET ATTACHMENTS — upload + download with signed URLs
// ============================================================================

import { useState, useRef } from 'react';
import { Paperclip, Upload, Download, Loader2, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supportTicketCoreService, CoreTicketAttachment } from '@/services/supportTicketCoreService';
import { authService } from '@/services/authService';
import type { TicketPermissions } from '@/lib/ticketPermissions';

interface Props {
  ticketId: string;
  attachments: CoreTicketAttachment[];
  permissions: TicketPermissions;
  onUploaded?: () => void;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TicketAttachments({ ticketId, attachments, permissions, onUploaded }: Props) {
  const session = authService.getSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [isInternal, setIsInternal] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setUploading(true);
    try {
      await supportTicketCoreService.uploadAttachment(
        ticketId,
        file,
        isInternal,
        session.name,
        session.userId,
        session.level,
      );
      toast.success('Anexo enviado com sucesso');
      onUploaded?.();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar anexo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDownload = async (att: CoreTicketAttachment) => {
    setDownloading(att.id);
    try {
      const url = await supportTicketCoreService.getAttachmentUrl(att.id, ticketId);
      window.open(url, '_blank');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao baixar anexo');
    } finally {
      setDownloading(null);
    }
  };

  const visibleAttachments = attachments.filter(a => {
    if (permissions.isInternal) return true;
    return !a.is_internal;
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> Anexos
            {visibleAttachments.length > 0 && (
              <span className="text-xs text-muted-foreground">({visibleAttachments.length})</span>
            )}
          </CardTitle>
          {permissions.canUploadAttachment && (
            <div className="flex items-center gap-3">
              {permissions.isInternal && (
                <div className="flex items-center gap-1.5">
                  <Switch
                    id="internal-att"
                    checked={isInternal}
                    onCheckedChange={setIsInternal}
                    className="scale-75"
                  />
                  <Label htmlFor="internal-att" className="text-xs text-muted-foreground">Interno</Label>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                {uploading ? 'Enviando...' : 'Upload'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={handleUpload}
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv,.xlsx,.docx,.zip,.7z"
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {visibleAttachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
        ) : (
          <div className="space-y-2">
            {visibleAttachments.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded group">
                <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{a.original_filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(a.file_size)}
                    {a.uploaded_by_name && ` • ${a.uploaded_by_name}`}
                    {a.is_internal && (
                      <span className="ml-1 text-orange-400">[interno]</span>
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(a)}
                  disabled={downloading === a.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {downloading === a.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
