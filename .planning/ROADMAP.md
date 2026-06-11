# FYNXIA ERP — Roadmap

**Project:** FYNXIA Multi-Tenant Dental ERP SaaS
**Granularity:** Standard (6 phases)
**Coverage:** 47/47 v1 requirements mapped
**Last updated:** 2026-06-03

---

## Phases

- [x] **Phase 0: Foundation** — DB schema, RLS (via get_my_tenant_id()+get_my_role() SECURITY DEFINER), middleware, Supabase client factories. Resolves all 6 critical pitfalls before any feature code. FREE plan compatible.
- [x] **Phase 1: Auth & Tenant Onboarding** — Complete auth flow (login/logout/register), RBAC enforcement, tenant provisioning, user invite. Gates all downstream modules.
- [x] **Phase 2: Clinical MVP** — Patient management, multi-dentist appointment calendar, prontuario, odontogram, digital anamnesis with e-signature, online booking link.
- [x] **Phase 3: Financial MVP** — Cash flow, Pix/boleto via Asaas, accounts receivable, installments, automated collection sequence, PDF receipts.
- [x] **Phase 4: Communications & Async** — WhatsApp Cloud API, Resend email, pg_cron + pgmq background jobs, appointment reminders, collection automation.
- [ ] **Phase 5: AI Agents** — Copilot sidebar (Vercel AI Gateway), appointment confirmation agent, collection agent.

---

## Phase Details

### Phase 0: Foundation
**Goal**: The project infrastructure is secure, multi-tenant-safe, and ready for feature development — all 6 critical pitfalls are resolved before a single feature module is written.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, SEC-07, SEC-08
**Success Criteria** (what must be TRUE):
  1. `get_my_tenant_id()` SECURITY DEFINER function exists and is referenced by every RLS policy — no RLS policy queries the users table directly (prevents infinite recursion C-1)
  2. `get_my_tenant_id()` e `get_my_role()` SECURITY DEFINER confirmados com `prosecdef=true` no banco live — tenant/role isolation funcional sem Custom Access Token Hook (FREE plan)
  3. No direct PostgreSQL connections exist in the codebase — only the Supabase JS client is used, routed through PostgREST + Supavisor (C-6 closed)
  4. `SUPABASE_SERVICE_ROLE_KEY` is absent from any `NEXT_PUBLIC_` env var and absent from `.next/static/` build output (C-2 closed)
  5. All timestamp columns across all tables are `TIMESTAMPTZ`, all sensitive health-data columns use AES-256 encryption, and Vercel `vercel.json` declares `regions: ["gru1"]`
**Plans**: 3 plans
- [ ] 00-PLAN-01.md — Next.js 15 scaffold, three Supabase clients, secure middleware (getUser), AES-256 crypto, gru1 region
- [ ] 00-PLAN-02.md — SQL migrations: tenants/users/audit_logs schema, get_my_tenant_id() + get_my_role() SECURITY DEFINER + RLS policies (FREE plan — sem hook)
- [ ] 00-PLAN-03.md — [BLOCKING] schema push, type gen, RLS verification script, checklist região/prosecdef/C-2

### Phase 1: Auth & Tenant Onboarding
**Goal**: Clinic administrators can register their clinic, invite team members, and every user can log in and operate within their own isolated tenant — RBAC is enforced end-to-end.
**Depends on**: Phase 0
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, SEC-01, SEC-02, SEC-05
**Success Criteria** (what must be TRUE):
  1. Admin can register a new clinic (tenant), receive a verification email, and complete onboarding — a new row exists in `public.clinics` and their JWT carries the correct `tenant_id`
  2. Admin can invite a dentist by email; dentist receives invite link, sets password, logs in, and can only see data belonging to their clinic (tenant isolation verified)
  3. Middleware uses `getUser()` (not `getSession()`) — a crafted JWT with a foreign `tenant_id` is rejected at the middleware layer before reaching any route handler (C-4 closed)
  4. CPF, e-mail, and phone are masked in all list views and logs — raw values are never exposed in API responses for list endpoints
  5. Every role (admin, dentist, receptionist, patient) can log in; routing enforces role-appropriate access — a receptionist cannot access admin routes
