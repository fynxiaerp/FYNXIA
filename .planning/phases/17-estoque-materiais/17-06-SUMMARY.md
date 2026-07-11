---
phase: 17-estoque-materiais
plan: 06
subsystem: ui
tags: [sidebar-nav, dashboard, products-catalog, rhf, nuqs, tanstack-table, base-ui]

# Dependency graph
requires:
  - phase: 17-estoque-materiais/03
    provides: createProduct/updateProduct/listProducts/deactivateProduct (src/actions/products.ts), productSchema (Zod v3)
  - phase: 17-estoque-materiais/04
    provides: listActiveAlerts/getAlertCounts (src/actions/stock-alerts.ts)
  - phase: 17-estoque-materiais/05
    provides: listStockDraws (src/actions/stock-draws.ts), listStockEntries (src/actions/stock-entries.ts)
provides:
  - "Estoque" sidebar nav item (/clinica/estoque) — NavIconKey + ALL_NAV_ITEMS + Package icon
  - /clinica/estoque dashboard (banner de alertas + 3 KPI cards + movimentações recentes)
  - /clinica/estoque/produtos catálogo filtrável com status semântico
  - ProductFormDialog reutilizável (create/edit) — consumido pelo header CTA e pelo dropdown "Editar" da tabela
affects: [17-07 (entradas de estoque — Registrar Entrada/Baixa Manual/Histórico dropdown items apontam para /clinica/estoque/entradas ainda não criada), 17-08/17-09 (anvisa report, materials templates)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ProductFormDialog usa o wrapper 'contents' div + onClick (mirrors PayableFormDialog.tsx) em vez de DialogTrigger direto, para poder ser usado tanto como CTA de header quanto como DropdownMenuItem trigger sem quebrar o unmount do Dialog"
    - "Saldo/alertas por unidade resolvidos via listUnits()[0] (unidade default, is_default DESC) — D-23 é por-unidade mas este plano não introduz um seletor de unidade na UI (fora do must_haves do plano)"
    - "listProducts()/getAlertCounts()/listStockDraws() chamados com unitId; listStockEntries() não aceita unitId (limitação da action existente — reusada como está, não modificada)"

key-files:
  created:
    - src/components/estoque/StockAlertBanner.tsx
    - src/components/estoque/ProductFormDialog.tsx
    - src/components/estoque/ProductsTable.tsx
    - src/app/(dashboard)/clinica/estoque/page.tsx
    - src/app/(dashboard)/clinica/estoque/produtos/page.tsx
  modified:
    - src/components/shell/nav-config.ts
    - src/components/shell/nav-icons.ts

key-decisions:
  - "Dashboard /clinica/estoque e catálogo /clinica/estoque/produtos resolvem a unidade via listUnits()[0] (primeira unidade retornada, ordenada is_default DESC) em vez de expor um seletor de unidade — D-23 (estoque por unidade) fica coberto para clínicas de unidade única; multiunidade completo (seletor + persistência de escolha) fica para plano futuro, consistente com o must_haves deste plano que não pede seletor."
  - "StockAlertBanner recebe counts:{minimo,validade,negativo} (de getAlertCounts) em vez da lista bruta de listActiveAlerts — a Copywriting Contract só exige contagens por tipo, e getAlertCounts já centraliza a lógica de negativo (agregação de saldo) que listActiveAlerts não calcula."
  - "Dropdown 'Registrar Entrada'/'Baixa Manual'/'Histórico' em ProductsTable apontam para /clinica/estoque/entradas?produto={id} (rota ainda não criada — chegará em plano futuro de Wave 4/5). Next.js não valida hrefs internos em build-time, então isso não quebra o build; usuário só encontra 404 se navegar antes da rota existir."
  - "ProductFormDialog usa productSchema.superRefine tal como está (sem alterações) — números (estoque_minimo/estoque_maximo) convertidos de string→number no onChange dos Inputs, já que o schema usa z.number() (não z.coerce.number()) e não pode ganhar .default() (D-133)."

requirements-completed: [EST-01, EST-03]

# Metrics
duration: ~15min
completed: 2026-07-11
---

# Phase 17 Plan 06: Sidebar "Estoque" + Dashboard de Alertas + Catálogo de Produtos Summary

**UI de entrada do módulo de Estoque & Materiais — nav item, dashboard de alertas em tempo real com 3 KPIs, e catálogo de produtos filtrável com dialog de cadastro/edição com campos condicionais por categoria (ANVISA para implante)**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3
- **Files created:** 5
- **Files modified:** 2

## Accomplishments

- `src/components/shell/nav-config.ts` / `nav-icons.ts`: adicionado `'estoque'` ao union `NavIconKey`, item `{ href: '/clinica/estoque', label: 'Estoque', icon: 'estoque' }` em `ALL_NAV_ITEMS` (sem `adminOnly` — leitura permitida a todos os papéis clínicos, D-18), ícone `Package` mapeado.
- `src/components/estoque/StockAlertBanner.tsx` (client): renderiza até 3 `Alert`s (mínimo/validade/negativo) com a copy exata do UI-SPEC, ícones `AlertTriangle`(mínimo/negativo)/`Clock`(validade), variante `destructive` apenas para negativo.
- `src/app/(dashboard)/clinica/estoque/page.tsx` (RSC): banner de alertas (ou empty state "Estoque sob controle" quando não há alertas ativos) + grid `grid-cols-1 gap-4 sm:grid-cols-3` com 3 KPI cards (Alertas de Mínimo `text-amber-600`, Próximos do Vencimento `text-orange-600`, Saldo Negativo `text-red-600`) + tabela "Movimentações Recentes" (últimas 10 entradas+baixas combinadas de `listStockDraws`/`listStockEntries`, ordenadas `created_at` desc, ícone `ArrowDownCircle`/`ArrowUpCircle`).
- `src/components/estoque/ProductFormDialog.tsx` (client): `Dialog` + RHF + `zodResolver(productSchema)` (schema reusado do Plan 01, sem modificação); campos Nome, SKU, Categoria, Unidade de Medida, Estoque Mínimo/Máximo, Fornecedor Preferido; campo condicional "Número ANVISA" quando `watch('category') === 'implante'`; `createProduct`/`updateProduct` no submit; botão com `Loader2` durante `isSubmitting`; wrapper `children` reutilizável tanto como CTA de header quanto como item de dropdown.
- `src/components/estoque/ProductsTable.tsx` (client): TanStack Table v8 com colunas Produto (nome+SKU), Categoria (Badge outline), Saldo Atual (vermelho se negativo), Custo Médio (`formatBRL` + `tabular-nums`), Est. Mínimo, Status (Badge semântico — baixo=amber/critico=orange/negativo=red/vencido=muted/normal=secondary), Ações (DropdownMenu com `pointer-events-none` no ícone); filtros `nuqs` (`categoria`/`status`/`q` com debounce de 300ms via `useEffect`+`setTimeout`).
- `src/app/(dashboard)/clinica/estoque/produtos/page.tsx` (RSC): `PageHeader` com CTA "Cadastrar Produto" gated a `admin`/`superadmin` (via header `x-user-role`, padrão ROLE-02); `EmptyState` (`Package`) quando não há produtos cadastrados; `ProductsTable` alimentada por `listProducts({ unitId })` + `listSuppliers()`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Item de navegação 'Estoque' no sidebar** - `85b6cb6` (feat)
2. **Task 2: Dashboard de alertas /clinica/estoque** - `642610e` (feat)
3. **Task 3: Catálogo de produtos + ProductFormDialog** - `f5911b3` (feat)

## Files Created/Modified

- `src/components/shell/nav-config.ts` - `'estoque'` em `NavIconKey` + item em `ALL_NAV_ITEMS`
- `src/components/shell/nav-icons.ts` - `Package` importado e mapeado para `'estoque'`
- `src/components/estoque/StockAlertBanner.tsx` - banner de alertas mínimo/validade/negativo
- `src/app/(dashboard)/clinica/estoque/page.tsx` - dashboard: banner + 3 KPIs + movimentações recentes
- `src/components/estoque/ProductFormDialog.tsx` - dialog de cadastro/edição de produto com campo condicional ANVISA
- `src/components/estoque/ProductsTable.tsx` - tabela de produtos com filtros nuqs + status semântico + dropdown de ações
- `src/app/(dashboard)/clinica/estoque/produtos/page.tsx` - catálogo de produtos (RSC)

## Decisions Made

- **Saldo/alertas resolvidos pela unidade padrão (`listUnits()[0]`):** este plano de UI não introduz seletor de unidade (fora do must_haves); D-23 (estoque por unidade) permanece corretamente implementado no backend (Plans 03-05), e as telas usam a unidade default da clínica. Multiunidade completo (seletor na UI) é candidato a refinamento futuro.
- **`StockAlertBanner` recebe `counts` agregados em vez da lista bruta de `listActiveAlerts`:** a Copywriting Contract exige apenas contagens por tipo (mínimo/validade/negativo), e `getAlertCounts` já centraliza a agregação de saldo negativo que `listActiveAlerts` não calcula.
- **Itens de dropdown "Registrar Entrada"/"Baixa Manual"/"Histórico" apontam para `/clinica/estoque/entradas?produto={id}`**, rota ainda não implementada (chegará em plano futuro da Wave). Links internos do Next.js não são validados em build-time — o botão fica funcionalmente inerte até a rota existir, sem quebrar o build ou o `tsc`.
- **Números do formulário de produto convertidos manualmente string→number no `onChange`** (não `z.coerce.number()`), pois `productSchema` usa `z.number()` puro e não pode ganhar `.default()` (D-133) — mantém o schema do Plan 01 intocado, conforme instrução de reuso.

## Deviations from Plan

None — plano executado exatamente como especificado. As 3 tasks, os arquivos e os critérios de aceitação batem 1:1 com o `17-06-PLAN.md`.

## Known Stubs

- **Dropdown items "Registrar Entrada" / "Baixa Manual" / "Histórico"** em `ProductsTable.tsx` (linhas ~127-142) apontam para `/clinica/estoque/entradas?produto={id}` — rota ainda não criada. Isto é intencional e documentado no `17-06-PLAN.md` (essas telas pertencem a `/clinica/estoque/entradas`, D-20, fora do escopo deste plano). Será resolvido quando o plano que cria `/clinica/estoque/entradas` (StockEntryFormDialog/ManualDrawDialog, UI-SPEC §3) for executado.

## Issues Encountered

None.

## User Setup Required

None — nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `/clinica/estoque` e `/clinica/estoque/produtos` estão navegáveis a partir do sidebar (item "Estoque" com ícone `Package`).
- `ProductFormDialog` está pronto para reuso: já é chamado tanto no CTA de header quanto no dropdown "Editar" da tabela, sem duplicação de código.
- Próximo plano da Wave (`/clinica/estoque/entradas` — StockEntriesTable + StockEntryFormDialog + ManualDrawDialog, UI-SPEC §3) resolve os links pendentes de "Registrar Entrada"/"Baixa Manual"/"Histórico" já wireados em `ProductsTable.tsx`.
- `npx tsc --noEmit` não reporta nenhum erro novo nos 7 arquivos deste plano (erros pré-existentes em `src/__tests__/**` de fases anteriores, não relacionados a Estoque, permanecem inalterados).

---
*Phase: 17-estoque-materiais*
*Completed: 2026-07-11*

## Self-Check: PASSED

All 7 created/modified files verified present; all 3 task commit hashes (85b6cb6, 642610e, f5911b3) verified in git log; `npx tsc --noEmit` reports zero errors in nav-config.ts, nav-icons.ts, StockAlertBanner.tsx, and all `/clinica/estoque/**` files.
