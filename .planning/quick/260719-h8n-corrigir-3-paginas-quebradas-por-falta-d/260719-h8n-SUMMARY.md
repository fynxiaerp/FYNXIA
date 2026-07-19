---
phase: quick-260719-h8n
plan: 01
subsystem: nuqs / production-hotfix
tags: [nuqs, hotfix, faturamento, conformidade, os, glosas, auditoria]
requires: []
provides:
  - NuqsAdapter wrapping on os/page.tsx, glosas/page.tsx, auditoria/page.tsx
affects:
  - src/app/(dashboard)/clinica/financeiro/faturamento/os/page.tsx
  - src/app/(dashboard)/clinica/financeiro/faturamento/glosas/page.tsx
  - src/app/(dashboard)/conformidade/auditoria/page.tsx
tech-stack:
  added: []
  patterns:
    - "Every page.tsx using a client component with useQueryState (nuqs) must wrap its returned JSX in <NuqsAdapter> from 'nuqs/adapters/next/app' — no global layout-level provider exists in this project"
key-files:
  created: []
  modified:
    - src/app/(dashboard)/clinica/financeiro/faturamento/os/page.tsx
    - src/app/(dashboard)/clinica/financeiro/faturamento/glosas/page.tsx
    - src/app/(dashboard)/conformidade/auditoria/page.tsx
decisions:
  - "auditoria/page.tsx has 3 return statements; only the main return (rendering <AuditTrail>) was wrapped in NuqsAdapter — the two early-exit returns (unauthenticated, role-denied) render no nuqs client component and were left untouched, per plan instruction"
metrics:
  duration: "~10 minutes"
  completed: 2026-07-19
---

# Quick Task 260719-h8n: Fix 3 production-breaking pages missing NuqsAdapter Summary

Wrapped the returned JSX of 3 broken `page.tsx` files in `<NuqsAdapter>` (from `nuqs/adapters/next/app`), matching the pattern already used correctly by 11 other nuqs pages in the project (reference: `src/app/(dashboard)/clinica/agenda/page.tsx`).

## What was done

Task 1 (type="auto") executed exactly as planned:

1. **`src/app/(dashboard)/clinica/financeiro/faturamento/os/page.tsx`** — added `import { NuqsAdapter } from 'nuqs/adapters/next/app'`; replaced the outer `<>...</>` fragment with `<NuqsAdapter>...</NuqsAdapter>` wrapping the entire returned tree (`<PageHeader>` + `<main>` containing `OsListClient`).
2. **`src/app/(dashboard)/clinica/financeiro/faturamento/glosas/page.tsx`** — same treatment; entire returned tree (`<PageHeader>` + `<main>` containing `GlosaListClient`) now inside `<NuqsAdapter>`.
3. **`src/app/(dashboard)/conformidade/auditoria/page.tsx`** — this file has 3 `return` statements. Only the **main** return (containing `<AuditTrail>`, which uses `useQueryState`) was wrapped in `<NuqsAdapter>`. The two early-exit returns (unauthenticated at ~line 44, role-denied at ~line 67) render no nuqs client component and were left unchanged, per the plan's explicit instruction.

No client component (`OsListClient.tsx`, `GlosaListClient.tsx`, `AuditTrail.tsx`) was touched. No business logic, data fetching, KPI math, or role gating was changed.

## Verification

- `git diff` confirms changes are limited to exactly: one added import line + JSX wrap per file (2 files), and one added import + single-return wrap in the third file. No client component files touched.
- `npx tsc --noEmit`: emits errors, but ALL of them are in pre-existing `__tests__` files (`tiss.test.ts`, `chart-of-accounts.test.ts`, `migrations-phase14.test.ts`, `transaction-classification.test.ts`, `payables.test.ts`, `ofx-parser.test.ts`, `payout-math.test.ts`, `reconciliation.test.ts`) — confirmed via `git stash`/`tsc`/`git stash pop` that these identical errors exist with or without this task's changes. They are unrelated to nuqs/the 3 fixed pages and out of scope per the deviation rules' scope boundary (pre-existing, unrelated files). Not fixed.
- `npm run build` (production build): **succeeded**, including the 3 fixed routes (`/clinica/financeiro/faturamento/os`, `/clinica/financeiro/faturamento/glosas`, `/conformidade/auditoria`) all listed as compiled dynamic routes (`ƒ`) with no build errors.

## Deviations from Plan

None — plan executed exactly as written. Task 1's `<verify>` step specified `npx tsc --noEmit`, which surfaces pre-existing, unrelated test-file errors (confirmed via git stash comparison to be present before this task's changes). Per the deviation rules' Scope Boundary ("Only auto-fix issues DIRECTLY caused by the current task's changes... failures in unrelated files are out of scope"), these were not fixed. The production build (`npm run build`), which is what actually determines deploy readiness, completed successfully.

## Auth gates

None encountered.

## Known Stubs

None introduced.

## Threat Flags

None — this change only adds a context-provider wrapper around existing JSX; no new network endpoints, auth paths, file access, or schema changes.

## Task 2 (checkpoint:human-verify) — NOT executed by this agent

Per constraints, Task 2 (`checkpoint:human-verify`, gated on production deploy) was intentionally NOT attempted by this executor. The orchestrator is responsible for deploying (push to origin, confirm Vercel `Ready`) and then running the Playwright verification against the 3 production URLs listed in the plan.

## Self-Check: PASSED

- FOUND: src/app/(dashboard)/clinica/financeiro/faturamento/os/page.tsx (NuqsAdapter present)
- FOUND: src/app/(dashboard)/clinica/financeiro/faturamento/glosas/page.tsx (NuqsAdapter present)
- FOUND: src/app/(dashboard)/conformidade/auditoria/page.tsx (NuqsAdapter present, main return only)
- FOUND commit: 1b2385c
