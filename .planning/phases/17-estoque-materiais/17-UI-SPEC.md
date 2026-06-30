---
phase: 17
slug: estoque-materiais
status: draft
shadcn_initialized: true
preset: base-nova / neutral / css-variables
created: 2026-06-30
---

# Phase 17 — UI Design Contract: Estoque & Materiais

> Contrato visual e de interação para as telas do módulo de Estoque & Materiais.
> Gerado por gsd-ui-researcher. Verificado por gsd-ui-checker.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn/ui | components.json (verified) |
| Style | base-nova | components.json `"style": "base-nova"` |
| Preset | neutral / css-variables | components.json `"baseColor": "neutral"` |
| Component library | @radix-ui (via shadcn) + @base-ui/react para Button | CLAUDE.md + button.tsx |
| Icon library | lucide-react | components.json `"iconLibrary": "lucide"` |
| Font — body | Inter (`--font-inter` / `font-sans`) | globals.css |
| Font — headings/display | Space Grotesk (`--font-space-grotesk` / `font-display`) | globals.css |

---

## Spacing Scale

Declarado (múltiplos de 4). Segue escala 8-point do projeto.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gap entre ícone e label; gap inline de badge |
| sm | 8px | Padding interno de badge; gap entre células compactas |
| md | 16px | Padding interno de cards e formulários; gap padrão entre campos |
| lg | 24px | Padding lateral/vertical da main (`p-6`) |
| xl | 32px | Gap entre seções dentro de uma page |
| 2xl | 48px | Padding vertical do EmptyState (`py-16` = 64px usa 3xl) |
| 3xl | 64px | `py-16` — usado no EmptyState |

**Exceções:**
- Alvo touch de botão ícone: `size-9` (36px) — abaixo de 44px (limitação de densidade ERP)
- KPI card: `min-h-[72px]` — fixo conforme padrão Contas a Pagar

---

## Typography

Segue padrão existente do projeto (verificado em PageHeader, EmptyState, PayablesTable).

| Role | Size | Weight | Line Height | Font | Usage |
|------|------|--------|-------------|------|-------|
| Display / Page title | 20px (`text-xl`) | 600 (`font-semibold`) | 1.25 (`leading-tight`) | Space Grotesk (`font-display`) | `<h1>` em PageHeader |
| Heading / Card title | 14px (`text-sm`) | 600 (`font-semibold`) | 1.4 | Space Grotesk (`font-display`) | Label de KPI card, título de seção |
| Body | 14px (`text-sm`) | 400 (`font-normal`) | 1.5 | Inter | Descrições, textos de apoio, cells de tabela |
| Numeric / KPI | 24px (`text-2xl`) | 600 (`font-semibold`) | 1.25 (`leading-tight`) | Inter + `tabular-nums` | Valores em cards de KPI |

**Regra:** Headings de seção e page title usam `font-display` (Space Grotesk). Todos os demais textos usam `font-sans` (Inter). Nunca misturar dentro do mesmo elemento.

---

## Color

Paleta dual-mode já configurada em `globals.css`. Nenhuma nova cor é introduzida nesta fase.

| Role | Light (HSL) | Dark (HSL) | Usage |
|------|-------------|------------|-------|
| Dominant (60%) | `hsl(0 0% 100%)` — white | `hsl(240 20% 6%)` — dark navy | Background da page, superfície geral |
| Secondary (30%) | `hsl(0 0% 98%)` — off-white | `hsl(240 20% 10%)` — navy | Cards (`--card`), sidebar, painéis |
| Accent (10%) | `hsl(185 100% 26%)` — cyan dark | `hsl(185 100% 50%)` — cyan neon | Reservado — ver lista abaixo |
| Destrutivo | `hsl(0 84% 60%)` — red | `hsl(0 84% 60%)` — red | Baixa manual, cancelar entrada, saldo negativo |

**Accent (`--primary` / `--ring`) reservado exclusivamente para:**
- Botão primário de ação ("Registrar Entrada", "Salvar Produto", "Exportar PDF")
- Estado de foco de campo de formulário (ring)
- Link de navegação ativo no sidebar
- Badge de status `normal` (único status positivo que usa cor de destaque)

**Cores semânticas de status de produto (não accent — usar classes utilitárias):**

