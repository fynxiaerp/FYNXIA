# Phase 15: Faturamento/NFS-e & Convênios/TISS - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Transformar **atendimento concluído** em **Ordem de Serviço (OS)** automática e faturá-la por dois caminhos:

- **Particular:** OS → **NFS-e** emitida na prefeitura (via agregador fiscal) → **parcelas a receber** via Asaas (Phase 3).
- **Convênio:** OS → **guia TISS** → **lote por operadora** com protocolo → **recebível contra a operadora** → tratamento de **glosas** (motivo ANS + recurso).

Cobre OS-01 (OS automática com procedimentos), OS-02 (NFS-e a partir da OS, arquivada), OS-03 (forma de pagamento gera parcelas), CONV-01 (operadora + tabela de preços), CONV-02 (guia + lote TISS com protocolo), CONV-03 (glosa classificada + recurso).

**Fora de escopo** (outras fases): contas a pagar/conciliação/recebimento do lote/extrato e tributos além de ISS (PIS/COFINS/IR/RPA/EFD-Reinf) → **Phase 16**; baixa de estoque por procedimento → **Phase 17**; orçamento/estimativa pré-OS → fase **Relatórios/Orçamento**.

</domain>

<decisions>
## Implementation Decisions

### Estratégia de integração NFS-e/TISS
- **D-01:** Construir o domínio **ponta-a-ponta atrás de uma abstração de provider** (`FiscalProvider` p/ NFS-e, `TissProvider` p/ TISS) com um **adapter STUB gated**. O stub simula emissão/retorno (número, protocolo, status). O provider real fica **gated em credenciais** — mesmo padrão de gating do projeto (Asaas sandbox, conector Phase 9). Entrega testável sem depender de setup externo.
- **D-02:** O alvo da abstração NFS-e é um **agregador fiscal único** (ex.: PlugNotas/Tecnospeed/Focus NFe) que normaliza a heterogeneidade municipal — **não** integrar prefeitura a prefeitura (ABRASF direto). O protótipo de NFS-e já cita Tecnospeed.
- **D-03:** Os providers NFS-e e TISS são registrados como **conectores no Hub de Integrações (Phase 9)** — credenciais criptografadas, `logToHub`, reprocesso em falha. Não duplicar infra de credenciais.

### Catálogo de serviços/preços
- **D-04:** Nova tabela **`services`** (cadastro de rede, `clinic_id`): nome, código, **valor particular**, conta contábil/categoria (liga ao plano de contas da Phase 14). É a fonte das linhas da OS.
- **D-05:** Campo **`tuss_code` opcional** por serviço (terminologia exigida na guia TISS — CONV-02). Opcional para não travar serviços puramente particulares.
- **D-06:** Tabela **`insurer_prices`** (operadora × serviço × valor). Preço do convênio **sobrepõe** o particular quando a OS é faturada via aquela operadora. Modelo preço-a-preço (não multiplicador %).
- **D-07:** **Seed** de catálogo odontológico padrão **editável** na criação da clínica (consulta, profilaxia, restauração, canal, exodontia, prótese…), consistente com seeds da Phase 3/14.

### OS — gatilho e ciclo
- **D-08:** Gatilho automático = **`appointment.status` → `concluido`** (status já existe no enum) cria uma **OS rascunho** vinculada ao appointment/paciente/dentista.
- **D-09:** Linhas de procedimento entram via **nova tabela `appointment_procedures`** (appointment × service = procedimentos executados), que alimenta as linhas da OS. Atende OS-01 de verdade e é **base do Phase 17** (baixa de estoque por procedimento concluído).
- **D-10:** Ciclo da OS = **rascunho → revisar → faturar** (máquina de estados explícita). Só ao **faturar** dispara recebível/NFS-e/guia.
- **D-11:** **1 OS por atendimento concluído** + permitir **OS avulsa manual** (venda de produto/serviço sem agendamento).

### Particular × Convênio
- **D-12:** **Pagador no nível da OS** — cada OS tem 1 pagador: **particular** (NFS-e + recebível Asaas) **OU** uma **operadora** (guia TISS + recebível da operadora). Caso misto = **2 OS** (uma particular, uma convênio). Sem ambiguidade fiscal.
- **D-15:** Faturar convênio gera **recebível(eis) vinculado(s) ao lote/operadora** (não Asaas). Glosa reduz o valor esperado; recurso pode reabrir. **Baixa/conciliação do lote fica na Phase 16.** Particular continua via Asaas (Phase 3).

