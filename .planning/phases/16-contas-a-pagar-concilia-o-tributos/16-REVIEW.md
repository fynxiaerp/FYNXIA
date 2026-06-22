---
phase: 16-contas-a-pagar-concilia-o-tributos
reviewed: 2026-06-22T00:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - src/actions/suppliers.ts
  - src/actions/payables.ts
  - src/actions/recorrente.ts
  - src/actions/bank-statements.ts
  - src/actions/reconciliation.ts
  - src/actions/professional-payouts.ts
  - src/actions/rpa.ts
  - src/actions/reinf.ts
  - src/app/api/cron/recorrente/route.ts
  - src/app/api/financeiro/ofx/route.ts
  - src/lib/financeiro/tax-tables.ts
  - src/lib/financeiro/payout-math.ts
  - src/lib/financeiro/reconciliation.ts
  - src/lib/financeiro/ofx-parser.ts
  - src/lib/reinf/types.ts
  - src/lib/reinf/stub.ts
  - src/lib/reinf/index.ts
  - src/lib/integrations/types.ts
  - src/lib/validators/payable.ts
  - src/lib/validators/rpa.ts
  - src/lib/validators/connector.ts
  - src/components/pdf/RpaPDF.tsx
  - src/components/financeiro/NToOneBuilder.tsx
  - supabase/migrations/20260621000100_payables_tables.sql
  - supabase/migrations/20260621000200_reconciliation_tables.sql
  - supabase/migrations/20260621000300_payout_rpa_tables.sql
  - supabase/migrations/20260621000400_tax_tables.sql
  - supabase/migrations/20260621000500_phase16_alters.sql
  - supabase/migrations/20260621000600_phase16_rls.sql
  - supabase/migrations/20260621000700_phase16_seed.sql
findings:
  critical: 4
  warning: 8
  info: 6
  total: 18
status: issues_found
---

# Fase 16: Relatório de Revisão de Código

**Reviewed:** 2026-06-22
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Revisão da Fase 16 (Contas a Pagar / Conciliação Bancária / Tributos). O isolamento multi-tenant está bem implementado em toda a superfície: `clinic_id`/`tenant_id` sempre derivam do ator autenticado (`getActor`), nunca do input do cliente; as RLS pareiam `USING` + `WITH CHECK` com gate de role `admin`/`superadmin`; o cron usa `CRON_SECRET` fail-closed; a rota OFX impõe limite de 5MB, runtime nodejs e checagem de ownership; o PDF do RPA usa signed URL TTL=60s e nunca expõe `pdf_storage_path`. As libs puras de tributos e payout fazem aritmética inteira em centavos corretamente.

Porém há **4 problemas críticos de schema-mismatch** que quebram funcionalidades inteiras em runtime (consultas a colunas que não existem), o mais grave deles invalidando toda a cadeia de cálculo de repasse. Também foi confirmado o stub do `NToOneBuilder` (não envia os IDs selecionados) e há lacunas de atomicidade/rollback em mutações de dinheiro.

## Critical Issues

### CR-01: `financial_transactions.charge_id` não existe — `computePayouts` quebra em runtime

**File:** `src/actions/professional-payouts.ts:138, 156-159`
**Issue:** `computePayouts` faz `select('... charge_id')` e depois `t.charge_id` para montar a cadeia de join recebimento→profissional. A tabela base `public.financial_transactions` (migração `20260606000100_financial_tables.sql`) NÃO possui coluna `charge_id`, e nenhuma migração da Fase 16 (`20260621000500_phase16_alters.sql` só adiciona `reconciliation_status` e `statement_line_id`) a cria. A consulta retornará erro PostgREST ("column financial_transactions.charge_id does not exist"), tornando **todo o cálculo de repasse profissional (TRIB-01) inoperante**. O comentário no header do arquivo afirma a cadeia `financial_transactions.charge_id → charges`, mas o vínculo real no schema é `financial_transactions.receivable_id → receivables.charge_id → charges`.
**Fix:** Adicionar a coluna via ALTER, OU corrigir a cadeia de join para passar por `receivables`:
```sql
-- Opção A (alter):
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS charge_id UUID REFERENCES public.charges(id) ON DELETE SET NULL;
```
```ts
// Opção B (join via receivable, sem alterar schema):
.select('id, amount, transaction_date, statement_line_id, receivable_id')
// ...depois buscar charges via receivables.charge_id
const { data: recs } = await supabase
  .from('receivables').select('id, charge_id').in('id', receivableIds)
```
Confirmar com um teste de integração contra o schema real antes do deploy.

### CR-02: `unit_fiscal_config.municipio_ibge` não existe — coluna correta é `municipio_codigo_ibge`

