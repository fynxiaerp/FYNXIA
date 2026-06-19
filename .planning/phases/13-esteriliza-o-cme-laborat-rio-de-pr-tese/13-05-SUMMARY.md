---
phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese
plan: 05
subsystem: database
tags: [database, migration, blocking, gen-types]
key-files:
  created: []
  modified:
    - src/types/database.types.ts
metrics:
  tasks: 1
  duration: "~human checkpoint + inline apply"
requirements: [CME-01, CME-02, CME-03, LAB-01, LAB-02]
---

# Plan 13-05 — [BLOCKING] db push + gen types

## What was built

Aplicadas as quatro migrations da Fase 13 ao projeto Supabase de produção `jqjwyqlbbuqnrffdnlpp` (org `kczvihafddupruvsrrsc`) e regenerados os tipos TypeScript.

- `20260619000100_sterilization_cycles.sql` — `sterilization_cycles` + `kit_usages`
- `20260619000200_sterilization_rls.sql` — RLS USING+WITH CHECK nas tabelas CME
- `20260619000300_prosthetic_labs.sql` — `prosthetic_labs` + `lab_orders` (+ `financial_transaction_id` FK)
- `20260619000400_lab_orders_rls.sql` — RLS USING+WITH CHECK nas tabelas LAB

`src/types/database.types.ts` regenerado (3527 linhas) contendo `sterilization_cycles`, `kit_usages`, `prosthetic_labs`, `lab_orders`.

## Deviations

- **Checkpoint executado inline pelo orquestrador** (não por subagente): este é um `checkpoint:human-action`. O CLI estava logado na conta errada (gotcha MEMORY.md — projetos `nexus-*`); o humano rodou `supabase login` para re-autenticar na conta FYNXIA, e o orquestrador validou (`projects list` mostrou `jqjwyqlbbuqnrffdnlpp ●`) antes de aplicar o push e regenerar os types com o guard de truncamento (temp `.t` → verificou >1000 linhas + 4 tabelas → `mv` atômico, escrito sem BOM).

## Self-Check: PASSED

- `supabase projects list` mostrou `jqjwyqlbbuqnrffdnlpp` ● antes do push ✓
- `supabase db push` aplicou as 4 migrations sem erro ✓
- Guard de truncamento satisfeito (3527 linhas; 4 tabelas presentes) antes do overwrite ✓
- `src/types/database.types.ts` contém sterilization_cycles, kit_usages, prosthetic_labs, lab_orders ✓
- `npx tsc --noEmit` exit 0 ✓
