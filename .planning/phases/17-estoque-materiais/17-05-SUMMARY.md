---
phase: 17-estoque-materiais
plan: 05
subsystem: api
tags: [fifo, cas-guard, stock-draws, anvisa, service-material-templates, appointments-wiring]

# Dependency graph
requires:
  - phase: 17-estoque-materiais/01
    provides: stock-draws.test.ts RED source-inspection scaffold; stockDrawSchema/serviceMaterialTemplateSchema (Zod v3)
  - phase: 17-estoque-materiais/02
    provides: 6 estoque tables (products, product_batches, stock_entries, stock_draws, service_material_templates, stock_alerts) + RLS (stock_draws sem write policy authenticated)
  - phase: 17-estoque-materiais/03
    provides: products.ts / product-batches.ts (listProductBatches FIFO order) / stock-entries.ts + custo-medio.ts
  - phase: 17-estoque-materiais/04
    provides: runStockReplenishmentAgent + insertStockAlert (src/lib/agents/stock-agent.ts)
provides:
  - drawMaterialsForProcedures (baixa FIFO automatica — chamada por updateAppointment)
  - createManualDraw / listStockDraws / listAnvisaTraceability (src/actions/stock-draws.ts)
  - listServiceMaterials / addServiceMaterial / removeServiceMaterial (src/actions/service-material-templates.ts)
  - updateAppointment agora dispara drawMaterialsForProcedures ao concluir atendimento
