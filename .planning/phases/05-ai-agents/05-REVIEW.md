---
phase: 05-ai-agents
reviewed: 2026-06-11T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - supabase/migrations/20260610000100_agent_outreach_log.sql
  - supabase/migrations/20260610000200_agent_outreach_log_rls.sql
  - supabase/migrations/20260610000300_whatsapp_inbound_events.sql
  - src/lib/ai/masking.ts
  - src/lib/ai/tools.ts
  - src/lib/ai/whatsapp-intent.ts
  - src/app/api/copilot/route.ts
  - src/app/api/webhooks/whatsapp/route.ts
  - src/app/api/cron/collection-agent/route.ts
  - src/app/api/cron/confirmation-agent/route.ts
  - src/lib/agents/collection-agent.ts
  - src/lib/agents/confirmation-agent.ts
  - src/lib/whatsapp/verify-signature.ts
  - src/lib/whatsapp/templates.ts
  - src/actions/agent-outreach.ts
  - src/app/(dashboard)/clinica/ia/agentes/page.tsx
findings:
  critical: 2
  warning: 4
  info: 4
  total: 10
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-06-11
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 5 (AI Agents) is well-architected against the LGPD / multi-tenant threat model. Most of the
defenses called out in the review focus hold up under inspection:

- **D-01 (PII to provider):** copilot tools use `createClient()` (RLS), select only safe columns
  (no `medical_history`/`allergies`/`medications`/`anamnese`), and mask CPF/phone/email. PASS.
- **D-05 (read-only):** copilot registers only `.select()` tools — no insert/update/delete/upsert. PASS.
- **Inbound webhook signature:** HMAC-SHA256 over the raw body read via `request.text()` BEFORE
  `JSON.parse`, timing-safe via `crypto.timingSafeEqual`, rejects unsigned/malformed. PASS.
- **Cron auth:** both crons use `isCronAuthorized` — fail-closed when `CRON_SECRET` unset, timing-safe. PASS.
- **AI-03:** uses real `gateway.getInvoiceUrl`, skips on null (never fabricates), idempotent per
  receivable/day, writes `agent_outreach_log` + `logBusinessEvent`. PASS.
- **Secrets:** all secrets read at call-time, server-only (`import 'server-only'`), no `NEXT_PUBLIC`. PASS.
- **RLS:** `agent_outreach_log` SELECT tenant-scoped with no INSERT/UPDATE/DELETE policy;
  `whatsapp_inbound_events` UNIQUE(wamid) dedup. PASS.

However, two CRITICAL issues break tenant isolation / the webhook trust boundary, both in the
free-text inbound path, plus a smaller GET-verify hardening gap. Details below.

## Critical Issues

### CR-01: Free-text reply resolves appointment globally — cross-tenant status corruption

