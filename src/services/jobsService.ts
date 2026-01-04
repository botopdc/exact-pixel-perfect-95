import { Job, JobFormData, JobFilters, JobStatus } from '@/types/job';

const STORAGE_KEY = 'open_jobs_v1';
const DATA_SOURCE: 'localstorage' | 'api' = 'localstorage';

// Seed data
const seedJobs: Job[] = [
  {
    id: '1',
    slug: 'engenheiro-cloud-senior',
    titlePt: 'Engenheiro de Cloud Sênior',
    descriptionPt: `## Sobre a vaga\n\nBuscamos um Engenheiro de Cloud Sênior para liderar projetos de infraestrutura crítica em nosso datacenter.\n\n### Responsabilidades\n\n- Projetar e implementar soluções de cloud híbrida\n- Gerenciar ambientes Kubernetes em produção\n- Automatizar processos com Terraform e Ansible\n- Mentoria técnica para equipe júnior\n\n### Requisitos\n\n- 5+ anos de experiência com cloud (AWS, Azure, GCP)\n- Certificações relevantes (CKA, AWS Solutions Architect)\n- Experiência com containers e orquestração`,
    functionPt: 'Engenharia de Cloud',
    titleEn: 'Senior Cloud Engineer',
    descriptionEn: `## About the role\n\nWe are looking for a Senior Cloud Engineer to lead critical infrastructure projects in our datacenter.\n\n### Responsibilities\n\n- Design and implement hybrid cloud solutions\n- Manage Kubernetes environments in production\n- Automate processes with Terraform and Ansible\n- Technical mentorship for junior team\n\n### Requirements\n\n- 5+ years of cloud experience (AWS, Azure, GCP)\n- Relevant certifications (CKA, AWS Solutions Architect)\n- Experience with containers and orchestration`,
    functionEn: 'Cloud Engineering',
    address: 'São Paulo, SP',
    totalAmount: 1,
    applyUrl: 'https://open.com.br/carreiras/apply/cloud-senior',
    department: 'TI',
    seniority: 'Senior',
    workModel: 'Híbrido',
    employmentType: 'CLT',
    salaryRange: 'R$ 18.000 - R$ 25.000',
    benefits: ['Vale Refeição', 'Plano de Saúde', 'PLR', 'Home Office 3x/semana', 'Gympass'],
    status: 'published',
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-15T14:30:00Z',
  },
  {
    id: '2',
    slug: 'analista-suporte-n2',
    titlePt: 'Analista de Suporte N2',
    descriptionPt: `## Sobre a vaga\n\nProcuramos um Analista de Suporte N2 para atuar no atendimento técnico avançado aos nossos clientes enterprise.\n\n### Responsabilidades\n\n- Atendimento de chamados escalados do N1\n- Troubleshooting de redes e sistemas\n- Documentação de procedimentos\n- Participação em projetos de melhoria\n\n### Requisitos\n\n- 2+ anos em suporte técnico\n- Conhecimento em Linux e Windows Server\n- Certificação ITIL (desejável)`,
    functionPt: 'Suporte Técnico',
    titleEn: 'N2 Support Analyst',
    descriptionEn: `## About the role\n\nWe are looking for an N2 Support Analyst to provide advanced technical support to our enterprise customers.\n\n### Responsibilities\n\n- Handle escalated tickets from N1\n- Network and systems troubleshooting\n- Documentation of procedures\n- Participation in improvement projects\n\n### Requirements\n\n- 2+ years in technical support\n- Knowledge of Linux and Windows Server\n- ITIL certification (desirable)`,
    functionEn: 'Technical Support',
    address: 'São Paulo, SP',
    totalAmount: 2,
    applyUrl: 'https://open.com.br/carreiras/apply/suporte-n2',
    department: 'Operações',
    seniority: 'Pleno',
    workModel: 'Presencial',
    employmentType: 'CLT',
    salaryRange: 'R$ 5.000 - R$ 7.000',
    benefits: ['Vale Refeição', 'Plano de Saúde', 'Vale Transporte'],
    status: 'draft',
    createdAt: '2024-01-12T09:00:00Z',
    updatedAt: '2024-01-12T09:00:00Z',
  },
];

// Repository Interface (for future API implementation)
interface JobsRepository {
  getAll(): Promise<Job[]>;
  getById(id: string): Promise<Job | null>;
  getBySlug(slug: string): Promise<Job | null>;
  save(job: Job): Promise<Job>;
  remove(id: string): Promise<void>;
}

// LocalStorage Implementation
class LocalStorageJobsRepository implements JobsRepository {
  private getJobs(): Job[] {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seedJobs));
      return seedJobs;
    }
    return JSON.parse(data);
  }

  private saveJobs(jobs: Job[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }

  async getAll(): Promise<Job[]> {
    return this.getJobs().filter(j => !j.deletedAt);
  }

  async getById(id: string): Promise<Job | null> {
    const jobs = this.getJobs();
    return jobs.find(j => j.id === id && !j.deletedAt) || null;
  }

  async getBySlug(slug: string): Promise<Job | null> {
    const jobs = this.getJobs();
    return jobs.find(j => j.slug === slug && !j.deletedAt) || null;
  }

  async save(job: Job): Promise<Job> {
    const jobs = this.getJobs();
    const index = jobs.findIndex(j => j.id === job.id);
    if (index >= 0) {
      jobs[index] = job;
    } else {
      jobs.push(job);
    }
    this.saveJobs(jobs);
    return job;
  }

  async remove(id: string): Promise<void> {
    const jobs = this.getJobs();
    const index = jobs.findIndex(j => j.id === id);
    if (index >= 0) {
      jobs[index].deletedAt = new Date().toISOString();
      this.saveJobs(jobs);
    }
  }
}

