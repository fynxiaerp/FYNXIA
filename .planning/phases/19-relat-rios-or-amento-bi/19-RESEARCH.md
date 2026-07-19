# Phase 19: Relatórios, Orçamento & BI - Research

**Researched:** 2026-07-19
**Domain:** Managerial reporting (DRE), budgeting, partner profit-sharing, and BI/forecasting inside an existing multi-tenant Next.js/Supabase ERP
**Confidence:** HIGH (stack/patterns — all verified against actual migrations and source in this repo) / MEDIUM (threshold defaults, forecasting algorithm choice — reasonable defaults, not externally mandated)

## Summary

This phase adds zero new external dependencies. Every capability it needs — PDF export, LLM narrative generation, cron jobs, AI governance/approval, RLS conventions, vigência (temporal) tables — already has a working, shippable precedent elsewhere in this codebase from Phases 3, 10, 14, 16, 17, and 18. The job of this phase is almost entirely **composition**: new tables that follow existing conventions exactly, new read-time aggregation queries that extend an existing query pattern (`listTransactions` in `src/actions/transactions.ts`), a new agent that is a structural copy of `stock-agent.ts`, and a new cron route that is a structural copy of `estoque-validade`/`nps-scan`.

The single most important correction to CONTEXT.md's assumptions: the "vigência pattern used in Fase 16 TRIB-01" referenced in D-20 does **not** literally exist as a date-range table for commission rules (those are a JSONB array with no dates, and `professional_payouts` just snapshots the percentual applied at calculation time). The **actual** reusable vigência pattern in this codebase is `inss_tax_tables`/`irrf_tax_tables`/`iss_tax_tables` (TRIB-02/TRIB-03, `20260621000400_tax_tables.sql`): `vigencia_inicio DATE NOT NULL, vigencia_fim DATE` (NULL = current), queried with `WHERE vigencia_inicio <= :data AND (vigencia_fim IS NULL OR vigencia_fim >= :data)`. This is the exact pattern `partner_shares` must replicate for D-20.

Second important finding: RBAC route gating (`src/proxy.ts`) already has an empty scaffold at `src/app/(dashboard)/bi/.gitkeep` with a **top-level** `/bi` route (not `/clinica/bi`) and a fully wired `ModuleKey: 'bi'` with `admin`/`superadmin` full access and `socio`/`auditor`/`dpo` read-only access — this was pre-provisioned in Phase 7 specifically for this phase. However, `financeiro` and the future `orcamento`/`relatorios`/`societario` screens have **no** existing module scaffolding, and critically, **`socio` is globally `readOnly: true` on the `financeiro` module** — which conflicts with D-14 ("Sócio pode cadastrar/editar metas orçamentárias"). New `ModuleKey` entries are required (see Pitfall 1).

Third: `financial_transactions` has **no `unit_id` column** — unit scoping only works by joining through `cost_center_id → cost_centers.unit_id`, and `cost_center_id` is nullable. The existing `listTransactions()` function already implements exactly this unit→cost-center-ids resolution and is the pattern to replicate for DRE per-unit/consolidated aggregation.

**Primary recommendation:** Build DRE/Orçamento/BI as pure read-time SQL aggregations over `financial_transactions` joined to `chart_of_accounts`/`cost_centers` (no new charting library, no new stats library, no new PDF library) — 4 new tables (`budget_targets`, `partner_shares`, `kpi_targets`, `bi_alerts`), one new cron route, one new L1/L2 agent module, and 4 new `ModuleKey` route-permission entries.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REP-01 | Gestão visualiza DRE gerencial por unidade em um período | `chart_of_accounts`/`cost_centers` (Fase 14) confirmed schema; `listTransactions()` unit→cost-center resolution pattern to replicate; read-time aggregation (no snapshot) per D-10 |
| REP-02 | Orçado × realizado com desvios por período | New `budget_targets` table (account+unit+month grain, mirrors `chart_of_accounts` FK style); semaphore thresholds recommended below |
| REP-03 | Distribuição de lucro por cota societária | New `partner_shares` table using the verified `tax_tables` vigência pattern; RLS self-row pattern for `socio` (auth.uid() match) |
| BI-01 | KPIs por dimensão (tempo/unidade/profissional) com meta × realizado | Data sources confirmed: `nps_responses`/`campaigns`/`leads` (Fase 18), `stock_alerts` (Fase 17), `tiss_guide_items.valor_glosado` (Fase 15), `receivables`/`payable_installments` overdue derivation (Fase 3/16 pattern); new `kpi_targets` table |
| BI-02 | Previsões/alertas gerados por IA | `withAgentPolicy`/`approval_requests` (Fase 10) confirmed reusable as-is; `generateText` + Vercel AI Gateway pattern confirmed in `collection-agent.ts`; cron pattern confirmed in `estoque-validade`/`nps-scan` routes; forecasting algorithm recommendation below (hand-rolled linear regression, no new package) |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**DRE gerencial (D-01 a D-11)**
- D-01: DRE simples: Receita − Despesa = Resultado + Margem (como já está no protótipo `biKpis()`). Não é uma DRE formal com subtotais. Usa `chart_of_accounts.type` (`grupo`/`receita`/`despesa`) já existente da Fase 14.
- D-02: Seletor de período: mês/ano (padrão) + intervalo de datas customizado livre.
- D-03: Seletor de unidade: "Todas" (consolidado) + drill-down por unidade individual.
- D-04: Quando "Todas" selecionado: DRE única somada + tabela comparativa/ranking por unidade (mesmo padrão visual do protótipo Dashboard de Franquias).
- D-05: Drill-down até lançamento: cada linha/grupo é clicável e abre os `financial_transactions` subjacentes (filtrados por `account_id` + período + unidade).
- D-06: Cada linha também é expansível por centro de custo dentro da unidade (`cost_centers`, Fase 14).
- D-07: Export PDF sob demanda (`@react-pdf/renderer`, mesmo padrão do relatório ANVISA/recibos já existentes).
- D-08: Cada linha exibe coluna de % sobre a receita total do período (análise vertical de DRE).
- D-09: Acesso: Admin + Sócio + Superadmin apenas (dados financeiros sensíveis).
- D-10: DRE sempre recalculada em tempo real a partir de `financial_transactions` — sem snapshot/fechamento mensal.
- D-11: Comparação YoY (mesmo período do ano anterior) quando houver ≥12 meses de histórico; antes disso, "comparação indisponível" sem quebrar a tela.

**Orçamento (D-12 a D-19)**
- D-12: Meta cadastrada por conta contábil (`chart_of_accounts`) + unidade — mesma granularidade da DRE.
- D-13: Cadastro anual com 12 valores mensais editáveis.
- D-14: Quem cadastra/edita metas: Admin + Sócio + Superadmin.
- D-15: Desvios destacados por semáforo de faixa de % (verde/amarelo/vermelho). Thresholds: Claude's Discretion.
- D-16: Tela separada da DRE, com link cruzado.
- D-17: Botão "Copiar do ano anterior" ao criar orçamento de um novo ano.
- D-18: Meses passados (com resultado já realizado) ficam travados/não editáveis após o mês fechar. Mês atual e futuros permanecem editáveis.
- D-19: Export PDF disponível.

