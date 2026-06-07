---
phase: 04-communications-async
reviewed: 2026-06-07T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - supabase/migrations/20260607000100_message_outbox.sql
  - supabase/migrations/20260607000200_message_outbox_rls.sql
  - src/lib/whatsapp/client.ts
  - src/lib/whatsapp/templates.ts
  - src/lib/phone.ts
  - src/lib/messaging/types.ts
  - src/lib/messaging/queue.ts
  - src/lib/messaging/worker.ts
  - src/lib/messaging/reminder-scan.ts
  - src/emails/AppointmentReminderEmail.tsx
  - src/app/api/cron/reminder-dispatch/route.ts
  - src/app/api/cron/collection-ruler/route.ts
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 4 implements the async communications layer: a durable `message_outbox` queue,
WhatsApp Cloud API wrapper, Resend email templates, and two Vercel Cron endpoints
(reminder-dispatch + collection-ruler). The architecture is sound — single-invocation
scan/enqueue/drain, idempotency via UNIQUE keys, server-only token handling, and
tenant_id sourced from the appointment/receivable row (not from untrusted input). The
WhatsApp client correctly reads credentials at call-time, never uses `NEXT_PUBLIC_`,
imports `server-only`, and uses the official Meta Graph API (no Evolution/Baileys). RLS
on `message_outbox`/`message_log` correctly omits client UPDATE/DELETE and pairs USING
with WITH CHECK.

Two Critical issues need attention before production: (1) the CRON_SECRET auth check
fails open when the env var is unset and is not timing-safe, and (2) the outbox worker's
"increment attempts before send" is a non-atomic read-modify-write that permits duplicate
WhatsApp/email sends under concurrent or overlapping cron invocations. The hardcoded Asaas
invoice URL pattern (D-05) is a Warning — it ships an unverified `asaas.com/i/{id}` link
that may 404 for patients.

## Critical Issues

### CR-01: CRON_SECRET auth fails open when env var is unset and is not timing-safe

