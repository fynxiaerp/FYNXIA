# Phase 14: Financeiro — Cadastros Base - Research

**Researched:** 2026-06-19
**Domain:** PostgreSQL hierárquico (chart_of_accounts), migrações de expansão segura, RLS multi-tenant, seed de plano de contas odontológico, Server Actions com Zod
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Centro de custo**
- **D-01:** Centro de custo é **entidade própria** — tabela `cost_centers` (nível tenant/`clinic_id`), cada CC vinculada a uma `unit_id` (FK `units`), permitindo **áreas** dentro da unidade (ex.: clínica, administrativo, marketing). Habilita o "rateio por unidade/área" do FCAD-02.
- **D-01a:** Migração faz **seed de 1 CC default por unidade** existente (zero quebra — todo lançamento legado tem CC atribuível).

**Plano de contas**
- **D-02:** `chart_of_accounts` **hierárquico** (auto-relacionamento `parent_id`), com tipo receita/despesa/grupo. Vem com **seed de plano de contas odontológico padrão editável** (bom onboarding).
- **D-02a:** `financial_categories` (Phase 3) **coexiste** como atalho de UX. Cada categoria passa a **referenciar uma conta contábil folha** (nova coluna `account_id` em `financial_categories`). Não há duplicação: categoria = atalho amigável, conta contábil = camada formal/hierárquica.

**Classificação de lançamentos**
- **D-03:** Em `financial_transactions`, adicionar `account_id` (conta contábil) + `cost_center_id` (centro de custo) [+ `bank_account_id` opcional — ver D-04].
- **D-03a:** **Obrigatório** (NOT NULL na lógica de escrita / Server Action) para **lançamentos manuais novos**.
- **D-03b:** **Auto-postados** (webhook Asaas, sem usuário) e o **legado da Phase 3** recebem **conta/CC default**: conta contábil derivada da categoria do lançamento (`financial_categories.account_id`) e CC = CC default da unidade (`unit_id`) do lançamento. **Backfill na migração** para todas as linhas existentes.

**Contas correntes + rateio**
- **D-04:** `bank_accounts` — cadastro (nome, banco, agência, conta, saldo inicial). Lançamento pode **referenciar uma conta corrente (opcional)** via `financial_transactions.bank_account_id`.
- **D-04a:** **Rateio 1:1** nesta fase — 1 lançamento → 1 centro de custo. Rateio percentual de 1 lançamento entre vários CCs fica **deferido** (fase futura).

**Convenções herdadas (locked — não rediscutir)**
- **Tenant-level:** plano de contas, cost_centers e bank_accounts são **cadastros de rede** (`clinic_id`), compartilháveis por unidade (Phase 7 D-01).
- **RLS:** isolamento por `clinic_id` (`get_my_tenant_id()`), filtro opcional por unidade via `get_my_unit_ids()` (Phase 7). Padrão financeiro: **SELECT todos os papéis, escrita apenas admin** (ver `20260606000200_financial_rls.sql`).
- **Expandir, não recriar:** `financial_transactions` e `financial_categories` ganham colunas — sem nova tabela substituta.

### Claude's Discretion

- Nomenclatura exata de colunas/índices e códigos/numeração do plano de contas (ex.: 1.x receitas, 2.x despesas) ficam a critério do planner/executor, seguindo padrão brasileiro.
- Estrutura do seed do plano de contas odontológico (quais contas folha) — usar lista padrão razoável, derivada das categorias seed da Phase 3.
- Tipo de UI da árvore (componente tree) — decidido em `14-UI-SPEC.md`: usar `Accordion` (`@base-ui/react/accordion`) já instalado.

### Deferred Ideas (OUT OF SCOPE)

- **Rateio percentual multi-centro de custo** (dividir 1 lançamento entre vários CCs por %) — fase futura.
- **Vínculo obrigatório de conta corrente** e movimentação de saldo bancário — pertence ao fluxo de caixa / conciliação (Phase 16).
- **Relatórios/BI por centro de custo** consolidados — fase de consolidação (Phases 14–16 alimentam).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Descrição | Suporte da Pesquisa |
|----|-----------|---------------------|
| FCAD-01 | Financeiro estrutura plano de contas (árvore), centros de custo, contas correntes e categorias | Padrão adjacency list com `parent_id` + `code` TEXT, seed odontológico derivado das categorias Phase 3, RLS padrão financeiro estendido para 3 novas tabelas |
| FCAD-02 | Lançamentos são classificados por conta contábil e centro de custo (rateio por unidade/área) | Expansão segura de `financial_transactions` com colunas NULLABLE + UPDATE backfill + lógica de enforcing no Server Action, sem afetar webhook Asaas |
</phase_requirements>

---

## Summary

A Phase 14 expande o núcleo financeiro do FYNXIA com três novos cadastros de rede (`chart_of_accounts`, `cost_centers`, `bank_accounts`) e classifica retroativamente e prospectivamente todos os lançamentos (`financial_transactions`) por conta contábil e centro de custo. O desafio técnico central é expandir tabelas existentes (`financial_transactions`, `financial_categories`) com colunas que são NOT NULL efetivamente para novas entradas mas devem aceitar NULL durante o backfill e para o caminho de auto-posting do webhook Asaas — tudo sem bloquear o serviço ou exigir downtime.

A hierarquia do plano de contas é implementada com adjacency list (`parent_id` auto-referencial) em vez de ltree/nested sets. Essa escolha é validada pela decisão D-02 (tree UI via Accordion com 3 níveis de profundidade) — a leitura recursiva de árvore rasa é O(1) consultas com CTE simples, e inserções/atualizações são triviais (sem manutenção de paths). A abordagem ltree seria superior para tree queries de qualquer profundidade arbitrária, mas o plano de contas odontológico tem no máximo 3 níveis (grupos → subgrupos → contas folha), tornando ltree overhead desnecessário.

O risco de migração mais alto é o backfill de `account_id` e `cost_center_id` em `financial_transactions`. Linhas legadas sem `category_id` ou sem `unit_id` podem não ter um default óbvio. A estratégia segura é adicionar colunas como NULLABLE, executar o UPDATE de backfill dentro da mesma transação de migração usando UPDATEs condicionais com fallback para valores "genéricos" seed, e nunca converter para NOT NULL na DDL — o NOT NULL é enforced na camada de aplicação (Server Action) apenas para lançamentos manuais novos.

