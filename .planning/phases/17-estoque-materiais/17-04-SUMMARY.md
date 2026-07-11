---
phase: 17-estoque-materiais
plan: 04
subsystem: api
tags: [withAgentPolicy, ai-governance, vercel-cron, estoque, alertas, anvisa]

# Dependency graph
requires:
  - phase: 17-estoque-materiais/01
    provides: stock-agent.test.ts + cron-validade.test.ts RED source-inspection scaffolds
  - phase: 17-estoque-materiais/02
    provides: 6 estoque tables (products, product_batches, stock_entries, stock_draws, service_material_templates, stock_alerts) + RLS + payables.origem CHECK extended with 'estoque_agente' + approval_requests.requested_by nullable
provides:
  - runStockReplenishmentAgent (withAgentPolicy L2 — cria rascunho de payable + approval_request quando produto tem preferred_supplier_id + estoque_maximo; senão apenas alerta)
  - insertStockAlert (helper reutilizável — app-level daily dedup por produto/unidade/tipo, fuso America/Sao_Paulo)
  - listActiveAlerts/getAlertCounts Server Actions para o banner/dashboard de estoque
  - GET /api/cron/estoque-validade (cron semanal — varre lotes com validade <= hoje+30d)
affects: [17-estoque-materiais/05, 17-estoque-materiais UI plans (dashboard, banner)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "insertStockAlert usa dedup diario em app-level (SELECT antes do INSERT, janela [00:00,24:00) em America/Sao_Paulo) em vez de ON CONFLICT com expressao de indice, porque supabase-js upsert/onConflict so aceita nomes de coluna, nao expressoes; catch de 23505 no INSERT como rede de seguranca contra corrida"
    - "Agente L2 mirrors collection-agent.ts: withAgentPolicy chamado com clinicId real do produto/unidade (nunca agregado), actorId=null (ator de sistema)"

key-files:
  created:
    - src/lib/agents/stock-agent.ts
    - src/actions/stock-alerts.ts
    - src/app/api/cron/estoque-validade/route.ts
  modified:
    - vercel.json

key-decisions:
  - "insertStockAlert usa app-level daily-dedup (SELECT + INSERT) em vez de ON CONFLICT com o target de expressao uq_stock_alerts_daily ((created_at AT TIME ZONE 'America/Sao_Paulo')::date), pois o cliente supabase-js so suporta onConflict por nome de coluna simples — expressoes de indice nao sao expressaveis via REST/PostgREST upsert. O indice unico no banco continua sendo o backstop atomico (catch defensivo do erro 23505)."
  - "runStockReplenishmentAgent sempre chama insertStockAlert tipo=minimo (mesmo quando cria CP) para garantir visibilidade no banner independente do fluxo de aprovacao"
  - "Cron de validade delega a insercao do alerta para insertStockAlert (reuso do helper do Task 1) em vez de duplicar a logica de idempotencia"

patterns-established:
  - "insertStockAlert e o unico ponto de escrita em stock_alerts — tanto o agente de minimo quanto o cron de validade o chamam, garantindo idempotencia consistente"

requirements-completed: [EST-03]

# Metrics
duration: 20min
completed: 2026-07-11
---

# Phase 17 Plan 04: Agente de Compras L2 + Alertas + Cron de Validade Summary

**Agente L2 (withAgentPolicy) que cria rascunho de CP + approval_request ao detectar estoque abaixo do mínimo (com fornecedor/máximo configurados), helper de alerta idempotente por dia, Server Actions de leitura para o dashboard, e cron semanal de validade de lotes — tornando GREEN os RED tests de stock-agent e cron-validade plantados no Plan 01**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 3 created, 1 modified (vercel.json)

## Accomplishments
- `runStockReplenishmentAgent` (src/lib/agents/stock-agent.ts): governança L2 via `withAgentPolicy` (agentKey=`stock_replenishment`, actionSensitivity=`reversible`, clinicId sempre real per-row — Pitfall 3). Com `preferred_supplier_id` + `estoque_maximo` configurados, cria rascunho de `payables` (`origem='estoque_agente'`) + `approval_requests` (`requested_by: null` = ator de sistema, inbox humano da Fase 10) + `logBusinessEvent`. Sem esses campos, apenas insere `stock_alert` tipo='minimo' (D-15).
- `insertStockAlert`: helper idempotente por produto/unidade/tipo/dia (fuso America/Sao_Paulo) — usado tanto pelo agente quanto pelo cron de validade.
- `src/actions/stock-alerts.ts`: `listActiveAlerts(unitId?)` (alertas não resolvidos + nome do produto, ordenados por created_at desc) e `getAlertCounts(unitId?)` (`{ minimo, validade, negativo }` — negativo computado por SUM(product_batches.saldo_disponivel) agrupado por produto+unidade).
- `GET /api/cron/estoque-validade`: nodejs runtime, `isCronAuthorized` fail-closed, `createAdminClient`, varre `product_batches` com `data_validade <= hoje+30d` e `saldo_disponivel > 0`, insere um alerta por lote via `insertStockAlert` (D-16 — não dispara o agente de compras, vencimento é descarte). Registrado em `vercel.json` para segunda-feira 05:00.
- `stock-agent.test.ts` e `cron-validade.test.ts` (RED desde o Plan 01) agora GREEN — 9/9 assertions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Agente de compras L2 + helper de alertas** - `0123b7b` (feat)
2. **Task 2: Server Actions de leitura de alertas** - `91cc01f` (feat)
3. **Task 3: Cron semanal de validade + registro no vercel.json** - `dcbbcc0` (feat)

## Files Created/Modified
- `src/lib/agents/stock-agent.ts` - `runStockReplenishmentAgent` + `insertStockAlert` (agente L2 + helper de alertas idempotente)
- `src/actions/stock-alerts.ts` - `listActiveAlerts` + `getAlertCounts` (leitura para banner/dashboard)
- `src/app/api/cron/estoque-validade/route.ts` - cron semanal de validade de lotes
- `vercel.json` - novo cron `/api/cron/estoque-validade` (segunda-feira 05:00)

## Decisions Made

- **Dedup diária de `stock_alerts` em app-level, não via `ON CONFLICT` de expressão:** o índice único `uq_stock_alerts_daily` usa a expressão `((created_at AT TIME ZONE 'America/Sao_Paulo')::date)` (mudança feita na aplicação da migration porque `created_at::date` sobre timestamptz não é IMMUTABLE — erro 42P17). O cliente `supabase-js` (`.upsert({ onConflict })`) só aceita listas de nomes de coluna como conflict target — não é possível expressar um índice de expressão via essa API, e uma chamada RPC/SQL bruto criaria uma dependência de migration nova fora do escopo deste plano (mudança arquitetural — Regra 4). Optei por implementar a idempotência em `insertStockAlert`: um `SELECT` por `product_id + unit_id + clinic_id + tipo` dentro da janela `[00:00, 24:00)` do dia corrente em `America/Sao_Paulo` antes do `INSERT`, com um `catch` do código de erro `23505` como rede de segurança contra condição de corrida (o índice único do banco permanece como o backstop atômico final). Este é o approach que o helper structure do plano melhor suportava sem exigir uma migration adicional.
- **`insertStockAlert` sempre insere o alerta de mínimo mesmo quando o agente cria a CP** — garante que o banner de estoque sempre reflita o estado de mínimo, independentemente do fluxo de aprovação da CP ainda estar pendente.
- **Cron de validade reutiliza `insertStockAlert`** em vez de duplicar a lógica de dedup — único ponto de escrita em `stock_alerts` no codebase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `ON CONFLICT` com expressão de índice não expressável via supabase-js**
- **Found during:** Task 1 (implementação de `insertStockAlert`)
- **Issue:** O plano e o RESEARCH sugeriam `upsert(...).onConflict(...)` mirando `uq_stock_alerts_daily`, mas esse índice usa uma expressão `((created_at AT TIME ZONE 'America/Sao_Paulo')::date)`, e a API `onConflict` do `supabase-js`/PostgREST só aceita nomes de coluna simples como conflict target — não suporta expressões.
- **Fix:** Implementada dedup diária em application-level (SELECT antes do INSERT, com bounds calculados em `America/Sao_Paulo`) + catch defensivo de `23505` no INSERT, preservando o índice único do banco como backstop atômico. Documentado no cabeçalho de `stock-agent.ts` e nas key-decisions acima.
- **Files modified:** `src/lib/agents/stock-agent.ts`
- **Commit:** `0123b7b`

Nenhuma outra mudança arquitetural foi necessária — o restante do plano foi executado conforme especificado (assinaturas, nomes de arquivo, roles, dedup pattern) exatamente como escrito.

## Issues Encountered
None além do documentado acima (Rule 3, resolvido inline).

## User Setup Required

None — nenhuma configuração de serviço externo necessária. O agente `stock_replenishment` precisa estar seedado em `ai_agent_config` (autonomy_level L2) por clínica para executar em vez de apenas sugerir — isso é responsabilidade de uma migration de seed (verificar se já coberta pela migration de Plan 02/04 ou se pendente para um plano futuro; não bloqueia este plano pois `withAgentPolicy` tem fallback conservador L0/disabled quando a config está ausente).

## Next Phase Readiness

- `runStockReplenishmentAgent` está pronto para ser chamado pela Server Action de baixa automática (`drawMaterialsForProcedures`, Plan 05) quando `saldo_atual <= estoque_minimo` for detectado em tempo real (D-14).
- `listActiveAlerts`/`getAlertCounts` estão prontos para consumo pelas telas de dashboard/banner (`/clinica/estoque`).
- `src/__tests__/estoque/stock-draws.test.ts` permanece intencionalmente RED (5/5 falhando) — escopo do Plan 05 (baixa automática/manual, `drawMaterialsForProcedures`, `logBusinessEvent`), fora do escopo deste plano (confirmado pré-existente, não regressão introduzida aqui).
- `npx tsc --noEmit` reporta zero erros novos nos 3 arquivos criados + `vercel.json` (erros pré-existentes em `src/__tests__/faturamento`, `src/__tests__/financeiro*` e `src/lib/financeiro/__tests__` são de fases 14-16, não relacionados a este plano).

---
*Phase: 17-estoque-materiais*
*Completed: 2026-07-11*

## Self-Check: PASSED

All 3 created files verified present (src/lib/agents/stock-agent.ts, src/actions/stock-alerts.ts, src/app/api/cron/estoque-validade/route.ts); vercel.json modification verified; all 3 task commit hashes (0123b7b, 91cc01f, dcbbcc0) verified in git log.