### TISS & glosas
- **D-13:** **Modelar guia/lote TISS no banco** e gerar arquivo/representação via `TissProvider` **STUB** (protocolo/status simulados). **XML TISS real** (padrão ANS 3.x, guia odontológica/GTO) fica **gated** no provider real.
- **D-14:** Glosas classificadas por **tabela de motivos padrão ANS (seed, editável)**; usuário registra **recurso** (texto/anexo) e o **status atualiza na tela** de convênios.
- **D-28:** Glosa modelada **por ITEM da guia** (motivo ANS + valor glosado por item) — permite guia **parcialmente paga**; recurso por item; valor esperado do recebível ajusta item a item.
- **D-22:** **Lote TISS:** guias acumulam **por operadora**; usuário **fecha o lote** (por competência/período) e envia → stub retorna protocolo. (não automático por período).

### NFS-e — momento, config e arquivamento
- **D-20:** Emissão disparada no **faturar**, com **flag de regime por unidade**: **competência** (1 NFS-e pelo total da OS) ou **caixa** (NFS-e por parcela paga, acionada pelo webhook de pagamento Asaas). Default configurável.
- **D-16:** **Config fiscal por unidade** (mínimo viável): emitente, município, **série**, **próximo número**, **alíquota ISS padrão**, código de serviço municipal. Reusa `clinics_regime` p/ regime. ISS sobrescrevível **por serviço**. Número/série efetivos vêm do provider real (o stub simula).
- **D-17:** **Arquivar** XML/PDF de retorno da NFS-e e do lote TISS no **bucket de documentos existente (Phase 8)** com metadados (número, status). Gerar **PDF de recibo/OS** via `@react-pdf/renderer` (padrão Phase 3). Stub gera placeholder arquivável (atende OS-02 "fica arquivado").

### Recebíveis particular & idempotência
- **D-21:** Faturar OS particular chama **`createCharge` (Asaas, até 21x)** por OS, mapeando forma de pagamento (PIX/Boleto/Cartão) e descontos; vínculo **OS ↔ charge/receivable**; reusa webhook idempotente existente (Phase 3).
- **D-30:** **Idempotência obrigatória** na emissão externa — **chave por OS/guia + checagem de status** antes de emitir NFS-e / criar cobrança / enviar lote (evita duplicidade em retry/clique duplo). Reusa padrão idempotente do webhook Asaas (Phase 3) e `integration_events` (Phase 9).

### Retorno assíncrono
- **D-23:** Retorno de NFS-e/lote (processando → emitida/erro) chega via **webhook do provider roteado pelo Hub (Phase 9)** + **worker/cron de polling como fallback**. Stub resolve síncrono no dev. Atualiza status na tela (revalidate). Coerente com padrão outbox/webhook do projeto.

### Permissões & cancelamento
- **D-18:** Matriz de permissões: **dentista** marca atendimento concluído (gera OS rascunho); **recepção + admin** editam/faturam OS e emitem NFS-e; cadastro de operadora/config fiscal/tratamento de glosa = **admin/financeiro**. SELECT amplo, **escrita por papel** (evolui o RLS financeiro estrito).
- **D-19:** Cancelar OS faturada, cancelar NFS-e (dentro da janela do provider) e estornar recebível passam pelo **fluxo de estorno/aprovação por alçada da Phase 10**, com motivo + registro na trilha de auditoria. Stub simula cancelamento fiscal.

### Numeração, descontos, profissional & estados
- **D-25:** OS com **número sequencial por unidade** (emitente). Permitir **desconto/acréscimo por linha** + **desconto geral no total**, recalculando a base de NFS-e/parcelas.
- **D-26:** Cadastro de **operadora** (CONV-01): nome, CNPJ, **registro ANS**, **versão TISS**, credenciais/conector (via Hub Phase 9), contato, **regras de pagamento/prazo** (dias para repasse). Tabela de preços pendurada (`insurer_prices`).
- **D-29:** Cada **linha da OS carrega o profissional executor** (derivado de `appointment_procedures`/appointment) como **base de repasse futuro (TRIB-01, Phase 16)** — não calcula repasse agora, só deixa a base pronta sem refatorar.
- **D-27:** **Enums travados** alinhados ao protótipo:
  - OS: `rascunho` / `faturada` / `cancelada`
  - NFS-e: `processando` / `emitida` / `cancelada` / `erro`
  - Guia/lote TISS: `em_analise` / `autorizada` / `glosada` / `paga` (+ `recurso`)
  - Pagador da OS: `particular` / `convenio`

