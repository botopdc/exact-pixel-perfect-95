export const OPEN_CHANGELOG_CONTENT = `# OPEN Changelog

Registro de atualizações da documentação e do sistema OPEN.

---

## 2026-03-14

### Docs Sync Engine

- **Criado:** Sistema de auto-documentação OPEN Docs Sync Engine
- **Arquivos:** \`docs_sync_runs\`, \`docs_sync_coverage\` (tabelas)
- **Páginas:** \`/docs/admin/sync\`, \`/docs/admin/changelog\`, \`/docs/admin/coverage\`, \`/docs/admin/health\`
- **Impacto:** Permite rastrear cobertura documental e histórico de sincronizações
- **Origem:** Requisito de manutenção e qualidade da wiki interna

### OPEN Data Model

- **Criado:** Documento OPEN Data Model v1
- **Arquivos:** \`src/data/docs/content/dataModel.ts\`
- **Impacto:** Referência oficial de entidades, relacionamentos, constraints e roadmap de evolução
- **Origem:** Necessidade de documentação técnica do banco de dados

### OPEN System Blueprint

- **Criado:** Documento OPEN System Blueprint v1
- **Arquivos:** \`src/data/docs/content.ts\` (seção core/open_system_blueprint)
- **Impacto:** Referência principal da arquitetura da plataforma
- **Origem:** Definição da arquitetura Supabase-first

### Runbook Supabase

- **Criado:** Runbook operacional do Supabase
- **Arquivos:** \`src/data/docs/content.ts\` (seção runbooks/supabase)
- **Impacto:** Manual de troubleshooting e recovery
- **Origem:** Necessidade operacional

---

## Formato do Changelog

Cada entrada deve conter:

| Campo | Descrição |
|-------|-----------|
| **Data** | Data da alteração (YYYY-MM-DD) |
| **Título** | Nome da mudança |
| **Arquivos** | Arquivos criados ou alterados |
| **Resumo** | O que foi feito |
| **Impacto** | Consequência da mudança |
| **Origem** | Motivação ou solicitação |
`;
