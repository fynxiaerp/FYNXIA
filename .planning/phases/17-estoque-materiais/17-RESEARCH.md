# Phase 17: Estoque & Materiais - Research

**Researched:** 2026-06-30
**Domain:** Inventory management / ANVISA traceability / agent-driven procurement
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Modelo de produto & custo médio (D-01 a D-05)
- **D-01:** Tabela separada `products` (produto de estoque ≠ serviço faturável). `services` = o que cobra do paciente; `products` = o que consome internamente. FK nos templates de consumo (`service_material_templates`).
- **D-02:** Custo médio móvel: recalculado a cada entrada — `(saldo_atual × custo_anterior + qtd_entrada × custo_unitario) / novo_saldo`. Padrão brasileiro, auditável.
- **D-03:** Categorias com campos distintos: `implante` → número de registro ANVISA obrigatório + lote obrigatório + validade obrigatória; `medicamento` → validade obrigatória; registro ANVISA opcional; `insumo` → apenas qtd/custo (sem campos adicionais obrigatórios).
- **D-04:** Produto tem `preferred_supplier_id` (FK → `suppliers`, Fase 16). Se não configurado, agente apenas alerta sem criar CP.
- **D-05:** Produto tem `estoque_minimo` (obrigatório) e `estoque_maximo` (opcional). Unidade de medida é atributo descritivo (un, ml, g, cx, fr) — sem lógica de negócio por unidade nesta fase.

#### Baixa automática de estoque (D-06 a D-09)
- **D-06:** Gatilho da baixa: ao registrar procedimento concluído em `appointment_procedures`. A Server Action de registro do procedimento inclui a baixa de materiais.
- **D-07:** `service_material_templates`: tabela de template `service_id → product_id + qtd_padrao`. Admin configura via aba "Materiais utilizados" no ServiceForm (`/config/servicos`). No atendimento, dentista pode ajustar qtd.
- **D-08:** Baixa registrada em `stock_draws`: `appointment_procedure_id`, `product_id`, `batch_id` (FIFO automático), `qtd`, `custo_unitario_snapshot`, `unit_id`, `clinic_id`, `data`.
- **D-09:** Saldo negativo permitido — atendimento jamais bloqueado por falta de estoque. Se saldo < qtd baixada, registra a baixa (saldo fica negativo), marca produto com status `negativo`, gera alerta na UI.

#### Entradas de estoque (D-10)
- **D-10:** Entrada manual via formulário de recebimento (`stock_entries`): produto, fornecedor, lote, validade, qtd recebida, custo unitário, número ANVISA (obrigatório para implante). Atualiza saldo + custo médio móvel.

#### Rastreabilidade ANVISA de implante (D-11 a D-13)
- **D-11:** Lote = entrada de compra (N unidades por lote — tabela `product_batches`). FIFO automático: Server Action de baixa seleciona lote mais antigo com saldo > 0.
- **D-12:** Vínculo ANVISA: `stock_draws.batch_id` + `stock_draws.appointment_procedure_id`. Relatório ANVISA = `stock_draws` JOIN `product_batches` JOIN `products` WHERE `category = 'implante'`.
- **D-13:** Rastreabilidade digital interna — sem impressão de etiqueta nesta fase. Export PDF do relatório ANVISA disponível sob demanda.

#### Alertas & agente de compras (D-14 a D-17)
- **D-14:** Verificação de estoque mínimo real-time na baixa: após cada `stock_draw`, se `saldo_atual <= estoque_minimo`, dispara fluxo de alerta/agente.
- **D-15:** Agente de compras L2 (framework Phase 10): ao detectar saldo ≤ mínimo, cria rascunho de CP (Conta a Pagar) ao `preferred_supplier_id` com `qtd = estoque_maximo - saldo_atual`. Rascunho entra no inbox de aprovações da Fase 10. Se sem fornecedor preferido ou sem estoque_maximo, apenas gera alerta.
- **D-16:** Alertas de validade via cron semanal: `/api/cron/estoque-validade`. Varre produtos com `validade <= hoje + 30 dias`. Registra alertas em tabela de notificações internas. Validade não dispara agente de compras.
- **D-17:** Canal de notificação: UI only — badge/banner na tela de estoque. Sem WhatsApp/e-mail nesta fase.

#### Permissões & ajuste manual (D-18 a D-19)
- **D-18:** Permissões: admin/operacional têm leitura + escrita. Dentista e recep: somente leitura de saldo/histórico. Baixa automática ocorre via Server Action no contexto do prontuário — não exige acesso direto ao módulo de estoque.
- **D-19:** Baixa manual permitida com motivo obrigatório (perda, quebra, vencimento, ajuste de inventário) — apenas admin/operacional. Registrado via `logBusinessEvent`.

#### Telas & navegação (D-20 a D-22)
- **D-20:** Módulo sob `/clinica/estoque`. Sub-rotas: `/clinica/estoque` (dashboard), `/clinica/estoque/produtos`, `/clinica/estoque/entradas`, `/clinica/estoque/anvisa`.
- **D-21:** Templates de consumo configurados dentro do cadastro de serviços (`/config/servicos`): aba "Materiais utilizados" no ServiceForm.
- **D-22:** Seção "Materiais utilizados" no prontuário: pré-preenchida pelo template, qtd editável antes de confirmar o procedimento. Exibe custo total de insumos após confirmação.

#### Multiunidade (D-23)
- **D-23:** Estoque por unidade, independente — `stock_entries`, `stock_draws`, alertas de mínimo e saldos operam por `unit_id`. Produto cadastrado em rede (`clinic_id`), cada unidade tem seu próprio saldo.

### Claude's Discretion
- Nomes/colunas/índices exatos das novas tabelas (`products`, `product_batches`, `stock_entries`, `stock_draws`, `service_material_templates`, tabela de alertas/notificações), seguindo padrões da base (`NUMERIC(12,4)` para qtd fracionada, `NUMERIC(12,2)` para custo, índice em `clinic_id` e `unit_id`).
- Enums de status de produto (`normal`, `baixo`, `critico`, `negativo`, `vencido`).
- Lógica FIFO automático de lotes (implementação em Server Action).
- Threshold padrão de alerta de validade (30 dias) como configuração global ou por produto.
- Estrutura do seed (categorias padrão, unidades de medida padrão).
- Layout/componentização fina das telas → definido via `/gsd-ui-phase`.

