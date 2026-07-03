---
phase: 17-estoque-materiais
plan: "01"
subsystem: estoque
tags: [zod, validators, tdd, red-scaffold, est-01, est-02, est-03]
requirements: [EST-01, EST-02, EST-03]

dependency_graph:
  requires:
    - src/lib/validators/service.ts (padrão Zod v3 sem .default())
    - src/lib/validators/service-order.ts (padrão uuid(), enums, superRefine)
    - src/__tests__/governance/approvals.test.ts (padrão SRC() helper)
  provides:
    - src/lib/validators/product.ts (productSchema, stockEntrySchema, stockDrawSchema, serviceMaterialTemplateSchema)
    - src/__tests__/estoque/produto-schema.test.ts (14 testes GREEN)
    - src/__tests__/estoque/stock-entries.test.ts (RED scaffold — Plan 05)
    - src/__tests__/estoque/stock-draws.test.ts (RED scaffold — Plan 06)
    - src/__tests__/estoque/stock-agent.test.ts (RED scaffold — Plan 06)
    - src/__tests__/estoque/cron-validade.test.ts (RED scaffold — Plan 06)
  affects:
    - Plans 02-09 da Fase 17 (todos importam productSchema/stockEntrySchema/stockDrawSchema)

tech_stack:
  added: []
  patterns:
    - Zod v3 .superRefine para validação condicional por categoria (implante/medicamento/insumo)
    - SRC() helper source-inspection (RED tests que falham por conteúdo ausente, não por ENOENT)
    - Constantes exportadas como `as const` para type-safety nos enums

key_files:
  created:
    - src/lib/validators/product.ts
    - src/__tests__/estoque/produto-schema.test.ts
    - src/__tests__/estoque/stock-entries.test.ts
    - src/__tests__/estoque/stock-draws.test.ts
    - src/__tests__/estoque/stock-agent.test.ts
    - src/__tests__/estoque/cron-validade.test.ts
  modified: []

decisions:
  - id: D-17-01-01
    summary: "superRefine para validação condicional — não z.discriminatedUnion"
    rationale: "Categoria do produto é um campo simples (não discriminador de type union); superRefine mantém schema flat e compatível com RHF defaultValues sem .default()"
  - id: D-17-01-02
    summary: "categoria_produto incluída em stockEntrySchema como campo de contexto"
    rationale: "Server Action recebe categoria do produto para validar campos condicionais (ANVISA, validade) sem fetch adicional ao banco durante validação"

metrics:
  duration_minutes: 4
  completed_date: "2026-07-03"
  tasks_completed: 2
  files_created: 6
  files_modified: 0
---

# Phase 17 Plan 01: Zod Schemas + RED Scaffolds de Estoque Summary

**One-liner:** Zod v3 schemas com superRefine por categoria (implante exige ANVISA, medicamento exige validade) + 4 RED test scaffolds para source-inspection das actions futuras.

---

## What Was Built

### Task 1: Zod v3 schemas (TDD — GREEN)

`src/lib/validators/product.ts` exporta 4 schemas:

1. **`productSchema`** — valida produto de estoque. `.superRefine` rejeita `category='implante'` sem `numero_anvisa_produto` (T-17-01, D-03).

2. **`stockEntrySchema`** — valida entrada de estoque. Recebe `categoria_produto` como campo de contexto. `.superRefine` rejeita implante/medicamento sem `data_validade`, e implante sem `numero_anvisa_lote` (D-03, D-10).

3. **`stockDrawSchema`** — valida baixa manual. `z.enum(DRAW_MOTIVOS)` rejeita qualquer motivo fora de `['perda','quebra','vencimento','ajuste_inventario']` (T-17-02, D-19). `qtd > 0` obrigatório.

4. **`serviceMaterialTemplateSchema`** — valida template de consumo por serviço (D-07). `qtd_padrao > 0` obrigatório.

14 testes GREEN em `produto-schema.test.ts` cobrem todos os casos do plano.

### Task 2: RED source-inspection scaffolds

4 arquivos de test seguindo o padrão `SRC()` helper (idêntico a `approvals.test.ts`):

| Arquivo | Alvo | Status | Plan Alvo |
|---------|------|--------|-----------|
| `stock-entries.test.ts` | `src/actions/stock-entries.ts` | RED | Plan 05 |
| `stock-draws.test.ts` | `src/actions/stock-draws.ts` | RED | Plan 06 |
| `stock-agent.test.ts` | `src/lib/agents/stock-agent.ts` | RED | Plan 06 |
| `cron-validade.test.ts` | `src/app/api/cron/estoque-validade/route.ts` | RED | Plan 06 |

Todos falham com `expected '' to match /pattern/` — RED por conteúdo ausente, sem erro de sintaxe.

---

## Verification Results

```
npx vitest run src/__tests__/estoque/ --reporter=verbose

Test Files  4 failed | 1 passed (5)
     Tests  20 failed | 14 passed (34)
```

- `produto-schema.test.ts`: 14/14 PASS (GREEN confirmado)
- 4 RED tests: 20 falhas por conteúdo ausente (esperado — implementations não existem ainda)
- `npx tsc --noEmit` em `src/lib/validators/product.ts`: zero erros novos introduzidos

---

## Deviations from Plan

Nenhuma — plano executado exatamente como escrito.

---

## Known Stubs

Nenhum. `product.ts` é um módulo de validação puro (sem renderização de UI). Os 4 RED tests são scaffolds intencionais documentados no plano — não stubs de dados.

---

## Threat Flags

Nenhuma nova superfície de segurança introduzida. Os schemas implementam as mitigações T-17-01 e T-17-02 definidas no threat model do plano.

---

## Self-Check: PASSED

**Files created:**

| File | Status |
|------|--------|
| `src/lib/validators/product.ts` | FOUND |
| `src/__tests__/estoque/produto-schema.test.ts` | FOUND |
| `src/__tests__/estoque/stock-entries.test.ts` | FOUND |
| `src/__tests__/estoque/stock-draws.test.ts` | FOUND |
| `src/__tests__/estoque/stock-agent.test.ts` | FOUND |
| `src/__tests__/estoque/cron-validade.test.ts` | FOUND |

**Commits:**

| Hash | Message |
|------|---------|
| `e5a85c8` | feat(17-01): Zod v3 schemas para produto, lote, entrada e baixa de estoque |
| `c5ec6dc` | test(17-01): RED source-inspection scaffolds para actions e cron de estoque |
