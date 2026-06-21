# Phase 16: Contas a Pagar, Conciliação & Tributos — Research

**Researched:** 2026-06-21
**Domain:** Financial operations — payables, bank reconciliation, professional payouts, RPA tax withholding, EFD-Reinf
**Confidence:** HIGH (schema/patterns from repo verified; tax tables from official/near-official sources; OFX library verified on npm; EFD-Reinf adapter shape inferred from FiscalProvider/TissProvider pattern already in repo)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Contas a Pagar & Fornecedores**
- D-01: Tabela `suppliers` nova (`clinic_id`): CNPJ/CPF, dados bancários/PIX, tipo (lab, material, serviço, autônomo). Laboratório e profissional autônomo linkam/viram um supplier.
- D-02: Origens de CP: (a) Manual, (b) Recorrente via Cron template, (c) Auto de OS de laboratório (Fase 13 LAB-02), (d) Auto de repasse.
- D-03: Baixa do CP escolhe `bank_account`, cria `financial_transaction` de saída e debita saldo imediatamente; conciliação confirma depois.
- D-04: CP suporta parcelas (vencimentos distintos) e baixas parciais.

**Conciliação Bancária & Fluxo de Caixa**
- D-05: OFX upload real funcional agora; Open Finance STUB-gated como conector no Hub (Fase 9).
- D-06: Matching auto exato (valor + data com janela de tolerância) + sugestões fuzzy ranqueadas que o usuário confirma.
- D-07: Linha sem par → sugestão de criar `financial_transaction` conciliado em 1 clique.
- D-08: Lançamento ganha status (pendente / baixado / conciliado); fluxo de caixa separa previsto de realizado.
- D-09: Match N:1 — 1 depósito casa com N recebíveis; diferença de taxa vira despesa.
- D-10: Baixa/conciliação de lote de convênio; glosa baixa só o autorizado.
- D-11: Idempotência OFX: chave `conta+FITID`; fallback `data+valor+documento`.
- D-12: Conta corrente com saldo/data de abertura; CP e demonstrativos filtram por unidade via centro de custo.

**Repasse do Profissional**
- D-13: Base de cálculo = valor recebido com deduções configuráveis (lab, materiais, taxa de cartão, impostos).
- D-14: Repasse reconhecido no recebimento conciliado (regime caixa).
- D-15: Saída = demonstrativo por profissional/período + CP a pagar ao profissional (origem "auto de repasse").
- D-16: Vínculo define tratamento: autônomo → RPA com retenções; PJ → sem retenção; CLT → fora de escopo.

**RPA, Retenções & Tributos**
- D-17: Cálculo INSS/IRRF/ISS via tabelas de faixa seed, versionadas por vigência.
- D-18: EFD-Reinf STUB-gated (como NFS-e/TISS).
- D-19: Regime tributário (`clinics.regime_tributario`, Fase 7/15) dirige a apuração.
- D-20: RPA produz PDF (`@react-pdf/renderer`, bucket Fase 8) + retenções como CP/obrigação (DARF/GPS/ISS).
- D-21: EFD-Reinf cobre RPA de autônomo E outros serviços tomados (PJ/laboratório).
- D-22: `ReinfProvider` provider-agnostic STUB-gated, registrado no Hub (Fase 9), preferindo mesmo agregador da NFS-e (Tecnospeed).

**Permissões, Estorno, Telas & Fechamento**
- D-23: Escrita admin/financeiro; auditor/DPO/sócio read-only; recepção/dentista sem acesso.
- D-24: Estorno de baixa/CP/RPA passa por `approval_requests` (Fase 10) + trilha de auditoria.
- D-25: Subrotas sob `/clinica/financeiro`; módulos no proxy.
- D-26: Competência mensal por unidade com fechamento; recebimento conciliado após fechamento → próxima competência; numeração sequencial do RPA por unidade.
- D-27: CP aceita anexo (nota, comprovante) + RPA arquiva PDF — bucket Fase 8.

### Claude's Discretion
- Nomes/colunas/índices/FKs exatos das novas tabelas, seguindo padrões financeiros.
- **Precedência da regra de comissão**: regra por serviço sobrepõe regra geral do profissional; sem regra → 0% + alerta.
- Estrutura dos seeds (INSS/IRRF/ISS, tipos de fornecedor).
- Janela de tolerância do matching exato e ranking do fuzzy.
- Formato dos PDFs e representação stub de OFX/EFD-Reinf.
- Layout/componentização das telas → definido em `/gsd-ui-phase`.

### Deferred Ideas (OUT OF SCOPE)
- DRE gerencial, orçado×realizado, distribuição de lucro → Fase 19.
- Profissional ver próprio demonstrativo → Fase 18.
- Folha de pagamento CLT → v2 (RH).
- XML/transmissão fiscal real homologada → gated em provider real.
- Rateio percentual multi-centro de custo → herdado de Fase 14.
- Baixa de estoque por procedimento → Fase 17.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOP-01 | Financeiro opera contas a pagar (vencimentos, baixa) integradas a fornecedores/laboratório | Novas tabelas `suppliers`, `payables`, `payable_installments`; padrão de baixa espelhando `receivables`; FK para `lab_orders` (origem c); FK para profissional via suppliers (origem d) |
| FOP-02 | Conciliação bancária por OFX/Open Finance bate extrato × lançamentos | Tabelas `bank_statements`, `statement_lines`; lib `ofx-data-extractor` v1.5.0; algoritmo exact+fuzzy+N:1; conector Open Finance STUB via Hub |
| FOP-03 | Fluxo de caixa é atualizado automaticamente a partir das baixas conciliadas | Status `conciliado` em `financial_transactions`; coluna `reconciliation_status` adicionada; fluxo de caixa previsto (pendente) vs realizado (conciliado) |
| TRIB-01 | Calcula repasse do profissional sobre valor recebido (regra por profissional/serviço) | Tabelas `professional_payouts`, `payout_items`; lógica de `commission_rules` JSONB (Fase 11); reconhecimento no recebimento conciliado (D-14) |
| TRIB-02 | Gera RPA de autônomos com retenções INSS/IRRF/ISS calculadas | Tabelas `rpa_records`, `tax_withholding_tables` seed versionada; funções puras `computeInss`, `computeIrrf`, `computeIss` |
| TRIB-03 | Apuração de tributos por regime e envio de retenções (EFD-Reinf) | `ReinfProvider` STUB-gated espelhando `FiscalProvider`; tabela `reinf_events`; CP de tributos a recolher (DARF/GPS/ISS) |
</phase_requirements>

---

## Summary

Esta fase é a **expansão do lado "pagar + conciliar + tributar"** do módulo financeiro. O projeto já tem a fundação correta: `financial_transactions`, `bank_accounts`, `chart_of_accounts`, `cost_centers`, `receivables`, o Hub de Integrações (Fase 9), e o padrão `FiscalProvider`/`TissProvider` STUB-gated (Fase 15). A Fase 16 replica esses padrões em três eixos:

1. **Contas a Pagar (FOP-01):** Espelho dos `receivables` existentes, com os mesmos conceitos de parcelas e baixas parciais, mas no sentido "pagar ao fornecedor". A tabela `suppliers` centraliza quem recebe (laboratório, PJ, autônomo). A baixa cria um `financial_transaction` do tipo `despesa` e debita o saldo da `bank_account`.

2. **Conciliação (FOP-02/FOP-03):** A importação OFX gera `bank_statements` + `statement_lines` com idempotência por `FITID`. Um algoritmo de matching em três estágios (exato → fuzzy ranqueado → N:1) casa as linhas com os `financial_transactions` existentes, atribuindo status `conciliado` e separando o fluxo de caixa em previsto vs realizado.

3. **Repasse & Tributos (TRIB-01/02/03):** O recebimento conciliado dispara o cálculo do repasse (`professional_payouts`). Para autônomos, o repasse gera um RPA com retenções calculadas a partir de tabelas versionadas por vigência. O EFD-Reinf segue o mesmo padrão STUB-gated do `FiscalProvider` — um `ReinfProvider` registrado no Hub, com implementação stub que simula a transmissão.

**Recomendação primária:** Expandir os padrões existentes sem introduzir dependências novas além de `ofx-data-extractor` (leve, TypeScript nativo, ~30KB). Todo o código de cálculo tributário deve ser **funções puras** em `src/lib/financeiro/` para testabilidade máxima.

---

## Standard Stack

### Core (reuso — nenhuma nova dependência crítica)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@supabase/supabase-js` | v2 | Cliente principal | Já instalado |
| `@supabase/ssr` | latest | Auth SSR | Já instalado |
| `@react-pdf/renderer` | v4.x | PDF de RPA e demonstrativo | Já instalado |
| `react-hook-form` | v7 | Formulários CP/fornecedor | Já instalado |
| `zod` | v3.x | Validação (não migrar para v4 — pinado) | Já instalado |

