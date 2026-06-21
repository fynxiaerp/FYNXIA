# Phase 16: Contas a Pagar, Conciliação & Tributos - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Construir o **lado "pagar" + conciliação + camada tributária/repasse** do financeiro v2:

1. **Contas a pagar (CP)** — fornecedores, vencimentos, parcelas e baixa que atualiza o fluxo de caixa e o saldo bancário (FOP-01).
2. **Conciliação bancária** — importar extrato **OFX** (real) ou **Open Finance** (gated via Hub Fase 9) e bater contra os lançamentos, destacando divergências (FOP-02).
3. **Fluxo de caixa realizado** — separado de previsto, atualizado a partir das baixas conciliadas + movimentação de saldo bancário (FOP-03).
4. **Repasse do profissional** — cálculo sobre o valor recebido + demonstrativo + CP ao profissional (TRIB-01).
5. **RPA & tributos** — RPA de autônomo com retenções INSS/IRRF/ISS + apuração por regime + geração do EFD-Reinf STUB-gated (TRIB-02, TRIB-03).

**Fora de escopo** (outras fases): DRE/orçado×realizado/distribuição de lucro consolidados → **Fase 19 (Relatórios/BI)**; profissional ver o próprio demonstrativo → **Fase 18 (App do Profissional)**; folha de pagamento CLT → **v2 (RH)**; XML/transmissão fiscal real homologada → gated em provider real; rateio percentual multi-centro de custo → herdado como deferido da Fase 14; baixa de estoque por procedimento → **Fase 17**.
</domain>

<decisions>
## Implementation Decisions

### Contas a Pagar & Fornecedores
- **D-01:** Tabela **`suppliers` nova** (cadastro de rede, `clinic_id`): CNPJ/CPF, dados bancários/PIX, tipo (lab, material, serviço, autônomo). O **laboratório** (Fase 13) e o **profissional autônomo** linkam/viram um supplier — centraliza quem recebe pagamento (e alimenta o EFD-Reinf de serviços tomados).
- **D-02:** **Origens de CP** nesta fase (todas as quatro):
  - (a) **Manual** — lançamento avulso (vencimento + fornecedor + conta contábil/centro de custo da Fase 14).
  - (b) **Recorrente** — template de despesa fixa (aluguel/salário/assinatura) que gera CP por competência (via Cron).
  - (c) **Auto de OS de laboratório** — OS de prótese concluída (Fase 13 LAB-02) gera CP automático para o laboratório.
  - (d) **Auto de repasse** — o repasse calculado (D-15) vira CP a pagar ao profissional.
- **D-03:** **Baixa do CP** escolhe a `bank_account`, cria `financial_transaction` de **saída** e **debita o saldo bancário imediatamente**; a conciliação posterior confirma/casa com o extrato (caixa reflete a realidade operacional, conciliação valida).
- **D-04:** CP suporta **parcelas** (vencimentos distintos) e **baixas parciais** (valor pago < saldo) — espelha o parcelamento de recebíveis da Fase 3.

