---
phase: 16-contas-a-pagar-concilia-o-tributos
fixed_at: 2026-06-22T00:00:00Z
review_path: .planning/phases/16-contas-a-pagar-concilia-o-tributos/16-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Fase 16: Relatório de Correção da Revisão

**Fixed at:** 2026-06-22
**Source review:** .planning/phases/16-contas-a-pagar-concilia-o-tributos/16-REVIEW.md
**Iteration:** 1

**Resumo:**
- Findings no escopo: 7 (CR-01..CR-04, WR-01, WR-02, WR-03)
- Corrigidos: 7
- Pulados: 0
- `next build`: PASSOU (sem erros de tipo na produção)
- Suíte vitest `payables.test.ts`: 5/5 passando após o reorder do WR-02

Todos os nomes de coluna e cadeias de join foram verificados contra o schema real
(`supabase/migrations/` + `src/types/database.types.ts`), não contra o código com bug.

## Issues Corrigidos

### CR-01: `financial_transactions.charge_id` não existe — cadeia de repasse quebrada
**Files modified:** `src/actions/professional-payouts.ts`
**Commit:** 484ca61
**Applied fix:** Corrigida a cadeia de join em `computePayouts` para o vínculo real
`financial_transactions.receivable_id → receivables.charge_id → charges`. O `select`
agora busca `receivable_id`; adicionada uma consulta intermediária a `receivables`
(`select id, charge_id` por `in(receivableIds)`) para resolver os `charge_ids`.
Comentários do header e do passo 4 atualizados. Verificado contra
`database.types.ts`: `financial_transactions` possui `receivable_id` (não `charge_id`)
e `receivables.charge_id` existe (FK `receivables_charge_id_fkey`).

### CR-02: `unit_fiscal_config.municipio_ibge` não existe — coluna é `municipio_codigo_ibge`
**Files modified:** `src/actions/rpa.ts`
**Commit:** 69e8170
**Applied fix:** `select('municipio_codigo_ibge')` e
`unitFiscal?.municipio_codigo_ibge`. Confirmado em
`20260620000100_faturamento_catalog_tables.sql:32` e em `database.types.ts`
(`unit_fiscal_config.municipio_codigo_ibge`). Observação: `rpa_records.municipio_ibge`
é outra coluna (existe) e segue correto no INSERT.

### CR-03: `iss_tax_tables.municipio_ibge` não existe — coluna é `codigo_ibge`
**Files modified:** `src/actions/rpa.ts`
**Commit:** 69e8170
**Applied fix:** Filtro `.eq('codigo_ibge', municipioIbge)` e campo da interface
`IssBracketRow.municipio_ibge → codigo_ibge`. Confirmado em
`20260621000400_tax_tables.sql:75`.

### CR-04: `suppliers.document_number` não existe — coluna é `cnpj_cpf`
**Files modified:** `src/actions/rpa.ts`
**Commit:** 69e8170
**Applied fix:** `select('id, name, cnpj_cpf, vinculo')` e
`prestadorDoc: supplier.cnpj_cpf ?? ''`. Confirmado em
`20260621000100_payables_tables.sql:41`.

### WR-01: `NToOneBuilder.handleConfirm` não enviava os IDs selecionados
**Files modified:** `src/actions/reconciliation.ts`, `src/components/financeiro/NToOneBuilder.tsx`
**Commit:** a3e9acc
**Applied fix:** Adicionado `transactionIds?: string[]` ao input de `matchNToOne`.
Quando presente, a action valida que os IDs pertencem ao pool de receitas pendentes
da conta, calcula a `fee` (depósito − soma) e exige `|fee| <= tolerance` antes de
conciliar exatamente esse conjunto — em vez de rodar `libMatchNToOne`. A UI agora
encaminha `Array.from(selected)` no `handleConfirm`, honrando a seleção do usuário.

### WR-02: `baixarPayable` — insert da FT antes do CAS, sem rollback (despesa órfã)
**Files modified:** `src/actions/payables.ts`
**Commit:** 0f4abec
**Applied fix:** Reordenado para CAS-claim da parcela PRIMEIRO
(`.neq('status','pago')` + `.select('id')` para detectar corrida perdida = 0 linhas),
depois insert da FT. Se o insert da FT falhar, a claim é revertida ao estado anterior
(status/valor_pago/paid_at originais). O `financial_transaction_id` é gravado na parcela
num passo subsequente (patch), após a FT existir. Suíte vitest `payables.test.ts`
revalidada (5/5). Observação: o débito de `bank_accounts.saldo_atual` continua
read-modify-write (o reviewer sugeriu RPC transacional como melhoria futura, fora do
escopo desta correção).

### WR-03: `matchNToOne` — sem CAS na statement_line e sem rollback em falha parcial
**Files modified:** `src/actions/reconciliation.ts`
**Commit:** a3e9acc
**Applied fix:** O loop de CAS agora coleta quais TX updates venceram a corrida
(`claimedTxIds`); se algum retornar 0 linhas, as TXs já marcadas são revertidas
(`reconciliation_status='pendente'`, `statement_line_id=null`) e a action aborta com
"Conciliação concorrente detectada". O update da `statement_line` ganhou guard CAS
`.eq('reconciliation_status','pendente')` + `.select('id')`; 0 linhas → rollback das TXs
e erro de conciliação concorrente. (Commitado junto com WR-01 por estarem na mesma função.)

## Issues Não Corrigidos

Nenhum no escopo. Os warnings WR-04..WR-08 e todos os Info (IN-01..IN-06) ficaram
fora do escopo desta rodada de correção (escopo: CR-01..CR-04 + WR-01/WR-02/WR-03).

## Verificação Recomendada por Humano

- **WR-02 / WR-03**: as correções envolvem ordenação de mutações de dinheiro e
  caminhos de rollback concorrente. A verificação por testes cobre a sintaxe e o caminho
  feliz/idempotente, mas convém confirmar manualmente o comportamento sob concorrência
  real (baixa simultânea / conciliação simultânea) antes do deploy.
- **CR-01**: confirmar com um teste de integração contra o schema real que a nova cadeia
  via `receivables` retorna os `charge_ids` esperados para recebimentos conciliados.

---

_Fixed: 2026-06-22_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