### Nova Dependência Recomendada

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `ofx-data-extractor` | 1.5.0 | Parse OFX SGML/XML, extrai FITID/date/amount/memo | TypeScript nativo, Node.js + browser, strict/lenient modes, publicado 2026-03-25 |

[VERIFIED: npm registry / GitHub Fabiopf02/ofx-data-extractor — versão 1.5.0 publicada 2026-03-25]

**Instalação:**
```bash
npm install ofx-data-extractor
```

### Não instalar

| Tentação | Por quê não | Alternativa |
|----------|-------------|-------------|
| SDK Tecnospeed EFD-Reinf | Gated em provider real; fase usa stub | `ReinfProvider` STUB interno |
| Pluggy/Open Finance SDK | Conexão real requer certificado mTLS + consentimento; fase usa stub | Conector Hub STUB |
| pgvector para matching | Overkill para volumes típicos de clínica dental; sem indexação especial necessária | SQL puro: exact match + scoring com CTE |
| pg_trgm extension | Não disponível garantido no Supabase FREE | Similarity scoring no app layer |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── financeiro/
│   │   ├── ofx-parser.ts          # wrapper ofx-data-extractor → StatementLine[]
│   │   ├── reconciliation.ts      # matchExact, matchFuzzy, matchNToOne (funções puras)
│   │   ├── payout-math.ts         # computePayout, applyDeductions (funções puras)
│   │   ├── tax-tables.ts          # loadTaxTables, computeInss, computeIrrf, computeIss (puras)
│   │   └── rpa-pdf.tsx            # PDF template RPA (@react-pdf/renderer)
│   ├── reinf/
│   │   ├── types.ts               # ReinfProvider interface, ReinfEventInput, ReinfEventResult
│   │   ├── stub.ts                # StubReinfProvider — espelha StubFiscalProvider
│   │   └── index.ts               # getReinfProvider factory (credential-gated)
│   └── integrations/
│       └── types.ts               # adicionar 'reinf' | 'open_finance' ao ConnectorType
├── actions/
│   ├── suppliers.ts               # CRUD suppliers
│   ├── payables.ts                # createPayable, baixarPayable, listPayables
│   ├── bank-statements.ts         # importOFX, listStatementLines, reconcileLine
│   ├── reconciliation.ts          # runAutoReconciliation, suggestMatches
│   ├── professional-payouts.ts    # computePayouts, generateDemonstrativo
│   ├── rpa.ts                     # gerarRpa, listRpas
│   └── reinf.ts                   # gerarReinfEvent, listReinfEvents
└── app/
    └── clinica/
        └── financeiro/
            ├── contas-a-pagar/page.tsx
            ├── conciliacao/page.tsx
            ├── repasse/page.tsx
            └── rpa/page.tsx
