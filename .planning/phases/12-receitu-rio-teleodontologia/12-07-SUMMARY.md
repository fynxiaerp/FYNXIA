---
phase: 12-receitu-rio-teleodontologia
plan: "07"
subsystem: teleodontologia-ui
tags: [teleodontologia, ui, forms, soap, consent, prontuario, tel-01, tel-02]
requirements: [TEL-01, TEL-02]

dependency_graph:
  requires:
    - 12-05 (DB push — teleconsultations + soap_records tables)
    - 12-04 (Server Actions — createTeleconsultation/start/end/createSoapRecord)
    - 12-03 (Zod schemas — teleconsultationSchema + soapSchema)
  provides:
    - /clinica/teleodontologia (list page)
    - /clinica/teleodontologia/[id] (session + SOAP page)
    - TeleconsultationForm component
    - SoapEditor component
  affects:
    - 12-06 (proxy.ts + nav register teleodontologia module — route paths only, no file overlap)

tech_stack:
  patterns:
    - RHF v7 + zodResolver (teleconsultationSchema / soapSchema) — Zod v3, no .default()
    - "@base-ui Button render-prop (NEVER asChild)"
    - RSC page pattern — headers() x-user-id → tenant; x-read-only CTA gating
    - Session controls pattern — create → success → SessionControls inline state machine
    - SOAP confirmation pattern — savedId state replaces form with success panel

key_files:
  created:
    - src/components/teleconsultation/TeleconsultationForm.tsx
    - src/components/teleconsultation/SoapEditor.tsx
    - src/app/(dashboard)/clinica/teleodontologia/page.tsx
    - src/app/(dashboard)/clinica/teleodontologia/[id]/page.tsx

decisions:
  - "TeleconsultationForm dual-mode: create mode (form) → success → SessionControls inline; existingSession prop skips form and shows controls directly"
  - "Start button disabled when consent_given=false (T-12-32 — UI mirrors action guard); client-side guard + action-layer guard = dual enforcement"
  - "SoapEditor uses const SOAP_FIELDS array for DRY rendering of S/O/A/P textareas"
  - "Session page [id]/page.tsx fetches patients+appointments+professionals for both create and view modes (single data-fetch path)"
  - "notFound() on missing/cross-tenant session (T-12-33 information disclosure)"

metrics:
  duration: "~8 minutes"
  completed: "2026-06-19"
  tasks_completed: 2
  files_created: 4
---

# Phase 12 Plan 07: Teleodontologia UI Summary

**One-liner:** Teleconsultation session UI (CFO consent + external link + start/end controls) + SOAP editor (S/O/A/P linked to session + atendimento) under `/clinica/teleodontologia`, wiring Plan 04 Server Actions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TeleconsultationForm + SoapEditor components | 6919cc8 | src/components/teleconsultation/TeleconsultationForm.tsx, SoapEditor.tsx |
| 2 | Teleodontologia list + session RSC pages | 55f0f13 | src/app/(dashboard)/clinica/teleodontologia/page.tsx, [id]/page.tsx |

## Verification Results

- `npx tsc --noEmit`: exits 0 (clean)
- `npx next build`: clean — `/clinica/teleodontologia` and `/clinica/teleodontologia/[id]` appear as dynamic routes
- `npx vitest run src/__tests__/teleodontologia/`: **62/62 tests GREEN** (2 test files)

## What Was Built

### TeleconsultationForm (`src/components/teleconsultation/TeleconsultationForm.tsx`)
- `'use client'` — RHF v7 + `zodResolver(teleconsultationSchema)`; defaultValues supply all fields (no `.default()` on schema)
- Patient selector (Select), optional appointment link (filtered by selected patient), optional professional
- `external_link` Input type=url with helper: "Cole o link da reunião (Google Meet, Zoom, Jitsi). O FYNXIA não hospeda o vídeo."
- `consent_given` Checkbox with full CFO 226/2020 consent text
- On create success: inline `SessionControls` renders status badge, external link, timestamps, Iniciar/Encerrar buttons
- Start button disabled when `consent_given=false` (T-12-32); error message surfaced via Alert
- `existingSession` prop: skips create form, renders controls directly (used by session page)
- No client-side IP collection (T-12-30 — consent_ip/consent_given_at set server-side in action)

### SoapEditor (`src/components/teleconsultation/SoapEditor.tsx`)
- `'use client'` — RHF v7 + `zodResolver(soapSchema)`; props: `patientId`, `teleconsultationId?`, `appointmentId?`
- Four Textarea fields: S (Subjetivo), O (Objetivo), A (Avaliação), P (Plano) — each with pt-BR label + helper text
- On success: replaces form with confirmation panel stating registro vinculado ao prontuário + teleconsulta + atendimento
- Errors via shadcn Alert; isReadOnly prop hides the entire form with read-only notice

### List Page (`/clinica/teleodontologia`)
- RSC — resolves tenant via Supabase auth + users table
- Calls `listTeleconsultations()` Server Action; fetches patients for name lookup
- Table: paciente, status (Badge), consentimento sim/não, início, encerramento, criado em, link "Ver"
- EmptyState with `VideoOff` icon when no sessions
- "Nova teleconsulta" Button (render-prop → Link) gated by `x-read-only` header

### Session Page (`/clinica/teleodontologia/[id]`)
- `id === 'novo'`: create mode — passes patients/appointments/professionals to TeleconsultationForm
- `id === <uuid>`: fetches session tenant-scoped; `notFound()` on missing/cross-tenant (T-12-33)
- Renders TeleconsultationForm in `existingSession` mode (controls only) + SoapEditor with `teleconsultationId={id}` + `appointmentId={session.appointment_id}` wired (TEL-02)
- `isReadOnly` propagated to both child components

## Deviations from Plan

None — plan executed exactly as written.

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-12-30 Repudiation (consent client-side) | Form sends only `consent_given` boolean; no IP collected client-side; consent_ip/consent_given_at set server-side in action |
| T-12-31 Elevation of Privilege (non-clinical SOAP) | isReadOnly from x-read-only header disables all CTAs; assertNotReadOnly() + role gate in action |
| T-12-32 Tampering (start without consent) | Start button disabled when consent_given=false; client guard + action-layer guard (dual enforcement) |
| T-12-33 Information Disclosure (cross-tenant SOAP) | Session fetch tenant-scoped (.eq('clinic_id', tenantId)); notFound() on mismatch |

## Self-Check: PASSED

- FOUND: src/components/teleconsultation/TeleconsultationForm.tsx
- FOUND: src/components/teleconsultation/SoapEditor.tsx
- FOUND: src/app/(dashboard)/clinica/teleodontologia/page.tsx
- FOUND: src/app/(dashboard)/clinica/teleodontologia/[id]/page.tsx
- FOUND commit 6919cc8 (Task 1)
- FOUND commit 55f0f13 (Task 2)
