---
phase: 14-financeiro-cadastros-base
verified: 2026-06-20T23:07:00Z
status: human_needed
score: 6/8 must-haves verified (2 deferred to human visual review)
overrides_applied: 0
human_verification:
  - test: "Plano de Contas tree renders correctly in browser (FCAD-01 SC1 visual)"
    expected: "Tree shows seeded odontological hierarchy (1 Receitas → 1.1 → 1.1.1 Consultas … 2 Despesas → 2.1 → 2.1.4 Laboratório), all groups expanded by default, account codes monospaced and aligned, type badges colored correctly, inactive accounts show strikethrough. Admin sees Edit + Add Child buttons on hover; socio role sees read-only tree with no action buttons."
    why_human: "Visual tree rendering, hover-state affordances, and role-gated button visibility require browser verification — not verifiable by static grep or test suite."
  - test: "Transaction modal required classification fields work correctly (FCAD-02 SC2 visual + behavioral)"
    expected: "(1) Submitting the modal without Conta Contábil / Centro de Custo shows inline 'Campo obrigatório' on both fields. (2) Selecting a mapped Categoria auto-fills Conta Contábil with helper 'Preenchido automaticamente pela categoria'. (3) Centro de Custo pre-selects the default CC. (4) Applying the Unidade / Centro de Custo filter on fluxo de caixa narrows the list and URL carries ?cc= and ?unit= that survive page refresh."
    why_human: "Form validation feedback, auto-fill UX, and URL-state filter behavior require browser interaction — not verifiable statically."
---

# Phase 14: Financeiro Cadastros Base — Verification Report

**Phase Goal:** O financeiro estrutura o plano de contas em árvore, centros de custo por unidade, contas correntes e categorias, e todos os lançamentos passam a ser classificados por conta contábil e centro de custo.
**Verified:** 2026-06-20T23:07:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Financeiro cria e edita o plano de contas em estrutura hierárquica; árvore visualizada na tela de cadastro | ✓ VERIFIED | `ChartOfAccountsTree.tsx` (255 lines, Accordion-based recursive tree, `canEdit` prop, inactive strikethrough); `plano-de-contas/page.tsx` calls `listAccountsTree()` and passes `canEdit={isAdmin}` |
| 2  | Lançamento financeiro classifica conta contábil e centro de custo obrigatoriamente | ✓ VERIFIED | `transactionClassificationSchema` enforces both fields (84/84 tests GREEN); `createTransaction` inserts `account_id: data.accountId`, `cost_center_id: data.costCenterId`; `TransactionModal.tsx` passes both to the Server Action |
| 3  | Filtro por unidade/centro de custo funciona nas telas de fluxo de caixa e relatórios | ✓ VERIFIED | `CashFlowFilters.tsx` (nuqs `useQueryState` for `?unit=` and `?cc=`); `fluxo-de-caixa/page.tsx` passes `costCenterId` and `unitId` to `listTransactions`; `listTransactions` in `transactions.ts` filters via `.eq('cost_center_id', costCenterId)` / `.in('cost_center_id', ids)` |
| 4  | Centros de custo cadastráveis por unidade; contas correntes cadastráveis | ✓ VERIFIED | `centros-de-custo/page.tsx` calls `listCostCenters()`; `contas-correntes/page.tsx` calls `listBankAccounts()`; `CostCentersTable.tsx` (130 lines) and `BankAccountsTable.tsx` (99 lines) are substantive |
| 5  | Categoria linked to chart-of-accounts leaf; mapping editable | ✓ VERIFIED | `CategoriesAccountMappingTable.tsx` (181 lines) calls `updateCategoryAccount`; status badges "Mapeada"/"Sem conta" present; `categorias/page.tsx` calls `listCategoriesWithAccounts()` |
| 6  | Schema: 3 new tables (chart_of_accounts, cost_centers, bank_accounts) with RLS and backfill applied | ✓ VERIFIED | All 3 migration files exist and pass 48/48 source-inspection assertions; `database.types.ts` contains all 5 new identifiers; Plan 03 SUMMARY confirms push succeeded with no backfill RAISE EXCEPTION |
| T1 | Tree renders correctly in browser (admin CRUD + read-only mode) | ? HUMAN NEEDED | Code is wired and substantive — visual rendering/interaction requires browser |
| T2 | Modal required-field enforcement + category auto-fill + filter URL state in browser | ? HUMAN NEEDED | Form validation feedback and nuqs URL persistence require browser verification |

