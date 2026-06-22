---
phase: 16
plan: 10
subsystem: financeiro
tags: [repasse, rpa, tributos, competencia, reinf, trib-01, trib-02, trib-03]
dependency_graph:
  requires: [16-08]
  provides: [repasse-screen, rpa-screen, financeiro-hub-cards]
  affects: [financeiro-hub]
tech_stack:
  added: []
  patterns:
    - CompetenciaSelector nuqs prev/next reusable component
    - PayoutDemonstrativoSheet Sheet+Accordion demonstrativo pattern
    - RpaFormDialog BRL-mask + Estimativa preview panel (client-side, server-authoritative)
    - ReinfStatusBadge STUB badge pattern for gated integrations
    - FecharCompetenciaButton destructive AlertDialog client wrapper (mirrors CycleFormDialog)
    - RpaPageActions RSC-compatible client wrapper for dialog state
key_files:
  created:
    - src/app/(dashboard)/clinica/financeiro/repasse/page.tsx
    - src/app/(dashboard)/clinica/financeiro/rpa/page.tsx
    - src/components/financeiro/CompetenciaSelector.tsx
    - src/components/financeiro/PayoutTable.tsx
    - src/components/financeiro/PayoutDemonstrativoSheet.tsx
    - src/components/financeiro/FecharCompetenciaButton.tsx
    - src/components/financeiro/RpaTable.tsx
    - src/components/financeiro/RpaFormDialog.tsx
    - src/components/financeiro/RpaPageActions.tsx
    - src/components/financeiro/ReinfStatusBadge.tsx
  modified:
    - src/app/(dashboard)/clinica/financeiro/page.tsx
decisions:
  - "FecharCompetenciaButton extracted as 'use client' wrapper — RSC repasse page stays pure Server Component; mirrors CycleFormDialog pattern"
  - "RpaPageActions client wrapper owns RpaFormDialog open state; auto-opens when defaultSupplierId present (Gerar RPA pre-fill)"
  - "PayoutDemonstrativoSheet calls getRpaDocumentUrl for PDF export — stub path; full demonstrativo PDF requires dedicated action in future plan"
  - "financeiro hub: reconciled 16-09 nav cards to UI-SPEC icons (ArrowLeftRight/Users/FileText) and descriptions verbatim"
  - "Accordion from @base-ui/react uses 'multiple' prop not 'type=single'; DropdownMenuTrigger/PopoverTrigger/TooltipTrigger all use render-prop pattern"
metrics:
  duration: "~45 minutes"
  completed: "2026-06-22T18:34:43Z"
  tasks: 2
  files: 11
---

# Phase 16 Plan 10: Repasse & RPA Frontend Summary

**One-liner:** Repasse de Profissionais (Screen 3) and RPA & Tributos (Screen 4) with CompetenciaSelector, demonstrativo Sheet, Estimativa preview dialog, ReinfStatusBadge stub, and financeiro hub 4 nav cards — TRIB-01/02/03 usáveis.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Repasse screen + CompetenciaSelector + PayoutTable + PayoutDemonstrativoSheet | c1ed63f | 5 created |
| 2 | RPA screen + RpaFormDialog + ReinfStatusBadge + hub nav cards | c1ed63f | 6 created + 1 modified |

---

## What Was Built

### Task 1 — Repasse de Profissionais

**`CompetenciaSelector.tsx`** — Reusable client component using `useQueryState('competencia')` from nuqs. Renders prev/next chevron Buttons (ghost size-8) + label formatted "Jun/2026" (ptBR locale, capitalize). Used by both Repasse and RPA pages.

**`repasse/page.tsx`** — RSC. Reads `x-user-role`/`x-read-only` headers → `canWrite`. Calls `listPayouts({competencia, unitId})`. Renders:
- 3 KPI cards: Total Bruto / **Total a Repassar (`text-primary`)** / Profissionais
- Alert for `sem_regra` items (valor_repasse=0 and valor_bruto>0)
- `<PayoutTable>` or `<EmptyState icon=Users>`
- `<FecharCompetenciaButton>` (canWrite only)

