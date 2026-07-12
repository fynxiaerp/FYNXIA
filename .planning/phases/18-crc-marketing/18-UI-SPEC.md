---
phase: 18
slug: crc-marketing
status: draft
shadcn_initialized: true
preset: base-nova / neutral / css-variables
created: 2026-07-11
---

# Phase 18 — UI Design Contract: CRC & Marketing

> Contrato visual e de interação para as telas de Funil de Leads, ROI de Campanhas, Campanhas de Reativação, NPS e Programa de Indicação.
> Gerado por gsd-ui-researcher. Verificado por gsd-ui-checker.
> Fonte primária de decisões de produto: `18-CONTEXT.md` (D-01..D-19) — este documento NÃO reabre decisões já travadas, apenas especifica a camada visual/interação.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn/ui | `components.json` (verified — already initialized, no gate needed) |
| Style | base-nova | `components.json` `"style": "base-nova"` |
| Preset | neutral / css-variables | `components.json` `"baseColor": "neutral"` |
| Component library | @radix-ui (via shadcn) + @base-ui/react para `Button` | CLAUDE.md + `button.tsx` |
| Icon library | lucide-react | `components.json` `"iconLibrary": "lucide"` |
| Font — body | Inter (`--font-inter` / `font-sans`) | `globals.css` |
| Font — headings/display | Space Grotesk (`--font-space-grotesk` / `font-display`) | `globals.css` |
| Chart / data-viz library | **none installed** — mirrors Fase 14/15/16/17 convention: no `recharts`/`chart.js`. Painéis usam KPI cards (`Card` grid) + tabelas, não gráficos. | verified via `package.json` — no chart dependency in any prior financeiro/estoque phase |
| Drag-and-drop library | **none installed — new for this phase.** Recommendation: `@dnd-kit/core` + `@dnd-kit/sortable` (accessible, React 19-compatible, no `asChild` conflicts, works with Tailwind v4, MIT license, actively maintained — the de-facto standard for shadcn-style kanban boards). Planner/executor MUST add these two packages in a Wave 0/1 setup task. | FLAG — Claude's Discretion per `18-CONTEXT.md` §"Claude's Discretion" (D-02) |

---

## Spacing Scale

Declarado (múltiplos de 4). Segue escala 8-point do projeto — nenhuma mudança em relação às fases anteriores.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gap ícone/label; gap inline de badge; gap entre avatar e nome em card de lead |
| sm | 8px | Padding interno de badge; gap entre kanban card elements; gap entre colunas compactas |
| md | 16px | Padding interno de cards e formulários; gap padrão entre campos; padding interno do kanban card |
| lg | 24px | Padding lateral/vertical da `main` (`p-6`); padding do header de coluna kanban |
| xl | 32px | Gap entre seções dentro de uma page; gap entre colunas kanban (`gap-4` a `gap-6` — ver exceção abaixo) |
| 2xl | 48px | Padding vertical de EmptyState secundário |
| 3xl | 64px | `py-16` — EmptyState padrão (kanban vazio, dashboards) |

**Exceções:**
- Colunas do Kanban: `gap-4` (16px) entre colunas — não 32px — para caber 5 colunas (Novo/Contatado/Agendado/Convertido/Perdido) em viewport de 1280px sem scroll horizontal excessivo
- Kanban card: `min-h-[88px]` — maior que o KPI card padrão (72px) porque acomoda nome + origem badge + telefone + tempo no estágio
- Formulário público de NPS (mobile-first, fora do shell): usa `px-4` (16px) em vez de `p-6` — tela menor, mobile é o canal primário de acesso
- Alvo touch do rating 0–10 no formulário público: cada botão de nota mínimo `size-10` (40px) — abaixo do ideal de 44px mas aceitável dado 11 botões em uma linha em mobile; usa `flex-wrap` como salvaguarda

---

## Typography

Segue padrão existente do projeto (verificado em PageHeader, EmptyState, PayablesTable, NfseKpiRow).

| Role | Size | Weight | Line Height | Font | Usage |
|------|------|--------|-------------|------|-------|
| Display / Page title | 20px (`text-xl`) | 600 (`font-semibold`) | 1.25 (`leading-tight`) | Space Grotesk (`font-display`) | `<h1>` em PageHeader; título do form público de NPS |
| Heading / Card title | 14px (`text-sm`) | 600 (`font-semibold`) | 1.4 | Space Grotesk (`font-display`) | Título de coluna kanban, label de KPI card, título de seção |
| Body | 14px (`text-sm`) | 400 (`font-normal`) | 1.5 | Inter | Descrições, textos de apoio, cells de tabela, texto do lead card |
| Small / meta | 12px (`text-xs`) | 400 (`font-normal`) | 1.4 | Inter | Origem do lead no card, tempo no estágio, telefone abreviado |
| Numeric / KPI | 24px (`text-2xl`) | 600 (`font-semibold`) | 1.25 (`leading-tight`) | Inter + `tabular-nums` | CPL, CAC, **NPS score âncora** (`+42`), saldo de recompensas |