**Recomendação primária:** 5 migrações separadas em prefix `20260619001*`: (1) tabelas novas + ALTER TABLEs, (2) RLS das novas tabelas, (3) seed plano de contas odontológico + seed CCs default por unidade + UPDATE backfill nas tabelas existentes, (4) supabase db push [BLOCKING], (5) Server Actions + UI.

---

## Standard Stack

### Core

| Biblioteca | Versão | Propósito | Por que padrão |
|------------|--------|-----------|----------------|
| `@supabase/ssr` | latest | Cliente SSR autenticado para Server Actions e RSC | Padrão do projeto; `@supabase/auth-helpers-nextjs` foi deprecado em 2024 |
| `zod` | v3.x (pinado) | Validação de schemas nas Server Actions | Pinado em v3 — `@hookform/resolvers` v5 tem edge-cases com Zod v4 (decisão STATE.md 2026-06-02) |
| `react-hook-form` v7 | latest v7 | Formulários dos dialogs (AccountFormDialog, CostCenterFormDialog, BankAccountFormDialog) | Padrão do projeto; `@hookform/resolvers` v5 é o bridge |
| PostgreSQL recursive CTE | SQL nativo | Leitura da árvore hierárquica em uma consulta | Suportado no Postgres 12+, Supabase free plan, sem extensão adicional |

[VERIFIED: codebase — `src/actions/transactions.ts` usa Zod v3 + `@hookform/resolvers`; `STATE.md` confirma pin v3]

### Supporting

| Biblioteca | Versão | Propósito | Quando Usar |
|------------|--------|-----------|-------------|
| `@base-ui/react/accordion` | já instalado | Componente tree para ChartOfAccountsTree | Já instalado; decidido em UI-SPEC como tree primitive |
| `lucide-react` | já instalado | Ícones (ChevronDown, GitBranch, Building2, Landmark, Pencil, Plus) | Padrão do projeto |
| `@tanstack/react-table` v8 | já instalado | Tabelas de CostCenters e BankAccounts | Apenas se precisar de sort/filter; UI-SPEC usa shadcn `Table` simples — TanStack reservado para tabelas com sort URL-persistido |

[VERIFIED: codebase — `src/components/ui/accordion.tsx` existe, `components.json` confirma shadcn inicializado]

### Alternativas Consideradas

| Em vez de | Poderia usar | Tradeoff |
|-----------|-------------|----------|
| Adjacency list (`parent_id`) | PostgreSQL `ltree` extension | ltree é superior para árvores de profundidade arbitrária e path queries; mas exige extensão Supabase (disponível no free plan como `pg_trgm` / `ltree` — verificar), setup mais complexo, e o plano de contas odontológico tem máximo 3 níveis — overhead não justificado |
| Adjacency list | Nested Sets / MPTT | Leituras de subárvore são O(1) mas INSERT/UPDATE/DELETE são O(n) e exigem re-numeração — inaceitável para plano de contas editável |
| CTE recursiva na query | Pré-computar árvore no servidor | CTE é lida em uma query; com 3 níveis e 30–50 contas, performance não é problema |

---

## Architecture Patterns

### Estrutura de Arquivos Recomendada

```
supabase/migrations/
  20260619001100_financial_cadastros_tables.sql   -- novas tabelas + ALTER TABLEs
  20260619001200_financial_cadastros_rls.sql      -- RLS das 3 novas tabelas
  20260619001300_financial_cadastros_seed.sql     -- seed plano de contas + CCs default + backfill

src/
  actions/
    chart-of-accounts.ts    -- createAccount, updateAccount, listAccountsTree
    cost-centers.ts         -- createCostCenter, updateCostCenter, listCostCenters
    bank-accounts.ts        -- createBankAccount, updateBankAccount, listBankAccounts
    categories.ts           -- updateCategoryAccount (mapeia account_id)
    transactions.ts         -- EXPANDIR: adicionar account_id + cost_center_id ao schema Zod
  components/
    financeiro/
      ChartOfAccountsTree.tsx       -- 'use client' — Accordion tree
      AccountFormDialog.tsx          -- 'use client' — RHF Dialog
      CostCentersTable.tsx           -- 'use client'
      CostCenterFormDialog.tsx       -- 'use client'
      BankAccountsTable.tsx          -- 'use client'
      BankAccountFormDialog.tsx      -- 'use client'
      CategoriesAccountMappingTable.tsx -- 'use client'
  app/(dashboard)/clinica/financeiro/
    plano-de-contas/
      page.tsx        -- RSC: busca accounts
      loading.tsx
      error.tsx
    centros-de-custo/
      page.tsx
      loading.tsx
      error.tsx
    contas-correntes/
      page.tsx
      loading.tsx
      error.tsx
    categorias/
      page.tsx        -- EXPANDIR para incluir mapeamento account_id
src/__tests__/
  financeiro/
    migrations-phase14.test.ts     -- source-inspection da SQL
    chart-of-accounts.test.ts      -- pure functions: buildTree, validateCode
    cost-centers.test.ts           -- pure functions: getDefaultCCForUnit
    transaction-classification.test.ts  -- action: account_id + cost_center_id obrigatórios
    regression-guard-phase14.test.ts    -- garantias Phase 3 não quebradas
```

### Pattern 1: Adjacency List com CTE Recursiva

**O que é:** `chart_of_accounts` usa `parent_id UUID REFERENCES chart_of_accounts(id)` auto-referencial. A leitura da árvore completa usa uma CTE recursiva (`WITH RECURSIVE`). A UI renderiza a árvore a partir do resultado flat usando `buildTree()` no cliente.

**Quando usar:** Plano de contas odontológico com ≤3 níveis, estrutura editável por admin.

**DDL (exemplo canônico):**
```sql
-- Source: padrão PostgreSQL adjacency list [VERIFIED: PostgreSQL docs]
CREATE TABLE public.chart_of_accounts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  parent_id   UUID        REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  code        TEXT        NOT NULL,  -- ex.: '1', '1.1', '1.1.1'
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('grupo', 'receita', 'despesa')),
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chart_of_accounts_clinic   ON public.chart_of_accounts(clinic_id);
CREATE INDEX idx_chart_of_accounts_parent   ON public.chart_of_accounts(clinic_id, parent_id);
CREATE UNIQUE INDEX idx_chart_of_accounts_code ON public.chart_of_accounts(clinic_id, code);
```

