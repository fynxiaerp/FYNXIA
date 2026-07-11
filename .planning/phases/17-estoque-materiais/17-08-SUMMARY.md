---
phase: 17-estoque-materiais
plan: 08
subsystem: ui
tags: [react-pdf, nuqs, tanstack-table, server-actions, anvisa, rastreabilidade]

# Dependency graph
requires:
  - phase: 17-estoque-materiais
    provides: "listAnvisaTraceability (Plan 05) — leitura de rastreabilidade ANVISA sob RLS tenant-scoped"
provides:
  - "/clinica/estoque/anvisa — relatório de rastreabilidade ANVISA filtrável (produto/lote/paciente/período)"
  - "AnvisaReportTable + AnvisaExportButton (client) — filtragem 100% client-side via nuqs, botão de export reativo"
  - "AnvisaReportPdf + /api/estoque/anvisa-pdf — PDF server-side via @react-pdf/renderer (landscape, Flexbox-only, nodejs runtime)"
affects: [18-crc-marketing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Filtragem 100% client-side sobre dataset completo (não RSC-refetch) para tabelas nuqs — evita depender do shallow=true default do nuqs v2"
    - "Botão de export como sibling client component lendo os mesmos useQueryState da tabela (estado compartilhado via URL, não via props)"
    - "Filtro server-side do PDF replica em memória a mesma lógica de filtro do client, para paridade exata entre tela e export"

key-files:
  created:
    - src/app/(dashboard)/clinica/estoque/anvisa/page.tsx
    - src/components/estoque/AnvisaReportTable.tsx
    - src/components/estoque/AnvisaReportPdf.tsx
    - src/app/api/estoque/anvisa-pdf/route.ts
  modified: []

key-decisions:
  - "AnvisaReportTable filtra client-side sobre o dataset completo (listAnvisaTraceability() sem opts), não via refetch RSC — nuqs v2 default shallow=true não dispara re-render de Server Component, então StockEntriesTable-style RSC-refetch não é confiável para reatividade de UI"
  - "Filtro de produto usa nome (não product_id) — AnvisaRow não expõe product_id; opções do Select derivadas do próprio dataset (rows), eliminando a necessidade de uma segunda chamada listProducts"
  - "AnvisaExportButton definido em AnvisaReportTable.tsx (não novo arquivo) — lê os mesmos 5 useQueryState e monta /api/estoque/anvisa-pdf?... em tempo real, sibling da tabela"
  - "Rota /api/estoque/anvisa-pdf replica em memória a mesma lógica de filtro do client (produto por nome, lote/paciente por substring, from/to por Date) para garantir paridade exata entre o que é exibido e o que é exportado"
  - "AnvisaReportPdf usa Helvetica padrão sem Font.register (UI-SPEC explícito) e orientação landscape para acomodar as 9 colunas do relatório"

patterns-established:
  - "Tabela com filtros nuqs client-side + botão de export sibling reativo via URL compartilhada"

requirements-completed: [EST-03]

# Metrics
duration: ~20min
completed: 2026-07-11
---

# Phase 17 Plan 08: Relatório ANVISA — Página, Tabela e Export PDF Summary

**Página `/clinica/estoque/anvisa` com tabela de rastreabilidade ANVISA filtrável (produto/lote/paciente/período) client-side via nuqs, e export em PDF server-side via `@react-pdf/renderer` (landscape, Flexbox-only, `nodejs` runtime).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 4 (todos criados)

## Accomplishments

- Relatório ANVISA (`/clinica/estoque/anvisa`) consumindo `listAnvisaTraceability` (Plan 05) sem recriar a Server Action
- Filtros produto/lote/paciente/período aplicados 100% client-side sobre o dataset completo, com persistência na URL via nuqs
- Export PDF gerado server-side (`renderToBuffer`) em `src/app/api/estoque/anvisa-pdf/route.ts`, autenticado, `runtime = 'nodejs'`, layout Flexbox-only em landscape
- Botão "Exportar PDF" reativo aos filtros atuais (lê os mesmos `useQueryState` da tabela, sem depender de re-render do Server Component)

## Task Commits

1. **Task 1: Página + tabela do relatório ANVISA** - `ff56f81` (feat)
2. **Task 2: Documento PDF + rota de geração** - `13015d3` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/app/(dashboard)/clinica/estoque/anvisa/page.tsx` - RSC: busca `listAnvisaTraceability()` sem filtros, renderiza `AnvisaReportTable` + `AnvisaExportButton` como ação do `PageHeader`
- `src/components/estoque/AnvisaReportTable.tsx` - Tabela client (TanStack Table v8) com filtros nuqs (produto/lote/paciente/from/to) client-side; exporta também `AnvisaExportButton`
- `src/components/estoque/AnvisaReportPdf.tsx` - Documento `@react-pdf/renderer` (Document>Page landscape, Flexbox-only, Helvetica padrão), cabeçalho clínica/período/data + rodapé "Gerado pelo FYNXIA ERP em..."
- `src/app/api/estoque/anvisa-pdf/route.ts` - Route handler `nodejs`: autentica, resolve `tenant_id`/nome da clínica, lê `listAnvisaTraceability()`, replica filtro em memória, `renderToBuffer`, streama `application/pdf`

## Decisions Made

- Filtro de produto no relatório e no PDF usa **nome** do produto (não `product_id`), já que `AnvisaRow` (tipo retornado por `listAnvisaTraceability`) não expõe `product_id` — as opções do Select são derivadas das linhas do próprio dataset carregado, dispensando uma segunda chamada a `listProducts`.
- Filtragem da tabela é **100% client-side** sobre o dataset completo retornado por `listAnvisaTraceability()` (sem opts), em vez de depender de refetch via Server Component ao mudar filtros — o padrão usado em `StockEntriesTable.tsx` (Plan 07) presume que mudanças de `useQueryState` disparam refetch RSC, mas o default `shallow: true` do nuqs v2 (confirmado em `node_modules/nuqs/dist/index.js`) atualiza a URL via History API sem passar pelo router do Next.js, então o Server Component **não** re-renderiza. Para garantir que a UI reaja de fato às mudanças de filtro nestes novos arquivos, adotei o padrão já comprovado em `ProductsTable.tsx` (Plan 06): fetch completo + filtro em memória no client.
- O botão "Exportar PDF" foi implementado como componente client (`AnvisaExportButton`) que lê os mesmos 5 `useQueryState` da tabela (compartilhados via URL, não via props) para montar o link com os filtros atuais em tempo real — evita que o link fique "congelado" nos filtros do carregamento inicial da página.
- A rota de PDF replica exatamente a mesma lógica de filtro (produto por nome/lote/paciente por substring/`from`-`to` por comparação de `Date`) usada na tabela, garantindo paridade entre o que é exibido na tela e o que é exportado.

## Deviations from Plan

None - plan executed exactly as written. A decisão sobre filtragem client-side vs RSC-refetch (acima) é uma escolha de implementação dentro do escopo da tarefa ("Filtros nuqs" — must_have), não uma mudança de escopo ou arquitetura.

## Issues Encountered

- Comentários iniciais em `AnvisaReportPdf.tsx` continham a palavra "Grid" (referenciando a limitação "no CSS Grid" do `@react-pdf/renderer`), o que falhava o acceptance criteria `grep -c "Grid\|display: 'grid'" == 0`. Reescrevi os comentários para não usar a palavra "Grid" (ex: "layout em colunas/linhas via CSS declarativo"), mantendo a mesma informação sem violar o grep literal.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- EST-03 (rastreabilidade ANVISA) está completo: leitura (Plan 05) + UI/export (este plano)
- Próximo plano da fase (17-09) segue o roadmap de Estoque & Materiais
- Nenhum bloqueio conhecido

---
*Phase: 17-estoque-materiais*
*Completed: 2026-07-11*

## Self-Check: PASSED

All 4 created files verified present on disk; both task commits (ff56f81, 13015d3) verified present in git log.
