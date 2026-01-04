import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2, Copy, X, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Badge } from '@/components/ui/badge';
import { useJobs } from '@/hooks/useJobs';
import { Job, JobStatus, Department, Seniority } from '@/types/job';

const ITEMS_PER_PAGE = 10;

const statusColors: Record<JobStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-success/20 text-success',
  closed: 'bg-destructive/20 text-destructive',
};

const statusLabels: Record<JobStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicada',
  closed: 'Encerrada',
};

const departments: Department[] = ['Comercial', 'TI', 'CS', 'Marketing', 'Adm/Fin', 'Operações'];
const seniorities: Seniority[] = ['Junior', 'Pleno', 'Senior', 'Especialista'];

export default function VagasRH() {
  const navigate = useNavigate();
  const { jobs, loading, filters, setFilters, deleteJob, duplicateJob, togglePublish, closeJob } = useJobs();
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(jobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = jobs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Vagas</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie as vagas de emprego da OPEN Datacenter
          </p>
        </div>
        <Button onClick={() => navigate('/rh/vagas/nova')}>
          <Plus className="h-4 w-4 mr-2" />
          Criar vaga
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="open-card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar vagas..."
              className="pl-10"
              value={filters.search || ''}
              onChange={(e) => {
                setFilters({ ...filters, search: e.target.value });
                setCurrentPage(1);
              }}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) => {
                setFilters({ ...filters, status: value as JobStatus | 'all' });
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="published">Publicada</SelectItem>
                <SelectItem value="closed">Encerrada</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.department || 'all'}
              onValueChange={(value) => {
                setFilters({ ...filters, department: value as Department | 'all' });
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os departamentos</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.seniority || 'all'}
              onValueChange={(value) => {
                setFilters({ ...filters, seniority: value as Seniority | 'all' });
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Senioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as senioridades</SelectItem>
                {seniorities.map((sen) => (
                  <SelectItem key={sen} value={sen}>{sen}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Endereço..."
              value={filters.address || ''}
              onChange={(e) => {
                setFilters({ ...filters, address: e.target.value });
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* Table */}
      {jobs.length === 0 ? (
        <div className="open-card flex flex-col items-center justify-center py-16">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma vaga cadastrada</h3>
          <p className="text-sm text-muted-foreground mb-4">Comece criando sua primeira vaga</p>
          <Button onClick={() => navigate('/rh/vagas/nova')}>
            <Plus className="h-4 w-4 mr-2" />
            Criar vaga
          </Button>
        </div>
      ) : (
        <div className="open-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Ações</TableHead>
                  <TableHead>Título (PT)</TableHead>
                  <TableHead className="max-w-[200px]">Descrição (PT)</TableHead>
                  <TableHead>Função (PT)</TableHead>
                  <TableHead>Título (EN)</TableHead>
                  <TableHead className="max-w-[200px]">Descrição (EN)</TableHead>
                  <TableHead>Função (EN)</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/rh/vagas/${job.id}/editar`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => duplicateJob(job.id)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir vaga?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. A vaga "{job.titlePt}" será removida permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteJob(job.id)}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        {job.status !== 'closed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => closeJob(job.id)}
                            title="Encerrar vaga"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{job.titlePt}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="line-clamp-2 text-sm text-muted-foreground">
                        {truncateText(job.descriptionPt.replace(/[#*`]/g, ''), 80)}
                      </span>
                    </TableCell>
                    <TableCell>{job.functionPt}</TableCell>
                    <TableCell>{job.titleEn}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="line-clamp-2 text-sm text-muted-foreground">
                        {truncateText(job.descriptionEn.replace(/[#*`]/g, ''), 80)}
                      </span>
                    </TableCell>
                    <TableCell>{job.functionEn}</TableCell>
                    <TableCell className="text-center">{job.totalAmount}</TableCell>
                    <TableCell>{job.address}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[job.status]}>
                          {statusLabels[job.status]}
                        </Badge>
                        {job.status !== 'closed' && (
                          <Switch
                            checked={job.status === 'published'}
                            onCheckedChange={() => togglePublish(job.id, job.status)}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(job.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, jobs.length)} de {jobs.length} vagas
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
