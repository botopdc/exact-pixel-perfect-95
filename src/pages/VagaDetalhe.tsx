import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Building2, Clock, Briefcase, ExternalLink, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Job } from '@/types/job';
import { jobsService } from '@/services/jobsService';
import OpenLogo from '@/components/OpenLogo';

export default function VagaDetalhe() {
  const { slug } = useParams<{ slug: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadJob();
  }, [slug]);

  const loadJob = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const data = await jobsService.getBySlug(slug);
      if (data && data.status === 'published') {
        setJob(data);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (text: string) => {
    return text
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-3 text-foreground">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-8 mb-4 text-foreground">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4 text-foreground">$1</h1>')
      .replace(/^\- (.*$)/gim, '<li class="ml-4 text-muted-foreground">$1</li>')
      .replace(/\*\*(.*)\*\*/gim, '<strong class="text-foreground">$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\n\n/gim, '<br/><br/>');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <Link to="/vagas" className="flex items-center gap-3">
              <OpenLogo className="h-8" />
            </Link>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Vaga não encontrada</h1>
          <p className="text-muted-foreground mb-8">A vaga que você procura não existe ou não está mais disponível.</p>
          <Button asChild>
            <Link to="/vagas">Ver todas as vagas</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <OpenLogo className="h-8" />
            </Link>
            <nav className="flex items-center gap-4">
              <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
                Home
              </Link>
              <Link to="/vagas" className="text-sm text-primary font-medium">
                Carreiras
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Back button */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <Button variant="ghost" asChild>
          <Link to="/vagas">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para vagas
          </Link>
        </Button>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-4">{job.titlePt}</h1>
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {job.department}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {job.address}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {job.workModel}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(job.updatedAt)}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="prose prose-sm prose-invert max-w-none">
              <div
                className="text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(job.descriptionPt) }}
              />
            </div>

            {/* Benefits */}
            {job.benefits.length > 0 && (
              <div className="pt-6 border-t border-border">
                <h3 className="text-lg font-semibold text-foreground mb-4">Benefícios</h3>
                <div className="flex flex-wrap gap-2">
                  {job.benefits.map((benefit, index) => (
                    <Badge key={index} variant="secondary">
                      {benefit}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="p-6 rounded-lg border border-border bg-card sticky top-6">
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Função</span>
                  <span className="text-sm font-medium text-foreground">{job.functionPt}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Senioridade</span>
                  <Badge variant="secondary">{job.seniority}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Contrato</span>
                  <Badge variant="outline">{job.employmentType}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Vagas</span>
                  <span className="text-sm font-medium text-foreground">{job.totalAmount}</span>
                </div>
                {job.salaryRange && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Faixa salarial</span>
                    <span className="text-sm font-medium text-primary">{job.salaryRange}</span>
                  </div>
                )}
              </div>

              <Button asChild className="w-full" size="lg">
                <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Candidatar-se
                </a>
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} OPEN Datacenter. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
