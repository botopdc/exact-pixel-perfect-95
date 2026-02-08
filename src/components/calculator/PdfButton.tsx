/**
 * PdfButton - Unified PDF button component
 * 
 * Used in both the calculator (create/edit) and proposals list
 * to ensure consistent styling and behavior.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PdfButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  /** Show as icon-only button (for lists) or full button with text (for forms) */
  variant?: 'icon' | 'full';
  tooltip?: string;
  className?: string;
}

export const PdfButton: React.FC<PdfButtonProps> = ({
  onClick,
  isLoading = false,
  disabled = false,
  variant = 'full',
  tooltip = 'Baixar PDF',
  className = '',
}) => {
  const isDisabled = disabled || isLoading;

  if (variant === 'icon') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="open-outline"
            size="icon"
            className={`h-8 w-8 ${className}`}
            onClick={onClick}
            disabled={isDisabled}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="open-outline"
      onClick={onClick}
      disabled={isDisabled}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <FileDown className="w-4 h-4 mr-2" />
      )}
      {isLoading ? 'Gerando...' : 'PDF'}
    </Button>
  );
};

export default PdfButton;