| Status | Cor de texto | Cor de bg-badge | Classe Tailwind |
|--------|-------------|-----------------|-----------------|
| `normal` | foreground | muted | `variant="secondary"` (Badge shadcn) |
| `baixo` | amber-700 | amber-100 | `className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"` |
| `critico` | orange-700 | orange-100 | `className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"` |
| `negativo` | red-700 | red-100 | `className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"` |
| `vencido` | gray-500 | gray-100 | `className="bg-muted text-muted-foreground"` |

**Cor do saldo negativo em KPI card:** `text-red-600` (mesmo padrão de `Vencido` em Contas a Pagar).

---

## Telas e Contratos de Interação

### 1. `/clinica/estoque` — Dashboard de Alertas

**Layout:** `PageHeader` + `<main className="p-6 max-w-5xl mx-auto w-full space-y-6">`

**Seção: Banner de Alertas Ativos**
- Componente: `StockAlertBanner`
- Renderizado somente quando existem alertas não resolvidos
- Usa `Alert` shadcn com variante padrão (não `destructive`) para alertas de validade; variante `destructive` para saldo negativo
- Ícone: `AlertTriangle` (Lucide) para crítico/negativo; `Clock` para validade
- Copy do banner de mínimo: "X produto(s) abaixo do estoque mínimo — pedido de reposição enviado para aprovação."
- Copy do banner de validade: "X lote(s) com vencimento nos próximos 30 dias."
- Copy do banner de negativo: "X produto(s) com saldo negativo — registre uma entrada para normalizar."
- Badge com contagem no ícone de sidebar: número total de alertas não resolvidos

**Seção: Cards de KPI (3 cards em grid)**
```
grid grid-cols-1 gap-4 sm:grid-cols-3
```
- Card 1: "Alertas de Mínimo" — número inteiro, `text-amber-600`
- Card 2: "Próximos do Vencimento" — número inteiro, `text-orange-600`
- Card 3: "Saldo Negativo" — número inteiro, `text-red-600`
- Estrutura de card: `CardHeader > CardTitle (text-sm font-semibold text-muted-foreground)` + `CardContent > p (text-2xl font-semibold leading-tight tabular-nums)`

**Seção: Movimentações Recentes**
- Título: `<h2 className="text-sm font-semibold font-display">Movimentações Recentes</h2>`
- Lista últimas 10 movimentações (`stock_draws` + `stock_entries`) combinadas, ordenadas por `created_at` desc
- Cada linha: ícone (ArrowDownCircle=entrada verde / ArrowUpCircle=baixa amber), produto, qtd, data formatada (`dd/MM/yyyy`)
- Componente: `Table` shadcn (sem paginação — truncado em 10)

**Header actions:** Nenhum (dashboard é read-only)

---

### 2. `/clinica/estoque/produtos` — Catálogo de Produtos

**Layout:** `PageHeader` + `<main className="p-6 max-w-5xl mx-auto w-full space-y-6">`

**Header actions (admin/operacional):**
- Botão primário: `<Button size="sm"><Plus className="size-4" />Cadastrar Produto</Button>` — abre `ProductFormDialog`

**Filtros (nuqs — URL state):**
- Select de categoria: `insumo | medicamento | implante | todas`
- Select de status: `normal | baixo | critico | negativo | vencido | todos`
- Input de busca por nome/SKU: debounced 300ms, `useQueryState('q')`

**Tabela (`ProductsTable`):**

| Coluna | Conteúdo | Notas |
|--------|----------|-------|
| Produto | Nome + SKU abaixo em `text-xs text-muted-foreground` | |
| Categoria | Badge: `insumo` / `medicamento` / `implante` | variant="outline" |
| Saldo Atual | Número + unidade de medida | Vermelho se negativo |
| Custo Médio | `formatBRL(custo_medio)` com `tabular-nums` | |
| Est. Mínimo | Número + UM | |
| Status | Badge semântico (tabela de cores acima) | |
| Ações | `DropdownMenu` com: Editar, Registrar Entrada, Baixa Manual, Histórico | pointer-events-none no ícone SVG (padrão do projeto) |

**Empty state:**
- Ícone: `Package` (Lucide)
- Título: "Nenhum produto cadastrado"
- Descrição: "Cadastre o primeiro produto para começar a controlar o estoque."
- CTA: "Cadastrar Produto" (somente admin/operacional)

**Dialog `ProductFormDialog`:**
- Componente: `Dialog` shadcn
- Campos comuns: Nome (`Input`), SKU (`Input`, opcional), Categoria (`Select`), Unidade de Medida (`Select`: un/ml/g/cx/fr), Estoque Mínimo (`Input` numérico), Estoque Máximo (`Input` numérico, opcional), Fornecedor Preferido (`Select` de suppliers)
- Campos condicionais por categoria:
  - `implante`: exibe Número de Registro ANVISA (`Input`, obrigatório), label "Número ANVISA"
  - `medicamento`: nenhum campo extra obrigatório no produto (validade é por lote)
  - `insumo`: nenhum campo extra
