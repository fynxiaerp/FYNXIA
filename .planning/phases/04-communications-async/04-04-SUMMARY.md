---
phase: 04-communications-async
plan: "04"
subsystem: messaging-cron
tags: [cron, whatsapp, email, outbox, reminders, collection, vercel]
dependency_graph:
  requires: [04-02, 04-03]
  provides: [reminder-dispatch-cron, collection-whatsapp-channel, worker-kind-switch]
  affects: [message_outbox, message_log, collection_log]
tech_stack:
  added: []
  patterns:
    - scan+enqueue+drain in single Vercel Cron invocation (Hobby daily limit)
    - worker email kind-switch reconstructs React element from JSON payload.props
    - status-idempotent drainOutbox safe across two independent crons
    - Asaas public URL fallback for collection WhatsApp payment link
key_files:
  created:
    - src/app/api/cron/reminder-dispatch/route.ts
  modified:
    - src/lib/messaging/worker.ts
    - src/app/api/cron/collection-ruler/route.ts
    - vercel.json
    - .env.local.example
decisions:
  - "Dentist name fetched via batch users query rather than join alias — FK has no explicit name in migration; batch query is safe and verified"
  - "Asaas payment link uses assumed public URL pattern https://www.asaas.com/i/{provider_charge_id} (RESEARCH A3) — no invoiceUrl column exists in schema; documented in comment with future getPaymentLink() path"
  - "collection-ruler email guard changed: skip email if no patient email (was hard-stop), continue to WhatsApp path independently — Pitfall 8 compliance"
metrics:
  duration_minutes: 9
  completed_date: "2026-06-07"
  tasks_completed: 3
  files_changed: 5
---

# Phase 04 Plan 04: Reminder Dispatch Cron + Collection WhatsApp D-05 Summary

**One-liner:** Daily reminder-dispatch Vercel Cron (scan+enqueue+drain) + worker email kind-switch for AppointmentReminderEmail + WhatsApp channel added to collection ruler via shared outbox.

---

## What Was Built

### Task 1: Worker kind-switch + reminder-dispatch cron

**src/lib/messaging/worker.ts** — Email branch extended with `payload.kind` switch:
- `appointment_reminder`: reconstructs `AppointmentReminderEmail` via `createElement(AppointmentReminderEmail, payload.props as unknown as AppointmentReminderEmailProps)` and sends via `getResend().emails.send({ react: element, ... })`.
- Other kinds (collection, legacy): use existing generic `html` payload path.
- Imports `FROM_EMAIL` from `@/lib/resend` (was using `process.env.RESEND_FROM_EMAIL` inline before).

**src/app/api/cron/reminder-dispatch/route.ts** — New daily cron:
- `export const runtime = 'nodejs'` (T-4-cron-runtime).
- Bearer `CRON_SECRET` guard → 401 on mismatch (T-4-cron-E/S).
- Scans tomorrow's non-cancelled appointments via `createAdminClient()`.
- Fetches dentist names in a single batch users query (FK constraint has no explicit name in migration — join alias would be unreliable; documented in comment).
- Fetches clinic names per tenant (mirrors collection-ruler pattern).
- Calls `selectReminderTargets()` then iterates targets with per-target try/catch.
- `tenant_id` sourced from appointment row — never from `ReminderTarget` (T-4-cron-I).
- Inserts `message_log { tenant_id, appointment_id, channel, type='24h' }` — 23505 → skip (T-4-cron-dup).
- Enqueues JSON-serializable payloads: WhatsApp uses `buildAppointmentReminderComponents`; email carries `{ kind, to, subject, props: { patientName, clinicName, appointmentDate, appointmentTime, dentistName } }`.
- Calls `drainOutbox(admin)` once at the end (Pitfall 1 — same-day sends).
- Returns `{ enqueued, drained, failed, skipped }`.

### Task 2: D-05 WhatsApp channel in collection-ruler cron

