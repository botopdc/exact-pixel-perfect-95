import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, MapPin, Clock, Building2, ExternalLink, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Job, Department, Seniority, WorkModel } from '@/types/job';
import { jobsService } from '@/services/jobsService';
import OpenLogo from '@/components/OpenLogo';

const departments: Department[] = ['Comercial', 'TI', 'CS', 'Marketing', 'Adm/Fin', 'Operações'];
const seniorities: Seniority[] = ['Junior', 'Pleno', 'Senior', 'Especialista'];
const workModels: WorkModel[] = ['Presencial', 'Híbrido', 'Remoto'];

export default function VagasPublic() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    department: 'all',
    seniority: 'all',
    workModel: 'all',
  });

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await jobsService.listPublished();
      setJobs(data);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (
        !job.titlePt.toLowerCase().includes(search) &&
        !job.titleEn.toLowerCase().includes(search) &&
        !job.descriptionPt.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    if (filters.department !== 'all' && job.department !== filters.department) return false;
    if (filters.seniority !== 'all' && job.seniority !== filters.seniority) return false;
    if (filters.workModel !== 'all' && job.workModel !== filters.workModel) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-6">
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

      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Faça parte do time OPEN
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Estamos sempre em busca de talentos excepcionais para construir o futuro da infraestrutura de datacenter no Brasil.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar vagas..."
                className="pl-10"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg border border-border bg-card">
              <Select
                value={filters.department}
                onValueChange={(value) => setFilters({ ...filters, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os departamentos</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.seniority}
                onValueChange={(value) => setFilters({ ...filters, seniority: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Senioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as senioridades</SelectItem>
                  {seniorities.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.workModel}
                onValueChange={(value) => setFilters({ ...filters, workModel: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Modelo de trabalho" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os modelos</SelectItem>
                  {workModels.map((w) => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhuma vaga encontrada
            </h3>
            <p className="text-muted-foreground">
              Não há vagas disponíveis com os filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {filteredJobs.length} vaga{filteredJobs.length !== 1 ? 's' : ''} encontrada{filteredJobs.length !== 1 ? 's' : ''}
            </p>
            
            {filteredJobs.map((job) => (
              <Link
                key={job.id}
                to={`/vagas/${job.slug}`}
                className="block p-6 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {job.titlePt}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {job.descriptionPt.replace(/[#*`-]/g, '').substring(0, 200)}...
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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
                    </div>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{job.seniority}</Badge>
                      <Badge variant="outline">{job.employmentType}</Badge>
                    </div>
                    {job.salaryRange && (
                      <span className="text-sm font-medium text-primary">
                        {job.salaryRange}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} OPEN Datacenter. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