### Conciliação Bancária & Fluxo de Caixa
- **D-05:** Entrada de extrato: **OFX upload real** (totalmente funcional agora) + **Open Finance STUB-gated** como conector no Hub (Fase 9), ativado só com credencial real (mesmo padrão gated NFS-e/TISS da Fase 15).
- **D-06:** Matching **auto exato** (valor + data com janela de tolerância) + **sugestões fuzzy** ranqueadas (por valor/referência) que o usuário confirma — reduz trabalho manual sem auto-conciliar errado.
- **D-07:** Linha do extrato **sem par** → **sugestão de criar lançamento** conciliado em 1 clique (`financial_transaction` classificado por conta contábil/centro de custo) — extrato como fonte da verdade preenche lacunas.
- **D-08:** Lançamento ganha **status** (pendente / baixado / conciliado); fluxo de caixa separa **previsto** (CP/CR em aberto) de **realizado** (conciliado) — atende FOP-03 e dá base aos relatórios da Fase 19.
- **D-09:** **Match N:1** — 1 depósito do extrato casa com N recebíveis/lançamentos cujo somatório (menos taxas) bate com o valor creditado; a diferença de taxa vira lançamento de despesa (reflete o payout em lote do Asaas).
- **D-10:** **Baixa/conciliação do lote de convênio** (deferida da Fase 15 D-15): quando a operadora paga, concilia o crédito do extrato com o(s) recebível(eis) do lote; **pagamento parcial por glosa** baixa só o autorizado e mantém o glosado em aberto/recurso (item a item, coerente com a glosa por item da Fase 15 D-28).
- **D-11:** **Idempotência da importação OFX** — cada linha guarda o **FITID** do OFX; reimportação ignora linhas já existentes (chave `conta+FITID`; fallback `data+valor+documento` quando faltar FITID). Mesmo princípio idempotente do webhook Asaas / Fase 15 D-30.
- **D-12:** Conta corrente tem **saldo/data de abertura** (concilia a partir daí); CP e demonstrativos **filtram por unidade** via centro de custo, mesmo com `bank_accounts` sendo cadastro de rede (`clinic_id`) — multiunidade coerente com Fases 7/14.

### Repasse do Profissional
- **D-13:** Base de cálculo = **valor recebido com deduções configuráveis** (custo de laboratório, materiais, taxa de cartão, impostos retidos) antes do %; deduções = 0 ⇒ incide sobre o bruto recebido. Cobre clínicas que repassam sobre líquido e sobre bruto.
- **D-14:** Repasse reconhecido **no recebimento conciliado** (regime caixa) — coerente com "sobre o valor recebido" do TRIB-01 e com a Fase 15 (particular Asaas / lote convênio conciliado aqui).
- **D-15:** Saída = **demonstrativo por profissional/período** (itens que compõem o repasse) + **CP a pagar ao profissional** (origem "auto de repasse", D-02d).
- **D-16:** **Vínculo define o tratamento** (vínculo armazenado na Fase 11): **autônomo** → repasse via RPA com retenções INSS/IRRF/ISS (área RPA); **PJ** → repasse sem retenção (contra nota do PJ); **CLT** → fora do escopo desta fase (folha/RH é v2).

### RPA, Retenções & Tributos
- **D-17:** Cálculo de **INSS/IRRF/ISS** via **tabelas de faixa seed, versionadas por vigência** (INSS/IRRF progressivos por faixa; ISS por município/serviço), seed padrão editável — evita recalcular errado quando a tabela muda; auditável ao longo do tempo.
- **D-18:** **EFD-Reinf STUB-gated** (como NFS-e/TISS): adapter STUB gera representação/arquivo simulado e arquiva; o layout oficial (R-2010/R-4020), assinatura e transmissão ao SPED ficam gated em provider/certificado real.
- **D-19:** **Regime tributário** (`clinics_regime`, Fase 15) **dirige a apuração** — Simples/Presumido/Real definem quais retenções e tributos se aplicam e como apurar.
- **D-20:** Geração do RPA produz **PDF arquivado** (`@react-pdf/renderer`, bucket Fase 8) + lança as **retenções como tributos a recolher** (CP/obrigação com vencimento: DARF/GPS/ISS) — fecha o ciclo pagar+recolher.
- **D-21:** **Abrangência do EFD-Reinf**: cobre retenções de **RPA de autônomo E** retenções sobre **outros serviços tomados** (PJ/laboratório).
- **D-22:** **`ReinfProvider`** provider-agnostic STUB-gated, registrado como conector no Hub (Fase 9), preferindo o **mesmo agregador fiscal da NFS-e** (ex.: Tecnospeed, que também faz Reinf/eSocial) quando houver provider real — consistência com `FiscalProvider`/`TissProvider` da Fase 15.