**Score:** 6/6 automatically-verifiable truths confirmed. 2 items routed to human visual review.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260619001100_financial_cadastros_tables.sql` | 3 tables + ALTERs | ✓ VERIFIED | 147 lines; chart_of_accounts, cost_centers, bank_accounts; partial unique index on cost_centers; NULLABLE ALTERs on financial_transactions (D-03b confirmed) |
| `supabase/migrations/20260619001200_financial_cadastros_rls.sql` | RLS for 3 tables | ✓ VERIFIED | 72 lines; 3 ENABLE RLS + 6 policies (tenant_read + admin_write per table); 5 WITH CHECK clauses verified |
| `supabase/migrations/20260619001300_financial_cadastros_seed.sql` | Seed + backfill + triggers | ✓ VERIFIED | 302 lines; `seed_chart_of_accounts()` fn + `seed_accounts_on_clinic` trigger; RAISE EXCEPTION guard; all backfills present |
| `src/lib/supabase/database.types.ts` (actual: `src/types/database.types.ts`) | Regenerated types | ✓ VERIFIED | Contains chart_of_accounts, cost_centers, bank_accounts, account_id, cost_center_id |
| `src/lib/financeiro/chart-tree.ts` | buildTree + nextChildCode | ✓ VERIFIED | 70 lines; exports both functions; pure lib (no 'use server' directive — comment only) |
| `src/lib/financeiro/transaction-schema.ts` | transactionClassificationSchema | ✓ VERIFIED | 53 lines; accountId + costCenterId required with correct Zod required_error messages; bankAccountId optional |
| `src/actions/chart-of-accounts.ts` | listAccountsTree, createAccount, updateAccount | ✓ VERIFIED | 334 lines; all 3 exports present; WRITE_ROLES gate; FK friendly error string present |
| `src/actions/cost-centers.ts` | listCostCenters, createCostCenter, updateCostCenter | ✓ VERIFIED | 160 lines; all 3 exports present |
| `src/actions/bank-accounts.ts` | listBankAccounts, createBankAccount, updateBankAccount | ✓ VERIFIED | 155 lines; all 3 exports present |
| `src/actions/categories.ts` | listCategoriesWithAccounts, updateCategoryAccount | ✓ VERIFIED | 155 lines; both exports present |
| `src/actions/transactions.ts` | transactionClassificationSchema import + filter opts | ✓ VERIFIED | Imports schema; inserts account_id + cost_center_id; costCenterId/unitId filter opts present |
| `src/app/api/webhooks/asaas/route.ts` | Non-blocking default CC resolution | ✓ VERIFIED | is_default lookup present; account_id: null; status: 200 unconditional |
| `src/components/financeiro/ChartOfAccountsTree.tsx` | Accordion tree ≥ 60 lines | ✓ VERIFIED | 255 lines; Accordion; canEdit prop; line-through for inactive |
| `src/components/financeiro/AccountFormDialog.tsx` | create/edit dialog | ✓ VERIFIED | 332 lines; "Salvar Conta" + "Nova Conta Contábil" copy present |
| `src/app/(dashboard)/clinica/financeiro/plano-de-contas/page.tsx` | RSC fetching listAccountsTree | ✓ VERIFIED | listAccountsTree call + ChartOfAccountsTree render + canEdit={isAdmin} |
| `src/app/(dashboard)/clinica/financeiro/plano-de-contas/loading.tsx` | Skeleton | ✓ VERIFIED | Exists |
| `src/app/(dashboard)/clinica/financeiro/plano-de-contas/error.tsx` | Error boundary | ✓ VERIFIED | Exists |
| `src/app/(dashboard)/clinica/financeiro/page.tsx` | 3 new cadastro hub cards | ✓ VERIFIED | "Plano de Contas", "Centros de Custo", "Contas Correntes" + GitBranch icon |
| `src/components/financeiro/CostCentersTable.tsx` | Table ≥ 40 lines | ✓ VERIFIED | 130 lines |
| `src/components/financeiro/BankAccountsTable.tsx` | Table ≥ 40 lines | ✓ VERIFIED | 99 lines |
| `src/app/(dashboard)/clinica/financeiro/centros-de-custo/page.tsx` | RSC fetching listCostCenters | ✓ VERIFIED | listCostCenters call present |
| `src/app/(dashboard)/clinica/financeiro/contas-correntes/page.tsx` | RSC fetching listBankAccounts | ✓ VERIFIED | listBankAccounts call present |
| `src/components/financeiro/TransactionModal.tsx` | Classification fields | ✓ VERIFIED | Centro de Custo + costCenterId + accountId + "Preenchido automaticamente pela categoria" + "Conta contábil obrigatória" all present; call site passes all 3 classification fields to createTransaction |
| `src/components/financeiro/CategoriesAccountMappingTable.tsx` | Mapping table ≥ 40 lines | ✓ VERIFIED | 181 lines; updateCategoryAccount call; "Mapeada"/"Sem conta" badges |
| `src/components/financeiro/CashFlowFilters.tsx` | nuqs filters ≥ 30 lines | ✓ VERIFIED | 113 lines; useQueryState from nuqs |
| `src/app/(dashboard)/clinica/financeiro/categorias/page.tsx` | RSC fetching listCategoriesWithAccounts | ✓ VERIFIED | listCategoriesWithAccounts call present |
| `src/__tests__/financeiro/migrations-phase14.test.ts` | Source-inspection ≥ 60 lines | ✓ VERIFIED | 303 lines; 48/48 assertions GREEN |
| `src/__tests__/financeiro/chart-of-accounts.test.ts` | buildTree unit tests ≥ 30 lines | ✓ VERIFIED | 151 lines; 6/6 GREEN |
| `src/__tests__/financeiro/transaction-classification.test.ts` | Zod schema tests ≥ 30 lines | ✓ VERIFIED | 168 lines; 9/9 GREEN |
| `src/__tests__/financeiro/regression-guard-phase14.test.ts` | Phase 3 regression guard ≥ 15 lines | ✓ VERIFIED | 51 lines; GREEN |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `migrations-phase14.test.ts` | `supabase/migrations/20260619001*.sql` | readFileSync source inspection | ✓ WIRED | 48/48 assertions pass GREEN |
| `financial_categories.account_id` | `chart_of_accounts.id` (leaf) | UPDATE backfill + category seed | ✓ WIRED | `UPDATE public.financial_categories … SET account_id` present in seed migration; `seed_financial_categories()` recreated |
| `financial_transactions.cost_center_id` | `cost_centers.id` (is_default) | UPDATE backfill in seed | ✓ WIRED | `UPDATE public.financial_transactions … SET cost_center_id` + `is_default = true` + RAISE EXCEPTION guard |
| `plano-de-contas/page.tsx` | `src/actions/chart-of-accounts.ts` | listAccountsTree() | ✓ WIRED | Import + call confirmed |
| `ChartOfAccountsTree.tsx` | `AccountFormDialog.tsx` | edit/add-child opens dialog | ✓ WIRED | AccountFormDialog referenced in ChartOfAccountsTree |
| `centros-de-custo/page.tsx` | `src/actions/cost-centers.ts` | listCostCenters() | ✓ WIRED | Import + call confirmed |
| `contas-correntes/page.tsx` | `src/actions/bank-accounts.ts` | listBankAccounts() | ✓ WIRED | Import + call confirmed |
| `src/actions/transactions.ts createTransaction` | `transactionClassificationSchema` | import + safeParse | ✓ WIRED | Import confirmed; INSERT includes account_id + cost_center_id |
| `src/app/api/webhooks/asaas/route.ts` | `cost_centers` (is_default) | best-effort try/catch before insert | ✓ WIRED | is_default query present; account_id: null; status 200 unconditional |
| `TransactionModal.tsx` | `createTransaction` (accountId + costCenterId) | Server Action call with classification fields | ✓ WIRED | Call site at line 160 passes accountId, costCenterId, bankAccountId |
| `fluxo-de-caixa/page.tsx` | `listTransactions(month, { costCenterId, unitId })` | filter params from searchParams | ✓ WIRED | listTransactions called with costCenterId + unitId from params at line 86 |
| `CashFlowFilters.tsx` | nuqs URL state (?unit= ?cc=) | useQueryState | ✓ WIRED | useQueryState import confirmed (113 lines) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ChartOfAccountsTree.tsx` | `accounts: AccountNode[]` | `listAccountsTree()` → Supabase `.from('chart_of_accounts').select(...)` | Yes — queries real table | ✓ FLOWING |
| `CostCentersTable.tsx` | `centers: CostCenterRow[]` | `listCostCenters()` → Supabase `.from('cost_centers')` | Yes — real DB query | ✓ FLOWING |
| `BankAccountsTable.tsx` | `accounts` | `listBankAccounts()` → Supabase `.from('bank_accounts')` | Yes — real DB query | ✓ FLOWING |
| `CategoriesAccountMappingTable.tsx` | `categories` | `listCategoriesWithAccounts()` → Supabase `financial_categories` join `chart_of_accounts` | Yes — real DB query with join | ✓ FLOWING |
| `TransactionModal.tsx` | `values.accountId`, `values.costCenterId` | RHF form → Zod schema → `createTransaction` Server Action → Supabase INSERT | Yes — flows to real DB insert | ✓ FLOWING |
| `fluxo-de-caixa/page.tsx` (filtered) | `transactions` | `listTransactions(month, {costCenterId, unitId})` → Supabase `.from('financial_transactions').eq('cost_center_id', ...)` | Yes — RLS-scoped filtered query | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| vitest suite (84 tests) | `npx vitest run src/__tests__/financeiro/` | 7 files, 84/84 PASS | ✓ PASS |
| buildTree exports present | `grep "export function buildTree"` | Found in chart-tree.ts | ✓ PASS |
| transactionClassificationSchema required fields | vitest transaction-classification.test.ts | 9/9 PASS — missing accountId → "Conta contábil obrigatória" confirmed | ✓ PASS |
| Migration tables assertions | vitest migrations-phase14.test.ts | 48/48 PASS | ✓ PASS |
| DB types contain new tables | `grep chart_of_accounts src/types/database.types.ts` | FOUND | ✓ PASS |
| Webhook non-blocking | `grep "status: 200" route.ts` + `grep "account_id: null"` | Both present | ✓ PASS |
| Tree renders in browser | Browser required | Not run | ? SKIP |
| Modal validation feedback | Browser required | Not run | ? SKIP |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FCAD-01 | Plans 02, 04, 05, 06 | Financeiro estrutura plano de contas (árvore), centros de custo, contas correntes e categorias | ✓ SATISFIED | 3 migration files; 4 Server Action modules; ChartOfAccountsTree accordion; plano-de-contas/centros-de-custo/contas-correntes routes all exist and call real Server Actions |
| FCAD-02 | Plans 04, 07 | Lançamentos são classificados por conta contábil e centro de custo (rateio por unidade/área) | ✓ SATISFIED | transactionClassificationSchema enforces accountId + costCenterId; TransactionModal wired; CashFlowFilters with nuqs URL state; listTransactions accepts costCenterId/unitId opts |

