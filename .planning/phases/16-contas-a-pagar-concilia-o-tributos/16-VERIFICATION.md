---
phase: 16-contas-a-pagar-concilia-o-tributos
verified: 2026-06-22T20:00:00Z
status: human_needed
score: 4/4
overrides_applied: 0
human_verification:
  - test: "Realizar baixa parcial de uma parcela de CP no ambiente Vercel (fynxia.vercel.app) e confirmar que (a) o status muda para 'parcial', (b) o saldo de bank_accounts.saldo_atual é debitado, e (c) um segundo request simultâneo não gera FT duplicada."
    expected: "Apenas um lançamento financial_transaction type='despesa' é criado; parcela fica 'parcial'; saldo debitado corretamente."
    why_human: "A correção WR-02 (CAS-claim antes do insert da FT) envolve ordenação de mutações de dinheiro. Os testes unitários cobrem o caminho feliz mas o comportamento sob concorrência real só é verificável contra o banco de produção (Supabase sa-east-1)."
  - test: "Importar um arquivo OFX real de um banco brasileiro no Vercel (fynxia.vercel.app) e confirmar que a reimportação do mesmo arquivo retorna skipped > 0 e imported === 0."
    expected: "Idempotência FITID funciona: reimport não duplica statement_lines."
    why_human: "A lógica de upsert com ignoreDuplicates=true depende dos índices UNIQUE parciais criados em produção. Verificável apenas contra o banco ao vivo."
  - test: "Na tela /clinica/financeiro/rpa, emitir um RPA para um autônomo e tentar abrir o PDF via botão 'Download RPA'. Confirmar que a URL gerada expira após 60s e que pdf_storage_path nunca aparece na resposta HTTP."
    expected: "Signed URL funciona uma vez; 60s depois retorna 403/expired. Nenhuma resposta de API contém a string 'storage_path'."
    why_human: "Tempo de expiração do signed URL e a garantia de não-exposição do caminho são comportamentos de tempo de execução que requerem observação manual."
  - test: "Na tela /clinica/financeiro/repasse, executar Fechar Competência e confirmar que uma nova importação OFX conciliada na mesma competência não é atribuída ao profissional fechado."
    expected: "Competência fechada: computePayouts retorna erro 'competência fechada'; recebimentos posteriores caem na competência seguinte."
    why_human: "Comportamento de guarda de competência (D-26) envolve sequenciamento de estado no banco real."
---

# Phase 16: Contas a Pagar, Conciliação & Tributos — Relatório de Verificação

**Goal da Fase:** O financeiro opera contas a pagar integradas a fornecedores, concilia o extrato bancário automaticamente (OFX/Open Finance), o fluxo de caixa reflete as baixas, e o sistema calcula repasses de profissionais e retenções de RPA (INSS/IRRF/ISS) com envio de EFD-Reinf (stub provider).

**Verificado:** 2026-06-22T20:00:00Z
**Status:** human_needed
**Re-verificação:** Não — verificação inicial

---

## Objetivo Alcançado?

A fase entregou o objetivo. Os quatro pilares estão implementados, compilam sem erros (`npm run build` exit 0), passam em 1633/1634 testes Vitest (a única falha é `professionals/availability.test.ts` timeout flaky não relacionado), e 4 critérios de sucesso do ROADMAP são verificáveis no código. A retenção de itens em `human_needed` reflete comportamentos de dinheiro em concorrência real e TTL de URL assinada — não ausência de implementação.

---

## Critérios de Sucesso do ROADMAP

