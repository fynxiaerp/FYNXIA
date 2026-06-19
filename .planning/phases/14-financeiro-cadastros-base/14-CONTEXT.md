# Phase 14: Financeiro — Cadastros Base - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Estruturar os **cadastros base** do financeiro v2:
- **Plano de contas** em árvore hierárquica (receitas/despesas/grupos) — `chart_of_accounts`
- **Centros de custo** por unidade/área — `cost_centers`
- **Contas correntes** (bancárias) — `bank_accounts`
- **Categorias** — reutiliza `financial_categories` (Phase 3), agora mapeada ao plano de contas

E passar a **classificar todo lançamento** (`financial_transactions`) por conta contábil + centro de custo, com rateio por unidade/área (FCAD-01, FCAD-02).

**Fora de escopo** (outras fases): faturamento/NFS-e/OS (Phase 15), contas a pagar/conciliação/tributos (Phase 16), relatórios/BI consolidados (Phase consolidação).
</domain>

<decisions>
## Implementation Decisions

### Centro de custo
- **D-01:** Centro de custo é **entidade própria** — tabela `cost_centers` (nível tenant/`clinic_id`), cada CC vinculada a uma `unit_id` (FK `units`), permitindo **áreas** dentro da unidade (ex.: clínica, administrativo, marketing). Habilita o "rateio por unidade/área" do FCAD-02.
- **D-01a:** Migração faz **seed de 1 CC default por unidade** existente (zero quebra — todo lançamento legado tem CC atribuível).

### Plano de contas
- **D-02:** `chart_of_accounts` **hierárquico** (auto-relacionamento `parent_id`), com tipo receita/despesa/grupo. Vem com **seed de plano de contas odontológico padrão editável** (bom onboarding).
- **D-02a:** `financial_categories` (Phase 3) **coexiste** como atalho de UX. Cada categoria passa a **referenciar uma conta contábil folha** (nova coluna `account_id` em `financial_categories`). Não há duplicação: categoria = atalho amigável, conta contábil = camada formal/hierárquica.

### Classificação de lançamentos
- **D-03:** Em `financial_transactions`, adicionar `account_id` (conta contábil) + `cost_center_id` (centro de custo) [+ `bank_account_id` opcional — ver D-04].
- **D-03a:** **Obrigatório** (NOT NULL na lógica de escrita / Server Action) para **lançamentos manuais novos**.
- **D-03b:** **Auto-postados** (webhook Asaas, sem usuário) e o **legado da Phase 3** recebem **conta/CC default**: conta contábil derivada da categoria do lançamento (`financial_categories.account_id`) e CC = CC default da unidade (`unit_id`) do lançamento. **Backfill na migração** para todas as linhas existentes.

### Contas correntes + rateio
- **D-04:** `bank_accounts` — cadastro (nome, banco, agência, conta, saldo inicial). Lançamento pode **referenciar uma conta corrente (opcional)** via `financial_transactions.bank_account_id`.
- **D-04a:** **Rateio 1:1** nesta fase — 1 lançamento → 1 centro de custo. Rateio percentual de 1 lançamento entre vários CCs fica **deferido** (fase futura).

### Convenções herdadas (locked — não rediscutir)
- **Tenant-level:** plano de contas, cost_centers e bank_accounts são **cadastros de rede** (`clinic_id`), compartilháveis por unidade (Phase 7 D-01).
- **RLS:** isolamento por `clinic_id` (`get_my_tenant_id()`), filtro opcional por unidade via `get_my_unit_ids()` (Phase 7). Padrão financeiro: **SELECT todos os papéis, escrita apenas admin** (ver `20260606000200_financial_rls.sql`).
- **Expandir, não recriar:** `financial_transactions` e `financial_categories` ganham colunas — sem nova tabela substituta.

