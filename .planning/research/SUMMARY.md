# Research Summary: FYNXIA Dental ERP SaaS

**Project:** FYNXIA -- Multi-Tenant Dental ERP SaaS (Brazil)
**Synthesized:** 2026-06-02
**Research files:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md
**Overall Confidence:** HIGH (stack + architecture verified via official docs; LGPD/CFO regulatory details MEDIUM)

---

## 1. Executive Summary

FYNXIA is a multi-tenant dental clinic ERP targeting the Brazilian market, where regulatory, payment, and communication requirements differ sharply from generic SaaS patterns. The research confirms that the planned Next.js + Supabase stack is the right foundation, but with several non-negotiable deviations from the original PROJECT.md baseline: upgrade to Next.js 15 (not 14), use @supabase/ssr (not deprecated auth-helpers-nextjs), and pin Zod to v3 (v4 has active resolver compatibility issues). Every table must carry a tenant_id column enforced by RLS, and all JWT-based tenant context must be injected via the Custom Access Token Hook at login -- not derived from mutable user_metadata.

Brazilian compliance is the most underestimated risk surface. WhatsApp is not a convenience feature -- it is the primary patient communication channel and reminders directly recover 32-45% of no-show revenue. Digital anamnesis with e-signature is a legal requirement under CFO Resolution 91/2009, not a differentiator. NFSe emission is required for any clinic operating with a CNPJ. CFO mandates 20-year retention of dental records under Lei 13.787/2018, which conflicts directly with LGPD right-to-erasure and requires a deliberate anonymization-not-deletion strategy from day one of schema design.

The architecture must follow a strict 6-layer build order (DB schema -> RLS -> Custom Access Token Hook -> middleware -> Supabase clients -> feature modules). Six critical pitfalls identified in research must be resolved in Phase 0 before any feature code ships; each one causes either irreversible cross-tenant data leakage or complete application failure that is painful to diagnose. The recommended phase structure is: Foundation -> Auth/Tenant -> Clinical MVP (parallel with Financial MVP) -> Async/Communications -> AI Agents -> Advanced Features.
---

## 2. Recommended Stack

| Layer | Package / Service | Version | Rationale |
|-------|-------------------|---------|-----------|
| Framework | Next.js | 15.x | Opt-in caching model (ERP data freshness); use cache directive; Turbopack dev |
| Runtime | TypeScript | 5.x strict | noUncheckedIndexedAccess catches ERP table access bugs |
| Database + Auth | Supabase | sa-east-1 (Sao Paulo) | RLS, Realtime, Storage, Auth, Cron, Queues in one platform |
| Hosting | Vercel | Pro plan, gru1 region | Co-located with Supabase SA; gru1 requires Pro plan |
| Auth client | @supabase/ssr | latest | Replaces deprecated auth-helpers-nextjs |
| UI primitives | shadcn/ui + Tailwind CSS | v4 | Tailwind v4 CSS-first config; shadcn/ui CLI updated |
| Data tables | TanStack Table v8 | v8 | De facto ERP standard; headless, typed |
| Server state | TanStack Query v5 | v5 | Cache invalidation via Supabase Realtime; DevTools |
| URL state | nuqs | latest | Filter/sort/page in URL; shareable ERP views |
| Client UI state | Zustand | latest | Modals, sidebars, bulk selection only |
| Forms | React Hook Form v7 + Zod v3 | RHF v7 / Zod 3.x | Zod v4 has active hookform/resolvers edge-case bugs |
| PDF generation | @react-pdf/renderer v4 | 4.x | Puppeteer exceeds Vercel 50MB limit; this library is <2MB |
| Calendar | FullCalendar Scheduler | latest | Multi-dentist resource views require commercial license (~$500/yr) |
| WhatsApp | Meta WhatsApp Cloud API | official | Evolution API / Baileys violate ToS; number ban risk is existential |
| Email | Resend + React Email | latest | SendGrid eliminated free tier mid-2025 |
| Patient payments | Asaas REST API (direct) | -- | Native Pix/boleto/card; community SDKs are unmaintained |
| SaaS billing | Stripe Billing | latest | Subscription management; PIX Automatico available in Brazil |
| Background jobs | Supabase pg_cron + pgmq + Edge Functions | -- | Scheduled + event-triggered + long-running tiers |
| Error tracking | Sentry | latest | SDK in Next.js + Edge Functions |

**Hard do-nots:** Puppeteer on Vercel / Evolution API / Baileys / @supabase/auth-helpers-nextjs / service role key in NEXT_PUBLIC_ prefix / per-tenant DB schemas / SendGrid / getSession() in middleware.
---

