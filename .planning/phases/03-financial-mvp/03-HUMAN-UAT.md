---
status: partial
phase: 03-financial-mvp
source: [03-02-PLAN.md Task 4]
started: "2026-06-06T00:00:00Z"
updated: "2026-06-06T00:00:00Z"
---

## Current Test

[awaiting human testing — Asaas sandbox account not yet provisioned]

## Tests

### 1. Fluxo Asaas live (sandbox): PIX createCharge → pagar → webhook → idempotência (FIN-09)

**Requer:** Conta sandbox Asaas gratuita + ASAAS_API_KEY + ASAAS_BASE_URL + ASAAS_WEBHOOK_SECRET + webhook registrado (ngrok ou URL Vercel preview).

**expected:**
1. `createCharge` com `billingType='PIX'` retorna `{ success: true, chargeId, pix: { encodedImage, payload } }` — QR code válido
2. Após pagar a cobrança no simulador sandbox da Asaas, o webhook dispara para a URL registrada
3. No banco: `receivables.status` passa de `'pendente'` para `'pago'` e `paid_at` é preenchido
4. Uma linha é inserida em `financial_transactions` com `type='receita'`, `amount = valor da cobrança`
5. Um segundo disparo do mesmo evento (reenvio via painel Asaas → "reenviar webhook") **NÃO** cria uma segunda linha em `financial_transactions` — idempotência garantida por `webhook_events.asaas_event_id` UNIQUE + guard em `(receivable_id, type='receita')`

**result:** [pending]

**Por que foi deferido (D-02):** Requer conta sandbox Asaas gratuita e registro do webhook com URL HTTPS pública — nenhuma dessas credenciais está provisionada ainda. O código está 100% unit-testado (15/15 GREEN); este teste valida o fluxo real de rede end-to-end.

**Setup necessário antes de executar:**

1. Criar conta sandbox em https://sandbox.asaas.com (gratuito)
2. Copiar a API Key sandbox (`$aact_hmlg_...`) e adicionar ao `.env.local` + Vercel preview env:
   ```
   ASAAS_API_KEY=$aact_hmlg_SUA_CHAVE_AQUI
   ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
   ```
3. Gerar um token de webhook (32-255 chars) e adicionar:
   ```
   ASAAS_WEBHOOK_SECRET=seu_token_secreto_aqui
   ```
4. Expor o app localmente via ngrok (ou usar URL de preview Vercel):
   ```bash
   ngrok http 3000
   ```
5. No painel Asaas sandbox → Configurações → Integrações → Webhooks → Criar webhook:
   - URL: `{sua-url-publica}/api/webhooks/asaas`
   - authToken: valor de `ASAAS_WEBHOOK_SECRET`
   - Eventos: `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`
6. Executar o teste: criar PIX charge para um paciente teste → pagar no simulador → verificar DB

**Arquivos relevantes:**
- `src/actions/charges.ts` — createCharge Server Action
- `src/app/api/webhooks/asaas/route.ts` — webhook handler
- `src/__tests__/actions/charges.test.ts` — 9/9 GREEN (unit)
- `src/__tests__/webhooks/asaas.test.ts` — 6/6 GREEN (unit)

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0
resolved: 0

## Gaps

- Item 1 (live sandbox Asaas PIX → webhook → idempotência) pendente de conta Asaas sandbox + registro de webhook. Código unit-testado. Pode ser executado em paralelo com Wave 3 (03-03 + 03-04) assim que as credenciais forem provisionadas.
