---
phase: "06"
plan: "07"
subsystem: financeiro
tags: [ux-polish, page-header, empty-state, skeletons, tokens, typography]
dependency_graph:
  requires: ["06-03", "06-04"]
  provides: ["financeiro-module-sweep"]
  affects: ["src/app/(dashboard)/clinica/financeiro/**"]
tech_stack:
  added: []
  patterns:
    - PageHeader on all financeiro screens
    - EmptyState with Lucide icon (Receipt, ReceiptText)
    - ErrorState wrapper in error.tsx
    - Layout-mimicking loading.tsx (PageHeaderSkeleton + TotalsCardsSkeleton / FilterBarSkeleton + TableRowsSkeleton)
key_files:
  created: []
  modified:
    - src/app/(dashboard)/clinica/financeiro/page.tsx
    - src/app/(dashboard)/clinica/financeiro/nova-cobranca/page.tsx
    - src/app/(dashboard)/clinica/financeiro/regua-de-cobranca/page.tsx
    - src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx
    - src/app/(dashboard)/clinica/financeiro/contas-a-receber/page.tsx
decisions:
  - "Sub-module hub card headings use text-sm font-semibold (not text-base) — matches label role in type scale"
  - "Hub description paragraph kept outside PageHeader for semantic clarity — not part of title/breadcrumb"
  - "Régua and Nova Cobrança error/unauthenticated states render PageHeader + Alert (consistent shell)"
metrics:
  duration_minutes: 8
  completed_date: "2026-06-12"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 5
---

# Phase 06 Plan 07: Financeiro Module Visual Sweep Summary

**One-liner:** PageHeader + design tokens + EmptyState icons + standardized widths applied across all five financeiro screens (hub, Fluxo de Caixa, Contas a Receber, Nova Cobrança, Régua de Cobrança).

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Financeiro hub + Nova Cobrança + Régua | fe3e06a | financeiro/page.tsx, nova-cobranca/page.tsx, regua-de-cobranca/page.tsx |
| 2 | Fluxo de Caixa — EmptyState icon | 6e19b6e | fluxo-de-caixa/page.tsx |
| 3 | Contas a Receber — PageHeader + EmptyState | 6e19b6e | contas-a-receber/page.tsx |

---

## What Was Done

### Task 1: Financeiro Hub + Nova Cobrança + Régua

**financeiro/page.tsx:**
- Added `PageHeader` with title "Financeiro", breadcrumbs `[Clínica > Financeiro]`, actions `[Nova Cobrança]`
- Changed icon imports: `CreditCard` → `FilePlus`, `Bell` → `Settings2` (per 06-UI-SPEC line 657)
- Changed all card icons from `text-primary` to `text-muted-foreground group-hover:text-primary` (accent reserved list fix)
- Changed card heading from `text-base` to `text-sm font-semibold` (type scale compliance)
- Standardized container to `max-w-5xl mx-auto w-full p-6`
- Removed inline `Breadcrumb` component (replaced by PageHeader)

**nova-cobranca/page.tsx:**
- Added `PageHeader` with title "Nova Cobrança", breadcrumbs `[Financeiro > Nova Cobrança]`, no actions
- Standardized content to `max-w-2xl mx-auto w-full p-6`
- Removed inline `Breadcrumb` + ad-hoc `<h1>` heading
- Preserved auth/role gating logic, now shows PageHeader even on error paths

**regua-de-cobranca/page.tsx:**
- Added `PageHeader` with title "Régua de Cobrança", breadcrumbs `[Financeiro > Régua de Cobrança]`, no actions
- Standardized content to `max-w-xl mx-auto w-full p-6`
- Removed inline `Breadcrumb` + ad-hoc `<h1>` heading
- Preserved admin-only gating (`admin`/`superadmin`); non-admin path now also shows PageHeader + Alert

### Task 2: Fluxo de Caixa

**fluxo-de-caixa/page.tsx** (PageHeader and max-w-5xl already present from earlier wave):
- Replaced inline empty-state div (`text-xl font-semibold font-display` + `text-sm text-muted-foreground`) with `EmptyState` component using `Receipt` icon
- Title: `"Nenhum lançamento em ${monthLabel}"`, body: "Lance a primeira transação do mês usando o botão acima.", no CTA
- `loading.tsx` (PageHeaderSkeleton + TotalsCardsSkeleton + 6 TableRowsSkeleton) — already correct, no changes
- `error.tsx` (ErrorState wrapper) — already correct, no changes

### Task 3: Contas a Receber

**contas-a-receber/page.tsx:**
- Added `PageHeader` with title "Contas a Receber", breadcrumbs `[Financeiro > Contas a Receber]`, actions `[Emitir Cobrança]`
- Standardized content to `max-w-5xl mx-auto w-full p-6`
- Replaced inline empty-state div (`text-sm font-semibold` — typography violation) with `EmptyState` component using `ReceiptText` icon
- Title: "Nenhum recebível cadastrado", body: per 06-UI-SPEC line 502, CTA: "Emitir Cobrança" linking to nova-cobranca
- Removed inline `Breadcrumb` + ad-hoc `<h1>` + flex header row
- `loading.tsx` (PageHeaderSkeleton + FilterBarSkeleton + 5 TableRowsSkeleton) — already correct, no changes
- `error.tsx` (ErrorState wrapper) — already correct, no changes

---

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/__tests__/ui/page-pattern.test.ts` | 28/28 PASS |
| `npx vitest run src/__tests__/ui/typography.test.ts` | 44/44 PASS |
| Full UI suite `src/__tests__/ui/` | 125/125 PASS |
| `npx tsc --noEmit` | Exit 0 |
| `npx next build` | Green — all financeiro routes compiled |

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. Loading.tsx and error.tsx for both list screens were already created correctly by a prior wave; no recreation needed.

---

## Known Stubs

None — all screens render real data from existing server actions (listTransactions, listReceivables, getCollectionRuler). No hardcoded empty values or placeholder text introduced.

---

## Threat Flags

None — this was a presentation-only sweep. No new network endpoints, auth paths, file access patterns, or schema changes introduced. All financial data reads continue through existing RLS-scoped server actions.

---

## Self-Check

Verified files exist and commits are present:

- `src/app/(dashboard)/clinica/financeiro/page.tsx` — FOUND
- `src/app/(dashboard)/clinica/financeiro/nova-cobranca/page.tsx` — FOUND
- `src/app/(dashboard)/clinica/financeiro/regua-de-cobranca/page.tsx` — FOUND
- `src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx` — FOUND
- `src/app/(dashboard)/clinica/financeiro/contas-a-receber/page.tsx` — FOUND
- Commit `fe3e06a` — FOUND
- Commit `6e19b6e` — FOUND

## Self-Check: PASSED