**Cotas societárias / Distribuição de lucro (D-20 a D-27)**
- D-20: Percentual por sócio com vigência/histórico (data início/fim) — mesmo padrão de vigência usado no repasse de profissionais (Fase 16, TRIB-01).
- D-21: Base de cálculo: sempre consolidado — resultado da rede inteira.
- D-22: Validação bloqueante: soma dos percentuais vigentes deve ser exatamente 100% para salvar/ativar uma nova vigência.
- D-23: Tela mostra R$ calculado por sócio (percentual × resultado do período), não apenas percentual abstrato.
- D-24: Visão: Admin + Superadmin veem a distribuição completa; cada Sócio vê apenas a própria cota.
- D-25: Um "sócio" cadastrado deve ser um `users` existente com role='socio' (já existe desde Fase 7/ROLE-01).
- D-26: Puramente informativa — não gera lançamento financeiro automático.
- D-27: Se o resultado do período for negativo (prejuízo), mostra valores negativos por sócio — não oculta nem zera.

**BI & Previsões de IA (D-28 a D-40)**
- D-28: Escopo confirmado intra-tenant.
- D-29: KPIs: Operacionais (ocupação, ticket médio, consultas/mês), Produtividade por profissional, CRC/Marketing (NPS, ROI CPL/CAC, conversão de leads), Estoque/Compliance (alertas mínimo, glosa TISS, atrasos de pagamento/faturamento).
- D-30: KPIs operacionais/CRC/estoque têm metas próprias (tabela separada).
- D-31: Previsão: extrapolação estatística (tendência linear/média móvel) calcula o número; narrativa em texto gerada por LLM explica/contextualiza.
- D-32: Janela: últimos 12 meses ou todo histórico se <12. Mínimo 3 meses exigido antes de exibir previsão/alerta de tendência.
- D-33: Gatilhos de alerta: (a) desvio orçamentário > threshold; (b) queda de receita/margem vs tendência; (c) KPI operacional fora da meta; (d) atrasos de pagamento/faturamento.
- D-34: Autonomia L1/L2: agente sugere ajuste de meta orçamentária → `ApprovalInbox`. Nunca toca lançamentos financeiros ou cotas societárias diretamente.
- D-35: Alertas informativos ficam em seção "Alertas & Previsões"; só ação concreta gera entrada no `ApprovalInbox`.
- D-36: Cálculo roda via cron diário/noturno; painel apenas lê resultado já calculado.
- D-37: Componentes de gráfico do protótipo (`charts.tsx`) NÃO são reaproveitados — produção constrói componentes novos fora do namespace `prototipos/`.
- D-38: Layout: abas por dimensão (Operacional | Profissionais | CRC | Estoque/TISS); "Alertas & Previsões" fixa no topo.
- D-39: Acesso: mesmas permissões da DRE — Admin + Sócio + Superadmin.
- D-40: Export PDF disponível também para Orçamento e BI.

**Navegação (D-41 a D-42)**
- D-41: Módulos separados no menu: Relatórios (DRE), Orçamento, Societário (cotas), BI.
- D-42: Páginas de protótipo (`/clinica/prototipos/relatorios`, `dashboard-franquias`) devem ser removidas quando as telas reais forem entregues.

### Claude's Discretion
- Nomes/colunas/índices exatos das novas tabelas (`partner_shares`, `budget_targets`, `kpi_targets`, `bi_alerts`/`bi_forecasts`), seguindo padrões da base.
- Thresholds exatos do semáforo de desvio orçamentário — fixos ou configuráveis por admin.
- Threshold exato de "queda vs tendência histórica" para disparar alerta.
- Algoritmo exato de regressão/tendência (linear simples vs média móvel ponderada).
- Estrutura de rotas exatas dentro de cada módulo.
- Layout/componentização fina das telas → via `/gsd-ui-phase` (UI hint = yes).