```

### Padrão 1: Tabelas de Tributo Versionadas por Vigência (D-17)

**O quê:** Tabelas INSS/IRRF seed no banco, com coluna `vigencia_inicio DATE` e `vigencia_fim DATE NULLABLE`. O cálculo usa `SELECT ... WHERE vigencia_inicio <= data_pagamento AND (vigencia_fim IS NULL OR vigencia_fim >= data_pagamento)`.

**Por quê:** Permite auditoria retroativa (cálculo de 2025 usa tabela 2025, não a de 2026) e é atualizável via nova migration seed sem alterar código.

```sql
-- tabela de faixas INSS (contribuinte individual — prestador a empresa, 11%)
CREATE TABLE public.inss_tax_tables (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vigencia_inicio DATE        NOT NULL,
  vigencia_fim    DATE,                       -- NULL = vigente
  faixa_min       NUMERIC(12,2) NOT NULL,
  faixa_max       NUMERIC(12,2),              -- NULL = teto (sem limite superior)
  aliquota        NUMERIC(5,4) NOT NULL,      -- ex: 0.1400 para 14%
  parcela_deduzir NUMERIC(12,2) NOT NULL DEFAULT 0,
  teto            NUMERIC(12,2),              -- max contrib = teto * aliquota - parcela_deduzir
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_inss_tax_vigencia ON public.inss_tax_tables(vigencia_inicio, vigencia_fim);

-- mesma estrutura para irrf_tax_tables e iss_tax_tables
-- iss_tax_tables inclui município (codigo_ibge TEXT)
```

**Seed 2026 (INSS progressivo — contribuinte individual prestador a empresa):**

| vigencia_inicio | faixa_min | faixa_max | aliquota | parcela_deduzir | teto |
|-----------------|-----------|-----------|----------|-----------------|------|
| 2026-01-01 | 0.00 | 1621.00 | 0.0750 | 0.00 | — |
| 2026-01-01 | 1621.01 | 2902.84 | 0.0900 | 24.32 | — |
| 2026-01-01 | 2902.85 | 4354.27 | 0.1200 | 111.40 | — |
| 2026-01-01 | 4354.28 | 8475.55 | 0.1400 | 198.49 | 8475.55 |

[CITED: contabilizei.com.br/contabilidade-online/tabela-inss/ — valores 2026]

**Observação:** Para RPA de autônomo prestador a empresa, a alíquota predominante na prática é **11% flat com teto** (Lei 8.212/91, art. 21, §2º), não a tabela progressiva de 7,5%–14% (que é para segurado empregado). A tabela progressiva acima aplica-se a contribuintes que trabalham para pessoas físicas. O sistema deve suportar **ambas** as modalidades configuráveis por supplier. [ASSUMED — requer confirmação do contador do projeto; múltiplas fontes consultadas mostram divergência entre contextos]

**Seed 2026 (IRRF — tabela progressiva mensal):**

| vigencia_inicio | faixa_min | faixa_max | aliquota | parcela_deduzir |
|-----------------|-----------|-----------|----------|-----------------|
| 2026-01-01 | 0.00 | 5000.00 | 0.0000 | 0.00 |
| 2026-01-01 | 5000.01 | 7350.00 | gradual | fórmula |
| 2026-01-01 | 7350.01 | null (acima) | 0.2750 | 908.73 |

[CITED: Lei 15.270/2025 (sancionada 2025-11-26) + contabilizei.com.br — vigência 2026-01-01]

A faixa gradual (R$ 5.000,01 – R$ 7.350,00) usa a fórmula: `desconto = 978.62 - (0.133145 × base_calculo)`. O implementador deve armazenar esta fórmula separadamente (ex: coluna `formula_desconto TEXT NULLABLE` na tabela).

### Padrão 2: Provider-Agnostic ReinfProvider (D-18/D-22)

**Espelha exatamente** `FiscalProvider`/`TissProvider` da Fase 15. Estrutura:

```typescript
// src/lib/reinf/types.ts
export interface ReinfEventInput {
  tipo: 'R2010' | 'R4020'           // eventos relevantes para esta fase
  competencia: string                // 'YYYY-MM'
  clinic_id: string
  // R-2010: retenção INSS sobre serviços tomados
  prestador_cnpj?: string
  prestador_nome?: string
  valor_bruto?: number
  valor_retencao_inss?: number
  // R-4020: IRRF/CSLL/PIS/COFINS retidos sobre PJ
  beneficiario_cnpj?: string
  valor_retencao_irrf?: number
  idempotency_key: string
}

export interface ReinfEventResult {
  provider_ref: string
  status: 'pendente' | 'transmitido' | 'erro'
  protocolo?: string
  error_message?: string
}

export interface ReinfProvider {
  transmitir(input: ReinfEventInput): Promise<ReinfEventResult>
  consultar(provider_ref: string): Promise<ReinfEventResult>
  retificar(provider_ref: string, input: ReinfEventInput): Promise<ReinfEventResult>
}
```

```typescript
// src/lib/reinf/stub.ts — StubReinfProvider
export class StubReinfProvider implements ReinfProvider {
  async transmitir(input: ReinfEventInput): Promise<ReinfEventResult> {
    return {
      provider_ref: `stub-reinf:${input.idempotency_key}`,
      status: 'transmitido',
      protocolo: `STUB-${Date.now()}`,
    }
  }
  async consultar(provider_ref: string): Promise<ReinfEventResult> {
    return { provider_ref, status: 'transmitido' }
  }
  async retificar(provider_ref: string, input: ReinfEventInput): Promise<ReinfEventResult> {
    return { provider_ref: `stub-reinf:retif:${input.idempotency_key}`, status: 'transmitido' }
  }
}
```

```typescript
// src/lib/reinf/index.ts — factory pattern idêntico ao getFiscalProvider
import 'server-only'
export async function getReinfProvider(clinicId: string): Promise<ReinfProvider> {
  // query integration_connectors WHERE type='reinf' AND clinic_id=clinicId AND status='enabled'
  // sem credential_enc → StubReinfProvider()
  // com credential_enc → TecnospeedReinfProvider(apiKey) [gated — a implementar no provider real]
}
```

O conector `reinf` deve ser adicionado ao `ConnectorType` em `src/lib/integrations/types.ts` e à migration de `integration_connectors` (ADD CHECK constraint).

### Padrão 3: OFX Import com Idempotência (D-05/D-11)

```typescript
// src/lib/financeiro/ofx-parser.ts
import { Ofx } from 'ofx-data-extractor'

export interface StatementLine {
  fitid: string
  date: Date
  amount: number          // positivo = crédito, negativo = débito
  memo: string
  check_number?: string
}

export async function parseOfxBuffer(buffer: Buffer): Promise<{
  account_id?: string
  lines: StatementLine[]
  warnings: string[]
}> {
  const ofx = await Ofx.fromBuffer(buffer)
  const transactions = ofx.getTransactionsSummary()  // API da lib
  return {
    lines: transactions.map(t => ({
      fitid: t.FITID,
      date: new Date(t.DTPOSTED),
      amount: Number(t.TRNAMT),
      memo: t.MEMO ?? t.NAME ?? '',
      check_number: t.CHECKNUM,
    })),
    warnings: ofx.getWarnings(),
  }
}
```

**Chave de idempotência (D-11):**
- Primária: `(bank_account_id, fitid)` — unique constraint em `statement_lines`
- Fallback (quando FITID ausente): SHA-256 de `(bank_account_id || date || amount || memo)` — armazenar como `fitid_fallback`

**Migration `statement_lines`:**
```sql
UNIQUE(bank_account_id, fitid)                 -- primário
UNIQUE(bank_account_id, fitid_fallback)         -- fallback (partial WHERE fitid IS NULL)
```

### Padrão 4: Algoritmo de Conciliação em 3 Estágios

**Stage 1 — Exact Match (auto-concilia, sem intervenção humana)**

Critérios:
- `ABS(statement_line.amount - financial_transaction.amount) < 0.01` (tolerância de centavos)
- `ABS(statement_line.date - financial_transaction.transaction_date) <= 3` (janela de 3 dias)
- `financial_transaction.reconciliation_status = 'pendente'`
- Mesmo `bank_account_id`

Resultado: `auto-matched`, grava `reconciliation_status = 'conciliado'` sem confirmação humana.

**Stage 2 — Fuzzy Suggestions (usuário confirma)**

Para linhas não casadas pelo Stage 1:
```sql
-- ranking por score composto (app layer calcula, não SQL):
-- score = (1 - ABS(amount_diff) / statement_amount) * 0.6
--       + (1 - date_diff_days / 30.0)               * 0.3
--       + similarity(memo, description)              * 0.1   -- Levenshtein no app layer
-- score >= 0.5 → sugestão; score >= 0.85 → alta confiança (highlight verde)
```

Implementação: função pura `matchFuzzy(line: StatementLine, candidates: TransactionRow[]): ScoredMatch[]` em `src/lib/financeiro/reconciliation.ts`.

**Stage 3 — N:1 Match (1 depósito Asaas ↔ N receivables — D-09)**

```typescript
// Caso Asaas batch payout: 1 crédito no extrato cobre N recebíveis pagos (líquido − taxas)
function matchNToOne(
  depositLine: StatementLine,
  candidates: TransactionRow[],
  tolerance: number = 5.00  // até R$ 5 de diferença para taxas
): NToOneMatch | null {
  // 1. Ordena candidates por data mais próxima da linha
  // 2. Tenta combinações de N=2,3,4... até soma(amounts) ≈ depositLine.amount ± tolerance
  // 3. Se encontrar: retorna match com fee = depositLine.amount - soma(amounts)
  // 4. fee positivo → lançamento de taxa bancária (despesa)
  // N máximo razoável: 20 (limita combinatória)
}
```

### Padrão 5: Status no `financial_transactions` (D-08)

Adicionar coluna `reconciliation_status TEXT CHECK ('pendente', 'baixado', 'conciliado')` via ALTER:

```sql
ALTER TABLE public.financial_transactions
  ADD COLUMN reconciliation_status TEXT
    NOT NULL DEFAULT 'pendente'
    CHECK (reconciliation_status IN ('pendente', 'baixado', 'conciliado'));

CREATE INDEX idx_ft_reconciliation_status
  ON public.financial_transactions(tenant_id, reconciliation_status)
  WHERE reconciliation_status != 'conciliado';
```

O fluxo de caixa **previsto** = transactions WHERE status='pendente' (CP/CR em aberto); **realizado** = WHERE status='conciliado'.

### Padrão 6: Competência Mensal + Fechamento (D-26)

Espelha `unit_os_counters` / `unit_fiscal_config.proximo_numero_rps`:

```sql
CREATE TABLE public.unit_rpa_counters (
  unit_id         UUID  PRIMARY KEY REFERENCES public.units(id) ON DELETE CASCADE,
  clinic_id       UUID  NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  last_rpa_number INT   NOT NULL DEFAULT 0
);

CREATE TABLE public.competencia_fechamentos (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID  NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id     UUID  NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  competencia TEXT  NOT NULL,   -- 'YYYY-MM'
  fechado_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechado_por UUID  REFERENCES public.users(id),
  UNIQUE(clinic_id, unit_id, competencia)
);
```

Regra de fechamento: `INSERT INTO competencia_fechamentos` bloqueia novos repasses/RPAs na competência. Recebimentos conciliados após o fechamento: `competencia = next_competencia(fechado)`.

### Anti-Patterns a Evitar

- **Calcular INSS/IRRF/ISS inline nas Server Actions**: leva a lógica duplicada e impossibilidade de testar. Sempre chamar funções puras de `src/lib/financeiro/tax-tables.ts`.
- **Auto-conciliar sem stage exato primeiro**: aplicar fuzzy diretamente cria conciliações erradas. A pipeline é sempre: exato → fuzzy sugestão → N:1.
- **Guardar o `storage_path` do PDF de RPA na resposta da action**: mesma regra do NFS-e (T-15-23) — retornar sempre signed URL com TTL=60s.
- **`useEffect` para buscar linhas de extrato**: usar TanStack Query com `invalidateQueries` após upload OFX.
- **Processar arquivo OFX no route handler com Edge Runtime**: arquivo OFX pode exceder 1MB; usar `nodejs` runtime explicitamente no route.

---

## Don't Hand-Roll

| Problema | Não construir | Usar | Por quê |
|----------|---------------|------|---------|
| Parse de OFX (SGML + XML) | Parser caseiro de regex | `ofx-data-extractor` v1.5.0 | OFX SGML não é HTML válido; parsers caseiros falham em encodings variados e aninham mal as tags STMTTRN |
| PDF de RPA | html2canvas / Puppeteer | `@react-pdf/renderer` (já instalado) | Puppeteer ultrapassa limite de 50MB da Vercel; `@react-pdf/renderer` roda em serverless |
| Cálculo de impostos sem tabela | Hardcode nas actions | `tax-tables.ts` com `SELECT` na `inss_tax_tables` | Tabelas mudam anualmente; hardcode força deploy para cada portaria |
| Numeração sequencial de RPA | `MAX(numero) + 1` | `next_rpa_number()` SECURITY DEFINER | `MAX + 1` tem race condition sob concorrência (mesmo pitfall que unit_os_counters — T-15-11 já documentado) |
| Credenciais Open Finance | Armazenar chave no `.env` | `integration_connectors` + `credential_enc` AES-256 (Fase 9) | Padrão já estabelecido; all credentials via Hub |
| Matching por vetor/embedding | pgvector | SQL puro (Stage 1) + scoring no app (Stage 2) | Volumes de clínica dental: raramente mais de 500 transações/mês; SQL funciona; pgvector adiciona complexidade sem ganho real |

---

## Schema Design (Claude's Discretion)

### Novas Tabelas

```sql
-- ── suppliers (D-01) ─────────────────────────────────────────────────────────
CREATE TABLE public.suppliers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  tipo            TEXT        NOT NULL CHECK (tipo IN ('laboratorio', 'material', 'servico', 'autonomo', 'pj', 'outro')),
  cnpj_cpf        TEXT,
  pix_key         TEXT,
  banco           TEXT,
  agencia         TEXT,
  conta           TEXT,
  vinculo         TEXT        CHECK (vinculo IN ('clt', 'pj', 'autonomo')),  -- para profissionais
  professional_id UUID        REFERENCES public.professionals(id) ON DELETE SET NULL,  -- link D-01
  lab_id          UUID        REFERENCES public.prosthetic_labs(id) ON DELETE SET NULL, -- link D-01
  ativo           BOOLEAN     NOT NULL DEFAULT true,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_clinic   ON public.suppliers(clinic_id);
CREATE INDEX idx_suppliers_cnpj_cpf ON public.suppliers(cnpj_cpf) WHERE cnpj_cpf IS NOT NULL;

-- ── payables (D-02, D-04) ────────────────────────────────────────────────────
CREATE TABLE public.payables (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id             UUID        REFERENCES public.units(id),
  supplier_id         UUID        REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  account_id          UUID        REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  cost_center_id      UUID        REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
  bank_account_id     UUID        REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  descricao           TEXT        NOT NULL,
  valor_total         NUMERIC(12,2) NOT NULL,
  origem              TEXT        NOT NULL DEFAULT 'manual'
                      CHECK (origem IN ('manual', 'recorrente', 'lab', 'repasse', 'tributo')),
  lab_order_id        UUID        REFERENCES public.lab_orders(id) ON DELETE SET NULL,   -- D-02c
  payout_id           UUID,                                                               -- D-02d (FK adicionada após payouts)
  status              TEXT        NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente', 'parcial', 'pago', 'cancelado')),
  recorrente_template_id UUID,                                                            -- D-02b
  competencia         TEXT,       -- 'YYYY-MM' para tributos/repasses
  notes               TEXT,
  document_id         UUID,       -- D-27 anexo (bucket Fase 8)
  created_by          UUID        REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payables_clinic      ON public.payables(clinic_id);
CREATE INDEX idx_payables_supplier    ON public.payables(supplier_id);
CREATE INDEX idx_payables_status      ON public.payables(clinic_id, status);
CREATE INDEX idx_payables_unit        ON public.payables(unit_id);

-- ── payable_installments (D-04) ──────────────────────────────────────────────
CREATE TABLE public.payable_installments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  payable_id      UUID        NOT NULL REFERENCES public.payables(id) ON DELETE CASCADE,
  numero          INT         NOT NULL DEFAULT 1,
  valor           NUMERIC(12,2) NOT NULL,
  due_date        DATE        NOT NULL,
  paid_at         TIMESTAMPTZ,
  valor_pago      NUMERIC(12,2),
  financial_transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  status          TEXT        NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'parcial', 'pago', 'cancelado')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payable_inst_clinic   ON public.payable_installments(clinic_id);
CREATE INDEX idx_payable_inst_payable  ON public.payable_installments(payable_id);
CREATE INDEX idx_payable_inst_due      ON public.payable_installments(clinic_id, due_date);

-- ── bank_statements + statement_lines (D-05/D-11) ───────────────────────────
CREATE TABLE public.bank_statements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  bank_account_id UUID        NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  fonte           TEXT        NOT NULL DEFAULT 'ofx' CHECK (fonte IN ('ofx', 'open_finance')),
  periodo_inicio  DATE        NOT NULL,
  periodo_fim     DATE        NOT NULL,
  filename        TEXT,
  imported_by     UUID        REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bank_statements_clinic  ON public.bank_statements(clinic_id);
CREATE INDEX idx_bank_statements_account ON public.bank_statements(bank_account_id);

CREATE TABLE public.statement_lines (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id               UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  bank_account_id         UUID        NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  bank_statement_id       UUID        NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  fitid                   TEXT,       -- NULL quando fallback
  fitid_fallback          TEXT,       -- SHA-256 de (bank_account_id||date||amount||memo) quando sem FITID
  transaction_date        DATE        NOT NULL,
  amount                  NUMERIC(12,2) NOT NULL,   -- positivo = crédito; negativo = débito
  memo                    TEXT,
  check_number            TEXT,
  reconciliation_status   TEXT        NOT NULL DEFAULT 'pendente'
                          CHECK (reconciliation_status IN ('pendente', 'conciliado', 'ignorado')),
  matched_transaction_ids UUID[],     -- array para N:1
  fee_transaction_id      UUID        REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_statement_line_fitid
    UNIQUE (bank_account_id, fitid),
  CONSTRAINT uq_statement_line_fitid_fallback
    UNIQUE (bank_account_id, fitid_fallback)
);
CREATE INDEX idx_statement_lines_clinic  ON public.statement_lines(clinic_id);
CREATE INDEX idx_statement_lines_account ON public.statement_lines(bank_account_id);
CREATE INDEX idx_statement_lines_date    ON public.statement_lines(bank_account_id, transaction_date);
CREATE INDEX idx_statement_lines_recon   ON public.statement_lines(clinic_id, reconciliation_status)
  WHERE reconciliation_status = 'pendente';

-- ── professional_payouts (TRIB-01, D-13/D-14/D-15) ──────────────────────────
CREATE TABLE public.professional_payouts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id         UUID        REFERENCES public.units(id),
  professional_id UUID        NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  competencia     TEXT        NOT NULL,   -- 'YYYY-MM'
  valor_bruto     NUMERIC(12,2) NOT NULL,
  deducoes        JSONB       NOT NULL DEFAULT '{}',  -- {lab: 0, materiais: 0, taxa_cartao: 0, ...}
  valor_base      NUMERIC(12,2) NOT NULL,   -- bruto - deduções
  percentual      NUMERIC(5,4) NOT NULL,    -- ex: 0.5000 para 50%
  valor_repasse   NUMERIC(12,2) NOT NULL,   -- base * percentual
  status          TEXT        NOT NULL DEFAULT 'rascunho'
                  CHECK (status IN ('rascunho', 'aprovado', 'pago')),
  payable_id      UUID        REFERENCES public.payables(id) ON DELETE SET NULL,  -- CP gerado D-15
  created_by      UUID        REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, professional_id, competencia)
);
CREATE INDEX idx_payouts_clinic      ON public.professional_payouts(clinic_id);
CREATE INDEX idx_payouts_professional ON public.professional_payouts(professional_id);

