---
phase: 15-faturamento-nfs-e-conv-nios-tiss
plan: "07"
subsystem: financeiro/tiss
tags: [tiss, convenio, glosa, lote, insurers, conv-01, conv-02, conv-03]
requirements: [CONV-01, CONV-02, CONV-03]

dependency_graph:
  requires:
    - 15-03  # tiss_guides/tiss_guide_items/tiss_lotes/insurers schema + RLS
    - 15-04  # glosa_motivos seed + insurer_prices + validators
    - 15-05  # faturarOs calls criarGuiaForOs (convênio branch)
  provides:
    - TissProvider abstraction (types + Stub + credential-gated factory)
    - criarGuiaForOs: called by faturarOs for pagador=convenio OSs
    - fecharLote: sends guides to provider; stores protocolo on tiss_lotes
    - registrarGlosa/registrarRecurso: per-item glosa lifecycle
    - insurers CRUD: operadora management for CONV-01
  affects:
    - src/actions/service-orders.ts  # faturarOs dynamic-imports criarGuiaForOs
    - src/lib/tiss/index.ts          # factory consumed by fecharLote + criarGuiaForOs

tech_stack:
  added: []
  patterns:
    - Credential-gated provider factory (mirrors src/lib/fiscal/index.ts)
    - Dependency injection for testability (same pattern as faturarOs)
    - Integer-cent arithmetic for BRL glosa totals (D-28)
    - Derived guide status from items — never set directly (Pitfall 5)
    - fire-and-forget logToHub with .catch (T-09-09)

key_files:
  created:
    - src/lib/tiss/types.ts
    - src/lib/tiss/glosa-math.ts
    - src/lib/tiss/stub.ts
    - src/lib/tiss/index.ts
    - src/actions/tiss.ts
    - src/actions/insurers.ts
  modified: []

decisions:
  - "StubTissProvider returned for any clinic without 'tiss' integration_connectors credential_enc (D-01/D-03/D-13)"
  - "getTissProvider real adapter deferred — factory shape present so real XML slots in without callers changing"
  - "criarGuia exported separately from criarGuiaForOs to allow unit-test dep injection (insertGuia mock)"
  - "fecharLote accepts deps for test isolation; production path uses getTissProvider + real Supabase"
  - "getGlosas nested join (tiss_guides→patients/insurers) cast via unknown to satisfy TS2352 Supabase array issue"

metrics:
  duration_minutes: 7
  completed_date: "2026-06-20"
  tasks_completed: 2
  files_created: 6
  files_modified: 0
---

# Phase 15 Plan 07: TISS Convênio Layer Summary

**One-liner:** Credential-gated TissProvider (Stub + factory), integer-cent glosa math, and full convênio guide/lote/glosa/recurso lifecycle via dependency-injectable Server Actions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TissProvider abstraction + glosa math + insurers CRUD | b510104 | types.ts, glosa-math.ts, stub.ts, index.ts, insurers.ts |
| 2 | tiss.ts actions — criarGuiaForOs, fecharLote, registrarGlosa, registrarRecurso, getGuias/getGlosas | b73120c + 8d9f2f4 | tiss.ts |

## Verification

- `npx vitest run src/__tests__/faturamento/tiss.test.ts` — 14/14 GREEN
- `npx tsc --noEmit` — 0 errors in new files (pre-existing errors in test files and service-orders.ts are out of scope)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| StubTissProvider for no-credential clinics | Zero external setup for dev/test; mirrors getFiscalProvider pattern (D-01/D-03/D-13) |
| Real XML adapter slot deferred | D-13: gated until operadora credentials confirmed; factory shape ensures zero-caller-change upgrade |
| criarGuia exported with insertGuia dep | Allows unit test to verify status='em_analise' without Supabase mock setup |
| fecharLote dep injection (getLoteGuides/getProvider/updateLote) | Test contract from tiss.test.ts requires injectable provider; production ignores deps |
| guide status DERIVED via deriveGuideStatus after every mutation | Pitfall 5: any direct guide status set would be overwritten on next glosa/recurso; single source of truth |
| integer-cent math in computeGuiaGlosaTotals | Prevent BRL floating-point drift on sum of item valorGlosado (D-28) |
| LGPD first_name+last_initial in getGuias/getGlosas | T-15-28: patient identity minimized in convênio screen; mirrors OS list pattern |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Supabase join cast TS2352 in getGuias/getGlosas**
- **Found during:** Task 2, tsc clean check
- **Issue:** Supabase's generated types return joined relations as arrays; direct `as { name: string }` cast fails TS2352 "neither type sufficiently overlaps"
- **Fix:** Cast through `unknown` first (`as unknown as { name: string } | null`) — standard pattern used throughout codebase
- **Files modified:** src/actions/tiss.ts
- **Commit:** 8d9f2f4

## Threat Mitigations Applied

| Threat | Applied |
|--------|---------|
| T-15-25: valor manipulation | valor_total recomputed server-side from service_order_items |
| T-15-26: glosa amount > item | registrarGlosa validates `valorGlosado <= item.valor_total` before update |
| T-15-27: recurso flips whole guide | glosa_status is per-item; guide status derived, never set directly |
| T-15-28: patient PII in guides UI | maskName (first_name + last_initial) in getGuias/getGlosas |
| T-15-29: duplicate guide on retry | criarGuiaForOs idempotent: returns early if service_order_id already has a guide |

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Real TISS XML adapter | src/lib/tiss/index.ts | ~40 | D-13: gated pending operadora credentials; factory shape present for future slot-in |

## Self-Check: PASSED

- src/lib/tiss/types.ts — FOUND
- src/lib/tiss/glosa-math.ts — FOUND
- src/lib/tiss/stub.ts — FOUND
- src/lib/tiss/index.ts — FOUND
- src/actions/tiss.ts — FOUND
- src/actions/insurers.ts — FOUND
- Commit b510104 — FOUND
- Commit b73120c — FOUND
- Commit 8d9f2f4 — FOUND
- tiss.test.ts 14/14 GREEN — VERIFIED