affects: [17-estoque-materiais UI plans (ServiceForm aba Materiais, prontuario Materiais utilizados, /clinica/estoque/anvisa)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "selectFifoBatch: CAS guard via compare-exact-value (.eq('saldo_disponivel', valorLido)) em vez de UPDATE relativo — supabase-js nao expressa 'saldo_disponivel - qtd' sem RPC dedicada; 0 linhas afetadas = corrida perdida, tenta proximo lote FIFO"
    - "drawMaterialsForProcedures usa createAdminClient (stock_draws sem RLS de escrita authenticated) e try/catch por material — falha isolada nunca aborta os demais nem o atendimento (D-09)"
    - "Dynamic import de stock-draws.ts dentro de appointments.ts evita ciclo de dependencia (mirrors padrao de import estatico de createOsDraftFromAppointment, mas via import() por ser modulo separado)"

key-files:
  created:
    - src/actions/stock-draws.ts
    - src/actions/service-material-templates.ts
  modified:
    - src/actions/appointments.ts

key-decisions:
  - "CAS guard em selectFifoBatch usa .eq('saldo_disponivel', valorLido) (compare-and-swap por snapshot exato) em vez de 'AND saldo_disponivel >= qtd RETURNING id' literal do plano/RESEARCH — supabase-js/PostgREST update() so aceita valores literais no body, nao expressoes relativas de coluna; sem RPC dedicada no schema ja aplicado, o snapshot-compare e a unica forma de CAS atomico disponivel no client. Se a corrida for perdida (0 linhas), tenta o proximo lote FIFO — mesmo comportamento de resiliencia do padrao original."
  - "Se o lote FIFO candidato tem saldo_disponivel < qtd necessaria, pula para o proximo lote em vez de consumir parcialmente (sem split entre lotes) — mantem rastreabilidade ANVISA 1:1 lote-baixa."
  - "custo_unitario_snapshot usa custo do lote quando ha lote debitado; cai para products.custo_medio quando nenhum lote satisfaz a baixa (D-09 saldo negativo, batch_id null)."
  - "checkMinimoAndReplenish (helper interno) unifica a logica pos-baixa entre automatica e manual — saldo negativo sempre implica saldo<=estoque_minimo (estoque_minimo>=0 via Zod), entao uma unica branch cobre D-09 e D-14."
  - "listAnvisaTraceability filtra category='implante' e os filtros lote/paciente em JS pos-fetch (nao em dot-path .eq() em recursos embutidos) — evita depender de sintaxe de filtro de embed do PostgREST nao usada em nenhum outro lugar do codebase."

requirements-completed: [EST-02]

# Metrics
duration: 35min
completed: 2026-07-11
---

# Phase 17 Plan 05: Baixa de Estoque FIFO Automática + Manual + Rastreabilidade ANVISA Summary

**Baixa automática de materiais via FIFO com CAS guard ao concluir atendimento, baixa manual com motivo obrigatório, relatório de rastreabilidade ANVISA de implantes, e CRUD de templates de consumo por serviço — tornando GREEN o RED test de stock-draws plantado no Plan 01**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- `src/actions/service-material-templates.ts`: CRUD completo (`listServiceMaterials`, `addServiceMaterial`, `removeServiceMaterial`) para a aba "Materiais utilizados" do `ServiceForm` (D-07). Gate `WRITER_ROLES` (admin/superadmin), conflito `UNIQUE(service_id, product_id)` retorna erro amigável ("Material já configurado para este serviço"), soft delete via `deleted_at`.
- `src/actions/stock-draws.ts`:
  - `selectFifoBatch`: seleção FIFO (lote mais antigo com `saldo_disponivel > 0`) com CAS guard por comparação de valor exato lido — decrementa apenas se `saldo_disponivel` ainda casar com o valor lido; se outro processo já alterou o lote (corrida), tenta o próximo lote FIFO. Sem lote disponível → `batch_id = null` (D-09, saldo negativo permitido).
  - `drawMaterialsForProcedures(appointmentId, clinicId, actorId)`: resolve `unit_id` via `appointments` (appointment_procedures não tem `unit_id` — Open Question 3 do RESEARCH), cruza `appointment_procedures` → `service_material_templates` → FIFO batch, insere `stock_draws`, dispara `runStockReplenishmentAgent` via `checkMinimoAndReplenish` quando `saldo <= estoque_minimo`. Falha isolada por material (try/catch interno) nunca aborta os demais nem o atendimento. Usa `createAdminClient` (stock_draws sem RLS de escrita `authenticated`).
  - `createManualDraw`: baixa manual (D-19) com `motivo` obrigatório (`stockDrawSchema` enum), `WRITER_ROLES` gate, mesma seleção FIFO, `logBusinessEvent` ação `stock.draw.manual`, dispara o mesmo check de mínimo.
  - `listStockDraws`: leitura filtrável por `productId`/`unitId`, join com `products(name, unidade_medida)`.
  - `listAnvisaTraceability` (D-12): relatório ANVISA de implantes — `stock_draws` JOIN `products` (filtro `category='implante'`) JOIN `product_batches` (número de lote, ANVISA, validade) JOIN `appointment_procedures` → `appointments` → `patients`/`professionals`/`services`. Filtros por produto (DB-level), lote/paciente (pós-fetch em JS), período (DB-level via `created_at`).
- `src/actions/appointments.ts`: `updateAppointment` agora chama `drawMaterialsForProcedures` (dynamic import, evita ciclo) dentro do bloco `if (input.status === 'concluido')`, após `createOsDraftFromAppointment`, envolto em try/catch dedicado (D-09) — falha na baixa de materiais nunca bloqueia a conclusão do atendimento. Tabela `appointments` (GIST sagrado) não foi tocada.
- `src/__tests__/estoque/stock-draws.test.ts` (RED desde o Plan 01) agora GREEN — 5/5 assertions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Server Actions de templates de consumo** - `fa751d2` (feat)
2. **Task 2: Baixa de estoque — FIFO automático, manual e rastreabilidade** - `5c1058b` (feat)
3. **Task 3: Wiring da baixa automática no fluxo de conclusão do atendimento** - `d192a75` (feat)

## Files Created/Modified

- `src/actions/service-material-templates.ts` - CRUD de templates de consumo por serviço (D-07)
- `src/actions/stock-draws.ts` - `drawMaterialsForProcedures`, `createManualDraw`, `listStockDraws`, `listAnvisaTraceability`, `selectFifoBatch` (interno), `checkMinimoAndReplenish` (interno)
- `src/actions/appointments.ts` - `updateAppointment` estendido para disparar a baixa automática na conclusão do atendimento

## Decisions Made

- **CAS guard por comparação de valor exato (`.eq('saldo_disponivel', valorLido)`) em vez de `AND saldo_disponivel >= qtd RETURNING id` literal:** o Supabase JS client não suporta expressões relativas de coluna (`saldo_disponivel - qtd`) no `.update()` — o body do PATCH sempre carrega um valor literal. Sem uma função RPC dedicada no schema já aplicado (fora do escopo deste plano — schema está congelado), a alternativa correta é o padrão clássico de compare-and-swap: ler o valor atual, computar o novo valor no client, e só aplicar o UPDATE `WHERE id AND saldo_disponivel = valorLido`. Se 0 linhas forem afetadas, outro processo alterou o lote entre a leitura e a escrita — o código trata isso exatamente como "lote consumido por concorrente" (mesmo branch do RESEARCH Pitfall 2) e tenta o próximo lote FIFO. Resultado funcionalmente equivalente ao guard literal do plano, adaptado às capacidades reais do client.
- **Sem split de lote:** se o lote FIFO candidato tem saldo insuficiente para a quantidade necessária, ele é pulado inteiro (não debitado parcialmente) e o próximo lote é tentado. Preserva o vínculo 1:1 lote↔baixa exigido pela rastreabilidade ANVISA (D-12).
- **`checkMinimoAndReplenish` compartilhado entre baixa automática e manual:** evita duplicar a lógica de recálculo de saldo + trigger do agente; como `estoque_minimo >= 0` (Zod `.min(0)`), saldo negativo sempre satisfaz `saldo <= estoque_minimo`, então uma única branch cobre D-09 (negativo) e D-14 (mínimo atingido).
- **`listAnvisaTraceability` filtra `lote`/`paciente` em JS pós-fetch:** filtrar colunas de recursos aninhados via dot-path (`.eq('product_batches.numero_lote', ...)`) não tem precedente confirmado no codebase (`!inner` + dot-path é usado só uma vez, em `receivables.ts`, sem esse padrão específico); filtrar em memória após o fetch é mais previsível e segue o padrão de `listProducts` (filtro `.q` combinado com `.or()` em DB + pós-processamento em JS).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] CAS guard literal (`AND saldo_disponivel >= qtd RETURNING id`) não expressável via supabase-js**
- **Found during:** Task 2 (implementação de `selectFifoBatch`)
- **Issue:** O plano e o RESEARCH descreviam um `UPDATE ... SET saldo_disponivel = saldo_disponivel - qtd WHERE ... AND saldo_disponivel >= qtd RETURNING id` — uma expressão relativa de coluna. O cliente `supabase-js`/PostgREST só envia valores literais no corpo do PATCH; não há suporte a expressões SQL relativas via REST sem uma função RPC dedicada, e criar uma nova função no schema (já aplicado e congelado para esta fase) seria uma mudança arquitetural fora do escopo deste plano.
- **Fix:** Implementado CAS guard equivalente via comparação de valor exato lido (`.eq('id', candidate.id).eq('saldo_disponivel', candidate.saldo_disponivel)` no `.update()`), com loop de até 25 tentativas percorrendo os próximos lotes FIFO em caso de corrida perdida ou saldo insuficiente. Documentado no cabeçalho de `stock-draws.ts` e nas key-decisions acima.
- **Files modified:** `src/actions/stock-draws.ts`
- **Commit:** `5c1058b`

