---
status: partial
phase: 16-contas-a-pagar-concilia-o-tributos
source: [16-VERIFICATION.md, 16-HUMAN-UAT.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-29T00:00:00Z
---

## Current Test

[testing paused — todos os 4 testes bloqueados por ausência de seed na clínica de teste; schema fix verificado via Playwright em 2026-06-29]

## Tests

### 1. Baixa parcial de Conta a Pagar sob concorrência
expected: Em /clinica/financeiro/contas-a-pagar, baixa parcial (valorPago < saldo) → parcela status='parcial', despesa criada, saldo_atual debitado; baixa repetida não duplica a despesa (CAS WR-02).
result: blocked
blocked_by: prior-phase
reason: "Schema fix verificado via Playwright em 2026-06-29: página carrega sem erro, cards A Vencer/Vencido/Pago no Mês renderizam, modal Nova Conta a Pagar abre com todos os campos. Dados parciais inseridos via Supabase CLI: fornecedor 'Fornecedor Teste UAT' (a98c107c), conta contábil 'Despesas Operacionais UAT' (c875e17c), conta corrente 'Conta Corrente UAT' R$1000 (dbd664ea). Bloqueio restante: clínica de teste não tem nenhuma unidade (units) cadastrada → cost_centers.unit_id é NOT NULL → impossível criar centro de custo → impossível criar conta a pagar via UI. Funcional de baixa parcial + WR-02 não pode ser exercido sem seed de unidade."

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
