# Milestones

## v1.0 MVP (Shipped: 2026-06-12)

**Phases completed:** 7 phases (0–6), 32 plans, 85 tasks
**Effort:** 282 commits · 407 files · +76k lines · 10 days (2026-06-02 → 2026-06-12)
**Requirements:** 47/47 v1 requirements delivered
**Live:** [fynxia.vercel.app](https://fynxia.vercel.app) (Vercel gru1 + Supabase sa-east-1)

**Key accomplishments:**

- **Phase 0 — Foundation:** Multi-tenant-safe base on Next.js 15 + Supabase. `get_my_tenant_id()` / `get_my_role()` SECURITY DEFINER RLS (FREE-plan compatible, no Auth Hook), three Supabase client factories, `getUser()` middleware, AES-256 crypto, immutable audit_logs, gru1 region — all 6 critical pitfalls (C-1..C-6) resolved before feature code.
- **Phase 1 — Auth & Tenant Onboarding:** Full auth lifecycle (signup creates clinic+user atomically with rollback, login/logout/password-reset), RBAC role matrix for admin/dentist/receptionist/patient/superadmin, tenant isolation verified in production, CPF/email masking via `users_masked` view, `patient_consents` (LGPD), Resend-branded email invites + direct create.
- **Phase 2 — Clinical MVP:** Five clinical tables with GIST anti-double-booking + LGPD soft-delete + audit triggers; patient CRUD with AES-256 health-field encryption + anonymization; FullCalendar multi-dentist agenda; prontuário + interactive FDI odontogram (32 teeth, 9 statuses); digital anamnesis (signature_pad + SHA-256 + single-use token); public booking link with atomic slot locking.
- **Phase 3 — Financial MVP:** Provider-agnostic 7-table financial schema + PaymentGateway abstraction with AsaasAdapter (PIX QR / boleto / installments); idempotent webhook auto-posting income to cash flow; BRL cash-flow view, receivables with read-time `vencido` derivation + installment grouping; PDF receipts via @react-pdf/renderer.
- **Phase 4 — Communications & Async:** Outbox pattern (`message_outbox` durable queue + `MessageQueue` interface + Vercel Cron worker, replacing Pro-only pg_cron/pgmq); Meta WhatsApp Cloud API + Resend email; appointment reminders + collection automation; fail-closed cron auth + atomic claim against duplicate sends.
- **Phase 5 — AI Agents:** Contextual copilot sidebar (Vercel AI Gateway + AI SDK v6, read-only tenant-scoped tools + PII masking + ZDR); appointment-confirmation agent via WhatsApp with sender-phone-bound inbound webhook (cross-tenant-safe); AI-personalized collection agent (first-name + amount only to the LLM).
- **Phase 6 — UX Polish & App Shell:** Dual-theme design system (light clinical default + dark/neon brand) on FYNXIA brand tokens (Space Grotesk + Inter, cyan accent, WCAG-AA), persistent collapsible sidebar app shell replacing the passthrough layout, shared PageHeader + loading/empty/error states, full screen-by-screen token sweep across every module — UI audit 15/24 → production-grade.

**Known gaps / deferred to UAT (gated on external setup, not code):**
- Asaas live sandbox/PIX verification — no Asaas account yet (abstraction + idempotent webhook complete).
- Meta WhatsApp template approval + Business verification — code path complete, awaits Meta.
- AI Gateway live calls — needs `AI_GATEWAY_API_KEY`; cron needs `CRON_SECRET` (fail-closed without it).
- Visual UAT of the new theme/navigation/brand in the browser.

---