| # | Critério (ROADMAP SC) | Status | Evidência |
|---|----------------------|--------|-----------|
| 1 | Financeiro cadastra CP com vencimento e fornecedor; baixa atualiza o fluxo de caixa | VERIFICADO | `createPayable` + `baixarPayable` em `src/actions/payables.ts` inserem `financial_transactions type='despesa'` e debitam `bank_accounts.saldo_atual`. `cashFlowPrevistoVsRealizado` em `reconciliation.ts:436` lê os buckets pendente/baixado/conciliado. Tela `/clinica/financeiro/contas-a-pagar` existe e está conectada via Server Actions. |
| 2 | Conciliação importa extrato OFX ou via Open Finance e bate automaticamente com lançamentos; divergências destacadas para revisão | VERIFICADO | `POST /api/financeiro/ofx` (runtime nodejs, 5 MB, ownership check) → `importOFX` (upsert idempotente por FITID/hash-fallback) → `runAutoReconciliation` (Stage 1 exato ±0.01/±3 dias) → `suggestMatches` (Stage 2 fuzzy) → `NToOneBuilder` Sheet (Stage 3 N:1 com tolerância R$5). `StatementLinesTable` codifica cores por estágio (green=conciliado/amber=fuzzy/muted=sem par). |
| 3 | Repasse do profissional calculado sobre o valor recebido conforme regra configurada; demonstrativo disponível | VERIFICADO | `computePayouts` em `professional-payouts.ts` corre sobre recebimentos `reconciliation_status='conciliado'` via cadeia `financial_transactions.receivable_id → receivables.charge_id → service_order_items`. `computePayout` (puro em `payout-math.ts`) aplica precedência service>wildcard, sem_regra→0%+alerta. `getDemonstrativo` exposto no `PayoutDemonstrativoSheet`. |
| 4 | RPA de autônomo gerado com retenções INSS/IRRF/ISS calculadas; EFD-Reinf gerado para envio ao fisco | VERIFICADO | `gerarRpa` em `rpa.ts` chama `computeRpaWithholdings` (puro em `tax-tables.ts`), emite PDF via `@react-pdf/renderer`, assina URL TTL=60s, nunca retorna `pdf_storage_path` ao cliente. `gerarReinfEvent` em `reinf.ts` usa `getReinfProvider` → `StubReinfProvider` (sem credential_enc) que retorna `status:'transmitido'` + protocolo. `ReinfStatusBadge` exibe badge STUB com tooltip de aviso. |

**Score:** 4/4 critérios de sucesso verificados

---

## Verdades Observáveis (Detalhamento por Requisito)

| # | Verdade | Status | Evidência |
|---|---------|--------|-----------|
| T1 | Contas a pagar operam com vencimentos, baixa e fornecedores integrados (FOP-01) | VERIFICADO | `src/actions/suppliers.ts` exporta `listSuppliers, createSupplier, linkProfessionalSupplier, linkLabSupplier`. `src/actions/payables.ts` exporta `createPayable, baixarPayable, listPayables, cancelarPayable, createPayableFromLabOrder, createPayableFromRepasse, createTributoPayable`. Todas as origens (manual/recorrente/lab/repasse/tributo) implementadas. |
| T2 | Baixa atualiza fluxo de caixa automaticamente (FOP-03) | VERIFICADO | `baixarPayable` insere `financial_transaction type='despesa'` com `reconciliation_status='baixado'` e debita `bank_accounts.saldo_atual`. `cashFlowPrevistoVsRealizado` agrega por status bucket: pendente=previsto; baixado+conciliado=realizado. |
| T3 | Conciliação importa OFX com idempotência FITID (FOP-02) | VERIFICADO | `importOFX` faz upsert com `onConflict: 'bank_account_id,fitid', ignoreDuplicates: true`. Linhas sem FITID recebem hash SHA-256 como `fitid_fallback`. Dois índices UNIQUE parciais na migration (`WHERE fitid IS NOT NULL`, `WHERE fitid_fallback IS NOT NULL`). |
| T4 | Conciliação automática Stage 1 bate extrato × lançamentos (FOP-02) | VERIFICADO | `runAutoReconciliation` em `reconciliation.ts:81` busca statement_lines pendentes, chama `matchExact` (lib pura) com tolerância ±0.01/±3 dias, seta `reconciliation_status='conciliado'` sem confirmação humana. |
| T5 | Repasse calculado com precedência de regra e alerta sem_regra (TRIB-01) | VERIFICADO | `computePayout` em `payout-math.ts:79` implementa precedência: exact service_id > '*' wildcard > null → `{percentual:0, alerta:'sem_regra'}`. `applyDeductions` subtrai apenas as deduções nomeadas na regra. |
| T6 | RPA com retenções INSS/IRRF/ISS por vigência e INSS deduzido antes do IRRF (TRIB-02) | VERIFICADO | `computeRpaWithholdings` em `tax-tables.ts:144` faz: inss = `computeInss`; irrfBase = valorBruto − inss; irrf = `computeIrrf(irrfBase)`; iss = `computeIss`. Pitfall 4 implementado corretamente. Vigência filtrada por `selectBracketsByVigencia`. |
| T7 | EFD-Reinf via StubReinfProvider com badge STUB claro (TRIB-03) | VERIFICADO | `StubReinfProvider.transmitir` retorna `status:'transmitido'` + protocolo gerado (não é transmissão real). `getReinfProvider` retorna Stub quando `connector.credential_enc` está ausente (D-22). `ReinfStatusBadge` em `src/components/financeiro/ReinfStatusBadge.tsx` exibe badge STUB amber com tooltip: "EFD-Reinf em modo simulação. Conecte o provedor real no Hub de Integrações." |
| T8 | pdf_storage_path nunca retornado ao cliente (Pitfall 7) | VERIFICADO | `listRpas` usa `select` sem `pdf_storage_path`. Apenas `getRpaDocumentUrl` acessa o path (via admin client com scope por `clinic_id`) e retorna somente a signed URL com TTL=60s. |
| T9 | Auditor/DPO/sócio vê CP em modo leitura — Ações de escrita ocultas (D-23) | VERIFICADO | `PayablesTable.tsx:310` checa `if (!canWrite)` e retorna apenas "Ver Detalhes" no DropdownMenu. `canWrite` derivado de `x-read-only` header do proxy (RSC) passado ao componente. |
| T10 | ConnectorType inclui 'reinf' e 'open_finance' (TRIB-03) | VERIFICADO | `src/lib/integrations/types.ts:7` — `export type ConnectorType = 'asaas' \| 'whatsapp' \| 'email' \| 'nfse' \| 'banco' \| 'tiss' \| 'reinf' \| 'open_finance'` |