### Deferred Ideas (OUT OF SCOPE)
- DRE formal com subtotais (Receita Bruta → Deduções → EBITDA).
- Cotas societárias por unidade (em vez de sempre consolidado).
- Lançamento financeiro automático da distribuição de lucro + retenção fiscal (IRRF).
- Cadastro de sócio sem login (investidor externo passivo).
- Vista de BI restrita para dentista (autoavaliação).
- Ação de agente de BI mais ampla (além de sugerir ajuste de meta).
- Snapshot/fechamento mensal formal da DRE.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- Stack is locked: Next.js + TypeScript + Supabase + Vercel — do not introduce alternative frameworks. (Repo is actually on Next.js 16.2.7 / React 19.2.4 already, ahead of the "14" in CLAUDE.md's own text — this is a pre-existing, already-accepted drift documented in STATE.md; not a decision for this phase.)
- `@react-pdf/renderer` for all PDF export; Flexbox only, no CSS Grid; Node.js runtime required (not Edge).
- RLS: every new table needs `USING` **and** `WITH CHECK`; index every `clinic_id` (+ `unit_id` where applicable).
- `NUMERIC(12,2)` for money columns.
- Never use service role key client-side; `withAgentPolicy` gate for all AI agent actions; every AI decision logged.
- No `getServerSideProps`/Pages Router; Server Actions + Server Components only.
- Supabase migrations only via `supabase/migrations/` + `supabase db push` — never via dashboard.

## Standard Stack

### Core (already installed — zero new dependencies required)

| Library | Installed Version | Purpose in this phase | Why no change needed |
|---------|-------|---------|--------------|
| `@react-pdf/renderer` | ^4.5.1 | DRE/Orçamento/BI PDF export | Verified pattern already in `ReceiboPDF.tsx`, `anvisa-pdf/route.ts` — Flexbox-only styling, Roboto font registration, Node runtime |
| `ai` + `@ai-sdk/gateway` | ^6.0.200 / ^3.0.127 | LLM narrative for BI alerts (D-31) | Verified pattern in `collection-agent.ts` (`generateText`, model `'anthropic/claude-sonnet-4.6'`, `AI_GATEWAY_API_KEY` presence check with static fallback) |
| `date-fns` + `date-fns-tz` | ^4.4.0 / ^3.2.0 | Period math (month ranges, YoY comparison, `America/Sao_Paulo` day bounds) | Already used throughout `financeiro`/`estoque`/`crc` actions |
| `zod` | ^3.25.76 (pinned v3 — do not upgrade) | Budget target / partner share / KPI target form validation | Matches `D-133` convention: no `.default()` in schemas (RHF v7 + resolvers v5 type mismatch) |
| `@tanstack/react-table` v8 + `nuqs` | ^8.21.3 / ^2.8.9 | DRE/Orçamento tables, URL-persisted period/unit filters | Standard convention across `financeiro`/`estoque`/`crc` list pages |
| `zustand` | ^5.0.14 | Any transient BI tab/selection UI state | Not for server data (TanStack Query pattern not adopted yet elsewhere in this codebase — most pages use Server Components + Server Actions directly, no `@tanstack/react-query` runtime usage found for data fetching) |

**No charting library needed.** [VERIFIED: `package.json` has no `recharts`/`d3`/`visx`/`chart.js`]. All existing chart-like UI (`src/components/prototipos/charts.tsx`: `KpiCard`, `ChartCard`, `LineChart`, `BarChart`, `DonutChart`) is dependency-free pure SVG/CSS on Tailwind design tokens. **Important, D-37-relevant fact:** production code (`/clinica/financeiro/faturamento/convenios/page.tsx`, `.../nfse/page.tsx`) already imports `DonutChart`/`ChartCard` directly from `@/components/prototipos/charts` today [VERIFIED: grep]. D-37 is a **deliberate exception for this phase only** — new BI/DRE chart primitives must be copied into a new namespace (e.g. `src/components/charts/` or `src/components/bi/charts.tsx`), not imported from `prototipos/`. Recommend keeping the same pure-SVG technique (proven, zero bundle cost, themeable) rather than introducing `recharts` (not installed; `npm view recharts version` → 3.9.2 available but adding it is unnecessary scope).

**No statistics/regression library needed.** [VERIFIED: `package.json` has no `simple-statistics`/`regression`/etc.] For ≤12 monthly data points, ordinary least-squares linear regression is ~15 lines of vanilla TypeScript (see Code Examples). Adding a package for this is unjustified scope — this is one of the rare cases where hand-rolling is the correct call (see Don't Hand-Roll below for the boundary of this exception).

### Installation
No `npm install` required for this phase.

## Architecture Patterns

### Recommended Project Structure
```
src/app/(dashboard)/clinica/relatorios/page.tsx        # DRE (REP-01)
src/app/(dashboard)/clinica/orcamento/page.tsx          # Orçamento (REP-02)
src/app/(dashboard)/clinica/societario/page.tsx         # Cotas (REP-03)
src/app/(dashboard)/bi/page.tsx                         # BI dashboard (BI-01/02) — NOTE: top-level /bi, not /clinica/bi (see Pitfall 1)
src/app/api/relatorios/dre-pdf/route.ts                 # PDF export (mirrors anvisa-pdf/route.ts)
src/app/api/orcamento/pdf/route.ts
src/app/api/bi/pdf/route.ts
src/app/api/cron/bi-previsoes/route.ts                  # nightly forecast/alert cron (mirrors estoque-validade)
src/actions/dre.ts                                      # DRE read-time aggregation Server Actions
src/actions/budget-targets.ts
src/actions/partner-shares.ts
src/actions/kpi-targets.ts
src/lib/financeiro/dre-math.ts                          # pure aggregation functions (testable, no I/O)
src/lib/bi/forecast-math.ts                             # pure linear-regression/moving-average functions
src/lib/agents/bi-forecast-agent.ts                     # L1/L2 agent — mirrors stock-agent.ts
src/components/charts/ (or src/components/bi/charts.tsx) # new, non-prototipos chart primitives (D-37)
supabase/migrations/2026XXXX_bi_tables.sql               # budget_targets, partner_shares, kpi_targets, bi_alerts
supabase/migrations/2026XXXX_bi_rls.sql
```

### Route structure recommendation (Discretion item #5)

`/clinica/relatorios`, `/clinica/orcamento`, `/clinica/societario` follow the existing nested-under-`/clinica` convention (mirrors `/clinica/estoque`, `/clinica/crc`, `/clinica/financeiro`). `/bi` is the **exception**: Phase 7 already pre-provisioned an empty scaffold directory `src/app/(dashboard)/bi/.gitkeep` with a fully wired `ModuleKey: 'bi'` in `src/proxy.ts` mapped to the **top-level** prefix `/bi` (not `/clinica/bi`). Building BI at `/clinica/bi` would leave that scaffold orphaned and require adding a *new* `ModuleKey`/`ROUTE_MODULE_MAP` entry redundant with the one already there. **Recommendation: build BI at `/bi`, matching the existing pre-wired scaffold.** This does not contradict D-41 ("módulos separados no menu") — it's still a separate top-level menu entry, just not nested under `/clinica`.

### RBAC: new ModuleKey entries required (Pitfall 1 — see below for full detail)

`src/proxy.ts` `MODULE_PERMISSIONS` currently has no entries for `relatorios`, `orcamento`, or `societario`. Required additions to the `ModuleKey` union and matrix:

```typescript
type ModuleKey = /* ...existing... */ | 'relatorios' | 'orcamento' | 'societario'

// relatorios (DRE) — D-09: Admin + Sócio (read-only) + Superadmin
admin:      { ...existing, relatorios: {allowed:true} },
superadmin: { ...existing, relatorios: {allowed:true} },
socio:      { ...existing, relatorios: {allowed:true, readOnly:true} },

// orcamento — D-14: Admin + Sócio (WRITE) + Superadmin — socio must NOT be readOnly here
admin:      { ...existing, orcamento: {allowed:true} },
superadmin: { ...existing, orcamento: {allowed:true} },
socio:      { ...existing, orcamento: {allowed:true} },   // NOT readOnly — conflicts with existing `financeiro` socio:readOnly if reused

// societario — D-24: Admin/Superadmin full; Sócio sees only own row (app-layer + RLS, not module-level)
admin:      { ...existing, societario: {allowed:true} },
superadmin: { ...existing, societario: {allowed:true} },
socio:      { ...existing, societario: {allowed:true, readOnly:true} },   // write-own-row handled by RLS self-match, not module readOnly
```

And in `ROUTE_MODULE_MAP` (most-specific-first, mirrors the existing `documentos`/`financeiro`/`receituario` pattern):
```typescript
{ prefix: '/clinica/relatorios', module: 'relatorios' },
{ prefix: '/clinica/orcamento',  module: 'orcamento'  },
{ prefix: '/clinica/societario', module: 'societario' },
// ...existing /clinica/financeiro entry stays as-is...
{ prefix: '/clinica',            module: 'clinica'    },
```

### Pattern 1: Read-time DRE aggregation (D-10) — extends `listTransactions()`

**What:** `src/actions/transactions.ts::listTransactions()` already implements exactly the unit→cost-center resolution DRE needs: when a `unitId` filter is given, it queries `cost_centers WHERE unit_id = X` for the list of `cost_center_id`s, then filters `financial_transactions.cost_center_id IN (...)`. **`financial_transactions` has no direct `unit_id` column** — this indirection is mandatory, not optional.

**When to use:** Any DRE/Orçamento aggregation that must scope to a specific unit or "todas as unidades" (consolidated = no cost-center filter at all, includes transactions with `cost_center_id IS NULL`).

**Example (verified from `src/actions/transactions.ts:159-219`):**
```typescript
// Source: src/actions/transactions.ts (existing, verified code)
let costCenterIds: string[] | null = null
if (opts?.unitId) {
  const { data: ccs } = await supabase
    .from('cost_centers')
    .select('id')
    .eq('unit_id', opts.unitId)
  costCenterIds = (ccs ?? []).map((cc: { id: string }) => cc.id)
}

let query = supabase
  .from('financial_transactions')
  .select(`id, type, amount, transaction_date, account_id, cost_center_id, chart_of_accounts(name, type, parent_id)`)
  .gte('transaction_date', from)
  .lte('transaction_date', to)

if (costCenterIds !== null) {
  if (costCenterIds.length === 0) return { success: true, transactions: [], totals: { entradas: 0, saidas: 0, saldo: 0 } }
  query = query.in('cost_center_id', costCenterIds)
}
```

DRE aggregation logic (group by `account_id`/`chart_of_accounts.type`, sum `amount` by `receita`/`despesa`, compute `% da receita total` per D-08) should be a **pure function** in `src/lib/financeiro/dre-math.ts` — mirrors the existing `payout-math.ts` / `roi-math.ts` convention (pure, no I/O, directly unit-testable).

### Pattern 2: Vigência (temporal validity) table — for `partner_shares` (D-20)

**What:** The actually-implemented vigência pattern in this codebase is `inss_tax_tables`/`irrf_tax_tables`/`iss_tax_tables` (`20260621000400_tax_tables.sql`, TRIB-02/03) — **not** `professional_payouts` (which only snapshots a percentual per calculation, no date-range table exists for commission rules). Corrected reference for D-20.

**When to use:** `partner_shares` needs exactly this shape: query "which percentual was valid on date X" for historical distributions, while allowing new vigências to be created without mutating history.

**Example (verified from `supabase/migrations/20260621000400_tax_tables.sql`):**
```sql
-- Source: supabase/migrations/20260621000400_tax_tables.sql (existing, verified pattern)
CREATE TABLE public.partner_shares (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id         UUID          NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  percentual      NUMERIC(5,4)  NOT NULL CHECK (percentual > 0 AND percentual <= 1),
  vigencia_inicio DATE          NOT NULL,
  vigencia_fim    DATE,                          -- NULL = vigente
  created_by      UUID          REFERENCES public.users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_partner_shares_clinic    ON public.partner_shares(clinic_id);
CREATE INDEX idx_partner_shares_vigencia  ON public.partner_shares(clinic_id, vigencia_inicio, vigencia_fim);

-- Query pattern for "percentuais vigentes em :data" (D-21/D-22/D-23):
-- WHERE clinic_id = :clinic AND vigencia_inicio <= :data AND (vigencia_fim IS NULL OR vigencia_fim >= :data)
```

D-22's "soma deve ser exatamente 100%" validation cannot be a single-row CHECK constraint (it's a set-aggregate across all `socio` rows active on a given date) — enforce in the Server Action at vigência-creation time: sum all `percentual` for rows with `vigencia_fim IS NULL` (or overlapping the new vigência's start date) including the new row being inserted, reject if ≠ 1.0000. This mirrors how `professional_payouts.percentual` validation and `competencia_fechamentos` closure checks are done in application code, not as DB constraints.

### Pattern 3: RLS self-row visibility — for `socio` seeing only their own quota (D-24)

No existing table in this codebase does "authenticated user sees only their own row via `auth.uid()` match" for a business table (the closest analog, `professionals.user_id`, has no such RLS policy — professionals are visible to all tenant staff). This is a new pattern, but composes trivially from existing primitives (`get_my_tenant_id()`, `get_my_role()`, `auth.uid()` are all already `SECURITY DEFINER` functions):

```sql
-- New pattern, composed from existing verified primitives
CREATE POLICY "partner_shares_tenant_read" ON public.partner_shares
  FOR SELECT USING (
    clinic_id = get_my_tenant_id()
    AND (
      get_my_role() IN ('admin', 'superadmin')
      OR (get_my_role() = 'socio' AND user_id = auth.uid())
    )
  );

CREATE POLICY "partner_shares_admin_write" ON public.partner_shares
  FOR ALL
  USING (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin', 'superadmin'))
  WITH CHECK (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin', 'superadmin'));
```

Note D-24 only restricts **read** scope per-socio; write (creating/editing vigências) stays admin/superadmin-only per D-20's phrasing ("Percentual por sócio com vigência" is administered, not self-service) — confirm this reading with the planner/UI-spec step, but nothing in CONTEXT.md grants sócio write access to their own share row.

### Pattern 4: L1/L2 agent with ApprovalInbox — for the BI forecasting agent (D-34)

**What:** `src/lib/agents/stock-agent.ts::runStockReplenishmentAgent()` is the direct, complete template: calls `withAgentPolicy({ clinicId, agentKey, actorId: null, action, actionSensitivity: 'reversible' }, async () => {...})`, and inside the callback, creates a draft row (there: `payables`; for BI: an **update suggestion**, not a new row — see below) + an `approval_requests` row with `type: 'ai_action'`, `agent_key`, `required_role`, `requested_by: null` (system actor), `payload` containing enough context to apply the change on approval.

**Key divergence from stock-agent for D-34:** the BI agent's approvable action is "change an existing `budget_targets.valor` for month M" — not "create a new payable." The `approval_requests.payload` should carry `{ budget_target_id, month, current_value, suggested_value, reason }`, and the **approve** handler (extending `src/actions/approval-actions.ts`, mirrors how `campaigns` approvals wire through `approveCampaignAndDispatch` instead of the generic `approveRequest`) must apply the UPDATE to `budget_targets` on approval — never before.

```typescript
// Source: src/lib/agents/stock-agent.ts (existing, verified pattern) — template for bi-forecast-agent.ts
await withAgentPolicy(
  { clinicId, agentKey: 'bi_forecast', actorId: null, action: 'agent.bi.suggest_budget_adjustment', actionSensitivity: 'reversible' },
  async () => {
    const { data: approval } = await admin.from('approval_requests').insert({
      clinic_id: clinicId,
      type: 'ai_action',
      agent_key: 'bi_forecast',
      payload: { budget_target_id, month, current_value, suggested_value, reason },
      required_role: 'admin',
      requested_by: null,
      status: 'pending',
    }).select('id').single()
    // ... insert bi_alerts row referencing approval.id for D-35 "concrete action" alerts
  },
)
```

`ai_agent_config` needs a new seeded row for `agent_key = 'bi_forecast'` (mirrors `stock_replenishment`/`crc-campaign` seeding) so `withAgentPolicy` has an autonomy level to read; default to **L1** (suggest-only) unless the roadmap/CONTEXT specifies L2 — CONTEXT.md D-34 says "sugere," consistent with L1/suggest, and the approval-required framing is itself the L2 gate (an L2 agent auto-executes reversible actions; here even a "budget suggestion" always requires approval per D-34/D-35's own wording, so the config should likely force `pending_approval` regardless of level — verify against `computePolicyDecision` matrix in `src/lib/ai/policy-types.ts` during planning).

### Pattern 5: Cron route — for `/api/cron/bi-previsoes` (D-36)

**What:** `src/app/api/cron/estoque-validade/route.ts` and `nps-scan/route.ts` are near-identical templates: `export const runtime = 'nodejs'`, `isCronAuthorized(request.headers.get('authorization'))` fail-closed 401 check, `createAdminClient()` (service role — no RLS session for a cron actor), loop over target rows calling the agent/insert function per-row (never at aggregate/null-tenant level — required by `withAgentPolicy`'s per-row `clinicId` contract), try/catch per iteration so one failure doesn't abort the batch.

**Registration:** add to `vercel.json` `crons` array — e.g. `{ "path": "/api/cron/bi-previsoes", "schedule": "0 4 * * *" }` (pick a time that doesn't collide with existing crons at 05:00/06:00/07:00/08:00/11:00/12:00/13:00/23:00 UTC — 04:00 UTC is free).

```typescript
// Source: src/app/api/cron/estoque-validade/route.ts (existing, verified pattern)
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return new Response('Unauthorized', { status: 401 })
  }
  const admin = createAdminClient()
  // for each clinic (or each clinic × KPI dimension):
  //   compute trend (forecast-math.ts) per-tenant, real clinicId — never aggregate
  //   if trend/deviation crosses threshold → insert bi_alerts row
  //   if actionable (budget deviation persistent) → call bi-forecast-agent (Pattern 4)
  return Response.json({ ok: true, alertas_criados: n })
}
```

### Pattern 6: PDF export — for DRE/Orçamento/BI (D-07/D-19/D-40)

Confirmed identical pattern across `ReceiboPDF.tsx` (receipts, Phase 3) and `AnvisaReportPdf` (`anvisa-pdf/route.ts`, Phase 17): `Font.register` with Roboto woff2 (Latin Extended support for ã/ç/ê/õ), `StyleSheet.create` with **Flexbox only** (no CSS Grid — unsupported), A4 page with 40pt/48pt margins, route handler with `export const runtime = 'nodejs'`, auth via `supabase.auth.getUser()` + `users.tenant_id` lookup, `renderToBuffer()` → `Uint8Array` → `Response` with `Content-Type: application/pdf`, `Cache-Control: no-store` (financial/PII data must never be cached).

```typescript
// Source: src/app/api/estoque/anvisa-pdf/route.ts (existing, verified pattern)
export const runtime = 'nodejs'
export const maxDuration = 30
const buffer = await renderToBuffer(createElement(DrePdf, { clinicName, periodoLabel, rows }) as ReactElement<DocumentProps>)
return new Response(new Uint8Array(buffer), {
  status: 200,
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename="dre.pdf"',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  },
})
```

### Anti-Patterns to Avoid
- **Adding a new `unit_id` column to `financial_transactions`:** it doesn't have one and it doesn't need one — all unit scoping goes through `cost_center_id`. Adding a redundant column risks drift between the two.
- **Reusing `financeiro` ModuleKey for `orcamento`:** breaks D-14 (sócio needs write access to budget targets, but `socio.financeiro` is globally `readOnly: true`).
- **Encoding D-22's "sum = 100%" as a DB CHECK constraint:** it's a cross-row aggregate condition, not expressible as a single-row CHECK; must be a Server Action-time validation (transaction-wrapped read-then-validate-then-write).
- **Recalculating DRE inside a client-side `useEffect`:** D-10 requires read-time-on-the-server aggregation (Server Component/Server Action), not client-side recomputation from raw rows (LGPD: financial rows should not be shipped to the client unaggregated beyond what's needed for drill-down).
- **Calling `withAgentPolicy` at a run/batch level with an aggregate or null `clinicId`:** violates the established per-row-inside-the-loop convention (`ai_decision_log.clinic_id` is `NOT NULL`); mirrors the exact Pitfall 3 documented in 17-RESEARCH.md and re-verified in `stock-agent.ts`'s own comments.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AI governance / approval gating for the BI forecast agent | A new approval queue or a new autonomy-config table | `withAgentPolicy` + `approval_requests` (Phase 10, unchanged) | Already handles L0-L4 decision matrix, audit logging (`ai_decision_log`), idempotency (`uq_approval_requests_idempotency`) |
| PDF generation | A new PDF pipeline or Puppeteer | `@react-pdf/renderer` component mirroring `ReceiboPDF.tsx`/`AnvisaReportPdf` | Already solves Flexbox-only layout, Latin Extended font embedding, Node-runtime constraint |
| Temporal/vigência tables | A generic "effective-dated" abstraction layer | Plain `vigencia_inicio DATE NOT NULL, vigencia_fim DATE` columns + a `WHERE ... <= :data AND (... IS NULL OR ... >= :data)` query, exactly as `tax_tables` does it | 3 existing tables already prove this is sufficient; no ORM-level temporal abstraction exists or is needed in this codebase |
| Unit-level financial scoping | A new `financial_transactions.unit_id` column + backfill migration | The existing `cost_center_id → cost_centers.unit_id` join, exactly as `listTransactions()` already does it | Changing the FK shape of a heavily-used, already-indexed production table for one new report is unjustified risk |
| LLM narrative generation for alerts | A custom prompt-orchestration layer | `generateText` from `ai` + `@ai-sdk/gateway`, model `'anthropic/claude-sonnet-4.6'`, exactly as `collection-agent.ts::buildCollectionMessage()` does it (including the `AI_GATEWAY_API_KEY`-absent static fallback) | Identical shape of problem (short pt-BR text, no PII beyond minimal context, must degrade gracefully without the API key in dev/test/UAT) |

**Deliberate exception — hand-rolling IS correct here:**
- **Forecasting/regression math** (D-31): with a hard cap of 12 monthly data points (D-32) and only two candidate methods (simple linear regression via least squares, or weighted moving average), a dependency like `simple-statistics` (7.9.3 available on npm, not installed) is disproportionate — the formulas are ~10-20 lines each, are trivially unit-testable as pure functions (mirrors `payout-math.ts`), and avoid a new third-party surface for a nightly cron job. **Recommendation: implement simple linear regression via ordinary least squares** (slope/intercept over `x = 0..n-1` months, `y = KPI value`) as the primary trend calculator — it's more standard for trend extrapolation than a moving average (which lags and doesn't extrapolate a "next month" projection cleanly) and is explicitly permitted by D-31/Discretion item #4. See Code Examples for the exact formula.
- **Chart primitives** (D-37): continuing the existing pure-SVG/Tailwind-token approach (no `recharts`) — see Standard Stack above.

## Common Pitfalls

### Pitfall 1: `socio`'s global RBAC module gate conflicts with D-14 (budget write access)
**What goes wrong:** If `/clinica/orcamento` is mapped to the existing `financeiro` `ModuleKey`, `socio` will be blocked from editing budget targets (`isReadOnly()` returns `true` for `socio` × `financeiro` today), directly violating D-14.
**Why it happens:** `MODULE_PERMISSIONS.socio.financeiro = { allowed: true, readOnly: true }` was set in Phase 7 for the DRE/reporting use case, before this phase's budget-write requirement existed.
**How to avoid:** Give `orcamento` (and `relatorios`, `societario`) their own `ModuleKey` entries (see Architecture Patterns above) rather than reusing `financeiro`.
**Warning signs:** A sócio test user gets a 403/redirect or a silent no-op on budget-target Server Actions despite D-14 saying they should be able to write.

### Pitfall 2: `financial_transactions` RLS grants SELECT to every authenticated tenant role — DRE access control must be app-layer, not RLS
**What goes wrong:** Assuming RLS enforces D-09 ("Admin + Sócio + Superadmin apenas"). It does not — `financial_transactions_tenant_read` policy (Phase 3) is `USING (tenant_id = get_my_tenant_id())` with **no role filter at all**; any `dentist`/`receptionist` session can already read all rows via direct table access.
**Why it happens:** The base table's RLS was designed for the original cash-flow feature (Phase 3), where all staff needed read access; DRE's stricter role requirement is new and specific to this feature, not the underlying data.
**How to avoid:** Enforce the Admin/Sócio/Superadmin gate in (a) `src/proxy.ts` route/module permissions for `/clinica/relatorios` and `/bi`, AND (b) defense-in-depth inside the DRE/BI Server Actions themselves (check `get_my_role()` or the resolved actor role before running the aggregation), mirroring the existing `COST_ROLES = ['admin','superadmin']` pattern used for `setLabOrderCost` in Phase 13.
**Warning signs:** A `dentist` role manually navigating to `/clinica/relatorios` after a route-gating bug would still get real financial data back from a Server Action that only checks RLS.

### Pitfall 3: `cost_center_id` is nullable on `financial_transactions` — "Todas as unidades" must include NULL-cost-center rows
**What goes wrong:** A DRE query that always does `cost_center_id IN (...)` will silently drop legitimate revenue/expense rows that were posted without cost-center classification (e.g., some auto-posted webhook transactions per D-03b from Phase 14), undercounting the consolidated total.
**Why it happens:** `account_id`/`cost_center_id` were added as NULLABLE by design in Phase 14 — "Server Action enforces required for manual entries only (webhook auto-posts may legitimately have NULL)."
**How to avoid:** "Todas" (consolidated, D-03) = no `cost_center_id` filter at all (sum everything in the date range). Only apply the `cost_center_id IN (...)` filter when a **specific** unit is selected. Decide explicitly (and document in the plan) whether NULL-cost-center rows should also appear in a specific-unit view's "unclassified" bucket, or be excluded — CONTEXT.md doesn't address this; flag as an Open Question for discuss/plan-check.

### Pitfall 4: Mixed `tenant_id`/`clinic_id` column naming across the financial schema
**What goes wrong:** `financial_transactions` (Phase 3) uses `tenant_id`; `chart_of_accounts`/`cost_centers`/`bank_accounts` (Phase 14) use `clinic_id`. A join or a new table's FK naming choice can silently break if the wrong column name is assumed.
**Why it happens:** Historical naming drift — Phase 3 predates the `tenants→clinics` rename convention that Phase 14+ tables adopted.
**How to avoid:** New tables in this phase (`budget_targets`, `partner_shares`, `kpi_targets`, `bi_alerts`) should use `clinic_id` (matching the newer/dominant convention, same as every table since Phase 7). When joining to `financial_transactions`, remember its tenant column is named `tenant_id` (same UUID value, different column name) — do not `SELECT ... USING(clinic_id)` against it.

### Pitfall 5: D-37's chart-reuse restriction is a deviation from an existing precedent, not a new rule
**What goes wrong:** A planner/implementer might "helpfully" reuse `@/components/prototipos/charts` for BI screens, since production code (`convenios`/`nfse` pages) already imports from there and it "works."
**Why it happens:** The precedent exists and is not itself broken — but D-37 explicitly overrides it for this phase.
**How to avoid:** Copy the needed primitives (or write new ones with the same technique) into a new, non-`prototipos` namespace for this phase's screens only. Do not feel obligated to also migrate `convenios`/`nfse` off the old import — that's out of scope (not requested in CONTEXT.md).

### Pitfall 6: Budget month-lock (D-18) cannot be a static RLS/CHECK rule
**What goes wrong:** "Meses passados ficam travados" depends on `NOW()` vs. the target month — a moving condition that a static RLS policy or CHECK constraint can't express cleanly (mirrors the documented reason `competencia_fechamentos`/OS state-machine rules are enforced in Server Actions, not RLS, elsewhere in this codebase).
**How to avoid:** Enforce in the `updateBudgetTarget` Server Action: reject writes where the target month is strictly before the current month (`America/Sao_Paulo` wall-clock, consistent with the existing `saoPauloDayBoundsUTC` helper in `stock-agent.ts`).

## Code Examples

### Linear regression (ordinary least squares) for BI-02 forecasting — pure, no dependency
```typescript
// New pure function — src/lib/bi/forecast-math.ts (mirrors payout-math.ts convention: pure, no I/O)
export interface TrendPoint { month: string; value: number }
export interface TrendResult {
  slope: number
  intercept: number
  projectedNext: number
  insufficientData: boolean // true when points.length < 3 (D-32)
}

export function computeLinearTrend(points: TrendPoint[]): TrendResult {
  const n = points.length
  if (n < 3) {
    return { slope: 0, intercept: points.at(-1)?.value ?? 0, projectedNext: points.at(-1)?.value ?? 0, insufficientData: true }
  }
  const xs = points.map((_, i) => i)
  const ys = points.map((p) => p.value)
  const xMean = xs.reduce((s, x) => s + x, 0) / n
  const yMean = ys.reduce((s, y) => s + y, 0) / n
  const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0)
  const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0)
  const slope = den === 0 ? 0 : num / den
  const intercept = yMean - slope * xMean
  const projectedNext = slope * n + intercept
  return { slope, intercept, projectedNext, insufficientData: false }
}

// Deviation-from-trend alert (D-33b) — recommended default threshold, Claude's Discretion item #3
export function isDecliningVsTrend(actual: number, projected: number, thresholdPct = 15): boolean {
  if (projected <= 0) return false
  return ((projected - actual) / projected) * 100 > thresholdPct
}
```

### Budget deviation semaphore (D-15) — recommended default thresholds (Claude's Discretion item #2)
```typescript
// src/lib/financeiro/dre-math.ts (or budget-math.ts)
export type DeviationSemaphore = 'verde' | 'amarelo' | 'vermelho'

export function budgetDeviationSemaphore(realizado: number, meta: number): DeviationSemaphore {
  if (meta === 0) return realizado === 0 ? 'verde' : 'vermelho'
  const deviationPct = Math.abs((realizado - meta) / meta) * 100
  if (deviationPct < 5) return 'verde'
  if (deviationPct <= 15) return 'amarelo'
  return 'vermelho'
}
```
**Recommendation:** hardcode `<5% / 5-15% / >15%` as the v1 default (matches the example already suggested in CONTEXT.md's own Discretion note), expressed as named constants in one place (`src/lib/financeiro/dre-math.ts`), not admin-configurable in this phase. Nothing in CONTEXT.md's locked decisions requests per-tenant configurability, and adding a settings UI for it would be new, unrequested scope; if the UI-spec step wants configurability later, it's a one-line change to read from a config table instead of a constant.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — this is new functionality, not a replacement | — | — | — |

No legacy version of DRE/Orçamento/BI exists to migrate from; the only "old" artifacts are the `/clinica/prototipos/relatorios` and `dashboard-franquias` mock pages, which D-42 requires removing once the real screens ship (not a migration — a deletion, after production screens are verified working).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `partner_shares` write access should be admin/superadmin only (sócio read-own-row, no self-service edit) | Pattern 3 | If wrong, a Server Action + RLS write policy for `socio` self-edit needs to be added; low effort to correct, but changes an RLS policy already planned |
| A2 | BI forecast agent should be seeded at `ai_agent_config` level L1 (suggest-only), given D-34/D-35 always require human approval regardless of level | Pattern 4 | If L2 auto-execute were intended for some non-financial BI action (e.g., auto-dismissing a stale alert), the policy config would need a second `agentKey` or a different sensitivity tier — moderate effort |
| A3 | 04:00 UTC is an acceptable, non-colliding nightly cron slot for `/api/cron/bi-previsoes` | Pattern 5 | Low risk — trivially changed in `vercel.json`; only matters if Vercel cron concurrency/quota becomes a constraint |
| A4 | Consolidated ("Todas as unidades") DRE should include `cost_center_id IS NULL` transactions in the total, but a specific-unit view should exclude them (not bucket them as "unclassified") | Pitfall 3 | If wrong, the sum of all per-unit DRE views won't reconcile to the consolidated total — should be confirmed explicitly at plan-check or UI-spec time, not decided silently in code |

**If this table is empty:** N/A — see above; all other claims in this research are `[VERIFIED]` against actual migration/source files read during this session.

## Open Questions (ALL RESOLVED during Phase 19 planning — see inline RESOLVED notes)

1. **Should NULL-`cost_center_id` transactions be shown anywhere in a per-unit DRE view (e.g., an "Não classificado" row), or silently excluded from unit-level totals while still counted in consolidated?**
   - What we know: Consolidated must include them (A4) to match the real cash total; Phase 14 made classification optional specifically to avoid blocking webhook auto-posts.
   - What's unclear: CONTEXT.md doesn't address this edge case at all — D-04/D-06 describe drill-down and cost-center expansion assuming classified data.
   - Recommendation: Surface explicitly in the DRE plan/UI-spec; simplest correct behavior is likely a permanent "Não classificado" account-like bucket rendered only in the consolidated view.
   - **RESOLVED (Plan 04, A4):** consolidated ("Todas") DRE INCLUDES NULL-`cost_center_id` transactions; a specific-unit view EXCLUDES them. Encoded in 19-04 must_haves + acceptance_criteria and enforced in the getDre action.

2. **Does `partner_shares` need a write path for `socio` at all, or is D-20/D-22's "cadastro" always admin/superadmin-only?**
   - What we know: D-14 explicitly grants sócio write on **orçamento**; D-20/D-22/D-23 describe cotas administration without ever mentioning who is allowed to *create* a vigência (only D-24 addresses *viewing* scope).
   - What's unclear: whether sócio is expected to self-administer their own equity share (unlikely, given D-22's blocking 100%-sum validation implies a single administrator reconciling all socios at once) or whether this was simply not discussed.
   - Recommendation: Default to admin/superadmin-only write (A1); confirm during plan-check since it changes an RLS policy.
   - **RESOLVED (Plan 06, A1):** `partner_shares` write is admin/superadmin-only; `socio` has NO write grant (SHARE_WRITE_ROLES). RLS in 19-03 grants socio SELECT of own row only (D-24). Socio write remains on orçamento (D-14) only.

3. **Should the BI forecast agent's `budget_targets` UPDATE-on-approval reuse the generic `approveRequest` in `approval-actions.ts`, or need a dedicated `approveBudgetAdjustment` handler (mirroring how `campaigns` needed `approveCampaignAndDispatch`)?**
   - What we know: the generic `approveRequest`/`rejectRequest` flip `approval_requests.status` only — they do not apply arbitrary business-table mutations (verified: `campaigns` needed a dedicated handler for exactly this reason, Phase 18 decision).
   - What's unclear: whether the planner should add a small dedicated handler now or a more generic "apply payload to target table" mechanism reusable by future agents.
   - Recommendation: Follow the `campaigns` precedent — a small dedicated `approveBudgetAdjustment(requestId)` handler, not a generic engine (avoids premature abstraction).
   - **RESOLVED (Plan 08):** a dedicated `approveBudgetAdjustment(requestId)` handler applies the meta change on approval, mirroring the `approveCampaignAndDispatch` precedent — NOT the generic `approveRequest`.

## Environment Availability

No external service/tool dependencies beyond what's already configured and verified working in this codebase:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@react-pdf/renderer` | PDF export (D-07/D-19/D-40) | ✓ | ^4.5.1 (installed) | — |
| Vercel AI Gateway (`AI_GATEWAY_API_KEY`) | LLM narrative (D-31) | ✓ (same env var already used by `collection-agent.ts`/`campaign-agent.ts`) | `ai` ^6.0.200 | Static neutral pt-BR fallback text when key absent (existing pattern) |
| Vercel Cron | Nightly forecast job (D-36) | ✓ (8 crons already registered in `vercel.json`) | — | — |
| Supabase (sa-east-1, RLS) | All new tables | ✓ | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — the one dependency with a fallback (`AI_GATEWAY_API_KEY`) already has its fallback pattern proven in production code.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.8 |
| Config file | `vitest.config.ts` (repo root) — `include: ['src/__tests__/**/*.test.ts', 'src/lib/**/__tests__/**/*.test.ts']` |
| Quick run command | `npx vitest run src/lib/financeiro/__tests__/dre-math.test.ts` (or the relevant new test file) |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REP-01 | DRE aggregation groups by account/type and computes % of revenue correctly | unit | `npx vitest run src/lib/financeiro/__tests__/dre-math.test.ts` | ❌ Wave 0 |
| REP-01 | Unit filter resolves to cost_center_ids, "Todas" includes NULL cost_center rows | unit | `npx vitest run src/actions/__tests__/dre.test.ts` (or similar, mirrors `financeiro/` action test style) | ❌ Wave 0 |
| REP-02 | Budget deviation semaphore returns correct verde/amarelo/vermelho at boundary values | unit | `npx vitest run src/lib/financeiro/__tests__/dre-math.test.ts` | ❌ Wave 0 |
| REP-02 | Past-month budget edits are rejected (D-18 lock) | unit/integration | `npx vitest run src/actions/__tests__/budget-targets.test.ts` | ❌ Wave 0 |
| REP-03 | Vigência query resolves correct percentual for a historical date | unit | `npx vitest run src/lib/financeiro/__tests__/partner-shares.test.ts` | ❌ Wave 0 |
| REP-03 | Sum-to-100% validation blocks a new vigência that doesn't reconcile | unit | `npx vitest run src/actions/__tests__/partner-shares.test.ts` | ❌ Wave 0 |
| BI-01/BI-02 | Linear trend computation matches known OLS values; `insufficientData` true below 3 points | unit | `npx vitest run src/lib/bi/__tests__/forecast-math.test.ts` | ❌ Wave 0 |
| BI-02 | `withAgentPolicy` called per-clinic (never aggregate) inside the cron scan loop | source-inspection/regression | `npx vitest run src/__tests__/governance/bi-forecast-agent.test.ts` (mirrors existing `regression-guard-phase16.test.ts`/`collection-agent.test.ts` style) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** run the specific new test file(s) touched.
- **Per wave merge:** `npm test` (full suite) — this repo's existing convention (every phase to date runs full `vitest run` before merge per STATE.md plan history).
- **Phase gate:** Full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/financeiro/__tests__/dre-math.test.ts` — new pure-function test file, no scaffold exists yet
- [ ] `src/lib/bi/__tests__/forecast-math.test.ts` — new pure-function test file
- [ ] `src/lib/financeiro/__tests__/partner-shares.test.ts` — vigência resolution + sum-validation tests
- [ ] Framework install: none — Vitest already configured and used by every prior phase's `__tests__` directories (`financeiro16`, `crc`, `governance`, etc.)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirect) | Existing Supabase Auth session via `@supabase/ssr` — unchanged by this phase |
| V3 Session Management | no | No new session handling introduced |
| V4 Access Control | yes | New `ModuleKey` entries in `src/proxy.ts` (route-level) + role checks inside Server Actions (defense-in-depth, per Pitfall 2) + RLS `USING`/`WITH CHECK` on every new table |
| V5 Input Validation | yes | Zod schemas (v3, no `.default()`) for `budget_targets`/`partner_shares`/`kpi_targets` forms, mirroring `professional.ts`/`cost-centers.ts` validator style |
| V6 Cryptography | no | No new secrets/encryption surface — no PII beyond what already exists in `users`/`patients` is introduced by this phase's tables |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data leak via missing `clinic_id` filter on a new table | Information Disclosure | `RLS USING (clinic_id = get_my_tenant_id())` on every new table, both read and write policies, mirrors every table since Phase 3 |
| Sócio viewing another sócio's equity share via API tampering (URL/ID manipulation) | Information Disclosure / Elevation of Privilege | RLS self-row match (`user_id = auth.uid()`) on `partner_shares` SELECT for `socio` role — enforced at the database layer, not just the UI (Pattern 3 above) |
| BI forecast agent silently mutating `budget_targets` without human review | Tampering / Elevation of Privilege | `withAgentPolicy` + mandatory `approval_requests` row for any actual mutation — agent code path must never write directly to `budget_targets`, only ever to `approval_requests` (D-34's explicit "nunca toca... diretamente") |
| Financial data exposure via cached PDF response | Information Disclosure | `Cache-Control: no-store, no-cache, must-revalidate` on every PDF route response, exactly as `anvisa-pdf`/`ReceiboPDF` routes already do |
| Role confusion between module-level `readOnly` gate and RLS write policy (a "read-only" UI role that still has DB write permission via direct API call) | Elevation of Privilege | Ensure any table where a role is `readOnly` at the module level *also* has no RLS INSERT/UPDATE policy granting that role write access — do not rely on the UI gate alone (mirrors the existing "socio readOnly on financeiro" convention, which should hold equally for `relatorios`/`societario`) |

## Sources

### Primary (HIGH confidence — verified directly in this repo during this session)
- `supabase/migrations/20260619001100_financial_cadastros_tables.sql` — `chart_of_accounts`, `cost_centers`, `bank_accounts` schema, `financial_transactions` NULLABLE `account_id`/`cost_center_id` columns
- `supabase/migrations/20260619001200_financial_cadastros_rls.sql` — RLS pattern (USING + WITH CHECK, admin/superadmin write)
- `supabase/migrations/20260606000100_financial_tables.sql` + `20260606000200_financial_rls.sql` — `financial_transactions` original schema (`tenant_id`, no `unit_id`), RLS with no role filter on SELECT
- `supabase/migrations/20260614000700_operational_unit_id.sql` — confirms `financial_transactions` was NOT given a direct `unit_id` (only appointments/charges/receivables were)
- `supabase/migrations/20260621000300_payout_rpa_tables.sql` — `professional_payouts` (per-competência snapshot, no vigência date-range)
- `supabase/migrations/20260621000400_tax_tables.sql` — the actual vigência pattern (`vigencia_inicio`/`vigencia_fim`) to replicate for `partner_shares`
- `supabase/migrations/20260616000200_approval_requests.sql` — `approval_requests` schema (type/payload/agent_key/required_role/idempotency)
- `supabase/migrations/20260712000100_crc_tables.sql` — `nps_responses`, `campaigns`, `leads` schema (BI-01 data sources)
- `supabase/migrations/20260703000100_estoque_tables.sql` — `stock_alerts`, `product_batches` schema (BI-01 data source)
- `supabase/migrations/20260620000300_faturamento_tiss_tables.sql` — `tiss_guides`/`tiss_guide_items.valor_glosado` (BI-01 glosa-rate data source)
- `supabase/migrations/20260621000100_payables_tables.sql` — `payables`/`payable_installments.due_date` (BI-01 payment-delay data source)
- `src/lib/agents/stock-agent.ts` — L1/L2 agent template (`withAgentPolicy`, approval_requests creation, per-row clinicId)
- `src/lib/ai/policy.ts` — `withAgentPolicy` implementation and decision matrix contract
- `src/lib/agents/collection-agent.ts` — LLM narrative generation template (`generateText`, AI Gateway fallback pattern)
- `src/app/api/cron/estoque-validade/route.ts` + `nps-scan/route.ts` — cron route template
- `src/app/api/estoque/anvisa-pdf/route.ts` + `src/components/pdf/ReceiboPDF.tsx` — PDF export template
- `src/proxy.ts` — `MODULE_PERMISSIONS`, `ROUTE_MODULE_MAP`, existing `/bi` scaffold and `socio` readOnly conflict
- `src/actions/transactions.ts` (`listTransactions`) — unit→cost-center-ids resolution pattern for DRE
- `src/components/prototipos/charts.tsx` + grep of `convenios`/`nfse` pages — confirms no charting library, and confirms production already imports from `prototipos/`
- `package.json` — confirms no `recharts`/`d3`/stats library installed; all needed libraries already present
- `vercel.json` — existing cron schedule slots (informs new cron time slot choice)
- `.planning/config.json` — `nyquist_validation: true`, `ui_phase: true`, no `security_enforcement` key (security domain section required)

### Secondary (MEDIUM confidence)
- `npm view recharts version` / `npm view simple-statistics version` — confirms these packages exist on the registry but are not installed; used only to support the "don't add" recommendation, not to recommend adding them

### Tertiary (LOW confidence)
- None — all findings in this research were verified directly against repository source/migrations.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library claim verified against `package.json`; zero new dependencies needed
- Architecture: HIGH — every pattern (vigência, cron, agent, PDF, RLS) verified against actual existing files, not training-data assumptions
- Pitfalls: HIGH — RBAC conflict, nullable `cost_center_id`, and `tenant_id`/`clinic_id` naming drift are all directly observed in the codebase, not speculative
- Thresholds (semaphore %, decline %) and forecasting algorithm choice: MEDIUM — reasonable, internally-consistent defaults recommended per Claude's Discretion, but not derived from an external authoritative source; flagged for confirmation at plan-check/UI-spec time if the user wants different numbers

**Research date:** 2026-07-19
**Valid until:** No external dependency changes expected; this research is tied to the current state of the FYNXIA codebase (through Phase 18) rather than to a fast-moving external ecosystem — valid until the underlying schema (`financial_transactions`, `chart_of_accounts`, `approval_requests`) changes in a future phase.
