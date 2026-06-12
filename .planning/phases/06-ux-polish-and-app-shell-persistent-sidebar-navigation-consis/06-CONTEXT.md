# Phase 6: UX Polish & App Shell - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Elevar a UI do v1 (auditoria 15/24) para uma experiência **clara, navegável e production-grade**, alinhada à marca FYNXIA (fynxia.com.br). **Sem novas features** — só app shell, navegação, tema/marca, hierarquia, estados e refinamento visual tela-a-tela. Cobre os achados de `.planning/reports/UI-REVIEW-v1.0.md`.

**Fora do escopo:** novas capacidades de produto; mudanças de schema/dados; lógica de negócio. É uma fase de design/frontend.
</domain>

<decisions>
## Implementation Decisions

### Tema & Marca (D-01)
- **Dual-theme:** tema **claro clínico = padrão** (legível para uso prolongado: tabelas, forms, prontuário) + tema **dark/neon da marca = toggle persistente**. Tokens preparados para os dois (CSS vars em `globals.css`, light + dark).
- **Marca FYNXIA** (de fynxia.com.br — ver memória `project-fynxia-brand`): accent **cyan** (`185 100% 50%`), secundário **magenta** (`300 100% 60%`), accent roxo (`250 100% 65%`)/purple (`270 100% 60%`); fundo dark-navy (`240 20% 6%`) no tema dark; gradiente cyan→magenta/roxo + glow/glass **apenas em destaques** (sidebar header, login, CTAs primários) — não em superfícies de trabalho densas. `--radius: .75rem`.
- **Fontes:** **Space Grotesk** (headings/display) + **Inter** (corpo/UI), via Google Fonts (next/font). Substitui o stack atual.
- **Logo:** aplicar a logo FYNXIA (`.firecrawl/fynxia-logo.png` → mover para `public/`; idealmente extrair/usar versão adequada para light e dark) no topo da sidebar e nas páginas de auth/públicas.
- No tema claro, o accent cyan e o gradiente são usados com parcimônia (foco em legibilidade); o dark é o que mais "respira" a marca.

### App Shell / Navegação (D-02)
- **Sidebar fixa à esquerda (~240px)** substituindo o `clinica/layout.tsx` passthrough atual. Conteúdo: **logo** no topo; **links de módulo** role-gated (Agenda, Pacientes, Financeiro, Equipe[admin], IA/Agentes); **rodapé** com clínica/usuário + **toggle de tema** + **Sair**. Item ativo destacado (accent).
- **Responsivo:** colapsa para **rail de ícones** / **drawer** em telas estreitas/mobile.
- **Copiloto:** segue como **trigger flutuante** (já existe), independente da sidebar.
- O `(dashboard)/layout.tsx` e `clinica/layout.tsx` passam a montar o shell; o trigger do copiloto permanece.

### Padrão de Página & Estados (D-03)
- **`PageHeader` compartilhado** em TODA página autenticada: título (Space Grotesk) + breadcrumb + slot de ações (botões à direita). Remove os cabeçalhos ad-hoc atuais.
- **Loading:** `loading.tsx` por rota com **skeletons que imitam o layout real** (cards de totais, linhas de tabela, form fields).
- **Empty states:** ícone (lucide) + título + mensagem + CTA quando aplicável.
- **Error:** `error.tsx` amigável com botão de retry.

### Escopo (D-04)
- **Varredura completa tela-a-tela:** além da propagação global (shell/tema/tokens/fontes/PageHeader/estados), **reprojetar o interior de cada módulo** buscando clareza/polish: hub/home, auth (login/signup/forgot/reset), agenda (AgendaCalendar), pacientes (lista/novo/detalhe + abas prontuário/odontograma/anamneses), financeiro (fluxo de caixa, contas a receber, nova cobrança, régua), copiloto (sidebar/mensagens), equipe (reescrever do zero nos tokens — corrige dark mode), IA/agentes (log), e as páginas públicas (agendar, anamnese, invite). Fase grande → múltiplos planos/ondas.

### Fixes da auditoria a incorporar (UI-REVIEW-v1.0.md)
- Reescrever `equipe/page.tsx` (classes cruas slate/gray → tokens; quebra no dark).
- Normalizar tipografia ao contrato (Space Grotesk headings + Inter, pesos consistentes) — eliminar `font-bold`/`font-medium` fora do padrão.
- Hierarquia/focal clarity por tela; consistência cross-módulo.