### Permissões, Estorno, Telas & Fechamento
- **D-23:** Permissões: **escrita admin/financeiro**; **auditor/DPO/sócio read-only**; recepção/dentista **sem acesso** ao módulo. Evolui o write-by-role do RLS financeiro da Fase 15.
- **D-24:** **Estorno** de baixa conciliada / cancelamento de CP pago / desfazer RPA passa por **aprovação por alçada** (`approval_requests`, Fase 10) com motivo + registro na trilha de auditoria — mesmo padrão do estorno fiscal da Fase 15.
- **D-25:** Telas de CP, Conciliação, Repasse e RPA como **subrotas sob `/clinica/financeiro`** (como a Fase 15), reaproveitando layout/nav; módulos no proxy; detalhe fino de UI no `/gsd-ui-phase` (UI hint = yes).
- **D-26:** **Competência mensal por unidade** para repasse e RPA, com **fechamento**; recebimento conciliado **após** o fechamento entra na **próxima competência**; **numeração sequencial do RPA por unidade** — evita reabrir períodos fechados.

### Anexos
- **D-27:** CP aceita **anexo** (nota do fornecedor, comprovante de pagamento) e o RPA **arquiva o PDF** — tudo no **bucket de documentos (Fase 8)** com metadados (rastreabilidade fiscal, reusa infra pronta).

### Claude's Discretion
- Nomes/colunas/índices/FKs exatos das novas tabelas (`suppliers`, `payables`/parcelas, `bank_statements`/`statement_lines`, `professional_payouts`, `rpa`, `tax_withholdings`, tabelas de tributo…), seguindo padrões financeiros (`NUMERIC(12,2)`, índice em `clinic_id`/`unit_id`).
- **Precedência da regra de comissão**: regra por serviço sobrepõe a regra geral do profissional; sem regra ⇒ 0% + alerta (a critério do planner).
- Estrutura dos seeds (tabelas INSS/IRRF/ISS por vigência, tipos de fornecedor).
- Janela de tolerância do matching exato e ranking do fuzzy.
- Formato exato dos PDFs (RPA/demonstrativo) e da representação stub de OFX/EFD-Reinf.
- Layout/componentização fina das telas → definido em `/gsd-ui-phase`.

### Folded Todos
Nenhum todo pendente casou com a Fase 16 (`todo match-phase 16` = 0).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo & requisitos
- `.planning/ROADMAP.md` §"Phase 16: Contas a Pagar, Conciliação & Tributos" (linhas ~270–281) — goal, success criteria, dependências, v1 reuse.
- `.planning/REQUIREMENTS.md` — FOP-01, FOP-02, FOP-03 (linhas ~86–88) e TRIB-01, TRIB-02, TRIB-03 (linhas ~96–98).

### Decisões herdadas (locked — não rediscutir)
- `.planning/phases/14-financeiro-cadastros-base/14-CONTEXT.md` — `bank_accounts`, plano de contas (`chart_of_accounts`), `cost_centers`, classificação obrigatória de `financial_transactions` (account_id + cost_center_id + bank_account_id opcional). **Deferiu para cá** a movimentação de saldo bancário (D-04a / Deferred).
- `.planning/phases/15-faturamento-nfs-e-conv-nios-tiss/15-CONTEXT.md` — linha da OS carrega `professional_id` como **base de repasse** (D-29); recebível de convênio/lote com **baixa/conciliação aqui** (D-15); glosa por item (D-28); padrão **provider-agnostic + STUB gated** (FiscalProvider/TissProvider, D-01); idempotência obrigatória (D-30); `clinics_regime` (config fiscal, D-16).
- `.planning/phases/11-profissionais-recursos/11-CONTEXT.md` — `professionals` com **regra de % comissão** (por profissional/serviço) e **vínculo** (CLT/PJ/autônomo); PRO-03 só armazena a regra, o cálculo é aqui (D-01).
- `.planning/phases/09-hub-de-integra-es-externas/09-CONTEXT.md` — `integration_connectors`/`integration_events`, `logToHub`, retry via Cron, credencial AES-256 — alvo dos conectores **banco/Open Finance** e **EFD-Reinf**.
- `.planning/phases/10-ia-governada-l0-l4-auditoria-ocr/10-CONTEXT.md` — estorno via **aprovação por alçada** (`approval_requests`) + trilha de auditoria (reuso em D-24).
- `.planning/phases/08-documentos-assinatura-icp-brasil/08-CONTEXT.md` — bucket de documentos (arquivamento de RPA, notas e comprovantes, D-20/D-27).
- `.planning/phases/03-financial-mvp/03-CONTEXT.md` — fluxo de caixa, `financial_transactions`, recebíveis/parcelamento e webhook Asaas idempotente (base de D-03/D-04/D-09).
- `.planning/phases/07-sistema-multiunidade-pap-is/07-CONTEXT.md` — cadastros de rede em `clinic_id`, `unit_id` nas linhas operacionais, `get_my_unit_ids()`, papéis novos (matriz D-23).

