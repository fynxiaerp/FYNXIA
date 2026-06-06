---
phase: "03"
plan: "04"
subsystem: financial
tags: [collection-ruler, pdf-receipt, security-headers, cron, resend, fin-07, fin-08, sec-06]
dependency_graph:
  requires: ["03-01", "03-02", "03-03"]
  provides: [collection-ruler-engine, collection-cron, recibo-pdf-route, security-headers]
  affects: [next.config.ts, vercel.json, src/lib/resend.ts]
tech_stack:
  added: []
  patterns:
    - lazy-resend-singleton (avoid build-time throw when RESEND_API_KEY unset)
    - pure-ruler-engine (no server-only imports — unit-testable with date-fns)
    - collection-log-idempotency (INSERT + 23505 conflict skip per milestone)
    - static-csp-headers (next.config.ts headers() — no nonce, no dynamic render penalty)
key_files:
  created:
    - next.config.ts (CSP/HSTS/X-Frame/X-Content-Type security headers)
    - src/components/pdf/ReceiboPDF.tsx
    - src/app/api/financeiro/charges/[id]/recibo.pdf/route.ts
    - src/lib/collection/ruler.ts
    - src/emails/CollectionReminderEmail.tsx
    - src/app/api/cron/collection-ruler/route.ts
    - src/actions/collection-ruler.ts
    - src/app/(dashboard)/clinica/financeiro/regua-de-cobranca/page.tsx
    - src/components/financeiro/CollectionRulerForm.tsx
    - src/__tests__/collection/ruler-config.test.ts
  modified:
    - vercel.json (added crons block)
    - src/lib/resend.ts (lazy singleton pattern)
decisions:
  - Lazy Resend singleton to avoid build-time throw (RESEND_API_KEY absent during next build static analysis)
  - collection-ruler action created in Task 2 scope to satisfy ruler.test.ts (plan split was artificial — test checked it)
  - Resend wrapper object maintains backward-compatible .emails.send() interface so existing Phase 1 callers unchanged
metrics:
  duration_minutes: 68
  completed_date: "2026-06-06"
  tasks_completed: 3
  tasks_total: 3
  files_created: 10
  files_modified: 2
---

# Phase 03 Plan 04: Collection Ruler + ReceiboPDF + SEC-06 Summary

**One-liner:** Daily Vercel Cron (08:00 UTC) scans active collection rules, sends idempotent Resend email reminders per (receivable + milestone) via `collection_log` UNIQUE constraint; ReceiboPDF generates A4 receipts gated to admin/dentist/receptionist; `next.config.ts` secures all responses with CSP/HSTS/X-Frame/X-Content-Type.

---

## What Was Built

### Task 1 — SEC-06 Security Headers + FIN-08 ReceiboPDF + Receipt Route (commit `d7878f2`)

**next.config.ts** — `async headers()` returning security headers for `source: '/(.*)'`:
- `Content-Security-Policy` with `connect-src` including `wss://*.supabase.co` (Supabase Realtime) and `https://api.asaas.com https://api-sandbox.asaas.com` (both Asaas environments)
- `Strict-Transport-Security` max-age=63072000; includeSubDomains; preload
- `X-Frame-Options: DENY` + `frame-ancestors 'none'` (anti-clickjacking T-3-sec06-T)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

**src/components/pdf/ReceiboPDF.tsx** — PDF receipt mirroring `ProntuarioPDF.tsx` pattern:
- `Font.register` Roboto (Latin Extended) for ã/ç/ê/õ
- Flexbox-only layout (no CSS Grid — `@react-pdf/renderer` constraint)
- `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })` for amounts
- Sections: header (clinic + "Recibo de Pagamento" + date) → patient info → charge details (method, amount, paid date, Asaas ID) → footer

**src/app/api/financeiro/charges/[id]/recibo.pdf/route.ts** — PDF route:
- `export const runtime = 'nodejs'` (Pitfall 7 — Edge has no `fs`/`Buffer`)
- Role gate to `['admin', 'dentist', 'receptionist', 'superadmin']` (ROADMAP Phase 3 SC-4 — receptionist included; overrides UI-SPEC admin/dentist-only restriction)
- RLS via `createClient()` for tenant isolation
- Returns `application/pdf` with `Content-Disposition: attachment; filename="recibo-{id}.pdf"` and `Cache-Control: no-store`

