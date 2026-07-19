---
phase: quick-260719-dkz
plan: 01
subsystem: ui
tags: [react-hook-form, zod, base-ui, select, tabs, agenda, professionals]

# Dependency graph
requires:
  - phase: quick-260719-1wv
    provides: correção do bug crítico da Agenda (botão "Nova Consulta" + calendário oculto) — UAT que revelou estes dois bugs adicionais
provides:
  - SelectValue do NewAppointmentDialog resolve full_name do dentista (nunca mais exibe UUID cru)
  - ProfessionalForm com feedback de validação visível independente da aba ativa (Tabs controlado + onInvalid + Alert)
affects: [agenda, professionals]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SelectValue com children resolvendo UUID->nome (dentists.find) — mesmo padrão em dois Selects do mesmo arquivo agora"
    - "RHF handleSubmit(onSubmit, onInvalid) + Tabs controlado para expor erros de validação em abas ocultas"

key-files:
  created: []
  modified:
    - src/components/agenda/AgendaCalendar.tsx
    - src/components/professionals/ProfessionalForm.tsx

key-decisions:
  - "FIELD_TAB/FIELD_LABEL como Record<string,string> estáticos dentro do componente — evita nova dependência ou arquivo de validators só para o mapeamento de UI"

patterns-established:
  - "Ao adicionar novo campo obrigatório a um form com Tabs, registrar em FIELD_TAB/FIELD_LABEL (ProfessionalForm.tsx) para manter o onInvalid funcional"

requirements-completed: [UAT-BUGFIX]

# Metrics
duration: 10min
completed: 2026-07-19
---

# Quick Task 260719-dkz: Corrigir dois bugs de UI (dentista mostra UUID + validação invisível) Summary

**SelectValue do NewAppointmentDialog resolve full_name do dentista via `dentists.find`; ProfessionalForm ganha Tabs controlado + `onInvalid` que troca de aba e exibe Alert quando um campo obrigatório em aba oculta bloqueia o submit.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- Bug A corrigido: o Select de dentista do diálogo "Novo Agendamento" agora exibe o nome do dentista selecionado, usando o mesmo padrão (`dentists.find(d => d.id === selectedDentistId)?.full_name`) já usado no Select de filtro do topo do calendário no mesmo arquivo.
- Bug B corrigido: `ProfessionalForm` agora torna as `Tabs` controladas (`activeTab` state) e adiciona um handler `onInvalid` ligado via `form.handleSubmit(onSubmit, onInvalid)`, que troca automaticamente para a aba do primeiro campo inválido e renderiza um `Alert` destrutivo no topo listando os campos com erro (rótulos pt-BR via `FIELD_LABEL`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Bug A — resolver nome do dentista no SelectValue do NewAppointmentDialog** - `4c7f2b5` (fix)
2. **Task 2: Bug B — tornar erros de validação visíveis independente da aba ativa em ProfessionalForm** - `f8e4381` (fix)

_Note: no TDD tasks in this plan — both are `type="auto"` UI fixes._

## Files Created/Modified
- `src/components/agenda/AgendaCalendar.tsx` - `NewAppointmentDialog`'s `SelectValue` now takes children resolving `selectedDentistId` to `full_name`, matching the existing filter Select pattern in the same file
- `src/components/professionals/ProfessionalForm.tsx` - Added `FIELD_TAB`/`FIELD_LABEL` maps, `activeTab`/`validationErrors` state, controlled `Tabs`, `onInvalid` handler wired into `form.handleSubmit(onSubmit, onInvalid)`, and a destructive `Alert` rendered above the tabs when validation errors exist

## Decisions Made
- Kept `FIELD_TAB`/`FIELD_LABEL` as plain module-scope `Record<string, string>` constants inside `ProfessionalForm.tsx` rather than extracting to a validators file — this UI-only concern (field→tab, field→pt-BR label) has no reuse outside this component and the plan's `files_modified` list did not include a new lib file.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` blocks precisely, including the exact code patterns specified in the plan (SelectValue children resolver, FIELD_TAB/FIELD_LABEL maps, onInvalid signature, Alert markup).

## Issues Encountered

None. `npx tsc --noEmit` was run after both changes; it reports pre-existing errors in unrelated test files (`src/__tests__/faturamento/tiss.test.ts`, `chart-of-accounts.test.ts`, `migrations-phase14.test.ts`, `transaction-classification.test.ts`, `payables.test.ts`, `ofx-parser.test.ts`, `payout-math.test.ts`, `reconciliation.test.ts` — all `TS2532`/`TS1501`, none touching the two files modified in this plan). These are out of scope per the deviation rules' scope boundary (pre-existing, unrelated to this task's changes) and were not fixed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Both UAT-flagged bugs from the 260719-1wv session are now resolved. Suggested manual verification (per plan's `<verification>` section):
- (A) Open "Novo Agendamento" dialog, select a dentist → name appears instead of UUID.
- (B) Edit a professional with "Nome completo" empty, go to "Horários" tab, add a schedule, click "Salvar Alterações" → form switches to "Ficha" tab and shows the validation Alert; `FormMessage` on the empty field is visible.

No blockers for future work. The "tabela de listagem de profissionais" UUID/empty-cell issues noted in STATE.md's 260719-1wv session entry (list page showing raw UUIDs for Unidade/Login vinculado, empty name cells) were NOT part of this plan's scope and remain open for a future quick task if still reproducing.

---
*Quick task: 260719-dkz*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: src/components/agenda/AgendaCalendar.tsx
- FOUND: src/components/professionals/ProfessionalForm.tsx
- FOUND: .planning/quick/260719-dkz-corrigir-dois-bugs-de-ui-dentista-mostra/260719-dkz-SUMMARY.md
- FOUND: commit 4c7f2b5
- FOUND: commit f8e4381
