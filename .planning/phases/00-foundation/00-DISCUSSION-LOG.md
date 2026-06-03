# Phase 0: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 00-foundation
**Areas discussed:** Schema, Criptografia, Scaffold, CI/CD

---

## Schema — Escopo das Tabelas

| Option | Description | Selected |
|--------|-------------|----------|
| Só as tabelas core | tenants, users, audit_logs — mínimo para RLS e JWT Hook | ✓ |
| Todas as tabelas de uma vez | Schema completo (12+ tabelas) na Fase 0 | |

**User's choice:** Só as tabelas core (Recomendado)
**Notes:** Tabelas de módulos (patients, appointments, etc.) criadas nas fases correspondentes.

---

## Schema — Convenção de Nomes

| Option | Description | Selected |
|--------|-------------|----------|
| Plural em inglês | tenants, users, patients, appointments, medical_records | ✓ |
| Singular em inglês | tenant, user, patient, appointment | |
| Plural em português | clinicas, usuarios, pacientes, agendamentos | |

**User's choice:** Plural em inglês (Recomendado)

---

## Criptografia — Onde Implementar AES-256

| Option | Description | Selected |
|--------|-------------|----------|
| Aplicação (Next.js) | Criptografar/descriptografar no servidor antes de salvar | ✓ |
| Banco (pg_crypto) | pgp_sym_encrypt() no PostgreSQL | |
| Híbrida | Campos pesquisados no banco, blobs sensíveis na aplicação | |

**User's choice:** Aplicação (Next.js) — Recomendado
**Notes:** Mantém RLS sobre colunas em texto claro (permite indexação/filtragem), protege dados de saúde em repouso.

---

## Criptografia — Armazenamento da Chave

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel Environment Variables | Secret no painel Vercel, server-side apenas | ✓ |
| Supabase Vault | Armazena secrets criptografados no banco | |

**User's choice:** Vercel Environment Variables (Recomendado)

---

## Scaffold — Método de Inicialização

| Option | Description | Selected |
|--------|-------------|----------|
| create-next-app + shadcn/ui init | npx create-next-app@latest + npx shadcn@latest init | ✓ |
| Template oficial Supabase Next.js | Template com @supabase/ssr pré-configurado | |
| T3 Stack (create-t3-app) | Next.js + tRPC + Prisma — não usa Supabase nativamente | |

**User's choice:** create-next-app + shadcn/ui init (Recomendado)

---

## Scaffold — Estrutura de Pastas

| Option | Description | Selected |
|--------|-------------|----------|
| (dashboard)/ com subpastas por módulo | Route groups com layout compartilhado | ✓ |
| Flat: src/app/clinica/, /financeiro/ | Sem route groups | |
| Feature-first: src/features/clinica/ | Components, hooks e utils colocalizados | |

**User's choice:** (dashboard)/ com subpastas por módulo (Recomendado)

---

## CI/CD — O Que Validar

| Option | Description | Selected |
|--------|-------------|----------|
| Build + typecheck + lint | next build + tsc --noEmit + eslint — sem testes de banco | ✓ |
| Build + typecheck + testes RLS | Inclui pgTAP para validar isolamento de tenants no CI | |
| Só build pass | Mínimo válido — tipos e lint manuais | |

**User's choice:** Build + typecheck + lint (Recomendado)

---

## CI/CD — Plataforma

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel Preview Deployments | Preview URL por PR, build + typecheck incluídos | ✓ |
| GitHub Actions + Vercel | GitHub Actions para testes/lint, Vercel para deploy | |

**User's choice:** Vercel Preview Deployments (Recomendado)

---

## Claude's Discretion

- Configuração do tema shadcn/ui (cores, radius) — defaults neutros
- ESLint rules além de `next/core-web-vitals` — config standard recommended
- Conteúdo exato do `vercel.json` além de regions e function config
- Exact matcher pattern do `middleware.ts`

## Deferred Ideas

- **HTML prototype layout for evaluation** — Frontend UI, pertence à Fase 1/2 (ambas com `UI hint: yes`). Anotar para `/gsd-ui-phase 1` ou `/gsd-ui-phase 2`.
- **GitHub Actions com testes RLS** — Diferido para Fase 1 quando auth flow existir para gerar JWTs reais
