---
status: partial
phase: 14-financeiro-cadastros-base
source: [14-VERIFICATION.md]
started: "2026-06-20"
updated: "2026-06-20"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Plano de Contas — tree rendering (FCAD-01 SC1)
expected: Em `/clinica/financeiro` aparecem 3 cards (Plano de Contas, Centros de Custo, Contas Correntes). Em `/clinica/financeiro/plano-de-contas` a árvore Accordion renderiza a hierarquia odontológica semeada (1 Receitas → 1.1 → 1.1.1…, 2 Despesas → 2.1 → 2.1.4 Laboratório), tudo expandido, códigos monoespaçados em coluna fixa, badges de tipo coloridos. "Nova Conta" sob 2.1 cria leaf com código auto-gerado; desativar "ativo" renderiza strikethrough. Como `socio` (read-only): sem botões Edit/Add.
result: [pending]

### 2. Transaction modal — classification UX (FCAD-02 SC2)
expected: No modal de lançamento, Conta Contábil + Centro de Custo são obrigatórios (inline "Campo obrigatório" se vazios), Conta Corrente opcional. Selecionar categoria faz auto-fill da conta contábil (com texto auxiliar) e pré-seleciona o CC default. Em `/clinica/financeiro/categorias` o mapeamento categoria→conta funciona. No fluxo de caixa, o filtro por unidade/centro de custo persiste no URL (nuqs) e filtra os lançamentos.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