**Regra:** Headings de seção e page title usam `font-display` (Space Grotesk). Todos os demais textos usam `font-sans` (Inter). Nunca misturar dentro do mesmo elemento.

**Escala fechada:** exatamente **4 tamanhos** (12/14/20/24px) e **2 pesos** (400/600). O NPS score âncora do painel (ex.: "+42") NÃO introduz um 5º tamanho — usa o papel **Numeric/KPI (24px `text-2xl` / `font-semibold`)**, o mesmo dos demais números-chave. A ênfase vem da cor (accent/destrutivo conforme a faixa) e do `tabular-nums`, não de um tamanho/peso extra.

---

## Color

Paleta dual-mode já configurada em `globals.css`. Nenhuma nova cor é introduzida nesta fase — reaproveita tokens existentes.

| Role | Light (HSL) | Dark (HSL) | Usage |
|------|-------------|------------|-------|
| Dominant (60%) | `hsl(0 0% 100%)` — white | `hsl(240 20% 6%)` — dark navy | Background da page, superfície geral, background do kanban board |
| Secondary (30%) | `hsl(0 0% 98%)` — off-white | `hsl(240 20% 10%)` — navy | Cards de lead no kanban, coluna kanban (header), sidebar, painéis |
| Accent (10%) | `hsl(185 100% 26%)` — cyan dark | `hsl(185 100% 50%)` — cyan neon | Reservado — ver lista abaixo |
| Destrutivo | `hsl(0 84% 60%)` — red | `hsl(0 84% 60%)` — red | Estágio "Perdido" (borda/indicador, NUNCA o card inteiro), detrator NPS (0-6), rejeitar aprovação de blast |

**Accent (`--primary` / `--ring`) reservado exclusivamente para:**
- Botão primário de ação ("Novo Lead", "Enviar Campanha", "Aprovar Disparo", "Registrar Indicação")
- Estado de foco de campo de formulário (ring) — inclusive no formulário público de NPS
- Link de navegação ativo no sidebar
- Coluna kanban "Convertido" — indicador de sucesso (badge/borda superior, não o card inteiro)
- Botão de nota selecionada (7-10) no formulário público de NPS

**Cores semânticas específicas desta fase (não accent — classes utilitárias):**

| Contexto | Cor de texto | Cor de bg | Classe Tailwind |
|----------|-------------|-----------|-----------------|
| Estágio "Novo" (badge de coluna) | foreground | muted | `variant="secondary"` (Badge shadcn) |
| Estágio "Contatado" | blue-700 | blue-100 | `className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"` |
| Estágio "Agendado" | violet-700 | violet-100 | `className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"` |
| Estágio "Convertido" | primary (accent) | accent | `variant="default"` (Badge shadcn — único estágio com accent, sinaliza sucesso do funil) |
| Estágio "Perdido" | destructive | destructive/10 | `variant="destructive"` (Badge shadcn) |
| NPS Promotor (9-10) | green-700 | green-100 | `className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"` |
| NPS Neutro (7-8) | amber-700 | amber-100 | `className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"` |
| NPS Detrator (0-6) | red-700 | red-100 | `variant="destructive"` (Badge shadcn) |
| Score NPS positivo (≥0) | green-700 | — | `text-green-700 dark:text-green-400` no número grande |
| Score NPS negativo (<0) | red-600 | — | `text-red-600` no número grande |
| CPL/CAC acima da meta (se meta configurada) | amber-600 | — | apenas se fase de campanha define meta — caso contrário neutro (`text-foreground`) |

---

## Copywriting Contract

