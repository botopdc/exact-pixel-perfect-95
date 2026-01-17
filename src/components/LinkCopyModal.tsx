import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { copyToClipboard } from "@/lib/clipboard";

interface LinkCopyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: string;
}

export function LinkCopyModal({ open, onOpenChange, link }: LinkCopyModalProps) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      // Auto-select text when modal opens
      setTimeout(() => {
        inputRef.current?.select();
      }, 100);
    }
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  const handleCopy = async () => {
    const success = await copyToClipboard(link);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSelectAll = () => {
    inputRef.current?.select();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link de Aprovação</DialogTitle>
          <DialogDescription>
            Selecione e copie o link abaixo. No Safari, toque e segure para copiar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            readOnly
            value={link}
            onClick={handleSelectAll}
            className="flex-1 text-sm"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