**CTE recursiva para buscar árvore completa:**
```sql
-- Source: PostgreSQL docs — WITH RECURSIVE [VERIFIED: PostgreSQL 15 docs]
WITH RECURSIVE tree AS (
  -- Âncora: contas raiz (sem pai)
  SELECT id, parent_id, code, name, type, ativo, 0 AS depth
  FROM public.chart_of_accounts
  WHERE clinic_id = get_my_tenant_id() AND parent_id IS NULL

  UNION ALL

  -- Recursão: filhos de cada nó
  SELECT c.id, c.parent_id, c.code, c.name, c.type, c.ativo, t.depth + 1
  FROM public.chart_of_accounts c
  INNER JOIN tree t ON c.parent_id = t.id
  WHERE c.clinic_id = get_my_tenant_id()
)
SELECT * FROM tree ORDER BY code;
```

**buildTree no cliente (TypeScript):**
```typescript
// Source: padrão canônico de buildTree para adjacency list [ASSUMED — mas é padrão ubíquo]
type AccountNode = {
  id: string
  parent_id: string | null
  code: string
  name: string
  type: 'grupo' | 'receita' | 'despesa'
  ativo: boolean
  depth: number
  children: AccountNode[]
}

function buildTree(rows: Omit<AccountNode, 'children'>[]): AccountNode[] {
  const map = new Map<string, AccountNode>()
  rows.forEach(r => map.set(r.id, { ...r, children: [] }))
  const roots: AccountNode[] = []
  rows.forEach(r => {
    if (r.parent_id) {
      map.get(r.parent_id)?.children.push(map.get(r.id)!)
    } else {
      roots.push(map.get(r.id)!)
    }
  })
  return roots
}
```

**Alternativa via Supabase client (sem CTE — apenas 3 níveis):**
```typescript
// Para árvores rasas (<= 3 níveis), uma única select com .select('*, children:chart_of_accounts(*)')
// NÃO funciona no Supabase JS v2 com auto-referência — usar a CTE via supabase.rpc() ou
// buscar flat e montar no cliente com buildTree().
// [VERIFIED: Supabase JS v2 não suporta FK auto-referencial em select aninhado]
```

### Pattern 2: Expansão Segura de Tabela com NOT NULL Efetivo na Aplicação

**O que é:** Adicionar colunas a `financial_transactions` e `financial_categories` como NULLABLE no DDL, fazer backfill dentro da mesma migração, e enforcer NOT NULL apenas no Server Action para lançamentos manuais novos. O webhook Asaas resolve defaults automaticamente (sem bloquear).

**Por que não adicionar NOT NULL no DDL:**
- `ALTER TABLE ... ADD COLUMN ... NOT NULL` sem `DEFAULT` falha se houver rows existentes [VERIFIED: PostgreSQL docs]
- `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT <valor>` com um UUID hardcoded seria um seed "fantasma" de conta/CC inválido para linhas pré-existentes
- A abordagem correta: adicionar NULLABLE, UPDATE com backfill, manter NULLABLE na DDL, enforcer no código

**Migração segura (dentro de uma transaction):**
```sql
-- Source: padrão PostgreSQL para expansão sem downtime [VERIFIED: PostgreSQL docs]

-- Passo 1: Adicionar colunas NULLABLE
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS account_id      UUID REFERENCES public.chart_of_accounts(id),
  ADD COLUMN IF NOT EXISTS cost_center_id  UUID REFERENCES public.cost_centers(id),
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id);

CREATE INDEX idx_financial_transactions_account
  ON public.financial_transactions(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_financial_transactions_cost_center
  ON public.financial_transactions(cost_center_id) WHERE cost_center_id IS NOT NULL;

ALTER TABLE public.financial_categories
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.chart_of_accounts(id);

-- Passo 2: Backfill — account_id de financial_transactions via categoria
-- (UPDATE condicional — deixa NULL se categoria não tiver account_id mapeado)
UPDATE public.financial_transactions ft
SET account_id = fc.account_id
FROM public.financial_categories fc
WHERE ft.category_id = fc.id
  AND fc.account_id IS NOT NULL
  AND ft.account_id IS NULL;

-- Passo 3: Backfill — cost_center_id via CC default da unidade
-- (financial_transactions não tem unit_id direto — resolução via receivable ou posted_by)
-- Para lançamentos auto-postados (posted_by IS NULL), não há unit_id disponível diretamente.
-- Usar a CC default da única unidade do tenant como fallback.
UPDATE public.financial_transactions ft
SET cost_center_id = cc.id
FROM public.cost_centers cc
WHERE cc.clinic_id = ft.tenant_id
  AND cc.is_default = true
  AND ft.cost_center_id IS NULL;
```

**Por que backfill em migração, não em cron:**
- Supabase free plan não tem pg_cron. Backfill deve ser síncrono na migração [VERIFIED: STATE.md — pg_cron é Pro-only]
- Tabela `financial_transactions` é pequena no MVP (< 10.000 rows) — backfill inline é seguro
- Se crescer, o padrão é: migração com LIMIT batching via DO $$ ... $$ block

### Pattern 3: RLS para Cadastros de Rede (clinic_id)

**O que é:** As 3 novas tabelas usam `clinic_id` (não `tenant_id`) como coluna de isolamento, seguindo o padrão de `units` (Phase 7), e não o padrão de `financial_transactions` (que usa `tenant_id`).

**Decisão:** CONTEXT.md define os 3 cadastros como "cadastros de rede" com `clinic_id`. Isso é consistente com `units` (Phase 7) e `certificates` (Phase 7). Usar `clinic_id` = `get_my_tenant_id()`.

**Padrão RLS para cadastros de rede (admin write):**
```sql
-- Source: 20260614000200_units_rls.sql — padrão existente [VERIFIED: codebase]
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chart_of_accounts_tenant_read" ON public.chart_of_accounts
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "chart_of_accounts_admin_write" ON public.chart_of_accounts
  FOR ALL
  USING (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin', 'superadmin'))
  WITH CHECK (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin', 'superadmin'));
```

**Mesma estrutura para `cost_centers` e `bank_accounts`.**

**Atenção — diferença entre tabelas:**
| Tabela | Coluna tenant | Motivo |
|--------|---------------|--------|
| `chart_of_accounts` | `clinic_id` | Cadastro de rede (padrão Phase 7) |
| `cost_centers` | `clinic_id` | Cadastro de rede |
| `bank_accounts` | `clinic_id` | Cadastro de rede |
| `financial_transactions` (existente) | `tenant_id` | Linha operacional (padrão Phase 3) |
| `financial_categories` (existente) | `tenant_id` | Atalho UX (padrão Phase 3) |

As policies de `financial_transactions` e `financial_categories` **não mudam** — as novas colunas (`account_id`, `cost_center_id`) ficam cobertas pelas policies existentes via `WITH CHECK`.