### Deferred Ideas (OUT OF SCOPE)
- Módulo de inventário físico completo (contagem em lote)
- Transferência entre unidades
- Integração NF-e de entrada
- Etiquetas físicas ANVISA (PDF de sticker por implante)
- Relatórios gerenciais de custo de procedimento (DRE de insumos) — Fase 19
- Alerta de validade via WhatsApp/e-mail
- Agente de compras com cálculo por consumo histórico (30 dias de média)
- Inventário físico via QR/etiqueta por item individual
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EST-01 | Usuário cadastra produtos (categoria, lote/série, estoque mínimo, custo médio) | Tables: `products`, `product_batches`, `stock_entries`. Custo médio móvel calculado em Server Action. Categorias com validação Zod v3 diferenciada por tipo. |
| EST-02 | Procedimento dá baixa automática de material no estoque | Hook point confirmed in `appointment_procedures`. `service_material_templates` table maps service → product. `stock_draws` records consumption. FIFO batch selection in Server Action. |
| EST-03 | Sistema alerta estoque mínimo (dispara agente de compras) e validade; rastreia lote de implante (ANVISA) | Real-time check post-draw (D-14). `withAgentPolicy` at L2 → `pending_approval` → `approval_requests`. Cron endpoint pattern confirmed. ANVISA report via JOIN on `stock_draws` + `product_batches`. |
</phase_requirements>

---

## Summary

A Fase 17 constrói sobre uma base sólida de integrações já estabelecidas pelas fases anteriores. O ponto de ancoragem central — `appointment_procedures` — foi confirmado como preparado para a baixa de estoque (comentário explícito na migration 20260620000200). O schema de `suppliers` (Fase 16) está pronto para ser referenciado como `preferred_supplier_id`. O framework de agentes L0-L4 (`withAgentPolicy`) está funcional e segue o padrão exato que o agente de compras L2 precisa. O padrão de cron (6 endpoints existentes + vercel.json) é bem estabelecido.

Os desafios técnicos reais desta fase são: (1) a lógica FIFO de lotes em Server Action atômica — sem condição de corrida quando dois atendimentos simultâneos baixam o mesmo produto; (2) o custo médio móvel recalculado com `NUMERIC(12,4)` para evitar drift de arredondamento; (3) a integração no prontuário, que hoje não tem seção de "Materiais utilizados", exigindo extensão do componente `ProntuarioForm` e da Server Action que registra `appointment_procedures`.

**Recomendação primária:** Implementar as 5 novas tabelas em uma migração única (Wave 0), depois o agente de compras em Wave separada para isolar o risco. A baixa de materiais é integrada na Server Action existente de `updateAppointment` (mesma pattern que a OS draft já usa), não em trigger de banco.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 17 |
|-----------|-------------------|
| Next.js 15 + App Router exclusivamente | Todas as rotas em `src/app/(dashboard)/clinica/estoque/` |
| `'use server'` com Zod v3 (não v4) | Schemas de produto/lote/baixa em Zod v3, sem `.default()` |
| NUMERIC(12,2) para valores financeiros; NUMERIC(12,4) para qtd fracionada | `custo_unitario` = NUMERIC(12,2); `quantity` em stock_draws = NUMERIC(12,4) |
| RLS USING + WITH CHECK em toda tabela nova | 5 novas tabelas precisam de RLS migration separada |
| `deleted_at TIMESTAMPTZ` — soft delete em todas as tabelas | `products`, `product_batches`, `stock_entries`, `service_material_templates` |
| Index em `clinic_id` + `unit_id` em toda tabela operacional | Índices obrigatórios em `stock_entries`, `stock_draws`, `product_batches` |
| `createAdminClient` para crons (não `createClient`) | `/api/cron/estoque-validade` usa `createAdminClient` — RLS não aplica |
| Edge Runtime proibido para rotas com DB | `export const runtime = 'nodejs'` no cron |
| `@supabase/ssr` (não auth-helpers) | Padrão já seguido em todas as actions existentes |
| `isCronAuthorized` para todos os crons | Importar de `@/lib/cron-auth` no novo endpoint |
| Supabase FREE plan — sem Auth Hooks / pg_cron | Agendamento via Vercel Cron + `createAdminClient` (padrão já estabelecido) |
| Sem Redux; TanStack Query para dados de servidor | Cache de estoque invalidado via `revalidatePath` nas Server Actions |
| `@react-pdf/renderer` (não Puppeteer) para PDF | Relatório ANVISA como PDF serverless |

---

## Standard Stack

### Core (já no projeto — reutilizar)
| Componente | Versão/Localização | Propósito |
|-----------|-------------------|-----------|
| `createClient` / `createAdminClient` | `@/lib/supabase/server`, `@/lib/supabase/admin` | Acesso ao banco nas Server Actions |
| `logBusinessEvent` | `@/lib/audit.ts` | Audit trail de baixas manuais e ajustes |
| `withAgentPolicy` | `@/lib/ai/policy.ts` | Governança L0-L4 do agente de compras |
| `isCronAuthorized` | `@/lib/cron-auth.ts` | Autenticação dos endpoints de cron |
| `approval_requests` table | migration 20260616000200 | Inbox de aprovação do agente L2 |
| `@react-pdf/renderer` v4 | já no projeto | PDF do relatório ANVISA |
| Zod v3 | já no projeto | Validação dos schemas de entrada |
| `revalidatePath` | next/cache | Invalidação de cache após mutations |
| `shadcn/ui` components | já no projeto | DataTable, Dialog, Form, Badge, Alert |
| `@tanstack/react-table` v8 | já no projeto | Tabelas de produtos, entradas, histórico |
| `nuqs` | já no projeto | Filtros de URL (produto, lote, data) no relatório ANVISA |

