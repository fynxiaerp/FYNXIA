---
status: partial
phase: 18-crc-marketing
source: [18-VERIFICATION.md]
started: 2026-07-13T22:40:00Z
updated: 2026-07-13T22:40:00Z
---

## Current Test

[awaiting human testing — requires running app + live Meta/Resend credentials]

## Tests

### 1. Funil kanban — drag-and-drop + acessibilidade por teclado (18-07)
expected: Arrastar um lead entre colunas (Novo→Contatado) persiste o estágio após reload; navegação por teclado (KeyboardSensor) move o lead de forma acessível.
result: [pending]

### 2. Campanha de reativação — fluxo criar→aprovar→enviar (18-09)
expected: Criar campanha (3 passos) → "Enviar para Aprovação" (status Aguardando, nada enviado) → no inbox de aprovações o card mostra N destinatários + canal + preview → "Aprovar Disparo" dispara via outbox (status Enviada; com credenciais Meta/Resend, mensagem chega); "Rejeitar" deixa a campanha "Rejeitada" e não envia nada.
result: [pending]

### 3. NPS — link público → formulário → submit → classificação (18-10)
expected: Abrir o link /nps/{patientId}/{token} num celular → tema claro forçado, botões 0–10 tocáveis, submit bloqueado até escolher nota → enviar nota + comentário → tela de agradecimento (sem vazar classificação); reabrir o link → "Link inválido" (single-use); nota 0–6 aparece como Detrator no painel e dispara o alerta interno.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
