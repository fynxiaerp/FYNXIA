---
phase: 04-communications-async
verified: 2026-06-07T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live WhatsApp appointment reminder (COMMS-01)"
    expected: "A patient with an appointment tomorrow receives a WhatsApp message via Meta Cloud API at ~08:00 BRT using the fynxia_lembrete_consulta UTILITY template with correct date/time/dentist variables and quick-reply buttons"
    why_human: "Meta Business verification not yet started (7-14d lead); WHATSAPP_* env vars not yet set in any environment. Integration code is unit-tested with mocked fetch but has never been exercised against live Meta Graph API."
  - test: "Live WhatsApp collection message with Asaas payment link (SC-3 / COMMS-03)"
    expected: "A patient with an overdue receivable receives a WhatsApp collection message via the fynxia_cobranca UTILITY template with the verified Asaas invoiceUrl as the payment link (sent only when getInvoiceUrl() returns non-null)"
    why_human: "Same Meta Business verification dependency as above. Additionally the Asaas getInvoiceUrl() live API call has never been exercised in a real Asaas sandbox/production environment — only the static type definition was verified."
  - test: "CR-02 concurrency atomic claim holds under overlapping Vercel Cron invocations"
    expected: "When two drainOutbox() calls run concurrently (e.g. both crons fire within seconds of each other), only one wins the conditional UPDATE per outbox row and exactly one WhatsApp/email message is sent per row"
    why_human: "The fix is a conditional UPDATE on (id, status='pending', attempts=N) which is semantically correct under Postgres serializable isolation, but the guarantee depends on concurrent scheduling semantics rather than syntax. Cannot be verified by static code analysis or unit tests."
---

# Phase 4: Communications Async — Verification Report

**Phase Goal:** The system automatically sends appointment reminders and collection messages without any manual trigger — async jobs run reliably on schedule using database-native queuing.
**Verified:** 2026-06-07T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A patient with an appointment tomorrow receives a WhatsApp reminder via Meta Cloud API at the scheduled time (24h prior) — no manual action | VERIFIED (code path); live send is UAT-deferred | `reminder-dispatch/route.ts`: daily Vercel cron `0 11 * * *`, scans tomorrow's non-cancelled appointments, enqueues whatsapp channel via `OutboxQueue`, drains via `drainOutbox()` in single invocation. `client.ts` POSTs to `graph.facebook.com/v21.0/{id}/messages`. D-02 (Meta Business verification pending) recorded as human-verification gap. |
| 2 | The patient also receives an email reminder via Resend — React Email template with correct appointment details | VERIFIED | `AppointmentReminderEmail.tsx` renders all 5 props (patientName, clinicName, appointmentDate, appointmentTime, dentistName) in pt-BR. Worker `payload.kind === 'appointment_reminder'` branch uses `createElement(AppointmentReminderEmail, payload.props)` and `getResend().emails.send({ react: element })`. |
| 3 | A patient with an overdue balance receives an automated collection message via WhatsApp at the configured cadence with the correct Asaas payment link | VERIFIED (code path); live send is UAT-deferred | `collection-ruler/route.ts` enqueues WhatsApp collection via outbox using `buildCollectionComponents` with `paymentLink = await gateway.getInvoiceUrl(providerChargeId)`. WR-01 fix: sends only when `paymentLink != null` (skips rather than shipping guessed URL). |
| 4 | All outbound messaging jobs are enqueued via the queue and processed by the cron worker — a job failure does not crash the app and retries without duplicate sends; WhatsApp templates are categorized utility (not marketing) | VERIFIED | Outbox pattern: `message_outbox` table with `idempotency_key` UNIQUE + atomic claim CR-02 fix (`eq('status','pending').eq('attempts', row.attempts)`). Per-row try/catch in `drainOutbox` — loop never aborts. Templates `TEMPLATE_APPOINTMENT_REMINDER = 'fynxia_lembrete_consulta'` and `TEMPLATE_COLLECTION = 'fynxia_cobranca'` documented UTILITY. No marketing keywords in templates.ts. COMMS-04 outbox+cron satisfies per D-01. |