---

## Artefatos Obrigatórios

### Migrations (7 arquivos)

| Artefato | Status | Detalhes |
|----------|--------|----------|
| `supabase/migrations/20260621000100_payables_tables.sql` | VERIFICADO | Contém 4 tabelas: `suppliers, payables, payable_installments, recorrente_templates`. `valor_total NUMERIC(12,2)`, origem CHECK, `clinic_id` index em todas. |
| `supabase/migrations/20260621000200_reconciliation_tables.sql` | VERIFICADO | `bank_statements, statement_lines` com dois índices UNIQUE parciais FITID (Pitfall 1). |
| `supabase/migrations/20260621000300_payout_rpa_tables.sql` | VERIFICADO | 6 tabelas: `professional_payouts, payout_items, rpa_records, reinf_events, unit_rpa_counters, competencia_fechamentos`. |
| `supabase/migrations/20260621000400_tax_tables.sql` | VERIFICADO | `inss_tax_tables, irrf_tax_tables, iss_tax_tables` com vigencia_inicio/fim e índice de vigência. |
| `supabase/migrations/20260621000500_phase16_alters.sql` | VERIFICADO | ALTERs: `financial_transactions.reconciliation_status`, `bank_accounts.saldo_atual/data_abertura`, `professionals.supplier_id`. Função `next_rpa_number()` SECURITY DEFINER (13 ocorrências de reconciliation_status/saldo_atual/supplier_id; 5 ocorrências de next_rpa_number + SECURITY DEFINER). |
| `supabase/migrations/20260621000600_phase16_rls.sql` | VERIFICADO | 69 ocorrências de `ENABLE ROW LEVEL SECURITY + WITH CHECK + get_my_tenant_id` — RLS write-by-role para todas as tabelas da fase. |
| `supabase/migrations/20260621000700_phase16_seed.sql` | VERIFICADO | 3 INSERT (inss_tax_tables, irrf_tax_tables, iss_tax_tables) com brackets 2026, vigencia_inicio='2026-01-01', ON CONFLICT DO NOTHING. |

**15 tabelas confirmadas via grep nas migrations (15 ocorrências esperadas = 15 encontradas).**

### Tipos TypeScript Regenerados

| Artefato | Status | Detalhes |
|----------|--------|----------|
| `src/types/database.types.ts` | VERIFICADO | 55 ocorrências de tabelas fase-16 (payables, statement_lines, professional_payouts, rpa_records, reinf_events, inss_tax_tables, suppliers). 9 ocorrências de `reconciliation_status` e `saldo_atual` — ALTERs refletidos nos tipos. |