- Validação: campos obrigatórios marcados com `*` no label, mensagem de erro inline abaixo do campo (`text-sm text-destructive`)
- Botão submit: "Salvar Produto" (create) / "Atualizar Produto" (edit)
- Botão cancel: "Cancelar"

---

### 3. `/clinica/estoque/entradas` — Entradas de Estoque

**Layout:** `PageHeader` + `<main className="p-6 max-w-5xl mx-auto w-full space-y-6">`

**Header actions (admin/operacional):**
- Botão primário: `<Button size="sm"><Plus className="size-4" />Registrar Entrada</Button>` — abre `StockEntryFormDialog`

**Filtros (nuqs):**
- Select de produto: lista de produtos ativos
- Date range picker: De / Até (shadcn Calendar / Popover)

**Tabela (`StockEntriesTable`):**

| Coluna | Conteúdo |
|--------|----------|
| Data | `dd/MM/yyyy` |
| Produto | Nome |
| Lote | Número de lote |
| Validade | `dd/MM/yyyy` ou "—" se não aplicável |
| Qtd Recebida | Número + UM |
| Custo Unit. | `formatBRL()` |
| Custo Médio Após | `formatBRL()` |
| Fornecedor | Nome ou "—" |
| Registrado por | Nome do usuário |

**Empty state:**
- Ícone: `PackagePlus` (Lucide)
- Título: "Nenhuma entrada registrada"
- Descrição: "Registre o recebimento de produtos para atualizar o estoque."
- CTA: "Registrar Entrada" (somente admin/operacional)

**Dialog `StockEntryFormDialog`:**
- Componente: `Dialog` shadcn
- Campos: Produto (`Select` com busca), Fornecedor (`Select`, opcional), Número de Lote (`Input`, obrigatório), Data de Validade (`Input` date — obrigatório para implante/medicamento, opcional para insumo), Qtd Recebida (`Input` numérico), Custo Unitário (`Input` BRL com máscara), Nota Fiscal (`Input`, opcional)
- Campos condicionais:
  - `implante`: Número ANVISA (`Input`, obrigatório) exibido logo abaixo de Número de Lote
- Informativo (read-only, exibido após preenchimento do produto): "Custo médio atual: R$ X,XX" → após confirmação: "Novo custo médio: R$ Y,YY"
- Botão submit: "Registrar Entrada"
- Botão cancel: "Cancelar"

**Dialog `ManualDrawDialog` (Baixa Manual):**
- Campos: Produto (pré-selecionado se vindo do contexto), Qtd (`Input` numérico), Motivo (`Select`: perda / quebra / vencimento / ajuste de inventário), Observação (`Textarea`, opcional)
- Botão submit: `variant="destructive"` — "Registrar Baixa"
- Aviso antes do submit: `Alert` com `AlertDescription`: "Esta operação é irreversível. A baixa será registrada com trilha de auditoria."
- Botão cancel: "Cancelar"

---

### 4. `/clinica/estoque/anvisa` — Relatório ANVISA

**Layout:** `PageHeader` + `<main className="p-6 max-w-5xl mx-auto w-full space-y-6">`

**Header actions:**
- Botão secundário: `<Button variant="outline" size="sm"><FileDown className="size-4" />Exportar PDF</Button>` — gera PDF via `@react-pdf/renderer`

**Filtros (nuqs):**
- Select de produto (apenas categoria implante)
- Input de número de lote (`Input`)
- Input de busca por paciente (nome)
- Date range: De / Até

**Tabela (`AnvisaReportTable`):**

| Coluna | Conteúdo |
|--------|----------|
| Data Procedimento | `dd/MM/yyyy` |
| Paciente | Nome completo |
| Profissional | Nome |
| Procedimento | Nome do serviço |
| Produto (Implante) | Nome |
| Nº Lote | Número de lote do fabricante |
| Nº ANVISA | Número de registro ANVISA |
| Validade | `dd/MM/yyyy` |
| Qtd | 1 (sempre 1 por implante) |

**Empty state:**
- Ícone: `ClipboardList` (Lucide)
- Título: "Nenhum implante rastreado no período"
- Descrição: "Registre implantes nas entradas de estoque para gerar rastreabilidade ANVISA."
- CTA: nenhum