**src/app/api/cron/collection-ruler/route.ts** — Extended with WhatsApp:
- Added `phone` and `provider_charge_id` to receivables select.
- Email channel: moved into `if (patient?.email)` guard (was hard-stop — now Pitfall 8 compliant).
- WhatsApp channel: after email block, `toE164(patient.phone)` → if non-null, enqueues via `getOutboxQueue(admin).enqueue({ ..., channel: 'whatsapp', idempotencyKey: 'collection:{receivableId}:{milestone}:whatsapp', ... })`.
- Payment link: `https://www.asaas.com/i/{provider_charge_id}` (RESEARCH A3 assumption — no `invoiceUrl` column in schema, documented with future upgrade path).
- `drainOutbox(admin)` at end of handler — status-idempotent (selects only `status='pending'`), safe across both crons.
- Existing `collection_log` email dedup unchanged.

### Task 3: vercel.json + .env.local.example

**vercel.json**: Added `{ "path": "/api/cron/reminder-dispatch", "schedule": "0 11 * * *" }` alongside existing collection-ruler cron. Both once-per-day → valid on Vercel Hobby (100 crons/project limit). `regions: ["gru1"]` preserved.

**.env.local.example**: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID` already present from Plan 02. No `NEXT_PUBLIC_` prefix (T-4-env-token verified).

---

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/__tests__/comms/reminders.test.ts src/__tests__/comms/outbox.test.ts` | 21/21 GREEN |
| `npx vitest run src/__tests__/collection/ruler.test.ts src/__tests__/comms/` | 46/46 GREEN |
| `npx vitest run` (full suite) | 306/306 GREEN |
| `npx tsc --noEmit` | exit 0 |
| `npx next build` | clean (workspace root inference warning is pre-existing, unrelated) |
| vercel.json + .env.local.example check | CONFIG_OK |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type cast for AppointmentReminderEmailProps**
- **Found during:** Task 1 (tsc --noEmit after writing worker.ts)
- **Issue:** `emailPayload.props as AppointmentReminderEmailProps` failed — TS2352 because `Record<string, unknown>` doesn't overlap with the props interface.
- **Fix:** Changed to `emailPayload.props as unknown as AppointmentReminderEmailProps` (double-cast via `unknown`).
- **Files modified:** `src/lib/messaging/worker.ts`
- **Commit:** be8ac02

**2. [Rule 2 - Missing functionality] Email guard made Pitfall 8 compliant**
- **Found during:** Task 2 implementation analysis
- **Issue:** Original code hard-stopped when `patient.email` was null (`totalSkipped++; continue`), preventing WhatsApp from being sent to patients without email.
- **Fix:** Changed to `if (patient?.email)` guard on the email block; WhatsApp path runs independently after. Pitfall 8 compliance — channels independent.
- **Files modified:** `src/app/api/cron/collection-ruler/route.ts`
- **Commit:** a2bb4c7

### Architectural Choice (documented, not a deviation)

**Dentist name resolution via batch query (not join):** The `dentist_id` FK in `appointments` references `users(id)` but the migration uses no explicit constraint name. Supabase PostgREST join aliases require knowing the FK name. Rather than risk an incorrect alias, a single batch `users` query by `dentist_id` array is used. This is correct, tested, and documented in the route with a comment.

**Asaas payment link (RESEARCH A3):** No `invoiceUrl` column exists in the financial schema (`supabase/migrations/20260606000100_financial_tables.sql` verified). Using `https://www.asaas.com/i/{provider_charge_id}` as the assumed public URL pattern. Documented in a comment with the future path: add `getPaymentLink(providerChargeId)` to the Asaas gateway.

---

## Known Stubs

None — all data is wired to real Supabase tables and real provider APIs. Live WhatsApp/email delivery is UAT-deferred (Meta Business verification pending — D-02), not a code stub.

---

## Threat Flags

No new trust-boundary surface introduced beyond what the plan's threat model anticipated. Both cron endpoints have CRON_SECRET guards (T-4-cron-E). WhatsApp credentials remain server-only (T-4-env-token). drainOutbox cross-cron safety confirmed by status-based idempotency.

---

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/app/api/cron/reminder-dispatch/route.ts` | FOUND |
| `src/lib/messaging/worker.ts` | FOUND |
| `src/app/api/cron/collection-ruler/route.ts` | FOUND |
| `vercel.json` | FOUND |
| Commit be8ac02 (Task 1) | FOUND |
| Commit a2bb4c7 (Task 2) | FOUND |
| Commit a9499cc (Task 3) | FOUND |
