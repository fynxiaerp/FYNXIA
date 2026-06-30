# Phase 17: Estoque & Materiais - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Construir o módulo de **Estoque & Materiais** do FYNXIA ERP Odontológico:

1. **Cadastro de produtos** — categoria (insumo/implante/medicamento) com validações e campos distintos por categoria; custo médio móvel; fornecedor padrão por produto (EST-01).
2. **Baixa automática de estoque** — ao registrar procedimento concluído em `appointment_procedures`, debita os materiais via `service_material_templates` (qtd ajustável pelo operador) (EST-02).
3. **Alertas + rastreabilidade ANVISA** — alerta real-time de estoque mínimo (dispara agente de compras L2 com aprovação humana); cron semanal de validade; rastreabilidade de lote de implante via `stock_draws` (EST-03).

**Fora de escopo:** módulo de inventário físico completo (contagem em lote) → futuro; transferência entre unidades → futuro; relatórios gerenciais de custo (DRE) → Fase 19; integração NF-e de entrada → futuro; etiquetas físicas ANVISA → futuro.

</domain>

<decisions>
## Implementation Decisions

### Modelo de produto & custo médio (D-01 a D-05)
- **D-01:** Tabela separada `products` (produto de estoque ≠ serviço faturável). `services` = o que cobra do paciente; `products` = o que consome internamente. FK nos templates de consumo (`service_material_templates`).
- **D-02:** **Custo médio móvel**: recalculado a cada entrada — `(saldo_atual × custo_anterior + qtd_entrada × custo_unitario) / novo_saldo`. Padrão brasileiro, auditável.
- **D-03:** **Categorias com campos distintos**:
  - `implante` → número de registro ANVISA obrigatório + lote obrigatório + validade obrigatória
  - `medicamento` → validade obrigatória; registro ANVISA opcional
  - `insumo` → apenas qtd/custo (sem campos adicionais obrigatórios)
- **D-04:** Produto tem `preferred_supplier_id` (FK → `suppliers`, Fase 16) — usado pelo agente de compras L2 para criar rascunho de CP. Se não configurado, agente apenas alerta sem criar CP.
- **D-05:** Produto tem `estoque_minimo` (obrigatório) e `estoque_maximo` (opcional mas recomendado — usado pelo agente para calcular qtd de reposição). Unidade de medida é atributo descritivo do produto (un, ml, g, cx, fr) — sem lógica de negócio por unidade nesta fase.

### Baixa automática de estoque (D-06 a D-09)
- **D-06:** Gatilho da baixa: **ao registrar procedimento concluído em `appointment_procedures`** (ponto explicitamente preparado na migração Phase 15, comentário: *"future Phase 17 stock draw"*). A Server Action de registro do procedimento inclui a baixa de materiais.
- **D-07:** **`service_material_templates`**: tabela de template `service_id → product_id + qtd_padrao`. O admin configura uma vez via aba "Materiais utilizados" no ServiceForm (`/config/servicos`). No momento do atendimento, **o dentista pode ajustar a qtd** (baixa parcial é permitida — campo editável na seção "Materiais utilizados" do prontuário).
- **D-08:** A baixa é registrada em **`stock_draws`**: `appointment_procedure_id`, `product_id`, `batch_id` (lote usado — FIFO automático), `qtd`, `custo_unitario_snapshot` (custo médio no momento da baixa), `unit_id`, `clinic_id`, `data`.
- **D-09:** **Saldo negativo permitido** — o atendimento jamais é bloqueado por falta de estoque (paciente na cadeira). Se saldo < qtd baixada, registra a baixa (saldo fica negativo), marca o produto com status `negativo` e gera alerta na UI. Não bloqueia o procedimento.

### Entradas de estoque (D-10)
- **D-10:** **Entrada manual via formulário de recebimento** (`stock_entries`): produto, fornecedor, lote, validade, qtd recebida, custo unitário, número ANVISA (obrigatório para implante). Atualiza saldo + custo médio móvel. Não integrado à CP de entrada nesta fase.

### Rastreabilidade ANVISA de implante (D-11 a D-13)
- **D-11:** **Lote = entrada de compra** (N unidades por lote — tabela `product_batches`): número de lote do fabricante, número de registro ANVISA, validade, qtd inicial, qtd_disponivel. Cada baixa de implante referencia o `batch_id` e debita 1 unidade. FIFO automático: a Server Action de baixa seleciona o lote mais antigo com saldo > 0.
- **D-12:** **Vínculo ANVISA**: `stock_draws.batch_id` + `stock_draws.appointment_procedure_id` → rastreia qual implante (lote) foi usado em qual paciente/procedimento. Relatório ANVISA = `stock_draws` JOIN `product_batches` JOIN `products` WHERE `category = 'implante'` → lista paciente, data, profissional, lote, validade, número ANVISA.
- **D-13:** Rastreabilidade **digital interna** — sem impressão de etiqueta nesta fase. Export PDF do relatório ANVISA disponível sob demanda.