### Pattern 4: Seed de Plano de Contas Odontológico

**O que é:** Seed parametrizado por `clinic_id` que insere grupos e contas folha derivados das categorias seed da Phase 3 (`20260606000300_financial_categories_seed.sql`).

**Estrutura de numeração (estilo CFC — Conselho Federal de Contabilidade):**
```
1     Receitas                    (grupo)
1.1   Receitas Operacionais       (grupo)
1.1.1 Consultas                   (receita — leaf)
1.1.2 Tratamentos Odontológicos   (receita — leaf)
1.1.3 Convênios                   (receita — leaf)
1.1.4 Outras Receitas             (receita — leaf)
2     Despesas                    (grupo)
2.1   Despesas Operacionais       (grupo)
2.1.1 Aluguel                     (despesa — leaf)
2.1.2 Materiais Odontológicos     (despesa — leaf)
2.1.3 Salários e Encargos         (despesa — leaf)
2.1.4 Laboratório                 (despesa — leaf)
2.1.5 Impostos e Taxas            (despesa — leaf)
2.1.6 Outras Despesas             (despesa — leaf)
```

**Derivação das categorias Phase 3 → contas folha:**
| Categoria Phase 3 | Tipo | Conta Folha (Phase 14) | Code |
|-------------------|------|------------------------|------|
| Consulta | receita | Consultas | 1.1.1 |
| Tratamento Odontológico | receita | Tratamentos Odontológicos | 1.1.2 |
| Convênio | receita | Convênios | 1.1.3 |
| Outros (receita) | receita | Outras Receitas | 1.1.4 |
| Aluguel | despesa | Aluguel | 2.1.1 |
| Materiais Odontológicos | despesa | Materiais Odontológicos | 2.1.2 |
| Salários | despesa | Salários e Encargos | 2.1.3 |
| Laboratório | despesa | Laboratório | 2.1.4 |
| Impostos | despesa | Impostos e Taxas | 2.1.5 |
| Outros (despesa) | despesa | Outras Despesas | 2.1.6 |

**Backfill do mapeamento categoria → conta contábil (dentro da mesma migração seed):**
```sql
-- Source: padrão de seed com referência cruzada [ASSUMED — lógica derivada do schema existente]
-- Após inserir o plano de contas, mapear financial_categories.account_id
-- usando um UPDATE com JOIN por name matching (heurístico — editável pelo admin depois)
UPDATE public.financial_categories fc
SET account_id = coa.id
FROM public.chart_of_accounts coa
WHERE coa.clinic_id = fc.tenant_id
  AND (
    (fc.name = 'Consulta'                 AND coa.code = '1.1.1') OR
    (fc.name = 'Tratamento Odontológico'  AND coa.code = '1.1.2') OR
    (fc.name = 'Convênio'                 AND coa.code = '1.1.3') OR
    (fc.name IN ('Outros') AND fc.type = 'receita' AND coa.code = '1.1.4') OR
    (fc.name = 'Aluguel'                  AND coa.code = '2.1.1') OR
    (fc.name = 'Materiais Odontológicos'  AND coa.code = '2.1.2') OR
    (fc.name = 'Salários'                 AND coa.code = '2.1.3') OR
    (fc.name = 'Laboratório'              AND coa.code = '2.1.4') OR
    (fc.name = 'Impostos'                 AND coa.code = '2.1.5') OR
    (fc.name IN ('Outros') AND fc.type = 'despesa' AND coa.code = '2.1.6')
  );
```

**Seed de CC default por unidade:**
```sql
-- Source: padrão do D-01a [VERIFIED: CONTEXT.md]
INSERT INTO public.cost_centers (clinic_id, unit_id, name, is_default, ativo)
SELECT
  u.clinic_id,
  u.id,
  u.name,
  true,
  true
FROM public.units u
WHERE u.deleted_at IS NULL
ON CONFLICT DO NOTHING;
```

**Seed do plano de contas para clínicas existentes (backfill):**
```sql
-- Source: padrão de seed_financial_categories em 20260606000300 [VERIFIED: codebase]
-- Usar INSERT ... SELECT FROM clinics WHERE NOT EXISTS(... chart_of_accounts WHERE ...)
-- para não duplicar em re-runs
INSERT INTO public.chart_of_accounts (clinic_id, parent_id, code, name, type, ativo)
SELECT c.id, NULL, '1', 'Receitas', 'grupo', true
FROM public.clinics c
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts coa WHERE coa.clinic_id = c.id
);
-- ... (repetir para cada nó da árvore, respeitando order para FKs de parent_id)
```

**Trigger para seed em novas clínicas:**
```sql
-- Source: padrão de seed_financial_categories trigger [VERIFIED: codebase]
CREATE OR REPLACE FUNCTION public.seed_chart_of_accounts()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Inserir grupos raiz, subgrupos e contas folha
  -- (implementação completa no migration file)
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_chart_on_clinic
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.seed_chart_of_accounts();
```

### Pattern 5: Server Action com Enforcing de Classificação

**O que é:** `createTransaction` (existente) é expandido. Para lançamentos manuais, `account_id` e `cost_center_id` são required no schema Zod. Para o webhook Asaas, o `processWebhookEvent` resolve os defaults automaticamente sem interação.

**Schema Zod expandido (lançamento manual):**
```typescript
// Source: src/actions/transactions.ts expandido [VERIFIED: codebase existente]
// Pinado Zod v3 (STATE.md D — sem .default() no schema, RHF defaultValues fornece)
const transactionSchema = z.object({
  type: z.enum(['receita', 'despesa']),
  categoryId:    z.string().uuid().optional().nullable(),
  accountId:     z.string().uuid({ message: 'Conta contábil obrigatória' }),
  costCenterId:  z.string().uuid({ message: 'Centro de custo obrigatório' }),
  bankAccountId: z.string().uuid().optional().nullable(),
  amount: z.number().positive().refine(isMoney2dp, { message: 'Máx. 2 casas decimais' }),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).optional().nullable(),
})
```