**File:** `src/actions/rpa.ts:133-138`
**Issue:** `gerarRpa` consulta `supabase.from('unit_fiscal_config').select('municipio_ibge')`. A tabela `unit_fiscal_config` (`20260620000100_faturamento_catalog_tables.sql:32`) define a coluna como `municipio_codigo_ibge`, não `municipio_ibge`. A consulta falha; como há `.maybeSingle()` e o erro não é checado (`const { data: unitFiscal }` ignora `error`), `municipioIbge` cai silenciosamente para `null` e o ISS nunca é calculado por município — bug fiscal silencioso.
**Fix:**
```ts
const { data: unitFiscal } = await supabase
  .from('unit_fiscal_config')
  .select('municipio_codigo_ibge')
  .eq('unit_id', data.unitId)
  .maybeSingle()
municipioIbge = unitFiscal?.municipio_codigo_ibge ?? null
```

### CR-03: `iss_tax_tables.municipio_ibge` não existe — coluna correta é `codigo_ibge`

**File:** `src/actions/rpa.ts:163` (e interface `IssBracketRow` em `src/actions/rpa.ts:64-69`)
**Issue:** A query `supabase.from('iss_tax_tables').select('*').eq('municipio_ibge', municipioIbge)` filtra por `municipio_ibge`, mas a tabela `iss_tax_tables` (`20260621000400_tax_tables.sql:75`) define a coluna como `codigo_ibge`. A consulta retorna erro/zero linhas → alíquota de ISS sempre 0 quando não há `issOverride`. A interface local `IssBracketRow { municipio_ibge: string }` também está incoerente com o schema.
**Fix:**
```ts
municipioIbge
  ? supabase.from('iss_tax_tables').select('*').eq('codigo_ibge', municipioIbge)
  : Promise.resolve({ data: [] as IssBracketRow[], error: null }),
```
E renomear o campo da interface `IssBracketRow.municipio_ibge` → `codigo_ibge`.

### CR-04: `suppliers.document_number` não existe — coluna correta é `cnpj_cpf`

**File:** `src/actions/rpa.ts:106-108, 264`
**Issue:** `gerarRpa` faz `select('id, name, document_number, vinculo')` da tabela `suppliers` e usa `supplier.document_number` para preencher `prestadorDoc` no PDF do RPA. A tabela `suppliers` (`20260621000100_payables_tables.sql:41`) só possui `cnpj_cpf` (não há `document_number`). A consulta falhará ou o campo virá `undefined`, gerando RPA sem CPF/CNPJ do prestador (defeito fiscal/legal).
**Fix:**
```ts
.select('id, name, cnpj_cpf, vinculo')
// ...
prestadorDoc: supplier.cnpj_cpf ?? '',
```

## Warnings

### WR-01: `NToOneBuilder.handleConfirm` não envia os IDs selecionados para `matchNToOne`

**File:** `src/components/financeiro/NToOneBuilder.tsx:117-135`
**Issue:** A UI deixa o usuário selecionar N lançamentos (estado `selected`), mas `handleConfirm` chama `matchNToOne({ statementLineId: line.id, tolerance: 5.0 })` sem passar a seleção. A action `matchNToOne` (`src/actions/reconciliation.ts:531-601`) re-busca TODAS as transações `receita` pendentes da conta e roda a busca combinatória da lib, ignorando a escolha do usuário. Resultado: a combinação efetivamente conciliada pode divergir do que o usuário marcou na tela (conciliação errada de valores próximos). A própria assinatura da action não aceita `transactionIds`.
**Fix:** Adicionar `transactionIds: string[]` ao input da action e, quando presente, conciliar exatamente esse conjunto (validando tolerância) em vez de chamar `libMatchNToOne`. Encaminhar `Array.from(selected)` no `handleConfirm`.

### WR-02: `baixarPayable` — insert da FT e débito de saldo não são atômicos, sem rollback

**File:** `src/actions/payables.ts:282-371`
**Issue:** A ordem real é: insere `financial_transactions` (passo 5) ANTES do CAS update da parcela (passo 6). Se o CAS update falhar/retornar 0 linhas (baixa concorrente), o código retorna "Baixa concorrente detectada" mas a FT de despesa **já foi inserida** e não é revertida → lançamento de despesa órfão duplicando o caixa. Além disso o débito de `bank_accounts.saldo_atual` (passo 7) é read-modify-write sem CAS; duas baixas concorrentes podem perder uma atualização de saldo. O comentário do header afirma "CAS claim FIRST, then FT insert", mas a implementação faz o oposto.
**Fix:** Fazer o CAS claim da parcela antes do insert da FT; em caso de falha do CAS, abortar antes de inserir a FT. Se o insert da FT preceder o CAS por necessidade, deletar a FT no caminho de erro (como já é feito em `createReconciledTransaction`). Considerar uma RPC transacional para o débito de saldo.

