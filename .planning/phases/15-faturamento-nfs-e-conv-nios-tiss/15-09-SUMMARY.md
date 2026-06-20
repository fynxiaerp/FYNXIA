---
phase: 15
plan: 09
subsystem: financeiro/faturamento/convenios
tags: [tiss, convenios, glosas, operadoras, conv-01, conv-02, conv-03]
dependency_graph:
  requires: [15-05, 15-07]
  provides: [CONV-01, CONV-02, CONV-03 UI screens]
  affects: [financeiro/faturamento hub]
tech_stack:
  added: []
  patterns:
    - RSC page + 'use client' wrapper (nuqs filters + sheet state)
    - render= prop on @base-ui Button inside Radix triggers (not asChild)
    - Server-side role gate (admin/financeiro) before rendering operadoras
    - Per-cell optimistic edit for insurer_prices table
    - fecharLote → AlertDialog confirm pattern
key_files:
  created:
    - src/app/(dashboard)/clinica/financeiro/faturamento/convenios/page.tsx
    - src/app/(dashboard)/clinica/financeiro/faturamento/convenios/FecharLoteButton.tsx
    - src/app/(dashboard)/clinica/financeiro/faturamento/operadoras/page.tsx
    - src/app/(dashboard)/clinica/financeiro/faturamento/operadoras/InsurerTableWrapper.tsx
    - src/app/(dashboard)/clinica/financeiro/faturamento/operadoras/[id]/precos/page.tsx
    - src/app/(dashboard)/clinica/financeiro/faturamento/glosas/page.tsx
    - src/app/(dashboard)/clinica/financeiro/faturamento/glosas/GlosaListClient.tsx
    - src/components/financeiro/ConveniosKpiRow.tsx
    - src/components/financeiro/TissGuidesTable.tsx
    - src/components/financeiro/InsurerTable.tsx
    - src/components/financeiro/InsurerFormDialog.tsx
    - src/components/financeiro/InsurerPricesTable.tsx
    - src/components/financeiro/GlosaTable.tsx
    - src/components/financeiro/GlosaRecursoSheet.tsx
  modified: []
decisions:
  - "Server-side role gate renders access-denied notice (not 500) for non-admin/financeiro on operadoras page (T-15-35)"
  - "DonutChart data includes tone field per charts.tsx API (chart-1..5 cycle)"
  - "DropdownMenuTrigger uses render= prop pattern (not asChild) per CLAUDE.md @base-ui convention"
  - "AlertDialogTrigger wrapping DropdownMenuItem uses render= prop pointing at the item"
  - "GlosaListClient holds nuqs filter state + sheet open state; RSC page loads initial data"
  - "InsurerTableWrapper splits trigger button (in PageHeader) from table (in main) via showTrigger prop"
metrics:
  duration: "~25 minutes"
  completed: 2026-06-20
  tasks: 2
  files: 14
---

# Phase 15 Plan 09: Convênios + Operadoras + Glosas UI Summary

Wave 4 final UI — CONV-01/02/03 screens built under `/clinica/financeiro/faturamento/`. All three screens wire to Plan 07 (insurers/tiss actions) and Plan 05 (services/prices), passing TypeScript and build checks.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Convênios screen + Operadoras cadastro + price table | 3ddfb51 | 10 files |
| 2 | Glosas screen + Recurso Sheet | f338760 | 4 files |

---

## What Was Built

### Screen 3 — Convênios (`/clinica/financeiro/faturamento/convenios`)
- RSC page fetches `getGuias` + `listInsurers` in parallel
- `ConveniosKpiRow`: 5-card grid (2 cols mobile, 5 lg) — Convênios ativos, Guias no mês, Faturado (convênios), Glosa (value + % média sub-label with 6% threshold coloring), Guias em análise
- 2-col layout: `DonutChart` (faturado per operadora) + operadoras summary table with glosa% threshold coloring (`glosaRate >= 6 ? 'text-destructive' : 'text-muted-foreground'`)
- Full-width `TissGuidesTable` with TISS badge contract (paga/autorizada/em_analise/glosada/recurso), patient LGPD masking, DropdownMenu actions
- `FecharLoteButton`: AlertDialog confirm → `fecharLote` action with protocolo display

### Screen 4 — Operadoras (`/clinica/financeiro/faturamento/operadoras`)
- Server-side role gate: admin/financeiro/superadmin only — non-authorized users see an access-denied notice instead of 500 (T-15-35)
- `InsurerTable`: Nome, CNPJ, Registro ANS, Versão TISS, Prazo, Status badge (ativo=secondary, em_negociacao=outline), DropdownMenu (Editar / Ver tabela de preços / Desativar with AlertDialog)
- `InsurerFormDialog`: shadcn Dialog + `zodResolver(insurerSchema)` + RHF defaultValues (tissVersion='3.05.00', status='ativo', prazo=30) — no Zod `.default()` (D-133)
- `InsurerTableWrapper`: client wrapper managing dialog open/edit state; `showTrigger` prop places "Cadastrar Operadora" button in PageHeader

### Screen 4b — Tabela de Preços (`/clinica/financeiro/faturamento/operadoras/[id]/precos`)
- RSC reads `insurerId` from params, fetches `listServices` + `listInsurerPrices` in parallel
- `InsurerPricesTable`: service × valorConvenio table with per-cell inline edit (click to edit → Input → Enter/Esc) → `upsertInsurerPrice` optimistic update

### Screen 5 — Glosas (`/clinica/financeiro/faturamento/glosas`)
- RSC fetches `getGlosas` + `listInsurers`, computes 3 KPIs
- `GlosaListClient`: nuqs filter bar (operadora Select, status Select, month input) + sheet state management
- `GlosaTable`: Guia, Paciente (LGPD masked), Operadora, Procedimento, Motivo ANS badge (codigo), Valor glosado (text-destructive + tabular-nums), Status badge, "Registrar recurso" button per glosada row
- `GlosaRecursoSheet`: shadcn Sheet — title "Recurso — Guia #[ref]", item preview (description + valor glosado + motivo badge), Textarea "Motivo do recurso" with specified placeholder, submit → `registrarRecurso(itemId, texto)`

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DonutChart requires `tone` field on each data item**
- **Found during:** Task 1 TypeScript check
- **Issue:** `DonutChart` in `charts.tsx` expects `{ label, value, tone }[]` but initial code built `{ label, value }[]`
- **Fix:** Added `TONES` cycle array, mapped each insurer to a `chart-N` tone
- **Files modified:** `convenios/page.tsx`
- **Commit:** 3ddfb51

**2. [Rule 1 - Bug] @base-ui Button does not accept `asChild` prop**
- **Found during:** Task 1 TypeScript check
- **Issue:** `DropdownMenuTrigger asChild` + `<Button>` fails because Button is `@base-ui/react` which uses `render=` not `asChild` (CLAUDE.md convention)
- **Fix:** Changed all `<DropdownMenuTrigger asChild><Button …>` to `<DropdownMenuTrigger render={<Button … />}>` pattern; same for `AlertDialogTrigger`; removed `asChild` from `DropdownMenuItem` wrapping `<Link>` — put Link inside item directly
- **Files modified:** `TissGuidesTable.tsx`, `InsurerTable.tsx`, `FecharLoteButton.tsx`
- **Commit:** 3ddfb51

---

## Known Stubs

None — all data flows from live server actions (getGuias, getGlosas, listInsurers, listInsurerPrices, listServices). KPI values are computed from real query results.

---

## Threat Flags

No new trust boundaries beyond those documented in the plan's threat model (T-15-35 through T-15-38).

---

## Self-Check: PASSED
