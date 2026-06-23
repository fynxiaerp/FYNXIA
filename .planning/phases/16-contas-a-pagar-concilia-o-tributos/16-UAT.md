---
status: partial
phase: 16-contas-a-pagar-concilia-o-tributos
source: [16-VERIFICATION.md, 16-HUMAN-UAT.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-22T00:00:00Z
---

## Current Test

[testes adiados pelo usuário — 4 testes pendentes aguardando execução manual contra https://fynxia.vercel.app (deploy da Fase 16 já no ar)]

## Tests

### 1. Baixa parcial de Conta a Pagar sob concorrência
expected: Em /clinica/financeiro/contas-a-pagar, baixa parcial (valorPago < saldo) → parcela status='parcial', despesa criada, saldo_atual debitado; baixa repetida não duplica a despesa (CAS WR-02).
result: [pending]

### 2. Reimportação de extrato OFX (idempotência FITID)
expected: Em /clinica/financeiro/conciliacao, importar um arquivo OFX cria as linhas; reimportar o MESMO arquivo reporta as linhas como "skipped" (sem duplicar). Linhas sem FITID também não duplicam na reimportação.
result: [pending]

### 3. Expiração do signed URL do PDF do RPA
expected: Em /clinica/financeiro/rpa, "Visualizar PDF" abre o PDF do RPA via link assinado de curta duração (TTL=60s); após ~60s o link expira (403). O caminho de armazenamento do PDF não aparece nas listagens.
result: [pending]

### 4. Ciclo de competência (repasse -> fechar -> conciliar) + Cron recorrente
expected: O fluxo repasse->aprovar->gerar CP->fechar competência respeita a guarda de competência fechada (idempotente). O Cron de recorrentes (/api/cron/recorrente) gera as CPs por competência sem ser bloqueado por RLS (fix IN-02 — usa client admin).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0

## Gaps

[none yet]