// API Implementation (stub for future WordPress integration)
class ApiJobsRepository implements JobsRepository {
  private baseUrl = '/api/jobs';

  async getAll(): Promise<Job[]> {
    // TODO: Implement WordPress API call
    // const response = await fetch(this.baseUrl);
    // return response.json();
    throw new Error('API not implemented');
  }

  async getById(id: string): Promise<Job | null> {
    // TODO: Implement WordPress API call
    throw new Error('API not implemented');
  }

  async getBySlug(slug: string): Promise<Job | null> {
    // TODO: Implement WordPress API call
    throw new Error('API not implemented');
  }

  async save(job: Job): Promise<Job> {
    // TODO: Implement WordPress API call
    throw new Error('API not implemented');
  }

  async remove(id: string): Promise<void> {
    // TODO: Implement WordPress API call
    throw new Error('API not implemented');
  }
}

// Get repository based on config
const getRepository = (): JobsRepository => {
  const source: string = DATA_SOURCE;
  if (source === 'api') {
    return new ApiJobsRepository();
  }
  return new LocalStorageJobsRepository();
};

const repository = getRepository();

// Utility functions
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

// Service Functions
export const jobsService = {
  async list(filters?: JobFilters): Promise<Job[]> {
    let jobs = await repository.getAll();

    if (filters) {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        jobs = jobs.filter(j =>
          j.titlePt.toLowerCase().includes(search) ||
          j.titleEn.toLowerCase().includes(search) ||
          j.descriptionPt.toLowerCase().includes(search) ||
          j.descriptionEn.toLowerCase().includes(search)
        );
      }

      if (filters.status && filters.status !== 'all') {
        jobs = jobs.filter(j => j.status === filters.status);
      }

      if (filters.department && filters.department !== 'all') {
        jobs = jobs.filter(j => j.department === filters.department);
      }

      if (filters.address) {
        jobs = jobs.filter(j => j.address.toLowerCase().includes(filters.address!.toLowerCase()));
      }

      if (filters.seniority && filters.seniority !== 'all') {
        jobs = jobs.filter(j => j.seniority === filters.seniority);
      }
    }

    return jobs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async listPublished(): Promise<Job[]> {
    const jobs = await repository.getAll();
    return jobs
      .filter(j => j.status === 'published')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async getById(id: string): Promise<Job | null> {
    return repository.getById(id);
  },

  async getBySlug(slug: string): Promise<Job | null> {
    return repository.getBySlug(slug);
  },

  async create(data: JobFormData): Promise<Job> {
    const now = new Date().toISOString();
    const job: Job = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    return repository.save(job);
  },

  async update(id: string, data: Partial<JobFormData>): Promise<Job | null> {
    const existing = await repository.getById(id);
    if (!existing) return null;

    const updated: Job = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return repository.save(updated);
  },

  async remove(id: string): Promise<void> {
    return repository.remove(id);
  },

  async duplicate(id: string): Promise<Job | null> {
    const existing = await repository.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const duplicated: Job = {
      ...existing,
      id: generateId(),
      slug: `${existing.slug}-copy-${Date.now().toString(36)}`,
      titlePt: `${existing.titlePt} (Cópia)`,
      titleEn: `${existing.titleEn} (Copy)`,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      deletedAt: undefined,
    };
    return repository.save(duplicated);
  },

  async publish(id: string): Promise<Job | null> {
    return this.update(id, { status: 'published' });
  },

  async unpublish(id: string): Promise<Job | null> {
    return this.update(id, { status: 'draft' });
  },

  async close(id: string): Promise<Job | null> {
    return this.update(id, { status: 'closed' });
  },

  async isSlugUnique(slug: string, excludeId?: string): Promise<boolean> {
    const jobs = await repository.getAll();
    return !jobs.some(j => j.slug === slug && j.id !== excludeId);
  },

  generateSlug,

  async getPublicJson(): Promise<object[]> {
    const jobs = await this.listPublished();
    return jobs.map(job => ({
      id: job.id,
      slug: job.slug,
      title: {
        pt: job.titlePt,
        en: job.titleEn,
      },
      description: {
        pt: job.descriptionPt,
        en: job.descriptionEn,
      },
      function: {
        pt: job.functionPt,
        en: job.functionEn,
      },
      address: job.address,
      totalAmount: job.totalAmount,
      applyUrl: job.applyUrl,
      department: job.department,
      seniority: job.seniority,
      workModel: job.workModel,
      employmentType: job.employmentType,
      salaryRange: job.salaryRange || null,
      benefits: job.benefits,
      updatedAt: job.updatedAt,
    }));
  },
};