## 3. Table Stakes Features for v1

Features without which clinics will not switch or will churn within 30 days.

### Clinical Module

| Feature | Compliance Note |
|---------|----------------|
| Multi-dentist appointment calendar with status workflow | -- |
| Patient registration (CPF, contact, health data) | CPF is primary identifier; LGPD requires consent at registration |
| Interactive odontogram (per-tooth status + procedures) | CFO standard; required in electronic prontuario |
| Clinical records / prontuario with per-visit notes | CFO Resolution 91/2009; ICP-Brasil e-signature for legal validity |
| Treatment plan with budget and approval tracking | Core clinical-to-financial handoff |
| Digital anamnesis with e-signature | LEGAL REQUIREMENT (CFO); not optional |
| Automated WhatsApp reminders (24h, two-way confirm/cancel) | Highest ROI automation; 32-45% no-show reduction |
| Document upload (consent forms, X-rays as files) | Storage in Supabase private buckets with RLS |
| Online booking link (public, self-service) | -- |
| RBAC: Admin / Dentist / Receptionist roles | -- |

### Financial Module

| Feature | Compliance Note |
|---------|----------------|
| Accounts receivable linked to treatment plan | -- |
| Pix with auto-confirmation (baixa automatica) | Dominant payment method in Brazil; mandatory |
| Boleto bancario generation + tracking | Still required for corporate / installment scenarios |
| Credit card via payment link (Asaas) | -- |
| Installment plan control per patient | Most dental treatments are paid in parcelas |
| Dentist commission calculation per procedure | -- |
| Cash flow view (income vs expense, period filter) | -- |
| Receipt / recibo PDF generation | @react-pdf/renderer; not Puppeteer |
| Inadimplencia dashboard (receivables aging) | -- |
| Automated collection sequence (regua de cobranca) | Highest-ROI financial automation; builds on WhatsApp integration |
| Accounts payable (supplier invoices, recurring bills) | -- |
| NFSe emission (NFSe Nacional standard) | LEGALLY REQUIRED for CNPJ clinics; Certificate A1 needed |

### Compliance (non-negotiable schema from day 1)

| Requirement | Implementation |
|-------------|----------------|
| LGPD consent tracking | patient_consents table with consent type, policy version, IP, timestamp |
| Immutable audit log | audit_logs table; RLS blocks DELETE and UPDATE |
| Soft delete | deleted_at on all patient and clinical tables |
| 20-year record retention | Anonymize identity on erasure request; retain clinical facts |
| TIMESTAMPTZ on all timestamps | Brazil has 4 time zones; TIMESTAMP causes scheduling bugs |
| CPF masking in listings | LGPD data minimization in UI |

### Defer to v2+

- TISS / ANS insurance integration (complex XML, per-insurer rules)
- Native mobile app (PWA responsive covers clinic usage)
- Full bank reconciliation (auto-match all bank transactions)
- AI clinical note generation (voice to text)
- Patient portal / app
- Multi-unit franchise consolidated reporting (architecture supports it from day 1; UI deferred)
- Lab/prosthetics order management
- CRM campaign builder
---

## 4. Critical Architecture Decisions

### Multi-Tenancy

Shared schema + RLS + JWT Custom Claims. Do not use per-tenant schemas (incompatible with Supabase Realtime and PostgREST) or per-tenant databases (cost-prohibitive, no cross-tenant analytics for franchise dashboards).

Every tenant-scoped table gets:
- tenant_id UUID NOT NULL with a btree index
- RLS policy using (select auth.jwt() ->> tenant_id)::uuid -- the select wrapper caches the result per statement (5-15% overhead vs 100x overhead without it)
- Both USING and WITH CHECK clauses in every RLS policy

### JWT Custom Claims

Inject tenant_id and user_role at token issuance via the Custom Access Token Hook -- a PostgreSQL function registered in Supabase Auth settings. This makes RLS read from the cached JWT (zero extra DB queries per request).

- tenant_id source: public.users table (NOT user_metadata -- user-mutable)
- app_metadata sync: SECURITY DEFINER trigger on public.users INSERT

### Build Order (Phase 0 -- wrong order causes rework)

1. DB schema + migrations
2. RLS policies (test before any feature code)
3. Custom Access Token Hook (must exist before any login is tested)
4. middleware.ts (all protected routes depend on this)
5. Supabase client factories (server.ts, client.ts, middleware.ts)

### Background Jobs (Three-Tier)

| Need | Tool |
|------|------|
| Scheduled (reminders, billing sweeps) | Supabase pg_cron -> pgmq |
| Event-triggered async (WhatsApp sends, payment processing) | pgmq queue -> Edge Function |
| Fire-and-forget post-response (audit enrichment, analytics) | Next.js after() |

