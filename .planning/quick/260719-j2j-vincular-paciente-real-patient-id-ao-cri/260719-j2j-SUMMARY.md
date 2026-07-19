---
phase: quick-260719-j2j
plan: 01
subsystem: ui
tags: [nextjs, supabase, agenda, appointments, patients, select]

requires:
  - phase: quick-260719-goi
    provides: "createAppointment/createPublicAppointment com unit_id resolvido corretamente (pré-requisito para qualquer criação de consulta funcionar em produção)"
provides:
  - "Select de paciente real (patients.id/full_name) na criação de consulta na Agenda, substituindo o Input de texto livre que nunca chegava a appointments.patient_id"
affects: [agenda, crc-nps-scan, faturamento-os]

tech-stack:
  added: []
  patterns:
    - "Fetch all + client Select (mesmo padrão já usado para dentists) reaplicado para patients"

key-files:
  created: []
  modified:
    - "src/app/(dashboard)/clinica/agenda/page.tsx"
    - "src/components/agenda/AgendaCalendar.tsx"

key-decisions:
  - "Select de paciente reusa exatamente o padrão fetch-all + client Select já usado para dentistas nesta mesma tela — sem nova server action nem busca assíncrona/autocomplete"
  - "Opção __none__ ('Sem paciente vinculado') preserva o comportamento opcional existente — patient_id continua podendo ser omitido"

patterns-established:
  - "Padrão fetch-all + client Select (id, full_name) replicado para uma segunda entidade (patients) na mesma tela — reutilizável para futuros selects de entidade no mesmo componente"

requirements-completed: [QUICK-260719-j2j]

duration: ~10min
completed: 2026-07-19
---

# Quick Task 260719-j2j: Vincular paciente real (patient_id) ao criar consulta na Agenda

**Select de paciente real substitui o Input de texto livre em NewAppointmentDialog — appointments.patient_id agora é gravado com o UUID do paciente selecionado, destravando o cron de NPS (patients!inner) e demais fluxos dependentes de patient_id.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `agenda/page.tsx` agora busca `patients (id, full_name)` do tenant (filtrando `deleted_at IS NULL`), espelhando exatamente a query já existente para `dentists`
- `AgendaCalendar`/`NewAppointmentDialog` recebem e usam a prop `patients: Patient[]`
- O campo "Nome do Paciente (opcional)" (texto livre, nunca enviado a `createAppointment`) foi substituído por um `<Select>` de paciente real, com opção padrão "Sem paciente vinculado"
- `handleCreate` agora envia `patient_id: selectedPatientId ?? undefined` a `createAppointment` — grava o UUID real quando selecionado, `null` quando "Sem paciente vinculado"
- Título do evento no calendário resolve o nome do paciente selecionado via `.find()`, com fallback "Novo Agendamento"

## Task Commits

Each task was committed atomically:

1. **Task 1: Fetch de patients no Server Component e propagação da prop** - `036ee8e` (feat)
2. **Task 2: Substituir Input de texto livre por Select de paciente no NewAppointmentDialog** - `2762211` (feat)

_Note: as duas mudanças de código de tarefa estavam entrelaçadas no mesmo arquivo/funções (AgendaCalendar.tsx); foram separadas em dois commits atômicos revertendo temporariamente as partes da Tarefa 2 (estado/handleCreate/Select) antes do commit da Tarefa 1, e reaplicando-as em seguida para o commit da Tarefa 2._

## Files Created/Modified
- `src/app/(dashboard)/clinica/agenda/page.tsx` - Query de `patients` do tenant (id, full_name), passada como prop `patients` para `AgendaCalendar`
- `src/components/agenda/AgendaCalendar.tsx` - Interface `Patient`; prop `patients` propagada a `NewAppointmentDialog`; Select de paciente (com `__none__`) substituindo o Input de texto livre; `patient_id` enviado a `createAppointment`; título do evento resolvido via `.find()`

## Decisions Made
- Select de paciente reusa exatamente o padrão já existente para dentistas (fetch-all no Server Component + client Select com resolução id→nome via `.find()`) — nenhuma nova server action, componente de busca assíncrona/autocomplete, ou alteração em `createAppointment`/Zod schema
- Padrão `__none__` (já usado em `ProfessionalForm.tsx`) reaplicado para a opção "Sem paciente vinculado", preservando `patient_id` opcional/nulo

## Deviations from Plan

None - plan executado exatamente como escrito. `createAppointment`, `updateAppointment` e o Zod schema (`appointmentSchema`) não foram tocados, conforme instruído.

## Issues Encountered
Nenhum. `tsc --noEmit` e `npm run build` limpos em ambas as tarefas; os erros pré-existentes de `tsc` em arquivos de teste (`tiss.test.ts`, `chart-of-accounts.test.ts`, `ofx-parser.test.ts`, `payout-math.test.ts`, `reconciliation.test.ts`, `transaction-classification.test.ts`, `payables.test.ts`, `migrations-phase14.test.ts`) foram confirmados como pré-existentes via `git stash` antes de iniciar (fora de escopo — não relacionados a este quick task).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Fluxo de criação de consulta na Agenda agora coleta um `patient_id` real, destravando o cron `nps-scan.ts` (que usa `patients!inner(...)`) e qualquer outro fluxo dependente de `appointments.patient_id`
- Verificação manual em produção pós-deploy ainda pendente (fora do escopo de código deste quick task): abrir "Nova Consulta" → selecionar paciente real → salvar → confirmar via trilha de auditoria/DB que `appointments.patient_id` foi gravado

---
*Phase: quick-260719-j2j*
*Completed: 2026-07-19*

## Self-Check: PASSED

All modified files and both task commits verified present on disk / in git history.