| Elemento | Copy |
|----------|-------|
| CTA principal — novo lead | "Novo Lead" |
| CTA principal — nova campanha de reativação | "Nova Campanha" |
| CTA principal — aprovar disparo (approval_requests) | "Aprovar Disparo" |
| CTA principal — rejeitar disparo | "Rejeitar" (`variant="outline"`, NÃO destructive — rejeitar não é uma ação destrutiva sobre dados, apenas nega a campanha) |
| CTA principal — registrar indicação | "Registrar Indicação" |
| CTA principal — nova origem de lead (admin) | "Nova Origem" |
| CTA secundário — enviar convite NPS manual (se necessário reenvio) | "Reenviar Convite NPS" |
| CTA salvar formulário público NPS | "Enviar Avaliação" |
| Empty state — funil kanban (sem leads) | Título: "Nenhum lead no funil" / Corpo: "Cadastre o primeiro lead para começar a acompanhar o funil de conversão." |
| Empty state — painel ROI (sem campanhas) | Título: "Nenhuma campanha registrada" / Corpo: "Lance uma despesa de marketing no financeiro e vincule a uma campanha para calcular CPL e CAC." |
| Empty state — campanhas de reativação (sem campanhas criadas) | Título: "Nenhuma campanha de reativação" / Corpo: "Configure um segmento de pacientes inativos para disparar sua primeira campanha." |
| Empty state — segmento sem pacientes elegíveis | Título: "Nenhum paciente neste segmento" / Corpo: "Ajuste os filtros (dias de inatividade, faixa etária, unidade) para encontrar pacientes elegíveis." |
| Empty state — NPS (sem respostas) | Título: "Nenhuma resposta de NPS ainda" / Corpo: "As respostas aparecem aqui após o envio automático pós-consulta." |
| Empty state — detratores | Título: "Nenhum detrator no período" / Corpo: "Ótimo — nenhuma nota de 0 a 6 registrada." |
| Empty state — programa de indicação | Título: "Nenhuma indicação registrada" / Corpo: "Vincule pacientes indicados ao cadastrar um novo lead para começar a acompanhar recompensas." |
| Error state (padrão do projeto) | Título: "Algo deu errado" / Corpo: "Não foi possível carregar esta página. Tente novamente." / Ação: "Tentar novamente" |
| Erro — formulário público NPS (token inválido) | Título: "Link de Avaliação Inválido" / Corpo: "Este link de avaliação expirou ou já foi utilizado. Entre em contato com a clínica se acredita que isso é um erro." (mesma estrutura visual do erro de anamnese) |
| Erro — formulário público NPS (após envio bem-sucedido) | Título: "Obrigado pela sua avaliação!" / Corpo: "Sua resposta foi registrada. A equipe da clínica agradece o retorno." |
| Confirmação destrutiva — excluir origem em uso | Título: "Não é possível excluir" / Corpo: "Esta origem está vinculada a leads existentes. Desative-a em vez de excluir." (soft-delete only — nunca hard delete de origem em uso) |
| Confirmação — enviar disparo de campanha (pré-aprovação) | Título: "Enviar campanha para aprovação" / Corpo: "A campanha será personalizada por IA e enviada para aprovação antes do disparo em massa. Nenhuma mensagem sai sem aprovação humana." / Ação: "Enviar para Aprovação" / Cancelar: "Cancelar" |
| Confirmação — aprovar disparo em massa | Título: "Confirmar disparo em massa" / Corpo: "Esta ação envia mensagens para {N} pacientes via {canal}. Confirma o disparo?" / Ação: "Confirmar Disparo" / Cancelar: "Cancelar" |
| Badge estágio: Novo | "Novo" |
| Badge estágio: Contatado | "Contatado" |
| Badge estágio: Agendado | "Agendado" |
| Badge estágio: Convertido | "Convertido" |
| Badge estágio: Perdido | "Perdido" |
| Badge NPS: Promotor | "Promotor" |
| Badge NPS: Neutro | "Neutro" |
| Badge NPS: Detrator | "Detrator" |
| Alerta interno — detrator (D-15) | "{N} avaliação(ões) detratora(s) aguardando retorno da equipe." |
| Label CPL | "CPL (Custo por Lead)" |
| Label CAC | "CAC (Custo por Aquisição)" |
| Label conversão por origem | "Conversão por Origem" |
| Label saldo de recompensas | "Saldo de Recompensas" |
| Label recompensa creditada | "Crédito de indicação: {valor} — disponível para uso em serviços" |
| Placeholder — comentário NPS (opcional) | "Conte um pouco mais sobre sua experiência (opcional)" |
| Label pergunta NPS | "De 0 a 10, o quanto você recomendaria a {nomeClinica} para um amigo ou familiar?" |
| Rótulos extremos da escala NPS | Esquerda: "Pouco provável" / Direita: "Muito provável" |

---

## Telas e Contratos de Interação

### 1. `/clinica/crc` — Hub do módulo CRC & Marketing

**Layout:** `PageHeader` + `<main className="p-6 max-w-5xl mx-auto w-full">` — mirrors `/clinica/financeiro` hub pattern (icon card grid, `Link` cards).

**Cards de navegação (grid `sm:grid-cols-2 lg:grid-cols-3`):**
1. "Funil de Leads" (ícone `Kanban` ou `Users`) → `/clinica/crc/funil`
2. "ROI de Campanhas" (ícone `TrendingUp`) → `/clinica/crc/roi`
3. "Campanhas de Reativação" (ícone `Send` ou `MessageCircleHeart`) → `/clinica/crc/campanhas`
4. "NPS" (ícone `Smile`) → `/clinica/crc/nps`
5. "Programa de Indicação" (ícone `Gift` ou `UserPlus`) → `/clinica/crc/indicacoes`

Cada card: `Icon` + título + descrição de uma linha — estrutura idêntica ao hub de Financeiro (`group flex flex-col gap-3 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-accent/40`).

**Header actions:** Nenhum (hub é navegação pura).

---

### 2. `/clinica/crc/funil` — Funil de Leads (Kanban)

**Layout:** `PageHeader` (sem `max-w` constraint — kanban precisa de largura total) + `<main className="p-6 w-full space-y-4">`.

**Header actions:**
- Botão primário: `<Button size="sm"><Plus className="size-4" />Novo Lead</Button>` — abre `LeadFormDialog`
- Toggle secundário: `<Button variant="outline" size="sm">Ver Conversão por Origem</Button>` — alterna para a visão de tabela agregada (ver Tela 2b)