**Plans**: 3 plans
- [x] 01-01-PLAN.md — DB foundation: rename tenants→clinics (+CNPJ/phone), invitations + patient_consents tables, hybrid audit trigger, users_masked view, July/Aug partitions, [BLOCKING] db push + type gen
- [x] 01-02-PLAN.md — Auth lifecycle: signup (clinic + CPF/CNPJ), login/logout/password-reset, /auth/confirm, RBAC role matrix in proxy.ts, FYNXIA-branded auth pages (RHF + Zod v3)
- [x] 01-03-PLAN.md — Invite lifecycle: Resend-branded email invite + direct create, /invite/[token] accept (24h single-use), patient self-register API, admin team page, business-event audit
**UI hint**: yes

### Phase 2: Clinical MVP
**Goal**: A dentist can complete the full clinical workflow in one session — book an appointment, register the patient, document the visit in the prontuario, update the odontogram, and have the patient sign the anamnesis digitally.
**Depends on**: Phase 1
**Requirements**: CLINIC-01, CLINIC-02, CLINIC-03, CLINIC-04, CLINIC-05, CLINIC-06, CLINIC-07, CLINIC-08, CLINIC-09, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. Receptionist can view the weekly calendar by dentist, create an appointment in an available slot, and the system rejects a double-booking attempt at the database level (EXCLUDE USING GIST constraint fires)
  2. Dentist can open a patient chart, write a prontuario entry with diagnosis and treatment plan, and update the interactive odontogram with tooth-level status — all changes appear in the patient's chronological history
  3. Patient (or receptionist on behalf) completes the digital anamnesis form and signs electronically — timestamp, IP, and consent version are recorded; the record is immutable (soft delete only on `patients` via `deleted_at`)
  4. Any write to `patients`, `appointments`, or `medical_records` triggers the audit log — a test update produces a new row in `audit_logs` with actor, table, row ID, and change diff
  5. Patient can use a public booking link to request an appointment without logging in — request appears in the clinic's queue for receptionist confirmation
**Plans**: 4 plans
- [x] 02-01-PLAN.md — Migrations clinicas (patients/appointments/medical_records/dental_records/anamneses) + btree_gist + EXCLUDE GIST + audit triggers + RLS + [BLOCKING] db push
- [x] 02-02-PLAN.md — CRUD de pacientes (encrypt AES-256, anonimizacao LGPD) + agenda FullCalendar por dentista com tratamento de double-booking
- [x] 02-03-PLAN.md — Prontuario clinico + odontograma SVG FDI (9 status) + PDF do prontuario (@react-pdf/renderer)
- [x] 02-04-PLAN.md — Anamnese digital (canvas + SHA-256 + token single-use) + link de agendamento publico
- [x] 02-05-PLAN.md — [gap closure] disponibilidade no agendamento publico (getBookedSlots + datetime offset) + aba Anamneses real (listAnamneses + AnamnesisList)
**UI hint**: yes

### Phase 3: Financial MVP
**Goal**: The clinic can issue payment requests via Pix and boleto, track all receivables, and generate a PDF receipt — the cash flow view reflects real-time payment status without manual intervention.
**Depends on**: Phase 1 (tenant context), Phase 2 (patient data model)
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04, FIN-05, FIN-06, FIN-07, FIN-08, FIN-09, SEC-06
**Success Criteria** (what must be TRUE):
  1. Receptionist can generate a Pix payment link via Asaas for a patient; patient pays; Asaas webhook fires; DB status updates to "paid" automatically — no manual reconciliation required
  2. Receptionist can generate a boleto for a patient and track installment status — each parcel shows due date and payment status (pendente/pago/vencido) in the accounts receivable view
  3. Cash flow view displays current month income vs. expense with correct totals — a newly launched transaction appears in the view within one page refresh
  4. Receptionist can generate and download a PDF receipt for a completed payment — PDF renders correctly with clinic name, patient, amount, and date using `@react-pdf/renderer`
  5. Asaas webhook handler returns HTTP 200 immediately for every incoming event and processes payment updates asynchronously with idempotency — a duplicate webhook for the same payment does not create a duplicate credit entry. Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) are present on all responses.
