---
status: partial
phase: 04-communications-async
source: [04-VERIFICATION.md]
started: "2026-06-07T18:06:25Z"
updated: "2026-06-07T18:06:25Z"
---

## Current Test

[awaiting human testing — requires Meta Business verification + deployed app]

## Tests

### 1. Lembrete de consulta via WhatsApp live (COMMS-01, COMMS-03)
expected: o cron `reminder-dispatch` (`0 11 * * *` = 08h BRT) varre as consultas do dia seguinte e o paciente recebe o template de lembrete (categoria utility) com botões Confirmar/Cancelar via Meta Cloud API — sem ação manual.
result: [pending]
setup: (1) iniciar a verificação Meta Business (7-14 dias); (2) criar o app WhatsApp Cloud API, registrar o template "lembrete de consulta" (utility, pt_BR, 2 botões quick-reply) e aguardar aprovação; (3) setar `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID` + `CRON_SECRET` no Vercel; (4) criar uma consulta de teste para amanhã e disparar o cron.

### 2. Lembrete de consulta via e-mail live (COMMS-02)
expected: o mesmo cron envia o e-mail de lembrete via Resend (template React Email `AppointmentReminderEmail`) com os detalhes corretos (paciente, data, horário, dentista, clínica) em pt-BR.
result: [pending]
setup: `RESEND_API_KEY` já configurado; precisa do app deployado + `CRON_SECRET` + uma consulta de teste.

### 3. Cobrança via WhatsApp com link Asaas (COMMS-03 / D-05)
expected: o cron `collection-ruler` envia a mensagem de cobrança via WhatsApp para recebíveis vencidos, com o **link de pagamento Asaas real** (resolvido em runtime via `gateway.getInvoiceUrl` → GET /payments/{id}); só envia se o link for válido.
result: [pending]
setup: depende da verificação Meta (item 1) + conta/sandbox Asaas (UAT da Fase 3) + um recebível vencido.

### 4. Idempotência sob concorrência (COMMS-04)
expected: o claim atômico do worker (`UPDATE ... WHERE status='pending' AND attempts=N`) garante que runs sobrepostos do cron (entrega at-least-once do Vercel) NÃO geram envio duplicado. Confirmar com um teste de carga concorrente ou reexecução manual do cron.
result: [pending]
setup: app deployado + disparar o cron 2x próximos; confirmar 0 envios duplicados em `message_outbox`/`message_log`.

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

- Todos os 4 itens dependem de runtime/live: verificação Meta Business (não iniciada — D-02), templates aprovados, app deployado, env WHATSAPP_* + CRON_SECRET. O código está unit-testado (306/306 GREEN, next build limpo) — estas são confirmações de comportamento em produção.
- **Iniciar a verificação Meta Business AGORA** (lead-time 7-14 dias) é o gargalo principal para os itens 1 e 3.
- Pré-requisito recorrente do db push: Supabase CLI logado na conta FYNXIA (org kczvihafddupruvsrrsc) — ver memória do projeto.