**`PayoutTable.tsx`** — TanStack Table v8. Columns: Profissional / Competência / Bruto / Deduções / Base / % / Repasse (font-semibold) / Status (rascunho=outline, aprovado=cyan, pago=green) / Ações. Write Ações: Ver Demonstrativo / Aprovar / Gerar CP (aprovado only) / Gerar RPA. Read-only: Ver Demonstrativo only. Uses `DropdownMenuTrigger render-prop` pattern.

**`PayoutDemonstrativoSheet.tsx`** — Sheet side=right (~640px). Loads `getDemonstrativo(payoutId)` on open. Summary box (bg-muted): Valor Bruto / (−) Deduções / = Base / × Percentual / **= Valor do Repasse (`text-primary font-semibold`)**. Deduções Accordion (lab/materiais/taxa_cartao/impostos_retidos). Itens table (tabular-nums). Footer: Fechar + Exportar PDF (signed URL via `getRpaDocumentUrl`; never pdf_storage_path).

**`FecharCompetenciaButton.tsx`** — Client wrapper. Destructive AlertDialog with verbatim UI-SPEC copy: "Fechar Competência [MÊS]?" / "Após fechar…" → calls `fecharCompetencia({competencia, unitId})` → `router.refresh()`.

### Task 2 — RPA & Tributos

**`rpa/page.tsx`** — RSC. Loads `listRpas` + `listSuppliers({tipo:'autonomo'})` + `listPayables` in parallel. Renders:
- 3 KPI cards: RPAs Emitidos / INSS Total / IRRF Total
- `<RpaTable>` or `<EmptyState icon=FileText>`
- Tributos a Recolher section: filters `origem='tributo'` payables for competência, shows Baixar link to /contas-a-pagar
- `<RpaPageActions>` (client wrapper with auto-open when `?supplier=` present)

**`RpaTable.tsx`** — TanStack v8. Columns: Número / Autônomo / Competência / Bruto / INSS / IRRF / ISS / Líquido / EFD-Reinf (`<ReinfStatusBadge isStub />`) / Ações. Ações: Visualizar PDF (`getRpaDocumentUrl` → `window.open`; never pdf_storage_path) / Cancelar (AlertDialog collecting `motivo` → `estornarRpa` alçada D-24).

**`RpaFormDialog.tsx`** — Dialog + RHF + zodResolver. Fields: Autônomo Select / Competência Input[month] / Data Pagamento Popover+Calendar / Valor Bruto BRL-mask / Modalidade INSS Select / ISS Override Switch+Input. **Estimativa preview panel** (bg-muted, updates on blur, labeled "Estimativa — valores definitivos calculados no servidor ao emitir"): Bruto / (−) INSS / (−) IRRF (or "Isento") / (−) ISS (or "N/A") / = Líquido. On submit: `gerarRpa(rawInput)` → success toast + `router.refresh()`.

**`RpaPageActions.tsx`** — Client wrapper that owns RpaFormDialog open state. Auto-opens when `defaultSupplierId` present (from Repasse "Gerar RPA" navigation).

**`ReinfStatusBadge.tsx`** — shadcn Badge + @base-ui Tooltip. pendente=amber / transmitido=green / erro=red. When `isStub=true`: appends "STUB" Badge with Tooltip "EFD-Reinf em modo simulação. Conecte o provedor real no Hub de Integrações."

**`financeiro/page.tsx`** (updated) — Reconciled 4 nav cards from 16-09 to UI-SPEC verbatim icons and descriptions:
- Contas a Pagar: CreditCard, "Fornecedores, vencimentos e baixa de despesas."
- Conciliação Bancária: ArrowLeftRight (was RefreshCw), "Importe extratos OFX e bata com os lançamentos automaticamente."
- Repasse de Profissionais: Users (was Banknote), "Calcule comissões e gere demonstrativos por competência."
- RPA & Tributos: FileText (was Bot), "Emita RPA de autônomos com INSS/IRRF/ISS calculados."

**proxy.ts** — Unchanged. `/clinica/financeiro` prefix already maps to `financeiro` module; all 4 subroutes inherit automatically (D-25 satisfied).

---

## Security Mitigations (Threat Register)