**PDF exportado (`AnvisaReportPdf`):**
- Cabeçalho: nome da clínica, período filtrado, data de geração
- Tabela com as mesmas colunas acima
- Rodapé: "Gerado pelo FYNXIA ERP em {data} às {hora}"
- Fonte: Helvetica (padrão `@react-pdf/renderer`) — sem importação de fonte customizada nesta fase
- Layout Flexbox apenas (sem CSS Grid — limitação @react-pdf/renderer)

---

### 5. Aba "Materiais Utilizados" — `/config/servicos` ServiceForm

**Posição:** Aba adicional no `ServiceForm` existente, inserida após as abas já existentes.

**Label da aba:** "Materiais"

**Conteúdo:**
- Título interno: `<h3 className="text-sm font-semibold font-display">Materiais consumidos neste serviço</h3>`
- Descrição: `<p className="text-sm text-muted-foreground">Defina os insumos padrão baixados automaticamente ao concluir este serviço.</p>`
- Lista de templates existentes: mini-tabela com colunas Produto | Qtd Padrão | Ações (remover)
- Botão para adicionar: `<Button variant="outline" size="sm"><Plus className="size-4" />Adicionar Material</Button>`
- Ao clicar em Adicionar: inline row expansion (não dialog) com Select de produto + Input de qtd

**Empty state da lista de materiais:**
- Texto inline: "Nenhum material configurado. Adicione para habilitar a baixa automática."
- Sem ícone (contexto inline dentro de form)

---

### 6. Seção "Materiais Utilizados" — Prontuário / Atendimento

**Posição:** Seção no `ProntuarioForm`, exibida após selecionar o procedimento (quando `service_material_templates` existem para o serviço).

**Estrutura:**
```
<Card>
  <CardHeader>
    <CardTitle className="text-sm font-semibold font-display">Materiais Utilizados</CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
    {/* Uma linha por material do template */}
    <div className="flex items-center gap-3">
      <span className="text-sm flex-1">{nomeDoMaterial}</span>
      <Input type="number" className="w-20" defaultValue={qtdPadrao} min={0} step="0.01" />
      <span className="text-sm text-muted-foreground">{unidadeMedida}</span>
    </div>
    {/* Custo total — exibido apenas APÓS confirmar o procedimento */}
    <p className="text-sm text-muted-foreground pt-2 border-t border-border">
      Custo estimado de insumos: <span className="font-semibold tabular-nums">{formatBRL(total)}</span>
    </p>
  </CardContent>
</Card>
```

**Regras de interação:**
- Qtd pré-preenchida com `qtd_padrao` do template — editável antes de confirmar o procedimento
- Após confirmação do procedimento: campos viram read-only (`disabled`), custo total exibido
- Se produto está com status `critico` ou `negativo`: exibir `Badge` de alerta ao lado do nome ("Estoque Baixo" / "Saldo Negativo")
- Se nenhum template configurado para o serviço: a seção não é renderizada

---

## Copywriting Contract

| Elemento | Copy |
|----------|-------|
| CTA principal — cadastrar produto | "Cadastrar Produto" |
| CTA principal — registrar entrada | "Registrar Entrada" |
| CTA principal — exportar ANVISA | "Exportar PDF" |
| CTA principal — salvar no form | "Salvar Produto" (create) / "Atualizar Produto" (edit) |
| CTA baixa manual | "Registrar Baixa" (botão destructive) |
| Empty state — produtos | Título: "Nenhum produto cadastrado" / Corpo: "Cadastre o primeiro produto para começar a controlar o estoque." |
| Empty state — entradas | Título: "Nenhuma entrada registrada" / Corpo: "Registre o recebimento de produtos para atualizar o estoque." |
| Empty state — ANVISA | Título: "Nenhum implante rastreado no período" / Corpo: "Registre implantes nas entradas de estoque para gerar rastreabilidade ANVISA." |
| Empty state — dashboard | Título: "Estoque sob controle" / Corpo: "Nenhum alerta ativo no momento." |
| Error state | Título: "Algo deu errado" / Corpo: "Não foi possível carregar esta página. Tente novamente." / Ação: "Tentar novamente" |
| Erro de validação — campo obrigatório | "Este campo é obrigatório." |
| Erro de validação — ANVISA obrigatório | "Número ANVISA é obrigatório para implantes." |
| Erro de validação — qtd positiva | "A quantidade deve ser maior que zero." |
| Alerta de saldo mínimo (banner) | "X produto(s) abaixo do estoque mínimo — pedido de reposição enviado para aprovação." |
| Alerta de validade (banner) | "X lote(s) com vencimento nos próximos 30 dias." |
| Alerta de saldo negativo (banner) | "X produto(s) com saldo negativo — registre uma entrada para normalizar." |
| Confirmação de baixa manual | Título: "Confirmar Baixa Manual" / Corpo: "Esta operação é irreversível e será registrada na trilha de auditoria." / Ação: "Registrar Baixa" / Cancelar: "Cancelar" |
| Badge status: baixo | "Estoque Baixo" |
| Badge status: critico | "Estoque Crítico" |
| Badge status: negativo | "Saldo Negativo" |
| Badge status: vencido | "Vencido" |
| Label custo médio (informativo) | "Custo médio atual: R$ X,XX" |
| Label custo após entrada (informativo) | "Novo custo médio: R$ Y,YY" |
| Label custo insumos no prontuário | "Custo estimado de insumos: R$ X,XX" |