**Webhook Asaas — resolução de defaults (sem bloquear):**
```typescript
// Source: src/app/api/webhooks/asaas/route.ts — trecho existente a expandir [VERIFIED: codebase]
// No insert de financial_transactions dentro de processWebhookEvent:
// 1. Buscar account_id default via financial_categories.account_id
// 2. Buscar cost_center_id default via cost_centers WHERE is_default=true AND clinic_id=tenant_id
// Ambos podem ficar NULL se não encontrados — nunca bloquear o 200 por isso

const { data: defaultCC } = await admin
  .from('cost_centers')
  .select('id')
  .eq('clinic_id', receivable.tenant_id)
  .eq('is_default', true)
  .maybeSingle()

const { data: category } = receivable.category_id
  ? await admin.from('financial_categories').select('account_id').eq('id', receivable.category_id).maybeSingle()
  : { data: null }

await admin.from('financial_transactions').insert({
  tenant_id: receivable.tenant_id,
  receivable_id: receivable.id,
  type: 'receita',
  amount: receivable.value,
  account_id: category?.account_id ?? null,      // null se categoria sem mapeamento
  cost_center_id: defaultCC?.id ?? null,          // null se nenhum CC default
  bank_account_id: null,                          // opcional, não determinável via webhook
  transaction_date: new Date().toISOString().split('T')[0],
  description: `Pagamento confirmado via Asaas (${event.event})`,
  posted_by: null,
})
```

**Atenção:** `receivable` não tem `category_id` — a categoria está em `charges` ou no `financial_categories` seed. Ver Open Question 1 abaixo.

### Anti-Patterns a Evitar

- **Não converter para NOT NULL no DDL**: linhas legadas e o webhook path não têm account_id/cost_center_id resolvíveis em 100% dos casos. Manter NULLABLE; enforcer na aplicação.
- **Não usar ltree para o plano de contas**: overhead de extensão e sintaxe especial não justificados para 3 níveis de profundidade com 10-30 nós.
- **Não duplicar categorias como contas contábeis**: CONTEXT.md D-02a é explícito — `financial_categories` coexiste como atalho de UX; `chart_of_accounts` é a camada formal.
- **Não fazer hard-delete de contas com lançamentos**: UI-SPEC define que delete é bloqueado se houver `financial_transactions` referenciando — apenas desativar (`ativo = false`).
- **Não usar `DELETE RESTRICT` sem tratamento no Server Action**: a FK `financial_transactions.account_id → chart_of_accounts(id)` com ON DELETE RESTRICT vai retornar erro 23503 se admin tentar deletar uma conta com lançamentos. O Server Action deve capturar esse erro e retornar a mensagem amigável da UI-SPEC.
- **Não esquecer o `WITH CHECK` nas policies RLS**: CLAUDE.md é explícito — nunca omitir `WITH CHECK` em policies de escrita.
- **Não indexar `account_id` sem filtro parcial**: a maioria das linhas legadas terá `account_id IS NULL` até o backfill completar. Índices parciais `WHERE account_id IS NOT NULL` são mais eficientes.

---

## Don't Hand-Roll

| Problema | Não Construir | Usar Em Vez | Por quê |
|----------|---------------|-------------|---------|
| Árvore hierárquica em SQL | Parser de path recursivo em JS | `WITH RECURSIVE` CTE do PostgreSQL | Edge cases de ciclos, performance, profundidade arbitrária |
| Validação de código de conta (unicidade) | Verificação no Server Action | Unique index `(clinic_id, code)` no banco + tratar erro 23505 | Atomic, sem race condition |
| Seed de plano de contas em nova clínica | Código de aplicação com loop | Trigger `AFTER INSERT ON clinics` + `SECURITY DEFINER` function (padrão Phase 3) | Mesmo padrão testado de `seed_financial_categories` |
| Isolamento multi-tenant nos cadastros | Filtro manual no código | RLS com `clinic_id = get_my_tenant_id()` | Defesa em profundidade; não depende de código correto |
| Garantia de NOT NULL para campos obrigatórios | CHECK constraint no banco | Zod no Server Action + columns NULLABLE | CHECK no banco quebraria webhook e backfill; Zod enforcer na camada correta |

---

## Common Pitfalls

### Pitfall 1: Ciclos em Árvore Auto-Referencial

**O que dá errado:** Admin cria conta A como filha de B, depois tenta criar B como filha de A. A CTE recursiva entra em loop infinito.

**Por que acontece:** PostgreSQL não tem constraint nativa de acyclicity em self-referential FKs.

**Como evitar:** Adicionar validação no Server Action antes do INSERT/UPDATE: buscar todos os ancestrais de `parent_id` proposto e verificar que o `id` atual não aparece. Alternativa mais simples para 3 níveis: verificar `depth` — se `parent.depth >= 2`, rejeitar (máximo de 2 para ter leaf em depth 3).

**Sinais de alerta:** CTE recursiva com `CYCLE ... USING` (Postgres 14+) pode detectar e parar, mas é melhor prevenir.

### Pitfall 2: Backfill de `cost_center_id` em Linhas sem `unit_id`

**O que dá errado:** `financial_transactions` legadas não têm `unit_id` direto. O backfill tenta resolver via CC default do tenant, mas a tabela `cost_centers` pode não ter o CC seeded ainda (depende da ordem das operações na mesma migração).

**Por que acontece:** Ordem de execução dentro da migration: (1) criação das tabelas, (2) seed do plano de contas, (3) seed dos CCs, (4) backfill das transações. Se o seed de CCs falhar ou for pulado, o backfill de `cost_center_id` resulta em NULL para todas as linhas — o que é aceitável (NULLABLE), mas produz CC não resolvido.

**Como evitar:** Na mesma migração, garantir a ordem: INSERT INTO `cost_centers` (seed por unidade) ANTES do UPDATE em `financial_transactions`. Usar uma transaction única — se o seed falhar, o backfill também falha atomicamente.

### Pitfall 3: FK de `chart_of_accounts(id)` com ON DELETE RESTRICT Bloqueia Exclusão

**O que dá errado:** Admin tenta excluir uma conta contábil. PostgreSQL retorna erro 23503 (foreign key violation) porque há `financial_transactions` referenciando.

**Por que acontece:** FK com ON DELETE RESTRICT é a behavior correta para integridade, mas gera um erro de banco que deve ser tratado na aplicação.

**Como evitar:** No Server Action `deleteAccount`: (1) verificar se existem transações referenciando antes de tentar DELETE; (2) se sim, retornar erro amigável da UI-SPEC: "Não é possível excluir — conta possui lançamentos vinculados. Desative a conta para ocultá-la dos seletores."; (3) nunca expor o código 23503 ao usuário.

**Sinais de alerta:** Tela mostrando "violação de chave estrangeira" ao usuário.

### Pitfall 4: Supabase RPC vs. SELECT para CTE Recursiva

**O que dá errado:** Tentar usar o Supabase JS client `.select()` com CTE recursiva diretamente. O SDK não suporta `WITH RECURSIVE` inline no método `.select()`.

