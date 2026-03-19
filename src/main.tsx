import { createRoot } from 'react-dom/client';
import './index.css';

interface BootstrapFallbackProps {
  title: string;
  message: string;
  errorDetails?: string;
}

function BootstrapFallback({ title, message, errorDetails }: BootstrapFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        {errorDetails && (
          <pre className="mt-4 overflow-x-auto rounded-md bg-muted p-3 text-xs text-destructive whitespace-pre-wrap break-words">
            {errorDetails}
          </pre>
        )}
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('[bootstrap] Elemento #root não encontrado');
  throw new Error('Elemento #root não encontrado');
}

const root = createRoot(rootElement);

async function bootstrap() {
  console.log('[bootstrap] main.tsx start');

  try {
    const savedTheme = localStorage.getItem('open-datacenter-theme') || 'dark';
    document.documentElement.classList.add(savedTheme);
    console.log('[bootstrap] theme applied', { savedTheme });
  } catch (error) {
    console.error('[bootstrap] Failed to apply theme', error);
  }

  try {
    console.log('[bootstrap] importing App');
    const { default: App } = await import('./App');
    console.log('[bootstrap] App imported successfully');
    console.log('[bootstrap] mounting App');
    root.render(<App />);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido no bootstrap';
    const isSupabaseConfigError = /VITE_(CORE_)?SUPABASE_URL|SUPABASE/i.test(message);

    console.error('[bootstrap] Critical bootstrap failure', error);

    root.render(
      <BootstrapFallback
        title={isSupabaseConfigError ? 'Configuração Supabase ausente/inválida' : 'Falha crítica ao inicializar a aplicação'}
        message={
          isSupabaseConfigError
            ? 'A aplicação não conseguiu inicializar a camada de backend. Verifique as variáveis de ambiente do projeto.'
            : 'O bootstrap da aplicação falhou antes da montagem do Router. Veja os detalhes técnicos abaixo.'
        }
        errorDetails={message}
      />,
    );
  }
}

void bootstrap();
