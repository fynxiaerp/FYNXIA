---
phase: 02-clinical-mvp
plan: "03"
subsystem: clinical-records

tags: [prontuario, odontograma, svg, pdf, medical-records, dental-records, rls, lgpd, react-pdf, zod, tdd]

# Dependency graph
requires:
  - phase: 02-clinical-mvp
    plan: "01"
    provides: "public.medical_records, public.dental_records tables with RLS, TypeScript types"
  - phase: 02-clinical-mvp
    plan: "02"
    provides: "patients CRUD, Server Action pattern, AES-256 encrypt/decrypt helpers, shadcn components"
provides:
  - "medicalRecordSchema + dentalRecordSchema Zod v3 validators (tooth_number FDI refine, 9-status enum)"
  - "createMedicalRecord / listMedicalRecords Server Actions with spoofing guard (dentist_id=actor.id)"
  - "updateDentalRecord Server Action gated to admin/dentist (D-15, Pitfall 4 defense-in-depth)"
  - "Tooth.tsx SVG component: STATUS_COLORS (9 statuses, exact hex), FDI_TEETH (32 teeth), mapDentalRecordsToToothStatus"
  - "Odontogram.tsx SVG container: 32 teeth in 4 FDI groups, hover info bar, edit Dialog for admin/dentist"
  - "ProntuarioPDF.tsx @react-pdf/renderer component: Font.register Roboto Latin Extended, Flexbox-only A4 layout"
  - "GET /api/patients/[id]/prontuario.pdf Route Handler: runtime=nodejs, tenant isolation via RLS, decrypt guard, Uint8Array response"
  - "Pages: /clinica/pacientes/[id]/prontuario, /clinica/pacientes/[id]/odontograma"
  - "ProntuarioForm.tsx RHF + zodResolver client form"
affects:
  - "02-04 (anamneses tab in /clinica/pacientes/[id] — stub still present)"
  - "/clinica/pacientes/[id]/page.tsx — prontuario + odontograma tabs now link to real pages"

# Tech tracking
tech-stack:
  added:
    - "@react-pdf/renderer 4.5.1 — server-side PDF generation (nodejs runtime, Flexbox-only)"
    - "Roboto Google Fonts woff2 — Latin Extended font registration for PT-BR characters"
  patterns:
    - "TDD: RED (test file, import fails) → GREEN (implementation passes) → commit atomically"
    - "Tooth FDI display: 4 groups (upper-right 18-11, upper-left 21-28, lower-right 48-41, lower-left 31-38)"
    - "mapDentalRecordsToToothStatus: most-recent-wins per tooth_number, default 'higido'"
    - "Odontogram hover state for tooth label (not TooltipTrigger asChild — @base-ui incompatibility)"
    - "PDF route: createElement + as ReactElement<DocumentProps> cast, Buffer→Uint8Array for BodyInit"
    - "Route handler tenant isolation: createClient() RLS — cross-tenant query returns null → 404"
    - "No-store Cache-Control on PDF response (PHI document must not be cached)"

key-files:
  created:
    - src/lib/validators/medical-record.ts
    - src/actions/medical-records.ts
    - src/actions/dental-records.ts
    - src/components/odontogram/Tooth.tsx
    - src/components/odontogram/Odontogram.tsx
    - src/components/prontuario/ProntuarioForm.tsx
    - src/components/pdf/ProntuarioPDF.tsx
    - src/app/(dashboard)/clinica/pacientes/[id]/prontuario/page.tsx
    - src/app/(dashboard)/clinica/pacientes/[id]/odontograma/page.tsx
    - src/app/api/patients/[id]/prontuario.pdf/route.ts
    - src/__tests__/components/odontogram.test.ts
    - src/__tests__/actions/medical-records.test.ts
    - .planning/phases/02-clinical-mvp/deferred-items.md
  modified:
    - src/app/(dashboard)/clinica/pacientes/[id]/page.tsx (stubs replaced with links)
    - package.json (@react-pdf/renderer added)
    - package-lock.json

key-decisions:
  - "Hover state instead of TooltipTrigger asChild for SVG tooltip — @base-ui/react does not support asChild (same issue as Plan 02-02 Button)"
  - "createElement + as ReactElement<DocumentProps> cast for renderToBuffer — TypeScript structural mismatch between FunctionComponentElement and DocumentProps"
  - "Buffer→Uint8Array conversion for Response BodyInit — Node.js Buffer not directly assignable to Web API BodyInit in strict TypeScript"
  - "Odontogram lower arch display order: [48..41] for lower-right mirrors upper-right (patient perspective symmetry)"

# Metrics
duration: 12 minutes
completed: 2026-06-05
---