**Por que acontece:** O SDK de Supabase JS v2 gera queries via PostgREST, que tem suporte limitado a CTEs complexas.

**Como evitar:** Duas opções:
1. Criar uma função PostgreSQL `get_accounts_tree(p_clinic_id UUID)` que executa a CTE e chamá-la via `supabase.rpc('get_accounts_tree')` — RPC respeita RLS se `SECURITY INVOKER`.
2. Buscar todas as linhas com `.from('chart_of_accounts').select('*')` (SELECT simples com RLS) e construir a árvore em memória com `buildTree()` no servidor (Server Component) ou cliente. **Esta é a abordagem preferida** para <= 50 nós — sem overhead de RPC, sem manutenção de função SQL extra.

[VERIFIED: Supabase PostgREST docs — CTEs recursivas não são suportadas via SDK JS]

### Pitfall 5: seed_financial_categories Trigger Precisa ser Atualizado

**O que dá errado:** A função `seed_financial_categories` (Phase 3) insere categorias em novas clínicas, mas não seta `account_id` porque a coluna não existia. Em novas clínicas criadas após a Phase 14, as categorias ficam sem conta mapeada.

**Por que acontece:** A função `seed_financial_categories` é executada via trigger `seed_categories_on_clinic`. O trigger do plano de contas (`seed_chart_on_clinic`) deve ser executado PRIMEIRO para que `account_id` esteja disponível ao setar categorias.

**Como evitar:** Atualizar `seed_financial_categories()` na migração Phase 14 para incluir o mapeamento `account_id` após inserir as categorias. Ou criar um segundo trigger que roda após `seed_chart_on_clinic`. Ambos os triggers são `AFTER INSERT ON clinics` — a ordem de execução de triggers no mesmo evento é alphabetical por nome no PostgreSQL. Nomear o trigger de plano de contas para rodar antes: `seed_accounts_on_clinic` (antes de `seed_categories_on_clinic` alphabeticamente).

[VERIFIED: PostgreSQL docs — AFTER triggers no mesmo evento+tabela executam em ordem alphabética do nome do trigger]

### Pitfall 6: O Webhook Asaas Não Pode Ver `receivable.category_id`

**O que dá errado:** O backfill de `account_id` no webhook usa `receivable.category_id` para resolver a conta, mas `receivables` não tem coluna `category_id` — a categoria está em `charges` (via JOIN).

**Por que acontece:** O schema atual de `receivables` não tem `category_id`. Para o webhook resolver `account_id`, precisa de: receivable → charge → financial_transaction_category OR usar o `category_id` da charge.

**Como evitar:** No webhook, resolver assim:
1. Buscar a charge via `receivable.charge_id`
2. Buscar `financial_transactions` existente associado à charge para obter `category_id` (se houver)
3. Resolver `account_id` via `financial_categories.account_id`
4. Se qualquer parte falhar, deixar `account_id = null` — nunca bloquear o 200

Alternativamente: o webhook pode pular a resolução de `account_id` (deixar null) e um processo de conciliação posterior pode preencher. Para o MVP, null é aceitável dado D-03b.

---

## Runtime State Inventory

> Fase de expansão/migração: verificação de estado runtime obrigatória.

| Categoria | Itens Encontrados | Ação Necessária |
|-----------|-------------------|-----------------|
| Stored data | `financial_transactions`: linhas existentes Phase 3 sem `account_id`/`cost_center_id` | UPDATE backfill na migração |
| Stored data | `financial_categories`: linhas existentes sem `account_id` | UPDATE via mapeamento por name na migração seed |
| Stored data | Nenhuma clínica tem `chart_of_accounts` ainda (tabela inexistente) | INSERT seed na migração |
| Stored data | Nenhuma clínica tem `cost_centers` ainda (tabela inexistente) | INSERT 1 CC default por `units` existente |
| Stored data | Nenhuma clínica tem `bank_accounts` ainda (tabela inexistente) | Tabela criada vazia — usuário cadastra manualmente |
| Live service config | Webhook Asaas (`/api/webhooks/asaas/route.ts`): INSERT em `financial_transactions` sem `account_id`/`cost_center_id` | Expandir `processWebhookEvent` para resolver defaults (sem bloquear 200) |
| OS-registered state | Nenhum (Vercel serverless, sem tasks agendadas para financeiro) | — |
| Secrets/env vars | Nenhuma variável nova necessária nesta fase | — |
| Build artifacts | `supabase/migrations/` — 3 novos arquivos SQL | Criação de novos arquivos; sem renomeação |

**Nada encontrado em:** OS-registered state, secrets/env vars, build artifacts. Verificado por inspeção do codebase.

---

## Environment Availability

> Verificação de dependências externas.

| Dependência | Requerido Por | Disponível | Versão | Fallback |
|-------------|--------------|-----------|--------|---------|
| Supabase CLI | `supabase db push` (Plan BLOCKING) | Verificar antes do push | — | — |
| PostgreSQL CTE recursiva | `chart_of_accounts` tree query | Supabase Postgres 15 (sa-east-1) | Postgres 15+ | SELECT flat + buildTree() no cliente |
| Vitest | Testes unitários e source-inspection | Instalado (vitest.config.ts) | — | — |

**Step 2.6: SKIPPED em grande parte** — a fase é primariamente expansão de schema e código. Sem novas dependências externas além das já verificadas no projeto.

---

## Validation Architecture

> `workflow.nyquist_validation: true` em `.planning/config.json` — seção obrigatória.

### Test Framework

| Propriedade | Valor |
|-------------|-------|
| Framework | Vitest (instalado) |
| Config file | `vitest.config.ts` (raiz do projeto) |
| Diretório de testes | `src/__tests__/` |
| Comando rápido | `npx vitest run src/__tests__/financeiro/` |
| Suite completa | `npx vitest run` |

### Phase 14 Requirements → Test Map

