---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: — Produto Completo
status: planning
stopped_at: Completed 07-06-PLAN.md (FINAL plan of Phase 07 — all 6 plans complete)
last_updated: "2026-06-14T03:09:46.451Z"
last_activity: 2026-06-14
progress:
  total_phases: 15
  completed_phases: 1
  total_plans: 6
  completed_plans: 6
  percent: 100
---

# FYNXIA ERP — Project State

**Last updated:** 2026-06-13
**Updated by:** gsd-roadmapper (v2.0 roadmap created — 15 phases, 75 requirements)

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-12 after v1.0)

**Core Value:** Um dentista deve conseguir ver a agenda do dia, registrar atendimento e fechar o caixa — tudo em menos de 3 cliques por etapa, com dados protegidos por LGPD.

**Stack:** Next.js 15 + TypeScript (strict) + Supabase (sa-east-1) + Vercel (gru1) + shadcn/ui + Tailwind v4

**Current focus:** Phase 07 — Sistema, Multiunidade & Papéis

---

## Current Position

Phase: 07 (Sistema, Multiunidade & Papéis) — EXECUTING
Plan: 6 of 6 (COMPLETE)
**Milestone:** v2.0 — Produto Completo (27 módulos, blocos A–E)
**Phase:** 8
**Plan:** Not started
**Status:** Ready to plan
**Last activity:** 2026-06-14

---

## Phase Summary

| Phase | Name | Block | Requirements | Status |
|-------|------|-------|--------------|--------|
| 7 | Sistema, Multiunidade & Papéis | A | SYS-01..05, ROLE-01..02 | Not started |
| 8 | Documentos & Assinatura ICP-Brasil | A | DOC-01..03 | Not started |
| 9 | Hub de Integrações Externas | A | INT-01..03 | Not started |
| 10 | IA Governada, Auditoria & OCR | A | AIG-01..03, AUD-01..03, OCR-01..02 | Not started |
| 11 | Profissionais & Recursos | B | PRO-01..03, RES-01..03 | Not started |
| 12 | Receituário & Teleodontologia | B | RX-01..03, TEL-01..02 | Not started |
| 13 | Esterilização/CME & Laboratório de Prótese | B | CME-01..03, LAB-01..02 | Not started |
| 14 | Financeiro — Cadastros Base | C | FCAD-01..02 | Not started |
| 15 | Faturamento/NFS-e & Convênios/TISS | C | OS-01..03, CONV-01..03 | Not started |
| 16 | Contas a Pagar, Conciliação & Tributos | C | FOP-01..03, TRIB-01..03 | Not started |
| 17 | Estoque & Materiais | D | EST-01..03 | Not started |
| 18 | CRC & Marketing | D | CRC-01..05 | Not started |
| 19 | Relatórios, Orçamento & BI | E | REP-01..03, BI-01..02 | Not started |
| 20 | Portal do Paciente & App do Profissional | E | POR-01..03, APP-01..03 | Not started |
| 21 | Migração & Ensino | E | MIG-01..02, EDU-01..03 | Not started |

---

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Requirements coverage | 75/75 | 75/75 mapped |
| Phases defined | 15 | 15 |
| Plans complete | TBD | 0 |
| Phases complete | 15 | 0 |

---
| Phase 07 P01 | 64 | 4 tasks | 7 files |
| Phase 07 P02 | 35 | 3 tasks | 6 files |
| Phase 07 P03 | 75 | 3 tasks | 8 files |
| Phase 07 P04 | — | db push | 0 files |
| Phase 07 P05 | 45 | 3 tasks | 8 files |
| Phase 07 P06 | 14 | 3 tasks | 11 files |

## Accumulated Context

### Key Decisions Made