**Estrutura do board:**
```
<div className="flex gap-4 overflow-x-auto pb-4">
  {/* 5 colunas: Novo, Contatado, Agendado, Convertido, Perdido */}
  <KanbanColumn key={stage} className="flex-1 min-w-[260px] max-w-[320px]">
    <ColumnHeader>{label} <Badge variant="secondary">{count}</Badge></ColumnHeader>
    <div className="space-y-2 min-h-[120px]">
      {leads.map(lead => <LeadCard key={lead.id} {...lead} />)}
    </div>
  </KanbanColumn>
</div>
```

**Coluna (`KanbanColumn`):**
- Header: `bg-secondary/50 rounded-t-lg px-4 py-3` — título (`font-display text-sm font-semibold`) + `Badge variant="secondary"` com contagem de leads
- Corpo: `bg-muted/30 rounded-b-lg p-3 min-h-[400px]` — drop zone (`useDroppable` do dnd-kit)
- Coluna "Convertido": header com indicador accent sutil (`border-t-2 border-primary` no header) — não preenchimento total (accent é reservado)
- Coluna "Perdido": header com indicador destructive sutil (`border-t-2 border-destructive`)

**Card de lead (`LeadCard`, `min-h-[88px]`, draggable via dnd-kit `useDraggable`):**
```
<Card className="p-3 cursor-grab active:cursor-grabbing hover:border-primary/40">
  <div className="flex items-start justify-between gap-2">
    <p className="text-sm font-semibold truncate">{nome}</p>
    <Badge variant="outline" className="text-xs shrink-0">{origem}</Badge>
  </div>
  <p className="text-xs text-muted-foreground mt-1">{telefone}</p>
  <p className="text-xs text-muted-foreground mt-2">{diasNoEstagio} dia(s) no estágio</p>
</Card>
```
- Clique no card (não-drag) abre `LeadDetailSheet` (shadcn `Sheet`, lateral direita) com histórico completo + botão de mudança manual de estágio (fallback para quando DnD não é usado, ex. teclado/acessibilidade)
- **Acessibilidade do DnD:** dnd-kit `KeyboardSensor` habilitado — leads podem ser movidos entre colunas via teclado (Tab até o card, Space para "pegar", setas para mover coluna, Space para soltar). `LeadDetailSheet` também expõe um `Select` de estágio como via alternativa 100% acessível — NUNCA depender apenas de drag-and-drop de mouse.
- Ao soltar em "Convertido": dispara fluxo D-04 (dialog de confirmação "Vincular a paciente existente ou criar novo?" antes de persistir a transição — porque a conversão cria/vincula um `patient`)
- Ao soltar em "Perdido": dialog leve pedindo motivo opcional (`Select`: sem resposta / não tem interesse / preço / outro — `Textarea` opcional) antes de confirmar

**Empty state (coluna vazia):** texto inline centralizado, sem ícone: `<p className="text-xs text-muted-foreground text-center py-8">Nenhum lead neste estágio.</p>`

**Empty state (funil inteiro vazio — todas as colunas vazias):** usa `EmptyState` compartilhado acima do board — Título: "Nenhum lead no funil" / Corpo conforme Copywriting Contract / CTA: "Novo Lead"

**Dialog `LeadFormDialog`:**
- Campos: Nome (`Input`, obrigatório), Telefone (`Input` com máscara BR), E-mail (`Input`, opcional), Origem (`Select` — lista fixa gerenciável D-03), Indicado por (`Select` com busca de pacientes existentes — visível apenas quando Origem = "Indicação", implementa D-16), Observação (`Textarea`, opcional)
- Estágio inicial sempre "Novo" — não editável no form de criação
- Botão submit: "Cadastrar Lead"
- Botão cancel: "Cancelar"

---

### 2b. `/clinica/crc/funil?view=conversao` — Conversão por Origem (toggle da Tela 2)

**Layout:** mesma page, view alternativa (não é rota separada — `useQueryState('view')` via nuqs).

**Tabela (`ConversionByOriginTable`):**

| Coluna | Conteúdo |
|--------|----------|
| Origem | Nome + `Badge variant="outline"` |
| Total de Leads | Número inteiro |
| Convertidos | Número inteiro |
| Taxa de Conversão | `{pct}%` — `tabular-nums`, verde se ≥ média geral, neutro caso contrário |
| Perdidos | Número inteiro |

Sem gráfico (nenhuma lib de chart instalada) — apenas tabela ordenável por Taxa de Conversão desc (default).

---

### 3. `/clinica/crc/roi` — Painel de ROI de Campanha

**Layout:** `PageHeader` + `<main className="p-6 max-w-6xl mx-auto w-full space-y-6">` (max-w-6xl — mais largo que o padrão 5xl por causa da tabela de origem com muitas colunas).

**Filtros (nuqs):**
- Select de campanha: lista de campanhas + opção "Todas"
- Date range: De / Até (competência)