**Plans**: 4 plans
- [x] 03-01-PLAN.md — Financial DB foundation: 7 tables + patients.asaas_customer_id + RLS + SEC-03 audit trigger + category seed + Wave 0 tests + [BLOCKING] db push
- [x] 03-02-PLAN.md — Asaas integration: PaymentGateway abstraction + adapter, createCharge (PIX/boleto/installments), idempotent webhook; 15/15 unit tests GREEN; live sandbox verification deferred to UAT (03-HUMAN-UAT.md)
- [x] 03-03-PLAN.md — Financial UI: cash flow, receivables (read-time vencido + installment accordion), Nova Cobranca form, Financeiro hub card
- [x] 03-04-PLAN.md — Collection ruler (Vercel Cron + Resend, idempotent), PDF receipt (ReceiboPDF), SEC-06 security headers
**UI hint**: yes

### Phase 4: Communications & Async
**Goal**: The system automatically sends appointment reminders and collection messages without any manual trigger — async jobs run reliably on schedule using database-native queuing.
**Depends on**: Phase 2 (appointments), Phase 3 (financial_transactions)
**Requirements**: COMMS-01, COMMS-02, COMMS-03, COMMS-04
**Success Criteria** (what must be TRUE):
  1. A patient with an appointment tomorrow receives a WhatsApp reminder via Meta Cloud API at the scheduled time (24h prior) — no manual action required from clinic staff
  2. A patient with an appointment tomorrow also receives an email reminder via Resend — the email renders using the React Email template with correct appointment details
  3. A patient with an overdue balance receives an automated collection message via WhatsApp at the cadence configured for the collection sequence — message uses the correct Asaas-linked payment link
  4. All outbound messaging jobs are enqueued via pgmq and processed by pg_cron workers — a job failure does not crash the app and retries without duplicate sends; WhatsApp templates are categorized as utility (not marketing) to avoid Meta reclassification
**Plans**: 4 plans
- [x] 04-01-PLAN.md — DB foundation: message_outbox + message_log (RLS, dedup) + 5 Wave 0 test scaffolds + [BLOCKING] db push
- [x] 04-02-PLAN.md — WhatsApp Cloud API client (no SDK) + MessageQueue/OutboxQueue + outbox worker + E.164 normalizer
- [x] 04-03-PLAN.md — AppointmentReminderEmail (React Email) + pure reminder-scan selection logic
- [x] 04-04-PLAN.md — reminder-dispatch cron (scan+enqueue+drain) + D-05 collection WhatsApp channel + vercel.json + WHATSAPP_* env

### Phase 5: AI Agents
**Goal**: Clinic staff have an AI copilot available on every screen that answers contextual questions about the clinic's data, and autonomous agents handle appointment confirmations and overdue collection without human intervention.
**Depends on**: Phase 4 (pgmq queues running), Phase 2 (clinical data), Phase 3 (financial data)
**Requirements**: AI-01, AI-02, AI-03
**Success Criteria** (what must be TRUE):
  1. Copilot sidebar is accessible from any page in the app — a staff member can ask "Quais consultas tenho hoje?" and receive a correct, tenant-scoped answer via Vercel AI Gateway without exposing raw patient data to the AI provider
  2. The appointment confirmation agent autonomously sends a WhatsApp confirmation request to patients with appointments the next day and records the patient's confirm/cancel reply in the appointments table — no manual trigger required
  3. The collection agent autonomously identifies patients with overdue balances, sends a personalized payment message via WhatsApp with the Asaas payment link, and logs the outreach in the audit trail — staff can see which patients were contacted and when