No orphaned requirements — FCAD-01 and FCAD-02 are the only REQUIREMENTS.md entries mapped to Phase 14. Coverage: 2/2.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/HACK/PLACEHOLDER comments in any Phase 14 file. No empty implementations or stub returns detected in Server Actions or UI components.

**Note on `'use server'` grep:** Initial grep matched `// NO 'use server'` comment text in `chart-tree.ts` and `transaction-schema.ts`. Confirmed by reading both files: neither file contains the `'use server'` directive — the comment is documentation stating its absence. Both are correctly pure libs.

---

### Human Verification Required

#### 1. Plano de Contas Tree — Visual Rendering (FCAD-01 SC1)

**Test:** Log in as admin, navigate to `/clinica/financeiro`. Confirm 3 new cards appear (Plano de Contas, Centros de Custo, Contas Correntes). Click "Plano de Contas". Verify: (a) tree shows seeded odontological hierarchy with all groups auto-expanded; (b) account codes are monospaced and left-aligned; (c) type badges show receita/despesa/grupo in correct colors; (d) clicking Edit opens dialog pre-filled; (e) clicking "+ Conta Filha" on a group opens create dialog with parentId set; (f) toggling ativo off renders strikethrough on the inactive account row.

Then log in as `socio` role and navigate to the same page. Verify NO Edit or Add Child buttons appear anywhere in the tree.