**Cards de KPI (grid `sm:grid-cols-2 lg:grid-cols-4`, `min-h-[72px]`, mesma estrutura de `NfseKpiRow`):**
1. "Custo Total" — `formatBRL()`, fonte: soma de despesas vinculadas (D-05)
2. "CPL (Custo por Lead)" — `formatBRL()` — `custo / nº leads`
3. "CAC (Custo por Aquisição)" — `formatBRL()` — `custo / nº convertidos`
4. "Taxa de Conversão Geral" — `{pct}%`

**Tabela: Conversão e ROI por Origem (`RoiByOriginTable`):**

| Coluna | Conteúdo |
|--------|----------|
| Origem | Nome |
| Leads | Número |
| Convertidos | Número |
| Taxa de Conversão | `{pct}%` |
| Custo Atribuído | `formatBRL()` — "—" se origem sem campanha/despesa vinculada |
| CPL | `formatBRL()` — "—" se sem custo atribuído |
| CAC | `formatBRL()` — "—" se sem convertidos |

**Informativo (banner sutil, não `Alert` — apenas texto):**
`<p className="text-xs text-muted-foreground">Custo de campanha vem de despesas de marketing lançadas no Financeiro (Contas a Pagar / Centro de Custo Marketing). <Link className="underline" href="/clinica/financeiro/contas-a-pagar">Lançar despesa</Link></p>`

**Empty state:** conforme Copywriting Contract — "Nenhuma campanha registrada" com link para lançar despesa no financeiro.

**Header actions:** Nenhum (painel é read-only — custo entra pelo financeiro, não por aqui, per D-05).

---

### 4. `/clinica/crc/campanhas` — Campanhas de Reativação

**Layout:** `PageHeader` + `<main className="p-6 max-w-5xl mx-auto w-full space-y-6">`

**Header actions:**
- Botão primário: `<Button size="sm"><Plus className="size-4" />Nova Campanha</Button>` — abre `CampaignFormDialog` (multi-step, ver abaixo)

**Tabela (`CampaignsTable`):**

| Coluna | Conteúdo |
|--------|----------|
| Nome | Nome da campanha |
| Segmento | Resumo: "Inativos há {X}+ dias" + filtros aplicados como badges pequenos |
| Canal | Badge(s): "WhatsApp" / "E-mail" / "WhatsApp + E-mail" |
| Status | Badge: `Rascunho` / `Aguardando Aprovação` / `Aprovada` / `Enviada` / `Rejeitada` |
| Destinatários | Número (calculado ao gerar o segmento) |
| Criada em | `dd/MM/yyyy` |
| Ações | `DropdownMenu`: Ver Detalhes, Editar (somente rascunho), Enviar para Aprovação (rascunho→aguardando), Cancelar |

**Status badge colors:**
| Status | Classe |
|--------|--------|
| Rascunho | `variant="secondary"` |
| Aguardando Aprovação | `className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"` |
| Aprovada | `className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"` |
| Enviada | `variant="default"` (accent — único estado terminal positivo) |
| Rejeitada | `variant="destructive"` |

**Fluxo `CampaignFormDialog` (Dialog `Tabs` internas — 3 passos, não wizard de rota separada):**

**Passo 1 — "Segmento":**
- Campo: Inativo há (dias) — `Input` numérico, obrigatório (D-07)
- Filtros opcionais (colapsáveis via `Accordion`): Último procedimento (`Select`), Faixa etária (`Input` min/max), Unidade (`Select`)
- Botão "Pré-visualizar Segmento" → mostra contagem: "{N} pacientes elegíveis" (chamada ao backend antes de avançar)
- Se N = 0: `EmptyState` inline conforme Copywriting Contract "Nenhum paciente neste segmento"

**Passo 2 — "Canal e Mensagem":**
- Checkbox WhatsApp / Checkbox E-mail (pelo menos um obrigatório)
- Nota informativa (D-11): "Mensagens de WhatsApp usam template aprovado pela Meta — variáveis são preenchidas automaticamente, texto livre não é permitido." (`text-xs text-muted-foreground`)
- Botão "Gerar Personalização com IA" → aciona agente L2 (D-09); enquanto processa, botão mostra `<Loader2 className="animate-spin" />` + "Personalizando..."
- Preview de amostra: mostra 2-3 exemplos de mensagem personalizada (apenas primeiro nome interpolado, per LGPD/ZDR) em cards read-only estilo balão de chat

**Passo 3 — "Revisão e Envio":**
- Resumo: segmento (N pacientes), canal(is), preview da mensagem
- Botão final: "Enviar para Aprovação" (NÃO "Enviar" — D-09 exige aprovação humana antes do disparo em massa) → cria `approval_requests` row, campanha vai para status "Aguardando Aprovação"
- Aviso: `Alert` (variante padrão, não destructive): "O disparo em massa só ocorre após aprovação de um administrador ou gestor." + ícone `ShieldCheck`

