---
phase: 04-communications-async
fixed_at: 2026-06-07T00:00:00Z
review_path: .planning/phases/04-communications-async/04-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-06-07
**Source review:** .planning/phases/04-communications-async/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 8
- Fixed: 8
- Skipped: 0

**Verification (whole-repo, after all fixes):**
- `npx vitest run` → 28 files / 306 tests passed
- `npx tsc --noEmit` → no errors
- `npx next build` → succeeded (all 24 routes compiled)

**Follow-up required:** None. No migration was authored — all fixes are
no-schema-change. (See CR-02 / WR-01 notes below for why a migration was
deliberately avoided.)

## Fixed Issues

### CR-01: CRON_SECRET auth fails open when env var is unset and is not timing-safe

**Files modified:** `src/lib/cron-auth.ts` (new), `src/app/api/cron/reminder-dispatch/route.ts`, `src/app/api/cron/collection-ruler/route.ts`
**Commits:** 42d6a73 (helper + reminder-dispatch), 87e65e9 (collection-ruler)
**Applied fix:** Added a shared `isCronAuthorized(authHeader)` helper that fails
CLOSED — if `process.env.CRON_SECRET` is unset/empty it rejects everything, so
`Authorization: Bearer undefined` can no longer pass. The compare is constant-time
via `crypto.timingSafeEqual` over buffers with a length guard first (timingSafeEqual
throws on unequal lengths). Both cron routes now call this helper and return 401
before any DB query. The reminder cron test still passes (route source retains the
`CRON_SECRET` / `Bearer` / `401` tokens in the guard comment + return).

### CR-02: Outbox worker increments attempts via non-atomic read-modify-write → duplicate sends

**Files modified:** `src/lib/messaging/worker.ts`
**Commit:** 8149e09
**Status:** fixed: requires human verification (concurrency/logic-sensitive)
**Applied fix:** Chose the **no-migration conditional-claim** approach (preferred per
guidance). The pre-send attempts bump is now a single conditional UPDATE used as an
atomic claim: `.eq('id', row.id).eq('status', 'pending').eq('attempts', row.attempts)`
with `.select('id')`. A compare-and-set on both `status` and `attempts` means only the
worker that read the row first can win; `0` rows returned ⇒ another overlapping drain
already claimed it ⇒ the row is skipped without sending. No `processing` status and no
`claimed_at` column were needed, so **no migration was authored** and the existing
`message_status` enum (`pending|sent|failed`) and generated types remain valid. Build,
tsc, and tests stay green. Flagged for human verification because the guarantee depends
on concurrent ordering semantics rather than syntax.

### WR-01: Hardcoded Asaas invoice URL pattern may send patients a dead payment link

**Files modified:** `src/lib/asaas/types.ts`, `src/lib/asaas/gateway.ts`, `src/app/api/cron/collection-ruler/route.ts`
**Commits:** 9ff272e (gateway/types), 87e65e9 (cron usage)
**Applied fix:** Chose the **fetch-live, no-schema-change** option. Added
`invoiceUrl` to `AsaasPayment` and a `PaymentGateway.getInvoiceUrl(chargeId)` method
(`GET /payments/{id}` → `invoiceUrl`, returns `null` on error). The collection ruler
now resolves the verified hosted URL at send time and **skips** the WhatsApp collection
send when no verified link is available, rather than shipping a guessed
`asaas.com/i/{id}` or the bare `asaas.com` fallback. Persisting `invoiceUrl` on the
charge would have required a migration; fetching live avoids it while still removing the
guessed URL, so that was the safer choice here.

### WR-02: Collection email lost permanently on send failure (log inserted before send)

**Files modified:** `src/app/api/cron/collection-ruler/route.ts`, `src/lib/messaging/worker.ts`
**Commits:** 8149e09 (worker email kind), 87e65e9 (cron enqueue)
**Applied fix:** Routed the collection email through the durable `message_outbox`
(same retry path as WhatsApp) instead of an inline `resend.emails.send`. The worker
email branch now handles `kind: 'collection_reminder'` by reconstructing
`CollectionReminderEmail` from JSON-safe props. Idempotency is the outbox
`idempotency_key` (`collection:{receivableId}:{milestone}:email`); `collection_log` is
inserted only AFTER a successful enqueue, so a failed enqueue no longer blocks a future
retry. A transient Resend failure is now retried by the worker (attempts/max_attempts)
rather than silently swallowed.

### WR-03: Worker attempts-bump update errors silently ignored

**Files modified:** `src/lib/messaging/worker.ts`
**Commit:** 8149e09
**Applied fix:** The claim UPDATE (folded into the CR-02 atomic claim) now captures
`error`; on a DB error the worker logs and `continue`s without sending, so a failed
claim no longer leads to a send that widens the duplicate window.

### WR-04: Final outbox status update errors unhandled → stuck pending rows re-sent

**Files modified:** `src/lib/messaging/worker.ts`
**Commit:** 8149e09
**Applied fix:** Both the "mark sent" and "mark failed/pending" UPDATEs now check
their `error`. A failed mark-sent emits a loud `SENT-BUT-PENDING ... manual
reconciliation needed` log so a sent-but-still-pending row is detectable; the atomic
claim still prevents a concurrent re-send within the window.

### WR-05: toE164 accepts malformed 12-digit numbers that are not valid BR mobile/landline

**Files modified:** `src/lib/phone.ts`
**Commit:** 0b44fd3
**Applied fix:** Tightened validation — strip a leading `55` country code, then require
a valid Brazilian DDD (known set), the mandatory leading `9` on 11-digit mobiles, and a
2–5 first digit on 10-digit landlines. Anything else returns `null` so the caller skips
the channel rather than paying the Meta API for a number it would reject. No existing
test asserts `toE164` directly; full suite stays green.

### WR-06: appointments/receivables queries do not filter soft-deleted patients

**Files modified:** `src/app/api/cron/reminder-dispatch/route.ts`, `src/app/api/cron/collection-ruler/route.ts`
**Commits:** 42d6a73 (reminder-dispatch), 87e65e9 (collection-ruler)
**Applied fix:** Added `.is('patients.deleted_at', null)` and
`.eq('patients.is_anonymized', false)` to both admin (RLS-bypassing) `patients!inner`
queries, and selected those columns in the join. Patients who exercised LGPD
deletion/opt-out can no longer receive automated WhatsApp/email.

## Bonus (Info finding addressed incidentally)

### IN-05: Duplicate Resend client access patterns across the two crons

**File:** `src/app/api/cron/collection-ruler/route.ts`
**Commit:** 87e65e9
**Note:** Resolved as a side effect of WR-02 — collection email now flows through the
worker (`getResend()`), so the deprecated `resend` proxy import was removed from the
collection cron. Other Info findings (IN-01, IN-02, IN-03, IN-04) were out of scope
(`fix_scope: critical_warning`) and were not addressed.

---

_Fixed: 2026-06-07_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