### WR-03: `matchNToOne` — sem rollback em falha parcial e sem CAS na statement_line

**File:** `src/actions/reconciliation.ts:607-628`
**Issue:** O loop atualiza cada `financial_transaction` com CAS (`.eq('reconciliation_status','pendente')`) mas ignora o resultado: se uma TX foi concorrentemente conciliada, as demais já foram marcadas e a `statement_line` é atualizada sem guard (`update(...).eq('id', lineRow.id)` sem CAS), deixando estado inconsistente (linha conciliada apontando para TXs que outra operação reivindicou). Diferente de `confirmMatch`, não há rollback.
**Fix:** Coletar quais TX updates retornaram linhas; se algum falhar, reverter as já marcadas. Aplicar CAS `.eq('reconciliation_status','pendente')` no update da `statement_line` e tratar 0-linhas como "conciliação concorrente".

### WR-04: Erros de consulta ignorados silenciosamente em vários re-fetches

**File:** `src/actions/payables.ts:262-269`; `src/actions/professional-payouts.ts:110-115`; `src/actions/rpa.ts:133-138, 316-328`
**Issue:** Vários `const { data } = await supabase...` descartam o `error`. Quando a consulta falha (ex.: coluna inexistente — ver CR-02/CR-04, ou RLS), o fluxo continua com `null`/defaults silenciosos: `baixarPayable` grava FT com `account_id`/`cost_center_id` nulos e descrição genérica; `computePayouts` ignora vínculo; `gerarRpa` perde a conta de tributo. Mascara bugs e gera dados fiscais incorretos.
**Fix:** Checar `error` e propagar `{ success:false, error }` (ou logar) em cada re-fetch crítico de dinheiro/tributo.

### WR-05: `parseOfxBuffer` — datas e valores sem validação podem gerar `Invalid Date`/`NaN`

**File:** `src/lib/financeiro/ofx-parser.ts:46-60` e consumo em `src/actions/bank-statements.ts:109-111`
**Issue:** `amount: Number(t.TRNAMT)` pode produzir `NaN` se `TRNAMT` estiver ausente/malformado; `date` pode ser `Invalid Date` se `DTPOSTED` não tiver 8 dígitos válidos. Em `importOFX`, `lines.map(l => l.date.getTime())` com `Invalid Date` produz `NaN`, e `Math.min(...NaN)` → `periodo_inicio`/`periodo_fim` viram `Invalid Date` → `.toISOString()` lança `RangeError`, abortando o import inteiro mesmo para um único registro corrompido (a lib é "lenient" mas o consumo não é).
**Fix:** Filtrar/normalizar linhas com `Number.isNaN(amount)` ou `isNaN(date.getTime())`, acumulando-as em `warnings`, antes de calcular o período e fazer upsert.

### WR-06: `addMonthsClamped` ignora overflow de dezembro→janeiro corretamente, mas perde o dia original >28

**File:** `src/actions/payables.ts:65-74`
**Issue:** O clamp `Math.min(d, 28)` aplica-se a TODAS as parcelas, então um vencimento dia 30 vira dia 28 já na 1ª parcela — alterando silenciosamente a data informada pelo usuário (não só nos meses curtos). O `payableSchema.dueDate` aceita qualquer `YYYY-MM-DD` (inclusive dia 29-31), criando divergência entre o que foi submetido e o que é persistido sem aviso.
**Fix:** Documentar/validar no schema que o dia de vencimento de parcelamento é limitado a ≤28, ou preservar o dia original quando o mês comporta (clamp apenas quando `d > diasNoMes`).

### WR-07: `computeIrrf` — `aliquota` da faixa gradual é efetiva, não marginal; risco de uso indevido

**File:** `src/lib/financeiro/tax-tables.ts:110-116`
**Issue:** Na faixa gradual (5000.01–7350.00) o retorno `aliquota = valor / baseCalculo` é a alíquota *efetiva*, enquanto na faixa flat retorna 0.275 (marginal). O valor de `irrf` (campo `valor`) está correto, mas `aliquota_irrf` é sempre gravado como `null` em `rpa.ts:237` (então o problema não vaza hoje). Inconsistência latente: qualquer consumidor futuro que use `.aliquota` para reportar a alíquota terá semântica trocada entre faixas.
**Fix:** Padronizar a semântica de `aliquota` (sempre marginal) e expor a efetiva em campo separado se necessário; documentar no JSDoc.

### WR-08: `reinf_events` CHECK inclui `'retificado'` mas o tipo TS não