| Decision | Rationale | Date |
|----------|-----------|------|
| Upgrade to Next.js 15 (not 14 as in PROJECT.md) | Opt-in caching model better for ERP freshness; Turbopack dev; use cache directive | 2026-06-02 |
| Use @supabase/ssr (not deprecated auth-helpers-nextjs) | Current official package; required for Server Components auth | 2026-06-02 |
| Pin Zod to v3 | hookform/resolvers v5.x has active edge-case issues with Zod v4; migrate after resolvers stabilizes | 2026-06-02 |
| Asaas via REST API directly (no SDK) | Community SDKs unmaintained; control over error handling and idempotency | 2026-06-02 |
| Resend over SendGrid | SendGrid killed free tier mid-2025; Resend has React Email native support | 2026-06-02 |
| Meta WhatsApp Cloud API only (no Evolution API/Baileys) | ToS violation; existential risk for healthcare SaaS | 2026-06-02 |
| @react-pdf/renderer (no Puppeteer) | Puppeteer binary ~100MB; Vercel function limit 50MB | 2026-06-02 |
| Phase 3 runs parallel to Phase 2 | Shares Phase 1 patient data model; accelerates financial validation | 2026-06-03 |
| Supabase FREE plan para MVP; sem Custom Access Token Hook | Hook é Pro-only; get_my_tenant_id()+get_my_role() SECURITY DEFINER substitui com segurança equivalente | 2026-06-03 |
| CPF plaintext; AES-256 em medical_history/allergies/medications via Server Action | CPF necessário para busca na recepção; dados de saúde nunca em plaintext no banco | 2026-06-05 |
| dental_records policy INSERT-only (sem UPDATE/DELETE) | Preserva integridade do histórico do odontograma | 2026-06-05 |
| Anamnese public-token flow via service role na Server Action | Sem RLS write policy para unauthenticated inserts; token single-use na camada de aplicação | 2026-06-05 |
| Provider-agnostic financial schema: provider TEXT DEFAULT 'asaas' | Evita lock-in no schema; future Stripe/outros gateways adicionam sem DDL change | 2026-06-06 |
| No stored vencido: status CHECK ('pendente','pago','estornado') only | vencido derivado em read-time de due_date vs NOW() | 2026-06-06 |
| webhook_events sem RLS: service-role only | Tabela global de dedup de webhooks; nenhum path de cliente acessa | 2026-06-06 |
| COMMS-04 via outbox pattern (not pgmq): message_outbox + Vercel Cron | pgmq/pg_cron são Supabase Pro-only; adapter troca no upgrade Pro | 2026-06-07 |
| AI SDK v6 tool() uses inputSchema not parameters | RESEARCH Assumption A1 confirmed incorrect; confirmed from installed node_modules type defs | 2026-06-10 |
| AI-03 LLM personalization sends only first name + amount | No CPF/health data to LLM; ZDR enabled; fallback to neutral static message when key absent | 2026-06-11 |
| Fixed-width sidebar (w-[240px]/w-[56px]) + Zustand — no shadcn sidebar installed | shadcn sidebar has Tailwind-v4 width bug (06-RESEARCH Pitfall 1) | 2026-06-12 |
| v2.0 Bloco A (SYS+ROLE+DOC+INT+AIG+AUD+OCR) entregue antes de Clínico e Financeiro | Prontuário/receituário/NFS-e precisam de ICP (DOC); faturamento/convênios precisam do hub de integrações (INT); agentes precisam do framework IA L0–L4 | 2026-06-13 |
| Granularidade standard: 15 fases para 75 requisitos | Cada fase cobre 1–2 módulos acoplados; shippable/plannable independentemente | 2026-06-13 |
| audit_units_changes() dedicado (não reutiliza audit_table_changes()) | units usa clinic_id, não tenant_id — mesmo padrão do audit_clinics_changes() | 2026-06-14 |
| get_my_unit_ids() retorna UUID[] (array) | Suporte a usuários em múltiplas filiais (dentistas volantes em redes/franquias) | 2026-06-14 |
| unit_id em operational tables: NULLABLE→backfill→NOT NULL | Pitfall 2: SET NOT NULL apenas após backfill para não quebrar linhas existentes | 2026-06-14 |
| Unit-level RLS em linhas operacionais deferido para fase futura | Esta fase apenas adiciona a coluna; enforcement de SYS-05 será construído sobre ela | 2026-06-14 |
| routeToModule() usa array ordenado (ROUTE_MODULE_MAP): /clinica/financeiro antes de /clinica | Garante módulo mais específico vence na resolução de rota para isReadOnly() | 2026-06-14 |
| ROLE_ROUTES derivado de MODULE_PERMISSIONS via deriveRoleRoutes() | Fonte única de verdade; compat com testes rbac.test.ts existentes | 2026-06-14 |
| forge.pki.certificateToAsn1(cert) em vez de cert.toAsn1() | cert objects em node-forge 1.4.0 não possuem método toAsn1() — API pública correta é pki module | 2026-06-14 |
| Partial unique indexes (WHERE unit_id IS NULL / IS NOT NULL) em ai_agent_config | UNIQUE(clinic_id,agent_key,unit_id) não deduplica rows com unit_id=NULL no PostgreSQL (NULLs são distinct) | 2026-06-14 |
| __mocks__/server-only.js + setup.ts: pre-register no-op no require.cache | vi.mock() só intercepta ESM imports; CJS require() precisa de patch direto no require.cache | 2026-06-14 |
| Constantes extraídas de ai-agent-config.ts para ai-agent-config-types.ts | Next.js 'use server' só permite exports async; AUTONOMY_LEVELS/AGENT_KEYS são consts — runtime falha se exportadas de arquivo 'use server' | 2026-06-14 |
| getCertificate seleciona colunas explicitamente + CertificatePublic = Omit<CertRow, 'cert_password_enc' \| 'storage_path'> | Dupla proteção: omissão em query + garantia de compile-time; secrets nunca chegam ao cliente (T-07-18) | 2026-06-14 |
| @base-ui Select.Root onValueChange recebe (value: T \| null, eventDetails) | API do base-ui difere de shadcn puro; handler deve guard against null para satisfazer TypeScript | 2026-06-14 |

