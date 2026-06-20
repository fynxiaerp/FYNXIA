---
status: partial
phase: 15-faturamento-nfs-e-conv-nios-tiss
source: [15-VERIFICATION.md]
started: 2026-06-20T00:00:00Z
updated: 2026-06-20T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. OS auto-creation end-to-end
expected: Marcar um agendamento como "concluído" cria uma OS rascunho que aparece em /clinica/financeiro/faturamento/os com nome do paciente mascarado (primeiro nome + inicial do sobrenome).
result: [pending]

### 2. Faturar OS particular
expected: Em uma OS particular rascunho, "Faturar OS" abre AlertDialog de confirmação; ao confirmar, status muda para "faturada" e a NFS-e aparece como "emitida" no histórico de NFS-e.
result: [pending]

### 3. Convênio flow (guia + lote)
expected: Faturar uma OS de convênio cria a guia TISS em "em análise"; "Fechar lote" agrupa por operadora e retorna protocolo (stub).
result: [pending]

### 4. Glosa + recurso
expected: Registrar recurso pela GlosaRecursoSheet atualiza o status da guia para "em recurso" na tela de convênios/glosas.
result: [pending]

### 5. Operadoras role gate
expected: Usuário com papel "dentista" não acessa /clinica/financeiro/faturamento/operadoras (mostra acesso negado, não erro 500).
result: [pending]

### 6. LGPD masking
expected: Todas as tabelas exibem primeiro nome + inicial; CPF mascarado no OsSheet (***.xxx.xxx-**); "Ver nota" da NFS-e usa signed URL (TTL 60s), nunca o storage_path bruto.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
