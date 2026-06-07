---
phase: 04-communications-async
plan: 01
subsystem: database
tags: [postgres, supabase, rls, migrations, message-queue, outbox-pattern, vitest, tdd]

# Dependency graph
requires:
  - phase: 02-clinical-mvp
    provides: appointments table (FK target for message_log.appointment_id) and get_my_tenant_id()/get_my_role() SECURITY DEFINER functions
  - phase: 03-financial-mvp
    provides: migration + RLS conventions, audit_table_changes() trigger pattern, Wave 0 test scaffold pattern
provides:
  - message_outbox table (durable async queue: status enum pending/sent/failed, attempts, max_attempts, payload JSONB, idempotency_key UNIQUE, scheduled_for)
  - message_log table (appointment-reminder dedup: UNIQUE on appointment_id+channel+type)
  - RLS policies for both tables (USING+WITH CHECK via get_my_tenant_id(); no client UPDATE/DELETE on outbox)
  - 5 Wave 0 test scaffolds (comms.test.ts GREEN; whatsapp/outbox/reminders/email RED by design — TDD contract for Plans 02/03/04)
  - Regenerated database.types.ts with message_outbox + message_log types
affects: [04-02-whatsapp, 04-03-email, 04-04-cron-worker, 05-ai-agents]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Outbox pattern: message_outbox table drained by Vercel Cron worker; idempotency_key UNIQUE prevents duplicate sends"
    - "Appointment-reminder dedup via message_log UNIQUE (appointment_id, channel, type)"
    - "No client UPDATE/DELETE on outbox: worker uses service role (createAdminClient) for status transitions — same pattern as webhook_events in Plan 03"
    - "Wave 0 TDD scaffolds: 5 test files committed RED before any implementation; downstream plans turn them GREEN task-by-task"

key-files:
  created:
    - supabase/migrations/20260607000100_message_outbox.sql
    - supabase/migrations/20260607000200_message_outbox_rls.sql
    - src/__tests__/migrations/comms.test.ts
    - src/__tests__/comms/whatsapp.test.ts
    - src/__tests__/comms/outbox.test.ts
    - src/__tests__/comms/reminders.test.ts
    - src/__tests__/comms/email.test.ts
  modified:
    - src/types/database.types.ts

key-decisions:
  - "COMMS-04 (async queue) satisfied by message_outbox table + OutboxQueue interface (Plan 02) + Vercel Cron worker (Plan 04); pgmq/pg_cron deferred to Supabase Pro upgrade — seam is the MessageQueue interface"
  - "No client UPDATE/DELETE policy on message_outbox: worker uses createAdminClient (service role) to transition status — prevents tenant tampering with send state (T-4-outbox-T)"
  - "Supabase CLI re-auth gotcha: CLI session expired between planning and execution; re-login to org kczvihafddupruvsrrsc required before every db push — documented as recurring pattern"
  - "ES2017 target incompatibility: /s dotAll regex flag unsupported in ES2017; whatsapp.test.ts scaffold used [\\s\\S] workaround — tsc exit 0 restored"

patterns-established:
  - "message_outbox composite index idx_message_outbox_status on (status, scheduled_for) — drain query efficiency pattern for all future queue tables"
  - "message_log UNIQUE (appointment_id, channel, type) — dedup key pattern for any future per-appointment notification channel"

requirements-completed: [COMMS-01, COMMS-02, COMMS-03, COMMS-04]

# Metrics
duration: ~45min (multi-session including checkpoint)
completed: 2026-06-07
---

# Phase 4 Plan 01: Communications Async — DB Foundation + Wave 0 Tests Summary

**message_outbox durable queue (status/attempts/idempotency_key UNIQUE) + message_log reminder dedup (UNIQUE appointment_id+channel+type) live in Supabase sa-east-1 with tenant-scoped RLS; 5 Wave 0 TDD scaffolds committed RED as contract for Plans 02/03/04**

## Performance

- **Duration:** ~45 min (multi-session; blocked at Task 3 checkpoint for Supabase CLI re-auth)
- **Started:** 2026-06-07T00:00:00Z (approx)
- **Completed:** 2026-06-07T22:52:00Z
- **Tasks:** 4 (Task 0–2 auto; Task 3 checkpoint:human-action resolved by orchestrator)
- **Files modified:** 8

## Accomplishments

- Two new Supabase tables live in sa-east-1: `message_outbox` (async send queue with retry logic columns) and `message_log` (appointment-reminder dedup) — both with RLS, tenant_id indexes, and UNIQUE constraints
- 5 Wave 0 test scaffolds committed: `comms.test.ts` 11/11 GREEN; `whatsapp.test.ts`, `outbox.test.ts`, `reminders.test.ts`, `email.test.ts` RED-by-design (TDD contract for Plans 02/03/04)
- `database.types.ts` regenerated — downstream plans get full TypeScript types for both tables
- COMMS-04 requirement (async queue) fully traced: `message_outbox` (this plan) + `MessageQueue`/`OutboxQueue` interface (Plan 02) + Vercel Cron trigger (Plan 04) deliver the requirement; `pgmq` deferred to Pro plan upgrade behind a clean interface seam

## Task Commits

Each task was committed atomically:

1. **Task 0: Wave 0 test scaffolds (TDD RED)** — `e7b51a8` (test)
2. **Task 1: message_outbox + message_log migrations** — `b24c258` (feat)
3. **Task 2: RLS policies for message_outbox + message_log** — `74bfa2b` (feat)
4. **Task 3: [BLOCKING] supabase db push + regenerate types** — `e00ac3a` (feat) _(also includes scaffold regex fix)_

## Files Created/Modified