**File:** `src/app/api/cron/reminder-dispatch/route.ts:45-48`, `src/app/api/cron/collection-ruler/route.ts:46-49`
**Issue:** The guard is `authHeader !== \`Bearer ${process.env.CRON_SECRET}\``. If
`CRON_SECRET` is undefined or empty at runtime (misconfiguration, missing Vercel env in a
preview deploy, etc.), the comparison string becomes `"Bearer undefined"` / `"Bearer "`.
Any caller who sends exactly `Authorization: Bearer undefined` then passes the check and
triggers mass WhatsApp/email sends to real patients (LGPD + cost exposure). Additionally,
the `!==` string compare is not constant-time, leaking timing information about the secret.
**Fix:**
```ts
import { timingSafeEqual } from 'crypto'

function isAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET
  // Fail closed: no secret configured → reject everything
  if (!secret) return false
  if (!authHeader) return false
  const expected = `Bearer ${secret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// in GET:
if (!isAuthorized(request.headers.get('authorization'))) {
  return new Response('Unauthorized', { status: 401 })
}
```

### CR-02: Outbox worker increments `attempts` via non-atomic read-modify-write → duplicate sends

**File:** `src/lib/messaging/worker.ts:53-67`
**Issue:** The worker fetches pending rows, then per-row does
`update({ attempts: row.attempts + 1 })` using the value read at fetch time. This is a
read-modify-write with no row-level lock and no conditional WHERE on the prior attempts/
status. Vercel Cron is at-least-once and can overlap (a slow run still draining when the
next fires; collection-ruler and reminder-dispatch both call `drainOutbox(admin)`). Two
invocations can both select the same `status='pending'` row, both pass the
`attempts < max_attempts` filter, both send the WhatsApp template / email, and both write
back. Result: duplicate patient messages — the exact "no duplicate sends" guarantee the
worker docstring claims. The increment also does not flip status to an in-flight value, so
nothing prevents re-selection mid-send.
**Fix:** Make claiming atomic. Either (a) add a `processing` status and claim with a
conditional update that only one writer can win, or (b) push claim+select into an RPC using
`UPDATE ... WHERE id = $1 AND status='pending' RETURNING *` (or `FOR UPDATE SKIP LOCKED`).
Minimal conditional-claim example:
```ts
// Claim the row: only succeeds if still pending. Check affected rows.
const { data: claimed } = await admin
  .from('message_outbox')
  .update({ attempts: row.attempts + 1, last_attempted_at: now, status: 'processing' })
  .eq('id', row.id)
  .eq('status', 'pending')        // optimistic guard — loser sees 0 rows
  .select('id')
if (!claimed || claimed.length === 0) continue  // another worker claimed it
```
Add `'processing'` to the `message_status` enum (or reuse a claim timestamp) and reset to
`pending`/`failed` after the send result. This requires a follow-up migration since the
enum currently only has `pending|sent|failed`.

## Warnings

### WR-01: Hardcoded Asaas invoice URL pattern may send patients a dead payment link

**File:** `src/app/api/cron/collection-ruler/route.ts:217-226`
**Issue:** The WhatsApp collection payment link is built as
`https://www.asaas.com/i/${providerChargeId}` where `providerChargeId` is the Asaas
`pay_xxx` id, falling back to bare `https://www.asaas.com`. The code comment itself marks
this `[ASSUMED A3]` — the real Asaas invoice URL (`invoiceUrl`) is returned by the Asaas
API and is not guaranteed to follow `asaas.com/i/{paymentId}`. Sending an unverified or
generic link in a billing message risks 404s and erodes trust on the highest-stakes message
type (money). The bare `https://www.asaas.com` fallback is worse — it sends a payment
reminder with no actionable link.
**Fix:** Persist the real `invoiceUrl` on the charge/receivable at creation time (Asaas
returns it in the charge response) and read it here. Until then, skip the WhatsApp
collection send when no verified link is available rather than shipping a guessed URL:
```ts
const paymentLink = receivable.invoice_url // stored from Asaas charge response
if (!paymentLink) { /* skip whatsapp collection — no verified link */ continue-or-skip }
```

### WR-02: Collection email lost permanently on send failure (log inserted before send)

**File:** `src/app/api/cron/collection-ruler/route.ts:146-208`
**Issue:** The flow inserts `collection_log` (the idempotency gate) BEFORE calling
`resend.emails.send()`. If the send throws (Resend outage, rate limit, transient network),
the catch only logs to console (lines 200-207). On the next cron run the `collection_log`
row already exists, so the 23505 idempotency check skips it — the reminder is never retried
and the patient never receives it. Unlike the outbox-backed WhatsApp path, this email path
has no retry. The inline comment acknowledges this ("Acceptable") but for a billing reminder
silent permanent loss is a real correctness gap.
**Fix:** Route collection emails through the same `message_outbox` worker (which has attempt
retry) instead of sending inline, OR delete/rollback the `collection_log` row on send failure
so the next run retries:
```ts
} catch (sendError) {
  await admin.from('collection_log').delete()
    .match({ receivable_id: target.receivableId, milestone: target.milestone, channel: 'email' })
  // now next cron run will retry
}
```

### WR-03: Worker attempts-bump update errors are silently ignored

**File:** `src/lib/messaging/worker.ts:64-67`
**Issue:** The pre-send `update({ attempts... })` does not check its returned `error`. If
that update fails (e.g. transient DB error) the worker proceeds to send anyway, then the
final status update at lines 135-162 may also fail — leaving a row that was sent but still
`status='pending'`, which the next drain will re-send. Combined with CR-02 this widens the
duplicate-send window.
**Fix:** Capture and check the error; skip the row (do not send) if the claim update failed:
```ts
const { error: claimErr } = await admin.from('message_outbox')
  .update({ attempts: row.attempts + 1, last_attempted_at: now }).eq('id', row.id)
if (claimErr) { console.error('[worker] claim failed', row.id, claimErr.message); continue }
```

### WR-04: Final outbox status update errors unhandled → stuck `pending` rows re-sent

**File:** `src/lib/messaging/worker.ts:133-162`
**Issue:** Both the "mark sent" (135-138) and "mark failed/pending" (156-162) updates ignore
their `error` return. If the row was actually sent but the `status='sent'` write fails, the
row stays `pending` and the next drain re-sends it (duplicate). There is no compensating
check.
**Fix:** Check the update error and emit a loud log / metric so a stuck `sent`-but-`pending`
row is detectable. Ideally make the send + status flip resilient (idempotency_key on the
provider side, or store provider messageId before flipping status).

### WR-05: `toE164` accepts malformed 12-digit numbers that are not valid BR mobile/landline

**File:** `src/lib/phone.ts:31-39`
**Issue:** The branch `digits.startsWith('55') && length 12–13` accepts a 12-digit `55` +
10-digit string as valid, and the local branch accepts any 10 or 11 digits. A 10-digit BR
number is a landline (DDD + 8) and cannot receive WhatsApp template messages; an 11-digit
number is mobile (DDD + 9). There is no DDD validity check (valid Brazilian DDDs are a known
set) and no check that mobile numbers have the leading 9. Malformed-but-length-valid input
produces a syntactically-E.164 string that Meta will reject at send time (consuming an
attempt and an `error_message`), rather than being skipped up front. Not a security issue,
but it lets bad data reach the paid API.
**Fix:** Validate DDD against the known set and require the `9` prefix for 11-digit mobiles
before returning. At minimum, document that landlines are knowingly passed through and will
fail at Meta.

### WR-06: `appointments` query relies on `patients!inner` but does not filter soft-deleted patients

**File:** `src/app/api/cron/reminder-dispatch/route.ts:66-77`, `collection-ruler/route.ts:77-91`
**Issue:** CLAUDE.md mandates soft delete for LGPD. The joins (`patients!inner(...)`) and
receivable/appointment selects do not filter `deleted_at IS NULL` (or the project's soft-delete
column). A patient who exercised LGPD deletion/opt-out could still receive automated WhatsApp/
email because the cron uses `createAdminClient()` (RLS bypassed) and the query has no
soft-delete predicate. This is a compliance risk, not just a bug.
**Fix:** Add the soft-delete filter to every admin query that resolves patient contact data,
e.g. `.is('patients.deleted_at', null)` (or the actual column), and confirm appointments/
receivables are also scoped to non-deleted rows.

## Info

### IN-01: `selectReminderTargets` status re-check is dead code in the cron path

**File:** `src/app/api/cron/reminder-dispatch/route.ts:126-134`
**Issue:** The cron hardcodes `status: 'agendado'` when building `ScanAppointment[]` (because
it already filtered `neq 'cancelado'`), so the `if (appt.status === 'cancelado')` re-check
inside `selectReminderTargets` can never fire from this caller. Harmless (the function is also
unit-tested standalone) but the "defensive re-check" comment is misleading for this path.
**Fix:** Pass the real `appt.status` through instead of hardcoding `'agendado'`, so the
re-check is meaningful and future status values (e.g. a new "no-show") are handled.

### IN-02: Collection WhatsApp payload carries `kind: 'whatsapp_template'` that the worker ignores

**File:** `src/app/api/cron/collection-ruler/route.ts:234`, `src/lib/messaging/worker.ts:74-83`
**Issue:** The collection enqueue sets `payload.kind = 'whatsapp_template'`, but the worker's
WhatsApp branch keys only on `row.channel === 'whatsapp'` and passes the whole payload to
`sendTemplateMessage` (which reads `to`/`templateName`/`languageCode`/`components` and ignores
`kind`). It works, but the unused `kind` on WhatsApp payloads vs the meaningful `kind` on email
payloads is an inconsistent contract that invites confusion.
**Fix:** Either drop `kind` from WhatsApp payloads or have the worker validate it, so the
payload schema is consistent across channels.

### IN-03: `drainOutbox` `skipped` counts max-attempts rows but they remain `pending` forever

**File:** `src/lib/messaging/worker.ts:53-58`
**Issue:** Rows where `attempts >= max_attempts` but `status` is still `pending` are filtered
out and counted as `skipped`, but never transitioned to `failed`. They will be re-fetched and
re-skipped on every cron run indefinitely (minor wasted work) and never surface as failures in
metrics.
**Fix:** When a fetched pending row has `attempts >= max_attempts`, update it to
`status='failed'` once instead of perpetually skipping.

### IN-04: `message_outbox.payload` is unvalidated JSONB cast with `as` assertions

**File:** `src/lib/messaging/worker.ts:76-95`
**Issue:** `row.payload` is cast via `as Parameters<...>[0]` and `as { kind?... }` with no
runtime validation. A malformed enqueued payload (missing `to`, wrong shape) is only caught by
the outer try/catch at send time, consuming an attempt. Per CLAUDE.md the stack standardizes on
Zod — validating the payload shape at drain time would fail fast and produce a clearer
`error_message`.
**Fix:** Define a Zod schema per channel/kind and `safeParse` `row.payload` before dispatch;
mark malformed rows `failed` with a descriptive error.

### IN-05: Duplicate Resend client access patterns across the two crons

**File:** `src/app/api/cron/collection-ruler/route.ts:27` (uses deprecated `resend`),
`src/lib/messaging/worker.ts:12` (uses `getResend()`)
**Issue:** `src/lib/resend.ts` marks the `resend` proxy export `@deprecated` in favor of
`getResend()`. collection-ruler imports the deprecated `resend`; the worker uses the
recommended `getResend()`. Inconsistent, and the deprecated path should be retired.
**Fix:** Switch `collection-ruler/route.ts` to `getResend().emails.send(...)` and remove the
deprecated export once no callers remain.

---

_Reviewed: 2026-06-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