### Novas dependências
Nenhuma. Todo o stack necessário para esta fase já está instalado no projeto. [VERIFIED: codebase grep + package.json implícito nas imports existentes]

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── actions/
│   ├── products.ts              # CRUD de produtos (EST-01)
│   ├── product-batches.ts       # CRUD de lotes (EST-01)
│   ├── stock-entries.ts         # Entradas de estoque + custo médio (D-10)
│   ├── stock-draws.ts           # Baixa manual + FIFO logic (D-19)
│   ├── service-material-templates.ts  # Templates de consumo (D-07)
│   └── stock-alerts.ts          # Leitura de alertas ativos
├── app/(dashboard)/clinica/
│   └── estoque/
│       ├── page.tsx             # Dashboard (alertas mínimo + validade + movimentações)
│       ├── produtos/
│       │   └── page.tsx         # Catálogo de produtos com saldo atual
│       ├── entradas/
│       │   └── page.tsx         # Formulário de recebimento + histórico
│       └── anvisa/
│           └── page.tsx         # Relatório ANVISA + export PDF
├── app/api/cron/
│   └── estoque-validade/
│       └── route.ts             # Cron semanal de validade
├── lib/agents/
│   └── stock-agent.ts          # Agente de compras L2 (withAgentPolicy)
└── components/estoque/
    ├── ProductFormDialog.tsx
    ├── ProductsTable.tsx
    ├── BatchFormDialog.tsx
    ├── StockEntryFormDialog.tsx
    ├── StockDrawsTable.tsx
    ├── StockAlertBanner.tsx
    └── AnvisaReportPdf.tsx      # @react-pdf/renderer component
```

### Pattern 1: Baixa automática integrada no fluxo de atendimento

**O que é:** A Server Action que registra procedimento concluído (hoje em `appointments.ts`) chama internamente uma função de baixa de materiais — o mesmo pattern que `createOsDraftFromAppointment` usa hoje.

**Quando usar:** Toda vez que `appointment_procedures` recebe um novo registro com o atendimento concluído.

**Exemplo (mirrors padrão existente de OS draft):**
```typescript
// Em src/actions/appointments.ts — extensão do updateAppointment existente
// Após o bloco 'if (input.status === 'concluido')':
if (input.status === 'concluido') {
  try {
    await createOsDraftFromAppointment(...)  // já existente
    await drawMaterialsForProcedures(id, actor.tenant_id, actor.id)  // NOVO
  } catch (err) {
    console.error('[updateAppointment] drawMaterialsForProcedures failed:', err)
    // Não bloqueia o procedimento (D-09)
  }
}
```

**Implementação de `drawMaterialsForProcedures`:**
```typescript
// src/actions/stock-draws.ts
async function drawMaterialsForProcedures(
  appointmentId: string,
  clinicId: string,
  actorId: string,
): Promise<void> {
  const supabase = createAdminClient()  // admin: precisa cruzar appointment → templates
  
  // 1. Buscar os appointment_procedures deste atendimento
  // 2. Para cada procedure, buscar service_material_templates do service_id
  // 3. Para cada template, executar FIFO batch selection
  // 4. Inserir em stock_draws
  // 5. Atualizar stock_entries saldo
  // 6. Se saldo <= estoque_minimo, chamar runStockAgent()
  // 7. logBusinessEvent (audit trail D-08)
}
```
[VERIFIED: codebase — appointments.ts linhas 336-364 confirmam o padrão try/catch wrapping]

### Pattern 2: FIFO de Lotes em Server Action (sem trigger de banco)

**O que é:** Seleção atômica do lote mais antigo com saldo > 0. Implementado em TypeScript na Server Action (não em trigger PostgreSQL — Supabase FREE não tem pg_cron, e triggers de inventário podem criar problemas difíceis de debugar).

**Implementação:**
```typescript
// Dentro de drawMaterialsForProcedures (Server Action)
async function selectFifoBatch(
  supabase: ReturnType<typeof createAdminClient>,
  productId: string,
  unitId: string,
  clinicId: string,
  qtdNecessaria: number,
): Promise<string | null> {
  // FIFO: lote mais antigo com saldo_disponivel > 0
  // Para implantes (1 unidade por baixa): filtrar exatamente 1 lote
  const { data: batch } = await supabase
    .from('product_batches')
    .select('id, saldo_disponivel')
    .eq('product_id', productId)
    .eq('unit_id', unitId)
    .eq('clinic_id', clinicId)
    .gt('saldo_disponivel', 0)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })  // FIFO = mais antigo primeiro
    .limit(1)
    .maybeSingle()
  
  return batch?.id ?? null
  // Se null → D-09: saldo negativo permitido, batch_id NULL em stock_draws
}
```

**Risco de race condition:** Dois atendimentos simultâneos podem selecionar o mesmo lote. Mitigação: `UPDATE product_batches SET saldo_disponivel = saldo_disponivel - 1 WHERE id = $batchId AND saldo_disponivel > 0 RETURNING id` — se retornar 0 linhas, o lote foi consumido por outra transação. Neste caso, selecionar o próximo lote. [ASSUMED — estratégia de mitigação não verificada em código existente, mas é padrão de CAS guard conforme precedente em payables.ts]

### Pattern 3: Custo Médio Móvel na Entrada

**O que é:** Recalculado em Server Action a cada nova `stock_entry`. Nunca stored como trigger — mesmo padrão de calculo ao estado que o projeto já usa.

```typescript
// src/actions/stock-entries.ts
async function calcularCustoMedioMovel(
  saldoAtual: number,  // NUMERIC(12,4)
  custoAnterior: number,  // NUMERIC(12,2) — custo médio antes da entrada
  qtdEntrada: number,   // NUMERIC(12,4)
  custoUnitario: number  // NUMERIC(12,2) da nova entrada
): number {
  const novoSaldo = saldoAtual + qtdEntrada
  if (novoSaldo === 0) return custoUnitario  // guard divisão por zero
  return ((saldoAtual * custoAnterior) + (qtdEntrada * custoUnitario)) / novoSaldo
}
// Resultado arredondado a 4 casas antes de persistir (NUMERIC(12,4))
```
[VERIFIED: D-02 do CONTEXT.md — fórmula confirmada pelo usuário]

### Pattern 4: Agente de Compras L2 (mirrors collection-agent.ts)

**O que é:** Após detectar `saldo <= estoque_minimo`, o código chama `withAgentPolicy` com `actionSensitivity: 'reversible'`. Na configuração padrão L2 o resultado é `'execute'` → cria rascunho em `payables`. Na configuração L1 seria `'suggest'` → apenas alerta.

```typescript
// src/lib/agents/stock-agent.ts
import { withAgentPolicy } from '@/lib/ai/policy'
import { createAdminClient } from '@/lib/supabase/admin'
import { logBusinessEvent } from '@/lib/audit'

