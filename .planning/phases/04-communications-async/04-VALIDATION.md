---
phase: 4
slug: communications-async
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-06
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 (installed since Phase 1) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run {changed test file}` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~2-3 seconds (full suite, 256 tests as of Phase 3) |

Test style: source-inspection for migrations/`'use server'` modules (readFileSync assertions, per Phase 2/3 pattern); pure-function/logic unit tests for the WhatsApp client (mocked fetch), outbox dedup/retry, reminder-scan window logic, and email render.

---

## Sampling Rate

- **After every task commit:** `npx vitest run {file}`
- **After every plan wave:** `npx vitest run` (full suite) + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** full suite GREEN + `next build` clean (catches 'use server' async-export + eager-singleton errors — Phase 3 lesson, e.g. Resend lazy factory)
- **Max feedback latency:** ~10s

---

## Per-Task Verification Map

> Populated by the planner from RESEARCH.md §Validation Architecture.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-00 | 01 | 0 | COMMS-01..04 | — | N/A | scaffold | `npx vitest run src/__tests__/migrations/comms.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-xx | 01 | 1 | COMMS-04 | T-4-* | outbox RLS + dedup (idempotency_key UNIQUE) | static SQL | `npx vitest run src/__tests__/migrations/comms.test.ts` | ❌ W0 | ⬜ pending |
| 04-xx | — | — | COMMS-01,03 | T-4-wa | WhatsApp Cloud API template send (mocked fetch) | unit | `npx vitest run src/__tests__/comms/whatsapp.test.ts` | ❌ W0 | ⬜ pending |
| 04-xx | — | — | COMMS-04 | T-4-worker | outbox worker drains pending, retries failed, no dup send | unit | `npx vitest run src/__tests__/comms/outbox.test.ts` | ❌ W0 | ⬜ pending |
| 04-xx | — | — | COMMS-01,02 | T-4-cron | reminder scan selects next-day appts; dedup per (appt,channel,type) | unit | `npx vitest run src/__tests__/comms/reminders.test.ts` | ❌ W0 | ⬜ pending |
| 04-xx | — | — | COMMS-02 | — | React Email reminder renders appt details | unit | `npx vitest run src/__tests__/comms/email.test.ts` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/__tests__/migrations/comms.test.ts` — SQL assertions: `message_outbox` (status enum, attempts, payload, channel, idempotency_key UNIQUE, scheduled_for) + `message_log` dedup (appointment_id, channel, type) + any templates/prefs table; RLS enabled + WITH CHECK; tenant_id indexed.
- [ ] `src/__tests__/comms/whatsapp.test.ts` — Meta Cloud API client (mocked fetch): correct endpoint v21.0, body shape (type=template, template.name/language pt_BR/components), quick-reply button components, utility category; never references Evolution/Baileys (COMMS-01, COMMS-03).
- [ ] `src/__tests__/comms/outbox.test.ts` — MessageQueue/outbox: enqueue dedups on idempotency_key; worker drains pending → sent, retries failed up to N with attempts increment, a send error does not throw out of the worker loop (COMMS-04).
- [ ] `src/__tests__/comms/reminders.test.ts` — reminder scan selects tomorrow's non-cancelled appointments; enqueues both channels; dedup per (appointment_id, channel, type) (COMMS-01, COMMS-02).
- [ ] `src/__tests__/comms/email.test.ts` — React Email reminder template renders appointment details via Resend wrapper (COMMS-02).

*vitest already installed — no framework install in Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live WhatsApp template delivered via Meta Cloud API | COMMS-01, COMMS-03 | Requires Meta Business verification (7-14d) + approved utility template + WHATSAPP_* env vars | After Meta approval, set env vars, trigger reminder cron for a test appointment, confirm WhatsApp arrives with quick-reply buttons |
| Live appointment-reminder email delivered | COMMS-02 | Requires Resend live send + deployed cron | Trigger reminder cron, confirm email arrives with correct appt details |
| Collection WhatsApp with correct Asaas payment link | COMMS-03 (D-05) | Requires Meta + live Asaas charge | Trigger collection ruler, confirm WhatsApp arrives with working payment link |
| Daily cron actually fires on Vercel schedule | COMMS-04 | Requires deployed app + CRON_SECRET | Confirm Vercel cron runs `0 11 * * *`; outbox drains; no duplicate sends on re-run |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