### Schema/código existente (expandir, não recriar)
- `supabase/migrations/20260606000100_financial_tables.sql` — `financial_transactions`/`financial_categories` (padrão de colunas, `NUMERIC(12,2)`, índice em tenant_id; alvo do status de conciliação D-08).
- `supabase/migrations/20260606000200_financial_rls.sql` — padrão RLS financeiro (evolui para write-by-role, D-23).
- `supabase/migrations/20260619001100_financial_cadastros_tables.sql` (+ `..._rls.sql`, `..._seed.sql`) — `chart_of_accounts`, `cost_centers`, `bank_accounts` (classificação + saldo de abertura D-12).
- `supabase/migrations/20260620000200_faturamento_os_tables.sql` — `service_orders`/linhas com `professional_id` (base de repasse) e recebíveis particular.
- `supabase/migrations/20260620000300_faturamento_tiss_tables.sql` — guia/lote TISS + recebível de convênio (alvo da baixa/conciliação D-10).
- `clinics_regime` (migration da Fase 15, config fiscal por unidade) — regime tributário que dirige a apuração (D-19).
- `supabase/migrations/20260619000400_lab_orders_rls.sql` (+ tabela `lab_orders`) — OS de laboratório (gatilho do CP automático D-02c).
- `src/actions/charges.ts`, `src/actions/receivables.ts`, `src/actions/transactions.ts` — recebíveis/parcelamento e lançamentos (padrão a espelhar em CP/baixa).
- `src/lib/integrations/types.ts`, `worker.ts`, `health.ts`, `hub-log.ts` + `src/lib/validators/connector.ts` — modelo de conector do Hub (banco/Open Finance e EFD-Reinf).
- `src/lib/messaging/queue.ts`, `worker.ts`, `reminder-scan.ts` — outbox/Cron a reusar no CP recorrente (D-02b) e no lembrete de vencimento.
- `src/lib/crypto.ts` — AES-256 para credenciais de conector.
- `CLAUDE.md` — RLS USING+WITH CHECK + index clinic_id; `'use server'` async-only; service role server-only; nodejs runtime nas rotas de webhook; deploy push em `master` E `master:main`; gotcha de re-auth Supabase (org kczvihafddupruvsrrsc / projeto jqjwyqlbbuqnrffdnlpp) antes de `db push`.

