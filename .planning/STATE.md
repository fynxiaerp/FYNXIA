---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-02 (AI Copilot Backend)
last_updated: "2026-06-11T01:46:38.239Z"
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 24
  completed_plans: 21
  percent: 88
---

# FYNXIA ERP — Project State

**Last updated:** 2026-06-10
**Updated by:** gsd-execute-phase (05-02 complete; advancing to 05-03)

---

## Project Reference

**Core Value:** Um dentista deve conseguir ver a agenda do dia, registrar atendimento e fechar o caixa — tudo em menos de 3 cliques por etapa, com dados protegidos por LGPD.

**Stack:** Next.js 15 + TypeScript (strict) + Supabase (sa-east-1) + Vercel (gru1) + shadcn/ui + Tailwind v4

**Current Milestone:** M1 — Full Product (Phases 0–5)

---

## Current Position

Phase: 05 (ai-agents) — EXECUTING
Plan: 3 of 5
**Phase:** 5
**Plan:** 05-03 (Wave 3 — Copilot UI)
**Status:** Executing Phase 05

```
Progress: [██████████] 83% (20/24 plans complete)

Phase 0 [Complete] █████
Phase 1 [Complete] █████
Phase 2 [Complete] █████
Phase 3 [Complete] █████
Phase 4 [In progress] ██░░░ (2/4 plans — Wave 2 next)
Phase 5 [In progress] █░░░░ (1/5 plans complete)
```

---

## Phase Summary

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 0 | Foundation | INFRA-01..07, SEC-07, SEC-08 | Not started |
| 1 | Auth & Tenant Onboarding | AUTH-01..07, SEC-01, SEC-02, SEC-05 | Not started |
| 2 | Clinical MVP | CLINIC-01..09, SEC-03, SEC-04 | Not started |
| 3 | Financial MVP | FIN-01..09, SEC-06 | Complete |
| 4 | Communications & Async | COMMS-01..04 | Not started |
| 5 | AI Agents | AI-01..03 | Not started |

---

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Requirements coverage | 47/47 | 47/47 mapped |
| Phases defined | 6 | 6 |
| Plans complete | TBD | 13 (03-02 latest) |
| Phase 0 pitfalls resolved | 6/6 | 0/6 |

---
| Phase 03 P03-03 | 20 | 3 tasks | 19 files |
| Phase 03 P04 | 68 | 3 tasks | 12 files |
| Phase 04 P02 | 290 | 3 tasks | 7 files |
| Phase 04 P04-03 | 8 | 2 tasks | 2 files |
| Phase 04 P04-04 | 9 | 3 tasks | 5 files |
| Phase 05 P05-02 | 18 | 3 tasks | 7 files |

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
| Provider-agnostic financial schema (D-01): provider TEXT DEFAULT 'asaas' | Evita lock-in no schema; future Stripe/outros gateways adicionam sem DDL change; provider_charge_id/provider_installment_id como colunas genéricas | 2026-06-06 |
| No stored vencido (D-04): status CHECK ('pendente','pago','estornado') only | vencido derivado em read-time de due_date vs NOW(); evita estados stale por clock-skew no banco | 2026-06-06 |
| webhook_events sem RLS (T-3-04 aceito): service-role only, sem tenant_id | Tabela global de dedup de webhooks; nenhum path de cliente acessa; handler usa createAdminClient (Plan 02) | 2026-06-06 |
| Supabase CLI re-auth gotcha documentado | db push requer CLI logado na org FYNXIA (kczvihafddupruvsrrsc); padrão recorrente em todo checkpoint [BLOCKING] db push | 2026-06-06 |
| No z.default() in Zod schemas with RHF zodResolver | .default() makes fields optional in input type causing resolver type mismatch; use RHF defaultValues instead | 2026-06-06 |
| @base-ui render-prop pattern (no asChild anywhere) | Button render={<Link/>}, PopoverTrigger render={<button/>}, Accordion multiple prop — confirmed from PatientForm.tsx; no Radix asChild in this project | 2026-06-06 |
| Lazy Resend singleton (getResend() factory) | new Resend(undefined) throws at module-eval time during next build static analysis; lazy factory defers instantiation to first runtime call; backward-compat wrapper preserves .emails.send() interface | 2026-06-06 |
| Static CSP via next.config.ts headers() (no nonce) | Nonce-based CSP forces full dynamic render on every page — counterproductive for ERP with many SSR pages; unsafe-inline accepted for internal ERP (no third-party scripts, documented in RESEARCH §A3) | 2026-06-06 |
| COMMS-04 via outbox pattern (not pgmq): message_outbox + OutboxQueue + Vercel Cron | pgmq/pg_cron are Supabase Pro-only; message_outbox table (Plan 04-01) + MessageQueue interface (Plan 04-02) + Cron trigger (Plan 04-04) deliver same outcome; pgmq adapter swaps in at Pro upgrade behind interface seam | 2026-06-07 |
| No client UPDATE/DELETE policy on message_outbox | Worker uses createAdminClient (service role) for all status transitions; prevents tenant tampering with send state (T-4-outbox-T); mirrors webhook_events pattern from Plan 03-01 | 2026-06-07 |
| WhatsApp client call-time credential reads (not module scope) | WHATSAPP_* env vars read inside sendTemplateMessage() — same lazy pattern as getResend(); returns graceful error when absent; never throws at next build | 2026-06-07 |
| isPermanentError([131026, 132000, 132001, 190]) no-retry gate | Permanent Meta errors mark outbox row failed immediately; transient (130429, network) remain pending for next cron run | 2026-06-07 |
| Worker email branch generic html-send with TODO(Plan 04) marker | AppointmentReminderEmail import deferred to Plan 04 to keep 04-02 independent of 04-03 in Wave 2; email branch compiles and tests pass | 2026-06-07 |
| AI SDK v6 tool() uses inputSchema not parameters | RESEARCH Assumption A1 confirmed incorrect; @ai-sdk/provider-utils Tool type uses inputSchema: FlexibleSchema<INPUT>; confirmed from installed node_modules type defs | 2026-06-10 |
| maskCPF for copilot keeps LAST 2 digits (***.***.***-XX) | PatientTable.tsx keeps first 3 (123.***.***-**) for reception display; copilot masking is more aggressive per D-01 — last 2 verifier digits only | 2026-06-10 |

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