export async function runStockReplenishmentAgent(params: {
  clinicId: string
  unitId: string
  productId: string
  productName: string
  saldoAtual: number
  estoqueMinimo: number
  estoqueMaximo: number | null
  preferredSupplierId: string | null
}): Promise<void> {
  const { clinicId } = params

  const govResult = await withAgentPolicy(
    {
      clinicId,
      agentKey: 'stock_replenishment',
      actorId: null,          // sistema — sem sessão de usuário
      action: 'agent.stock.create_draft_cp',
      actionSensitivity: 'reversible',  // CP = reversível (pode ser rejeitada)
    },
    async () => {
      if (!params.preferredSupplierId || !params.estoqueMaximo) {
        // Apenas alerta — sem criar CP (D-15)
        await insertStockAlert(clinicId, params.productId, 'minimo')
        return { _created: false }
      }

      const qtdReposicao = params.estoqueMaximo - params.saldoAtual
      const admin = createAdminClient()

      // Criar rascunho de CP (origem = 'estoque_agente' — novo valor no CHECK)
      const { data: payable } = await admin
        .from('payables')
        .insert({
          clinic_id: clinicId,
          unit_id: params.unitId,
          supplier_id: params.preferredSupplierId,
          descricao: `Reposição automática: ${params.productName} (${qtdReposicao} un)`,
          valor_total: 0,  // admin ajusta antes de aprovar
          origem: 'estoque_agente',
          status: 'pendente',
        })
        .select('id')
        .single()

      // Criar approval_request para inbox de aprovação
      await admin.from('approval_requests').insert({
        clinic_id: clinicId,
        type: 'ai_action',
        payload: { payable_id: payable?.id, product_id: params.productId },
        agent_key: 'stock_replenishment',
        required_role: 'admin',
        requested_by: '00000000-0000-0000-0000-000000000000',  // system user
        status: 'pending',
      })

      await logBusinessEvent({
        tenantId: clinicId,
        actorId: null,
        action: 'agent.stock.draft_cp_created',
        details: { product_id: params.productId, payable_id: payable?.id },
      })

      return { _created: true }
    },
  )
}
```
[VERIFIED: withAgentPolicy — src/lib/ai/policy.ts linhas 52-117 confirmam o padrão exato]

**Nota crítica sobre `origem` em `payables`:** A coluna `origem` tem `CHECK (origem IN ('manual', 'recorrente', 'lab', 'repasse', 'tributo'))`. A nova origem `'estoque_agente'` precisa ser adicionada via `ALTER TABLE payables ADD CHECK...` em uma nova migration. [VERIFIED: migration 20260621000100 linha 78]

### Pattern 5: Cron de Validade (mirrors recorrente/route.ts)

```typescript
// src/app/api/cron/estoque-validade/route.ts
export const runtime = 'nodejs'
export const maxDuration = 60