Do not use Vercel Cron as the sole job scheduler -- pg_cron is database-native and survives Vercel cold start cycles.

### Realtime

Start with Postgres Changes for the appointments table (1-10 concurrent dentists is fine). Switch to Broadcast at 30-40 concurrent subscribers. Channel naming: tenant:{tenant_id}:{topic}. RLS must be configured on realtime.messages -- channels are public by default.

### Caching

All unstable_cache calls must include tenantId in the cache key array. A missing tenantId is a cross-tenant data breach that bypasses RLS (the cache layer has no awareness of RLS policies).

- Correct: pass tenantId as explicit function argument; include in key array as ['patients-' + tenantId]
- Wrong: tenantId closed over in async function body -- invisible to cache key, different tenants receive same cached result

### Double-Booking Prevention

Use a PostgreSQL EXCLUDE USING GIST constraint with the btree_gist extension. The second concurrent insert fails at the DB level regardless of application-layer race conditions. Do not rely solely on application-layer availability checks.
---

## 5. Phase 0 Must-Do List

These 6 critical issues plus supporting items must be resolved before any feature code ships. Each one causes either complete application failure or silent cross-tenant data leakage that is difficult to diagnose and costly to remediate.

### C-1: RLS Self-Reference Infinite Recursion

**Problem:** A policy on the users table that queries the users table causes PostgreSQL stack overflow on every authenticated request. Error message is cryptic (stack depth limit exceeded).

**Fix:** Create a SECURITY DEFINER function get_my_tenant_id() that bypasses RLS for the internal lookup. The policy calls the function, not the table directly.

### C-2: Service Role Key Must Not Reach the Client Bundle

**Problem:** Any file importing the service role key that is reachable from a use client component, or any env var prefixed NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY, exposes a key that bypasses all RLS. Direct LGPD Article 46 violation; mandatory ANPD breach notification.

**Fix:** Add import server-only to every admin Supabase utility. Env var name: SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix). Post-build check: grep -r NEXT_PUBLIC_SUPABASE_SERVICE .next/static/ must return nothing.

### C-3: unstable_cache Must Include tenantId in Cache Key

**Problem:** Closing over tenantId instead of passing it as a function argument makes it invisible to Next.js cache key computation. Tenant A data gets served to Tenant B. RLS is bypassed because the DB query never runs (cached result is served).

**Fix:** Always pass tenant-scoped values as explicit function arguments. Cache key array must include all dimensions: [resource, tenantId, ...otherDimensions]. Treat every unstable_cache call as a security review checkpoint, not just a performance decision.

### C-4: Use getUser() Not getSession() in Middleware

**Problem:** getSession() validates JWT format and expiry but does NOT verify authenticity against the Supabase Auth server. A crafted JWT with a modified tenant_id passes the session check.

**Fix:** Use supabase.auth.getUser() in middleware and all Server Components for authorization decisions. getSession() is only appropriate when you need the raw access token to pass to a third-party API.

### C-5: Store tenant_id in public.users, Not in user_metadata

**Problem:** user_metadata is writable by any authenticated user via the client SDK. A user can set { tenant_id: other-clinic-uuid } and gain full access to another clinic dataset. Complete multi-tenancy collapse.

**Fix:** tenant_id lives in public.users (authoritative source). JWT claims sourced from Custom Access Token Hook reading public.users. If syncing to auth metadata, use app_metadata only (service-role write only). Never derive tenant context from user_metadata.

### C-6: Use Supabase JS Client Only -- No Direct pg Connections

**Problem:** Direct pg or Prisma connections from Vercel serverless functions each open a new Postgres connection. 100 concurrent requests = 100 connections. Morning peak at a busy clinic exhausts the pool (200 connections on free tier, 500 on Pro), causing cascading 500 errors across all modules.

**Fix:** Use only the Supabase JS client (routes through PostgREST + Supavisor pooler). Never connect directly to port 5432 from Vercel Functions.

### Additional Phase 0 Checklist