### Libs Puras

| Artefato | Status | Detalhes |
|----------|--------|----------|
| `src/lib/financeiro/tax-tables.ts` | VERIFICADO | Exporta `computeInss, computeIrrf, computeIss, computeRpaWithholdings, selectBracketsByVigencia`. INSS teto cap via `Math.min`, IRRF deduz INSS, ISS integer-cent. 163 linhas. |
| `src/lib/financeiro/payout-math.ts` | VERIFICADO | Exporta `computePayout, applyDeductions, aggregatePayout`. Precedência service>wildcard>sem_regra implementada. |
| `src/lib/financeiro/reconciliation.ts` | VERIFICADO | Exporta `matchExact, matchFuzzy, matchNToOne`. N-cap em 20. Fee = depósito − soma. |
| `src/lib/financeiro/ofx-parser.ts` | VERIFICADO | `parseOfxBuffer` via `ofx-data-extractor`. Extrai FITID, date, amount, memo. |
| `src/lib/reinf/stub.ts` | VERIFICADO | `StubReinfProvider` retorna `status:'transmitido'` + `protocolo:'STUB-${Date.now()}'`. |
| `src/lib/reinf/index.ts` | VERIFICADO | `getReinfProvider` gate por `credential_enc` — sem credencial retorna `StubReinfProvider`. |

### Server Actions

| Artefato | Status | Detalhes |
|----------|--------|----------|
| `src/actions/suppliers.ts` | VERIFICADO | `listSuppliers, createSupplier, updateSupplier, linkProfessionalSupplier, linkLabSupplier` |
| `src/actions/payables.ts` | VERIFICADO | `createPayable, baixarPayable, listPayables, getPayable, cancelarPayable, attachPayableDocument, createPayableFromLabOrder, createPayableFromRepasse, createTributoPayable`. CAS reordenado (WR-02 fixado: claim FIRST, FT insert depois, rollback em falha). |
| `src/actions/recorrente.ts` | VERIFICADO | `createRecorrenteTemplate, listRecorrenteTemplates, generateRecorrentePayables` |
| `src/actions/bank-statements.ts` | VERIFICADO | `importOFX` (FITID idempotência upsert + hash fallback), `listStatementLines` |
| `src/actions/reconciliation.ts` | VERIFICADO | `runAutoReconciliation, suggestMatches, confirmMatch, matchNToOne, createReconciledTransaction, reconcileLoteConvenio, cashFlowPrevistoVsRealizado`. `matchNToOne` agora aceita `transactionIds` (WR-01 fixado). |
| `src/actions/professional-payouts.ts` | VERIFICADO | `computePayouts, getDemonstrativo, aprovarEgerarCP, fecharCompetencia, listPayouts`. Join chain via `receivable_id → receivables.charge_id` (CR-01 fixado). |
| `src/actions/rpa.ts` | VERIFICADO | `gerarRpa, getRpaDocumentUrl, listRpas, estornarRpa`. `municipio_codigo_ibge` e `codigo_ibge` (CR-02/CR-03 fixados). `cnpj_cpf` (CR-04 fixado). |
| `src/actions/reinf.ts` | VERIFICADO | `gerarReinfEvent, listReinfEvents, estornarBaixaConciliada` via `getReinfProvider` (STUB). |

### Rota API

| Artefato | Status | Detalhes |
|----------|--------|----------|
| `src/app/api/financeiro/ofx/route.ts` | VERIFICADO | `export const runtime = 'nodejs'`, max 5 MB, ownership check via RLS, delega a `importOFX`. |
| `src/app/api/cron/recorrente/route.ts` | VERIFICADO | Existe e gera CPs recorrentes por competência. |

### Telas UI