---

## Component Inventory

Componentes a criar em `src/components/estoque/`:

| Componente | Tipo | Descrição |
|------------|------|-----------|
| `StockAlertBanner` | Client | Banner de alertas ativos (mínimo/validade/negativo) |
| `ProductsTable` | Client | Tabela de produtos com filtros nuqs |
| `ProductFormDialog` | Client | Dialog de cadastro/edição de produto |
| `StockEntriesTable` | Client | Tabela de entradas de estoque |
| `StockEntryFormDialog` | Client | Dialog de registro de entrada |
| `ManualDrawDialog` | Client | Dialog de baixa manual com confirmação destructive |
| `AnvisaReportTable` | Client | Tabela de rastreabilidade ANVISA |
| `AnvisaReportPdf` | Server | Componente @react-pdf/renderer para export |
| `MaterialsTemplateTab` | Client | Aba "Materiais" no ServiceForm de /config/servicos |
| `MaterialsUsedSection` | Client | Seção "Materiais utilizados" no ProntuarioForm |

Componentes shadcn já instalados que serão reutilizados:
`Alert`, `Badge`, `Button`, `Card`, `Dialog`, `DropdownMenu`, `Input`, `Select`, `Table`, `Tabs`, `Textarea`, `AlertDialog` (para confirmação de baixa manual)

Componentes shadcn a instalar se não presentes:
- `AlertDialog` — confirmar antes de cada baixa destrutiva
- Verificar via `npx shadcn info` antes do Wave de UI

---

## Padrões de Interação

### Dropdowns de ação (padrão do projeto — obrigatório)
```tsx
<DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Ações" />}>
  <MoreHorizontal className="size-4 pointer-events-none" aria-hidden="true" />
</DropdownMenuTrigger>
```
`pointer-events-none` no ícone SVG é mandatório (bug fix da Fase 16, quick task 260629-uaz).

### Filtros de URL (nuqs)
- Todos os filtros de tabela persistem na URL via `useQueryState`
- Parâmetros: `q` (busca), `categoria`, `status`, `produto`, `from`, `to`
- Filtros resetados ao navegar entre sub-rotas

### Estados de loading
- Usar `Skeleton` shadcn durante carregamento de dados
- Estrutura: mesma grid/table com altura fixa, células substituídas por `<Skeleton className="h-4 w-full" />`

### Formulários
- `react-hook-form` v7 + Zod v3 (sem `.default()` — usar `defaultValues` no `useForm`)
- Campos condicionais controlados por `watch('categoria')` no RHF
- Submit state: botão com `disabled` + spinner (`<Loader2 className="size-4 animate-spin" />`) durante mutação

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Alert, AlertDialog, Badge, Button, Card, Dialog, DropdownMenu, Input, Select, Table, Tabs, Textarea | not required |
| terceiros | nenhum | not applicable |

Nenhum registry de terceiros declarado para esta fase. Gate de segurança não aplicável.

---

## Acessibilidade

- Todo `<DropdownMenuTrigger>` tem `aria-label` descritivo: "Ações para {nome do produto}"
- Todos os campos de formulário têm `<label>` associado via `htmlFor` / componentes `Form` shadcn
- `AlertDialog` para baixa manual: foco retorna ao trigger após fechar
- Status badges têm texto legível (não apenas cor)
- `EmptyState` e `ErrorState`: heading com `focus()` no mount (padrão de ErrorState.tsx existente)

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