**Stopped at:** Completed 05-02 (AI Copilot Backend)

**Critical path:** Phase 0 → 1 → 2 → 4 → 5 (Phase 3 parallel with Phase 2)

**Next action:** Execute 05-03-PLAN.md (Wave 3 — Copilot UI: CopilotTrigger, CopilotSidebar, useChat wiring, suggested prompts).

**05-02 delivered:** AI SDK v6 installed (ai@6.0.200, @ai-sdk/react@3.0.202, @ai-sdk/gateway@3.0.127); src/lib/ai/masking.ts (maskCPF keeps last 2 digits, maskPhone keeps last 4); src/lib/ai/help-docs.ts (8 pt-BR topics + searchHelpDocs); src/lib/ai/tools.ts (4 read-only RLS-scoped tools: getTodayAppointments, getOverdueReceivables, getPatientSummary, searchHelpDocsTool); src/app/api/copilot/route.ts (streamText + Gateway model anthropic/claude-sonnet-4.6 + ZDR + 401 auth gate + call-time key read). tools.test.ts 12/12 + chat-route.test.ts 9/9 GREEN; tsc exit 0; next build clean. Key deviation: AI SDK v6 tool() uses inputSchema (not parameters) — RESEARCH A1 confirmed; source-inspection tests matched forbidden words in comments — rephrased.

**05-01 delivered:** agent_outreach_log + whatsapp_inbound_events tables live in Supabase sa-east-1; SELECT-only RLS on agent_outreach_log (tenant isolation, no client write); wamid UNIQUE dedup on whatsapp_inbound_events (no RLS, service-role only); 5 Wave 0 test scaffolds (ai.test.ts 13/13 GREEN; 4 ai/* RED-by-design via source-inspection). database.types.ts regenerated; tsc clean. Deviation: direct-import scaffolds converted to source-inspection style to keep tsc green across waves. Checkpoint: Supabase CLI re-auth required (recurring gotcha).

**04-01 delivered:** message_outbox durable queue table + message_log reminder dedup table live in Supabase sa-east-1 (enums, UNIQUE idempotency_key, UNIQUE (appointment_id,channel,type), composite drain index, tenant_id indexes); RLS policies (USING+WITH CHECK via get_my_tenant_id(); no client UPDATE/DELETE on outbox); 5 Wave 0 TDD scaffolds (comms.test.ts 11/11 GREEN; 4 comms/* RED-by-design); database.types.ts regenerated. Deviation: ES2017 dotAll /s regex flag fixed in whatsapp.test.ts scaffold. Checkpoint: Supabase CLI re-auth required (recurring gotcha).

**03-03 delivered:** formatBRL/deriveReceivableStatus helpers, createTransaction/listTransactions/listCategories/listReceivables Server Actions, Financeiro hub card + module hub, fluxo-de-caixa page (CashFlowTotals + TransactionList + TransactionModal), contas-a-receber page (ReceivablesTable with client-side vencido via deriveReceivableStatus + Accordion installment grouping), nova-cobranca page (ChargeForm wired to createCharge + PixQRDisplay with base64 QR). 23/23 plan tests GREEN; tsc exit 0; next build clean. Key lessons: no z.default() with RHF resolver; @base-ui uses render prop not asChild.

**03-02 delivered:** PaymentGateway interface + AsaasAdapter (D-01), asaasFetch typed client (server-only), chargeSchema Zod v3, createCharge Server Action (PIX QR, boleto, installments mirrored to N receivables, customer dedup via asaas_customer_id), cancelCharge, idempotent webhook handler (token validation → 401, upsert dedup, fire-and-forget processWebhookEvent, income auto-post, refund reversal). charges.test.ts + asaas.test.ts 15/15 GREEN. tsc --noEmit exit 0. Task 4 (live sandbox) deferred to UAT — tracked in 03-HUMAN-UAT.md.

**03-01 delivered:** 7 financial tables live in Supabase sa-east-1, provider-agnostic schema, RLS with USING+WITH CHECK on 6 tenant-scoped tables, audit trigger on financial_transactions reusing Phase 2 audit_table_changes(), 10 seeded dental categories, webhook_events dedup table, 7 Wave 0 test scaffolds (financial.test.ts 13/13 GREEN; 6 RED awaiting downstream plans), regenerated database.types.ts.