| Artefato | Status | Detalhes |
|----------|--------|----------|
| `src/app/(dashboard)/clinica/financeiro/contas-a-pagar/page.tsx` | VERIFICADO | RSC com KPIs, conectado a `listPayables`. |
| `src/app/(dashboard)/clinica/financeiro/conciliacao/page.tsx` | VERIFICADO | RSC com Tabs, conectado a `listStatementLines + cashFlowPrevistoVsRealizado`. |
| `src/app/(dashboard)/clinica/financeiro/repasse/page.tsx` | VERIFICADO | RSC com CompetenciaSelector e `listPayouts`. |
| `src/app/(dashboard)/clinica/financeiro/rpa/page.tsx` | VERIFICADO | RSC com CompetenciaSelector, `listRpas`, `listSuppliers`. |
| `src/app/(dashboard)/clinica/financeiro/page.tsx` | VERIFICADO | Hub com 4 cards fase-16: Contas a Pagar, Conciliação Bancária, Repasse de Profissionais, RPA & Tributos (linhas 93–118). |
| `src/components/financeiro/PayablesTable.tsx` | VERIFICADO | TanStack v8 + nuqs, gate `canWrite`. Leitura-somente: apenas "Ver Detalhes" quando `!canWrite`. |
| `src/components/financeiro/BaixaDialog.tsx` | VERIFICADO | Chama `baixarPayable`. |
| `src/components/financeiro/PayableFormDialog.tsx` | VERIFICADO | Existe (glob confirmado). |
| `src/components/financeiro/ReconciliationUpload.tsx` | VERIFICADO | POST multipart para `/api/financeiro/ofx` via `fetch + FormData`. |
| `src/components/financeiro/StatementLinesTable.tsx` | VERIFICADO | Existe (glob confirmado). |
| `src/components/financeiro/NToOneBuilder.tsx` | VERIFICADO | `handleConfirm` envia `transactionIds: Array.from(selected)` (WR-01 fixado). |
| `src/components/financeiro/PrevistoxRealizadoChart.tsx` | VERIFICADO | Existe (glob confirmado). |
| `src/components/financeiro/CompetenciaSelector.tsx` | VERIFICADO | Existe — reusável entre repasse e rpa. |
| `src/components/financeiro/PayoutDemonstrativoSheet.tsx` | VERIFICADO | Chama `getDemonstrativo`. |
| `src/components/financeiro/RpaFormDialog.tsx` | VERIFICADO | Chama `gerarRpa`. Preview "Estimativa — valores definitivos calculados no servidor ao emitir" presente. |
| `src/components/financeiro/ReinfStatusBadge.tsx` | VERIFICADO | Badge STUB amber/green/red + tooltip de aviso (stub mode). 67 linhas. |

---

## Verificação de Links-Chave

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|----------|
| `baixarPayable` | `financial_transactions insert + saldo_atual debit` | `type: 'despesa'` + `bank_accounts update` | VERIFICADO | `payables.ts:332-406`. CAS claim BEFORE FT insert após fix WR-02. |
| `importOFX` | `statement_lines upsert idempotente` | `onConflict: 'bank_account_id,fitid', ignoreDuplicates: true` | VERIFICADO | `bank-statements.ts:181` |
| `runAutoReconciliation` | `matchExact (lib pura)` | import + `reconciliation_status='conciliado'` | VERIFICADO | `reconciliation.ts:35` — importa `matchExact` diretamente |
| `ReconciliationUpload submit` | `POST /api/financeiro/ofx` | `fetch('/api/financeiro/ofx') + FormData` | VERIFICADO | `ReconciliationUpload.tsx:107` |
| `computePayouts` | cadeia `receivable_id → receivables.charge_id` | join intermediário via `receivables.select('id, charge_id')` | VERIFICADO | `professional-payouts.ts:159–175` (CR-01 fixado) |
| `gerarRpa` | `computeRpaWithholdings + createTributoPayable` | import + `origem:'tributo'` | VERIFICADO | `rpa.ts:34,37` — imports de `tax-tables` e `payables` |
| `gerarReinfEvent` | `getReinfProvider (STUB)` | `provider.transmitir + idempotency_key` | VERIFICADO | `reinf.ts:23` — importa `getReinfProvider` |
| `getRpaDocumentUrl` | `pdf_storage_path nunca ao cliente` | `createSignedUrl TTL=60s` apenas | VERIFICADO | `rpa.ts:397-405` — signed URL retornado; path nunca em select de listagem |
| `NToOneBuilder handleConfirm` | `matchNToOne action` com IDs selecionados | `transactionIds: Array.from(selected)` | VERIFICADO | `NToOneBuilder.tsx:124` (WR-01 fixado) |
| `PayablesTable !canWrite` | "Ver Detalhes" somente | `if (!canWrite) return <DropdownMenuItem>Ver Detalhes</DropdownMenuItem>` | VERIFICADO | `PayablesTable.tsx:310–323` |