CREATE TABLE public.payout_items (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  payout_id           UUID        NOT NULL REFERENCES public.professional_payouts(id) ON DELETE CASCADE,
  service_order_id    UUID        REFERENCES public.service_orders(id) ON DELETE SET NULL,
  statement_line_id   UUID        REFERENCES public.statement_lines(id) ON DELETE SET NULL,
  descricao           TEXT        NOT NULL,
  valor_recebido      NUMERIC(12,2) NOT NULL,
  valor_base_item     NUMERIC(12,2) NOT NULL,   -- após deduções item-level
  percentual_item     NUMERIC(5,4) NOT NULL,
  valor_repasse_item  NUMERIC(12,2) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payout_items_payout ON public.payout_items(payout_id);
CREATE INDEX idx_payout_items_clinic ON public.payout_items(clinic_id);

-- ── rpa_records (TRIB-02, D-20) ─────────────────────────────────────────────
CREATE TABLE public.rpa_records (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id             UUID        REFERENCES public.units(id),
  supplier_id         UUID        NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  professional_id     UUID        REFERENCES public.professionals(id) ON DELETE SET NULL,
  payout_id           UUID        REFERENCES public.professional_payouts(id) ON DELETE SET NULL,
  numero              TEXT        NOT NULL,     -- 'RPA-UNIT-000001' via next_rpa_number()
  competencia         TEXT        NOT NULL,     -- 'YYYY-MM'
  data_pagamento      DATE        NOT NULL,
  valor_bruto         NUMERIC(12,2) NOT NULL,
  valor_inss          NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_irrf          NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_iss           NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_liquido       NUMERIC(12,2) NOT NULL,
  aliquota_inss       NUMERIC(5,4),
  aliquota_irrf       NUMERIC(5,4),
  aliquota_iss        NUMERIC(5,4),
  municipio_ibge      TEXT,        -- para ISS
  regime_tributario   TEXT,        -- snapshot do regime na data de emissão
  pdf_storage_path    TEXT,        -- D-27 — NUNCA retornar ao cliente; signed URL TTL=60s
  status              TEXT        NOT NULL DEFAULT 'rascunho'
                      CHECK (status IN ('rascunho', 'emitido', 'cancelado')),
  payable_id          UUID        REFERENCES public.payables(id) ON DELETE SET NULL,
  reinf_event_id      UUID,        -- FK adicionada após reinf_events
  created_by          UUID        REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rpa_clinic        ON public.rpa_records(clinic_id);
CREATE INDEX idx_rpa_supplier      ON public.rpa_records(supplier_id);
CREATE INDEX idx_rpa_competencia   ON public.rpa_records(clinic_id, competencia);
UNIQUE INDEX idx_rpa_numero        ON public.rpa_records(clinic_id, numero);

-- ── reinf_events (TRIB-03, D-18/D-22) ───────────────────────────────────────
CREATE TABLE public.reinf_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id         UUID        REFERENCES public.units(id),
  tipo            TEXT        NOT NULL CHECK (tipo IN ('R2010', 'R4020')),
  competencia     TEXT        NOT NULL,
  provider_ref    TEXT,        -- stub: 'stub-reinf:...'
  status          TEXT        NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'transmitido', 'erro', 'retificado')),
  protocolo       TEXT,
  payload         JSONB       NOT NULL,   -- campos do evento para geração eventual do XML
  error_message   TEXT,
  idempotency_key TEXT        NOT NULL,
  created_by      UUID        REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, idempotency_key)
);
CREATE INDEX idx_reinf_clinic      ON public.reinf_events(clinic_id);
CREATE INDEX idx_reinf_competencia ON public.reinf_events(clinic_id, competencia);

