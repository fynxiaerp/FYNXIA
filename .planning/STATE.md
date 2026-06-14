---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: — Produto Completo
status: executing
stopped_at: Phase 7 context gathered
last_updated: "2026-06-14T00:53:21.370Z"
last_activity: 2026-06-14
progress:
  total_phases: 15
  completed_phases: 0
  total_plans: 6
  completed_plans: 0
  percent: 0
---

# FYNXIA ERP — Project State

**Last updated:** 2026-06-13
**Updated by:** gsd-roadmapper (v2.0 roadmap created — 15 phases, 75 requirements)

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-12 after v1.0)

**Core Value:** Um dentista deve conseguir ver a agenda do dia, registrar atendimento e fechar o caixa — tudo em menos de 3 cliques por etapa, com dados protegidos por LGPD.

**Stack:** Next.js 15 + TypeScript (strict) + Supabase (sa-east-1) + Vercel (gru1) + shadcn/ui + Tailwind v4

**Current focus:** v2.0 — Produto Completo. Roadmap definido (Phases 7–21, blocos A–E, 75 requisitos). Pronto para iniciar Phase 7.

---

## Current Position

**Milestone:** v2.0 — Produto Completo (27 módulos, blocos A–E)
**Phase:** 7 — Sistema, Multiunidade & Papéis (não iniciada)
**Plan:** —
**Status:** Ready to execute
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

**Stopped at:** Phase 7 context gathered

**Critical path (v2.0):** Phase 7 → Phase 8 → Phase 9 → Phase 10 → Phase 11 → Phase 12 → Phase 13 → Phase 14 → Phase 15 → Phase 16 → Phase 17 → Phase 18 → Phase 19 → Phase 20 → Phase 21

**Parallelism opportunity:** Phase 14 (Financeiro Cadastros) pode iniciar em paralelo com Phase 13 (CME+Lab), pois ambas dependem de Phase 10 e não têm dependência entre si.

**Next action:** `/gsd-plan-phase 7` — Sistema, Multiunidade & Papéis (SYS-01..05, ROLE-01..02)