### Telas & rota
- **D-24:** Construir **telas reais** (OS/Faturamento, NFS-e, Convênios/TISS) sob **`/clinica/financeiro`** (subrota faturamento), reaproveitando o visual dos protótipos. Manter `/clinica/prototipos` como **referência** até paridade. Detalhes finos de UI no `/gsd-ui-phase` (UI hint = yes).

### Claude's Discretion
- Nomenclatura exata de colunas/índices/FKs e o desenho fino do schema.
- Estrutura do seed do catálogo de serviços (quais procedimentos folha) e dos motivos de glosa ANS.
- Formato exato do export TISS do stub e da chave de idempotência.
- Layout/componentização fina das telas → definido em `/gsd-ui-phase`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo & requisitos
- `.planning/ROADMAP.md` §"Phase 15: Faturamento/NFS-e & Convênios/TISS" (linhas ~244–258) — goal, success criteria, dependências, v1 reuse.
- `.planning/REQUIREMENTS.md` — OS-01, OS-02, OS-03 (linhas ~81–83) e CONV-01, CONV-02, CONV-03 (linhas ~91–93).

### Decisões herdadas (locked)
- `.planning/phases/14-financeiro-cadastros-base/14-CONTEXT.md` — plano de contas (`chart_of_accounts`), `cost_centers`, classificação obrigatória de `financial_transactions` (account_id + cost_center_id); todo lançamento gerado pela OS é classificado.
- `.planning/phases/03-financial-mvp/03-CONTEXT.md` — `PaymentGateway` provider-agnostic (Asaas), recebíveis/charges, webhook idempotente, recibo PDF.
- `.planning/phases/09-hub-de-integra-es-externas/09-CONTEXT.md` — `integration_connectors`/`integration_events`, `logToHub`, reprocesso em falha (alvo dos conectores NFS-e/TISS).
- `.planning/phases/10-ia-governada-l0-l4-auditoria-ocr/10-CONTEXT.md` — estorno via aprovação por alçada (`approval_requests`) + trilha de auditoria (reuso em cancelamento/estorno).
- `.planning/phases/08-documentos-assinatura-icp-brasil/08-CONTEXT.md` — assinatura ICP-Brasil + bucket de documentos (arquivamento NFS-e/lote).
- `.planning/phases/07-sistema-multiunidade-pap-is/07-CONTEXT.md` — cadastros de rede em `clinic_id`, `unit_id` nas linhas operacionais, `get_my_unit_ids()`, papéis novos (matriz de permissões D-18).

### Schema/código existente (expandir, não recriar)
- `src/actions/charges.ts`, `src/actions/receivables.ts`, `src/lib/validators/charge.ts` — `createCharge`/parcelamento (até 21x), `billingType` PIX/BOLETO/CREDIT_CARD (alvo de OS-03 / D-21).
- `src/lib/validators/appointment.ts` — enum de status com `concluido` (gatilho da OS / D-08).
- `src/lib/validators/medical-record.ts` — prontuário (treatment_plan TEXT livre; **não** estruturado → justifica `services` + `appointment_procedures`).
- `src/lib/integrations/types.ts`, `src/lib/integrations/worker.ts`, `src/lib/validators/connector.ts` — modelo de conector do Hub (Phase 9) para registrar NFS-e/TISS.
- `supabase/migrations/20260614000150_clinics_regime.sql` — regime tributário (base da config fiscal / D-16).
- `supabase/migrations/20260619001100_financial_cadastros_tables.sql` + `..._rls.sql` + `..._seed.sql` — plano de contas/centros de custo (classificação dos lançamentos da OS).
- `supabase/migrations/20260606000100_financial_tables.sql` — `financial_transactions`/`financial_categories` (padrão de colunas, `NUMERIC(12,2)`, índice em tenant_id).

