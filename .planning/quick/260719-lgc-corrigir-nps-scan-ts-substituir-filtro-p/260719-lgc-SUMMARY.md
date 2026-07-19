---
phase: quick-260719-lgc
plan: 01
subsystem: crc
tags: [supabase, postgrest, nps, cron, self-healing]

# Dependency graph
requires:
  - phase: 18-crc-marketing
    provides: runNpsInviteScan (CRC-04) and the nps-scan cron endpoint
provides:
  - Fixed appointments/patients fetch in runNpsInviteScan so the nightly NPS cron actually finds eligible appointments in production
affects: [crc, nps, cron]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two sequential Supabase queries + in-memory Map join, instead of a nested PostgREST embed filter (patients!inner + dot-notation), when dot-notation embed predicates silently return zero rows in production"

key-files:
  created: []
  modified:
    - src/lib/crc/nps-scan.ts

key-decisions:
  - "Replaced the single embed query (patients!inner(...) + .is('patients.deleted_at')/.eq('patients.is_anonymized')) with two plain queries (appointments, then patients .in('id', patientIds)) joined via a Map in application code — root cause was the nested PostgREST embed filter returning zero rows in production despite a direct SQL join confirming eligible data existed"

patterns-established:
  - "When a PostgREST embed filter (`table!inner(...)` + dot-notation .is()/.eq() predicates) is suspected of returning wrong/empty results, split into two direct queries joined in application code rather than debugging the embed syntax further"

requirements-completed: [CRC-04]

# Metrics
duration: 15min
completed: 2026-07-19
---

# Phase quick-260719-lgc: Corrigir nps-scan.ts Summary

**Substituído o embed filter PostgREST (`patients!inner` + dot-notation) por duas queries sequenciais no `runNpsInviteScan`, que retornava zero linhas em produção mesmo com dado elegível real existente**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-19T18:18:00Z
- **Completed:** 2026-07-19T18:33:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `runNpsInviteScan` agora busca appointments concluídos sem embed, depois busca pacientes elegíveis via `.in('id', patientIds)` com filtros diretos (`deleted_at IS NULL`, `is_anonymized=false`)
- Junção feita em memória via `Map<string, PatientRel>`, produzindo exatamente a mesma forma (`{ id, tenant_id, unit_id, patient_id, patients }`) que o loop de convite já esperava
- Loop de convite (insert `nps_responses`, dedup 23505, enqueue outbox WhatsApp/email, `logBusinessEvent`) permanece byte-a-byte inalterado
- Assinatura da função e `route.ts` chamador inalterados

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace nested embed fetch with two sequential queries** - `de49d14` (fix)

_Note: quick task — no separate plan metadata commit; docs commit handled by orchestrator._

## Files Created/Modified
- `src/lib/crc/nps-scan.ts` - Fetch de appointments+patients reescrito de embed único para duas queries sequenciais unidas em memória; comentário de cabeçalho atualizado explicando o root cause e o motivo da reescrita

## Decisions Made
- Mantido `PatientRel` como estava (sem adicionar `deleted_at`/`is_anonymized` ao tipo) — essas colunas são só para o WHERE da segunda query, não fazem parte do shape consumido pelo loop
- Early-return em `patientIds.length === 0` antes de chamar `.in('id', [])`, evitando uma chamada inválida ao PostgREST

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. `npx tsc --noEmit` mantém a mesma contagem de erros pré-existentes (41, todos em arquivos de teste de `financeiro`/`faturamento`, fora do escopo desta correção — confirmado comparando antes/depois via `git stash`). `npm run build` passou sem erros.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Correção pronta para deploy. A verificação end-to-end definitiva (confirmar que `nps_responses`/`message_outbox` recebem uma linha real após o cron rodar em produção) é um passo manual pós-deploy, descrito na seção `<verification>` do plano — não automatizável neste quick task porque depende do comportamento runtime do PostgREST em produção, não do código local.

## Self-Check: PASSED

- FOUND: src/lib/crc/nps-scan.ts
- FOUND: .planning/quick/260719-lgc-corrigir-nps-scan-ts-substituir-filtro-p/260719-lgc-SUMMARY.md
- FOUND: de49d14 (commit)