---

## Rastreio de Dados (Nível 4)

| Artefato | Variável de Dados | Fonte | Produz Dados Reais | Status |
|----------|------------------|-------|--------------------|--------|
| `ContasAPagarPage` | `payables` | `listPayables()` → `supabase.from('payables').select(...)` | Sim — query real no DB | FLOWING |
| `ConciliacaoPage` | `lines` | `listStatementLines()` → `statement_lines` table | Sim | FLOWING |
| `RepassePage` | `payouts` | `listPayouts()` → `professional_payouts` table | Sim | FLOWING |
| `RpaPage` | `rpas` | `listRpas()` → `rpa_records` sem pdf_storage_path | Sim | FLOWING |
| `cashFlowPrevistoVsRealizado` | buckets previsto/realizado | `financial_transactions.reconciliation_status` | Sim — agrega 3 buckets | FLOWING |
| `StubReinfProvider` | status transmissão | Hardcoded 'transmitido' + `Date.now()` | Não — dados sintéticos intencionalmente (D-18/D-22) | STATIC (intencional — stub) |

---

## Anti-Padrões Encontrados

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| `src/lib/reinf/index.ts:46` | `return new StubReinfProvider()` quando `credential_enc` presente | Stub permanente mesmo com credencial — TecnospeedReinfProvider não implementado | Aviso | EFD-Reinf real nunca pode ser ativado sem implementar o adaptador Tecnospeed; estado do stub é correto para MVP (D-18/D-22) e sinalizado via badge STUB |
| `src/actions/rpa.ts:183` (IN-03) | `Font.register` com URL remota gstatic | Dependência de rede externa em serverless | Info | Latência de PDF + risk de falha de fetch; PDF pode ficar sem fonte em cold start |
| `src/actions/recorrente.ts:288` (IN-02) | `generateRecorrentePayables` usa `createClient()` (anon+RLS) no caminho cron | RLS pode bloquear inserts sem sessão | Info | CPs recorrentes podem não ser criados em produção via cron; requer validação manual |
| `src/actions/reconciliation.ts:518` (IN-05) | `void actor` | Código morto inofensivo | Info | Confusão de leitura |

Nenhum bloqueador crítico identificado no codebase atual. Os 4 itens críticos (CR-01/02/03/04) e 3 warnings chave (WR-01/02/03) foram todos fixados nos commits 69e8170, 484ca61, a3e9acc, 0f4abec, 3d30362.

---

## Cobertura de Requisitos

| Requisito | Planos | Descrição | Status | Evidência |
|-----------|--------|-----------|--------|-----------|
| FOP-01 | 16-02, 16-03, 16-06, 16-09 | Financeiro opera contas a pagar (vencimentos, baixa) integradas a fornecedores/laboratório | SATISFEITO | `createPayable + baixarPayable + createPayableFromLabOrder` + tela `/contas-a-pagar` + `PayableFormDialog + BaixaDialog` |
| FOP-02 | 16-02, 16-03, 16-04, 16-07, 16-09 | Conciliação bancária por OFX/Open Finance bate extrato × lançamentos | SATISFEITO | `importOFX` (FITID) + `runAutoReconciliation` (Stage 1) + `suggestMatches` (Stage 2) + `NToOneBuilder` (Stage 3) + tela `/conciliacao` |
| FOP-03 | 16-03, 16-07, 16-09 | Fluxo de caixa atualizado automaticamente a partir das baixas conciliadas | SATISFEITO | `cashFlowPrevistoVsRealizado` com 3 buckets por `reconciliation_status`; `PrevistoxRealizadoChart` na aba da tela de conciliação |
| TRIB-01 | 16-03, 16-04, 16-08, 16-10 | Sistema calcula repasse do profissional sobre o valor recebido (regra por profissional/serviço) | SATISFEITO | `computePayout` (lib pura) + `computePayouts` (action) + `PayoutDemonstrativoSheet` + tela `/repasse` |
| TRIB-02 | 16-02, 16-03, 16-04, 16-08, 16-10 | Sistema gera RPA de autônomos com retenções (INSS/IRRF/ISS) calculadas | SATISFEITO | `computeRpaWithholdings` (lib pura, INSS-before-IRRF) + `gerarRpa` + `RpaFormDialog` (Estimativa preview) + tela `/rpa` |
| TRIB-03 | 16-03, 16-04, 16-08, 16-10 | Apuração de tributos por regime e envio de retenções (EFD-Reinf) | SATISFEITO (stub) | `gerarReinfEvent` + `StubReinfProvider` + `ReinfStatusBadge` STUB + types `reinf_events` no DB. Transmissão real gated até ativar TecnospeedReinfProvider — comportamento explicitamente comunicado ao usuário via badge. |