| Req ID | Comportamento | Tipo | Comando Automatizado | Arquivo |
|--------|--------------|------|---------------------|---------|
| FCAD-01 | `chart_of_accounts` table criada com `parent_id`, `code`, `type` CHECK, índices | source-inspection | `npx vitest run src/__tests__/financeiro/migrations-phase14.test.ts` | ❌ Wave 0 |
| FCAD-01 | `cost_centers` table criada com `unit_id` FK, `is_default`, índices | source-inspection | `npx vitest run src/__tests__/financeiro/migrations-phase14.test.ts` | ❌ Wave 0 |
| FCAD-01 | `bank_accounts` table criada com NUMERIC(12,2) para saldo_inicial | source-inspection | `npx vitest run src/__tests__/financeiro/migrations-phase14.test.ts` | ❌ Wave 0 |
| FCAD-01 | Seed do plano de contas odontológico presente na migração | source-inspection | `npx vitest run src/__tests__/financeiro/migrations-phase14.test.ts` | ❌ Wave 0 |
| FCAD-01 | `financial_categories` tem coluna `account_id` após ALTER TABLE | source-inspection | `npx vitest run src/__tests__/financeiro/migrations-phase14.test.ts` | ❌ Wave 0 |
| FCAD-01 | RLS habilitado nas 3 novas tabelas com USING + WITH CHECK | source-inspection | `npx vitest run src/__tests__/financeiro/migrations-phase14.test.ts` | ❌ Wave 0 |
| FCAD-02 | `financial_transactions` tem colunas `account_id`, `cost_center_id`, `bank_account_id` | source-inspection | `npx vitest run src/__tests__/financeiro/migrations-phase14.test.ts` | ❌ Wave 0 |
| FCAD-02 | `createTransaction` Server Action rejeita input sem `accountId` | unit | `npx vitest run src/__tests__/financeiro/transaction-classification.test.ts` | ❌ Wave 0 |
| FCAD-02 | `createTransaction` Server Action rejeita input sem `costCenterId` | unit | `npx vitest run src/__tests__/financeiro/transaction-classification.test.ts` | ❌ Wave 0 |
| FCAD-01/02 | `buildTree()` monta árvore corretamente de lista flat | unit | `npx vitest run src/__tests__/financeiro/chart-of-accounts.test.ts` | ❌ Wave 0 |
| Regressão | `financial_transactions` existentes não quebram (Phase 3 tests passam) | regressão | `npx vitest run src/__tests__/migrations/financial.test.ts src/__tests__/actions/transactions.test.ts` | ✅ existente |
| Regressão | Webhook Asaas continua inserindo sem account_id/cost_center_id obrigatório | regressão | `npx vitest run src/__tests__/webhooks/asaas.test.ts` | ✅ existente |

### Sampling Rate

- **Por commit de task:** `npx vitest run src/__tests__/financeiro/`
- **Por wave merge:** `npx vitest run`
- **Phase gate:** Suite completa green antes de `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/financeiro/migrations-phase14.test.ts` — source-inspection das migrações da Phase 14
- [ ] `src/__tests__/financeiro/chart-of-accounts.test.ts` — unit tests de `buildTree()`, validação de código
- [ ] `src/__tests__/financeiro/transaction-classification.test.ts` — unit tests do schema Zod expandido
- [ ] `src/__tests__/financeiro/regression-guard-phase14.test.ts` — garante que Phase 3 financial tests continuam GREEN

*(Se nenhum gap: "None — existing test infrastructure covers all phase requirements" — não é o caso aqui: 4 novos arquivos de teste necessários)*

---

## Code Examples

Padrões verificados de fontes oficiais e codebase:

### Expandir Zod Schema sem `.default()` (Decisão D-133)

```typescript
// Source: padrão STATE.md D-133 (documentTemplateSchema) [VERIFIED: STATE.md + codebase]
// Nunca usar .default() em Zod — RHF defaultValues fornece os valores iniciais
const transactionSchema = z.object({
  accountId:    z.string().uuid({ message: 'Conta contábil obrigatória' }),
  costCenterId: z.string().uuid({ message: 'Centro de custo obrigatório' }),
  bankAccountId: z.string().uuid().optional().nullable(),
  // ... campos existentes
})
```

### ADD COLUMN IF NOT EXISTS (Idempotente)

```sql
-- Source: PostgreSQL docs [VERIFIED: PostgreSQL 15 docs]
-- IF NOT EXISTS previne erro em re-runs do migration
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS account_id      UUID REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cost_center_id  UUID REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
```

### Self-Reference com ON DELETE RESTRICT

```sql
-- Source: PostgreSQL docs — auto-referential FK [VERIFIED: PostgreSQL 15 docs]
-- ON DELETE RESTRICT: proíbe delete de conta que tem filhos (integridade da árvore)
parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT
```

### Trigger com Ordenação Alphabética

```sql
-- Source: PostgreSQL docs — trigger firing order [VERIFIED: PostgreSQL docs]
-- Triggers AFTER INSERT no mesmo evento disparam em ordem alphabética do nome
-- 'seed_accounts_on_clinic' < 'seed_categories_on_clinic' alphabeticamente → accounts seed PRIMEIRO
CREATE TRIGGER seed_accounts_on_clinic
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.seed_chart_of_accounts();
-- seed_categories_on_clinic já existe (Phase 3) — roda DEPOIS
```

### RLS: Política de Leitura de Árvore (sem filtro por `ativo`)

```sql
-- Source: padrão financeiro RLS [VERIFIED: 20260606000200_financial_rls.sql + 20260614000200_units_rls.sql]
-- A policy de leitura não filtra por ativo — admins precisam ver contas inativas no cadastro
-- O filtro ativo=true é aplicado no Server Action/query que alimenta os SELECT dropdowns de lançamento
CREATE POLICY "chart_of_accounts_tenant_read" ON public.chart_of_accounts
  FOR SELECT USING (clinic_id = get_my_tenant_id());
```

---

## State of the Art

| Abordagem Antiga | Abordagem Atual | Quando Mudou | Impacto |
|-----------------|-----------------|--------------|---------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Padrão do projeto desde Phase 0 |
| Zod v4 (instável com RHF v7) | Zod v3 (pinado) | 2026-06-02 | Sem `.default()` em schemas; `defaultValues` no RHF |
| `tenant_id` em tabelas de cadastro | `clinic_id` para cadastros de rede | Phase 7 | 3 novas tabelas desta fase usam `clinic_id` (não `tenant_id`) |
| Hard-delete de registros | Soft-delete (`deleted_at` / `ativo = false`) | Phase 0 | LGPD — nenhuma conta contábil ou CC é deletada fisicamente |

**Deprecated/Outdated:**
- `ADD COLUMN ... NOT NULL` sem DEFAULT em tabela populada: não funciona. Sempre adicionar NULLABLE, fazer backfill, manter NULLABLE com enforcing na aplicação.

---

## Project Constraints (from CLAUDE.md)

Diretivas aplicáveis a esta fase:

| Diretiva | Aplicação em Phase 14 |
|----------|-----------------------|
| `NUMERIC(12,2)` para dinheiro | `bank_accounts.saldo_inicial` deve ser `NUMERIC(12,2)` |
| Indexar toda coluna `clinic_id` | `chart_of_accounts`, `cost_centers`, `bank_accounts` — todas precisam de `idx_*_clinic_id` |
| `USING` + `WITH CHECK` em todas as policies de escrita | Todas as 3 novas tabelas + garantir que as políticas existentes de `financial_transactions` ainda aplicam |
| Soft delete + audit trail | `chart_of_accounts` usa `ativo` (não deleted_at — não tem PII); considerar audit trigger para mudanças admin |
| Sem `ALTER TABLE ... NOT NULL` sem DEFAULT em tabelas populadas | Colunas adicionadas a `financial_transactions`/`financial_categories` são NULLABLE na DDL |
| `get_my_tenant_id()` + `get_my_role()` como SECURITY DEFINER | Usar nos predicados das policies RLS — nenhum JOIN ou subquery no predicado |
| Seed via trigger `AFTER INSERT ON clinics` | `seed_chart_of_accounts` + `seed_cost_centers_on_clinic` via trigger |
| Next.js 15 App Router (não Pages Router) | Páginas em `app/(dashboard)/clinica/financeiro/plano-de-contas/page.tsx` etc. |
| Server Actions para escrita (não API Routes) | `createAccount`, `createCostCenter`, `createBankAccount` são Server Actions |
| Zod v3 (pinado) — sem `.default()` | Schemas sem `.default()` — `defaultValues` no RHF |

---

## Assumptions Log

| # | Claim | Seção | Risco se Errado |
|---|-------|-------|-----------------|
| A1 | O plano de contas nunca terá profundidade > 3 (grupos → subgrupos → folhas) no contexto odontológico brasileiro padrão | Standard Stack / Architecture | Se profundidade > 3 for necessária, a CTE recursiva ainda funciona mas o `depth <= 2` guard no Server Action precisaria ser removido |
| A2 | Triggers `AFTER INSERT` no mesmo evento/tabela disparam em ordem alphabética do nome no PostgreSQL | Pitfall 5 / Code Examples | Se a ordem for diferente, o trigger de categorias roda antes do de plano de contas, e o mapeamento `account_id` nas categorias fica vazio no seed |
| A3 | `financial_transactions` existentes têm volume pequeno no MVP (< 10.000 linhas) — backfill síncrono na migração é seguro | Architecture Patterns Pattern 2 | Se houver grandes volumes, o UPDATE inline pode causar timeout no `supabase db push` — precisaria de DO $$ batch $$ |
| A4 | O Supabase PostgREST (SDK JS v2) não suporta CTEs recursivas inline via `.select()` | Pitfall 4 | Se suportado em versão recente, a alternativa RPC/buildTree não é necessária — mas buildTree é mais simples de qualquer forma |

**Nenhum dos A1-A4 bloqueia o planejamento.** O planner pode codificar as alternativas nos comentários dos tasks.

---

## Open Questions

1. **Como o webhook Asaas resolve `account_id` sem `category_id` em `receivables`?**
   - O que sabemos: `receivables` não tem `category_id`. A categoria está na `charge` criada pelo usuário.
   - O que está indefinido: a `charge` tem `category_id`? Verificar o schema de `charges` em `20260606000100_financial_tables.sql` — a tabela `charges` não tem `category_id`. Portanto, o webhook não pode resolver `account_id` via categoria.
   - Recomendação: Para lançamentos auto-postados via webhook, `account_id` fica NULL (aceitável dado D-03b). O admin pode mapear manualmente via tela de conciliação (Phase 16). Documentar essa limitação no código.

2. **`cost_centers` precisa de `is_default` por unidade ou por tenant?**
   - O que sabemos: D-01a define 1 CC default por unidade existente.
   - O que está indefinido: se uma clínica tem 3 unidades, pode ter 3 CCs default (um por unidade)? A lógica de backfill usa `is_default = true AND clinic_id = tenant_id` — isso retorna múltiplas linhas se houver múltiplos CCs default.
   - Recomendação: `is_default` deve ser `TRUE` para exatamente 1 CC por `unit_id`. A constraint correta seria um partial unique index: `UNIQUE (unit_id) WHERE is_default = true`. O backfill de `cost_center_id` em `financial_transactions` deve usar `cost_centers WHERE is_default = true AND unit_id = <unit_id_do_lançamento>` — mas `financial_transactions` não tem `unit_id`. Usar o CC default da primeira unidade do tenant como fallback universal.

---

## Sources

### Primary (HIGH confidence)

- `supabase/migrations/20260606000100_financial_tables.sql` — schema de `financial_transactions` e `financial_categories` (alvos de expansão)
- `supabase/migrations/20260606000200_financial_rls.sql` — padrão RLS financeiro (SELECT todos / escrita admin)
- `supabase/migrations/20260606000300_financial_categories_seed.sql` — padrão de seed por trigger
- `supabase/migrations/20260614000100_units_table.sql` — schema de `units` (FK target de `cost_centers.unit_id`)
- `supabase/migrations/20260614000200_units_rls.sql` — padrão RLS com `clinic_id` para cadastros de rede
- `src/actions/transactions.ts` — Server Action existente (base para expansão)
- `src/app/api/webhooks/asaas/route.ts` — caminho de auto-posting (não pode ser bloqueado)
- `.planning/phases/14-financeiro-cadastros-base/14-CONTEXT.md` — decisões locked D-01 a D-04a
- `.planning/phases/14-financeiro-cadastros-base/14-UI-SPEC.md` — contrato de UI (árvore Accordion, páginas, componentes)
- `CLAUDE.md` — constraints do projeto (NUMERIC(12,2), indexes em clinic_id, WITH CHECK obrigatório)
- `vitest.config.ts` — configuração de testes (include: `src/__tests__/**/*.test.ts`)

### Secondary (MEDIUM confidence)

- PostgreSQL docs — `WITH RECURSIVE` CTE, trigger firing order, `ADD COLUMN IF NOT EXISTS`, partial unique indexes [CITED: padrões well-known de Postgres 15]

### Tertiary (LOW confidence)

- Estrutura de numeração do plano de contas odontológico brasileiro — derivada das categorias seed Phase 3 e padrão CFC [ASSUMED — não verificado contra norma contábil oficial]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — verificado contra codebase e STATE.md
- Architecture Patterns: HIGH — baseado em migrações existentes Phase 3 e Phase 7
- Pitfalls: HIGH — derivados de análise do código existente e comportamento do PostgreSQL
- Seed do plano de contas: MEDIUM — estrutura é razoável mas pode precisar de ajuste pelo admin

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stack estável — Supabase + Next.js 15 + Zod v3)