**Tela de aprovação (reutiliza inbox de aprovações da Fase 10 — `/clinica/conformidade/aprovacoes` ou equivalente):**
- Card de aprovação de campanha mostra: nome da campanha, N destinatários, canal, preview da mensagem
- Botões: "Aprovar Disparo" (accent, `variant="default"`) / "Rejeitar" (`variant="outline"`, com `Textarea` obrigatório de motivo)
- Copy de confirmação de aprovação: ver Copywriting Contract "Confirmar disparo em massa"

**Empty state:** conforme Copywriting Contract — "Nenhuma campanha de reativação".

---

### 5. `/clinica/crc/nps` — Painel de NPS

**Layout:** `PageHeader` + `<main className="p-6 max-w-5xl mx-auto w-full space-y-6">`

**Filtros (nuqs):** Date range (De/Até) + Select de unidade (se multi-unidade).

**Seção: Score NPS (destaque no topo)**
```
<Card className="p-6 flex flex-col items-center text-center gap-2">
  <p className="text-sm font-semibold text-muted-foreground">NPS Score</p>
  <p className="text-2xl font-semibold font-display tabular-nums {scoreColor}">{score >= 0 ? '+' : ''}{score}</p>
  <p className="text-xs text-muted-foreground">{promotores}% promotores · {neutros}% neutros · {detratores}% detratores</p>
</Card>
```
`scoreColor`: `text-green-700 dark:text-green-400` se `score >= 0`, senão `text-red-600`.

**Cards de KPI secundários (grid `sm:grid-cols-3`, `min-h-[72px]`):**
1. "Promotores" — contagem, `text-green-700`
2. "Neutros" — contagem, `text-amber-700`
3. "Detratores" — contagem, `text-red-700`

**Alerta de detratores (D-15) — `Alert variant="destructive"` quando há detratores não tratados:**
```
<Alert variant="destructive">
  <AlertTriangle />
  <AlertDescription>{N} avaliação(ões) detratora(s) aguardando retorno da equipe.</AlertDescription>
</Alert>
```
Posicionado logo abaixo do card de Score, acima dos KPIs secundários.

**Tabela: Respostas Recentes (`NpsResponsesTable`):**

| Coluna | Conteúdo |
|--------|----------|
| Paciente | Nome |
| Nota | Número grande + Badge de classificação (Promotor/Neutro/Detrator) |
| Comentário | Texto truncado (2 linhas), expandir via `Popover` se longo |
| Data | `dd/MM/yyyy` |
| Status (apenas detratores) | Badge: "Pendente" / "Tratado" — `DropdownMenu` com ação "Marcar como Tratado" |

**Empty state:** "Nenhuma resposta de NPS ainda" — sem CTA (coleta é automática via cron, não manual).

**Header actions:** Nenhum.

---

### 6. `/nps/[patient-id]/[token]` — Formulário Público de NPS (fora do shell)

**Padrão-espelho:** `src/app/anamnese/[patient-id]/[token]/page.tsx` — mesma estrutura de validação de token single-use, mesmo tratamento de erro em página cheia, mas conteúdo mobile-first e SEMPRE tema claro (não dual-theme — é um formulário curto acessado via link de WhatsApp/e-mail, deve funcionar sem depender de preferência de sistema).

**Regra de tema:** forçar `light` neste layout isolado (`<html className="light">` ou wrapper `<div className="light">` — NÃO usar `next-themes` aqui). Evita FOUC em WebViews de WhatsApp que não respeitam `prefers-color-scheme` corretamente.

**Layout:**
```
<main className="min-h-screen bg-background py-8 px-4">
  <div className="max-w-md w-full mx-auto flex flex-col gap-6">
    <header className="text-center">
      <h1 className="text-xl font-semibold font-display text-primary">FYNXIA</h1>
      <h2 className="mt-2 text-xl font-semibold font-display text-foreground">Sua opinião importa</h2>
      <p className="mt-1 text-sm text-muted-foreground">{perguntaNps}</p>
    </header>
    {/* Escala 0-10 */}
    {/* Textarea de comentário opcional */}
    {/* Botão de envio */}
  </div>
</main>
```

**Escala de nota (0–10):**
```
<div className="flex flex-wrap justify-center gap-2">
  {Array.from({length:11}).map((_,i) => (
    <button key={i} type="button" className="size-10 rounded-full border border-border text-sm font-semibold flex items-center justify-center hover:border-primary data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:border-primary">
      {i}
    </button>
  ))}
</div>
<div className="flex justify-between text-xs text-muted-foreground px-1">
  <span>Pouco provável</span>
  <span>Muito provável</span>
</div>
```
- Nota 0-6 (após seleção): nenhuma mudança de cor visível na tela pública — NÃO revelar ao paciente que ele é "detrator" (isso é classificação interna, não deve vazar para o formulário)
- Botão "Enviar Avaliação": `disabled` até uma nota ser selecionada

**Textarea de comentário:** opcional, placeholder conforme Copywriting Contract, `maxLength={500}`.