### Alertas & agente de compras (D-14 a D-17)
- **D-14:** Verificação de estoque mínimo **real-time na baixa**: após cada `stock_draw`, se `saldo_atual <= estoque_minimo`, dispara o fluxo de alerta/agente. Sem dependência de cron para o mínimo.
- **D-15:** **Agente de compras L2** (framework Phase 10 AIG-01/02): ao detectar saldo ≤ mínimo, agente cria rascunho de CP (Conta a Pagar, Fase 16) ao `preferred_supplier_id` com `qtd = estoque_maximo - saldo_atual`. O rascunho entra no **inbox de aprovações da Fase 10** (admin da unidade aprova/ajusta antes de efetivar). Se `preferred_supplier_id` não configurado ou `estoque_maximo` não definido, agente apenas gera alerta na UI sem criar CP.
- **D-16:** **Alertas de validade via cron semanal**: endpoint `/api/cron/estoque-validade`. Varre produtos com `validade <= hoje + 30 dias` (threshold padrão configurável por produto/categoria). Registra alertas em tabela de notificações internas. Validade **não dispara agente de compras** — vencimento = descarte, não reposição.
- **D-17:** Canal de notificação: **UI only** — badge/banner na tela de estoque para alertas de mínimo e validade. Sem WhatsApp/e-mail nesta fase.

### Permissões & ajuste manual (D-18 a D-19)
- **D-18:** Permissões: **admin/operacional** têm leitura + escrita (cadastro de produto, entrada, ajuste manual, templates de consumo). **Dentista e recep**: somente leitura de saldo/histórico. A baixa automática por procedimento ocorre via Server Action no contexto do prontuário — não exige acesso direto ao módulo de estoque.
- **D-19:** **Baixa manual permitida** com motivo obrigatório (perda, quebra, vencimento, ajuste de inventário) — apenas admin/operacional. Registrado via `logBusinessEvent` (Fase 10 audit trail). Cobre ajuste de discrepâncias de inventário físico.

### Telas & navegação (D-20 a D-22)
- **D-20:** Módulo sob `/clinica/estoque`. Sub-rotas:
  - `/clinica/estoque` — dashboard (alertas de mínimo + validade + movimentações recentes)
  - `/clinica/estoque/produtos` — catálogo com saldo atual, custo médio, status (normal/baixo/crítico/negativo)
  - `/clinica/estoque/entradas` — formulário de recebimento + histórico de entradas por produto
  - `/clinica/estoque/anvisa` — relatório ANVISA de implantes (filtro por lote/data/paciente + export PDF)
- **D-21:** Templates de consumo configurados dentro do **cadastro de serviços** (`/config/servicos` ou equivalente): aba "Materiais utilizados" no ServiceForm. Admin associa produto + qtd padrão ao serviço.
- **D-22:** Seção "Materiais utilizados" no prontuário/atendimento: pré-preenchida pelo template, qtd editável antes de confirmar o procedimento. Exibe custo total de insumos após confirmação (informativo).

### Multiunidade (D-23)
- **D-23:** Estoque **por unidade, independente** — `stock_entries`, `stock_draws`, alertas de mínimo e saldos operam por `unit_id`. Produto cadastrado em rede (`clinic_id`), mas cada unidade tem seu próprio saldo. Transferência entre unidades é operação futura.

### Claude's Discretion
- Nomes/colunas/índices exatos das novas tabelas (`products`, `product_batches`, `stock_entries`, `stock_draws`, `service_material_templates`, tabela de alertas/notificações), seguindo padrões da base (`NUMERIC(12,4)` para qtd fracionada, `NUMERIC(12,2)` para custo, índice em `clinic_id` e `unit_id`).
- Enums de status de produto (`normal`, `baixo`, `critico`, `negativo`, `vencido`).
- Lógica FIFO automático de lotes (implementação em Server Action).
- Threshold padrão de alerta de validade (30 dias) como configuração global ou por produto.
- Estrutura do seed (categorias padrão, unidades de medida padrão).
- Layout/componentização fina das telas → definido via `/gsd-ui-phase` (UI hint = yes para esta fase).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & roadmap
- `.planning/ROADMAP.md` §"Phase 17" — goal, success criteria, dependências.
- `.planning/REQUIREMENTS.md` — EST-01, EST-02, EST-03.

### Ponto de integração da baixa automática (Fase 15 — CRÍTICO)
- `supabase/migrations/20260620000200_faturamento_os_tables.sql` — tabela `appointment_procedures` com comentário *"future Phase 17 stock draw"*. Esta é a tabela onde a baixa automática se ancora.
- `src/actions/appointments.ts` — padrões de Server Actions de procedimento.

### Fornecedores (Fase 16 — REUSAR)
- `supabase/migrations/20260621000100_payables_tables.sql` — tabela `suppliers` (tipo `material` disponível). Reusar para `preferred_supplier_id` em `products`.
- `src/actions/suppliers.ts` — padrões de CRUD de fornecedor.