### Claude's Discretion
- Estrutura exata dos componentes do shell (`AppSidebar`, `SidebarNav`, `ThemeToggle`), do `PageHeader`, e dos skeletons.
- Escala tipográfica refinada (tamanhos/pesos) dentro do contrato Space Grotesk/Inter.
- Como derivar uma versão da logo legível em ambos os temas (e o fallback se só houver a PNG escura).
- Densidade exata das tabelas; microinterações/transições (sutis, sem exagero neon no tema claro).
- Mecanismo de tema (next-themes vs cookie + classe) — escolher o que integra melhor com SSR/Tailwind v4 sem flash.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning ou implementing.**

### Marca & auditoria
- `.planning/reports/UI-REVIEW-v1.0.md` — auditoria 6-pilares (15/24) com os fixes priorizados; é o backlog desta fase.
- Memória `project-fynxia-brand` + `.firecrawl/fynxia.css` (tokens HSL reais) + `.firecrawl/fynxia-logo.png` (logo) — a marca de fynxia.com.br.
- `.planning/phases/02-clinical-mvp/02-UI-SPEC.md`, `03-...`, `05-...` — o design system atual (a ser evoluído, não jogado fora).

### Código (shell + tokens)
- `src/app/globals.css` — onde os tokens light+dark da marca entram.
- `src/app/(dashboard)/clinica/layout.tsx` (passthrough hoje → vira o shell) + `src/app/(dashboard)/layout.tsx` + `src/app/(auth)/layout.tsx` + `src/app/layout.tsx` (next/font: Space Grotesk + Inter).
- `src/app/(dashboard)/clinica/page.tsx` (hub — navItems já existentes a migrar para a sidebar).
- `src/components/ui/*` (shadcn) — `sidebar`/`skeleton`/`breadcrumb` (instalar via `shadcn add` se faltarem); `src/components/ui/button.tsx` (@base-ui render-prop — sem asChild).
- `CLAUDE.md` — convenções (shadcn first, @base-ui render-prop, Tailwind v4, nuqs/Zustand).
- Telas a refinar: listadas no UI-REVIEW e em `src/app/(dashboard)/clinica/**`, `src/app/(auth)/**`, `src/app/{agendar,anamnese,invite}/**`, `src/components/**`.

[Sem ADRs dedicados — requisitos nas decisões acima + auditoria + marca.]
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Design system shadcn + tokens em `globals.css` (a evoluir para light+dark da marca).
- Componentes shadcn existentes (button @base-ui, breadcrumb, tabs, table via TanStack, sheet, scroll-area).
- `clinica/page.tsx` navItems (Agenda/Pacientes/Equipe/Financeiro) — fonte dos links da sidebar (+ IA/Agentes).
- Copiloto trigger/sidebar (Fase 5) — mantém, integra ao shell.

### Established Patterns
- @base-ui render-prop (sem asChild); nuqs para URL state; Zustand para UI state (já usado no copiloto).
- next/font para Inter (provavelmente já) → adicionar Space Grotesk.
- pt-BR.

### Integration Points
- `clinica/layout.tsx` é o ponto de montagem do shell (hoje passthrough; já monta o CopilotTrigger).
- `globals.css` + root `layout.tsx` (fontes + classe de tema).
- Toda page autenticada adota `<PageHeader/>`.

</code_context>

<specifics>
## Specific Ideas

- **Referência de marca explícita do usuário:** usar fynxia.com.br para cores, fontes e logo. Adotado via dual-theme (claro padrão + dark/neon da marca) para não sacrificar a usabilidade clínica.
- Gradiente/glow da marca: usar como sotaque em pontos de marca (sidebar topo, login, CTA), não em áreas densas de dados.
</specifics>

<deferred>
## Deferred Ideas

- Microanimações elaboradas / motion design avançado (manter sutil nesta fase).
- Ilustrações customizadas para empty states (usar ícones lucide por ora).
- Tema de alto contraste / acessibilidade AAA (a fase já melhora a11y via tokens/WIG; AAA é refinamento futuro).
- Landing/marketing dentro do app (o site fynxia.com.br já cobre marketing).

### Reviewed Todos (not folded)
Nenhum todo pendente casou com a Fase 6.
</deferred>

---

*Phase: 06-ux-polish-and-app-shell*
*Context gathered: 2026-06-12*