# Phase 2 Plan 03: Prontuário Clínico + Odontograma SVG + PDF do Prontuário Summary

**Prontuário clínico com campos estruturados e histórico multi-dentista, odontograma SVG interativo com 32 dentes FDI e 9 status codificados por cor, e geração de PDF server-side com fonte Latin Extended via @react-pdf/renderer — tudo gateado por role (D-15) e isolado por tenant (T-2-11)**

## Performance

- **Duration:** ~12 minutes
- **Started:** 2026-06-05
- **Completed:** 2026-06-05
- **Tasks:** 4 (Task 0, 1, 2, 3)
- **Files modified/created:** 14

## Accomplishments

- Zod v3 validators: `medicalRecordSchema` (refine: at least one of diagnosis/treatment_plan/prescription) + `dentalRecordSchema` (FDI range refine, 9-status enum)
- Server Actions: `createMedicalRecord` (dentist_id=actor.id T-2-12 spoofing guard, role gate admin/dentist/superadmin) + `listMedicalRecords` (ORDER BY created_at DESC, no dentist_id filter — D-10 multi-dentist CLINIC-07) + `updateDentalRecord` (role gate admin/dentist D-15, INSERT-only snapshot D-14)
- `Tooth.tsx`: STATUS_COLORS (9 statuses, exact hex from contract), FDI_TEETH (32 numbers), mapDentalRecordsToToothStatus (most-recent-wins, default higido), `<g>` with role=button + tabIndex + onKeyDown accessibility
- `Odontogram.tsx`: SVG container rendering 32 Tooth elements in 4 FDI groups, hover info bar, edit Dialog with Select (9 statuses pt-BR) + Textarea + Salvar Ocorrência CTA → updateDentalRecord
- `ProntuarioPDF.tsx`: Font.register Roboto 400+700 (Latin Extended), Flexbox-only A4 layout (no CSS Grid), patient info block + chronological medical records + page N of N footer
- Route handler `GET /api/patients/[id]/prontuario.pdf`: `export const runtime = 'nodejs'`, maxDuration=30, RLS-gated patient query (→404 on cross-tenant), decrypt guard (Pitfall 2), Cache-Control: no-store
- Pages: `/prontuario` (history cards + ProntuarioForm + PDF download link) + `/odontograma` (derives editable from x-user-role header)
- 135 tests GREEN (up from 87 baseline; +48 new tests)
- Patient detail page stubs replaced with navigation links

## Task Commits

1. **Task 0: Tooth SVG + RED/GREEN odontogram tests** — `f14d703`
2. **Task 1: Medical + dental records Server Actions** — `9fdc7a3`
3. **Task 2: Odontogram container + pages** — `203c195`
4. **Task 3: ProntuarioPDF + route handler** — `3d55f90`
5. **Stub removal: patient detail page tabs** — `dcf46bd`

## Files Created/Modified

**Validators:**
- `src/lib/validators/medical-record.ts` — medicalRecordSchema + dentalRecordSchema (Zod v3)

**Server Actions:**
- `src/actions/medical-records.ts` — createMedicalRecord + listMedicalRecords
- `src/actions/dental-records.ts` — updateDentalRecord (role gate D-15)

**Components:**
- `src/components/odontogram/Tooth.tsx` — STATUS_COLORS, FDI_TEETH, mapDentalRecordsToToothStatus, Tooth SVG
- `src/components/odontogram/Odontogram.tsx` — SVG container with edit Dialog
- `src/components/prontuario/ProntuarioForm.tsx` — RHF + zodResolver client form
- `src/components/pdf/ProntuarioPDF.tsx` — @react-pdf/renderer Flexbox layout + Roboto font

**Pages:**
- `src/app/(dashboard)/clinica/pacientes/[id]/prontuario/page.tsx`
- `src/app/(dashboard)/clinica/pacientes/[id]/odontograma/page.tsx`

**API:**
- `src/app/api/patients/[id]/prontuario.pdf/route.ts` — nodejs runtime, RLS, decrypt, PDF stream

**Tests:**
- `src/__tests__/components/odontogram.test.ts` — 22 tests (STATUS_COLORS colors, FDI_TEETH count/ranges, mapDentalRecordsToToothStatus)
- `src/__tests__/actions/medical-records.test.ts` — 26 tests (schema validation, FDI ranges, role gates, anti-spoofing source assertions)

## Decisions Made

