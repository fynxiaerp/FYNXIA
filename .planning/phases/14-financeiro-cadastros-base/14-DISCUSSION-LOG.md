# Phase 14: Financeiro — Cadastros Base - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisões são capturadas no CONTEXT.md — este log preserva as alternativas consideradas.

**Date:** 2026-06-19
**Phase:** 14-financeiro-cadastros-base
**Areas discussed:** Centro de custo, Plano de contas + categorias, Classificação obrigatória + legado, Contas correntes + rateio

---

## Centro de custo

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela cost_centers + áreas | `cost_centers` própria, vinculada a unit_id, com áreas; seed 1 CC/unidade | ✓ |
| Reusar unit_id direto | Centro de custo = a própria unidade, sem tabela nova | |

**User's choice:** Tabela cost_centers + áreas
**Notes:** Habilita rateio por unidade/área (FCAD-02).

---

## Plano de contas + categorias

| Option | Description | Selected |
|--------|-------------|----------|
| Seed padrão + categoria mapeia conta | `chart_of_accounts` hierárquico com seed editável; financial_categories referencia conta folha; coexistem | ✓ |
| Plano substitui categorias | chart_of_accounts absorve categorias; financial_categories descontinuada/migrada | |
| Começar vazio | Sem seed; admin monta do zero | |

**User's choice:** Seed padrão + categoria mapeia conta
**Notes:** Sem duplicação; categoria = atalho de UX, conta contábil = camada formal.

---

## Classificação obrigatória + legado

| Option | Description | Selected |
|--------|-------------|----------|
| Obrigatório em novos + default p/ auto/legado | Manuais novos exigem conta+CC; auto-postados/legado recebem default; backfill na migração | ✓ |
| Obrigatório em tudo (sem default) | Força classificação inclusive no webhook | |
| Opcional por enquanto | Colunas não obrigatórias ainda (contraria FCAD-02) | |

**User's choice:** Obrigatório em novos + default p/ auto/legado
**Notes:** Default = conta da categoria + CC default da unidade do lançamento.

---

## Contas correntes + rateio

| Option | Description | Selected |
|--------|-------------|----------|
| Cadastro + vínculo opcional, rateio 1:1 | bank_accounts; lançamento referencia conta corrente (opcional); 1 lançamento → 1 CC | ✓ |
| Rateio percentual multi-CC agora | Divisão de 1 lançamento em vários CCs por % | |
| Só cadastro, sem vínculo | Cadastra contas correntes sem vincular a lançamentos | |

**User's choice:** Cadastro + vínculo opcional, rateio 1:1
**Notes:** Rateio percentual multi-CC deferido para fase futura.

## Claude's Discretion

- Nomenclatura de colunas/índices e numeração contábil do plano de contas (estilo brasileiro).
- Conteúdo exato do seed do plano de contas odontológico (derivado das categorias seed da Phase 3).
- Componente de UI da árvore (a definir em UI-SPEC).

## Deferred Ideas

- Rateio percentual multi-centro de custo (fase futura).
- Vínculo obrigatório de conta corrente + movimentação de saldo bancário (Phase 16).
- Relatórios/BI por centro de custo consolidados (fase de consolidação).