import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const hoje = new Date()
  const threshold = new Date(hoje)
  threshold.setDate(threshold.getDate() + 30)
  const thresholdISO = threshold.toISOString().slice(0, 10)

  // Buscar lotes com validade <= hoje + 30 dias
  const { data: batchesProximosVencimento } = await admin
    .from('product_batches')
    .select('id, product_id, clinic_id, unit_id, data_validade, saldo_disponivel')
    .lte('data_validade', thresholdISO)
    .gt('saldo_disponivel', 0)
    .is('deleted_at', null)

  // Inserir alertas em tabela de notificações (stock_alerts)
  // Idempotente: UNIQUE (product_id, unit_id, clinic_id, tipo, data_referencia)
  ...

  return Response.json({ ok: true, alertas_criados: count })
}
```
[VERIFIED: codebase — recorrente/route.ts e cron-auth.ts confirmam o padrão exato]

### Pattern 6: RLS das Novas Tabelas

**Seguir exatamente o padrão de 20260621000600_phase16_rls.sql:**

- `products`: tenant_read (SELECT) + admin_write (ALL USING+WITH CHECK)
- `product_batches`: tenant_read (SELECT) + admin_write (ALL)
- `stock_entries`: tenant_read (SELECT) + operacional_write — `get_my_role() IN ('admin', 'superadmin', 'operacional')`
- `stock_draws`: tenant_read (SELECT) — escrita apenas via `createAdminClient` (service role) nas Server Actions de atendimento
- `service_material_templates`: tenant_read (SELECT) + admin_write (ALL)
- `stock_alerts`: tenant_read (SELECT) — escrita somente via `createAdminClient` (cron + agent)

**Nota:** O papel `operacional` precisará estar no enum de roles se ainda não estiver (confirmar em proxy/role expansion migration 20260614000400).

### Anti-Patterns to Avoid

- **PostgreSQL triggers para baixa de estoque:** Triggers são difíceis de testar, difíceis de debugar em Supabase FREE, e não têm acesso ao contexto de sessão do usuário para auditoria. Usar Server Action. [VERIFIED: decisions em STATE.md — projeto evita triggers de negócio sistematicamente]
- **Bloquear o procedimento por falta de estoque:** D-09 é explícito — paciente na cadeira nunca pode ser bloqueado. Saldo negativo é registrado e alertado.
- **Armazenar `saldo` em `products`:** O saldo real por unidade é calculado como `SUM(stock_entries.qtd) - SUM(stock_draws.qtd)` por `(product_id, unit_id)` — ou mantido em coluna `saldo_atual` em `stock_entries` para performance. Coluna desnormalizada `saldo_atual` em tabela por unidade é aceitável para read performance, mas deve ser atualizada atomicamente nas mutations.
- **Usar `products.clinic_id` como `unit_id`:** Produtos são da rede (`clinic_id`), saldos são por unidade (`unit_id`). A tabela de saldo por unidade (ou as queries de `stock_entries`/`stock_draws`) é que carregam o `unit_id`.
- **Criar agente de compras sem `approval_requests`:** O agente L2 DEVE criar um `approval_requests` para o inbox humano. Nunca efetuar CP automaticamente sem aprovação.
- **Usar `edge` runtime no cron:** `export const runtime = 'nodejs'` obrigatório — Supabase TCP não funciona em Edge. [VERIFIED: todos os 6 crons existentes têm nodejs runtime]

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez disso | Por quê |
|----------|--------------|-------------------|---------|
| Governança de agente L2 | Lógica própria de autonomia | `withAgentPolicy` de `@/lib/ai/policy.ts` | Já implementado, testado, loga em `ai_decision_log` |
| Autenticação do cron | Comparação de string simples | `isCronAuthorized` de `@/lib/cron-auth.ts` | Constant-time compare, fail-closed |
| Audit trail de baixas manuais | Tabela própria | `logBusinessEvent` de `@/lib/audit.ts` | Admin client, resiliente a falha |
| Inbox de aprovação | UI própria | `approval_requests` table + UI existente de Fase 10 | Já existe, admin já sabe usar |
| Rascunho de CP do agente | Tabela própria | `payables` table com `origem = 'estoque_agente'` | Reaproveita todo o fluxo de CP existente |
| Export PDF | Puppeteer / jsPDF | `@react-pdf/renderer` v4 | Limitação de 50MB Vercel — Puppeteer não roda |
| Filtros URL | `useState` | `nuqs` | Padrão do projeto para tabelas filtráveis |

---

## Common Pitfalls

### Pitfall 1: `origem` em `payables` não inclui `'estoque_agente'`
**O que acontece:** O INSERT do agente de compras falha silenciosamente com `23514 check_violation` na coluna `origem`.
**Por que acontece:** A coluna tem `CHECK (origem IN ('manual', 'recorrente', 'lab', 'repasse', 'tributo'))` — `'estoque_agente'` não está na lista.
**Como evitar:** Adicionar `ALTER TABLE public.payables DROP CONSTRAINT payables_origem_check; ALTER TABLE public.payables ADD CONSTRAINT payables_origem_check CHECK (origem IN ('manual', 'recorrente', 'lab', 'repasse', 'tributo', 'estoque_agente'));` na migration de Wave 0.
**Sinais de alerta:** Erro 23514 no log da Server Action do agente; CP rascunho não aparece na lista de contas a pagar.
[VERIFIED: migration 20260621000100 linha 78 — CHECK constraint confirmado]

### Pitfall 2: Race condition no FIFO de lotes
**O que acontece:** Dois procedimentos simultâneos baixam o mesmo lote, gerando `saldo_disponivel` negativo inesperado (diferente do saldo negativo intencional de produto sem estoque).
**Por que acontece:** SELECT + UPDATE separados sem atomicidade.
**Como evitar:** Usar `UPDATE product_batches SET saldo_disponivel = saldo_disponivel - $qtd WHERE id = $batchId AND saldo_disponivel >= $qtd RETURNING id` — retorna vazio se outro processo já consumiu. Neste caso, re-selecionar o próximo lote FIFO (ou registrar como saldo negativo se não houver mais lotes).
**Sinais de alerta:** `saldo_disponivel` com valores inconsistentes entre lotes do mesmo produto/unidade.

### Pitfall 3: `withAgentPolicy` chamado sem `clinicId` real
**O que acontece:** `ai_decision_log.clinic_id` viola `NOT NULL` constraint → a baixa de materiais pode falhar se a exceção não for capturada.
**Por que acontece:** O cron ou agent chamado sem resolver o `clinic_id` do contexto.
**Como evitar:** Seguir o padrão exato do `collection-agent.ts` — chamar `withAgentPolicy` PER-ROW dentro do loop, nunca no nível do runner. [VERIFIED: STATE.md — decisão explícita "withAgentPolicy chamado PER-ROW dentro do loop"]
**Sinais de alerta:** Erro `[withAgentPolicy] skipping ai_decision_log INSERT — clinicId is not a valid UUID` nos logs.

### Pitfall 4: Saldo agregado errado em clínica com múltiplas unidades
**O que acontece:** Dashboard mostra saldo agregado da rede, mas alerta dispara com base no mínimo de uma unidade diferente.
**Por que acontece:** Queries sem filtro `unit_id` somam saldos de todas as unidades.
**Como evitar:** TODA query de saldo, alerta mínimo e FIFO DEVE incluir `AND unit_id = $unitId`. D-23 é explícito: saldo é por unidade. O produto tem `clinic_id` mas saldo é por `(product_id, unit_id)`.
**Sinais de alerta:** Alerta de mínimo em unidade A quando unidade B tem estoque suficiente.

### Pitfall 5: `stock_draws.appointment_procedure_id` sem FK real
**O que acontece:** Registros orfãos em `stock_draws` se `appointment_procedures` for deletado (soft delete não protege FK sem `ON DELETE RESTRICT`).
**Por que acontece:** `appointment_procedures` não tem `deleted_at` — é hard-delete implícito se cascade de `appointments` disparar.
**Como evitar:** `stock_draws.appointment_procedure_id REFERENCES appointment_procedures(id) ON DELETE RESTRICT` — impede deleção de procedimento que tenha baixa de estoque registrada. A FK de `appointment_procedures` para `appointments` já é `ON DELETE CASCADE`, mas `stock_draws` cria um segundo ponto de proteção.
**Sinais de alerta:** `stock_draws` com `appointment_procedure_id` NULL ou inválido.

### Pitfall 6: Custo médio com divisão por zero
**O que acontece:** Erro de runtime ao registrar entrada quando saldo anterior é 0 (primeiro lote do produto).
**Por que acontece:** Fórmula `(saldo_atual * custo_anterior + qtd_entrada * custo_unitario) / novo_saldo` — quando `novo_saldo = 0` (não pode ocorrer na entrada), mas mais crítico: quando `saldo_atual = 0` e é o primeiro lote.
**Como evitar:** Guard: se `saldo_atual <= 0`, o novo custo médio é simplesmente `custo_unitario` (sem ponderar com custo anterior zero). [VERIFIED: D-02 — fórmula padrão brasileira sempre parte de saldo_atual ≥ 0]
**Sinais de alerta:** `NaN` ou `Infinity` no campo `custo_medio` de um produto.

### Pitfall 7: `nav-config.ts` e `nav-icons.ts` precisam ser atualizados manualmente
**O que acontece:** `/clinica/estoque` não aparece no sidebar.
**Por que acontece:** `NavIconKey` é um union type literal — TypeScript recusa ícone não listado.
**Como evitar:** Adicionar `'estoque'` ao union `NavIconKey` em `nav-config.ts`, importar `Package` (ou `Archive`) de `lucide-react` em `nav-icons.ts`, e adicionar o item em `ALL_NAV_ITEMS`. [VERIFIED: codebase — nav-config.ts e nav-icons.ts confirmam padrão]

### Pitfall 8: `'operacional'` como papel de escrita de estoque
**O que acontece:** Server Action falha se o papel `operacional` não existir no enum de roles.
**Por que acontece:** D-18 menciona "admin/operacional" mas o papel `operacional` pode não estar no enum atual.
**Como evitar:** Verificar `20260614000400_role_expansion.sql` antes de usar `operacional` em RLS. Alternativa segura: usar apenas `admin`/`superadmin` nas políticas de RLS e deixar o acesso operacional para refinamento futuro.

---

## Code Examples

### Schema das 5 Novas Tabelas

```sql
-- [VERIFIED: padrão de colunas confirmado em migrations existentes]
-- products: produto de estoque (rede)
CREATE TABLE public.products (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             UUID         NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name                  TEXT         NOT NULL,
  sku                   TEXT,
  category              TEXT         NOT NULL CHECK (category IN ('insumo', 'medicamento', 'implante')),
  unidade_medida        TEXT         NOT NULL DEFAULT 'un',
  custo_medio           NUMERIC(12,4) NOT NULL DEFAULT 0,
  estoque_minimo        NUMERIC(12,4) NOT NULL DEFAULT 0,
  estoque_maximo        NUMERIC(12,4),
  preferred_supplier_id UUID         REFERENCES public.suppliers(id) ON DELETE SET NULL,
  numero_anvisa         TEXT,  -- ANVISA opcional (obrigatório só para implante na entrada)
  ativo                 BOOLEAN      NOT NULL DEFAULT true,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_clinic ON public.products(clinic_id);
CREATE INDEX idx_products_supplier ON public.products(preferred_supplier_id);
CREATE UNIQUE INDEX idx_products_sku ON public.products(clinic_id, sku) WHERE sku IS NOT NULL;

-- product_batches: lote de um produto em uma unidade
CREATE TABLE public.product_batches (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID         NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id          UUID         NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  product_id       UUID         NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  numero_lote      TEXT         NOT NULL,
  numero_anvisa    TEXT,        -- snapshot do nº ANVISA no momento da entrada
  data_validade    DATE,
  qtd_inicial      NUMERIC(12,4) NOT NULL,
  saldo_disponivel NUMERIC(12,4) NOT NULL,
  custo_unitario   NUMERIC(12,4) NOT NULL,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_batches_clinic   ON public.product_batches(clinic_id);
CREATE INDEX idx_product_batches_unit     ON public.product_batches(unit_id);
CREATE INDEX idx_product_batches_product  ON public.product_batches(product_id);
CREATE INDEX idx_product_batches_validade ON public.product_batches(data_validade) WHERE data_validade IS NOT NULL;

-- stock_entries: entrada de estoque (recebimento)
CREATE TABLE public.stock_entries (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID         NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id          UUID         NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  product_id       UUID         NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id         UUID         REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  supplier_id      UUID         REFERENCES public.suppliers(id) ON DELETE SET NULL,
  qtd              NUMERIC(12,4) NOT NULL,
  custo_unitario   NUMERIC(12,4) NOT NULL,
  custo_medio_apos NUMERIC(12,4) NOT NULL,  -- custo médio após esta entrada
  nota_fiscal      TEXT,
  created_by       UUID         REFERENCES public.users(id),
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_entries_clinic  ON public.stock_entries(clinic_id);
CREATE INDEX idx_stock_entries_unit    ON public.stock_entries(unit_id);
CREATE INDEX idx_stock_entries_product ON public.stock_entries(product_id);

-- stock_draws: baixa de estoque (automática + manual)
CREATE TABLE public.stock_draws (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                UUID         NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id                  UUID         NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  product_id               UUID         NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id                 UUID         REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  appointment_procedure_id UUID         REFERENCES public.appointment_procedures(id) ON DELETE RESTRICT,
  qtd                      NUMERIC(12,4) NOT NULL,
  custo_unitario_snapshot  NUMERIC(12,4) NOT NULL,
  motivo                   TEXT,  -- obrigatório para baixas manuais (D-19)
  tipo                     TEXT NOT NULL DEFAULT 'automatico'
                           CHECK (tipo IN ('automatico', 'manual')),
  created_by               UUID         REFERENCES public.users(id),
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_draws_clinic    ON public.stock_draws(clinic_id);
CREATE INDEX idx_stock_draws_unit      ON public.stock_draws(unit_id);
CREATE INDEX idx_stock_draws_product   ON public.stock_draws(product_id);
CREATE INDEX idx_stock_draws_procedure ON public.stock_draws(appointment_procedure_id);
CREATE INDEX idx_stock_draws_batch     ON public.stock_draws(batch_id);

-- service_material_templates: template de consumo por serviço
CREATE TABLE public.service_material_templates (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID         NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  service_id UUID         NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  product_id UUID         NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qtd_padrao NUMERIC(12,4) NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (service_id, product_id)  -- 1 template por produto por serviço
);
CREATE INDEX idx_smt_clinic   ON public.service_material_templates(clinic_id);
CREATE INDEX idx_smt_service  ON public.service_material_templates(service_id);
CREATE INDEX idx_smt_product  ON public.service_material_templates(product_id);

-- stock_alerts: notificações de mínimo e validade (UI only)
CREATE TABLE public.stock_alerts (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID         NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id    UUID         NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  product_id UUID         NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id   UUID         REFERENCES public.product_batches(id) ON DELETE CASCADE,
  tipo       TEXT         NOT NULL CHECK (tipo IN ('minimo', 'validade')),
  resolvido  BOOLEAN      NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (product_id, unit_id, clinic_id, tipo, DATE(created_at))
);
CREATE INDEX idx_stock_alerts_clinic  ON public.stock_alerts(clinic_id);
CREATE INDEX idx_stock_alerts_unit    ON public.stock_alerts(unit_id);
CREATE INDEX idx_stock_alerts_produto ON public.stock_alerts(product_id);
```

### Agente de compras — seed do ai_agent_config

```sql
-- Seed do novo agente 'stock_replenishment' para clínicas existentes
INSERT INTO public.ai_agent_config (clinic_id, agent_key, autonomy_level, enabled)
SELECT c.id, 'stock_replenishment', 'L2', true
FROM public.clinics c
WHERE c.deleted_at IS NULL
ON CONFLICT (clinic_id, agent_key) WHERE unit_id IS NULL DO NOTHING;
```
[VERIFIED: pattern mirrors 20260614000600_ai_agent_config.sql seed]

### ALTER para adicionar 'estoque_agente' ao CHECK de payables.origem

```sql
ALTER TABLE public.payables DROP CONSTRAINT IF EXISTS payables_origem_check;
ALTER TABLE public.payables ADD CONSTRAINT payables_origem_check
  CHECK (origem IN ('manual', 'recorrente', 'lab', 'repasse', 'tributo', 'estoque_agente'));
```

---

## Integration Points (Mapa de Dependências)

| Tabela/Módulo Existente | Como Phase 17 Usa | FK / Referência |
|------------------------|-------------------|-----------------|
| `appointment_procedures` | Gatilho da baixa automática (D-06) | `stock_draws.appointment_procedure_id` → `appointment_procedures(id)` |
| `suppliers` | Fornecedor preferido do produto (D-04) | `products.preferred_supplier_id` → `suppliers(id)` |
| `services` | FK base para templates de consumo (D-07) | `service_material_templates.service_id` → `services(id)` |
| `payables` | Rascunho de CP do agente L2 (D-15) | INSERT com `origem = 'estoque_agente'` |
| `approval_requests` | Inbox de aprovação do agente (D-15) | INSERT com `type = 'ai_action'`, `agent_key = 'stock_replenishment'` |
| `ai_agent_config` | Configuração L0-L4 do agente de compras | Seed: `agent_key = 'stock_replenishment'`, `autonomy_level = 'L2'` |
| `audit_logs` | Trilha de baixas manuais e ajustes (D-19) | `logBusinessEvent` — ação `stock.draw.manual` |
| `withAgentPolicy` | Governança do agente de compras (D-15) | Import de `@/lib/ai/policy.ts` |
| `isCronAuthorized` | Auth do cron de validade (D-16) | Import de `@/lib/cron-auth.ts` |
| `updateAppointment` | Extensão para chamar baixa de materiais (D-06) | `drawMaterialsForProcedures` chamado dentro do bloco `if (input.status === 'concluido')` |

---

## State of the Art

| Abordagem Antiga | Abordagem Atual no Projeto | Impacto |
|-----------------|--------------------------|---------|
| Triggers PostgreSQL para baixa | Server Action TypeScript (auditável, testável) | Menos gotchas, teste unitário possível |
| Enum PostgreSQL para categorias | TEXT CHECK constraint | Evita ENUM lock (padrão estabelecido no projeto — STATE.md) |
| Cron externo (pg_cron) | Vercel Cron + createAdminClient | Supabase FREE não tem pg_cron; padrão estabelecido com 6 crons |
| Saldo calculado por trigger | Coluna `saldo_disponivel` atualizada na Server Action | Controle explícito, sem magia de trigger |

---

## Assumptions Log

| # | Claim | Section | Risco se Errado |
|---|-------|---------|-----------------|
| A1 | CAS guard para race condition de lote FIFO: UPDATE com AND saldo >= qtd | Architecture Patterns — Pattern 2 | Race condition pode gerar saldo negativo em lote específico; mitigável com re-seleção |
| A2 | O papel `operacional` existe no enum de roles após 20260614000400 | Common Pitfalls — Pitfall 8 | RLS com `operacional` falha silenciosamente se papel não existe no enum |
| A3 | `system user` UUID para `approval_requests.requested_by` (cron não tem sessão) | Code Examples — Pattern 4 | FK violation se UUID não existe em `users` — alternativa: nullable com `DEFAULT NULL` |

---

## Open Questions

1. **O papel `operacional` existe no enum de roles?**
   - O que sabemos: `20260614000400_role_expansion.sql` expandiu os roles, mas não verificamos se `operacional` foi incluído.
   - O que não está claro: Se `operacional` não existe, D-18 precisa usar apenas `admin`/`superadmin` nas políticas de RLS.
   - Recomendação: Verificar o arquivo de migration 20260614000400 antes de planejar as políticas RLS de estoque. Se não existir, usar apenas `admin`/`superadmin`.

2. **`approval_requests.requested_by` é NOT NULL — como o agente cron preenche?**
   - O que sabemos: A coluna é `NOT NULL REFERENCES public.users(id)`. Crons não têm sessão de usuário.
   - O que não está claro: O padrão estabelecido (collection-agent, confirmation-agent) não cria `approval_requests` — apenas `agent_outreach_log`. Esta é a primeira vez que um agente cron precisa criar um `approval_request`.
   - Recomendação: Opção A — tornar `requested_by` nullable (ALTER TABLE) com comentário "NULL = system"; Opção B — criar um usuário de sistema `system@fynxia` como ator fixo. Decidir no Plan 01 (migration).

3. **`appointment_procedures` tem `unit_id`?**
   - O que sabemos: A migration 20260620000200 não mostra `unit_id` em `appointment_procedures`. A tabela `appointments` tem `unit_id` (adicionado via `20260614000700`).
   - O que não está claro: Para a baixa de estoque por unidade (D-23), `stock_draws.unit_id` precisa ser resolvido. Se `appointment_procedures` não tiver `unit_id`, precisa ser resolvido via JOIN com `appointments`.
   - Recomendação: Resolver `unit_id` via `appointments JOIN appointment_procedures` — `appointments.unit_id` é o que define em qual unidade o atendimento ocorreu.

---

## Environment Availability

Step 2.6: SKIPPED para dependências externas — todos os serviços são internos ao projeto (Supabase + Vercel). Nenhuma nova dependência externa é introduzida nesta fase.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (já configurado no projeto) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EST-01 | Custo médio móvel calculado corretamente | unit | `npx vitest run src/actions/stock-entries.test.ts` | ❌ Wave 0 |
| EST-01 | Validação Zod por categoria (implante exige ANVISA) | unit | `npx vitest run src/lib/validators/product.test.ts` | ❌ Wave 0 |
| EST-02 | FIFO batch selection retorna lote mais antigo | unit | `npx vitest run src/actions/stock-draws.test.ts` | ❌ Wave 0 |
| EST-02 | Baixa automática não bloqueia procedimento (saldo negativo permitido) | unit | `npx vitest run src/actions/stock-draws.test.ts` | ❌ Wave 0 |
| EST-03 | Agente retorna `_policy` sentinel quando preferred_supplier_id ausente | unit | `npx vitest run src/lib/agents/stock-agent.test.ts` | ❌ Wave 0 |
| EST-03 | Cron de validade insere alerta corretamente (idempotente) | unit | `npx vitest run src/app/api/cron/estoque-validade.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Por commit de task:** `npx vitest run src/actions/stock-draws.test.ts src/actions/stock-entries.test.ts`
- **Por wave merge:** `npx vitest run`
- **Phase gate:** Suite completa verde antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/validators/product.ts` — schema Zod v3 para produto + lote + entrada
- [ ] `src/lib/validators/product.test.ts` — testa validação diferenciada por categoria
- [ ] `src/actions/stock-entries.test.ts` — testa custo médio móvel (inclui edge cases: divisão por zero, primeiro lote)
- [ ] `src/actions/stock-draws.test.ts` — testa FIFO, saldo negativo, audit trail
- [ ] `src/lib/agents/stock-agent.test.ts` — testa withAgentPolicy sentinel + criação de CP
- [ ] `src/app/api/cron/estoque-validade.test.ts` — testa seleção de lotes próximos do vencimento

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | sim | `getActor()` pattern em todas as Server Actions |
| V3 Session Management | sim | `@supabase/ssr` HTTP-only cookies (já configurado) |
| V4 Access Control | sim | RLS USING+WITH CHECK; `get_my_tenant_id()` + role gate em Server Actions |
| V5 Input Validation | sim | Zod v3 schemas antes de qualquer operação de banco |
| V6 Cryptography | não | Nenhuma criptografia nova necessária (produtos não são PII de saúde) |

### Known Threat Patterns

| Pattern | STRIDE | Mitigação Padrão |
|---------|--------|-----------------|
| Cross-tenant stock read | Information Disclosure | RLS `USING (clinic_id = get_my_tenant_id())` em todas as novas tabelas |
| Alteração de saldo sem auditoria | Tampering | `logBusinessEvent` obrigatório em baixas manuais; `createAdminClient` em crons explícito |
| Agente criando CP sem aprovação humana | Elevation of Privilege | `withAgentPolicy` L2 → `pending_approval`; `approval_requests` obrigatório antes de executar |
| Injeção via `numero_lote` / `numero_anvisa` | Injection | Zod `.max(100)` + Supabase parameterized queries (padrão do projeto) |
| Race condition em FIFO de lotes | Tampering | CAS-style UPDATE com `AND saldo_disponivel >= qtd RETURNING id` |
| Acesso a `stock_draws` sem autenticação | Spoofing | `stock_draws` escrita SOMENTE via `createAdminClient` em Server Action server-side |

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260620000200_faturamento_os_tables.sql` — schema de `appointment_procedures` confirmado + comentário "future Phase 17 stock draw"
- `supabase/migrations/20260621000100_payables_tables.sql` — schema de `suppliers` e `payables` confirmado, incluindo o CHECK constraint de `origem`
- `src/lib/ai/policy.ts` — implementação completa de `withAgentPolicy` verificada
- `src/lib/ai/policy-types.ts` — matriz L0-L4 × sensitivity verificada
- `src/lib/audit.ts` — `logBusinessEvent` verificado
- `src/lib/cron-auth.ts` — `isCronAuthorized` verificado
- `src/app/api/cron/recorrente/route.ts` — padrão de cron verificado
- `src/actions/appointments.ts` — padrão de integração try/catch na conclusão verificado
- `src/actions/suppliers.ts` — padrão CRUD de fornecedor verificado
- `src/components/shell/nav-config.ts` + `nav-icons.ts` — padrão de adição ao sidebar verificado
- `vercel.json` — configuração de crons existentes verificada

### Secondary (MEDIUM confidence)
- `src/lib/agents/collection-agent.ts` — padrão de agente com `withAgentPolicy` per-row verificado; usado como modelo para o agente de compras
- `supabase/migrations/20260616000200_approval_requests.sql` — schema de `approval_requests` verificado; schema de `requested_by NOT NULL` é o ponto de Open Question 2

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — todo o stack é reutilizado de código existente verificado no codebase
- Architecture: HIGH — padrões todos derivados de código existente verificado
- Schema das tabelas: HIGH — segue padrões NUMERIC/índice/RLS verificados em migrations existentes
- Pitfalls: HIGH — todos derivados de erros ou decisões explícitas documentadas no STATE.md
- Agente de compras: MEDIUM — o padrão existe mas `approval_requests.requested_by NOT NULL` para cron é uma Open Question não resolvida

**Research date:** 2026-06-30
**Valid until:** 2026-07-30 (stack estável; válido por 30 dias)