- [ ] All timestamp columns are TIMESTAMPTZ (Brazil has 4 time zones; TIMESTAMP causes booking bugs for Manaus/Acre clinics)
- [ ] patient_consents table in initial migration (LGPD Article 8: demonstrable consent requires type, policy version, IP, timestamp, revocation date)
- [ ] audit_logs table with FOR DELETE USING (false) + FOR UPDATE USING (false) RLS policies
- [ ] LGPD + CFO conflict strategy documented: anonymize patient identity on erasure request; retain clinical records for 20 years (Lei 13.787/2018)
- [ ] Supabase project region verified as sa-east-1 (Sao Paulo) -- verify before any development starts
- [ ] Vercel vercel.json with regions: [gru1] (mismatched regions = 300-600ms latency penalty per DB query)
- [ ] EXCLUDE USING GIST constraint for double-booking prevention in appointments table
- [ ] Realtime channels named tenant:{tenant_id}:{topic}; RLS configured on realtime.messages
- [ ] Middleware cookie passthrough pattern for JWT refresh (avoids multi-tab logout race condition)
- [ ] Asaas webhook handler returns HTTP 200 immediately; processes async (15 consecutive failures pauses entire payment queue)
---

## 6. Open Questions Requiring Decisions

| # | Question | Impact | Recommended Path |
|---|----------|--------|-----------------|
| 1 | FullCalendar commercial license: Is the ~$500/yr scheduler license pre-approved in budget? | Blocks multi-dentist calendar view | Decide before Phase 1. Fallback: react-big-calendar (MIT) lacks native multi-resource columns. |
| 2 | NFSe scope for v1: Which cities must be covered at launch? NFSe Nacional covers the national standard; legacy municipal formats need separate integrations. | Defines integration complexity for Phase 3 | Decide top-5 target cities; build NFSe Nacional first, add per-city layouts as demand is confirmed. |
| 3 | E-signature provider: CFO Resolution 91/2009 requires ICP-Brasil-level e-signature. Build native vs. integrate D4Sign / DocuSign Brazil? | Legal validity of all clinical records | Integrate D4Sign for v1 (ICP-Brasil certified, Brazilian DPA); build native in v2. |
| 4 | Zod v3 vs v4: Research recommends v3 but hookform/resolvers v5.2.0 claims v4 support with active edge-case issues. | Form validation stability across 27+ form schemas | Pin to Zod v3 now; migrate to v4 when resolver support stabilizes per release notes. |
| 5 | AI provider DPA for copilot: OpenAI standard API has no DPA. Sending patient data (even pseudonymized) is LGPD Articles 33-36 territory. | Legal exposure for Phase 5 AI features | Evaluate Anthropic Enterprise (has BAA equivalent) or implement strict prompt sanitization. |
| 6 | Meta Business verification timeline: WhatsApp Cloud API requires ~1-2 weeks verification; templates need 7-14 days pre-approval. | Phase 4 launch gating | Start Meta verification process at Phase 1 kickoff, not when Phase 4 begins. |
| 7 | Existing Supabase project region: PROJECT.md says Supabase is already created. Was it created in sa-east-1 (Sao Paulo)? | 300-600ms latency for all DB queries if wrong | Verify immediately. If not sa-east-1, create a new project before development starts. |

---

## 7. Research Confidence Summary

| Area | Confidence | Basis | Gaps |
|------|------------|-------|------|
| Next.js 15 + App Router patterns | HIGH | Official docs + makerkit.dev production patterns | None |
| Supabase SSR auth patterns | HIGH | Official @supabase/ssr docs | None |
| RLS multi-tenancy | HIGH | Official Supabase docs + production case studies | None |
| TanStack Query v5 + Supabase | HIGH | Official docs + Supabase blog | None |
| PDF generation on Vercel | HIGH | Verified size constraints + production comparison | None |
| Payment integrations (Asaas, Stripe) | HIGH | Official Asaas docs; Stripe PIX April 2025 changelog | Asaas webhook edge cases inferred from docs |
| WhatsApp Cloud API | HIGH | Official Meta developer docs | Template approval timelines vary |
| FullCalendar licensing | HIGH | Official FullCalendar license page | Budget approval needed |
| Background jobs (pg_cron, pgmq) | HIGH | Official Supabase Cron and Queues docs | None |
| Vercel gru1 + Fluid Compute | HIGH | Official Vercel regions docs; default since April 2025 | None |
| Zod v4 + hookform/resolvers | MEDIUM | Active GitHub issues; resolvers v5.2.0 claims support but edge cases remain | Monitor resolvers releases |
| Tailwind v4 + shadcn/ui | MEDIUM | Recently released; shadcn/ui CLI updated | Verify shadcn/ui changelog before Phase 0 setup |
| LGPD healthcare compliance | MEDIUM | ANPD official sources + Brazilian legal analysis | No ANPD enforcement precedents specific to dental ERPs found |
| CFO 20-year retention (Lei 13.787/2018) | MEDIUM | Law confirmed; CFO Opinion 125/92 also found | Formal legal opinion recommended before v1 launch |
| Asaas webhook penalization recovery | MEDIUM | Official Asaas docs; queue reactivation confirmed | Manual recovery steps not fully documented |
---