**Score:** 4/4 truths verified (code path) — 3 human verification items for live delivery.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260607000100_message_outbox.sql` | message_outbox + message_log tables, enums, indexes | VERIFIED | Contains `CREATE TYPE public.message_channel AS ENUM`, `CREATE TYPE public.message_status AS ENUM`, both tables with all required columns, `UNIQUE (idempotency_key)`, `UNIQUE (appointment_id, channel, type)`, all 4 indexes. |
| `supabase/migrations/20260607000200_message_outbox_rls.sql` | RLS policies for both tables | VERIFIED | `ENABLE ROW LEVEL SECURITY` on both tables. SELECT USING + INSERT WITH CHECK using `get_my_tenant_id()`. No client UPDATE/DELETE policy on message_outbox. |
| `src/lib/whatsapp/client.ts` | `sendTemplateMessage()` typed fetch wrapper | VERIFIED | Posts to `graph.facebook.com/v21.0/${phoneNumberId}/messages`, reads credentials at call-time, `import 'server-only'`, `isPermanentError([131026, 132000, 132001, 190])`, graceful return when creds absent. |
| `src/lib/whatsapp/templates.ts` | Template name constants + component builders | VERIFIED | `TEMPLATE_APPOINTMENT_REMINDER`, `TEMPLATE_COLLECTION`, `WHATSAPP_LANGUAGE = 'pt_BR'`, `buildAppointmentReminderComponents` (body + 2 quick_reply buttons), `buildCollectionComponents` (body 5 params). UTILITY category documented. |
| `src/lib/phone.ts` | `toE164()` normalizer | VERIFIED | Validates DDD against known Brazilian DDD set, requires leading 9 for mobiles, returns null for invalid input. |
| `src/lib/messaging/types.ts` | Shared channel/outbox types | VERIFIED | `Channel`, `OutboxStatus`, `OutboxRow`, `EnqueueOptions` exported. |
| `src/lib/messaging/queue.ts` | `MessageQueue` interface + `OutboxQueue` | VERIFIED | Interface `MessageQueue { enqueue() }`, `OutboxQueue implements MessageQueue`, 23505 → idempotent success, `getOutboxQueue()` factory. |
| `src/lib/messaging/worker.ts` | `drainOutbox()` drain loop | VERIFIED | Selects `status='pending'`, atomic claim (CR-02), increments attempts before send, `payload.kind` switch for email (`appointment_reminder` → `AppointmentReminderEmail`, `collection_reminder` → `CollectionReminderEmail`), per-row try/catch, permanent error fast-fail, WR-03/WR-04 error checks on DB writes. |
| `src/lib/messaging/reminder-scan.ts` | Pure `selectReminderTargets()` | VERIFIED | No server-only import, skips `status === 'cancelado'`, emits independent whatsapp/email targets, `idempotencyKey = reminder:${id}:${channel}:24h`. |
| `src/emails/AppointmentReminderEmail.tsx` | React Email appointment reminder | VERIFIED | Renders all 5 props in pt-BR, FYNXIA `#0f172a` header, appointment details card, "Ver minha agenda" CTA. |
| `src/app/api/cron/reminder-dispatch/route.ts` | Daily reminder cron | VERIFIED | `export const runtime = 'nodejs'`, `isCronAuthorized` guard → 401, scans tomorrow's appointments, filters `patients.deleted_at IS NULL` + `is_anonymized = false` (LGPD), batch dentist lookup, `selectReminderTargets()`, per-target try/catch, `message_log` UNIQUE dedup, outbox enqueue, `drainOutbox()` at end. |
| `src/app/api/cron/collection-ruler/route.ts` | Collection cron + WhatsApp D-05 | VERIFIED | `isCronAuthorized`, LGPD patient filter, email routed through outbox (WR-02), WhatsApp enqueue with live `getInvoiceUrl()`, skips when no verified link (WR-01), independent email/WhatsApp channels (Pitfall 8), `drainOutbox()` at end. |
| `src/lib/cron-auth.ts` | Timing-safe cron auth helper | VERIFIED | `timingSafeEqual` over equal-length buffers, fails closed when `CRON_SECRET` unset. Both cron routes use this helper. |
| `vercel.json` | Both cron schedules | VERIFIED | `{ "path": "/api/cron/collection-ruler", "schedule": "0 8 * * *" }` and `{ "path": "/api/cron/reminder-dispatch", "schedule": "0 11 * * *" }` in `crons` array. `regions: ["gru1"]` preserved. |
| `.env.local.example` | WHATSAPP_* env vars documented | VERIFIED | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID` present without `NEXT_PUBLIC_` prefix. |
| `src/types/database.types.ts` | Types contain message_outbox and message_log | VERIFIED | Grep confirms 5 matches for `message_outbox|message_log` in types file. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `reminder-dispatch/route.ts` | `reminder-scan.ts` | `selectReminderTargets` | WIRED | Imported and called at line 145 |
| `reminder-dispatch/route.ts` | `messaging/worker.ts` | `drainOutbox` | WIRED | Imported and called at line 266 |
| `reminder-dispatch/route.ts` | `messaging/queue.ts` | `getOutboxQueue().enqueue()` | WIRED | Queue instantiated with admin client, enqueue called per target |
| `messaging/worker.ts` | `emails/AppointmentReminderEmail.tsx` | `createElement(AppointmentReminderEmail, payload.props)` | WIRED | Imported at line 13-14, used in `payload.kind === 'appointment_reminder'` branch |
| `messaging/worker.ts` | `whatsapp/client.ts` | `sendTemplateMessage` for whatsapp channel | WIRED | Imported and called in `row.channel === 'whatsapp'` branch |
| `messaging/worker.ts` | `lib/resend.ts` | `getResend().emails.send` for email channel | WIRED | Called for both appointment_reminder and collection_reminder kinds |
| `collection-ruler/route.ts` | `messaging/queue.ts` | `OutboxQueue.enqueue` (whatsapp) | WIRED | `getOutboxQueue(admin).enqueue({ channel: 'whatsapp', ... })` |
| `collection-ruler/route.ts` | `asaas/gateway.ts` | `gateway.getInvoiceUrl(providerChargeId)` | WIRED | Live Asaas API call at line 156; returns null on failure |
| `message_outbox_rls.sql` | `get_my_tenant_id()` | RLS USING + WITH CHECK | WIRED | `tenant_id = get_my_tenant_id()` in SELECT and INSERT policies |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `reminder-dispatch/route.ts` | `appointments` | `admin.from('appointments').select(...)` with `.gte('start_time', tomorrow)` | Yes — live Supabase query, LGPD filters applied | FLOWING |
| `reminder-dispatch/route.ts` | `dentistMap` | Batch `admin.from('users').select('id, full_name').in('id', dentistIds)` | Yes | FLOWING |
| `reminder-dispatch/route.ts` | `clinicMap` | `admin.from('clinics').select('id, name').in('id', tenantIds)` | Yes | FLOWING |
| `messaging/worker.ts` | `rows` | `admin.from('message_outbox').select('*').eq('status', 'pending')` | Yes — drains real DB rows | FLOWING |
| `collection-ruler/route.ts` | `paymentLink` | `gateway.getInvoiceUrl(providerChargeId)` — live Asaas GET /payments/{id} | Asaas-dependent (null if no invoiceUrl); send only when non-null | FLOWING (with safe null guard) |
| `AppointmentReminderEmail.tsx` | All 5 props | JSON payload from message_outbox, built at enqueue time from live appointment/patient/dentist/clinic rows | Yes — traced back through reminder-dispatch cron to DB queries | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for live send behaviors (no WHATSAPP_* env vars set; Meta Business verification not complete). Static code path verification performed via grep/read.

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `vercel.json` declares both daily crons | `jq '.crons' vercel.json` equivalent via Read | 2 crons found: `0 8 * * *` + `0 11 * * *` | PASS |
| WhatsApp credentials read at call-time (not module scope) | `process.env.WHATSAPP_*` inside function body | Lines 64-65 of client.ts: inside `sendTemplateMessage()` | PASS |
| No marketing keywords in templates | grep `promoç\|desconto\|aproveite` in templates.ts | Found only in a comment prohibiting them, not in any code | PASS |
| No Evolution/Baileys imports | grep across all src | 2 matches only in `whatsapp.test.ts` which asserts their ABSENCE | PASS |
| `isCronAuthorized` fails closed when CRON_SECRET unset | `if (!secret) return false` at cron-auth.ts line 22 | First branch rejects when env var absent | PASS |
| Atomic claim prevents duplicate sends | `.eq('status','pending').eq('attempts', row.attempts).select('id')` | Lines 79-85 of worker.ts — CAS pattern | PASS |
| LGPD soft-delete filter on both crons | `.is('patients.deleted_at', null).eq('patients.is_anonymized', false)` | Lines 85-86 reminder-dispatch, lines 94-95 collection-ruler | PASS |
| Collection email through durable outbox (WR-02 fix) | `queue.enqueue({ channel: 'email', ... })` in collection-ruler | Lines 169-186 collection-ruler.ts — outbox path, no inline send | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| COMMS-01 | 01, 02, 03, 04 | Sistema envia confirmação de consulta via WhatsApp (Meta Cloud API) 24h antes | SATISFIED (code); live send UAT-deferred | `reminder-dispatch` cron + WhatsApp client + outbox worker. Live delivery deferred per D-02. |
| COMMS-02 | 01, 03, 04 | Sistema envia lembrete de consulta via e-mail (Resend) 24h antes | SATISFIED | `AppointmentReminderEmail.tsx` renders appointment details; worker email branch sends via `getResend()`. |
| COMMS-03 | 01, 02, 04 | Templates WhatsApp separados por categoria (utility vs marketing) | SATISFIED | `TEMPLATE_APPOINTMENT_REMINDER` and `TEMPLATE_COLLECTION` both documented UTILITY. No marketing keywords. whatsapp.test.ts asserts absence of marketing terms. |
| COMMS-04 | 01, 02, 04 | Sistema usa pg_cron + pgmq para jobs assíncronos | SATISFIED (per D-01 override) | OutboxQueue + message_outbox table + Vercel Cron worker delivers same outcome. Native pgmq/pg_cron deferred to Supabase Pro per CONTEXT.md D-01. MessageQueue interface is the upgrade seam. |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `templates.ts` line 7 | "promoção" appears in comment | Info | Not a code path — comment explicitly PROHIBITS marketing wording. Not a blocker. |
| `worker.ts` — IN-03 | Rows with `attempts >= max_attempts` but `status='pending'` are filtered and counted `skipped` but never transitioned to `failed` | Info | Minor wasted work per drain; rows accumulate in skipped count perpetually. Not a blocker for phase goal. |
| `reminder-dispatch/route.ts` line 137 | `status: 'agendado'` hardcoded (IN-01: dead code re-check) | Info | Harmless; `selectReminderTargets` re-check on 'cancelado' can never fire from this caller. Not a blocker. |
| `worker.ts` payload | `row.payload` cast via `as` with no Zod runtime validation (IN-04) | Info | Malformed payload fails at send-time consuming an attempt; not silent loss. Out-of-scope for this phase per review scope. |

No blockers found. All Critical (CR-01, CR-02) and Warning (WR-01 through WR-06) findings from REVIEW.md were fixed per REVIEW-FIX.md.

---

### Human Verification Required

#### 1. Live WhatsApp Appointment Reminder (COMMS-01)

**Test:** Configure WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, and WHATSAPP_BUSINESS_ACCOUNT_ID in the Vercel environment after Meta Business verification completes. Create a test patient with a valid Brazilian mobile number and schedule an appointment for tomorrow. Wait for the daily cron at 08:00 BRT (or manually invoke `GET /api/cron/reminder-dispatch` with the correct `Authorization: Bearer {CRON_SECRET}` header). Check the patient's WhatsApp.

**Expected:** Patient receives a WhatsApp template message from the registered fynxia_lembrete_consulta template with correct appointment date, time, dentist name, and quick-reply buttons "Confirmar" / "Cancelar".

**Why human:** Meta Business account verification is not yet started (7-14 day lead time). No WHATSAPP_* credentials exist. The integration code is unit-tested against mocked fetch but has never made a real API call to graph.facebook.com.

#### 2. Live WhatsApp Collection Message with Payment Link (COMMS-03 / SC-3)

**Test:** With WHATSAPP_* env vars configured, create a test receivable with an Asaas provider_charge_id that has a real invoiceUrl. Wait for the collection-ruler cron or manually invoke it. Check the patient's WhatsApp.

**Expected:** Patient receives a WhatsApp message via fynxia_cobranca UTILITY template with the real Asaas-hosted payment URL (not a guessed pattern). If `getInvoiceUrl()` returns null, the WhatsApp send is skipped silently (correct behavior).

**Why human:** Same Meta dependency. Also: the Asaas `getInvoiceUrl()` call (GET /v3/payments/{id} returning `invoiceUrl`) has not been exercised against a real Asaas sandbox — only the TypeScript type and gateway method were authored. Needs end-to-end verification that Asaas returns a populated `invoiceUrl` field for this project's credentials and charge types.

#### 3. Concurrent Drain Atomic Claim (CR-02 holdover)

**Test:** Trigger two simultaneous calls to `drainOutbox()` (e.g., invoke both cron endpoints within milliseconds of each other when there are pending rows). Inspect message_outbox rows and provider message logs.

**Expected:** Each pending row is sent exactly once. No patient receives the same WhatsApp message or email twice from a single outbox row.

**Why human:** The atomic CAS claim (`eq('status','pending').eq('attempts', row.attempts)`) is semantically correct under PostgreSQL but its correctness under concurrent Supabase-JS invocations cannot be verified by static analysis or unit tests alone. Flagged as "requires human verification" in REVIEW-FIX.md (CR-02 fix note).

---

### Gaps Summary

No automated-verifiable gaps found. All four success criteria are implemented in the codebase with real, non-stub implementations. The three human-verification items are exclusively live-delivery concerns (Meta Business verification pending + Asaas live API) and one concurrency safety check that requires a real concurrent load test. These are the expected UAT gaps documented in D-02 and accepted at phase-design time.

---

_Verified: 2026-06-07T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