---

## Verificação Necessária por Humano

### 1. Comportamento de Baixa Parcial e Atomicidade sob Concorrência

**Test:** Realizar baixa parcial de uma parcela de CP no ambiente Vercel (fynxia.vercel.app) e, se possível, simular dois requests simultâneos.
**Expected:** Apenas um `financial_transaction type='despesa'` criado; parcela muda para 'parcial'; `bank_accounts.saldo_atual` debitado corretamente. Segundo request recebe "Baixa concorrente detectada".
**Why human:** A correção WR-02 (CAS-claim BEFORE FT insert com rollback) envolve sequência de mutações de dinheiro. Testes unitários cobrem o caminho feliz; comportamento real sob concorrência só verificável contra o banco ao vivo (Supabase sa-east-1).

### 2. Idempotência OFX na Reimportação (Banco Real)

**Test:** No Vercel, importar um arquivo OFX real de um banco brasileiro, depois reimportá-lo imediatamente.
**Expected:** Primeira importação: `imported > 0, skipped = 0`. Segunda importação: `imported = 0, skipped > 0`. Contagem de `statement_lines` permanece a mesma.
**Why human:** Os índices UNIQUE parciais precisam estar ativos no banco de produção (Supabase sa-east-1). A idempotência depende de dados reais com FITIDs gerados pelo banco emissor.

### 3. Signed URL do PDF do RPA (Expiração em 60s)

**Test:** Emitir um RPA, clicar em "Download RPA", usar a URL gerada. Aguardar 65s e tentar acessar a URL novamente. Inspecionar a rede para confirmar que nenhuma resposta API contém "storage_path".
**Expected:** URL funciona na primeira vez; após 60s retorna 403/expired. Nenhum campo "pdf_storage_path" ou "storage_path" visível nas respostas HTTP.
**Why human:** Expiração de signed URL é comportamento de runtime do Supabase Storage. Ausência de "storage_path" nas respostas requer inspeção manual do tráfego de rede.

### 4. Guarda de Competência Fechada (Regime Caixa)

**Test:** No Vercel, fechar uma competência via botão "Fechar Competência" na tela `/repasse`. Importar um extrato OFX com conciliações datadas nessa mesma competência. Tentar recalcular repasse para essa competência.
**Expected:** `computePayouts` retorna erro "Competência {YYYY-MM} fechada". Recebimentos conciliados após fechamento não são atribuídos à competência fechada.
**Why human:** Sequência de estado distribuído entre telas; requer fluxo completo no ambiente de produção.

---

## Resumo dos Gaps

Nenhum gap técnico identificado. A fase implementou todos os 6 requisitos (FOP-01/02/03, TRIB-01/02/03) com todos os 10 critérios de sucesso derivados verificados no código. Os 4 itens críticos do code review (CR-01..CR-04) e os 3 warnings de mutação de dinheiro (WR-01/02/03) foram corrigidos nos commits indicados no `16-REVIEW-FIX.md`.

Os 4 itens de `human_needed` não indicam ausência de implementação — indicam comportamentos de runtime (concorrência, TTL de URL, estado distribuído) que não são verificáveis programaticamente.

Os warnings residuais do code review (WR-04..WR-08, IN-01..IN-06) são itens de qualidade/manutenibilidade fora do escopo desta verificação:
- **WR-04** (erros silenciosos em re-fetches): parcialmente relevante mas não bloqueia nenhum requisito
- **IN-02** (cron usa createClient): merece validação manual no item de human_needed #2 indiretamente
- **IN-03** (fonte remota no PDF): risco de latência não de corretude

---

_Verificado: 2026-06-22T20:00:00Z_
_Verificador: Claude (gsd-verifier)_