**Plans**: 5 plans
- [x] 05-01-PLAN.md — DB foundation: agent_outreach_log + whatsapp_inbound_events migrations + 5 Wave 0 scaffolds + [BLOCKING] db push
- [x] 05-02-PLAN.md — Copilot backend: AI SDK v6 install + read-only tenant-scoped tools (PII masked) + help/FAQ tool + chat Route Handler (ZDR)
- [ ] 05-03-PLAN.md — Copilot sidebar UI: Sheet + useChat (v6) + trigger in clinica/layout + context prompts (read-only)
- [ ] 05-04-PLAN.md — AI-02 inbound WhatsApp webhook (HMAC + dedup + status) + confirmation agent send side + audit
- [ ] 05-05-PLAN.md — AI-03 collection agent (LLM text + real Asaas link) + agent outreach log page /clinica/ia/agentes
**Waves**: W1=05-01 · W2=05-02 · W3=05-03,05-04 · W4=05-05

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Foundation | 3/3 | Complete | 2026-06-05 |
| 1. Auth & Tenant Onboarding | 3/3 | Complete | 2026-06-05 |
| 2. Clinical MVP | 5/5 | Complete | 2026-06-05 |
| 3. Financial MVP | 4/4 | Complete | 2026-06-06 (FIN-09 live verify pending UAT) |
| 4. Communications & Async | 4/4 | Complete | 2026-06-08 (live WhatsApp/email pending UAT — Meta verification) |
| 5. AI Agents | 0/? | Not started | - |

---

## Coverage Map

| Requirement | Phase |
|-------------|-------|
| INFRA-01 | Phase 0 |
| INFRA-02 | Phase 0 |
| INFRA-03 | Phase 0 |
| INFRA-04 | Phase 0 |
| INFRA-05 | Phase 0 |
| INFRA-06 | Phase 0 |
| INFRA-07 | Phase 0 |
| SEC-07 | Phase 0 |
| SEC-08 | Phase 0 |
| AUTH-01 | Phase 1 |
| AUTH-02 | Phase 1 |
| AUTH-03 | Phase 1 |
| AUTH-04 | Phase 1 |
| AUTH-05 | Phase 1 |
| AUTH-06 | Phase 1 |
| AUTH-07 | Phase 1 |
| SEC-01 | Phase 1 |
| SEC-02 | Phase 1 |
| SEC-05 | Phase 1 |
| CLINIC-01 | Phase 2 |
| CLINIC-02 | Phase 2 |
| CLINIC-03 | Phase 2 |
| CLINIC-04 | Phase 2 |
| CLINIC-05 | Phase 2 |
| CLINIC-06 | Phase 2 |
| CLINIC-07 | Phase 2 |
| CLINIC-08 | Phase 2 |
| CLINIC-09 | Phase 2 |
| SEC-03 | Phase 2 |
| SEC-04 | Phase 2 |
| FIN-01 | Phase 3 |
| FIN-02 | Phase 3 |
| FIN-03 | Phase 3 |
| FIN-04 | Phase 3 |
| FIN-05 | Phase 3 |
| FIN-06 | Phase 3 |
| FIN-07 | Phase 3 |
| FIN-08 | Phase 3 |
| FIN-09 | Phase 3 |
| SEC-06 | Phase 3 |
| COMMS-01 | Phase 4 |
| COMMS-02 | Phase 4 |
| COMMS-03 | Phase 4 |
| COMMS-04 | Phase 4 |
| AI-01 | Phase 5 |
| AI-02 | Phase 5 |
| AI-03 | Phase 5 |

**Total mapped: 47/47**

---

## Critical Path

`Phase 0 → Phase 1 → Phase 2 → Phase 4 → Phase 5`

Phase 3 runs in parallel with Phase 2 (shares patient data model from Phase 1).

## Open Questions (Pre-Implementation)

These must be resolved before or during the corresponding phase:

| # | Question | Blocks | Deadline |
|---|----------|--------|----------|
| 1 | FullCalendar commercial license (~$500/yr) approved? | Phase 2 | Before Phase 2 kickoff |
| 2 | D4Sign (e-signature) account provisioned? | Phase 2 (CLINIC-08) | Before Phase 2 kickoff |
| 3 | Meta Business verification started? | Phase 4 | Start at Phase 1 kickoff |
| 4 | Supabase project confirmed in sa-east-1? | Phase 0 | Immediately |
| 5 | Supabase Pro plan activated (pg_cron, pgmq, Auth Hooks)? | Phase 0 | Immediately |
| 6 | AI provider DPA strategy for LGPD (Anthropic Enterprise or prompt sanitization)? | Phase 5 | Before Phase 5 kickoff |
| 7 | NFSe scope: Nacional only or top-5 cities? | Phase 3 (if in v1) | Before Phase 3 kickoff |