### Task 2 — FIN-07 Collection Ruler Engine + Cron + Email (commit `8d49637`)

**src/lib/collection/ruler.ts** — Pure ruler engine (no server-only imports, unit-testable):
- `selectReminders(rule, receivables, today)` — returns `{ receivableId, milestone }[]`
- Milestone `'due_date'` fires when `differenceInCalendarDays === 0` and `due_date_reminder_enabled`
- Milestone `'overdue_N'` fires when `daysOverdue > 0 AND daysOverdue % overdue_interval_days === 0` and `overdue_reminder_enabled`
- Paid/refunded receivables skipped — no reminders

**src/emails/CollectionReminderEmail.tsx** — react-email template (mirrors `InviteEmail.tsx`):
- Props: `patientName`, `clinicName`, `chargeDescription`, `amount`, `dueDate`, `isOverdue`
- Conditional header color (dark red for overdue, dark for due-date)
- CTA: "Ver detalhes da cobrança"
- `formatBRL` via `toLocaleString('pt-BR')`

**src/app/api/cron/collection-ruler/route.ts** — Vercel Cron endpoint:
- `Authorization: Bearer ${CRON_SECRET}` validation → 401 on mismatch (T-3-cron-E, Pitfall 6)
- Queries `collection_rules WHERE due_date_reminder_enabled OR overdue_reminder_enabled` (Open Question 2)
- Per-tenant loop: loads unpaid receivables, calls `selectReminders()`, attempts `INSERT collection_log`
- `23505` conflict → idempotent skip (T-3-cron-T, D-10)
- Sends `resend.emails.send()` with `CollectionReminderEmail`; `logBusinessEvent` per send
- Returns `{ processed, skipped, date }`

**vercel.json** — added `"crons": [{ "path": "/api/cron/collection-ruler", "schedule": "0 8 * * *" }]` alongside `"regions": ["gru1"]` (Pitfall 5 — once/day FREE plan limit)

**src/actions/collection-ruler.ts** — Server Actions (also used by Task 3):
- `getCollectionRuler()` — SELECT with PGRST116 fallback to defaults
- `saveCollectionRuler()` — admin/superadmin gate; Zod validation; UPSERT on `tenant_id` UNIQUE; `logBusinessEvent`

### Task 3 — Collection Ruler Config UI (commit `a5ccdf4`)

**src/app/(dashboard)/clinica/financeiro/regua-de-cobranca/page.tsx** — Server Component:
- `getActor()` role check: `['admin', 'superadmin']` only
- Non-admin: renders in-page `Alert` "Acesso restrito" — NO redirect (03-UI-SPEC)
- Admin: renders breadcrumb + `CollectionRulerForm` pre-populated with tenant rule

**src/components/financeiro/CollectionRulerForm.tsx** — Client Component (`'use client'`):
- RHF + `zodResolver` — no `z.default()` (uses RHF `defaultValues` per CLAUDE.md decision)
- `Switch` "Lembrete no vencimento" + `Switch` "Lembretes por atraso"
- `useWatch` on overdue switch → enables/disables "Intervalo (dias)" `Input[type=number min=1 max=30]`
- Each `Switch` has `<Label htmlFor>` for accessibility (03-UI-SPEC §Accessibility)
- Muted note: "O canal WhatsApp será habilitado na Fase 4 após verificação Meta Business." (D-10)
- `saveCollectionRuler` on submit; inline success/error states; no auto-save

---

## Verification Results

| Check | Result |
|-------|--------|
| `ruler.test.ts` | 7/7 GREEN |
| `ruler-config.test.ts` | 11/11 GREEN |
| `recibo.test.ts` | 4/4 GREEN |
| `security-headers.test.ts` | 7/7 GREEN |
| Full suite (`npx vitest run`) | 256/256 GREEN |
| `npx tsc --noEmit` | Exit 0 |
| `npx next build` | Clean — 30 routes, 0 errors |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Resend module-level instantiation threw during `next build`**
- **Found during:** Task 2 `next build`
- **Issue:** `new Resend(process.env.RESEND_API_KEY)` runs at module evaluation time; `RESEND_API_KEY` is undefined during static page collection in `next build`, causing `Error: Missing API key`
- **Fix:** Replaced eager singleton with lazy factory in `src/lib/resend.ts` — `getResend()` instantiates on first use. Added backward-compatible wrapper object maintaining `resend.emails.send()` interface so existing Phase 1 callers remain unchanged.
- **Files modified:** `src/lib/resend.ts`
- **Commit:** `8d49637`

