---
status: partial
phase: 16-contas-a-pagar-concilia-o-tributos
source: [16-VERIFICATION.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-22T00:00:00Z
---

## Current Test

[awaiting human testing — executar contra https://fynxia.vercel.app após deploy do master]

## Tests

### 1. Baixa parcial de Conta a Pagar sob concorrência
expected: Ao dar baixa parcial em uma parcela (valorPago < saldo), a parcela vira status='parcial', uma financial_transaction type='despesa' é criada e o saldo_atual da conta bancária é debitado. Uma segunda baixa concorrente na mesma parcela NÃO duplica a despesa (CAS reordenado WR-02 — claim antes do insert).
result: [pending]

### 2. Reimportação de extrato OFX (idempotência FITID)
expected: Importar o mesmo arquivo OFX duas vezes não duplica linhas — a segunda importação reporta as linhas como "skipped" (índices UNIQUE parciais bank_account_id+fitid / +fitid_fallback ativos no Supabase sa-east-1). Linhas sem FITID recebem fitid_fallback (SHA-256) e também não duplicam.
result: [pending]

### 3. Expiração do signed URL do PDF do RPA
expected: "Visualizar PDF" do RPA abre via signed URL com TTL=60s; após ~60s o link expira (403). O campo pdf_storage_path nunca é exposto nas listagens ao cliente.
result: [pending]

### 4. Ciclo de competência (repasse -> fechar -> conciliar) + Cron recorrente
expected: O fluxo repasse->aprovar->gerar CP->fechar competência respeita a guarda de competência fechada (idempotente, ON CONFLICT DO NOTHING). Verificar também que o Cron de recorrentes (/api/cron/recorrente) gera as CPs por competência — ATENÇÃO ao aviso IN-02: confirmar que os inserts de CP recorrente NÃO são silenciosamente bloqueados por RLS (cron deve usar client admin/service, não anon sem sessão).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
