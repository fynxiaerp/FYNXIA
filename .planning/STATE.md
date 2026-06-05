---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-05-PLAN.md
last_updated: "2026-06-05T23:00:00.000Z"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 11
  completed_plans: 11
  percent: 100
---

# FYNXIA ERP — Project State

**Last updated:** 2026-06-05
**Updated by:** gsd-execute-phase (02-05 completion)

---

## Project Reference

**Core Value:** Um dentista deve conseguir ver a agenda do dia, registrar atendimento e fechar o caixa — tudo em menos de 3 cliques por etapa, com dados protegidos por LGPD.

**Stack:** Next.js 15 + TypeScript (strict) + Supabase (sa-east-1) + Vercel (gru1) + shadcn/ui + Tailwind v4

**Current Milestone:** M1 — Full Product (Phases 0–5)

---

## Current Position

Phase: 02 (clinical-mvp) — COMPLETE
Plan: 5 of 5 (COMPLETE)
**Phase:** 2
**Plan:** 02-05 — COMPLETE (Wave 4 / gap closure)
**Status:** Phase 2 fully complete — all 5 plans delivered (02-05 closes UAT items 6+7)

```
Progress: [██████████████████████████████] 100% (10/10 plans complete)

Phase 0 [Complete] █████
Phase 1 [Complete] █████
Phase 2 [Complete] █████
Phase 3 [Not started] ░░░░░
Phase 4 [Not started] ░░░░░
Phase 5 [Not started] ░░░░░
```

---

## Phase Summary

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 0 | Foundation | INFRA-01..07, SEC-07, SEC-08 | Not started |
| 1 | Auth & Tenant Onboarding | AUTH-01..07, SEC-01, SEC-02, SEC-05 | Not started |
| 2 | Clinical MVP | CLINIC-01..09, SEC-03, SEC-04 | Not started |
| 3 | Financial MVP | FIN-01..09, SEC-06 | Not started |
| 4 | Communications & Async | COMMS-01..04 | Not started |
| 5 | AI Agents | AI-01..03 | Not started |

---

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Requirements coverage | 47/47 | 47/47 mapped |
| Phases defined | 6 | 6 |
| Plans complete | TBD | 1 (02-01) |
| Phase 0 pitfalls resolved | 6/6 | 0/6 |

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
| Phase 6 (Dashboard/Polish) deferred to v2 | No v1 requirements map to dashboard KPIs or franchise aggregation | 2026-06-03 |
| Supabase FREE plan para MVP; sem Custom Access Token Hook | Hook é Pro-only; get_my_tenant_id()+get_my_role() SECURITY DEFINER substitui com segurança equivalente | 2026-06-03 |
| CPF plaintext; AES-256 em medical_history/allergies/medications via Server Action | CPF necessário para busca na recepção; dados de saúde nunca em plaintext no banco — ciphertext no audit log | 2026-06-05 |
| dental_records policy INSERT-only (sem UPDATE/DELETE) | Preserva integridade do histórico do odontograma; override requer service role explícito | 2026-06-05 |
| Anamnese public-token flow via service role na Server Action | Sem RLS write policy para unauthenticated inserts; validação de token single-use na camada de aplicação | 2026-06-05 |
| PENDING sentinel para signature_hash (NOT NULL constraint) | Schema exige NOT NULL; 'PENDING' satisfaz o constraint sem alterar schema; UPDATE gate inclui signature_hash='PENDING' impedindo re-write pós-assinatura (D-20) | 2026-06-05 |
| patient_id=null no agendamento público | Evita placeholder de CPF (violação unique + PII); recepcionista vincula paciente depois; dados de contato ficam em notes | 2026-06-05 |

### Critical Pre-Phase-0 Actions

- [ ] Verify Supabase project is in sa-east-1 (São Paulo) — if not, recreate before any development
- [ ] Start Meta Business verification NOW (7-14 day lead time; blocks Phase 4)
- [x] ~~Activate Supabase Pro plan~~ — MVP permanece no FREE plan; Custom Access Token Hook não é usado

### Architecture Constraints Locked

- Shared schema + RLS (not per-tenant schemas — incompatible with Supabase Realtime)
- `tenant_id` e `user_role` lidos via `get_my_tenant_id()` + `get_my_role()` SECURITY DEFINER — sem Custom Access Token Hook (Pro-only; FREE plan MVP). Upgrade path ao migrar para Pro.
- `tenant_id` stored in `public.users` (NOT `user_metadata` — user-mutable, C-5 risk)
- All caching calls must include `tenantId` in cache key array (C-3 risk)
- No service role key with `NEXT_PUBLIC_` prefix (C-2 risk)
- All connections via Supabase JS client only — no direct pg/Prisma from Vercel (C-6 risk)
- LGPD/CFO conflict strategy: anonymize patient identity on erasure request; retain clinical records 20 years (Lei 13.787/2018)
- Digital anamnesis must use ICP-Brasil-level e-signature (D4Sign recommended)

### Upgrades Pendentes (pós-validação comercial)

| Upgrade | Trigger sugerido | Benefício | Impacto no código |
|---------|-----------------|-----------|-------------------|
| Migrar Supabase FREE → Pro | Quando o produto tiver pagantes ou precisar de Auth Hooks, pg_cron, pgmq | Custom Access Token Hook: reduz 1 DB lookup por query RLS; pg_cron/pgmq: jobs agendados nativos (Phase 4) | Adicionar migration `custom_access_token_hook`, registrar no dashboard Auth > Hooks — zero mudança nas policies existentes |

### Deferred to v2

- Dashboard de franquias com agregação cross-tenant
- Relatórios BI avançados
- App mobile nativo
- NF-e fiscal (NFSe is v1 if in scope)
- TISS/ANS insurance integration
- Voice-to-text em prontuário
- NFSe para municípios além do Nacional + top-5

### Open Questions

| # | Question | Blocks | Status |
|---|----------|--------|--------|
| 1 | FullCalendar commercial license (~$500/yr) approved? | Phase 2 | Open |
| 2 | D4Sign account provisioned? | Phase 2 (CLINIC-08) | Open |
| 3 | Meta Business verification started? | Phase 4 | Open — start NOW |
| 4 | Supabase project confirmed in sa-east-1? | Phase 0 | Open — verify immediately |
| 5 | Supabase Pro plan activated? | Phase 0 | **Closed** — MVP no FREE plan; sem hook; RLS via SECURITY DEFINER |
| 6 | AI provider DPA strategy for LGPD? | Phase 5 | Open |
| 7 | NFSe scope: Nacional only or top-5 cities? | Phase 3 | Open |

---

## Session Continuity

**Stopped at:** Completed 02-05-PLAN.md

**Critical path:** Phase 0 → 1 → 2 → 4 → 5 (Phase 3 parallel with Phase 2)

**Next action:** Phase 2 fully complete including gap closure. Start Phase 3 (Financial MVP) or Phase 0 (Foundation infra). Phase 2 clinical MVP fully delivered: DB schema + RLS + migrations (02-01), patient CRUD + agenda (02-02), prontuário + odontograma + PDF (02-03), anamnese digital + agendamento público (02-04), availability-aware public booking + real anamneses tab (02-05).
