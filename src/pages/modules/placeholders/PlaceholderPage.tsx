import React from 'react';
import { Construction, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  backUrl?: string;
}

export default function PlaceholderPage({ 
  title, 
  description, 
  icon: Icon = Construction,
  backUrl 
}: PlaceholderPageProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="p-6 rounded-full bg-muted/50 mb-6">
        <Icon className="h-16 w-16 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-muted-foreground max-w-md mb-6">{description}</p>
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-sm">
        <Construction className="h-4 w-4" />
        <span>Em desenvolvimento</span>
      </div>
      {backUrl && (
        <Button variant="ghost" className="mt-6" onClick={() => navigate(backUrl)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      )}
    </div>
  );
}
