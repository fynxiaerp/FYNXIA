# Phase 17: Estoque & Materiais - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 17 - Estoque & Materiais
**Areas discussed:** Modelo de produto & custo médio, Baixa automática de estoque, Rastreabilidade ANVISA, Alertas & agente de compras, Telas & navegação, Permissões, Inventário & ajuste, Integração no prontuário, Multiunidade, Relatório de custo, Agente L2 detalhes, Cron de validade, Saldo negativo, Templates de consumo UI

---

## Modelo de produto & custo médio

| Option | Description | Selected |
|--------|-------------|----------|
| Custo médio móvel | Recalculado a cada entrada. Padrão brasileiro. | ✓ |
| PEPS/FIFO | Rastreamento individual por unidade. Muito complexo. | |

**User's choice:** Custo médio móvel

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela separada `products` | Produto de estoque ≠ serviço faturável. | ✓ |
| Extender `services` | Adicionar colunas de estoque ao catálogo. | |

**User's choice:** Tabela separada `products`

| Option | Description | Selected |
|--------|-------------|----------|
| Categorias com campos distintos | Implante: ANVISA + lote; Medicamento: validade; Insumo: genérico. | ✓ |
| Mesmo campos para todas | Categoria apenas como rótulo. | |

**User's choice:** Categorias com campos e validações distintos por tipo

---

## Baixa automática de estoque

| Option | Description | Selected |
|--------|-------------|----------|
| Ao registrar procedimento concluído em `appointment_procedures` | Alinhado com Phase 15. | ✓ |
| Ao aprovar/fechar a OS | Lag entre uso real e débito. | |

**User's choice:** Ao registrar procedimento concluído

| Option | Description | Selected |
|--------|-------------|----------|
| Template `service_material_templates` | service_id → product_id + qtd_padrão. | ✓ |
| Informação manual no momento do procedimento | Sem template. | |

**User's choice:** Template de consumo por serviço

| Option | Description | Selected |
|--------|-------------|----------|
| Sim — operador ajusta qtd | Baixa parcial permitida. | ✓ |
| Não — débita sempre qtd padrão | Mais simples. | |

**User's choice:** Sim, baixa parcial permitida

---

## Rastreabilidade ANVISA de implante

| Option | Description | Selected |
|--------|-------------|----------|
| Lote = entrada de compra (N unidades) | Padrão ANVISA real. FIFO automático. | ✓ |
| 1 implante = 1 lote | Muito trabalhoso operacionalmente. | |

| Option | Description | Selected |
|--------|-------------|----------|
| `stock_draws` referencia procedure + lote | Relatório ANVISA via filtro. | ✓ |
| Tabela separada patient_implants | Duplica informação. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Rastreabilidade digital — sem etiqueta | Export PDF sob demanda. | ✓ |
| Gerar PDF de etiqueta | Mais trabalho. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Entrada manual com formulário | Produto, lote, validade, número ANVISA. | ✓ |
| Integrado à CP | Requer CP prévia. | |

---

## Alertas & agente de compras

| Option | Description | Selected |
|--------|-------------|----------|
| L2 — agente cria rascunho CP com aprovação humana | Inbox de aprovações Phase 10. | ✓ |
| Só notifica | Manual. | |
| L3 — cria e efetiva automaticamente | Risco de CP indevida. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Real-time na baixa | Imediato após stock_draw. | ✓ |
| Cron diário | Lag de até 24h. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Validade só alerta | Vencimento = descarte. | ✓ |
| Validade dispara reposição | Mais complexo. | |

| Option | Description | Selected |
|--------|-------------|----------|
| UI only | Badge/banner na tela de estoque. | ✓ |
| UI + WhatsApp | Exige template Meta. | |
| UI + e-mail | Via Resend. | |

---

## Agente L2 — detalhes

| Option | Description | Selected |
|--------|-------------|----------|
| `preferred_supplier_id` no produto | Se não configurado, só alerta. | ✓ |
| Último fornecedor do histórico | Pode ser errado. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Qtd = estoque_maximo - saldo_atual | Admin aprova/ajusta. | ✓ |
| Qtd por consumo histórico | Requer histórico. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Admin via inbox Phase 10 | Reutiliza AIG-02. | ✓ |
| Financeiro via WhatsApp/e-mail | Depende de canal. | |

---

## Telas & navegação

| Option | Selected |
|--------|----------|
| `/clinica/estoque` — clínico | ✓ |
| `/config/estoque` | |

**Sub-páginas:** Dashboard + Lista de produtos + Entradas + Relatório ANVISA

---

## Permissões

Admin/operacional: escrita. Dentista/recep: leitura. Baixa manual com motivo obrigatório.

---

## Inventário

Ajuste manual com motivo (mesma tela de baixa manual). Sem módulo de inventário físico completo.

---

## Integração no prontuário

Seção "Materiais utilizados" no prontuário — pré-preenchida pelo template, editável antes de confirmar.

---

## Multiunidade

Por unidade, independente (`unit_id`).

---

## Relatório de custo

Exibir custo total de insumos após confirmar o procedimento (informativo).

---

## Templates de consumo UI

Aba "Materiais" no ServiceForm (`/config/servicos`).

---

## Saldo negativo

Permite baixa com alerta — não bloqueia o atendimento.

---

## Cron de validade

Semanal — suficiente para planejamento.

---

## Claude's Discretion

- Nomes/colunas/índices exatos das novas tabelas
- Enums de status de produto
- Implementação FIFO automático de lotes
- Threshold padrão de alerta de validade
- Seed de categorias e unidades de medida
- Layout/componentização fina → `/gsd-ui-phase`

## Deferred Ideas

- Módulo de inventário físico completo
- Transferência entre unidades
- Integração NF-e de entrada
- Etiquetas físicas ANVISA
- Relatórios de custo DRE → Fase 19
- Alerta de validade via WhatsApp/e-mail
- Agente com cálculo por consumo histórico