### Architecture Constraints Locked

- Shared schema + RLS (not per-tenant schemas — incompatible with Supabase Realtime)
- `tenant_id` e `user_role` lidos via `get_my_tenant_id()` + `get_my_role()` SECURITY DEFINER
- All caching calls must include `tenantId` in cache key array (C-3 risk)
- No service role key with `NEXT_PUBLIC_` prefix (C-2 risk)
- ICP-Brasil signing via certificado A1 cadastrado em SYS-02 (Phase 7); DOC (Phase 8) consome
- Hub de integrações (Phase 9) é o único ponto de gestão de credenciais externas
- Agentes IA operam dentro dos limites L0–L4 configurados em SYS-04 (Phase 7)
- LGPD/CFO: anonymize patient identity on erasure; retain clinical records 20 years (Lei 13.787/2018)

### Upgrades Pendentes (pós-validação comercial)

| Upgrade | Trigger sugerido | Benefício | Impacto no código |
|---------|-----------------|-----------|-------------------|
| Migrar Supabase FREE → Pro | Quando tiver pagantes ou precisar de Auth Hooks, pg_cron, pgmq | Custom Access Token Hook; pg_cron/pgmq nativos | Migration `custom_access_token_hook` + dashboard Auth > Hooks |
| NFS-e: municípios além do Nacional | Volume justificar | Cobertura de mais prefeituras | Adapter no hub de integrações (Phase 9) |

### Open Questions

| # | Question | Blocks | Status |
|---|----------|--------|--------|
| 1 | FullCalendar commercial license (~$500/yr) approved? | Phase 11 | Open |
| 2 | Provedor de assinatura ICP-Brasil definido (D4Sign, Certisign, BirdSign)? | Phase 8 | Open — definir antes de iniciar Phase 8 |
| 3 | Meta Business verification concluída? | Phase 4 (v1 pendente) / Phase 18 | Open — iniciar imediatamente |
| 4 | Conta Asaas sandbox ativa? | Phase 3 (v1 UAT) / Phase 15 | Open — necessário para testes NFS-e |
| 5 | Supabase Pro plan a ativar? | Phase 7+ | Open — avaliar timing pós-primeiros pagantes |
| 6 | AI provider DPA strategy para LGPD (agentes v2)? | Phase 10 | Open |
| 7 | Municípios alvo para NFS-e: Nacional apenas ou top-5? | Phase 15 | Open |
| 8 | Provedor de teleconsulta (vídeo CFO-compliant): Whereby, Daily.co ou outro? | Phase 12 | Open — definir antes de iniciar Phase 12 |

---

## Session Continuity

**Stopped at:** Completed 07-06-PLAN.md (FINAL plan of Phase 07 — all 6 plans complete)

**Phase 07 STATUS: COMPLETE** — SYS-01..05 + ROLE-01..02 all delivered:

- SYS-01: Empresa + Unidades CRUD (Plan 05)
- SYS-02: Certificado ICP-Brasil keystore (Plan 06)
- SYS-03: Perfis de Acesso matrix UI (Plan 06)
- SYS-04: Autonomia IA L0–L4 config (Plan 06)
- SYS-05: Multi-unit schema (unit_id on operational tables) (Plans 01–04)
- ROLE-01: 11-role RBAC matrix in proxy.ts (Plan 03)
- ROLE-02: assertNotReadOnly + x-read-only header + read-only gates (Plans 01, 03, 05, 06)

**Critical path (v2.0):** Phase 8 → Phase 9 → Phase 10 → Phase 11 → Phase 12 → Phase 13 → Phase 14 → Phase 15 → Phase 16 → Phase 17 → Phase 18 → Phase 19 → Phase 20 → Phase 21

**Parallelism opportunity:** Phase 14 (Financeiro Cadastros) pode iniciar em paralelo com Phase 13 (CME+Lab), pois ambas dependem de Phase 10 e não têm dependência entre si.

**Next action:** `/gsd-plan-phase 8` — Documentos & Assinatura ICP-Brasil (DOC-01..03)