-- ── tax_withholding_tables: faixas INSS/IRRF (D-17) ─────────────────────────
-- (ver Padrão 1 acima — DDL completo)

-- ── iss_tax_tables: alíquotas ISS por município (D-17) ───────────────────────
CREATE TABLE public.iss_tax_tables (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vigencia_inicio DATE        NOT NULL,
  vigencia_fim    DATE,
  codigo_ibge     TEXT        NOT NULL,   -- '3550308' = São Paulo
  municipio       TEXT        NOT NULL,
  aliquota        NUMERIC(5,4) NOT NULL,  -- ex: 0.0500 para 5%
  servico_lc116   TEXT,                  -- item LC 116 (ex: '14.01' serv. de saúde)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_iss_tax_municipio  ON public.iss_tax_tables(codigo_ibge, vigencia_inicio);

-- ── recorrente_templates (D-02b) ─────────────────────────────────────────────
CREATE TABLE public.recorrente_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id         UUID        REFERENCES public.units(id),
  supplier_id     UUID        REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  account_id      UUID        REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  cost_center_id  UUID        REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
  descricao       TEXT        NOT NULL,
  valor           NUMERIC(12,2) NOT NULL,
  dia_vencimento  SMALLINT    NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 28),  -- 28 = max safe
  ativo           BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recorrente_clinic ON public.recorrente_templates(clinic_id);
```

### ALTER TABLE existentes (BLOCKING — requerem db push)

```sql
-- 1. financial_transactions: adicionar reconciliation_status (D-08)
ALTER TABLE public.financial_transactions
  ADD COLUMN reconciliation_status TEXT
    NOT NULL DEFAULT 'pendente'
    CHECK (reconciliation_status IN ('pendente', 'baixado', 'conciliado')),
  ADD COLUMN statement_line_id UUID
    REFERENCES public.statement_lines(id) ON DELETE SET NULL;

-- 2. bank_accounts: adicionar saldo_atual (derivado em escrita) e data_abertura (D-12)
ALTER TABLE public.bank_accounts
  ADD COLUMN data_abertura DATE,
  ADD COLUMN saldo_atual NUMERIC(12,2) NOT NULL DEFAULT 0;

-- 3. ConnectorType: adicionar 'reinf' e 'open_finance' (migration de CHECK em integration_connectors)
-- (adicionar ao CHECK constraint existente em integration_connectors.type)

-- 4. professionals: adicionar supplier_id FK (link D-01)
ALTER TABLE public.professionals
  ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
```

---

## OFX Parsing — Detalhes Técnicos

### Por que `ofx-data-extractor` (não hand-rolled)

[VERIFIED: GitHub Fabiopf02/ofx-data-extractor, versão 1.5.0 publicada 2026-03-25]

1. Suporta tanto **SGML** (`DATA:OFXSGML`) quanto **XML** — bancos brasileiros usam principalmente SGML, mas alguns já emitem XML.
2. **TypeScript nativo** com tipos completos — zero `any` necessários.
3. `Ofx.fromBuffer(buffer)` para Node.js serverless, `Ofx.fromBlob(blob)` para browser.
4. Modos `strict` e `lenient` — o modo lenient ignora campos mal formatados (importante para OFX de bancos brasileiros com encodings variados).
5. `getWarnings()` permite reportar problemas sem falhar a importação.
6. Tamanho: leve (~30KB), sem dependências pesadas.

### Route Handler para Upload OFX

```typescript
// app/api/financeiro/ofx/route.ts
export const runtime = 'nodejs'  // OBRIGATÓRIO — OFX pode exceder 1MB (Edge limit)
export const maxDuration = 30    // Vercel Pro

