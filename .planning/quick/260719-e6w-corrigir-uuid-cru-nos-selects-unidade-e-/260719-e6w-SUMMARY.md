---
phase: quick-260719-e6w
plan: 01
subsystem: professionals-ui
tags: [ui-fix, select, professionals]
dependency-graph:
  requires: []
  provides: []
  affects: [src/components/professionals/ProfessionalForm.tsx]
tech-stack:
  added: []
  patterns:
    - "SelectValue children resolvem id→nome via .find(), com fallback null/placeholder"
key-files:
  created: []
  modified:
    - src/components/professionals/ProfessionalForm.tsx
decisions: []
metrics:
  duration: 5min
  completed: 2026-07-19
---

# Quick Task 260719-e6w: Corrigir UUID cru nos selects Unidade e Login vinculado Summary

Os dois `<SelectValue>` da aba "Ficha" do `ProfessionalForm.tsx` (Unidade e Login
vinculado) exibiam o UUID selecionado em texto cru em vez do nome legível.

## What Changed

- **Unidade:** `<SelectValue>` ganhou `children` que resolvem `field.value` para
  `units.find((u) => u.id === field.value)?.name`, com fallback ao placeholder
  quando não há valor ou o id não é encontrado.
- **Login vinculado:** `<SelectValue>` ganhou `children` que resolvem
  `dentistUsers.find((u) => u.id === field.value)?.full_name`, preservando o
  caso especial `field.value === '__none__'`/`null` → exibe "Sem login".

Ambas as correções replicam o padrão já usado em `AgendaCalendar.tsx` (commit
`4c7f2b5`), onde um filho `null` no `SelectValue` faz o componente cair de volta
para o `placeholder`.

Nenhuma outra lógica do form (`onValueChange`, `value`, schema, defaultValues)
foi alterada — fix puramente de apresentação.

## Verification

- `npx tsc --noEmit`: sem erros em `ProfessionalForm.tsx` (erros pré-existentes
  em arquivos de teste financeiro/tiss são anteriores a este trabalho e fora do
  escopo desta task).
- Verificação visual em produção fica pendente para um checkpoint pós-deploy
  (fora deste plano, conforme `<verification>` do PLAN.md).

## Deviations from Plan

None - plan executado exatamente como escrito.

## Self-Check

- FOUND: src/components/professionals/ProfessionalForm.tsx (modificado)
- FOUND commit: 4a900b1

## Self-Check: PASSED