- Hover state used instead of `TooltipTrigger asChild` for SVG elements — `@base-ui/react` does not support the `asChild` prop (same root cause as Plan 02-02 Button fix); SVG `<g>` elements cannot be inside a `div` wrapper; hover `onMouseEnter/Leave` + info bar above SVG is semantically equivalent and avoids SVG/HTML context mixing
- `createElement + as ReactElement<DocumentProps>` cast for `renderToBuffer` — TypeScript structural mismatch between `FunctionComponentElement<ProntuarioPDFProps>` and `ReactElement<DocumentProps>`; safe because `ProntuarioPDF` renders a `<Document>` root which satisfies the runtime contract
- `Buffer → Uint8Array` conversion before passing to `Response` constructor — Node.js `Buffer` not directly assignable to Web API `BodyInit` in strict TypeScript; `new Uint8Array(buffer)` is zero-copy for contiguous buffers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TooltipTrigger asChild incompatibility in SVG context**
- **Found during:** Task 2 TypeScript check
- **Issue:** `TooltipTrigger` from `@base-ui/react/tooltip` does not accept `asChild` prop. SVG `<g>` elements also cannot be children of an HTML wrapper div inside SVG context.
- **Fix:** Removed Tooltip imports from Odontogram; used `onMouseEnter/Leave` state + info bar above SVG to display tooth status on hover
- **Files modified:** `src/components/odontogram/Odontogram.tsx`
- **Commit:** `203c195`

**2. [Rule 1 - Bug] renderToBuffer TypeScript type mismatch**
- **Found during:** Task 3 TypeScript check
- **Issue:** `createElement(ProntuarioPDF, props)` returns `FunctionComponentElement<ProntuarioPDFProps>` which is not assignable to `ReactElement<DocumentProps>` expected by `renderToBuffer`
- **Fix:** Import `DocumentProps` from `@react-pdf/renderer`; cast with `as ReactElement<DocumentProps>`
- **Files modified:** `src/app/api/patients/[id]/prontuario.pdf/route.ts`
- **Commit:** `3d55f90`

**3. [Rule 1 - Bug] Node.js Buffer not assignable to Response BodyInit**
- **Found during:** Task 3 TypeScript check
- **Issue:** `new Response(buffer)` where buffer is `Buffer<ArrayBufferLike>` fails TypeScript strict mode — `Buffer` not assignable to `BodyInit`
- **Fix:** `new Uint8Array(buffer)` — Web API compatible, zero-copy for contiguous Node.js Buffers
- **Files modified:** `src/app/api/patients/[id]/prontuario.pdf/route.ts`
- **Commit:** `3d55f90`

### Pre-existing Issues Deferred (out of scope)

`AgendaCalendar.tsx` has 2 TypeScript errors pre-existing from Plan 02-02:
- `Cannot find module '@fullcalendar/core'` — `@fullcalendar/core` not in devDependencies
- `Parameter 'arg' implicitly has any type` — missing type annotation in eventContent callback

Logged to `.planning/phases/02-clinical-mvp/deferred-items.md`. Not caused by this plan.

## Known Stubs

The Anamneses tab in `/clinica/pacientes/[id]/page.tsx` remains a stub — delivered in Plan 02-04.

| Stub | File | Reason |
|------|------|--------|
| Anamneses tab content | `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx` | Delivered in Plan 02-04 (digital anamnesis) |

## Threat Flags

No new security surface beyond what was planned in the threat model (T-2-04, T-2-11, T-2-12, T-2-08, T-2-13 — all mitigated as designed).

---

## Self-Check: PASSED

Files exist:
- `src/lib/validators/medical-record.ts` ✓
- `src/actions/medical-records.ts` ✓
- `src/actions/dental-records.ts` ✓
- `src/components/odontogram/Tooth.tsx` ✓
- `src/components/odontogram/Odontogram.tsx` ✓
- `src/components/prontuario/ProntuarioForm.tsx` ✓
- `src/components/pdf/ProntuarioPDF.tsx` ✓
- `src/app/(dashboard)/clinica/pacientes/[id]/prontuario/page.tsx` ✓
- `src/app/(dashboard)/clinica/pacientes/[id]/odontograma/page.tsx` ✓
- `src/app/api/patients/[id]/prontuario.pdf/route.ts` ✓
- `src/__tests__/components/odontogram.test.ts` ✓
- `src/__tests__/actions/medical-records.test.ts` ✓

Commits exist:
- `f14d703` test(02-03): add RED/GREEN odontogram tests + Tooth SVG component ✓
- `9fdc7a3` feat(02-03): medical-records + dental-records Server Actions with role gates ✓
- `203c195` feat(02-03): Odontogram SVG container + prontuario/odontograma pages ✓
- `3d55f90` feat(02-03): ProntuarioPDF component + /api/patients/[id]/prontuario.pdf route ✓
- `dcf46bd` feat(02-03): wire prontuario + odontograma tabs in patient detail page ✓

*Phase: 02-clinical-mvp*
*Completed: 2026-06-05*