export async function POST(request: Request) {
  // 1. auth + role gate (admin/financeiro)
  // 2. parse multipart/form-data → Buffer
  // 3. parseOfxBuffer(buffer) → lines
  // 4. upsert bank_statements + statement_lines (ON CONFLICT(fitid) DO NOTHING para idempotência)
  // 5. runAutoReconciliation(bankAccountId, importedLineIds) → Stage 1
  // 6. return { imported: N, auto_matched: M, pending: P }
}
```

---

## Brazilian Tax Withholding — Detalhes

### INSS para RPA (contribuinte individual)

Existem **duas modalidades** que o sistema deve suportar via campo no supplier:

| Modalidade | Alíquota | Teto 2026 | Max retenção | Quando |
|------------|----------|-----------|--------------|--------|
| Prestador a empresa (art. 21 §2º) | 11% flat | R$ 8.475,55 | R$ 932,31 | Autônomo presta serviço a PJ (caso mais comum) |
| Progressiva (segurado individual) | 7,5%–14% | R$ 8.475,55 | calculado | Prestador a PF ou CEBAS |

[CITED: contabilizei.com.br/calculo-rpa + bsoft.com.br/blog/rpa — valores verificados 2026]

O campo no `suppliers` ou `rpa_records`: `modalidade_inss TEXT CHECK ('11pct', 'progressivo')`.

**Função pura `computeInss`:**
```typescript
export function computeInss(
  valorBruto: number,
  modalidade: '11pct' | 'progressivo',
  brackets: InssBracket[]  // carregado da inss_tax_tables pela vigência
): { valor: number; aliquota: number } {
  if (modalidade === '11pct') {
    const teto = brackets.at(-1)?.faixa_max ?? 8475.55
    const base = Math.min(valorBruto, teto)
    return { valor: Math.round(base * 0.11 * 100) / 100, aliquota: 0.11 }
  }
  // progressivo: calcula faixa a faixa com parcela_deduzir
  const bracket = brackets.find(b => valorBruto >= b.faixa_min && (b.faixa_max == null || valorBruto <= b.faixa_max))
  if (!bracket) return { valor: 0, aliquota: 0 }
  const valor = Math.round((valorBruto * bracket.aliquota - bracket.parcela_deduzir) * 100) / 100
  return { valor: Math.max(0, valor), aliquota: bracket.aliquota }
}
```

### IRRF 2026

**Lei 15.270/2025 (vigência 2026-01-01):**

| Faixa (base de cálculo após deducoes) | Alíquota | Parcela a deduzir |
|----------------------------------------|----------|------------------|
| Até R$ 5.000,00 | 0% | — |
| R$ 5.000,01 a R$ 7.350,00 | gradual | desconto = 978,62 − (0,133145 × base) |
| Acima de R$ 7.350,00 | 27,5% | R$ 908,73 |

[CITED: agenciabrasil.ebc.com.br/tabela-ir-2026 + Lei 15.270/2025]

Base de cálculo IRRF = valor bruto − INSS retido − outras deduções legais.

```typescript
export function computeIrrf(
  baseCalculo: number,
  brackets: IrrfBracket[]  // carregado da irrf_tax_tables pela vigência
): { valor: number; aliquota: number } {
  if (baseCalculo <= 5000) return { valor: 0, aliquota: 0 }
  if (baseCalculo <= 7350) {
    const desconto = 978.62 - (0.133145 * baseCalculo)
    const bruto = baseCalculo * 0.275  // alíquota máxima aplicada
    const valor = Math.max(0, Math.round((bruto - desconto) * 100) / 100)
    return { valor, aliquota: valor / baseCalculo }
  }
  // tabela progressiva acima de 7350 (usa bracket com aliquota=0.275, parcela=908.73)
  return { valor: Math.round((baseCalculo * 0.275 - 908.73) * 100) / 100, aliquota: 0.275 }
}
```

### ISS

Alíquota varia por município e serviço (LC 116/2003). Para clínicas odontológicas, o item de serviço típico é **14.01** (serviços médicos e hospitalares, subitem saúde) com alíquotas entre **2% e 5%**. O sistema deve:

1. Ler `municipio_ibge` do `unit_fiscal_config` (já existe na Fase 15).
2. Buscar alíquota em `iss_tax_tables` por municipio + vigência.
3. Fallback: usar alíquota configurada manualmente pelo admin (campo `iss_override` em `suppliers`).

[ASSUMED — confirmar alíquota específica de cada município com o contador do projeto; a taxa de 2%–5% é a faixa geral, não um valor fixo]

### Regime Tributário e Apuração (D-19)

| Regime (`clinics.regime_tributario`) | INSS sobre RPA | IRRF sobre RPA | ISS | Observação |
|--------------------------------------|----------------|----------------|-----|------------|
| `simples_nacional` | 11% (retém) | retém se > R$ 5.000 | isento/substituído | Simples já inclui ISS; clínica não recolhe ISS separado |
| `lucro_presumido` | 11% (retém) | retém se > R$ 5.000 | recolhe separado | IRRF via DARF; ISS via guia municipal |
| `lucro_real` | 11% (retém) | retém se > R$ 5.000 | recolhe separado | Mesmo tratamento |
| `mei` | 11% (retém) | retém se > R$ 5.000 | depende município | MEI raramente contrata autônomos |

[ASSUMED — a coluna ISS para Simples precisa confirmação contábil; o entendimento geral é que o Simples substitui o ISS do prestador, mas a RETENÇÃO pelo tomador pode ainda ser exigida pelo município]

---

## EFD-Reinf — Guia para o Stub

### R-2010 — Retenção INSS sobre Serviços Tomados

**Quando se aplica:** clínica contrata serviços de PJ ou autônomo com cessão/empreitada de mão de obra. O tomador (clínica) retém e recolhe o INSS.

**Campos-chave para o stub payload:**
```jsonc
{
  "tipo": "R2010",
  "competencia": "2026-06",
  "prestador_cnpj": "XX.XXX.XXX/0001-XX",
  "valor_bruto_nf": 5000.00,
  "valor_retencao_inss": 550.00,  // 11%
  "cnpj_tomador": "...",          // CNPJ da clínica
  "numero_nf": "...",
  "data_nota": "2026-06-15"
}
```

### R-4020 — Pagamentos/Créditos a PJ com IR/CSLL/PIS/COFINS Retidos

**Quando se aplica:** clínica paga PJ por serviços e retém IR na fonte (quando aplicável). Para clínicas em Simples Nacional, IR sobre PJ geralmente não é retido — mas deve ser modelado para `lucro_presumido`/`lucro_real`.

**Campos-chave:**
```jsonc
{
  "tipo": "R4020",
  "competencia": "2026-06",
  "beneficiario_cnpj": "...",
  "natureza_rendimento": "...",
  "valor_rendimento": 3000.00,
  "valor_irrf": 90.00,           // 3% para PJ sem retenção específica
  "data_pagamento": "2026-06-15"
}
```

[CITED: EFD-Reinf 2026 guia completo ospcontabilidade.com.br + thsbrasil.com.br/efd-reinf]

### Interface do Hub (D-22)

O `reinf` deve ser adicionado à lista de `ConnectorType` em `src/lib/integrations/types.ts`:
```typescript
export type ConnectorType = 'asaas' | 'whatsapp' | 'email' | 'nfse' | 'banco' | 'tiss' | 'reinf' | 'open_finance'
```

E registrado como conector no Hub via migration (CHECK constraint em `integration_connectors.type`).

---

## Repasse Profissional — Fluxo Completo

### Lógica de Comissão (D-13, Claude's Discretion)

O campo `commission_rules` da tabela `professionals` já existe como JSONB (Fase 11):
```jsonc
[
  { "service_id": "uuid-odonto", "percentual": 0.60, "deducoes": ["lab", "taxa_cartao"] },
  { "service_id": "*", "percentual": 0.50, "deducoes": [] }  // regra geral (wildcard)
]
```

**Precedência (Claude's Discretion):**
1. Regra exata por `service_id` (match exato)
2. Regra geral (`service_id = '*'`)
3. Sem regra → 0% com alerta no log (não falha silenciosamente)

**Função pura `computePayout`:**
```typescript
export function computePayout(
  items: PayoutItem[],
  rules: CommissionRule[],
  deducoes: PayoutDeductions
): PayoutCalculation {
  return items.map(item => {
    const rule = rules.find(r => r.service_id === item.service_id)
               ?? rules.find(r => r.service_id === '*')
    if (!rule) return { ...item, percentual: 0, valor_repasse: 0, alerta: 'sem_regra' }

    const valorBase = applyDeductions(item.valor_recebido, deducoes, rule.deducoes)
    return {
      ...item,
      percentual: rule.percentual,
      valor_base: valorBase,
      valor_repasse: Math.round(valorBase * rule.percentual * 100) / 100,
    }
  })
}
```

### Trigger de Reconhecimento (D-14)

O repasse é reconhecido quando `statement_lines.reconciliation_status` muda para `'conciliado'`. A Server Action `reconcileLine` deve:
1. Marcar a `statement_line` como conciliada.
2. Para cada `financial_transaction` casada que seja `receivable_id IS NOT NULL`:
   - Verificar se é receita de serviço com `professional_id`.
   - Disparar `computePayoutForReconciliation(professionalId, amount, serviceId, competencia)`.
3. A computação é **lazy** (calculada no batch de fechamento de competência, não transação a transação) — mais seguro e permite ajustes antes do fechamento.

---

## Open Finance — Stub Connector

### O que o Stub deve simular

O Open Finance Brasil real requer:
- Certificado mTLS (e-CNPJ A1 ou A3)
- Consentimento OAuth 2.0 FAPI 1.0 via aplicativo do banco
- Validade de consentimento: até 12 meses (revogável)
- Endpoints: `/accounts/{accountId}/transactions` (paginado, até 90 dias)
- Dados retornados incluem `transactionId` (equivalente ao FITID), `creditDebitType`, `amount`, `transactionName`

[CITED: openfinancebrasil.atlassian.net/wiki — API de Contas v2.5.0]

**Interface do conector Open Finance (para o Hub):**
```typescript
// em integration_connectors: type='open_finance', config inclui:
{
  "bank_code": "341",              // Itaú, por exemplo
  "account_id_ext": "...",         // ID da conta no banco
  "consent_id": "...",             // ID do consentimento Open Finance
  "consent_expires_at": "2027-06-21"
}
```

**O stub** deve retornar `statement_lines` simuladas com `FITID` gerado (`open_finance:${consent_id}:${transactionId}`), para que o algoritmo de idempotência (D-11) funcione identicamente ao OFX real.

---

## Common Pitfalls

### Pitfall 1: UNIQUE constraint em `statement_lines` com FITID nulo
**O que dá errado:** PostgreSQL trata `NULL != NULL` — dois registros com `fitid = NULL` do mesmo banco não conflitam, gerando duplicatas.
**Por quê acontece:** Bancos que não retornam FITID (raro no Brasil, mas ocorre).
**Como evitar:** Usar `UNIQUE(bank_account_id, fitid)` SOMENTE quando fitid IS NOT NULL (partial unique index) + `UNIQUE(bank_account_id, fitid_fallback)` para o fallback SHA-256 (que é sempre non-null quando usado). Dois índices parciais separados.

### Pitfall 2: Race condition em `next_rpa_number()`
**O que dá errado:** `MAX(numero) + 1` sob concorrência gera duplicatas de numeração.
**Por quê acontece:** Dois requests simultâneos lêem o mesmo MAX.
**Como evitar:** Função `next_rpa_number(p_unit_id UUID)` SECURITY DEFINER idêntica ao `next_os_number()` da Fase 15 — INSERT ON CONFLICT DO UPDATE incrementa atomicamente.

### Pitfall 3: INSS teto ignorado
**O que dá errado:** Cálculo sem verificar o teto cobra INSS sobre a totalidade de valores acima de R$ 8.475,55.
**Como evitar:** `computeInss` deve fazer `base = MIN(valorBruto, teto)` antes de aplicar alíquota.

### Pitfall 4: Granularidade do cálculo IRRF — dedução de INSS antes do IRRF
**O que dá errado:** Calcular IRRF sobre o valor bruto (sem deduzir o INSS) gera IRRF maior que o devido.
**Como evitar:** `baseCalculo_irrf = valorBruto - valorInss`. O INSS é dedutível da base de cálculo do IRRF para contribuintes individuais.

### Pitfall 5: Conciliar automaticamente linhas de "fee" como receita
**O que dá errado:** Taxa de cartão aparece como débito no extrato; o algoritmo N:1 computa a diferença como fee mas a cria como `type='receita'` (invertido).
**Como evitar:** Taxas bancárias e cartão são sempre `type='despesa'`. O sinal de `statement_lines.amount` define: negativo = débito da conta = despesa; positivo = crédito = receita.

### Pitfall 6: Reabrir competência já fechada
**O que dá errado:** Usuário importa extrato de competência passada; o sistema cria repasse/RPA na competência fechada, abrindo brechas contábeis.
**Como evitar:** Checar `competencia_fechamentos` antes de criar payout/RPA; lançar erro amigável "Competência YYYY-MM fechada — recebimento vai para YYYY-MM+1".

### Pitfall 7: `pdf_storage_path` de RPA exposto na resposta
**O que dá errado:** O path do bucket é acessível diretamente, expondo o PDF de RPA (contém dados fiscais) a qualquer autenticado.
**Como evitar:** Mesma regra do NFS-e (T-15-23): `rpa_records` NUNCA retorna `pdf_storage_path` em queries SELECT no `listRpas`. Apenas `getRpaDocumentUrl` retorna signed URL TTL=60s via `createAdminClient`.

### Pitfall 8: Cálculo ISS para Simples Nacional
**O que dá errado:** Sistema calcula e lança ISS a recolher para clínica em Simples, mas o Simples já inclui o ISS do prestador.
**Como evitar:** Para `regime_tributario='simples_nacional'`, pular o cálculo do ISS a pagar (o ISS está embutido no DAS). A retenção de ISS na fonte pelo **tomador** é diferente e depende da legislação municipal (avaliar com contador).

---

## Runtime State Inventory

Esta fase é expansão (não rename/refactor). Sem runtime state para inventariar.

**Nenhum item nas categorias:**
- Stored data: Nenhuma — tabelas novas, sem dados a migrar.
- Live service config: Nenhuma configuração de serviço externo novo (Open Finance e EFD-Reinf são stubs).
- OS-registered state: Nenhuma.
- Secrets/env vars: Nenhuma nova — credenciais do ReinfProvider virão via Hub (integration_connectors) quando o provider real for ativado.
- Build artifacts: Nenhum.

---

## Environment Availability

| Dependência | Requerida por | Disponível | Versão | Fallback |
|-------------|--------------|------------|--------|---------|
| Supabase (sa-east-1) | Todas as tabelas | ✓ | FREE plan | — |
| Vercel (gru1) | Deploy + cron | ✓ | Pro plan | — |
| `ofx-data-extractor` | OFX import | ✓ (a instalar) | 1.5.0 | Hand-roll mínimo para SGML (alto risco) |
| `@react-pdf/renderer` | RPA PDF | ✓ (já instalado) | v4.x | — |
| Tecnospeed EFD-Reinf API | TRIB-03 transmissão | ✗ (não ativado) | — | StubReinfProvider (D-18) |
| Open Finance API + certificado | FOP-02 extrato automático | ✗ (não ativado) | — | OFX upload manual (D-05) |
| Asaas sandbox | Validar webhook payout N:1 | [ASSUMED disponível] | — | Mock webhook payload |

**Missing com fallback:** Tecnospeed e Open Finance — ambos têm stub que implementa a mesma interface.

---

## Code Examples

### Idempotência OFX (D-11)

```typescript
// src/actions/bank-statements.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { parseOfxBuffer } from '@/lib/financeiro/ofx-parser'
import crypto from 'crypto'