### Claude's Discretion
- Nomenclatura exata de colunas/índices e códigos/numeração do plano de contas (ex.: 1.x receitas, 2.x despesas) ficam a critério do planner/executor, seguindo padrão brasileiro.
- Estrutura do seed do plano de contas odontológico (quais contas folha) — usar lista padrão razoável, derivada das categorias seed da Phase 3.
- Tipo de UI da árvore (componente tree) — definir em `/gsd-ui-phase` (UI hint = yes).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo & requisitos
- `.planning/ROADMAP.md` §"Phase 14: Financeiro — Cadastros Base" (linhas ~222) — goal, success criteria, dependências, v1 reuse
- `.planning/REQUIREMENTS.md` — FCAD-01 (plano de contas/centros de custo/contas correntes/categorias), FCAD-02 (classificação obrigatória + rateio)

### Decisões herdadas
- `.planning/phases/07-sistema-multiunidade-pap-is/07-CONTEXT.md` §Multiunidade (D-01) — cadastros de rede em `clinic_id`, `unit_id` nas linhas operacionais, helper `get_my_unit_ids()`, centro de custo/BI por unidade (SYS-05)
- `.planning/phases/03-financial-mvp/03-CONTEXT.md` §D-05 — categorias = lista padrão odontológica editável

### Schema existente (expandir)
- `supabase/migrations/20260606000100_financial_tables.sql` — `financial_categories`, `financial_transactions` (alvos de expansão), padrão de colunas/índices
- `supabase/migrations/20260606000200_financial_rls.sql` — padrão RLS financeiro (SELECT todos / escrita admin)
- `supabase/migrations/20260606000300_financial_categories_seed.sql` — seed de categorias (base para mapear `account_id` e derivar seed do plano de contas)
- `supabase/migrations/20260614000100_units_table.sql` — `units` (FK de `cost_centers.unit_id`)
- `supabase/migrations/20260614000200_units_rls.sql` — helper `get_my_unit_ids()`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`financial_categories`** — recebe `account_id` (FK `chart_of_accounts`); mantém papel de atalho de UX.
- **`financial_transactions`** — recebe `account_id`, `cost_center_id`, `bank_account_id`; já tem trigger de auditoria.
- **`units`** — alvo do FK `cost_centers.unit_id`.
- **Helpers RLS:** `get_my_tenant_id()`, `get_my_role()`, `get_my_unit_ids()` (SECURITY DEFINER).
- **`audit_table_changes()`** — trigger de auditoria reutilizável nos novos cadastros se necessário.

### Established Patterns
- FK `tenant_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE`; índice em `tenant_id`.
- Valores monetários: `NUMERIC(12,2)`.
- RLS financeiro: SELECT para todos os papéis, INSERT/UPDATE/DELETE só admin.
- Seed por tenant na criação da clínica (como `financial_categories`).

### Integration Points
- `financial_transactions` ganha as 3 colunas de classificação → fluxo de caixa e relatórios passam a filtrar por unidade/centro de custo.
- Server Actions de lançamento manual passam a exigir `account_id` + `cost_center_id`.
- Webhook Asaas (auto-posting) resolve conta/CC default — não pode travar.
- UI: tela de cadastro com árvore do plano de contas (definir em UI-SPEC).
</code_context>

<specifics>
## Specific Ideas

- Plano de contas com seed **odontológico** padrão, derivado das categorias seed da Phase 3 (consulta, tratamento, convênio… / aluguel, materiais, salários, laboratório, impostos…).
- Numeração contábil hierárquica no estilo brasileiro (grupos → subgrupos → contas folha).
</specifics>

<deferred>
## Deferred Ideas

- **Rateio percentual multi-centro de custo** (dividir 1 lançamento entre vários CCs por %) — fase futura.
- **Vínculo obrigatório de conta corrente** e movimentação de saldo bancário — pertence ao fluxo de caixa / conciliação (Phase 16).
- **Relatórios/BI por centro de custo** consolidados — fase de consolidação (Phases 14–16 alimentam).
</deferred>

---

*Phase: 14-financeiro-cadastros-base*
*Context gathered: 2026-06-19*