**Estado pós-envio:** substitui o formulário por tela de agradecimento (mesmo container, não navega para outra rota) — "Obrigado pela sua avaliação!" conforme Copywriting Contract, ícone `CheckCircle2` verde grande (`size-14 text-green-600`).

**Estado de erro (token inválido/expirado/usado):** réplica exata do padrão da anamnese — `AlertCircle` destructive, card centralizado, copy conforme Copywriting Contract.

**Progress indicator:** NÃO usar (formulário de 1 passo único — o indicador de 2 passos da anamnese não se aplica aqui).

---

### 7. `/clinica/crc/indicacoes` — Programa de Indicação

**Layout:** `PageHeader` + `<main className="p-6 max-w-5xl mx-auto w-full space-y-6">`

**Header actions:** Nenhum (registro de indicação acontece no `LeadFormDialog`, Tela 2, campo "Indicado por" — D-16; esta tela é consulta/gestão de recompensas).

**Cards de KPI (grid `sm:grid-cols-3`, `min-h-[72px]`):**
1. "Indicações Registradas" — contagem total
2. "Indicações Convertidas" — contagem (dispara crédito, D-18)
3. "Total em Recompensas Creditadas" — `formatBRL()`

**Tabela (`ReferralsTable`):**

| Coluna | Conteúdo |
|--------|----------|
| Indicador | Nome do paciente que indicou |
| Indicado | Nome do lead/paciente indicado |
| Status da Indicação | Badge: mesmo estágio do funil do lead indicado (Novo/Contatado/.../Convertido/Perdido) |
| Recompensa | `formatBRL()` — "Pendente" (`text-muted-foreground`) se ainda não convertido; valor creditado (`text-green-700 font-semibold`) se convertido |
| Data da Indicação | `dd/MM/yyyy` |

**Seção: Saldo por Paciente Indicador (D-19 — modelado para exposição futura no portal):**
- Tabela separada ou toggle: `PatientRewardsBalanceTable` — Paciente | Indicações Convertidas | Saldo Total de Crédito | Saldo Utilizado | Saldo Disponível
- Ação por linha: `DropdownMenu` → "Ver Extrato" (abre `Sheet` com histórico de créditos/usos daquele paciente — leitura apenas, sem edição manual de saldo nesta fase)

**Empty state:** "Nenhuma indicação registrada" conforme Copywriting Contract.

---

## Component Inventory

Componentes a criar em `src/components/crc/`:

| Componente | Tipo | Descrição |
|------------|------|-----------|
| `LeadKanbanBoard` | Client | Board de 5 colunas com dnd-kit (`DndContext`, `useDroppable`, `useDraggable`, `KeyboardSensor`) |
| `KanbanColumn` | Client | Coluna individual do funil (header + drop zone) |
| `LeadCard` | Client | Card de lead arrastável |
| `LeadDetailSheet` | Client | Sheet lateral com detalhe do lead + Select de estágio (fallback acessível ao DnD) |
| `LeadFormDialog` | Client | Dialog de cadastro de lead (inclui campo "Indicado por" condicional) |
| `LeadStageChangeDialog` | Client | Dialog de confirmação ao mover para Convertido (vincular/criar paciente) ou Perdido (motivo) |
| `ConversionByOriginTable` | Client | Tabela de conversão agregada por origem |
| `RoiKpiRow` | Client | 4 KPI cards de CPL/CAC/Custo/Conversão — mirrors `NfseKpiRow` |
| `RoiByOriginTable` | Client | Tabela de ROI por origem |
| `CampaignsTable` | Client | Tabela de campanhas de reativação com status badges |
| `CampaignFormDialog` | Client | Dialog multi-step (Tabs internas: Segmento / Canal e Mensagem / Revisão) |
| `SegmentPreview` | Client | Contagem de pacientes elegíveis ao segmento configurado |
| `NpsScoreCard` | Client | Card de destaque com score NPS grande + breakdown % |
| `NpsResponsesTable` | Client | Tabela de respostas recentes com classificação |
| `DetractorAlertBanner` | Client | Alert destructive de detratores pendentes (D-15) |
| `NpsPublicForm` | Client | Formulário público 0-10 + comentário (usado na rota `/nps/[patient-id]/[token]`) |
| `ReferralsTable` | Client | Tabela de indicações com status/recompensa |
| `PatientRewardsBalanceTable` | Client | Tabela de saldo de recompensas por paciente indicador |
| `LeadSourceManager` | Client | CRUD simples de origens (admin) — lista fixa gerenciável, D-03 |

Componentes shadcn já instalados que serão reutilizados:
`Alert`, `Badge`, `Button`, `Card`, `Dialog`, `DropdownMenu`, `Input`, `Select`, `Table`, `Tabs`, `Textarea`, `Sheet`, `Accordion`, `Popover`

Componentes shadcn a instalar se não presentes:
- `Sheet` — verificar via `npx shadcn info` (não listado no glob atual de `src/components/ui/*.tsx`; adicionar se ausente)
- `Progress` — opcional, apenas se o executor decidir usar barra de progresso para %promotores/%neutros/%detratores em vez de texto simples (não obrigatório — texto é suficiente per este contrato)