export async function importOFX(
  bankAccountId: string,
  fileBuffer: Buffer
): Promise<{ imported: number; skipped: number; error?: string }> {
  // auth + role gate (admin/financeiro)...
  const { lines } = await parseOfxBuffer(fileBuffer)

  // Upsert bank_statement header
  const supabase = await createClient()
  const { data: stmt } = await supabase
    .from('bank_statements')
    .insert({ clinic_id, bank_account_id: bankAccountId, fonte: 'ofx', periodo_inicio, periodo_fim })
    .select('id').single()

  let imported = 0, skipped = 0
  for (const line of lines) {
    const fitidFallback = !line.fitid
      ? crypto.createHash('sha256')
          .update(`${bankAccountId}|${line.date.toISOString().slice(0,10)}|${line.amount}|${line.memo}`)
          .digest('hex')
      : null

    const { error } = await supabase.from('statement_lines').insert({
      clinic_id,
      bank_account_id: bankAccountId,
      bank_statement_id: stmt.id,
      fitid: line.fitid ?? null,
      fitid_fallback: fitidFallback,
      transaction_date: line.date.toISOString().slice(0, 10),
      amount: line.amount,
      memo: line.memo,
    })
    // ON CONFLICT (unique constraint) → error.code === '23505' → já importado
    if (error?.code === '23505') { skipped++; continue }
    if (error) throw error
    imported++
  }
  return { imported, skipped }
}
```

### Função pura de matching exato

```typescript
// src/lib/financeiro/reconciliation.ts
export interface StatementLine { id: string; amount: number; transaction_date: string; memo: string; bank_account_id: string }
export interface TransactionRow { id: string; amount: number; transaction_date: string; description: string; bank_account_id: string }

export interface ExactMatch {
  line_id: string
  transaction_id: string
  confidence: 'exact'
}

export function matchExact(
  line: StatementLine,
  candidates: TransactionRow[],
  dateTolerance = 3,        // dias
  amountTolerance = 0.01    // centavos
): ExactMatch | null {
  const lineDate = new Date(line.transaction_date)
  const match = candidates.find(tx => {
    const txDate = new Date(tx.transaction_date)
    const daysDiff = Math.abs((lineDate.getTime() - txDate.getTime()) / 86400000)
    const amountDiff = Math.abs(line.amount - tx.amount)
    return daysDiff <= dateTolerance && amountDiff <= amountTolerance
  })
  return match ? { line_id: line.id, transaction_id: match.id, confidence: 'exact' } : null
}
```

### Factory do ReinfProvider (espelha getFiscalProvider)

```typescript
// src/lib/reinf/index.ts
import 'server-only'
import { StubReinfProvider } from './stub'
import type { ReinfProvider } from './types'

export async function getReinfProvider(clinicId: string): Promise<ReinfProvider> {
  const admin = createAdminClient()
  const { data: connector } = await admin
    .from('integration_connectors')
    .select('id, credential_enc, config, status')
    .eq('clinic_id', clinicId)
    .eq('type', 'reinf')
    .eq('status', 'enabled')
    .is('deleted_at', null)
    .maybeSingle()

  if (!connector?.credential_enc) {
    return new StubReinfProvider()
  }
  // TecnospeedReinfProvider(connector.credential_enc) — gated, implementado no provider real
  return new StubReinfProvider()  // até o real ser ativado
}
```

---

## Validation Architecture

`workflow.nyquist_validation = true` → seção obrigatória.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (já configurado no projeto) |
| Config file | `vitest.config.ts` (existente) |
| Quick run | `npx vitest run --reporter=verbose src/lib/financeiro/ src/lib/reinf/` |
| Full suite | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOP-01 | `baixarPayable` cria `financial_transaction` despesa e debita saldo | unit (dep injection) | `npx vitest run src/actions/payables.test.ts` | ❌ Wave 0 |
| FOP-01 | RLS: financeiro pode escrever, dentista não pode | source-inspection | `npx vitest run src/lib/__tests__/rls-payables.test.ts` | ❌ Wave 0 |
| FOP-02 | `matchExact` casa linha OFX com transaction por amount+date | unit (pure fn) | `npx vitest run src/lib/financeiro/reconciliation.test.ts` | ❌ Wave 0 |
| FOP-02 | `matchNToOne` distribui 1 depósito em N transactions com fee | unit (pure fn) | `npx vitest run src/lib/financeiro/reconciliation.test.ts` | ❌ Wave 0 |
| FOP-02 | `parseOfxBuffer` extrai FITID + amount + date de arquivo SGML | unit | `npx vitest run src/lib/financeiro/ofx-parser.test.ts` | ❌ Wave 0 |
| FOP-02 | Reimportação OFX não duplica linhas (idempotência FITID) | unit (dep injection) | `npx vitest run src/actions/bank-statements.test.ts` | ❌ Wave 0 |
| FOP-03 | `listTransactions` com `reconciliation_status='conciliado'` retorna só realizados | unit | `npx vitest run src/actions/transactions.test.ts` | ❌ Wave 0 (extend existente) |
| TRIB-01 | `computePayout` aplica regra por serviço com precedência correta | unit (pure fn) | `npx vitest run src/lib/financeiro/payout-math.test.ts` | ❌ Wave 0 |
| TRIB-01 | Sem regra → 0% + alerta (não falha silenciosamente) | unit (pure fn) | `npx vitest run src/lib/financeiro/payout-math.test.ts` | ❌ Wave 0 |
| TRIB-02 | `computeInss` 11% flat com teto correto (R$ 932,31 max) | unit (pure fn) | `npx vitest run src/lib/financeiro/tax-tables.test.ts` | ❌ Wave 0 |
| TRIB-02 | `computeIrrf` 0% até R$ 5.000; fórmula gradual até R$ 7.350 | unit (pure fn) | `npx vitest run src/lib/financeiro/tax-tables.test.ts` | ❌ Wave 0 |
| TRIB-02 | `computeIrrf` deduz INSS antes de calcular base do IR | unit (pure fn) | `npx vitest run src/lib/financeiro/tax-tables.test.ts` | ❌ Wave 0 |
| TRIB-02 | Migrations: inss_tax_tables + irrf_tax_tables + iss_tax_tables com seed 2026 | source-inspection | `npx vitest run src/lib/__tests__/migrations.test.ts` | ❌ Wave 0 |
| TRIB-03 | `StubReinfProvider.transmitir` retorna status 'transmitido' | unit | `npx vitest run src/lib/reinf/reinf.test.ts` | ❌ Wave 0 |
| TRIB-03 | `getReinfProvider` retorna stub quando sem credential_enc | unit (dep injection) | `npx vitest run src/lib/reinf/reinf.test.ts` | ❌ Wave 0 |
| TRIB-03 | RPA `pdf_storage_path` nunca retornado em `listRpas` | source-inspection regex | `npx vitest run src/actions/rpa.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Por task commit:** `npx vitest run src/lib/financeiro/ src/lib/reinf/ --reporter=verbose`
- **Por wave merge:** `npx vitest run`
- **Phase gate:** Full suite verde antes de `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/financeiro/reconciliation.test.ts` — cobre FOP-02 match puro
- [ ] `src/lib/financeiro/payout-math.test.ts` — cobre TRIB-01 cálculo de repasse
- [ ] `src/lib/financeiro/tax-tables.test.ts` — cobre TRIB-02 INSS/IRRF/ISS com casos borda (teto, fórmula gradual IRRF)
- [ ] `src/lib/financeiro/ofx-parser.test.ts` — fixture OFX SGML mínima (25 linhas)
- [ ] `src/lib/reinf/reinf.test.ts` — cobre TRIB-03 stub + factory
- [ ] `src/actions/payables.test.ts` — cobre FOP-01 com dep injection (sem Supabase real)
- [ ] `src/actions/bank-statements.test.ts` — cobre FOP-02 idempotência

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `@supabase/ssr` cookies HTTP-only (herdado) |
| V3 Session Management | yes | Supabase session TTL (herdado) |
| V4 Access Control | yes | RLS `USING + WITH CHECK`; role gate nas actions (D-23) |
| V5 Input Validation | yes | `zod` v3 schemas em todas as actions |
| V6 Criptografia | yes | `credential_enc` via AES-256-GCM (src/lib/crypto.ts) para credenciais Open Finance/Reinf |