Nenhuma outra mudança arquitetural foi necessária — o restante do plano (assinaturas, nomes de arquivo, roles, wiring em appointments.ts) foi executado conforme especificado.

## Issues Encountered

None além do documentado acima (Rule 3, resolvido inline).

## User Setup Required

None — nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `drawMaterialsForProcedures` está totalmente wired: qualquer atendimento concluído com procedimentos que tenham `service_material_templates` configurados agora baixa estoque automaticamente.
- `createManualDraw`/`listStockDraws`/`listAnvisaTraceability` estão prontos para consumo pelas telas `/clinica/estoque/produtos` (baixa manual) e `/clinica/estoque/anvisa` (relatório + export PDF, planos de UI futuros).
- `listServiceMaterials`/`addServiceMaterial`/`removeServiceMaterial` estão prontos para a aba "Materiais utilizados" do `ServiceForm` (`/config/servicos` — rota ainda não criada; `revalidatePath` é um no-op seguro até a rota existir).
- Suite completa (`npx vitest run src/__tests__`) permanece 100% verde: 94 arquivos / 1617 testes, incluindo os 5/5 novos GREEN de `stock-draws.test.ts` e zero regressão em `appointments`/OS/faturamento.
- `npx tsc --noEmit` reporta zero erros novos nos 3 arquivos deste plano.

---
*Phase: 17-estoque-materiais*
*Completed: 2026-07-11*

## Self-Check: PASSED

All 3 modified/created files verified present (src/actions/stock-draws.ts, src/actions/service-material-templates.ts, src/actions/appointments.ts); all 3 task commit hashes (fa751d2, 5c1058b, d192a75) verified in git log; stock-draws.test.ts confirmed 5/5 GREEN; full suite 94/94 files, 1617/1617 tests passed.