Pacotes NPM a instalar (novos, fora do catálogo shadcn):
- `@dnd-kit/core` — drag-and-drop do kanban
- `@dnd-kit/sortable` — reordenação dentro de coluna (opcional — v1 não requer reordenação manual dentro da mesma coluna, apenas movimento entre colunas; avaliar se `@dnd-kit/core` sozinho é suficiente antes de adicionar `@dnd-kit/sortable`)

---

## Padrões de Interação

### Dropdowns de ação (padrão do projeto — obrigatório)
```tsx
<DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Ações" />}>
  <MoreHorizontal className="size-4 pointer-events-none" aria-hidden="true" />
</DropdownMenuTrigger>
```
`pointer-events-none` no ícone SVG é mandatório (bug fix da Fase 16, quick task 260629-uaz).

### Drag-and-drop do Kanban (novo padrão desta fase)
- `DndContext` no nível do `LeadKanbanBoard`, sensors: `PointerSensor` + `KeyboardSensor` (acessibilidade obrigatória — NUNCA apenas mouse)
- `onDragEnd`: chama Server Action `moveLeadStage(leadId, newStage)` com atualização otimista local + rollback em erro
- Transição para "Convertido" ou "Perdido" SEMPRE intercepta com dialog de confirmação antes de persistir (não é drop direto) — drop visual acontece, mas a persistência aguarda confirmação; se cancelado, o card volta à coluna original
- Indicador visual durante drag: card com `opacity-50` na posição original + `DragOverlay` do dnd-kit mostrando o card sendo arrastado

### Filtros de URL (nuqs)
- Todos os filtros de tabela/painel persistem na URL via `useQueryState`
- Parâmetros: `view` (funil kanban/conversão), `campanha`, `from`, `to`, `unidade`, `origem`
- Filtros resetados ao navegar entre sub-rotas

### Estados de loading
- Usar `Skeleton` shadcn durante carregamento de dados (mesmo padrão de Fases 14-17)
- Kanban: skeleton mostra 5 colunas com 2-3 cards fantasma (`Skeleton className="h-[88px] w-full rounded-lg"`) cada

### Formulários
- `react-hook-form` v7 + Zod v3 (sem `.default()` — usar `defaultValues` no `useForm`, D-133 do projeto)
- Campos condicionais controlados por `watch()` no RHF (ex.: "Indicado por" só aparece quando `origem === 'indicacao'`)
- Submit state: botão com `disabled` + spinner (`<Loader2 className="size-4 animate-spin" />`) durante mutação
- Formulário público de NPS: SEM react-hook-form (é um único campo de nota + textarea opcional — `useState` simples é suficiente e evita bundle desnecessário na rota pública)

### Aprovação humana (L2, D-09)
- Reutiliza o padrão de `approval_requests` já existente (Fase 10) — NÃO criar um novo componente de aprovação, apenas um novo `entity_type` na tabela existente e um card de preview específico de campanha na inbox já existente
- O card de campanha na inbox de aprovação mostra preview da mensagem personalizada — nunca envia sem esse preview visível ao aprovador

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Alert, Badge, Button, Card, Dialog, DropdownMenu, Input, Select, Table, Tabs, Textarea, Sheet, Accordion, Popover | not required |
| terceiros | nenhum | not applicable |

Nenhum registry de terceiros declarado para esta fase. Gate de segurança não aplicável.

**Nota sobre `@dnd-kit/*`:** não é um shadcn registry block — é uma dependência NPM direta (biblioteca de comportamento, não código de UI copiado). O gate de segurança de registry do shadcn não se aplica; segue o processo normal de auditoria de dependência do projeto (`npm audit` em CI).

---

## Acessibilidade

- Todo `<DropdownMenuTrigger>` tem `aria-label` descritivo: "Ações para {nome do lead}" / "Ações para {nome da campanha}"
- Todos os campos de formulário têm `<label>` associado via `htmlFor` / componentes `Form` shadcn
- **Kanban DnD:** `KeyboardSensor` obrigatório + `LeadDetailSheet` com `Select` de estágio como via 100% funcional sem mouse — testar navegação completa via teclado antes de considerar a tela pronta
- `AlertDialog`/confirmações de mudança de estágio: foco retorna ao trigger (card ou botão) após fechar
- Status badges têm texto legível (não apenas cor) — nunca comunicar estágio/classificação apenas por cor
- `EmptyState`/`ErrorState`: heading com `focus()` no mount (padrão de `ErrorState.tsx` existente)
- **Formulário público de NPS:** botões de nota (0-10) são `<button type="button">` reais com `aria-pressed` no selecionado — não `<div onClick>`; navegável via Tab + Enter/Space
- **Formulário público de NPS:** NÃO usar `autofocus` agressivo que quebre leitores de tela em WebView do WhatsApp — o campo de nota é o primeiro elemento interativo natural na ordem do DOM, sem necessidade de autofocus JS

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