**Expected:** Hierarchical accordion tree shows the 14-node seeded chart. Admin sees full row actions. Read-only roles see no action buttons.

**Why human:** Visual tree rendering, accordion open/close state, hover-affordance visibility, and role-gated button display require browser verification.

#### 2. Transaction Classification Fields — Validation + Auto-fill + Filters (FCAD-02)

**Test:**
1. Fluxo de Caixa → click "+ Lançamento". Without selecting Conta Contábil or Centro de Custo, click "Confirmar". Verify inline error "Campo obrigatório" appears under both fields simultaneously.
2. Pick a Categoria that has a mapped account (e.g. "Consulta"). Verify Conta Contábil auto-fills and shows helper "Preenchido automaticamente pela categoria" below the select. Confirm Centro de Custo is pre-selected with the unit's default CC. Submit; confirm the transaction posts without error.
3. Visit `/clinica/financeiro/categorias`. Select a different leaf account for any category. Confirm the status badge next to that row flips from "Sem conta" to "Mapeada" (or vice versa).
4. Back on fluxo de caixa, select a Centro de Custo from the filter bar. Confirm the transaction list and totals narrow. Reload the page — verify the `?cc=` query param persists in the URL and the filter remains active.

**Expected:** Required validation fires; category auto-fill works; CC pre-selection works; URL-state filter survives refresh.

**Why human:** React form validation rendering, auto-fill UX trigger, and nuqs URL state behavior across page loads require browser interaction.

---

### Gaps Summary

No automated gaps found. All 7 plans produced substantive, wired, and data-flowing artifacts. The 84-test suite passes. Pending items are visual/interactive verifications that require browser testing per the project instruction (consolidated visual review at phase end).

---

_Verified: 2026-06-20T23:07:00Z_
_Verifier: Claude (gsd-verifier)_
