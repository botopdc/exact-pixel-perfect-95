import { Briefcase, MapPin, Clock, Users } from 'lucide-react';

const placeholderJobs = [
  {
    id: 1,
    title: 'Engenheiro de Infraestrutura Cloud',
    department: 'Infraestrutura',
    location: 'São Paulo, SP',
    type: 'CLT',
    posted: '2 dias atrás',
  },
  {
    id: 2,
    title: 'Analista de Suporte N2',
    department: 'Operações',
    location: 'São Paulo, SP',
    type: 'CLT',
    posted: '5 dias atrás',
  },
  {
    id: 3,
    title: 'DevOps Engineer',
    department: 'Engenharia',
    location: 'Remoto',
    type: 'CLT',
    posted: '1 semana atrás',
  },
];

export default function VagasRH() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Vagas Abertas</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie as vagas de emprego da OPEN Datacenter
          </p>
        </div>
        <button 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          disabled
        >
          + Nova Vaga
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="open-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">3</p>
              <p className="text-sm text-muted-foreground">Vagas Ativas</p>
            </div>
          </div>
        </div>
        <div className="open-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">24</p>
              <p className="text-sm text-muted-foreground">Candidaturas</p>
            </div>
          </div>
        </div>
        <div className="open-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">5</p>
              <p className="text-sm text-muted-foreground">Em Análise</p>
            </div>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="open-card p-0 overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium text-foreground">Lista de Vagas</h3>
        </div>
        <div className="divide-y divide-border">
          {placeholderJobs.map((job) => (
            <div key={job.id} className="p-4 hover:bg-secondary/30 transition-colors cursor-pointer">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h4 className="font-medium text-foreground">{job.title}</h4>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {job.department}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {job.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {job.posted}
                    </span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium w-fit">
                  {job.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Note */}
      <p className="text-xs text-muted-foreground text-center">
        Funcionalidade em desenvolvimento. Os dados acima são apenas demonstrativos.
      </p>
    </div>
  );
}