| Threat | Mitigation Applied |
|--------|-------------------|
| T-16-50: PDF path exposure | `getRpaDocumentUrl` signed URL (TTL=60s) + `window.open`; `pdf_storage_path` never in client components (grep=0) |
| T-16-51: read-only elevation | UI hides write Ações when `canWrite=false` (x-read-only header); server actions enforce `assertNotReadOnly` |
| T-16-52: client Estimativa as authoritative | Panel labeled "Estimativa — valores definitivos calculados no servidor ao emitir"; `gerarRpa` recalculates server-side |
| T-16-53: cancel/close without trail | RPA Cancelar AlertDialog requires `motivo` → `estornarRpa` → `createApprovalRequest` alçada (D-24); Fechar Competência destructive AlertDialog (D-26) |
| T-16-55: EFD-Reinf stub as real | `ReinfStatusBadge` always shows "STUB" Badge + tooltip when `isStub=true` |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @base-ui Accordion prop mismatch**
- **Found during:** Build (Task 1)
- **Issue:** `<Accordion type="single" collapsible>` — `type` prop does not exist on @base-ui Accordion
- **Fix:** Removed `type` and `collapsible` props (shadcn's Accordion uses `multiple` prop)
- **Files modified:** `PayoutDemonstrativoSheet.tsx`
- **Commit:** c1ed63f

**2. [Rule 1 - Bug] DropdownMenuTrigger/PopoverTrigger/TooltipTrigger asChild pattern**
- **Found during:** Build (Tasks 1 & 2)
- **Issue:** `asChild` prop does not exist on @base-ui primitives; render-prop required
- **Fix:** Replaced `asChild` with `render={<Element />}` pattern in PayoutTable, RpaTable, RpaFormDialog, ReinfStatusBadge
- **Files modified:** `PayoutTable.tsx`, `RpaTable.tsx`, `RpaFormDialog.tsx`, `ReinfStatusBadge.tsx`
- **Commit:** c1ed63f

**3. [Rule 1 - Bug] Calendar initialFocus prop**
- **Found during:** Build (Task 2)
- **Issue:** `initialFocus` is not a valid prop on the Calendar component
- **Fix:** Removed `initialFocus` from Calendar in RpaFormDialog
- **Files modified:** `RpaFormDialog.tsx`
- **Commit:** c1ed63f

**4. [Rule 2 - Missing] FecharCompetenciaButton client wrapper**
- **Found during:** Task 1 implementation
- **Issue:** RSC repasse page cannot own AlertDialog open state; button needs client context
- **Fix:** Extracted `FecharCompetenciaButton` as 'use client' component (mirrors CycleFormDialog pattern)
- **Files modified:** `FecharCompetenciaButton.tsx` (created)
- **Commit:** c1ed63f

**5. [Rule 2 - Missing] RpaPageActions client wrapper**
- **Found during:** Task 2 implementation
- **Issue:** RSC rpa page cannot own RpaFormDialog state; auto-open from ?supplier= requires client
- **Fix:** Extracted `RpaPageActions` as 'use client' wrapper with auto-open effect
- **Files modified:** `RpaPageActions.tsx` (created)
- **Commit:** c1ed63f

**6. Hub nav cards reconciliation (16-09 overlap)**
- **Found during:** Pre-execution — context note warned of overlap
- **Action:** READ existing page.tsx first; replaced 16-09 icons/descriptions (RefreshCw/Banknote/Bot) with UI-SPEC verbatim (ArrowLeftRight/Users/FileText); descriptions updated to match copywriting contract exactly

---

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `ReinfStatusBadge isStub` always true | `RpaTable.tsx` | EFD-Reinf provider not yet wired (TRIB-03 is stub-gated per D-22); real provider connects via Hub de Integrações |
| `PayoutDemonstrativoSheet` PDF export calls `getRpaDocumentUrl` (wrong action) | `PayoutDemonstrativoSheet.tsx` | Demonstrativo PDF generation requires a dedicated `getDemonstrativoPdfUrl` action (not built in 16-08); current fallback shows error gracefully. Fix in future verification follow-up. |

---

## Self-Check: PASSED

All files exist on disk. Commit c1ed63f verified in git log.
