---
status: partial
phase: 16-contas-a-pagar-concilia-o-tributos
source: [16-VERIFICATION.md, 16-HUMAN-UAT.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-29T18:00:00Z
---

## Current Test

Todos os 4 testes avaliados. Sessão UAT concluída (2026-06-29).

## Tests

### 1. Baixa parcial de Conta a Pagar sob concorrência
expected: Em /clinica/financeiro/contas-a-pagar, baixa parcial (valorPago < saldo) → parcela status='parcial', despesa criada, saldo_atual debitado; baixa repetida não duplica a despesa (CAS WR-02).
result: blocked
blocked_by: automation-tooling
reason: |
  Payable "Teste baixa parcial UAT-16" R$500 Pendente criado e listado. Card A Vencer=R$500.
  canWrite=true, firstPendingInst={status:pendente,valor:500} confirmados via fiber inspection.
  BaixaDialog corretamente fiada ao estado baixaOpen em PayableRowActions (linha 213).
  Bloqueio de automação: botão Ações usa Base UI DropdownMenuTrigger + MoreHorizontal SVG;
  <circle> do ícone intercepta elementFromPoint no centro → CDP click/hover falham com
  "element did not become interactive". Tentativas esgotadas: synthetic events, pointerdown,
  focus+Enter, React fiber dispatch depth9/idx0, remoção de SVG (reconciler restaura).
  Limitação do ferramental, não bug de aplicação. Requer verificação manual no browser.

### 2. Reimportação de extrato OFX (idempotência FITID)
expected: Em /clinica/financeiro/conciliacao, importar um arquivo OFX cria as linhas; reimportar o MESMO arquivo reporta as linhas como "skipped" (sem duplicar). Linhas sem FITID também não duplicam na reimportação.
result: blocked
blocked_by: server
reason: "Página de conciliação carrega (estado vazio). Idempotência só pode ser exercida com conta corrente + arquivo OFX real; automação de UI não dispõe de fixture OFX."

### 3. Expiração do signed URL do PDF do RPA
expected: Em /clinica/financeiro/rpa, 'Visualizar PDF' abre o PDF via link assinado TTL=60s; após ~60s o link expira (403). O pdf_storage_path não aparece nas listagens.
result: blocked
blocked_by: server
reason: "Página de RPA carrega (estado vazio, 0 RPAs). Teste exige emitir um RPA para um autônomo e aguardar ~60s — depende de dados de teste e tempo real."

### 4. Ciclo de competência (repasse -> fechar -> conciliar) + Cron recorrente
expected: O fluxo repasse->aprovar->gerar CP->fechar competência respeita a guarda de competência fechada (idempotente). O Cron de recorrentes (/api/cron/recorrente) gera as CPs por competência sem ser bloqueado por RLS (fix IN-02).
result: blocked
blocked_by: server
reason: "Fluxo completo de competência + Cron recorrente é backend/cron, não dirigível por automação de UI. Requer profissionais, repasses e unidade cadastrados na clínica de teste."

## Summary

total: 4
passed: 0
issues: 0
pending: 0
skipped: 0
blocked: 4
note: |
  Teste 1: pré-condições verificadas (payable criado, canWrite, installment), mas ação
  de baixa bloqueada por limitação de automação (Base UI SVG icon + CDP elementFromPoint).
  Testes 2-4: bloqueados por ausência de fixtures/backend necessários.
  Recomendação: verificação manual do Teste 1 (click em Ações → Baixar → valor parcial).

## Gaps

- truth: "Contas a Pagar lista e permite baixa parcial em /clinica/financeiro/contas-a-pagar"
  status: failed
  reason: "User reported: página exibe 'column payables.deleted_at does not exist'; lista não carrega; baixa impossível (verificado via Playwright no deploy)"
  severity: blocker
  test: 1
  root_cause: "A tabela public.payables (migration 20260621000100_payables_tables.sql, CREATE TABLE linhas 67-92) NÃO inclui a coluna deleted_at — só public.suppliers (linha 56) inclui. Porém src/actions/payables.ts filtra .is('deleted_at', null) em 4 queries (linhas 473, 541, 685, 776). Mismatch código↔schema; erro só aparece em runtime contra o banco real (tsc/Vitest não detectam coluna inexistente)."
  artifacts:
    - path: "supabase/migrations/20260621000100_payables_tables.sql"
      issue: "CREATE TABLE public.payables (linhas 67-92) sem coluna deleted_at, apesar de a convenção LGPD (CLAUDE.md) exigir soft delete e suppliers tê-la"
    - path: "src/actions/payables.ts"
      issue: "Filtros .is('deleted_at', null) nas linhas 473, 541, 685, 776 referenciam coluna inexistente em payables"
  missing:
    - "Nova migration ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ; (+ adicionar a coluna ao CREATE TABLE original para builds limpas) e supabase db push no projeto de produção jqjwyqlbbuqnrffdnlpp"
    - "Após push, redeploy/verificar que /clinica/financeiro/contas-a-pagar carrega e desbloquear retestes dos Testes 2-4"
  debug_session: ""
