# Phase 15: Faturamento/NFS-e & Convênios/TISS — Research

**Researched:** 2026-06-20
**Domain:** Fiscal/TISS odontológico — NFS-e aggregator API, ANS TISS 3.x GTO, OS state machine, idempotência
**Confidence:** HIGH (schema/patterns from codebase), MEDIUM (NFS-e API fields via Focus NFe docs), MEDIUM (TISS glosa codes from ANS secondary sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Construir o domínio ponta-a-ponta atrás de uma abstração de provider (`FiscalProvider` p/ NFS-e, `TissProvider` p/ TISS) com um adapter STUB gated. O stub simula emissão/retorno (número, protocolo, status). O provider real fica gated em credenciais — mesmo padrão de gating do projeto (Asaas sandbox, conector Phase 9).
- **D-02:** O alvo da abstração NFS-e é um agregador fiscal único (ex.: PlugNotas/Tecnospeed/Focus NFe) que normaliza a heterogeneidade municipal — não integrar prefeitura a prefeitura (ABRASF direto).
- **D-03:** Os providers NFS-e e TISS são registrados como conectores no Hub de Integrações (Phase 9) — credenciais criptografadas, `logToHub`, reprocesso em falha.
- **D-04:** Nova tabela `services` (cadastro de rede, `clinic_id`): nome, código, valor particular, conta contábil/categoria (liga ao plano de contas Phase 14).
- **D-05:** Campo `tuss_code` opcional por serviço (terminologia exigida na guia TISS). Opcional para não travar serviços puramente particulares.
- **D-06:** Tabela `insurer_prices` (operadora × serviço × valor). Preço do convênio sobrepõe o particular quando a OS é faturada via aquela operadora. Modelo preço-a-preço (não multiplicador %).
- **D-07:** Seed de catálogo odontológico padrão editável na criação da clínica, consistente com seeds Phase 3/14.
- **D-08:** Gatilho automático = `appointment.status` → `concluido` cria uma OS rascunho vinculada ao appointment/paciente/dentista.
- **D-09:** Linhas de procedimento entram via nova tabela `appointment_procedures` (appointment × service = procedimentos executados), que alimenta as linhas da OS.
- **D-10:** Ciclo da OS = rascunho → revisar → faturar (máquina de estados explícita). Só ao faturar dispara recebível/NFS-e/guia.
- **D-11:** 1 OS por atendimento concluído + permitir OS avulsa manual.
- **D-12:** Pagador no nível da OS — cada OS tem 1 pagador: particular (NFS-e + recebível Asaas) OU uma operadora (guia TISS + recebível da operadora).
- **D-13:** Modelar guia/lote TISS no banco e gerar arquivo/representação via `TissProvider` STUB. XML TISS real gated no provider real.
- **D-14:** Glosas classificadas por tabela de motivos padrão ANS (seed, editável); usuário registra recurso (texto/anexo) e o status atualiza na tela.
- **D-15:** Faturar convênio gera recebível(eis) vinculado(s) ao lote/operadora (não Asaas). Baixa/conciliação do lote fica na Phase 16.
- **D-16:** Config fiscal por unidade (mínimo viável): emitente, município, série, próximo número, alíquota ISS padrão, código de serviço municipal. Reusa `clinics_regime` p/ regime. ISS sobrescrevível por serviço.
- **D-17:** Arquivar XML/PDF de retorno da NFS-e e do lote TISS no bucket de documentos existente (Phase 8) com metadados. Stub gera placeholder arquivável.
- **D-18:** Matriz de permissões: dentista marca atendimento concluído (gera OS rascunho); recepção + admin editam/faturam OS e emitem NFS-e; cadastro de operadora/config fiscal/tratamento de glosa = admin/financeiro.
- **D-19:** Cancelar OS faturada, cancelar NFS-e e estornar recebível passam pelo fluxo de estorno/aprovação por alçada Phase 10, com motivo + trilha de auditoria.
- **D-20:** Emissão disparada no faturar, com flag de regime por unidade: competência (1 NFS-e pelo total da OS) ou caixa (NFS-e por parcela paga, via webhook Asaas). Default configurável.
- **D-21:** Faturar OS particular chama `createCharge` (Asaas, até 21x) por OS, mapeando forma de pagamento; vínculo OS ↔ charge/receivable; reusa webhook idempotente existente (Phase 3).
- **D-22:** Lote TISS: guias acumulam por operadora; usuário fecha o lote (por competência/período) e envia → stub retorna protocolo.
- **D-23:** Retorno de NFS-e/lote (processando → emitida/erro) chega via webhook do provider roteado pelo Hub (Phase 9) + worker/cron de polling como fallback. Stub resolve síncrono no dev.
- **D-24:** Construir telas reais (OS/Faturamento, NFS-e, Convênios/TISS) sob `/clinica/financeiro/faturamento`, reaproveitando o visual dos protótipos.
- **D-25:** OS com número sequencial por unidade (emitente). Permitir desconto/acréscimo por linha + desconto geral no total, recalculando a base de NFS-e/parcelas.
- **D-26:** Cadastro de operadora (CONV-01): nome, CNPJ, registro ANS, versão TISS, credenciais/conector (via Hub Phase 9), contato, regras de pagamento/prazo.
- **D-27:** Enums travados: OS: `rascunho`/`faturada`/`cancelada`; NFS-e: `processando`/`emitida`/`cancelada`/`erro`; Guia/lote TISS: `em_analise`/`autorizada`/`glosada`/`paga`/`recurso`; Pagador da OS: `particular`/`convenio`.
- **D-28:** Glosa modelada por ITEM da guia (motivo ANS + valor glosado por item) — guia parcialmente paga; recurso por item; valor esperado do recebível ajusta item a item.
- **D-29:** Cada linha da OS carrega o profissional executor (derivado de `appointment_procedures`) como base de repasse futuro (Phase 16) — não calcula repasse agora.
- **D-30:** Idempotência obrigatória na emissão externa — chave por OS/guia + checagem de status antes de emitir NFS-e / criar cobrança / enviar lote.

### Claude's Discretion
- Nomenclatura exata de colunas/índices/FKs e o desenho fino do schema.
- Estrutura do seed do catálogo de serviços (quais procedimentos folha) e dos motivos de glosa ANS.
- Formato exato do export TISS do stub e da chave de idempotência.
- Layout/componentização fina das telas → definido em `/gsd-ui-phase` (15-UI-SPEC.md approved).

### Deferred Ideas (OUT OF SCOPE)
- Orçamento/estimativa pré-OS → fase Relatórios/Orçamento.
- Tributos além de ISS (PIS/COFINS/IRRF, RPA, EFD-Reinf) → Phase 16.
- Conciliação do recebimento do lote / extrato bancário (OFX/Open Finance) → Phase 16.
- Cálculo de repasse do profissional → Phase 16.
- Baixa de estoque por procedimento concluído → Phase 17.
- Co-participação na mesma guia (split por linha) — por ora 2 OS.
- Rateio percentual multi-centro de custo — herdado como deferido da Phase 14.
- XML TISS real homologado por operadora e emissão NFS-e em prefeitura real — gated no provider real.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OS-01 | Atendimento concluído vira ordem de serviço automática com os procedimentos executados | D-08/D-09: appointment.status=concluido triggers OS rascunho; appointment_procedures table feeds OS lines |
| OS-02 | Usuário emite NFS-e na prefeitura do município a partir da OS | D-02/D-03/D-16: FiscalProvider abstraction over aggregator; unit fiscal config; D-17 archival |
| OS-03 | A forma de pagamento gera as parcelas a receber (base do contas a receber e do repasse) | D-21: createCharge reuse; D-15: insurer receivable for TISS path |
| CONV-01 | Usuário cadastra operadoras com tabelas e regras próprias | D-26: insurers table + D-06: insurer_prices table |
| CONV-02 | Sistema gera guia TISS e lote de envio/protocolo por operadora | D-13/D-22: tiss_guides/tiss_lotes tables + TissProvider stub |
| CONV-03 | Glosas são classificadas por motivo e tratadas (recurso) | D-14/D-28: glosa by item + ANS motivo seed + recurso registro |
</phase_requirements>

---

## Summary

Phase 15 delivers the complete billing lifecycle from concluded appointment to revenue recognition across two paths: particular (NFS-e + Asaas receivable) and convênio (TISS guide + insurer receivable). The architecture is fundamentally provider-agnostic: `FiscalProvider` and `TissProvider` interfaces with STUB adapters gated on credential presence — identical to the `PaymentGateway`/Asaas pattern proven in Phase 3. All external integration wires through the Hub connector model from Phase 9.

The schema work is the most complex part of this phase: six new tables (`services`, `appointment_procedures`, `service_orders`, `service_order_items`, `tiss_guides`, `tiss_lotes`), three more for the convênio domain (`insurers`, `insurer_prices`, `glosa_items`), two for NFS-e records and fiscal unit config, and a seed for 15+ standard dental procedures and ~15 ANS glosa motivos. All follow the established FYNXIA column conventions: `clinic_id`/`tenant_id` FK to `clinics`, `NUMERIC(12,2)` for money, `TIMESTAMPTZ` for timestamps, `TEXT CHECK` for status enums, and indexed `clinic_id`.

State machine enforcement is server-side: the `rascunho→faturada→cancelada` OS lifecycle mirrors the `kit_status` guards pattern from Phase 13 — re-fetch state at action time before any side-effect, reject if invalid transition, wrap every external call in an idempotency key check. Async NFS-e/TISS response handling reuses the `drainIntegrationEvents` worker CAS pattern (Phase 9) extended with actual protocol senders in the try-block.

**Primary recommendation:** Plan the phase in 7 waves: (1) schema migrations, (2) services/insurers/seed, (3) OS domain + state machine + createCharge wiring, (4) FiscalProvider abstraction + NFS-e stub + unit config, (5) TissProvider + guide/lote stub + glosa, (6) UI pages (6 screens per UI-SPEC), (7) tests + verification.

---

## Standard Stack

### Core (inherited — do not re-install)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@supabase/supabase-js` | v2 | DB client, RLS | Already installed |
| `@supabase/ssr` | latest | Server Components auth | Already installed |
| `react-hook-form` | v7 | Forms (operadora, OS, recurso) | Already installed |
| `zod` | v3.x | Schema validation (NEVER v4) | Already installed |
| `@hookform/resolvers` | v5.2.0+ | RHF + Zod bridge | Already installed |
| `@tanstack/react-table` | v8 | Headless table for OS/NFS-e/TISS lists | Already installed |
| `nuqs` | latest | URL-persisted filters (?month, ?status, ?operadora) | Already installed |
| `zustand` | latest | Client-only UI state (bulk select for lote) | Already installed |
| `@react-pdf/renderer` | v4.x | OS receipt PDF | Already installed |
| `lucide-react` | latest | Icons (ClipboardList, FileText, ShieldPlus) | Already installed |

### No New Packages Required
This phase is entirely within the existing stack. No `npm install` needed. All fiscal and TISS logic is implemented as TypeScript abstraction layers (providers) calling HTTP APIs via `fetch` — no new SDK dependencies.

**External API targets (HTTP, not npm):**
- Focus NFe REST API: `https://api.focusnfe.com.br/v2/nfse` [CITED: doc.focusnfe.com.br]
- PlugNotas/Tecnospeed API: `https://api.plugnotas.com.br/nfse` [CITED: docs.plugnotas.com.br]
- Both behind `FiscalProvider` abstraction — implementation gated on connector credentials

---

## Architecture Patterns

### Recommended Project Structure (new files)

```
src/
├── lib/
│   ├── fiscal/
│   │   ├── types.ts               # FiscalProvider interface, NfseInput, NfseResult
│   │   ├── stub.ts                # StubFiscalProvider (simulates emission, no HTTP)
│   │   ├── focusnfe.ts            # FocusNfeFiscalProvider (gated on credentials)
│   │   └── index.ts               # getFiscalProvider(connectorId) factory
│   ├── tiss/
│   │   ├── types.ts               # TissProvider interface, GuiaInput, LoteResult
│   │   ├── stub.ts                # StubTissProvider
│   │   └── index.ts               # getTissProvider(connectorId) factory
│   └── validators/
│       ├── service-order.ts       # serviceOrderSchema, serviceOrderItemSchema
│       ├── service.ts             # serviceSchema (catalog)
│       └── insurer.ts             # insurerSchema, insurerPriceSchema
├── actions/
│   ├── service-orders.ts          # createOs, faturarOs, cancelarOs, getOs
│   ├── nfse.ts                    # emitirNfse, cancelarNfse, getNfses
│   ├── tiss.ts                    # criarGuia, fecharLote, registrarGlosa, registrarRecurso
│   └── services.ts                # listServices, createService, updateService
├── app/(dashboard)/clinica/financeiro/faturamento/
│   ├── page.tsx                   # Hub screen (Screen 6)
│   ├── os/page.tsx                # OS list (Screen 1)
│   ├── nfse/page.tsx              # NFS-e (Screen 2)
│   ├── convenios/page.tsx         # TISS guides (Screen 3)
│   ├── operadoras/
│   │   ├── page.tsx               # Operadoras list (Screen 4)
│   │   └── [id]/precos/page.tsx   # insurer_prices inline edit
│   └── glosas/page.tsx            # Glosa treatment (Screen 5)
└── components/financeiro/
    ├── OsTable.tsx, OsSheet.tsx
    ├── NfseTable.tsx, NfseKpiRow.tsx, NfseEmitForm.tsx
    ├── ConveniosKpiRow.tsx, TissGuidesTable.tsx
    ├── InsurerTable.tsx, InsurerFormDialog.tsx
    └── GlosaTable.tsx, GlosaRecursoSheet.tsx
```

### Pattern 1: FiscalProvider Interface (mirrors PaymentGateway from Phase 3)

```typescript
// src/lib/fiscal/types.ts
// [VERIFIED: codebase inspection — mirrors src/lib/asaas/gateway.ts pattern]

export interface NfseInput {
  // Emitente (from unit fiscal config)
  prestador_cnpj: string
  prestador_inscricao_municipal: string
  prestador_codigo_municipio: string   // IBGE code (7 digits)
  // Tomador (from patient)
  tomador_cpf: string
  tomador_nome: string
  tomador_email?: string
  // Serviço
  discriminacao: string                // full description of services
  valor_servicos: number               // NUMERIC(12,2)
  item_lista_servico: string           // e.g. "11.02" (dental services LC 116)
  codigo_tributario_municipio?: string
  aliquota_iss: number                 // e.g. 0.05 for 5%
  iss_retido: boolean
  // Control
  natureza_operacao: '1' | '2' | '3' | '4' | '5' | '6'
  optante_simples_nacional: boolean
  regime_especial_tributacao?: string
  // Idempotency
  idempotency_key: string              // `nfse:${service_order_id}`
}

export interface NfseResult {
  provider_ref: string                 // aggregator's reference id
  numero?: string                      // assigned number (null while processando)
  serie?: string
  status: 'processando' | 'emitida' | 'cancelada' | 'erro'
  xml_url?: string                     // available after emitida
  pdf_url?: string
  error_message?: string
}

export interface FiscalProvider {
  emit(input: NfseInput): Promise<NfseResult>
  query(provider_ref: string): Promise<NfseResult>
  cancel(provider_ref: string, motivo: string): Promise<{ success: boolean }>
}
```

### Pattern 2: FiscalProvider Factory with Credential Gating

```typescript
// src/lib/fiscal/index.ts
// [VERIFIED: codebase inspection — mirrors gateway pattern in src/lib/asaas/gateway.ts]
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { StubFiscalProvider } from './stub'
import { FocusNfeFiscalProvider } from './focusnfe'

export async function getFiscalProvider(clinicId: string): Promise<FiscalProvider> {
  const admin = createAdminClient()
  const { data: connector } = await admin
    .from('integration_connectors')
    .select('id, credential_enc, config, status')
    .eq('clinic_id', clinicId)
    .eq('type', 'nfse')
    .eq('status', 'enabled')
    .is('deleted_at', null)
    .single()

  // Gate on credentials — no credentials = STUB
  if (!connector?.credential_enc) {
    return new StubFiscalProvider()
  }
  const apiKey = decrypt(connector.credential_enc)
  return new FocusNfeFiscalProvider(apiKey, connector.config)
}
```

### Pattern 3: OS State Machine (mirrors kit_status guard from Phase 13)

```typescript
// src/actions/service-orders.ts — faturarOs action
// [VERIFIED: codebase inspection — mirrors setLabOrderCost double-post guard pattern]
'use server'
import 'server-only'

const VALID_TRANSITIONS: Record<string, string[]> = {
  rascunho: ['faturada', 'cancelada'],
  faturada: ['cancelada'],
  cancelada: [],
}

export async function faturarOs(osId: string, input: FaturarOsInput) {
  // 1. Re-fetch OS at action time (TOCTOU-proof — mirrors kit-block-guard pattern)
  const { data: os } = await supabase
    .from('service_orders').select('*').eq('id', osId).single()

  if (!os || !VALID_TRANSITIONS['rascunho']?.includes('faturada')) {
    return { success: false, error: 'Transição de status inválida' }
  }

  // 2. Idempotency check — D-30
  if (os.idempotency_key && os.status !== 'rascunho') {
    return { success: false, error: 'OS já faturada (idempotência)' }
  }

  // 3. SET status (optimistic CAS — same as drainIntegrationEvents CAS)
  const { data: claimed } = await supabase
    .from('service_orders')
    .update({ status: 'faturada', idempotency_key: `os:${osId}:faturar` })
    .eq('id', osId).eq('status', 'rascunho')  // CAS guard
    .select('id')

  if (!claimed?.length) return { success: false, error: 'Corrida detectada — tente novamente' }

  // 4. Branch: particular vs. convênio
  if (os.pagador === 'particular') {
    await createCharge({ patientId: os.patient_id, ... })
    await emitirNfse({ osId, ... })  // if regime=competência
  } else {
    await criarGuiaTiss({ osId, insurerId: os.insurer_id, ... })
    await insertInsurerReceivable({ osId, ... })
  }
}
```

### Pattern 4: Idempotency Key Construction (D-30)

```typescript
// Idempotency key format (Claude's Discretion — canonical proposal)
// [ASSUMED — consistent with project's existing idempotency patterns]

// NFS-e emission
const nfseKey = `nfse:os:${serviceOrderId}`

// TISS guide creation
const guiaKey = `tiss:guia:os:${serviceOrderId}`

// TISS lote send
const loteKey = `tiss:lote:${loteId}:send`

// Asaas charge (particular path — reuses existing pattern)
const chargeKey = `charge:os:${serviceOrderId}`

// Check pattern (mirrors webhook_events upsert dedup):
const { data: existing } = await supabase
  .from('nfse_records')
  .select('id, status')
  .eq('service_order_id', serviceOrderId)
  .single()

if (existing && existing.status !== 'erro') {
  return { success: true, nfseId: existing.id }  // idempotent return
}
```

### Pattern 5: OS Sequential Number per Unit

```typescript
// Number generation — PostgreSQL sequence per unit (D-25)
// [ASSUMED — consistent with lab_orders/sterilization_cycles numbering patterns]
// Migration: CREATE SEQUENCE service_orders_number_seq (or use nextval approach)

-- In migration:
CREATE SEQUENCE IF NOT EXISTS service_order_seq_${unit_id_slug};
-- In Server Action, use DB function:
CREATE OR REPLACE FUNCTION next_os_number(p_unit_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_num INT;
BEGIN
  UPDATE unit_sequences SET last_os_number = last_os_number + 1
  WHERE unit_id = p_unit_id
  RETURNING last_os_number INTO next_num;
  RETURN 'OS-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Anti-Patterns to Avoid

- **Never call external NFS-e/TISS APIs before the OS CAS claim succeeds** — prevents partial state on double-click.
- **Never store ISS rate or TISS protocol in a Zod .default()** — RHF resolvers v5 type mismatch (established project decision D-133).
- **Never use Edge Runtime for NFS-e/TISS routes** — these routes touch Supabase (TCP) and call fetch to external APIs; must use Node.js runtime.
- **Never expose provider API keys via NEXT_PUBLIC_ env vars** — credential_enc decrypted server-side only.
- **Never skip WITH CHECK in new RLS policies** — established CLAUDE.md requirement.
- **Do not derive `vencido` as a stored status** — follows existing `receivables` pattern (derived at read time).

---

## Schema Design

### New Tables (Claude's Discretion for exact column names, guided by conventions)

> All tables follow: `clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE`, `NUMERIC(12,2)` for money, `TIMESTAMPTZ` for timestamps, `TEXT CHECK` for status/type enums, `CREATE INDEX` on `clinic_id` mandatory.

#### `unit_fiscal_config` — D-16

```sql
-- Config fiscal per unit (1 row per unit). Reuses clinics.regime_tributario for regime.
CREATE TABLE public.unit_fiscal_config (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                 UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id                   UUID        NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  emitente_cnpj             TEXT        NOT NULL,
  emitente_inscricao_mun    TEXT,
  municipio_codigo_ibge     TEXT        NOT NULL,  -- 7-digit IBGE code
  serie_rps                 TEXT        NOT NULL DEFAULT 'A1',
  proximo_numero_rps        INT         NOT NULL DEFAULT 1,
  aliquota_iss_padrao       NUMERIC(5,4) NOT NULL DEFAULT 0.05,  -- e.g. 0.05 = 5%
  item_lista_servico        TEXT        NOT NULL DEFAULT '11.02', -- odontológico LC 116
  regime_emissao            TEXT        NOT NULL DEFAULT 'competencia'
                            CHECK (regime_emissao IN ('competencia', 'caixa')),
  ativo                     BOOLEAN     NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id)
);
CREATE INDEX idx_unit_fiscal_config_clinic ON public.unit_fiscal_config(clinic_id);
```

#### `services` — D-04, D-05

```sql
-- Catalog de serviços/procedimentos da rede. 1 row per service.
CREATE TABLE public.services (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID         NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name            TEXT         NOT NULL,
  code            TEXT,                         -- internal code
  tuss_code       TEXT,                         -- D-05: TUSS code (optional)
  description     TEXT,
  valor_particular NUMERIC(12,2) NOT NULL DEFAULT 0,
  account_id      UUID         REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  aliquota_iss_override NUMERIC(5,4),           -- ISS override per service (D-16)
  item_lista_servico_override TEXT,             -- LC 116 override per service
  ativo           BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_clinic ON public.services(clinic_id);
CREATE UNIQUE INDEX idx_services_code ON public.services(clinic_id, code) WHERE code IS NOT NULL;
```

#### `insurers` — D-26, CONV-01

```sql
-- Cadastro de operadoras de convênio.
CREATE TABLE public.insurers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  cnpj             TEXT,
  registro_ans     TEXT,                     -- Registro ANS da operadora
  tiss_version     TEXT        NOT NULL DEFAULT '3.05.00',
  prazo_pagamento_dias INT     NOT NULL DEFAULT 30,
  contato_email    TEXT,
  contato_phone    TEXT,
  connector_id     UUID        REFERENCES public.integration_connectors(id) ON DELETE SET NULL,
  status           TEXT        NOT NULL DEFAULT 'ativo'
                   CHECK (status IN ('ativo', 'em_negociacao', 'inativo')),
  ativo            BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_insurers_clinic ON public.insurers(clinic_id);
```

#### `insurer_prices` — D-06, CONV-01

```sql
-- Preço do convênio por serviço (sobrepõe valor_particular).
CREATE TABLE public.insurer_prices (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  insurer_id   UUID        NOT NULL REFERENCES public.insurers(id) ON DELETE CASCADE,
  service_id   UUID        NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  valor        NUMERIC(12,2) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (insurer_id, service_id)
);
CREATE INDEX idx_insurer_prices_clinic    ON public.insurer_prices(clinic_id);
CREATE INDEX idx_insurer_prices_insurer   ON public.insurer_prices(insurer_id);
```

#### `appointment_procedures` — D-09, OS-01

```sql
-- Procedimentos executados em um atendimento (base das linhas da OS e de baixa de estoque Phase 17).
CREATE TABLE public.appointment_procedures (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id    UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id        UUID        NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  professional_id   UUID        REFERENCES public.professionals(id) ON DELETE SET NULL,
  quantity          INT         NOT NULL DEFAULT 1,
  valor_unitario    NUMERIC(12,2) NOT NULL,  -- valor particular or convênio snapshot
  desconto          NUMERIC(12,2) NOT NULL DEFAULT 0,
  nota              TEXT,
  dente             TEXT,        -- tooth number/code (for TISS face/dente fields)
  face              TEXT,        -- tooth face (for TISS)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_appointment_procedures_clinic      ON public.appointment_procedures(clinic_id);
CREATE INDEX idx_appointment_procedures_appointment ON public.appointment_procedures(appointment_id);
```

#### `service_orders` — D-10, D-11, D-12, D-25, OS-01

```sql
-- Ordem de Serviço. 1 per concluded appointment (or manual).
CREATE TABLE public.service_orders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id          UUID        REFERENCES public.units(id) ON DELETE RESTRICT,
  numero           TEXT        NOT NULL,            -- D-25: sequential per unit, e.g. 'OS-000001'
  patient_id       UUID        REFERENCES public.patients(id) ON DELETE RESTRICT,
  appointment_id   UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id  UUID        REFERENCES public.professionals(id) ON DELETE SET NULL,
  pagador          TEXT        NOT NULL DEFAULT 'particular'
                   CHECK (pagador IN ('particular', 'convenio')),
  insurer_id       UUID        REFERENCES public.insurers(id) ON DELETE RESTRICT,
  status           TEXT        NOT NULL DEFAULT 'rascunho'
                   CHECK (status IN ('rascunho', 'faturada', 'cancelada')),
  desconto_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
  acrescimo_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  idempotency_key  TEXT,                           -- D-30: set on faturar action
  faturada_at      TIMESTAMPTZ,
  cancelada_at     TIMESTAMPTZ,
  cancel_reason    TEXT,
  created_by       UUID        REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, numero)
);
CREATE INDEX idx_service_orders_clinic     ON public.service_orders(clinic_id);
CREATE INDEX idx_service_orders_patient    ON public.service_orders(patient_id);
CREATE INDEX idx_service_orders_status     ON public.service_orders(clinic_id, status);
CREATE UNIQUE INDEX idx_service_orders_idem ON public.service_orders(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

#### `service_order_items` — D-25, D-29

```sql
-- Lines of the OS (snapshots of appointment_procedures at faturar time, or manual entries).
CREATE TABLE public.service_order_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  service_order_id UUID        NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  service_id       UUID        REFERENCES public.services(id) ON DELETE RESTRICT,
  professional_id  UUID        REFERENCES public.professionals(id) ON DELETE SET NULL,  -- D-29
  description      TEXT        NOT NULL,
  tuss_code        TEXT,                       -- D-05: from service.tuss_code at snapshot time
  quantity         INT         NOT NULL DEFAULT 1,
  valor_unitario   NUMERIC(12,2) NOT NULL,
  desconto         NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total      NUMERIC(12,2) NOT NULL,     -- (valor_unitario * quantity) - desconto
  dente            TEXT,
  face             TEXT,
  account_id       UUID        REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  cost_center_id   UUID        REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_order_items_clinic ON public.service_order_items(clinic_id);
CREATE INDEX idx_service_order_items_os     ON public.service_order_items(service_order_id);
```

#### `nfse_records` — D-17, OS-02

```sql
-- NFS-e per OS. 1 row per fiscal emission.
CREATE TABLE public.nfse_records (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id          UUID        REFERENCES public.units(id) ON DELETE RESTRICT,
  service_order_id UUID        REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  provider_ref     TEXT,                       -- aggregator reference (Focus NFe ref)
  numero           TEXT,                       -- assigned NFS-e number (null until emitida)
  serie            TEXT,
  valor_servicos   NUMERIC(12,2) NOT NULL,
  aliquota_iss     NUMERIC(5,4) NOT NULL,
  valor_iss        NUMERIC(12,2) NOT NULL,
  iss_retido       BOOLEAN      NOT NULL DEFAULT false,
  valor_liquido    NUMERIC(12,2) NOT NULL,
  tomador_nome     TEXT,
  status           TEXT        NOT NULL DEFAULT 'processando'
                   CHECK (status IN ('processando', 'emitida', 'cancelada', 'erro')),
  error_message    TEXT,
  xml_storage_path TEXT,                       -- D-17: bucket path
  pdf_storage_path TEXT,
  emitida_at       TIMESTAMPTZ,
  cancelada_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nfse_records_clinic ON public.nfse_records(clinic_id);
CREATE INDEX idx_nfse_records_os     ON public.nfse_records(service_order_id);
CREATE INDEX idx_nfse_records_status ON public.nfse_records(clinic_id, status);
```

#### `tiss_lotes` — D-22, CONV-02

```sql
-- TISS lote per operadora per competência period.
CREATE TABLE public.tiss_lotes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  insurer_id     UUID        NOT NULL REFERENCES public.insurers(id) ON DELETE RESTRICT,
  numero         TEXT        NOT NULL,         -- lote number (stub generates sequentially)
  competencia    TEXT        NOT NULL,         -- 'YYYY-MM'
  status         TEXT        NOT NULL DEFAULT 'em_analise'
                 CHECK (status IN ('em_analise', 'autorizada', 'glosada', 'paga', 'recurso')),
  protocolo      TEXT,                         -- returned by provider on send
  valor_total    NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_envio     TIMESTAMPTZ,
  provider_ref   TEXT,
  xml_storage_path TEXT,                       -- D-17: bucket path for lote XML
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tiss_lotes_clinic   ON public.tiss_lotes(clinic_id);
CREATE INDEX idx_tiss_lotes_insurer  ON public.tiss_lotes(insurer_id);
```

#### `tiss_guides` — D-13, D-22, CONV-02

```sql
-- GTO (Guia de Tratamento Odontológico) per OS per operadora.
CREATE TABLE public.tiss_guides (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  lote_id          UUID        REFERENCES public.tiss_lotes(id) ON DELETE SET NULL,
  service_order_id UUID        NOT NULL REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  insurer_id       UUID        NOT NULL REFERENCES public.insurers(id) ON DELETE RESTRICT,
  patient_id       UUID        REFERENCES public.patients(id) ON DELETE RESTRICT,
  numero_guia      TEXT        NOT NULL,       -- sequential per clinic
  numero_carteira  TEXT,                       -- beneficiary wallet number
  registro_ans     TEXT,                       -- from insurer
  status           TEXT        NOT NULL DEFAULT 'em_analise'
                   CHECK (status IN ('em_analise', 'autorizada', 'glosada', 'paga', 'recurso')),
  valor_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_autorizado NUMERIC(12,2),
  valor_glosado    NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_pago       NUMERIC(12,2),
  protocolo        TEXT,                       -- returned by provider/stub
  provider_ref     TEXT,
  xml_storage_path TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tiss_guides_clinic   ON public.tiss_guides(clinic_id);
CREATE INDEX idx_tiss_guides_lote     ON public.tiss_guides(lote_id);
CREATE INDEX idx_tiss_guides_os       ON public.tiss_guides(service_order_id);
CREATE INDEX idx_tiss_guides_status   ON public.tiss_guides(clinic_id, status);
```

#### `tiss_guide_items` — D-28, CONV-02

```sql
-- Items of a TISS guide (one per procedure line). Glosa is per item.
CREATE TABLE public.tiss_guide_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  guide_id         UUID        NOT NULL REFERENCES public.tiss_guides(id) ON DELETE CASCADE,
  service_order_item_id UUID   REFERENCES public.service_order_items(id) ON DELETE SET NULL,
  tuss_code        TEXT,
  description      TEXT        NOT NULL,
  quantity         INT         NOT NULL DEFAULT 1,
  dente            TEXT,
  face             TEXT,
  valor_unitario   NUMERIC(12,2) NOT NULL,
  valor_total      NUMERIC(12,2) NOT NULL,
  valor_glosado    NUMERIC(12,2) NOT NULL DEFAULT 0,
  motivo_glosa_id  UUID        REFERENCES public.glosa_motivos(id) ON DELETE SET NULL,
  glosa_status     TEXT        CHECK (glosa_status IN ('pendente', 'glosada', 'em_recurso', 'paga')),
  recurso_texto    TEXT,
  recurso_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tiss_guide_items_clinic ON public.tiss_guide_items(clinic_id);
CREATE INDEX idx_tiss_guide_items_guide  ON public.tiss_guide_items(guide_id);
```

#### `glosa_motivos` — D-14, CONV-03 (seed table)

```sql
-- ANS Tabela 38 motivos de glosa (seed + editável por clínica).
CREATE TABLE public.glosa_motivos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID        REFERENCES public.clinics(id) ON DELETE CASCADE,  -- NULL = system-wide
  codigo_ans    TEXT        NOT NULL,
  descricao     TEXT        NOT NULL,
  ativo         BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_glosa_motivos_clinic ON public.glosa_motivos(clinic_id);
-- NULL clinic_id = shared seed; tenant-specific overrides have clinic_id set
```

---

## NFS-e Aggregator API Shape

### Verified Focus NFe API Payload (PRIMARY target for FiscalProvider)

**Endpoint:** `POST https://api.focusnfe.com.br/v2/nfse?ref={idempotency_key}`
[CITED: doc.focusnfe.com.br/reference/emitir_nfse.md — verified June 2026]

```json
{
  "data_emissao": "2026-06-20T10:30:00-03:00",
  "natureza_operacao": "1",
  "optante_simples_nacional": true,
  "regime_especial_tributacao": "6",
  "prestador": {
    "cnpj": "12345678000123",
    "inscricao_municipal": "123456",
    "codigo_municipio": "3550308"
  },
  "tomador": {
    "cpf": "12345678909",
    "razao_social": "Marina A.",
    "email": "patient@email.com",
    "endereco": {
      "logradouro": "Rua das Flores",
      "numero": "123",
      "bairro": "Centro",
      "codigo_municipio": "3550308",
      "uf": "SP",
      "cep": "01311000"
    }
  },
  "servico": {
    "valor_servicos": 1200.00,
    "iss_retido": false,
    "aliquota": 0.05,
    "item_lista_servico": "11.02",
    "discriminacao": "Tratamento de canal — OS-000001",
    "codigo_municipio": "3550308"
  }
}
```

**Key `natureza_operacao` values:**
- `"1"` — Tributação no município (most common for dental clinics)
- `"3"` — Isenção
- `"4"` — Imune

**`regime_especial_tributacao` values:**
- `"5"` — MEI - Simples Nacional
- `"6"` — ME/EPP - Simples Nacional (most common dental clinic)
- `"3"` — Sociedade de profissionais

**Response (synchronous pre-validation, then async):**
```json
{
  "cnpj_prestador": "12345678000123",
  "ref": "nfse:os:uuid-here",
  "numero_rps": "1",
  "serie_rps": "A1",
  "status": "processando_autorizacao"
}
```

**Status lifecycle (maps to FYNXIA D-27 NFS-e enum):**
| Focus NFe status | FYNXIA status |
|-----------------|--------------|
| `processando_autorizacao` | `processando` |
| `autorizado` | `emitida` |
| `cancelado` | `cancelada` |
| `erro_autorizacao` | `erro` |

**Webhook event types (via Hub Phase 9):**
- `nfse_autorizada` — NFS-e emitida com número
- `nfse_cancelada` — NFS-e cancelada
- `nfse_erro` — Erro de autorização municipal

**LC 116 item for dental services:**
- `11.02` — Odontologia / dentistas (primary item for most dental procedures)
- `11.01` — Médicos / medicina (use if code 11.02 not available in specific municipality)

### Stub Implementation Pattern

```typescript
// src/lib/fiscal/stub.ts
// [VERIFIED: codebase inspection — mirrors StubConnector pattern]
export class StubFiscalProvider implements FiscalProvider {
  async emit(input: NfseInput): Promise<NfseResult> {
    // Synchronous stub for dev/test — returns emitida immediately
    return {
      provider_ref: `stub:${input.idempotency_key}`,
      numero: `STUB-${Date.now()}`,
      serie: 'STUB',
      status: 'emitida',
      xml_url: undefined,
      pdf_url: undefined,
    }
  }

  async query(provider_ref: string): Promise<NfseResult> {
    return { provider_ref, status: 'emitida' }
  }

  async cancel(provider_ref: string, motivo: string): Promise<{ success: boolean }> {
    return { success: true }
  }
}
```

---

## TISS Standard for Odontologia (GTO)

### GTO Minimum Data Model (TISS 3.x, odontológico)
[CITED: ANS TISS Manual Odontologia — ans.gov.br; CITED: TISS Cartilha 3.04 — verified secondary sources]

**Cabeçalho do Lote:**
- `registroANS` — operadora's ANS registration number
- `numeroLote` — sequential batch number
- `tipoTransacao` — `'EnvioLoteGuias'`
- `versaoPadrao` — `'3.05.00'`

**Cabeçalho da Guia GTO:**
- `numeroGuiaPrestador` — provider's guide number
- `registroANS` — insurer ANS
- `numeroBeneficiario` (+ digito verificador) — patient wallet number
- `nomeBeneficiario` — patient name
- `numeroAtendimento` — care episode number (can be appointment_id)
- `dataAtendimento` — date of service
- `executante.codigoPrestadorNaOperadora` — provider code at insurer
- `executante.CNPJ` or `CPF` — provider CNPJ

**Procedimentos (one per line item):**
- `codigoTabela` — `'22'` for TUSS (standard for dental)
- `codigoProcedimento` — TUSS code (maps to `tuss_code` on `services`)
- `descricaoProcedimento`
- `quantidade`
- `valorUnitario`
- `valorTotal`
- `dente` — tooth number (optional for some procedures)
- `face` — tooth face (optional)
- `regiao` — region (optional)

**Retorno do Lote (protocolo):**
- `numeroProtocolo` — assigned on receipt by insurer
- `dataProtocolo`
- `hash` — integrity hash (returned by insurer system)

### ANS Tabela 38 — Motivos de Glosa (Seed Data)

The following codes are from ANS TISS Tabela 38 (Terminologia de mensagens), verified from multiple secondary sources.
[CITED: centralsaudecaixa.com.br/Tabela-38, cuidarmais.ufms.br/TABELA-DE-GLOSAS, multiple TISS domain table documents]

**Grupo 10 — Beneficiário:**
| Código | Descrição |
|--------|-----------|
| 1001 | Número da carteira inválido |
| 1002 | Número do cartão nacional de saúde inválido |
| 1003 | Atendimento anterior à inclusão do beneficiário na operadora |
| 1004 | Solicitação anterior à inclusão do beneficiário |
| 1005 | Beneficiário sem cobertura para este procedimento |
| 1006 | Carência não cumprida |
| 1007 | Beneficiário excluído da operadora |
| 1008 | Data de atendimento incompatível com data do plano |

**Grupo 20 — Prestador:**
| Código | Descrição |
|--------|-----------|
| 2001 | Prestador não credenciado para este procedimento |
| 2002 | Prestador sem habilitação para este procedimento |
| 2003 | Número do CRO inválido ou não correspondente ao executante |
| 2004 | Registro do prestador inválido |

**Grupo 30 — Procedimento:**
| Código | Descrição |
|--------|-----------|
| 3001 | Procedimento não coberto pelo plano |
| 3002 | Procedimento duplicado |
| 3003 | Procedimento incompatível com o sexo do beneficiário |
| 3004 | Procedimento incompatível com a idade do beneficiário |
| 3005 | Quantidade de procedimentos acima do limite |
| 3006 | Prazo de carência não cumprido para este procedimento |
| 3007 | Documentação incompleta, incorreta ou ausente |
| 3008 | Procedimento não autorizado |
| 3009 | Incompatibilidade entre o procedimento e o dente informado |
| 3010 | Procedimento não realizado na data informada |
| 3011 | Código de procedimento inválido |
| 3012 | Período mínimo entre procedimentos não cumprido |

**Grupo 40 — Faturamento:**
| Código | Descrição |
|--------|-----------|
| 4001 | Valor cobrado acima da tabela de preços |
| 4002 | Glosa parcial por divergência de valor |
| 4003 | Prazo de faturamento encerrado |
| 4004 | Guia com dados incompletos para faturamento |
| 4005 | Número de guia duplicado |

**Nota sobre seeds:** Os códigos ANS reais (Tabela 38 oficial) usam numeração diferente em algumas operadoras. O seed deve incluir estes ~20 motivos comuns mais uma entrada genérica `9901` para "Outros (definido pela operadora)`. Editável por clínica conforme D-14. [ASSUMED: seed structure — verified category structure from TISS domain table references, exact codes from secondary sources]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NFS-e municipal heterogeneity | Custom per-prefecture integration | FiscalProvider → Focus NFe / PlugNotas | 5.000+ municipalities each with different XML schema/endpoint; aggregators normalize this |
| ISS calculation rules | Custom ISS engine | Aggregator API computes ISS from aliquota + base; FYNXIA sends aliquota only | Municipality-specific ISS computation rules change; aggregators keep current |
| TISS XML generation | Custom XML builder | TissProvider stub → real provider later | ANS TISS has 200+ page schema specification; any deviation causes rejection |
| Idempotency key tracking | Custom dedup table | Reuse `webhook_events` pattern (unique index on idempotency_key) + nfse_records.service_order_id unique | Established in Phase 3; proven CAS pattern in Phase 9 |
| Sequential OS numbering | Application-level counter | PostgreSQL SECURITY DEFINER function with `UPDATE ... RETURNING` or sequence | Atomic — no two concurrent requests get same number |
| OS total computation | Client-side JS | Computed server-side in Server Action before insert, returned to client | Prevents decimal drift from floating-point; NUMERIC(12,2) is authoritative |
| PDF generation for receipts | Puppeteer/html2canvas | `@react-pdf/renderer` v4 (already installed, Phase 3 pattern) | Puppeteer exceeds Vercel 50MB function limit |

**Key insight:** The NFS-e domain in Brazil is _not_ a single API — it is 5.000+ municipal prefectures, each with different XML schemas and endpoints. Aggregators (Focus NFe, PlugNotas/Tecnospeed) maintain all municipal integrations. The FiscalProvider abstraction exists precisely to keep this complexity outside FYNXIA's codebase.

---

## Common Pitfalls

### Pitfall 1: Double-Emission on Double-Click or Retry
**What goes wrong:** User clicks "Faturar OS" twice in quick succession. Two Server Action invocations reach the server concurrently, both see `status='rascunho'`, both call `createCharge`/`emitirNfse`.
**Why it happens:** React optimistic updates don't prevent duplicate server calls; network retries re-submit.
**How to avoid:** CAS UPDATE on OS status before any external call:
```sql
UPDATE service_orders
SET status='faturada', idempotency_key='os:uuid:faturar'
WHERE id = $1 AND status = 'rascunho'
RETURNING id;
-- Zero rows = already claimed → return error
```
**Warning signs:** Duplicate NFS-e records with same service_order_id; double charges in Asaas.

### Pitfall 2: NFS-e Emission Before OS is Persisted
**What goes wrong:** OS status update is deferred (optimistic), but NFS-e emission to the aggregator succeeds. On DB error, NFS-e is emitted but no local record exists.
**Why it happens:** Calling external API before committing local state.
**How to avoid:** Always insert `nfse_records` with `status='processando'` BEFORE calling `fiscalProvider.emit()`. If emit() fails, record `status='erro'` in catch.

### Pitfall 3: ISS Calculation Decimal Drift
**What goes wrong:** `valor_iss = valor_servicos * aliquota` in JavaScript produces floating-point errors (e.g., `1200 * 0.05 = 59.999999999`).
**Why it happens:** IEEE 754 floating-point arithmetic.
**How to avoid:** Use integer-cent math (same as `charges.ts` `baseCents` pattern):
```typescript
const issCents = Math.round(valorServicosCents * aliquota)
const valorIss = issCents / 100
```

### Pitfall 4: TISS XML Schema Version Mismatch
**What goes wrong:** Operadora rejects guia because TISS version in XML header doesn't match `insurers.tiss_version` negotiated with the insurer.
**Why it happens:** Some insurers still accept 3.04 while others require 3.05.
**How to avoid:** `insurers.tiss_version` column drives the XML version in `TissProvider`. Stub always uses the `insurers.tiss_version` field. Different insurers can have different versions.

### Pitfall 5: Glosa Partial Update Without Item-Level Guard
**What goes wrong:** Registering a recurso on one glosa item updates the entire guia status to `recurso`, marking all items as disputed.
**Why it happens:** Status updates at guide level rather than item level.
**How to avoid:** `tiss_guide_items.glosa_status` is per-item. Guide-level `status` is DERIVED: if any item is `glosada` → guide is `glosada`; if any item is `em_recurso` → guide is `recurso`; compute at read time or trigger.

### Pitfall 6: `appointment.status` Trigger Race Condition
**What goes wrong:** Two concurrent calls to `updateAppointmentStatus('concluido')` both trigger OS creation, resulting in two OS records for one appointment.
**Why it happens:** No uniqueness constraint on `service_orders.appointment_id`.
**How to avoid:** Add `UNIQUE (appointment_id)` constraint on `service_orders` WHERE appointment_id IS NOT NULL (partial unique index to allow manual OS without appointment_id):
```sql
CREATE UNIQUE INDEX idx_service_orders_appointment
  ON public.service_orders(appointment_id)
  WHERE appointment_id IS NOT NULL;
```

### Pitfall 7: ISS Override per Service vs. Unit Default
**What goes wrong:** NFS-e is emitted with the unit's default ISS aliquota (e.g., 5%) for a service that has a different rate override (e.g., implantes at 2% in certain municipalities).
**Why it happens:** Emission logic uses `unit_fiscal_config.aliquota_iss_padrao` without checking `services.aliquota_iss_override`.
**How to avoid:** NFS-e ISS computation:
```typescript
const aliquota = item.aliquota_iss_override ?? unitFiscalConfig.aliquota_iss_padrao
```

### Pitfall 8: Cron/Worker Polling Conflict with Webhook Handler
**What goes wrong:** Both the webhook (fast path via Hub D-23) and the polling worker update `nfse_records.status` concurrently, causing one to overwrite a `emitida` status back to `processando`.
**Why it happens:** Both paths do a simple UPDATE without checking current status.
**How to avoid:** Status updates must only advance the lifecycle (never go backwards). Apply CAS on status:
```sql
UPDATE nfse_records
SET status = 'emitida', numero = $numero, emitida_at = now()
WHERE id = $id AND status = 'processando'  -- only advance from processando
```

### Pitfall 9: Zod `.default()` on Status Fields
**What goes wrong:** Using `.default('rascunho')` on `status` in a Zod schema causes `@hookform/resolvers` v5 input/output type mismatch — build fails with TS error.
**Why it happens:** Project decision D-133 (documented in STATE.md).
**How to avoid:** Never use `.default()` in Zod schemas. Use RHF `defaultValues` to supply defaults.

---

## Code Examples

### OS Auto-Creation on Appointment Completion

```typescript
// src/actions/appointments.ts — extension of existing updateAppointment action
// [VERIFIED: codebase inspection — appointment.ts status enum confirmed]
// Called when status transitions to 'concluido'

async function createOsDraftFromAppointment(appointmentId: string, tenantId: string) {
  // 1. Fetch appointment with patient, dentist, unit
  const { data: appt } = await supabase
    .from('appointments')
    .select('id, patient_id, dentist_id, unit_id')
    .eq('id', appointmentId).single()

  if (!appt) return

  // 2. Get unit for OS number generation + professional_id via user_id join
  const { data: prof } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', appt.dentist_id)
    .single()

  // 3. Generate OS number (atomic via DB function)
  const { data: num } = await supabase
    .rpc('next_os_number', { p_unit_id: appt.unit_id })

  // 4. Insert OS rascunho — UNIQUE idx on appointment_id prevents duplicate
  await supabase.from('service_orders').insert({
    clinic_id: tenantId,
    unit_id: appt.unit_id,
    numero: num,
    patient_id: appt.patient_id,
    appointment_id: appointmentId,
    professional_id: prof?.id ?? null,
    status: 'rascunho',
    pagador: 'particular',  // default; recepcionista pode alterar
  })
}
```

### Glosa Partial Payment Math

```typescript
// Computing guide-level glosa totals from item-level data
// [ASSUMED — based on D-28 and standard TISS practice]

async function computeGuiaGlosaTotals(guideId: string) {
  const { data: items } = await supabase
    .from('tiss_guide_items')
    .select('valor_total, valor_glosado')
    .eq('guide_id', guideId)

  const valorTotal = items?.reduce((s, i) => s + i.valor_total, 0) ?? 0
  const valorGlosado = items?.reduce((s, i) => s + i.valor_glosado, 0) ?? 0
  const valorAutorizado = valorTotal - valorGlosado

  // Integer-cent math to prevent decimal drift
  const glosadoCents = Math.round(valorGlosado * 100)
  const totalCents = Math.round(valorTotal * 100)
  const glosaRate = totalCents > 0 ? glosadoCents / totalCents : 0

  return { valorTotal, valorGlosado, valorAutorizado, glosaRate }
}
```

### NFS-e Regime Caixa vs. Competência (D-20)

```typescript
// Emission decision point for regime
// [ASSUMED — based on D-20 and standard Brazilian accounting practice]

export async function handleOsFaturada(osId: string) {
  const { data: os } = await supabase
    .from('service_orders')
    .select('*, unit:unit_fiscal_config(*)')
    .eq('id', osId).single()

  if (os?.pagador !== 'particular') return  // TISS path handled separately

  const regime = os.unit?.regime_emissao ?? 'competencia'

  if (regime === 'competencia') {
    // Emit NFS-e now for full OS total
    await emitirNfse({ serviceOrderId: osId, valorBase: os.total })
  }
  // regime === 'caixa': NFS-e emitida per parcel when webhook Asaas confirms payment
  // webhook handler in /api/webhooks/asaas/route.ts will call emitirNfse per parcela
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ABRASF direct per-municipality integration | Fiscal aggregator (Focus NFe / PlugNotas) | 2018+ (ANS 2016 + DPS national 2022) | Single API covers 5.000+ municipalities |
| TISS 3.04.00 | TISS 3.05.00 (most insurers) / TISS 4.x in development | 2023-2024 | Stricter beneficiary card validation, TUSS code validation |
| Manual NFS-e emission in prefeitura portal | API emission via aggregator | 2020+ | Fully automated fiscal flow |
| Storing vencido status in DB | Deriving vencido at read time | Phase 3 decision | No invalid status in DB; single source of truth |
| React Context for server data | TanStack Query v5 + RSC | Phase 7+ decision | Cache invalidation, background sync |

**NFS-e Nacional (ABRASF 2.0+):** Since 2022, the Brazilian federal government has been rolling out a national NFS-e standard (Padrão Nacional). Focus NFe and PlugNotas abstract over this transparently — FYNXIA's `FiscalProvider` layer means zero changes needed when a municipality migrates. [CITED: blog.tecnospeed.com.br/nfse-nacional-tudo/]

---

## Runtime State Inventory

This is a **greenfield additive phase** — no renaming or migration of existing data. No runtime state inventory required. All new tables, new UI routes, new provider integrations. Existing data in `appointments`, `patients`, `charges`, `receivables`, `integration_connectors` is read but not modified by schema migrations.

The only schema changes to existing tables are:
1. `service_orders.appointment_id` FK references `appointments` — additive, no backfill needed.
2. `financial_transactions` will receive new rows from OS faturar (classified with `account_id` + `cost_center_id`).

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Supabase (sa-east-1) | All DB operations | Yes | Project jqjwyqlbbuqnrffdnlpp confirmed |
| Node.js / Vercel | Server Actions, API routes | Yes | gru1 region |
| Focus NFe API | FiscalProvider (real) | Gated on credentials | STUB used in dev/test |
| PlugNotas API | FiscalProvider (alternative) | Gated on credentials | STUB used in dev/test |
| Asaas sandbox | createCharge (particular path) | Open question #4 in STATE.md | STUB createCharge ok for unit tests |
| Documents bucket (Phase 8) | NFS-e/TISS XML/PDF archival | Yes (Phase 8 complete) | bucket already configured |
| Hub connectors (Phase 9) | NFS-e/TISS connector registration | Yes (Phase 9 complete) | `integration_connectors` table exists |
| approval_requests (Phase 10) | Cancelar OS faturada / estorno | Yes (Phase 10 complete) | `approval_requests` table exists |

**Missing dependencies with no fallback:** None — all real integrations are STUB-gated.

---

## Validation Architecture

> `workflow.nyquist_validation = true` — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts at project root) |
| Config file | `vitest.config.ts` — `include: ['src/__tests__/**/*.test.ts']` |
| Quick run command | `npx vitest run src/__tests__/faturamento/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| OS-01 | `appointment.status='concluido'` → OS rascunho created (1 per appointment unique) | unit | `npx vitest run src/__tests__/faturamento/service-orders.test.ts` | Wave 0 gap |
| OS-01 | UNIQUE constraint prevents duplicate OS for same appointment | source-inspection | `npx vitest run src/__tests__/faturamento/migrations-phase15.test.ts` | Wave 0 gap |
| OS-02 | FiscalProvider.emit() called on faturarOs (particular, competência) | unit | `npx vitest run src/__tests__/faturamento/nfse.test.ts` | Wave 0 gap |
| OS-02 | Stub returns emitida status synchronously; nfse_records row created | unit | `npx vitest run src/__tests__/faturamento/nfse.test.ts` | Wave 0 gap |
| OS-02 | NFS-e NOT emitted if OS pagador = 'convenio' | unit | `npx vitest run src/__tests__/faturamento/nfse.test.ts` | Wave 0 gap |
| OS-03 | createCharge called on faturarOs (particular path) | unit | `npx vitest run src/__tests__/faturamento/service-orders.test.ts` | Wave 0 gap |
| OS-03 | Insurer receivable created on faturarOs (convenio path, no Asaas) | unit | `npx vitest run src/__tests__/faturamento/service-orders.test.ts` | Wave 0 gap |
| CONV-01 | insurer + insurer_prices tables created with correct schema | source-inspection | `npx vitest run src/__tests__/faturamento/migrations-phase15.test.ts` | Wave 0 gap |
| CONV-02 | criarGuiaTiss creates tiss_guides record in em_analise | unit | `npx vitest run src/__tests__/faturamento/tiss.test.ts` | Wave 0 gap |
| CONV-02 | fecharLote groups guides, calls TissProvider.sendLote, stores protocolo | unit | `npx vitest run src/__tests__/faturamento/tiss.test.ts` | Wave 0 gap |
| CONV-03 | registrarGlosa per item with motivo_glosa_id and valor_glosado | unit | `npx vitest run src/__tests__/faturamento/tiss.test.ts` | Wave 0 gap |
| CONV-03 | registrarRecurso updates glosa_status to 'em_recurso' | unit | `npx vitest run src/__tests__/faturamento/tiss.test.ts` | Wave 0 gap |
| D-30 | faturarOs idempotent: second call with same osId returns success without re-emitting | unit | `npx vitest run src/__tests__/faturamento/service-orders.test.ts` | Wave 0 gap |
| D-30 | CAS guard: concurrent faturarOs on same OS — only one wins | unit | `npx vitest run src/__tests__/faturamento/service-orders.test.ts` | Wave 0 gap |
| D-25 | OS total = sum(item.valor_total) - desconto_total + acrescimo_total | unit | `npx vitest run src/__tests__/faturamento/service-orders.test.ts` | Wave 0 gap |
| D-25 | ISS base = OS total after discounts | unit | `npx vitest run src/__tests__/faturamento/nfse.test.ts` | Wave 0 gap |
| D-27 | Status enums in migration match D-27 exactly | source-inspection | `npx vitest run src/__tests__/faturamento/migrations-phase15.test.ts` | Wave 0 gap |
| D-20 | regime=competência → emitirNfse on faturar | unit | `npx vitest run src/__tests__/faturamento/nfse.test.ts` | Wave 0 gap |
| D-20 | regime=caixa → NO NFS-e on faturar; emission deferred to payment webhook | unit | `npx vitest run src/__tests__/faturamento/nfse.test.ts` | Wave 0 gap |
| D-28 | glosa valor: sum(tiss_guide_items.valor_glosado) = tiss_guides.valor_glosado | unit | `npx vitest run src/__tests__/faturamento/tiss.test.ts` | Wave 0 gap |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/faturamento/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps (all new)
- [ ] `src/__tests__/faturamento/migrations-phase15.test.ts` — source-inspection for all 10 new tables + RLS patterns + D-27 enum CHECK constraints
- [ ] `src/__tests__/faturamento/service-orders.test.ts` — OS state machine, createOs, faturarOs, idempotency CAS, OS total math
- [ ] `src/__tests__/faturamento/nfse.test.ts` — FiscalProvider interface, StubFiscalProvider, emitirNfse, regime caixa vs competência, ISS calc
- [ ] `src/__tests__/faturamento/tiss.test.ts` — TissProvider interface, StubTissProvider, criarGuia, fecharLote, registrarGlosa, registrarRecurso, glosa math
- [ ] `src/__tests__/faturamento/regression-guard-phase15.test.ts` — ensures appointment.ts enum 'concluido' still present, financial_tables columns unchanged, integration_connectors types still include 'nfse'/'tiss'

---

## Security Domain

> `security_enforcement` not explicitly disabled — ASVS section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `@supabase/ssr` + `getUser()` in all Server Actions |
| V3 Session Management | Inherited | Supabase session cookies, HTTP-only |
| V4 Access Control | Yes | D-18: dentist=read/OS-rascunho; recepção+admin=faturar; admin/financeiro=operadora/fiscal config. RLS SELECT broad / write by role. |
| V5 Input Validation | Yes | Zod v3 on all forms (serviceOrderSchema, insurerSchema, nfseEmitSchema). `isMoney2dp` for all NUMERIC(12,2) fields. |
| V6 Cryptography | Inherited | Provider credentials via `credential_enc` (AES-256-GCM, Phase 9 pattern). Never plaintext. |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Double-click OS faturar (duplicate NFS-e/charge) | Tampering | CAS UPDATE on OS status before external call (D-30) |
| TISS guide manipulation (wrong insurer_id or valor) | Tampering | Server-side validation: insurer_id must belong to OS's clinic; valor re-computed from service_order_items |
| Patient CPF in NFS-e tomador field | Information Disclosure | Tomador uses `first_name + last_initial` display; CPF only in encrypted server context; NFS-e payload CPF sent only to fiscal aggregator API (HTTPS), not stored in `nfse_records` directly |
| NFS-e webhook spoofing | Spoofing | Webhook from fiscal provider verified by Hub (Phase 9) with `FISCAL_WEBHOOK_SECRET` header; event routed through `integration_events` like Asaas webhook |
| ISS calculation error (over/under-declaring) | Tampering | Integer-cent math for ISS; aliquota from `unit_fiscal_config` (admin-set) or service override; never user-supplied |
| RLS bypass: receptionist editing other tenant's OS | Elevation of Privilege | `clinic_id = get_my_tenant_id()` on all RLS policies; `WITH CHECK` required on all INSERT/UPDATE |

### LGPD Constraints for this Phase (from UI-SPEC)
- Patient names in OS/NFS-e/TISS tables: display `first_name + last_initial` only.
- CPF: never in table cells; shown only in OS detail Sheet masked as `***.xxx.xxx-**`.
- NFS-e `tomador` display: first name + last initial only (raw CPF goes only to fiscal aggregator via HTTPS server-to-server).
- No raw `storage_path` exposed client-side (documents bucket paths are signed URLs TTL=60s).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | OS sequential number uses a DB SECURITY DEFINER function with UPDATE...RETURNING for atomicity | Schema Design — `service_orders.numero` | If implemented with app-level counter, concurrent OS creation gets duplicate numbers; reverts to DB approach |
| A2 | Focus NFe is the primary FiscalProvider target (not PlugNotas/Tecnospeed) | NFS-e Aggregator API | If client prefers Tecnospeed, FiscalProvider interface is the same but the adapter class changes; both share similar field shapes |
| A3 | LC 116 item `11.02` covers dental services in most municipalities | NFS-e API Shape | Some municipalities may require `11.01` or a local code; `item_lista_servico_override` per service mitigates this |
| A4 | TISS 3.05.00 is the target version for new insurer registrations; 3.04 insurers use `tiss_version` field | TISS Standard | If a new insurer requires 4.x (emerging), TissProvider must support version parameter; `insurers.tiss_version` column accommodates this |
| A5 | ANS Tabela 38 glosa codes listed in seed section represent common codes in dental context | Glosa Motivos seed | Official ANS Tabela 38 has 100+ codes; the seed contains ~20 common ones + operator-custom codes 9901-9999; editável per D-14 mitigates |
| A6 | `tiss_guide_items.glosa_status` drives guide-level status derivation (computed in query, not trigger) | Schema Design | If using a trigger is preferred, adds migration complexity but is equivalent; query-time computation is simpler |
| A7 | Caixa regime NFS-e emission is triggered by existing Asaas webhook handler (Phase 3) | NFS-e regime caixa | Requires `nfse_records.service_order_id` to be available in the webhook context; charges table must link to service_order_id |

---

## Open Questions

1. **Agregador NFS-e escolhido (Focus NFe vs. PlugNotas/Tecnospeed)**
   - What we know: Both are viable; Focus NFe has cleaner documented REST API; PlugNotas was cited in the NFS-e prototype banner
   - What's unclear: Client preference; pricing; contract status
   - Recommendation: Build `FiscalProvider` abstraction with Focus NFe as the first real adapter. The interface is identical for PlugNotas — switching adapters is a single file change.

2. **Caixa regime: `charges` table link to `service_orders`**
   - What we know: `createCharge` in Phase 3 creates a `charges` row with `patient_id` but no `service_order_id` FK
   - What's unclear: The Asaas webhook handler (Phase 3) needs to know WHICH OS to emit the NFS-e for when a parcela is paid in caixa regime
   - Recommendation: Add `service_order_id UUID REFERENCES service_orders(id)` to `charges` table in this phase's migration. Required for D-20 caixa path.

3. **`glosa_motivos` scope: system-wide seed vs. per-clinic**
   - What we know: D-14 says "seed, editável" — editável implies per-clinic overrides
   - What's unclear: Whether ANS codes should be immutable system rows (clinic_id=NULL) or copied per-clinic on onboarding
   - Recommendation: Use `clinic_id=NULL` for system ANS codes (immutable), `clinic_id=<id>` for clinic-specific additions. Query: `WHERE clinic_id IS NULL OR clinic_id = get_my_tenant_id()`.

4. **NFS-e webhook route URL for fiscal provider configuration**
   - What we know: Webhook from fiscal provider must be routed through Hub (D-23); Hub handles `integration_events`
   - What's unclear: The fiscal provider webhook route needs to exist (`/api/webhooks/nfse/route.ts`) — should this be same route as Asaas or separate?
   - Recommendation: Separate route `/api/webhooks/nfse/route.ts` verifying fiscal provider's secret header, then calling `logToHub` and updating `nfse_records`. Mirrors asaas webhook pattern exactly.

---

## Sources

### Primary (HIGH confidence)
- `src/actions/charges.ts` — createCharge pattern, idempotency, Asaas integration [VERIFIED: codebase]
- `src/lib/integrations/worker.ts` — CAS claim pattern for drainIntegrationEvents [VERIFIED: codebase]
- `src/lib/integrations/types.ts` — ConnectorType includes 'nfse'/'tiss' [VERIFIED: codebase]
- `src/lib/validators/connector.ts` — connectorTypeSchema includes 'nfse'/'tiss' [VERIFIED: codebase]
- `src/lib/validators/appointment.ts` — status enum with 'concluido' [VERIFIED: codebase]
- `supabase/migrations/20260619001100_financial_cadastros_tables.sql` — column convention, NUMERIC(12,2), TIMESTAMPTZ, audit trigger [VERIFIED: codebase]
- `supabase/migrations/20260606000100_financial_tables.sql` — charges/receivables/webhook_events pattern [VERIFIED: codebase]
- `supabase/migrations/20260614000150_clinics_regime.sql` — `regime_tributario` on clinics [VERIFIED: codebase]
- `src/app/(dashboard)/clinica/prototipos/nfse/page.tsx` — NFS-e status enums, UI shapes [VERIFIED: codebase]
- `src/app/(dashboard)/clinica/prototipos/convenios/page.tsx` — TISS status enums, insurer shapes [VERIFIED: codebase]
- `src/lib/prototipos/mock-data.ts` — NfseStatus, TissStatus, InsurerStatus type defs [VERIFIED: codebase]
- `.planning/phases/15-faturamento-nfs-e-conv-nios-tiss/15-CONTEXT.md` — all 30 locked decisions [VERIFIED: codebase]
- `.planning/phases/15-faturamento-nfs-e-conv-nios-tiss/15-UI-SPEC.md` — component inventory, screen contracts [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- [Focus NFe emitir_nfse.md](https://doc.focusnfe.com.br/reference/emitir_nfse.md) — JSON payload structure verified from llms.txt index + emitir endpoint docs [CITED]
- [Focus NFe llms.txt](https://doc.focusnfe.com.br/llms.txt) — documentation index [CITED]
- [PlugNotas API](https://docs.plugnotas.com.br/) — aggregator feature overview [CITED]
- [ANS TISS Manual Odontologia](https://www.ans.gov.br/images/stories/Plano_de_saude_e_Operadoras/tiss/Padrao_tiss/manual_tiss_odontologia.pdf) — GTO field requirements [CITED — URL found, content via secondary sources]
- [TISS 3.04 Cartilha](https://www.unimedrecife.com.br/portal_prestador/docs/Cartilha%20TISS.pdf) — TISS version comparison [CITED]
- [ByDoctor TISS versões](https://bydoctor.com.br/blog/faturamento-tiss-versoes-diferencas) — TISS 3.04 vs 3.05 differences [CITED]

### Tertiary (LOW confidence — marked ASSUMED in Assumptions Log)
- ANS Tabela 38 glosa codes (secondary sources: cuidarmais.ufms.br, TISS domain tables) — PDFs not parseable; codes verified from multiple HTML search result snippets; specific code numbers in seed table [LOW — see A5]
- OS sequential number implementation via DB function — [ASSUMED — consistent with project patterns but no precedent in existing migrations]

### Research date: 2026-06-20
### Valid until: 2026-08-20 (stable standards; TISS 4.x release would affect TISS section only)
