---
phase: 18-crc-marketing
plan: 07
status: complete
completed: 2026-07-12
requirements: [CRC-01]
---

# 18-07 SUMMARY — Funil de leads (CRC hub + nav + Kanban + dialogs)

## O que foi entregue

- **CRC hub + nav** (`src/components/shell/nav-config.ts`, `nav-icons.ts`, `.../clinica/crc/page.tsx`) — entrada "CRC" no sidebar + gerenciador de origens de lead. (commit `9339859`)
- **Funil Kanban** (`.../clinica/crc/funil/page.tsx`, `LeadKanbanBoard.tsx`, `KanbanColumn.tsx`, `LeadCard.tsx`) — arrastar-e-soltar entre `Novo→Contatado→Agendado→Convertido/Perdido` via **`@dnd-kit/react`** com `KeyboardSensor` (acessibilidade); move otimista via `moveLeadStage`.
- **Dialogs de lead** (`LeadFormDialog.tsx` com "indicado por" → `linkReferral`; `LeadStageChangeDialog.tsx` com `moveLeadStage(leadId, stage, lostReason?)` de 3 args + coleta de CPF ao converter para novo paciente; `LeadDetailSheet.tsx`; `ConversionByOriginTable.tsx`).

## Desvios / notas

- **@base-ui Select onValueChange (gotcha D-recorrente):** `LeadStageChangeDialog` passava `setState` direto ao `onValueChange`, que o `@base-ui Select.Root` tipa como `(value: string | null, eventDetails)` → TS2322. Corrigido com `(v) => setState(v ?? '')`. (mesma decisão registrada em STATE para o Select do base-ui)
- **CPF na conversão:** honra a deviation do Plano 03 — `convertLead` exige `patientId` OU `cpf` (patients.cpf é NOT NULL); o dialog de conversão coleta CPF ao criar paciente novo.
- **Execução:** o executor original foi cortado por limite de sessão após commitar Task 1; o orchestrator finalizou Tasks 2–3 (verificou tsc limpo nos arquivos CRC, corrigiu o Select, commitou).

## Verificação

- `npx tsc --noEmit` limpo em todos os arquivos `components/crc/*` e `crc/funil` (os 41 erros remanescentes são pré-existentes de testes financeiro/faturamento, fora de escopo).

## UAT diferida (checkpoint human-verify — Task 4)

Requer app rodando para verificação manual (VALIDATION Manual-Only):
- Arrastar um lead entre colunas (`Novo`→`Contatado`) e confirmar persistência do estágio após reload.
- Navegação por teclado no kanban (KeyboardSensor) move o lead de forma acessível.