**File:** `src/app/api/webhooks/whatsapp/route.ts:154-167`
**Issue:** When an inbound message is free text (not a button), the handler classifies intent
then resolves the target `appointmentId` by querying `agent_outreach_log` with ONLY
`agent_type='confirmation'` and `status='sent'`, ordered `created_at DESC`, `limit(1)`. There is
**no filter tying the row to the sender's phone number** (`from_phone`), and the
`agent_outreach_log` table has no `from_phone`/patient-phone column to filter on. Consequently any
patient who replies "sim"/"não" in free text is matched to the **globally most-recent** confirmation
outreach across **all tenants/clinics**. Patient A in Clinic X can confirm or cancel Patient B's
appointment in Clinic Y. This violates the stated boundary `T-5-webhook-I` ("tenant derived from
matched appointment row, NEVER from payload") because the matched row itself is not bound to the
sender. The button path is safe (appointmentId is embedded in the payload we injected), but the
free-text path is not.

**Fix:** Bind the lookup to the sender's phone. Add `from_phone` (E.164) to `agent_outreach_log`
on send, then filter the resolution query by it and a recency window:
```ts
// confirmation-agent.ts — record the phone the message was sent to
await admin.from('agent_outreach_log').insert({
  tenant_id: tenantId,
  agent_type: 'confirmation',
  patient_id: appt.patient_id ?? null,
  appointment_id: appt.id,
  status: 'sent',
  to_phone: to, // NEW column (E.164)
})

// webhook route.ts — scope resolution to the sender + recency window
const { data: outreachRow } = await admin
  .from('agent_outreach_log')
  .select('appointment_id, tenant_id')
  .eq('agent_type', 'confirmation')
  .eq('status', 'sent')
  .eq('to_phone', toE164(fromPhone))            // bind to sender
  .gte('created_at', new Date(Date.now() - 36 * 3600_000).toISOString()) // recency
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```
Without sender binding, the free-text path must be disabled (treat all free text as `ambiguous`).

### CR-02: Appointment status update is not tenant/identity-scoped on the matched row

**File:** `src/app/api/webhooks/whatsapp/route.ts:178-209`
**Issue:** After resolving `appointmentId`, the handler fetches the appointment to derive
`tenant_id`, then updates `status` by `eq('id', appointmentId)` only. The inline comment claims this
is safe "because appointmentId is derived from the button payload we injected — never from the raw
inbound payload." That reasoning holds for the BUTTON path, but in the FREE-TEXT path (CR-01) the
`appointmentId` originates from an unscoped log lookup driven by an attacker-controllable message,
so the update can mutate an arbitrary tenant's appointment. There is also no verification that the
inbound sender's phone matches the patient on the resolved appointment, so even within one tenant a
patient could confirm/cancel another patient's appointment. Once CR-01 is fixed, this update should
additionally assert the resolved appointment's patient phone equals the sender.

**Fix:** After fetching `appt`, verify ownership before mutating:
```ts
const { data: appt } = await admin
  .from('appointments')
  .select('id, tenant_id, patient_id, patients!inner(phone)')
  .eq('id', appointmentId)
  .maybeSingle()

// Defense-in-depth: the resolved appointment must belong to the sender.
if (!appt || toE164(appt.patients.phone) !== toE164(fromPhone)) {
  // log ambiguous, do NOT update
}
```
Pass `fromPhone` into `processInbound` (currently it is only read at the call site, not forwarded).

## Warnings

### WR-01: `getPatientSummary` calls `maskEmail` before it is declared

**File:** `src/lib/ai/tools.ts:139` (use) and `:169` (declaration)
**Issue:** `maskEmail` is referenced inside the `getPatientSummary.execute` closure (line 139) but
declared as a `function maskEmail(...)` at line 169. Function declarations hoist, so this works at
runtime — but it is fragile and easy to break if refactored to a `const` arrow function (TDZ error).
More importantly it reduces readability for a security-sensitive masking path.
**Fix:** Move `maskEmail` above the tool definitions (with the other helpers), or import it from
`masking.ts` alongside `maskCPF`/`maskPhone` for consistency and testability.

### WR-02: Placeholder tenant_id `00000000-...0000` will violate the FK to `clinics`

**File:** `src/app/api/webhooks/whatsapp/route.ts:190` and `:239`
**Issue:** Ambiguous/unresolved inbound messages insert an `agent_outreach_log` row with
`tenant_id: '00000000-0000-0000-0000-000000000000'`. The table defines
`tenant_id UUID NOT NULL REFERENCES public.clinics(id)`. Unless a sentinel clinic with that exact id
exists, this INSERT fails the FK constraint (Postgres error 23503), the audit row is silently lost
(the result is not checked), and the "log for human review" guarantee for `T-5-intent` is not met.
**Fix:** Either (a) make `tenant_id` nullable for system/unresolved rows and insert `null`, or
(b) seed a reserved system clinic row, or (c) route unresolved events to a dedicated
`whatsapp_inbound_events`-style table that has no clinic FK. Also check the insert result and log on
failure.

### WR-03: Free-text confirmation never updates the matched outreach row to `responded`

**File:** `src/app/api/webhooks/whatsapp/route.ts:156-220`
**Issue:** The free-text path resolves `appointmentId` from the most recent `status='sent'` row but
inserts a NEW `responded` row rather than transitioning the matched `sent` row. Because the resolver
selects `status='sent'` ordered by recency with `limit(1)`, the same `sent` row remains the newest
`sent` entry and can be re-matched by a subsequent unrelated reply (compounding CR-01). The dedup is
on `wamid` only, so distinct messages from distinct senders each re-resolve to the same stale row.
**Fix:** When resolving, update the matched outreach row's `status` to `responded`/`ambiguous` so it
is no longer selectable as the newest `sent` row, and add the recency window from CR-01.

### WR-04: `processInbound` admin param typed via eslint-disabled `any` indirection

**File:** `src/app/api/webhooks/whatsapp/route.ts:122-124` and `:262-264`
**Issue:** `admin: ReturnType<typeof createAdminClient>` is annotated but preceded by
`// eslint-disable-next-line @typescript-eslint/no-explicit-any`, which is misleading — there is no
explicit `any` on that line, so the disable either suppresses nothing or masks a real `any` leaking
from `createAdminClient`'s return type. If the latter, tenant-unsafe query typing is being hidden.
**Fix:** Remove the stray eslint-disable if unneeded; if `createAdminClient` returns `any`, type it
as `SupabaseClient<Database>` so query builders are type-checked.

## Info

### IN-01: `getTodayAppointments` end-of-day boundary uses naive local string range

**File:** `src/lib/ai/tools.ts:38-39`
**Issue:** The range `${targetDate}T00:00:00`..`${targetDate}T23:59:59` is compared against
`start_time` without timezone/offset. Appointments at 23:59:30 with sub-second precision are fine,
but any appointment stored at exactly midnight UTC vs. local BRT can land in the wrong day bucket,
and the `T23:59:59` upper bound excludes the final second. Low impact (read-only display).
**Fix:** Use a half-open range `>= date T00:00:00-03:00` and `< (date+1) T00:00:00-03:00`, or compute
the window in the clinic timezone (America/Sao_Paulo) consistently with the cron agents.

### IN-02: `getOverdueReceivables` / `getTodayAppointments` use `new Date()` UTC for "today"

**File:** `src/lib/ai/tools.ts:31, 63`
**Issue:** `new Date().toISOString().split('T')[0]` yields the UTC date. Between 21:00–24:00 BRT the
UTC date is already "tomorrow", so "today's" appointments and "overdue" receivables can be computed
for the wrong calendar day from a Brazilian user's perspective. Consistent with how cron windows are
computed (also UTC) but worth normalizing to America/Sao_Paulo for user-facing reads.
**Fix:** Compute the date in the clinic timezone before slicing.

### IN-03: `maskCPF` returns a non-CPF mask shape for invalid-length input

**File:** `src/lib/ai/masking.ts:20`
**Issue:** For input whose digit count is not 11, the function returns `***.***.***-**`. This is
correct (fail-closed, no leakage), but it silently treats malformed CPFs as fully masked with no
signal to the caller. Acceptable for the masking use case; noted for completeness.
**Fix:** None required. Optionally log a debug warning when length != 11 to surface dirty data.

### IN-04: `TEMPLATE_APPOINTMENT_CONFIRMATION` aliases the reminder template — payload-template mismatch risk

**File:** `src/lib/whatsapp/templates.ts:38, 78-84 vs 125-133`
**Issue:** `TEMPLATE_APPOINTMENT_CONFIRMATION = TEMPLATE_APPOINTMENT_REMINDER` ('fynxia_lembrete_consulta').
The reminder builder emits static button payloads (`CONFIRM_APPOINTMENT`) while the confirmation
builder emits dynamic payloads (`CONFIRM_APPOINTMENT_<id>`). If the Meta-approved template has static
(non-variable) button payloads, the dynamic payloads will be rejected or stripped at send time, and
the inbound button path silently degrades to the (broken) free-text path. This is a deployment-time
correctness coupling, not a code bug.
**Fix:** Confirm the Meta template registers quick-reply buttons with **variable** payloads; if not,
register a dedicated confirmation template and point the constant at it (the comment already
anticipates this).

---

_Reviewed: 2026-06-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