- `supabase/migrations/20260607000100_message_outbox.sql` — message_outbox + message_log tables, enums (message_channel, message_status), UNIQUE constraints, composite drain index
- `supabase/migrations/20260607000200_message_outbox_rls.sql` — RLS ENABLE + SELECT/INSERT policies for both tables; deliberately no UPDATE/DELETE client policy on outbox
- `src/__tests__/migrations/comms.test.ts` — 11 static SQL assertions against both migrations (GREEN after db push)
- `src/__tests__/comms/whatsapp.test.ts` — source-inspection assertions for `src/lib/whatsapp/client.ts` (RED until Plan 02)
- `src/__tests__/comms/outbox.test.ts` — source-inspection assertions for `src/lib/messaging/queue.ts` + `worker.ts` (RED until Plans 02/04)
- `src/__tests__/comms/reminders.test.ts` — pure-function test of `selectReminderTargets` + cron auth assertions (RED until Plans 03/04)
- `src/__tests__/comms/email.test.ts` — render test for `AppointmentReminderEmail` component (RED until Plan 03)
- `src/types/database.types.ts` — regenerated; now includes `message_outbox` and `message_log` table types

## Decisions Made

- **COMMS-04 via outbox pattern (not pgmq):** Supabase FREE plan lacks `pgmq`/`pg_cron`. The `message_outbox` table + `OutboxQueue` class (Plan 02) + Vercel Cron (Plan 04) delivers the same outcome (async queue, retries, no duplicate sends). The `MessageQueue` interface is the upgrade seam — a future `pgmq` adapter swaps in without touching callers.
- **No client UPDATE/DELETE on outbox:** Worker uses `createAdminClient()` (service role, bypasses RLS) for all status transitions. This prevents any authenticated tenant user from tampering with send state (`T-4-outbox-T`). Same pattern as `webhook_events` in Plan 03.
- **ES2017 dotAll regex fix:** The `/s` regex flag (dotAll) is not supported under `target: ES2017`. `whatsapp.test.ts` scaffold was authored with `/s`; replaced with `[\s\S]` equivalent. `tsc --noEmit` exit 0 restored.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ES2017 dotAll regex flag in whatsapp.test.ts scaffold**
- **Found during:** Task 3 (type regeneration + tsc check)
- **Issue:** `whatsapp.test.ts` used `/regex/s` (dotAll flag); TypeScript target ES2017 does not support the `s` flag — `tsc --noEmit` failed
- **Fix:** Replaced `/[\s\S]*?/s`-style patterns with `[\s\S]` workaround equivalents
- **Files modified:** `src/__tests__/comms/whatsapp.test.ts`
- **Verification:** `npx tsc --noEmit` exit 0
- **Committed in:** `e00ac3a` (Task 3 commit, bundled with type regen)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix)
**Impact on plan:** Minimal — scaffold correctness fix only, no scope change.

## Issues Encountered

- **Supabase CLI re-auth (recurring gotcha):** The CLI session for org `kczvihafddupruvsrrsc` expired between planning and execution. Required human re-authentication (`npx supabase login`) before `db push` could proceed. This is now documented in STATE.md as a recurring pattern for all future checkpoint:human-action db push tasks.

## User Setup Required

External services require manual configuration per the plan's `user_setup` block:

- **Meta WhatsApp Business API** (needed before live WhatsApp sends in Plans 02/03):
  - `WHATSAPP_PHONE_NUMBER_ID` — Meta App Dashboard > WhatsApp > API Setup
  - `WHATSAPP_ACCESS_TOKEN` — Meta App Dashboard > WhatsApp > System User Token (permanent)
  - `WHATSAPP_BUSINESS_ACCOUNT_ID` — Meta Business Manager > WhatsApp Business Account ID
  - Register 2 UTILITY templates in pt_BR: `fynxia_lembrete_consulta` (quick-reply) + `fynxia_cobranca` (payment link var)
  - Complete Meta Business verification (7–14 day lead time — start immediately, runs in parallel)

Note: Live WhatsApp verification is UAT-deferred per Plan decision D-02. Plans 02/03/04 build and unit-test the code; live end-to-end is validated after templates are approved.

## Next Phase Readiness

- **Plan 02 (WhatsApp client + outbox worker):** Fully unblocked. `message_outbox` table live, types available, `outbox.test.ts` + `whatsapp.test.ts` define the RED contract.
- **Plan 03 (email templates + reminder scan):** Fully unblocked. `message_log` dedup table live, `reminders.test.ts` + `email.test.ts` define the RED contract.
- **Plan 04 (Vercel Cron triggers):** Depends on Plans 02+03. Contract in `reminders.test.ts` (cron auth assertions) already set.
- **Concern:** Meta Business verification (7–14 days) must be started immediately to not delay Phase 4 UAT.

## Known Stubs

None — this plan is pure database/test foundation. No UI components or data-rendering paths were created.

## Threat Flags

No new threat surface beyond what is documented in the plan's `<threat_model>`. All mitigations implemented:

| Flag | File | Status |
|------|------|--------|
| T-4-outbox-I | message_outbox (patient phone/name in payload) | Mitigated — RLS SELECT USING tenant_id; no NEXT_PUBLIC exposure |
| T-4-outbox-T | message_outbox send-status columns | Mitigated — no client UPDATE/DELETE policy; service role only |
| T-4-outbox-S | message_outbox INSERT | Mitigated — INSERT policy requires get_my_role() IN staff roles + tenant match |
| T-4-log-I | message_log (appointment_id linkage) | Mitigated — RLS tenant_id USING+WITH CHECK; FK ON DELETE CASCADE |
| T-4-dbpush-T | live schema migration | Accepted — gated behind authenticated CLI (org kczvihafddupruvsrrsc) |

---
*Phase: 04-communications-async*
*Completed: 2026-06-07*