**File:** `src/lib/reinf/types.ts:27` vs `supabase/migrations/20260621000300_payout_rpa_tables.sql:110-111`
**Issue:** O CHECK do banco permite `status IN ('pendente','transmitido','erro','retificado')`, mas `ReinfEventResult.status: 'pendente' | 'transmitido' | 'erro'` omite `'retificado'`. `retificar()` no stub retorna `'transmitido'`, então não quebra hoje, mas um provedor real que retorne `'retificado'` causaria erro de tipo/insert. Divergência schema↔tipo.
**Fix:** Adicionar `'retificado'` ao union de `ReinfEventResult.status`.

## Info

### IN-01: `generateRecorrentePayables` confia em `clinicId` externo sem validação de tenant

**File:** `src/actions/recorrente.ts:268-286`
**Issue:** Quando chamada com `clinicId` (caminho cron), pula `getActor` e usa o `clinicId` diretamente. Está OK porque o único chamador é o cron service-role autenticado por `CRON_SECRET`, mas como é uma Server Action exportada (`'use server'`), poderia teoricamente ser invocada com um `clinicId` arbitrário se exposta. Hoje a action depende de RLS via `createClient()` (não admin), o que mitiga, mas o caminho `clinicId` + cliente anon não conciliam (cron usa esta action que usa `createClient`, não admin — ver IN-02).
**Fix:** Documentar/garantir que o caminho `clinicId` só seja alcançável internamente; ou exigir um marcador de service-role.

### IN-02: cron chama `generateRecorrentePayables` que usa `createClient()` (anon/RLS), não admin

**File:** `src/app/api/cron/recorrente/route.ts:63-65` + `src/actions/recorrente.ts:288`
**Issue:** O cron itera todas as clínicas (service role) mas a action interna instancia `createClient()` (cliente SSR baseado em cookies do request — no contexto do cron não há sessão). Sob RLS, inserts em `payables`/`payable_installments` exigem `get_my_tenant_id()`/`get_my_role()`, que não existem numa request de cron sem usuário → inserts podem ser bloqueados silenciosamente (o erro é apenas `console.error` por template). Verificar se a geração recorrente realmente funciona em produção via cron.
**Fix:** Usar `createAdminClient()` dentro do caminho `clinicId` (cron) e setar `clinic_id` explicitamente (já é feito), confiando no service role para bypass de RLS.

### IN-03: `RpaPDF` registra fontes via URL remota (gstatic) em runtime serverless

**File:** `src/components/pdf/RpaPDF.tsx:23-35`
**Issue:** `Font.register` aponta para `https://fonts.gstatic.com/...`. Em Vercel Fluid Compute o fetch remoto de fonte adiciona latência e cria dependência de rede externa na geração do PDF; falha de rede → PDF sem fonte ou erro. A falha já é não-fatal em `gerarRpa` (try/catch), mas o RPA fica sem documento.
**Fix:** Embarcar a fonte localmente (arquivo no bundle) conforme prática de `@react-pdf/renderer` para serverless.

### IN-04: `listRecorrenteTemplates`/`listPayouts`/`listRpas` sem paginação

**File:** `src/actions/recorrente.ts:155-158`; `src/actions/professional-payouts.ts:480-487`; `src/actions/rpa.ts:423-428`
**Issue:** Selects de listagem sem `.range()`/limite. Conforme volume cresce, retornam todas as linhas do tenant. Fora do escopo v1 (performance), mas registrado para maintainability.
**Fix:** Adicionar paginação por `nuqs`/`.range()` quando a UI evoluir.

### IN-05: `void actor` como no-op para suprimir lint

**File:** `src/actions/reconciliation.ts:518`
**Issue:** `void actor // used for RLS context only` — `actor` é desestruturado só para satisfazer o lint. Código morto inofensivo, mas confuso.
**Fix:** Remover a desestruturação de `actor` em `cashFlowPrevistoVsRealizado` (não é usado) ou usar `_actor`.

### IN-06: Helper `getActor` duplicado verbatim em 6+ arquivos

**File:** `src/actions/suppliers.ts:16-38`, `payables.ts:17-39`, `recorrente.ts:16-38`, `bank-statements.ts:33-55`, `reconciliation.ts:45-67`, `professional-payouts.ts:35-48`, `rpa.ts:45-58`, `reinf.ts:31-44`
**Issue:** O mesmo `getActor` e `WRITER_ROLES` são copiados em todos os módulos da fase. Duplicação aumenta superfície de manutenção (uma correção de auth precisa ser replicada N vezes).
**Fix:** Extrair para `src/lib/auth/actor.ts` e importar. Observação: a cópia é intencional conforme comentários, mas vale consolidar.

---

_Reviewed: 2026-06-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
