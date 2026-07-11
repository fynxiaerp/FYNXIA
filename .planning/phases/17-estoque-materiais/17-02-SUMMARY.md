---
phase: 17-estoque-materiais
plan: 02
status: complete
completed: 2026-07-11
requirements:
  - EST-01
  - EST-02
  - EST-03
---

# 17-02 SUMMARY — Migrations de Estoque (schema ao vivo + tipos)

## O que foi entregue

As 4 migrations do módulo de estoque foram aplicadas no banco ao vivo
(`jqjwyqlbbuqnrffdnlpp`, org `kczvihafddupruvsrrsc`, sa-east-1) e os tipos
TypeScript foram regenerados. O schema agora é real e tipado antes de qualquer
Server Action/UI (Waves 2–4).

- **000100 tables**: 6 tabelas — `products`, `product_batches`, `stock_entries`,
  `stock_draws`, `service_material_templates`, `stock_alerts` — com índices
  `clinic_id` + `unit_id`.
- **000200 alters**: `payables.origem` CHECK agora inclui `'estoque_agente'`;
  `approval_requests.requested_by` agora nullable (NULL = ator de sistema/cron).
- **000300 rls**: RLS habilitado nas 6 tabelas; escrita `admin`/`superadmin`
  apenas; `stock_draws`/`stock_alerts` sem política de escrita authenticated
  (escrita só via service role).
- **000400 seed**: agente `stock_replenishment` L2 semeado para clínicas ativas.
- **src/types/database.types.ts** regenerado (175.912 → 391.438 bytes; a versão
  anterior estava incompleta), inclui as 6 tabelas, fecha com `} as const`.

## Desvios do plano

1. **Índice `uq_stock_alerts_daily` corrigido (bug de SQL real).** O plano e o
   RESEARCH especificaram `(created_at::date)`, mas `created_at` é `timestamptz`
   e esse cast **não é IMMUTABLE** — o Postgres recusou com `42P17`
   (`functions in index expression must be marked IMMUTABLE`) e a migration
   sofreu rollback. Trocado por
   `((created_at AT TIME ZONE 'America/Sao_Paulo')::date)`, que é imutável (o
   `timezone(text, timestamptz)` é IMMUTABLE) e fixa o dia no horário local BR —
   semanticamente correto para dedup diário de uma clínica brasileira.
   **Impacto downstream:** o `ON CONFLICT` do insert de alertas (plano 17-04)
   deve usar a MESMA expressão de índice
   `((created_at AT TIME ZONE 'America/Sao_Paulo')::date)`, não `(created_at::date)`.

2. **Critério de aceite `grep "estoque_agente" database.types.ts` não se aplica.**
   `payables.origem` é `TEXT` com `CHECK`, não um ENUM Postgres; o Supabase o
   tipa como `string`, então o literal não aparece nos tipos. O CHECK foi de
   fato atualizado no banco (migration 000200 aplicada sem erro). Verificação
   real satisfeita: 6 tabelas presentes + arquivo não truncado.

## Checkpoint humano (Task 2)

Resolvido pelo usuário: login do CLI Supabase na conta FYNXIA (antes estava sem
token; MCP permanece na conta `nexus-*`, não usado) + `SUPABASE_DB_PASSWORD`
definido para a conexão direta do `db push`. `supabase projects list` passou a
mostrar `FYNXIA` LINKED.

## Arquivos

### Modificados
- `supabase/migrations/20260703000100_estoque_tables.sql` (índice imutável)
- `src/types/database.types.ts` (regenerado)

### Aplicados no banco (já commitados em ca75fdd, aplicados agora)
- `supabase/migrations/20260703000200_estoque_alters.sql`
- `supabase/migrations/20260703000300_estoque_rls.sql`
- `supabase/migrations/20260703000400_estoque_seed.sql`

## Verificação

- `supabase db push --dry-run` → "Remote database is up to date"
- 6 tabelas presentes em `database.types.ts`; arquivo fecha com `} as const`
- Commit: `fix(17-02): immutable date index + regen types after estoque db push`