### Threat Patterns

| Pattern | STRIDE | Mitigação |
|---------|--------|-----------|
| Upload de OFX malicioso (DoS por arquivo gigante) | DoS | Limit `maxDuration=30s`; verificar tamanho do arquivo antes de parsear (ex: max 5MB) |
| Injeção de tenant_id via input do CP | Spoofing | `clinic_id` sempre de `actor.tenant_id`; jamais de parâmetro do cliente |
| Exposição do PDF de RPA via `storage_path` | Info Disclosure | Regra T-15-23 replicada: `listRpas` NUNCA retorna `pdf_storage_path`; signed URL TTL=60s |
| Conciliação cruzada de contas (tenant A lê extrato de tenant B) | IDOR | RLS `USING (clinic_id = get_my_tenant_id())` em `statement_lines` |
| FITID spoofing (reimportar com FITID falso) | Tampering | UNIQUE constraint DB-level é o backstop; aplicação valida que FITID é do extrato importado |
| Escalada de papéis para baixar CP sem permissão | EoP | `assertNotReadOnly()` + role gate `['admin', 'financeiro']` nas actions de baixa/RPA |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | INSS 11% flat é a modalidade predominante para autônomos prestadores a empresa (art. 21 §2º) | Tax Withholding | Se 11% flat não se aplicar ao vínculo específico, RPA gerado com retenção errada — confirmar com contador |
| A2 | ISS para Simples Nacional não precisa ser recolhido separadamente (está no DAS) | Tax Withholding / Pitfall 8 | Se município exige retenção pelo tomador, sistema omitirá lançamento obrigatório |
| A3 | Asaas sandbox está disponível para testar payload de webhook payout em lote (N:1) | Environment | Bloqueia teste do matching N:1 se sandbox indisponível |
| A4 | `ofx-data-extractor` funciona com OFX SGML de bancos brasileiros (Itaú, Bradesco, BB) | OFX Parsing | Bancos BR podem ter dialetos OFX não conformes; modo `lenient` deve cobrir |
| A5 | O mesmo agregador fiscal da NFS-e (ex: Tecnospeed) cobre EFD-Reinf via API REST sem DLL | EFD-Reinf | A DLL component pode ser o único canal disponível; nesse caso, API route adiciona overhead de bridge |

---

## Open Questions

1. **Alíquota INSS correta para autônomos (11% flat vs tabela progressiva)**
   - O que sabemos: Lei 8.212/91 art. 21 §2º prevê 11% para CI prestador a empresa.
   - O que é incerto: Se o profissional pode optar pela tabela progressiva (7,5%–14%), gerando menor desconto.
   - Recomendação: Implementar os dois modos com campo `modalidade_inss` no supplier; deixar o admin escolher; seedar default como `11pct`.

2. **ISS: retenção pelo tomador no Simples Nacional**
   - O que sabemos: Simples Nacional inclui ISS do prestador. Mas alguns municípios exigem retenção na fonte pelo tomador mesmo quando o prestador é autônomo.
   - Recomendação: Implementar campo `iss_retido_fonte BOOLEAN` no supplier, configurável pelo admin com orientação do contador. Default `false`.

3. **`financeiro` como papel novo ou uso de `admin`?**
   - D-23 menciona "escrita admin/financeiro" mas `financeiro` como papel não aparece explicitamente na matrix RBAC (Fase 7). Os papéis existentes são admin, superadmin, dentist, receptionist, auditor, dpo, socio, ti, implantacao, aluno.
   - Recomendação: Usar `admin` e `superadmin` como writers; checar se `financeiro` é um papel novo a adicionar à migration de papéis (Fase 7 fez RBAC matrix — verificar `src/lib/auth/` roles).

---

## State of the Art

| Abordagem Antiga | Abordagem Atual | Impacto |
|-----------------|-----------------|---------|
| DIRF para declarar IR retido | EFD-Reinf série R-4000 (DIRF extinta desde fatos de 2025) | O sistema deve modelar R-4020 desde o início |
| Tabela IRRF até R$ 2.428,80 isento | Lei 15.270/2025: isenção até R$ 5.000,00 (vigência 2026-01-01) | Seed precisa das tabelas 2026 corretas |
| INSS progressivo (7,5%–14%) só para empregados | Desde 2020 (Lei 14.331/2022 estabilizou), CI prestador a empresa pode usar 11% flat | Duas modalidades no sistema |

---

## Sources

### Primary (HIGH confidence)
- Codebase FYNXIA: migrations `20260606000100`, `20260619001100`, `20260620000200/300`, `src/lib/fiscal/` — padrões a replicar verificados diretamente
- [ofx-data-extractor GitHub](https://github.com/Fabiopf02/ofx-data-extractor) — versão 1.5.0, publicado 2026-03-25, verificado

### Secondary (MEDIUM confidence)
- [Contabilizei — Tabela INSS 2026](https://www.contabilizei.com.br/contabilidade-online/tabela-inss/) — faixas e parcelas dedução 2026 verificadas
- [Contabilizei — Cálculo RPA 2026](https://www.contabilizei.com.br/contabilidade-online/calculo-rpa-recibo-pagamento-autonomo/) — fórmula INSS/IRRF RPA
- [Agência Brasil — Tabela IR 2026](https://agenciabrasil.ebc.com.br/economia/noticia/2026-01/veja-faixas-e-aliquotas-das-novas-tabelas-do-imposto-de-renda-2026) — Lei 15.270/2025 valores
- [bsoft.com.br — RPA 2026](https://bsoft.com.br/blog/voce-sabe-como-emitir-um-rpa) — fórmula RPA step-by-step
- [Pluggy — API extrato bancário](https://www.pluggy.ai/blog/api-extrato-bancario-erp-sistema-gestao) — modelo agregador Open Finance
- [OSP Contabilidade — EFD-Reinf 2026](https://ospcontabilidade.com.br/blog/efd-reinf-guia-completo/) — R-2010, R-4020 guia
- [THS Brasil — EFD-Reinf tomadores](https://thsbrasil.com.br/efd-reinf-retencoes-tomador-inss-ir-csrf-2025/) — R-2010 campos

### Tertiary (LOW confidence — marcar para validação)
- ISS Simples Nacional sem retenção adicional — interpretação geral de LC 123/2006; confirmar com contador
- Tecnospeed EFD-Reinf via REST (sem DLL) — confirmado como possível mas não testado com Node.js

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — padrões de código verificados no repo; única nova dep verificada no npm
- Schema design: HIGH — espelha padrões já testados (receivables, lab_orders, fiscal provider)
- Tax tables (valores numéricos): MEDIUM — fontes consultadas são sites contábeis confiáveis mas não a portaria oficial RFB
- EFD-Reinf adapter: HIGH para o padrão (espelha FiscalProvider exato); MEDIUM para campos específicos dos eventos
- Matching algorithm: HIGH — padrão documentado em múltiplas fontes; Stage 1/2/3 é prática de mercado
- Open Finance: MEDIUM — spec verificada, mas integração real bloqueada por certificado

**Research date:** 2026-06-21
**Valid until:** 2026-09-21 (tabelas tributárias mudam com portaria anual; re-verificar em jan/2027)