**2. [Rule 3 - Blocking] `ruler.test.ts` required `src/actions/collection-ruler.ts` (Task 3 file) to pass**
- **Found during:** Task 2 test run
- **Issue:** The `ruler.test.ts` scaffold checks `src/actions/collection-ruler.ts` for `collection_log` and `milestone` references. The plan placed this file in Task 3, but the Task 2 test checked for it.
- **Fix:** Created `src/actions/collection-ruler.ts` during Task 2 execution (it was fully implemented — Task 3 only added the UI on top of it).
- **Files modified:** `src/actions/collection-ruler.ts`
- **Commit:** `8d49637`

**3. [Rule 2 - Missing] Comment in ReceiboPDF.tsx contained literal `display: 'grid'` string**
- **Found during:** Task 1 test run (`recibo.test.ts` assertion `expect(src).not.toMatch(/display:\s*['"]grid['"]/)`)
- **Issue:** Comment text `"// - Flexbox only — no display: 'grid'"` matched the forbidden pattern
- **Fix:** Rewrote comment to `"// - Flexbox only (CSS Grid is not supported by @react-pdf/renderer)"`
- **Files modified:** `src/components/pdf/ReceiboPDF.tsx`
- **Commit:** `d7878f2`

---

## Known Stubs

None. All data flows are wired:
- ReceiboPDF loads real charge + patient data from Supabase via RLS
- Cron route queries real `collection_rules` + `receivables` + `patients` via `createAdminClient`
- CollectionRulerForm calls real `saveCollectionRuler` Server Action
- CSP headers apply to all real HTTP responses via `next.config.ts`

---

## Threat Flags

No new threat surface beyond what was declared in the plan's `<threat_model>`. All mitigations applied:

| Mitigation | Applied |
|-----------|---------|
| T-3-cron-E: CRON_SECRET bearer validation | `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` → 401 |
| T-3-cron-T: collection_log idempotency | INSERT + 23505 conflict skip |
| T-3-cron-I: per-tenant processing | Loop over `collection_rules` rows; each tenant queried separately |
| T-3-pdf-I: recibo.pdf role gate | `['admin','dentist','receptionist','superadmin']` allowlist |
| T-3-sec06-T: clickjacking defense | `X-Frame-Options: DENY` + `frame-ancestors 'none'` |
| T-3-sec06-S: unsafe-inline accepted | Documented in RESEARCH §A3 — internal ERP, no third-party scripts |

---

## Self-Check: PASSED

All 10 created/modified files exist on disk. All 3 task commits verified in git log.

| File | Status |
|------|--------|
| next.config.ts | FOUND |
| src/components/pdf/ReceiboPDF.tsx | FOUND |
| src/app/api/financeiro/charges/[id]/recibo.pdf/route.ts | FOUND |
| src/lib/collection/ruler.ts | FOUND |
| src/emails/CollectionReminderEmail.tsx | FOUND |
| src/app/api/cron/collection-ruler/route.ts | FOUND |
| src/actions/collection-ruler.ts | FOUND |
| src/app/(dashboard)/clinica/financeiro/regua-de-cobranca/page.tsx | FOUND |
| src/components/financeiro/CollectionRulerForm.tsx | FOUND |
| .planning/phases/03-financial-mvp/03-04-SUMMARY.md | FOUND |

| Commit | Message |
|--------|---------|
| d7878f2 | feat(03-04): SEC-06 security headers + FIN-08 ReceiboPDF + recibo route |
| 8d49637 | feat(03-04): FIN-07 collection ruler engine + cron endpoint + Resend email |
| a5ccdf4 | feat(03-04): FIN-07 collection ruler config UI + admin page + ruler-config tests |
