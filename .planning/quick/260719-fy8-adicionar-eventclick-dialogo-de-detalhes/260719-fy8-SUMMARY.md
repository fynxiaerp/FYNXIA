---
phase: quick-260719-fy8
plan: 01
subsystem: agenda
tags: [agenda, appointments, ui, status-transition]
dependency-graph:
  requires: [updateAppointment (src/actions/appointments.ts)]
  provides: [AppointmentDetailDialog, eventClick handler in AgendaCalendar]
  affects: [nps-scan (dispara em appointments.status='concluido'), OS-01 (auto-criação de OS ao concluir)]
tech-stack:
  added: []
  patterns:
    - "eventClick FullCalendar handler mirroring existing eventDrop/select pattern"
    - "status-only edit dialog reusing an existing server action (no new action created)"
key-files:
  created: []
  modified:
    - src/components/agenda/AgendaCalendar.tsx
decisions:
  - "AppointmentDetailDialog is status-only (no date/dentist edit) — those flows already exist via drag-and-drop and NewAppointmentDialog"
  - "handleStatusUpdated mirrors handleEventDrop's local calendarEvents map pattern so eventClassNames recolors instantly without reload"
metrics:
  duration: "~10 minutes"
  completed: "2026-07-19"
---

# Phase quick-260719-fy8 Plan 01: Adicionar eventClick + diálogo de detalhes na Agenda Summary

Adiciona `eventClick` ao FullCalendar de `/clinica/agenda` com um novo diálogo `AppointmentDetailDialog` (status-only) que reusa `updateAppointment` para destravar a transição manual de status de consultas existentes.

## What Was Built

- `eventClick={handleEventClick}` adicionado ao `<FullCalendar>` em `AgendaCalendar.tsx`, ao lado de `eventDrop`/`select` já existentes.
- `handleEventClick` (useCallback) lê `info.event` (id, title, start/end, `extendedProps.status`/`dentistId`) e abre `detailDialog` state.
- Novo componente `AppointmentDetailDialog` (mesmo arquivo, mesmo padrão visual de `NewAppointmentDialog`):
  - Campos read-only: Paciente, Dentista (resolvido via `dentists.find(d => d.id === dentistId)?.full_name`, nunca UUID cru), Data/Hora (`toLocaleDateString`/`toLocaleTimeString` pt-BR).
  - `<Select>` de status com 5 opções do enum (`agendado`, `confirmado`, `em_atendimento`, `concluido`, `cancelado`), rótulos pt-BR via novo `STATUS_LABELS` map (mirrors `STATUS_CLASS_MAP`).
  - `handleSave` chama `updateAppointment(appointmentId, { status: selectedStatus })`; em sucesso, `onStatusUpdated` + `onClose`; em erro, `Alert variant="destructive"` dentro do diálogo.
  - Botões Cancelar/Salvar com `isSubmitting` ("Salvando…").
- `handleStatusUpdated(id, newStatus)` atualiza `calendarEvents` local (mesmo padrão de `handleEventDrop`), fazendo `eventClassNames`/`STATUS_CLASS_MAP` recolorir o evento sem reload.
- Nenhum novo arquivo, rota ou server action criado — apenas `src/components/agenda/AgendaCalendar.tsx` modificado, conforme escopo do plano.

## How It Works

1. Usuário clica numa consulta existente no calendário → `eventClick` dispara `handleEventClick` → abre `AppointmentDetailDialog` com os dados do evento clicado.
2. Usuário troca o status no `<Select>` e clica "Salvar" → `updateAppointment(id, { status })` é chamado (mesma server action que já valida roles, revalida disponibilidade só quando horário/dentista mudam — aqui não mudam — dispara auto-criação de OS rascunho quando `status === 'concluido'` (OS-01), e trata conflito 23P01).
3. Em sucesso: `onStatusUpdated` atualiza o estado local `calendarEvents`, recolorindo o evento imediatamente; diálogo fecha.
4. Em erro: `Alert` destrutivo aparece dentro do diálogo, sem fechar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `onValueChange` do Select de status incompatível com tipo `string | null`**
- **Found during:** Task 1 (verificação `npx tsc --noEmit`)
- **Issue:** O `Select` do projeto (via `@base-ui/react`, conforme decisão documentada em STATE.md — "`@base-ui Select.Root onValueChange` recebe `(value: T | null, ...)`") retorna `string | null`; o handler original `(v) => setSelectedStatus(v)` não aceitava `null`, causando erro TS2345.
- **Fix:** `onValueChange={(v) => v && setSelectedStatus(v)}` — mesmo padrão de guard já usado em outros Selects do projeto.
- **Files modified:** `src/components/agenda/AgendaCalendar.tsx`
- **Commit:** `934f51b`

No outras — plano executado conforme escrito.

## Task 2 (checkpoint:human-verify) — NOT executed by this agent

Conforme instrução do orquestrador, o Task 2 (`checkpoint:human-verify`) não foi executado nesta sessão. Ele será verificado via Playwright em produção após deploy, cobrindo:
1. Abrir diálogo ao clicar em consulta existente (paciente, dentista por nome, data/hora, status atual).
2. Trocar status para "Concluído" e salvar → diálogo fecha, evento recolore sem reload.
3. (Opcional) Confirmar OS rascunho criada em `/clinica/financeiro/faturamento/os`.
4. Reabrir a mesma consulta → status "Concluído" persistido.
5. Trocar para "Cancelado" e salvar → evento fica vermelho/riscado.

## Self-Check: PASSED

- `src/components/agenda/AgendaCalendar.tsx` — FOUND (modificado, commit `934f51b`)
- Commit `934f51b` — FOUND em `git log --oneline`
- `npx tsc --noEmit` — sem erros em `AgendaCalendar.tsx` (erros pré-existentes em arquivos de teste não relacionados a Financeiro/TISS permanecem, fora de escopo)
