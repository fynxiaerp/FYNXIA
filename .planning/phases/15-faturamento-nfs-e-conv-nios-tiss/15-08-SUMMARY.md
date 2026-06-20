---
phase: 15
plan: 08
subsystem: financeiro/faturamento
tags: [ui, os, nfse, faturamento, wave4, lgpd, shadcn, tanstack]
dependency_graph:
  requires: [15-05, 15-06]
  provides: [OS-UI, NFS-e-UI, Faturamento-Hub]
  affects: [financeiro/page.tsx, faturamento/*, components/financeiro/Os*, components/financeiro/Nfse*]
tech_stack:
  added: [alert-dialog (shadcn/@base-ui), service-orders-client.ts proxy]
  patterns: [RSC-page + client-wrapper, nuqs URL filters, @tanstack/react-table, AlertDialog destructive actions, ISS panel, signed-URL NFS-e download]
key_files:
  created:
    - src/app/(dashboard)/clinica/financeiro/faturamento/page.tsx
    - src/app/(dashboard)/clinica/financeiro/faturamento/os/page.tsx
    - src/app/(dashboard)/clinica/financeiro/faturamento/os/OsListClient.tsx
    - src/app/(dashboard)/clinica/financeiro/faturamento/nfse/page.tsx
    - src/components/financeiro/OsTable.tsx
    - src/components/financeiro/OsSheet.tsx
    - src/components/financeiro/NfseKpiRow.tsx
    - src/components/financeiro/NfseTable.tsx
    - src/components/financeiro/NfseEmitForm.tsx
    - src/actions/service-orders-client.ts
    - src/components/ui/alert-dialog.tsx
  modified:
    - src/app/(dashboard)/clinica/financeiro/page.tsx
    - src/actions/service-orders.ts
decisions:
  - "service-orders-client.ts proxy with async wrappers isolates sync isValidOsTransition from Turbopack 'use server' boundary"
  - "require.resolve('@/actions/nfse') replaced with relative import('./nfse') for Turbopack compatibility"
  - "isValidOsTransition wrapped as async function in service-orders.ts to satisfy 'only async exports' Turbopack constraint while keeping test discoverability"
metrics:
  duration: ~60 min
  completed: 2026-06-20
  tasks: 2
  files: 13
---

# Phase 15 Plan 08: OS + NFS-e + Faturamento Hub UI Summary

Wave 4 UI — OS list/review/faturar screen, NFS-e emit/histórico screen, and Faturamento hub wired to Plan 05/06 server actions; all routes at `/clinica/financeiro/faturamento/`.

## What Was Built

### Task 1: Faturamento Hub + Financeiro Nav + OS Screen

**financeiro/page.tsx** — Added 3 nav cards verbatim from UI-SPEC `§Faturamento Hub — Navigation Addition`: Ordens de Serviço (`ClipboardList`), NFS-e Fiscal (`FileText`), Convênios / TISS (`ShieldPlus`) with correct hrefs.

**faturamento/page.tsx** (Screen 6) — RSC hub with 5 icon cards; Operadoras card gated to `admin/superadmin/financeiro` roles.

**faturamento/os/page.tsx** (Screen 1) — RSC page reading `searchParams` (month/status/pagador), calls `listOs`, renders 3 KPI cards (`OS abertas (rascunho)`, `Faturadas (mês)`, `Canceladas (mês)`) + `<OsListClient>` with nuqs URL filters.

**OsTable.tsx** — `@tanstack/react-table` columns: Número (tabular-nums), Paciente (first_name+last_initial), Pagador Badge, Total (formatBRL), Status Badge (OS contract), Ações DropdownMenu.

**OsSheet.tsx** — shadcn Sheet with Tabs (Itens/Pagamento/Histórico). Footer buttons per OS lifecycle (D-10): rascunho → `Faturar OS` (AlertDialog confirm) + `Cancelar OS` (AlertDialog + Textarea motivo); faturada → `Cancelar OS` only; cancelada → read-only. Calls `faturarOs`/`cancelarOs` from proxy. CPF shown masked `***.xxx.xxx-**` in Pagamento tab.

### Task 2: NFS-e Screen

**faturamento/nfse/page.tsx** (Screen 2) — RSC. Calls `getNfses` + `listOs(status:'faturada')` in parallel. Layout mirrors prototype exactly: `NfseKpiRow` (4 KPIs) → 2-col grid (`BarChart` chart-2 + `NfseEmitForm`) → full-width `NfseTable`.

**NfseKpiRow.tsx** — 4 cards: Notas emitidas (mês), Valor emitido (formatBRL), ISS (alíquota%), Pendentes / erro. `min-h-[72px]`, `tabular-nums`, `aria-label` on each card.

**NfseEmitForm.tsx** — RHF + Zod form. ISS calculation panel exactly per prototype lines 104-113: `rounded-lg border border-border bg-muted/40 p-4` with "ISS retido R$ X" (text-muted-foreground tabular-nums) + "Valor líquido R$ X" (font-semibold tabular-nums). Calls `emitirNfse(osId, {})` on submit.

**NfseTable.tsx** — NFS-e badge contract (emitida=default, processando=secondary, cancelada=outline, erro=destructive). "Ver nota" → `getNfseDocumentUrl` signed URL (60s TTL) opened in new tab, never renders `storage_path`. "Cancelar NFS-e" → AlertDialog + Textarea motivo → `cancelarNfse`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] isValidOsTransition sync re-export in 'use server' file**
- **Found during:** Task 1 build verification
- **Issue:** `service-orders.ts` line 36 had `export { isValidOsTransition }` (sync function) in a `'use server'` file. Turbopack rejects non-async exports in `'use server'` files — caused "module has no exports at all" for all client component consumers.
- **Fix:** Wrapped as `export async function isValidOsTransition(from, to): Promise<boolean>` delegating to `_isValidOsTransition`. Tests use dynamic import in Vitest (bypasses Turbopack) so remain GREEN.
- **Files modified:** `src/actions/service-orders.ts`

**2. [Rule 1 - Bug] require.resolve('@/actions/nfse') and require.resolve('@/actions/tiss') Turbopack incompatibility**
- **Found during:** Task 1 build verification
- **Issue:** Pre-existing `require.resolve` + `await import(nfsePath)` pattern (used to make Plan 06/07 optional at build time) is not supported by Turbopack — throws "server relative imports are not implemented yet".
- **Fix:** Replaced with `await import('./nfse')` and `await import('./tiss')` relative imports inside try/catch (both Plans 06 and 07 are now landed, so the files exist).
- **Files modified:** `src/actions/service-orders.ts`

**3. [Rule 1 - Bug] createApprovalRequest called with wrong field names**
- **Found during:** Task 1 build type-check
- **Issue:** `cancelarOs` called `createApprovalRequest({ action_type, target_id, target_table, required_role, motivo })` but the function signature accepts `{ type, payload, requiredRole }`.
- **Fix:** Updated to `{ type: 'cancelar_os', requiredRole: 'admin', payload: { os_id, os_numero, cancel_reason } }`.
- **Files modified:** `src/actions/service-orders.ts`

**4. [Rule 1 - Bug] Supabase join type cast errors in service-orders.ts**
- **Found during:** Task 1 build type-check
- **Issue:** `os.patients as { id: string; full_name: string; cpf: string }` failed tsc because Supabase join returns array type. Same for `listOs` map.
- **Fix:** Added `as unknown as` double cast (standard Supabase join narrowing pattern).
- **Files modified:** `src/actions/service-orders.ts`

**5. [Rule 3 - Blocking] asChild prop incompatible with @base-ui/react primitives**
- **Found during:** Task 1 tsc check
- **Issue:** `DropdownMenuTrigger asChild` and `AlertDialogTrigger asChild` used Radix API — but these components use `@base-ui/react` which uses `render` prop instead.
- **Fix:** Changed all `asChild` usages to `render={<Button ... />}` pattern per CLAUDE.md dual-library rule.
- **Files modified:** `OsTable.tsx`, `OsSheet.tsx`, `NfseTable.tsx`

**6. [Rule 3 - Blocking] service-orders-client.ts proxy needed**
- **Found during:** Task 1 build
- **Issue:** Client components cannot directly import from `service-orders.ts` when it has a sync re-export (even after async wrapper fix, chain re-exports via `export { ... } from './service-orders'` inherit the problem).
- **Fix:** Created `service-orders-client.ts` with standalone async wrapper functions that delegate to the real implementations — breaks the re-export chain.
- **Files created:** `src/actions/service-orders-client.ts`

## Known Stubs

None — all data flows through real server actions (`listOs`, `getOs`, `faturarOs`, `cancelarOs`, `getNfses`, `emitirNfse`, `cancelarNfse`, `getNfseDocumentUrl`). The `NfseEmitForm` shows live ISS calculation for the selected OS.

## Threat Flags

No new security surface introduced beyond plan scope. All threat mitigations implemented:
- T-15-31: LGPD masking — first_name+last_initial in all table cells, CPF only in OsSheet Pagamento tab as `***.xxx.xxx-**`
- T-15-32: `getNfseDocumentUrl` signed URL (60s TTL) used for "Ver nota"; `storage_path` never rendered client-side (confirmed by grep)
- T-15-34: Cancelar AlertDialog requires Textarea motivo with `.trim()` guard before submit enabled

## Self-Check

Files created/exist check:
