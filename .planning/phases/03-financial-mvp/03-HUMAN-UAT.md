---
status: partial
phase: 03-financial-mvp
source: [03-VERIFICATION.md, 03-02-PLAN.md Task 4]
started: "2026-06-06T00:00:00Z"
updated: "2026-06-06T20:10:56Z"
---

## Current Test

[awaiting human testing — requires Asaas sandbox account + deployed app]

## Tests

### 1. Fluxo Asaas PIX live (sandbox): createCharge → pagar → webhook → status pago (FIN-04)
expected: `createCharge` com `billingType='PIX'` retorna QR (`encodedImage` + `payload`); após pagar no simulador sandbox, o webhook dispara e `receivables.status` vira `pago` automaticamente (sem reconciliação manual); uma linha `financial_transactions` type='receita' é criada com o valor.
result: [pending]
setup: criar conta grátis em https://sandbox.asaas.com; setar `ASAAS_API_KEY` (`$aact_hmlg_...`), `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3`, `ASAAS_WEBHOOK_SECRET` (local `.env.local` + Vercel); expor via ngrok ou usar URL de preview Vercel; registrar webhook em Integrações → Webhooks → `{url}/api/webhooks/asaas`, authToken = ASAAS_WEBHOOK_SECRET, eventos PAYMENT_CREATED/CONFIRMED/RECEIVED/OVERDUE/REFUNDED/DELETED.
arquivos: src/actions/charges.ts, src/app/api/webhooks/asaas/route.ts (unit: charges.test.ts 9/9, asaas.test.ts 6/6 GREEN).

### 2. Idempotência do webhook (replay) (FIN-09)
expected: reenviar o mesmo evento ("Reenviar" no painel Asaas) NÃO cria uma segunda linha em `financial_transactions` — dedup por `webhook_events.asaas_event_id` UNIQUE + guard em (receivable_id, type='receita').
result: [pending]

### 3. Boleto + parcelamento (FIN-05, FIN-06)
expected: emitir cobrança parcelada → cada parcela aparece em Contas a Receber com vencimento e status próprios; a soma das parcelas é exatamente igual ao total (distribuição de centavos corrigida — última parcela absorve o resto).
result: [pending]

### 4. Recibo PDF — visual + gate (FIN-08)
expected: baixar `/api/financeiro/charges/[id]/recibo.pdf` para uma cobrança paga → PDF renderiza nome da clínica, paciente, valor e data com acentuação correta (Roboto, Flexbox); cobrança não-paga retorna 409; recepcionista consegue baixar (ROADMAP SC-4).
result: [pending]

### 5. Headers de segurança no deploy (SEC-06)
expected: `curl -I https://fynxia.vercel.app` mostra CSP (com `wss://*.supabase.co` + Asaas), HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff em todas as respostas; o app continua funcionando (Supabase Realtime + Asaas não bloqueados pela CSP).
result: passed — verificado em 2026-06-06 via `curl -I https://fynxia.vercel.app/login`: os 4 headers presentes; CSP connect-src permite supabase (https+wss) e Asaas; img-src permite data:/blob: (QR Pix); app responde 200.

### 6. Régua de cobrança — entrega de e-mail (Resend) (FIN-07)
expected: o Vercel Cron diário (`0 8 * * *`, protegido por `CRON_SECRET`) roda contra recebíveis vencidos → e-mail de cobrança real entregue via Resend com o nome real da clínica; segundo disparo do cron NÃO reenvia o mesmo lembrete (idempotente por recebível+marco via `collection_log`).
result: [pending]

## Summary

total: 6
passed: 1
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

- Todos os 6 itens dependem de runtime/live: conta sandbox Asaas (D-02), app deployado, e disparo do cron. O código está unit-testado (256/256 GREEN, next build limpo) — estas são confirmações de comportamento em produção.
- FIN-09 permanece "Pending" na REQUIREMENTS.md até o replay de webhook live confirmar idempotência (código completo, 15/15 unit tests).
- Pré-requisito recorrente: o teste do `db push`/Asaas exige o Supabase CLI logado na conta do FYNXIA (org kczvihafddupruvsrrsc) — ver memória do projeto.
