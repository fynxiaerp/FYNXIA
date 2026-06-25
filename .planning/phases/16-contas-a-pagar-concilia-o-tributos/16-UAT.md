---
status: diagnosed
phase: 16-contas-a-pagar-concilia-o-tributos
source: [16-VERIFICATION.md, 16-HUMAN-UAT.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-25T00:00:00Z
---

## Current Test

[testing complete — 1 blocker confirmado via Playwright contra https://fynxia.vercel.app; testes 2–4 bloqueados pela falha do schema (e por exigirem fixtures/backend que automação de UI não dirige)]

## Tests

### 1. Baixa parcial de Conta a Pagar sob concorrência
expected: Em /clinica/financeiro/contas-a-pagar, baixa parcial (valorPago < saldo) → parcela status='parcial', despesa criada, saldo_atual debitado; baixa repetida não duplica a despesa (CAS WR-02).
result: issue
reported: "Página /clinica/financeiro/contas-a-pagar exibia banner de erro 'column payables.deleted_at does not exist'. A lista nunca carregava — impossível listar ou dar baixa. Verificado via Playwright no deploy."
severity: blocker
fix: "Migration 20260625000100_payables_add_deleted_at.sql (ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ) aplicada em produção via supabase db push em 2026-06-25. Retestado via Playwright: o banner de erro sumiu e a página renderiza os cards (A Vencer/Vencido/Pago no Mês) + estado vazio. Schema corrigido — a assertiva funcional de baixa parcial + concorrência (WR-02) ainda requer execução com dados de teste."

### 2. Reimportação de extrato OFX (idempotência FITID)
expected: Em /clinica/financeiro/conciliacao, importar um arquivo OFX cria as linhas; reimportar o MESMO arquivo reporta as linhas como "skipped" (sem duplicar). Linhas sem FITID também não duplicam na reimportação.
result: blocked
blocked_by: server
reason: "Página de conciliação carrega (estado vazio, sem conta corrente cadastrada). Idempotência só pode ser exercida com uma conta corrente + arquivo OFX reimportado; automação de UI não dispõe de fixture OFX. Reteste após corrigir o blocker do schema."

### 3. Expiração do signed URL do PDF do RPA
expected: Em /clinica/financeiro/rpa, "Visualizar PDF" abre o PDF do RPA via link assinado de curta duração (TTL=60s); após ~60s o link expira (403). O caminho de armazenamento do PDF não aparece nas listagens.
result: blocked
blocked_by: server
reason: "Página de RPA carrega (estado vazio, 0 RPAs). Testar expiração do signed URL exige emitir um RPA para um autônomo e aguardar ~60s — depende de dados de teste e de tempo real. Não exercido nesta passada."

### 4. Ciclo de competência (repasse -> fechar -> conciliar) + Cron recorrente
expected: O fluxo repasse->aprovar->gerar CP->fechar competência respeita a guarda de competência fechada (idempotente). O Cron de recorrentes (/api/cron/recorrente) gera as CPs por competência sem ser bloqueado por RLS (fix IN-02 — usa client admin).
result: blocked
blocked_by: server
reason: "Fluxo completo de competência + Cron recorrente é backend/cron, não dirigível por automação de UI. Além disso, a geração de CP grava em payables — bloqueada pelo mesmo erro de schema do Teste 1. Reteste após o fix."

## Summary

total: 4
passed: 0
issues: 1
pending: 0
skipped: 0
blocked: 3

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
