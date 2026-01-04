export interface Article {
  id: string;
  title: string;
  content: string;
  category: ArticleCategory;
  tags: string[];
  visibility: 'private' | 'internal';
  author: string;
  status: 'draft' | 'published';
  views_count: number;
  helpful_yes: number;
  helpful_no: number;
  reading_time_minutes: number;
  created_at: string;
  updated_at: string;
}

export type ArticleCategory =
  | 'Infraestrutura'
  | 'Cloud / Virtualização'
  | 'Backup & DR'
  | 'Segurança'
  | 'E-mail'
  | 'Sistemas Operacionais'
  | 'Automação & Ferramentas'
  | 'Incidentes & Troubleshooting'
  | 'Procedimentos Internos'
  | 'Onboarding & Treinamento';

export const ARTICLE_CATEGORIES: ArticleCategory[] = [
  'Infraestrutura',
  'Cloud / Virtualização',
  'Backup & DR',
  'Segurança',
  'E-mail',
  'Sistemas Operacionais',
  'Automação & Ferramentas',
  'Incidentes & Troubleshooting',
  'Procedimentos Internos',
  'Onboarding & Treinamento',
];

export const ARTICLE_TEMPLATE = `## CONTEXTO
Descreva quando esse problema ocorre ou quando este procedimento deve ser utilizado.

## SINTOMAS
- 

## CAUSA PROVÁVEL
Explique a causa técnica do problema.

## SOLUÇÃO (PASSO A PASSO)
1.
2.
3.

## VALIDAÇÃO
Explique como confirmar que a solução funcionou corretamente.

## O QUE NÃO FAZER
Liste ações que devem ser evitadas.

## OBSERVAÇÕES
Inclua detalhes importantes, alertas ou boas práticas.
`;

export const getCategoryIcon = (category: ArticleCategory): string => {
  const icons: Record<ArticleCategory, string> = {
    'Infraestrutura': 'Server',
    'Cloud / Virtualização': 'Cloud',
    'Backup & DR': 'Database',
    'Segurança': 'Shield',
    'E-mail': 'Mail',
    'Sistemas Operacionais': 'Monitor',
    'Automação & Ferramentas': 'Wrench',
    'Incidentes & Troubleshooting': 'AlertTriangle',
    'Procedimentos Internos': 'FileText',
    'Onboarding & Treinamento': 'GraduationCap',
  };
  return icons[category];
};
