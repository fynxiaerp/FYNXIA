---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-06-05T13:53:53.857Z"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 10
  completed_plans: 6
  percent: 60
---

# FYNXIA ERP — Project State

**Last updated:** 2026-06-03
**Updated by:** gsd-roadmapper

---

## Project Reference

**Core Value:** Um dentista deve conseguir ver a agenda do dia, registrar atendimento e fechar o caixa — tudo em menos de 3 cliques por etapa, com dados protegidos por LGPD.

**Stack:** Next.js 15 + TypeScript (strict) + Supabase (sa-east-1) + Vercel (gru1) + shadcn/ui + Tailwind v4

**Current Milestone:** M1 — Full Product (Phases 0–5)

---

## Current Position

Phase: 02 (clinical-mvp) — EXECUTING
Plan: 1 of 4
**Phase:** 2
**Plan:** 02-01 — in progress (Tasks 0–2 complete; awaiting human db push at Task 3 checkpoint)
**Status:** BLOCKED — awaiting `npx supabase db push` confirmation from human

```
Progress: [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0%

Phase 0 [Not started] ░░░░░
Phase 1 [Not started] ░░░░░
Phase 2 [Not started] ░░░░░
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
| Plans complete | TBD | 0 |
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

**To resume work:** After `npx supabase db push` succeeds and types are regenerated, resume plan 02-01 Task 3 continuation.

**Critical path:** Phase 0 → 1 → 2 → 4 → 5 (Phase 3 parallel with Phase 2)

**Next action:** Human must run `npx supabase db push` to apply 3 Phase 2 clinical migrations (20260605000100, 20260605000200, 20260605000300), run post-push SQL verification, then `npx supabase gen types typescript --linked > src/types/database.types.ts`. Resume signal: type "pushed".
