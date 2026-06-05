---
status: partial
phase: 02-clinical-mvp
source: [02-VERIFICATION.md]
started: "2026-06-05T22:49:13Z"
updated: "2026-06-05T22:49:13Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Fluxo clínico completo end-to-end
expected: Um dentista, numa sessão autenticada, consegue: criar um agendamento na agenda → registrar/abrir o paciente → escrever um prontuário (diagnóstico + plano) → atualizar o odontograma (status por dente) → coletar a anamnese assinada no canvas. Tudo em fluxo contínuo no navegador.
result: [pending]

### 2. UX de double-booking (23P01)
expected: Ao tentar criar/arrastar dois agendamentos sobrepostos para o mesmo dentista, o segundo é rejeitado pelo constraint GIST e a UI mostra mensagem amigável de conflito (sem quebrar). Requer DB live + duas interações na agenda.
result: [pending]

### 3. Imutabilidade do token de anamnese (single-use)
expected: Um link público de anamnese só pode ser submetido uma vez; reenvio após uso (ou após expirar) retorna erro genérico. Requer DB live para confirmar que o UPDATE atômico (token_used_at IS NULL AND token_expires_at > now AND signature_hash='PENDING') realmente bloqueou o segundo envio.
result: [pending]

### 4. População do audit log (SEC-03)
expected: Um INSERT/UPDATE/DELETE em patients, appointments ou medical_records gera uma nova linha em audit_logs com actor, table_name, record_id e diff. Verificação em runtime no banco.
result: [pending]

### 5. PDF do prontuário — caracteres Latin Extended
expected: O PDF gerado em /api/patients/[id]/prontuario.pdf renderiza corretamente acentuação do português (ã, ç, é, õ...) com a fonte Roboto embutida. Requer servidor rodando (fetch da fonte woff2).
result: [pending]

### 6. Grade de horários do agendamento público (deferral de MVP)
expected: Decisão de produto — `PublicBookingForm.generateSlots()` gera slots client-side sem consultar `appointments`, então horários já ocupados aparecem como selecionáveis. O constraint GIST é a rede de segurança real (impede o double-booking de fato, com mensagem amigável). Confirmar se essa lacuna de UX é aceitável para o release do MVP ou se deve virar gap de Phase 3.
result: [pending]

### 7. Aba "Anamneses" no detalhe do paciente
expected: Decisão de produto — a aba de anamneses na página de detalhe do paciente ainda mostra o stub "Disponível após Plano 04" mesmo após o Plano 04; a listagem foi explicitamente adiada para Phase 3 no SUMMARY. Confirmar aceitação no release.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
