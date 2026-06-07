---
phase: 04-communications-async
plan: "03"
subsystem: communications
tags: [react-email, reminder, pure-function, COMMS-01, COMMS-02]
dependency_graph:
  requires: [04-01]
  provides: [AppointmentReminderEmail, selectReminderTargets]
  affects: [04-04]
tech_stack:
  added: []
  patterns:
    - Pure function scan (mirrors ruler.ts pattern from Phase 3)
    - React Email template mirroring CollectionReminderEmail.tsx
key_files:
  created:
    - src/emails/AppointmentReminderEmail.tsx
    - src/lib/messaging/reminder-scan.ts
  modified: []
decisions:
  - Channels independent per Pitfall 8 — whatsapp and email targets are emitted independently; missing phone drops only whatsapp, missing email drops only email
  - reminder-scan.ts has zero server-only imports so it is fully Vitest-importable in node environment
  - idempotencyKey format reminder:{appointmentId}:{channel}:24h maps to both message_outbox UNIQUE idempotency_key and message_log UNIQUE (appointment_id, channel, type)
metrics:
  duration_minutes: 8
  completed_date: "2026-06-07"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 04 Plan 03: AppointmentReminderEmail + Reminder Scan Summary

**One-liner:** React Email appointment reminder template (pt-BR, FYNXIA-branded) + pure `selectReminderTargets()` scan producing independent whatsapp/email targets with `reminder:{id}:{channel}:24h` idempotency keys.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | AppointmentReminderEmail React Email template | `5e30ff9` | src/emails/AppointmentReminderEmail.tsx |
| 2 | Pure reminder-scan selection logic | `f8e99ca` | src/lib/messaging/reminder-scan.ts |

---

## What Was Built

### Task 1: AppointmentReminderEmail (COMMS-02)

`src/emails/AppointmentReminderEmail.tsx` — React Email template mirroring `CollectionReminderEmail.tsx`:

- Imports from `@react-email/components`: Html, Head, Body, Container, Heading, Text, Button, Section, Hr
- Props: `{ patientName, clinicName, appointmentDate, appointmentTime, dentistName }`
- `<Html lang="pt-BR">`, FYNXIA dark header (`#0f172a`)
- Heading: "Lembrete: sua consulta é amanhã"
- Greeting: "Olá, {patientName}!"
- Appointment details card: Data, Horário, Dentista, Clínica
- CTA Button "Ver minha agenda" → `https://app.fynxia.com/clinica/agenda`
- Footer matching CollectionReminderEmail

### Task 2: selectReminderTargets (COMMS-01, COMMS-02)

`src/lib/messaging/reminder-scan.ts` — Pure function, zero server-only imports:

- `ScanAppointment` interface: `{ id, start_time, status, patient: { phone, email } }`
- `ReminderTarget` interface: `{ appointmentId, channel: 'whatsapp'|'email', type: '24h', idempotencyKey }`
- `selectReminderTargets(appointments)` loop:
  - Skips `status === 'cancelado'`
  - Emits whatsapp target if `patient.phone` is truthy
  - Emits email target if `patient.email` is truthy
  - `idempotencyKey = \`reminder:${appt.id}:${channel}:24h\``
- Comment documents cron responsibility: date window, E.164 normalization, enqueue

---

## Verification Results

```
email.test.ts:    9/9 GREEN
reminders.test.ts: 5/8 GREEN; 3 RED-by-design (cron endpoint = Plan 04)
tsc --noEmit:     exit 0
full suite:       303/306 GREEN; 3 RED = reminder-dispatch/route.ts (Plan 04)
```

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None. `selectReminderTargets` is a complete pure function. `AppointmentReminderEmail` renders all 5 required props. No placeholders or hardcoded empty values.

---

## Threat Surface Scan

No new network endpoints or auth paths introduced. Both files are:
- `AppointmentReminderEmail.tsx`: presentation only, renders only single-recipient props (T-4-email-i mitigated)
- `reminder-scan.ts`: in-memory transformation, no I/O, no secrets (T-4-scan-i mitigated)
- Channel independence implemented: whatsapp and email are independent rows (T-4-scan-channel mitigated)

---

## Self-Check: PASSED

- `src/emails/AppointmentReminderEmail.tsx` — FOUND
- `src/lib/messaging/reminder-scan.ts` — FOUND
- Commit `5e30ff9` — FOUND (feat(04-03): AppointmentReminderEmail)
- Commit `f8e99ca` — FOUND (feat(04-03): selectReminderTargets)