## 8. Suggested Phase Structure

Based on the dependency graph in ARCHITECTURE.md and pitfall phase mapping in PITFALLS.md.

| Phase | Name | Rationale | Key Deliverables | Research Phase Needed? |
|-------|------|-----------|------------------|------------------------|
| 0 | Foundation | All 6 critical pitfalls live here. Wrong decisions here require rewrites. | DB schema, RLS, Custom Access Token Hook, middleware, client factories, patient_consents, audit log | No -- patterns are well-documented |
| 1 | Auth + Tenant Onboarding | Gates all feature modules. RBAC roles must exist before any data is written. | Login/signup, JWT with custom claims, RBAC enforcement, tenant provisioning | No |
| 2 | Clinical MVP | Core value driver. Enables the appointment to prontuario to treatment plan workflow. | Patient CRUD, appointment calendar, odontogram, prontuario, treatment plan/budget, digital anamnesis, document upload | No |
| 3 | Financial MVP | Can be built in parallel with Phase 2. Shares patient data model. | Accounts receivable, Pix/boleto/card via Asaas, installments, commission, cash flow, receipt PDF, NFSe | Yes -- NFSe integration is complex (municipal APIs, Certificate A1) |
| 4 | Async + Communications | Enables all automation. Must come after Phase 2+3 data models exist. | WhatsApp Cloud API, Resend email, pg_cron + pgmq setup, appointment reminders, collection sequence | No -- but Meta Business verification must start in Phase 1 |
| 5 | AI Agents | Requires Phase 4 queues running. High differentiation. | Copilot UI, appointment confirmation agent, collection agent | Yes -- AI prompt design, DPA strategy for LGPD |
| 6 | Advanced Features | After core is stable in production. | Multi-unit franchise dashboard, BI reports, NFSe expansion, recall automation, online booking | Yes -- scope depends on validated demand |

Critical path: Phase 0 -> 1 -> 2 -> 4 -> 5. Phase 3 runs in parallel with Phase 2.

---

## Sources (Aggregated)

- Next.js App Router Docs: https://nextjs.org/docs/app
- Supabase SSR Next.js Setup: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase RLS Performance: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- Supabase Custom Access Token Hook: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
- Supabase Queues (pgmq): https://supabase.com/docs/guides/queues
- Supabase Cron: https://supabase.com/docs/guides/cron
- Vercel Fluid Compute: https://vercel.com/docs/fluid-compute
- Vercel Regions gru1: https://vercel.com/docs/pricing/regional-pricing/gru1
- TanStack Query v5: https://tanstack.com/query/v5
- nuqs: https://nuqs.dev/
- @hookform/resolvers Releases: https://github.com/react-hook-form/resolvers/releases
- PDF Generation comparison: https://dev.to/iurii_rogulia/pdf-generation-on-the-server-puppeteer-vs-react-pdfrenderer-a-production-comparison-44cg
- FullCalendar Premium License: https://fullcalendar.io/license
- Asaas API Documentation: https://docs.asaas.com/
- Asaas Webhook Queue Penalization: https://docs.asaas.com/docs/webhooks-queue-paused
- Stripe PIX Brazil (April 2025): https://docs.stripe.com/changelog/basil/2025-04-30/add_pix_to_payment_method_configuration
- Meta WhatsApp Cloud API: https://whatsapp.github.io/WhatsApp-Nodejs-SDK/
- CFO Resolution 91/2009: https://sistemas.cfo.org.br/visualizar/atos/RESOLU%C3%87%C3%83O/SEC/2009/91
- Lei 13.787/2018 -- Dental Record Retention: https://www.jusbrasil.com.br/artigos/por-quanto-tempo-guardar-o-prontuario-odontologico/1293908995
- LGPD (Lei 13.709/2018): https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Supabase RLS Infinite Recursion: https://github.com/orgs/supabase/discussions/1138
- Supabase auth-js getUser vs getSession: https://github.com/supabase/auth-js/issues/898
- Vercel Connection Pooling: https://vercel.com/blog/the-real-serverless-compute-to-database-connection-problem-solved
- Brazil Dental Market 2026: https://blog.odontoresults.com.br/post/softwares-gestao-clinicas-odontologicas-2026
- Clinicorp AI Agents: https://brazileconomy.com.br/empresas/2026/02/clinicorp-aposta-em-agentes-de-ia-para-automatizar-clinicas-e-dobrar-de-tamanho-ate-2027/
- Brazil Dental Market Size: https://www.grandviewresearch.com/horizon/outlook/dental-practice-management-software-market/brazil