### Protótipos navegáveis (referência de UI/dados)
- `src/app/(dashboard)/clinica/prototipos/nfse/page.tsx` — layout NFS-e, KPIs, status (`emitida/processando/cancelada/erro`).
- `src/app/(dashboard)/clinica/prototipos/convenios/page.tsx` — layout convênios/TISS, status (`paga/autorizada/em_analise/glosada`), glosa.
- `src/lib/prototipos/mock-data.ts` — shapes mock (INSURERS, TISS_GUIDES, NFSE_ROWS, ISS_RATE) que orientam os enums travados (D-27).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`createCharge` / receivables (Phase 3)** — gera parcelas particular via Asaas; reusado em D-21. Webhook Asaas idempotente reusado em D-30 e na emissão por caixa (D-20).
- **Hub de Integrações (Phase 9)** — `integration_connectors`/`integration_events`/`logToHub` hospedam os conectores NFS-e e TISS (D-03) e o retorno assíncrono (D-23).
- **Aprovação por alçada / estorno (Phase 10)** — reusado em cancelamento/estorno fiscal (D-19).
- **Bucket de documentos (Phase 8)** + `@react-pdf/renderer` (Phase 3) — arquivamento e recibo (D-17).
- **`appointment.status='concluido'`** — gatilho da OS (D-08).
- **Plano de contas / cost_centers (Phase 14)** — classificação dos lançamentos gerados pela OS.

### Established Patterns
- FK `tenant_id UUID NOT NULL REFERENCES public.clinics(id)`; índice em `tenant_id`; `unit_id` nas linhas operacionais.
- Valores monetários `NUMERIC(12,2)`; validação `isMoney2dp`.
- RLS financeiro hoje = SELECT todos / escrita só admin → **evolui** para escrita por papel (D-18).
- Seed por tenant na criação da clínica (categorias/plano de contas) → repete em `services` e motivos de glosa.
- Provider-agnostic + adapter (PaymentGateway) → replicado em `FiscalProvider`/`TissProvider` (D-01).

### Integration Points
- `appointments` → `appointment_procedures` → `service_orders` (OS) → (a) `createCharge`/receivables + NFS-e; (b) guia/lote TISS + recebível operadora.
- OS gera `financial_transactions` classificados (conta contábil + centro de custo da Phase 14).
- Conectores NFS-e/TISS no Hub (Phase 9); retorno via webhook + worker.
- Linha da OS carrega `professional_id` → base de repasse Phase 16; procedimentos concluídos → base de baixa de estoque Phase 17.

</code_context>

<specifics>
## Specific Ideas

- Reaproveitar o visual dos protótipos `nfse` e `convenios` para as telas reais (KPIs, tabelas, status badges) — paridade visual com o mock aprovado.
- Enums de status **alinhados ao protótipo** (D-27) para consistência entre mock e produto.
- Agregador fiscal sugerido pelo protótipo: **Tecnospeed** (ou PlugNotas/Focus NFe) como alvo da abstração.

</specifics>

<deferred>
## Deferred Ideas

- **Orçamento/estimativa pré-OS** (quote antes de executar) → fase Relatórios/Orçamento.
- **Tributos além de ISS** — PIS/COFINS/IRRF, RPA de autônomo, EFD-Reinf → **Phase 16** (TRIB-01..03).
- **Conciliação do recebimento do lote / extrato bancário (OFX/Open Finance)** e baixa do recebível de convênio → **Phase 16** (FOP-02/03).
- **Cálculo de repasse do profissional** → **Phase 16** (TRIB-01); esta fase só deixa `professional_id` na linha da OS (D-29).
- **Baixa de estoque por procedimento concluído** → **Phase 17** (`appointment_procedures` é a base).
- **Co-participação na mesma guia** (split por linha entre paciente e operadora) — por ora modelado como **2 OS** (D-12).
- **Rateio percentual multi-centro de custo** — herdado como deferido da Phase 14.
- **XML TISS real homologado por operadora** e **emissão NFS-e em prefeitura real** — gated no provider real (D-01/D-13).

</deferred>

---

*Phase: 15-faturamento-nfs-e-conv-nios-tiss*
*Context gathered: 2026-06-20*