[Sem ADRs dedicados — decisões fiscais/contábeis capturadas acima.]
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`financial_transactions` / fluxo de caixa (Fase 3/14)** — recebe status de conciliação (D-08); a baixa do CP cria a saída e debita saldo (D-03).
- **`bank_accounts` (Fase 14)** — saldo de abertura + movimentação (D-12); destino da baixa e da conciliação.
- **`professionals` (Fase 11)** — regra de % comissão + vínculo, insumos do repasse (D-13/D-16).
- **`service_orders` + linhas com `professional_id` (Fase 15)** — base do repasse (recebido conciliado → %).
- **Lote/recebível de convênio (Fase 15)** — alvo da baixa/conciliação (D-10).
- **Hub de Integrações (Fase 9)** — `integration_connectors`/`integration_events`/`logToHub` hospedam os conectores Open Finance e EFD-Reinf (D-05/D-22) + retorno assíncrono.
- **Aprovação por alçada / estorno (Fase 10)** — reusado no estorno de baixa/CP/RPA (D-24).
- **Bucket de documentos (Fase 8) + `@react-pdf/renderer`** — RPA, notas e comprovantes (D-20/D-27).
- **Outbox + Cron (Fase 4/9)** — CP recorrente (D-02b) e lembrete de vencimento.
- **Régua de cobrança (Fase 4)** — reusada para lembrete de CP/tributos a vencer.

### Established Patterns
- FK `tenant_id UUID NOT NULL REFERENCES public.clinics(id)`; índice em `tenant_id`; `unit_id` nas linhas operacionais.
- Valores monetários `NUMERIC(12,2)`; validação `isMoney2dp`.
- RLS financeiro: SELECT amplo / escrita por papel (evolui do estrito — D-23).
- Provider-agnostic + adapter STUB gated (PaymentGateway/FiscalProvider/TissProvider) → replicado em **Open Finance** e **`ReinfProvider`** (D-05/D-22).
- Idempotência por chave + checagem de status (webhook Asaas / Fase 15 D-30) → reusada na importação OFX (D-11).
- Seed por tenant na criação da clínica → repete em `suppliers`/tabelas de tributo.

### Integration Points
- CP (manual/recorrente/lab/repasse) → baixa → `financial_transaction` saída + débito de `bank_account` → conciliação confirma.
- Extrato (OFX/Open Finance) → matching exato/fuzzy/N:1 → status conciliado → fluxo de caixa realizado.
- Recebimento conciliado → cálculo de repasse → demonstrativo + CP ao profissional.
- Autônomo → RPA (retenções por faixa/vigência) → PDF arquivado + tributos a recolher → EFD-Reinf (stub, via Hub).
- Telas sob `/clinica/financeiro/*`; módulos no proxy; estorno via alçada (Fase 10).
</code_context>

<specifics>
## Specific Ideas

- Reaproveitar ao máximo o financeiro existente (fluxo de caixa, recebíveis, parcelamento) e o padrão gated da Fase 15 — esta fase é **expansão**, não reescrita.
- Agregador fiscal preferido para EFD-Reinf = o mesmo da NFS-e (**Tecnospeed**, ou PlugNotas/Focus), que também cobre Reinf/eSocial.
- Payout do Asaas chega em lote no extrato → o matching N:1 com taxa no líquido é requisito prático (D-09).
- Tabelas de tributo (INSS/IRRF/ISS) **versionadas por vigência** para apuração correta retroativa.
</specifics>

<deferred>
## Deferred Ideas

- **DRE gerencial, orçado×realizado, distribuição de lucro por cota** — Fase 19 (Relatórios/Orçamento & BI); Fase 16 alimenta os dados.
- **Profissional ver o próprio demonstrativo de repasse** — Fase 18 (App do Profissional).
- **Folha de pagamento CLT** — v2 (RH); Fase 16 trata só PJ/autônomo.
- **XML/transmissão fiscal real homologada** (EFD-Reinf, Open Finance) — gated em provider/certificado real (D-18/D-22).
- **Rateio percentual multi-centro de custo** — herdado como deferido da Fase 14.
- **Baixa de estoque por procedimento concluído** — Fase 17.

### Reviewed Todos (not folded)
Nenhum todo pendente casou com a Fase 16.
</deferred>

---

*Phase: 16-contas-a-pagar-concilia-o-tributos*
*Context gathered: 2026-06-21*
</content>