### CP & agente de compras (Fases 10 + 16)
- `supabase/migrations/20260621000100_payables_tables.sql` — tabela `payables` (rascunho de CP gerado pelo agente L2).
- `src/lib/agents/` (ou equivalente) — framework de agentes L0–L4 (withAgentPolicy, approval_requests).
- `.planning/phases/16-contas-a-pagar-concilia-o-tributos/16-CONTEXT.md` §D-02 — origens de CP (o rascunho do agente se enquadra como CP automático).

### Audit trail (Fase 10 — rastreabilidade de movimentações)
- `src/lib/audit.ts` (`logBusinessEvent`) — registrar baixas manuais + ajustes de inventário.

### Prontuário / atendimento (Fase 2)
- `supabase/migrations/20260605000100_clinical_tables.sql` — `appointments` (GIST sagrado, NÃO tocar).
- `src/app/(dashboard)/clinica/pacientes/[id]/prontuario/` — destino da seção "Materiais utilizados".

### Catálogo de serviços (Fase 15 — onde ficam os templates de consumo)
- `supabase/migrations/20260620000100_faturamento_catalog_tables.sql` — tabela `services` (FK nos `service_material_templates`).

### Cron Vercel (Fase 4 — padrão de cron existente)
- `src/app/api/cron/` — padrão de endpoints de cron existentes. Novo: `/api/cron/estoque-validade`.

### Convenções
- `CLAUDE.md` — RLS USING+WITH CHECK; index clinic_id + unit_id; 'use server' async-only; nodejs runtime; gen types temp-file guard.
- Gotcha deploy: re-login Supabase OAuth na conta FYNXIA (`jqjwyqlbbuqnrffdnlpp`) antes do db push.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`suppliers` (Fase 16)** — tabela já tem tipo `material`; reusar como `preferred_supplier_id` em `products`.
- **`appointment_procedures` (Fase 15)** — ponto de integração explícito para a baixa de estoque.
- **`payables` + approval inbox (Fases 16 + 10)** — rascunho de CP do agente de compras L2.
- **`logBusinessEvent` (Fase 10)** — trilha de auditoria de baixas manuais e ajustes.
- **Vercel Cron endpoints (Fase 4)** — `/api/cron/estoque-validade` segue o padrão existente.
- **`services` (Fase 15)** — FK base para `service_material_templates`.

### Established Patterns
- Tabelas com `clinic_id + unit_id` — estoque por unidade, produto cadastrado em rede.
- `NUMERIC(12,2)` para valores financeiros; `NUMERIC(12,4)` para quantidades fracionadas.
- `deleted_at TIMESTAMPTZ` — soft delete em todas as tabelas (LGPD).
- RLS `USING (clinic_id = get_my_tenant_id())` + `WITH CHECK` em toda tabela nova.
- Server Actions `'use server'` com Zod validation antes de tocar no banco.
- @base-ui render-prop para primitivos de UI; shadcn/ui para demais componentes.

### Integration Points
- `appointment_procedures` → gatilho da baixa automática (ao concluir procedimento)
- `suppliers` → `preferred_supplier_id` em `products`
- `approval_requests` (Fase 10) → inbox L2 do agente de compras
- `/clinica/prontuario` → seção "Materiais utilizados" no atendimento
- `/config/servicos` → aba "Materiais" no ServiceForm (templates de consumo)

</code_context>

<specifics>
## Specific Ideas

- **Seção "Materiais utilizados" no prontuário**: lista pré-preenchida pelo `service_material_templates`, campos de qtd editáveis, exibição de custo total de insumos após confirmação do procedimento.
- **Dashboard de estoque**: cards de produtos abaixo do mínimo, próximos do vencimento (≤30 dias), saldo negativo — ordenados por criticidade.
- **Relatório ANVISA**: filtro por produto/lote/paciente/período; colunas: paciente, data, procedimento, profissional, lote, validade, número ANVISA, qtd. Export PDF.
- **Custo total de insumos** exibido na tela de atendimento após confirmação do procedimento (informativo, não bloqueia).

</specifics>

<deferred>
## Deferred Ideas

- **Módulo de inventário físico completo** (contagem em lote de todos os produtos) — Fase futura
- **Transferência entre unidades** — Fase futura
- **Integração NF-e de entrada** (recebimento automático por XML de NF-e) — Fase futura
- **Etiquetas físicas ANVISA** (PDF de sticker por implante) — Fase futura
- **Relatórios gerenciais de custo de procedimento** (DRE de insumos) — Fase 19
- **Alerta de validade via WhatsApp/e-mail** — incremento futuro
- **Agente de compras com cálculo por consumo histórico** (30 dias de média) — incremento futuro
- **Inventário físico via QR/etiqueta por item individual** — muito trabalhoso operacionalmente

</deferred>

---

*Phase: 17-estoque-materiais*
*Context gathered: 2026-06-29*
