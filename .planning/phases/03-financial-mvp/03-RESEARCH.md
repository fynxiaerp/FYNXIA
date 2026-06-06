# Phase 3: Financial MVP - Research

**Researched:** 2026-06-06
**Domain:** Payment gateway integration (Asaas REST), receivables tracking, cash flow, collection ruler (Vercel Cron + Resend), PDF receipts, security headers (CSP/HSTS)
**Confidence:** HIGH (Asaas API, Vercel Cron, Next.js headers verified from official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** MVP uses Asaas exclusively (PIX, boleto, cartão via tokenização) behind a `PaymentGateway` abstraction (interface + adapter Asaas). Schema is provider-agnostic: `provider` (default `'asaas'`) + `provider_charge_id`.
- **D-02:** No Asaas account yet. Design against documented REST API, env vars `ASAAS_API_KEY` + `ASAAS_BASE_URL`. Live test is a blocking checkpoint until sandbox account is created.
- **D-03:** Asaas-native installments (`installmentCount`/`totalValue`). Each parcel mirrored as a local receivable row with its own `provider_charge_id`, synced via webhook.
- **D-04:** Status `vencido` derived at read-time (`due_date < today AND status != 'pago'`). No cron for AR status derivation.
- **D-05:** Seeded editable category list per tenant (dental income and expense categories).
- **D-06:** Store `asaas_customer_id` (Claude's discretion on where — see Discretion below).
- **D-07:** Webhook: HTTP 200 immediately, validate `asaas-access-token` header, dedup by event id / provider_charge_id + status, use `createAdminClient()`.
- **D-08:** Regime de caixa. Confirmed Asaas payment auto-posts income. Manual entry covers expenses. View = totals + transaction list.
- **D-09:** Vercel Cron (daily endpoint) for collection ruler — FREE plan has no pg_cron/pgmq.
- **D-10:** Collection ruler: engine + real email via Resend in Phase 3; WhatsApp deferred to Phase 4. Idempotent per (receivable + collection milestone).
- **D-11:** SEC-06 security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options.

### Claude's Discretion
- Where to store `asaas_customer_id` (on `patients` table or separate billing table).
- Whether to add an optional bar chart to the cash flow page.
- Exact async processing structure in the webhook handler (inline after 200, or events table).
- Approach for D-11 security headers (next.config headers vs middleware CSP nonces).
- Layout details (UI-SPEC governs).

### Deferred Ideas (OUT OF SCOPE)
- Multi-gateway (PagSeguro, Infinite Pay, Mercado Pago, Stripe para pacientes).
- Stripe para assinatura SaaS da clínica.
- WhatsApp como canal da régua de cobrança (Phase 4).
- Regras de juros/multa/desconto customizáveis.
- NFSe fiscal.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIN-01 | Cash flow view: entradas × saídas do mês corrente | D-08 regime de caixa; `financial_transactions` table; month filter via nuqs `?month=YYYY-MM` |
| FIN-02 | Manual transaction entry (receita/despesa, categoria, valor, data) | `createTransaction` Server Action; `financial_categories` seed; dialog pattern |
| FIN-03 | Receivables list with status pendente/pago/vencido + due date | `receivables` table; derived `vencido` at read-time (D-04); TanStack Table |
| FIN-04 | Generate PIX payment link (Asaas); auto-confirmation via webhook | Asaas `POST /v3/payments` billingType=PIX; `GET /v3/payments/{id}/pixQrCode`; webhook PAYMENT_RECEIVED |
| FIN-05 | Generate boleto (Asaas); auto-confirmation via webhook | Same endpoint, billingType=BOLETO; `bankSlipUrl` in response |
| FIN-06 | Track installments with date and status per parcel | Asaas `installmentCount` + `totalValue`; `GET /v3/installments/{id}/payments`; each parcel = local receivable row |
| FIN-07 | Automatic collection ruler (email/WhatsApp) at due date and every N overdue days | Vercel Cron daily; `collection_rules` + `collection_log` tables; Resend email; idempotency by (receivable_id + milestone) |
| FIN-08 | PDF receipt via @react-pdf/renderer | Reuse ProntuarioPDF pattern (Flexbox, Roboto, nodejs runtime); route `GET /api/financeiro/charges/[id]/recibo.pdf` |
| FIN-09 | Asaas webhook handler: HTTP 200 immediate, idempotent, no duplicate credits | `asaas-access-token` header validation; `webhook_events` dedup table; processAsync after response |
| SEC-06 | Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options | next.config.ts `headers()` for HSTS/X-Frame/X-Content-Type; middleware CSP nonce (or `unsafe-inline` for ERP context) |
</phase_requirements>

---

## Summary

Phase 3 adds the full financial layer to FYNXIA: charge creation via Asaas REST (PIX/boleto/cartão), receivables tracking with installment support, cash flow view (regime de caixa), automated collection ruler via Vercel Cron + Resend email, PDF receipts, and a hardened HTTP security posture. All seven of these domains are well-documented and technically low-risk, with the major caveat being that the Asaas sandbox account must be created before live-testing any charge creation flow (D-02 blocking checkpoint).

The project already has every supporting primitive needed: `@react-pdf/renderer` installed and pattern-proven (ProntuarioPDF.tsx), Resend integrated with a react-email template (InviteEmail.tsx), `logBusinessEvent` for audit, `createAdminClient()` for the webhook handler (no session required), and the RLS/audit migration pattern established in Phase 2. This phase is primarily new migrations + new Server Actions + new UI pages, reusing the established stack throughout.

The one architectural risk is the webhook handler async pattern: the FREE Supabase plan has no pgmq queue, so the webhook must either (a) process inline after `return new Response('', { status: 200 })` — which is not guaranteed to execute in serverless (response sent = function may terminate), or (b) write to a `webhook_events` table and rely on a second Vercel Cron to drain it. The research conclusion is to use option (b) with a `webhook_events` table and a separate fast Cron, or option (a) with understanding that Vercel Fluid Compute keeps the function alive long enough if processing is < 10 seconds. The plan must explicitly choose one approach.

**Primary recommendation:** Use the `PaymentGateway` abstraction (D-01); implement Asaas adapter calling REST directly with typed wrappers; dedup webhooks via a `webhook_events` table with unique constraint on `(asaas_event_id)`; process webhook inline using a fire-and-forget Promise (acceptable for < 5 second DB writes in Fluid Compute).

---

## Project Constraints (from CLAUDE.md)

The following directives from CLAUDE.md are mandatory and override any research alternative:

| Directive | Rule |
|-----------|------|
| Asaas integration | REST API directly — no community SDKs |
| PDF generation | `@react-pdf/renderer` Flexbox only — no Puppeteer, no CSS Grid |
| State management | TanStack Query v5 + nuqs + Zustand — no Redux, no SWR |
| Auth | `@supabase/ssr` only — no `@supabase/auth-helpers-nextjs` |
| Client types | `createAdminClient()` server-only (service key never NEXT_PUBLIC_) |
| RLS | Every financial table needs `tenant_id` indexed + USING + WITH CHECK via `get_my_tenant_id()` |
| Runtime | All PDF and DB-touching routes: `export const runtime = 'nodejs'` — never Edge |
| Card data | No raw card numbers — Asaas tokenization only |
| Webhook idempotency | Check payment status before updating DB; dedup by event id |
| Webhooks | Validate `asaas-access-token` header before processing |
| LGPD | Soft delete on financial records if they contain PII references; audit trail on `financial_transactions` |

---

## Standard Stack

### Core (all already installed — verified in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.7 | Framework | Project lock |
| `@supabase/supabase-js` | ^2.107.0 | DB client | Project lock |
| `@supabase/ssr` | ^0.10.3 | SSR auth | Only non-deprecated option |
| `react-hook-form` | ^7.77.0 | Forms | Project stack |
| `zod` | ^3.25.76 | Validation | Pinned to v3 (hookform/resolvers compat) |
| `@hookform/resolvers` | ^5.4.0 | RHF + Zod bridge | Project stack |
| `@react-pdf/renderer` | ^4.5.1 | PDF generation | Already in use (ProntuarioPDF) |
| `resend` | ^6.12.4 | Email | Already integrated |
| `@react-email/components` | ^1.0.12 | Email templates | Already in use |
| `nuqs` | ^2.8.9 | URL state | Project stack |
| `@tanstack/react-table` | ^8.21.3 | Tables | Project stack |
| `date-fns` | ^4.4.0 | Date utilities | Already installed |

[VERIFIED: package.json in repo]

### New (to be installed)

No new production packages needed — all required libraries are already installed.

### New shadcn components (CLI only, no npm install)
| Component | Command | Usage |
|-----------|---------|-------|
| Switch | `npx shadcn@latest add switch` | Régua de cobrança toggles |
| Accordion | `npx shadcn@latest add accordion` | Installment grouping in receivables table |

[VERIFIED: 03-UI-SPEC.md]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Asaas REST direct | Community Asaas SDK (npm) | SDK unmaintained, no TypeScript control, CLAUDE.md prohibits it |
| Vercel Cron | pg_cron | pg_cron is Pro-only; Vercel Cron is free and available |
| Resend | SendGrid | SendGrid killed free tier mid-2025; CLAUDE.md prohibits it |
| next.config headers for static headers | Middleware CSP | Middleware nonces force full dynamic render on all pages; static headers with `unsafe-inline` acceptable for ERP context (no third-party scripts) |

---

## Asaas REST API — Detailed Findings

[CITED: https://docs.asaas.com/docs/authentication-2]
[CITED: https://docs.asaas.com/reference/criar-nova-cobranca]
[CITED: https://docs.asaas.com/docs/cobrancas-via-pix]
[CITED: https://docs.asaas.com/docs/installment-payments]
[CITED: https://docs.asaas.com/docs/payment-events]

### Authentication
- Header: `access_token: $aact_hmlg_...` (sandbox) or `$aact_prod_...` (production)
- Sandbox base URL: `https://api-sandbox.asaas.com/v3`
- Production base URL: `https://api.asaas.com/v3`
- `User-Agent` header mandatory for new accounts created after 2024-06-13 [CITED: Asaas auth docs]
- 401 response includes actionable error message (wrong env, missing key, invalid key) since July 2025

### Customer Creation
```
POST /v3/customers
Headers: access_token: {ASAAS_API_KEY}, User-Agent: FYNXIA/1.0
Body:
{
  name: string,           // patient full_name
  cpfCnpj: string,        // patient CPF (digits only)
  email?: string,
  mobilePhone?: string,
  externalReference?: string  // patient UUID from local DB (RECOMMENDED for dedup)
}
Response: { id: "cus_xxx", name: "...", cpfCnpj: "...", ... }
```
API allows duplicate customers — must store returned `id` as `asaas_customer_id` to prevent re-creation. The `externalReference` field is the recommended dedup strategy.

**Where to store `asaas_customer_id` (Claude's Discretion D-06):** Add column `asaas_customer_id TEXT` to `public.patients`. Simple, co-located with patient identity. On charge creation, check if `asaas_customer_id` is null → create customer → save; else reuse. [ASSUMED — this is the simpler approach vs. separate billing table]

### Payment/Charge Creation
```
POST /v3/payments
Headers: access_token: {ASAAS_API_KEY}
Body:
{
  customer: "cus_xxx",         // Asaas customer ID
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD",
  value: number,               // single charge (mutually exclusive with installmentCount)
  dueDate: "YYYY-MM-DD",
  description?: string,
  // For installments:
  installmentCount: number,    // 2-21 (Visa/MC), 2-12 (others)
  totalValue: number,          // auto-divides per installment (use instead of value)
  // OR installmentValue: number  // per-parcel amount
}
Response (single):
{
  id: "pay_xxx",
  status: "PENDING",
  bankSlipUrl?: string,         // boleto PDF URL (billingType=BOLETO)
  dueDate: "YYYY-MM-DD",
  ...
}
Response (installment):
{
  id: "pay_xxx",                // FIRST parcel's charge ID
  installment: "inst_xxx",      // installment group ID
  ...
}
```

**PIX QR Code retrieval (separate call after charge creation):**
```
GET /v3/payments/{paymentId}/pixQrCode
Response:
{
  encodedImage: "base64...",    // QR code as base64 PNG
  payload: "000201...",         // copy-and-paste PIX string (copia e cola)
  expirationDate: "YYYY-MM-DD HH:mm:ss"
}
```
QR code expires 12 months after due date. Can only be paid once. [CITED: Asaas PIX docs]

**Boleto:** `bankSlipUrl` in the charge creation response is the direct PDF link to show to the user. [CITED: Asaas boleto docs]

**Installment retrieving all parcels:**
```
GET /v3/installments/{installmentId}/payments
Response: { data: [{ id: "pay_xxx", dueDate: ..., value: ..., status: ... }, ...] }
```
Use this after creation to mirror each parcel as a local receivable row. [CITED: Asaas installments docs]

### Webhook Events (Payment-related)
[CITED: https://docs.asaas.com/docs/payment-events]

| Event | When |
|-------|------|
| `PAYMENT_CREATED` | New charge generated |
| `PAYMENT_CONFIRMED` | Payment received, balance not yet available |
| `PAYMENT_RECEIVED` | Balance credited (final success state) |
| `PAYMENT_OVERDUE` | Due date passed without payment |
| `PAYMENT_UPDATED` | Due date or amount changed |
| `PAYMENT_REFUNDED` | Charge refunded |
| `PAYMENT_PARTIALLY_REFUNDED` | Partial refund |
| `PAYMENT_DELETED` | Charge removed |
| `PAYMENT_RESTORED` | Charge restored after deletion |

**PIX flow:** `PAYMENT_CREATED` → `PAYMENT_RECEIVED` (no intermediate CONFIRMED)
**Boleto on-time:** `PAYMENT_CREATED` → `PAYMENT_CONFIRMED` → `PAYMENT_RECEIVED`
**Boleto overdue:** `PAYMENT_CREATED` → `PAYMENT_OVERDUE` → `PAYMENT_CONFIRMED` → `PAYMENT_RECEIVED`

**Webhook payload structure:**
```json
{
  "id": "evt_abc123",
  "event": "PAYMENT_RECEIVED",
  "dateCreated": "2024-06-12 16:45:03",
  "payment": {
    "id": "pay_080225913252",
    "installment": "inst_xxx",    // present if part of installment plan
    "status": "RECEIVED",
    "value": 250.00,
    "dueDate": "2026-06-15",
    "customer": "cus_xxx",
    ...
  }
}
```

**Webhook authentication:**
- Header: `asaas-access-token: {WEBHOOK_AUTH_TOKEN}` (set during webhook registration via `POST /v3/webhooks`)
- `authToken` must be 32–255 chars, no whitespace, no repetitive sequences, cannot be an Asaas API key
- Store as `ASAAS_WEBHOOK_SECRET` env var

**Webhook registration:**
```
POST /v3/webhooks
Body:
{
  name: "FYNXIA Payment Webhook",
  url: "https://app.fynxia.com/api/webhooks/asaas",
  email: "ti@abvcap.com.br",
  enabled: true,
  authToken: "{ASAAS_WEBHOOK_SECRET}",
  events: ["PAYMENT_CREATED", "PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "PAYMENT_DELETED"]
}
```

**Retry semantics:** At-least-once delivery. If endpoint fails 15 consecutive times, queue pauses. Events retained 14 days. Must implement idempotency. [CITED: Asaas webhook docs]

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
├── lib/
│   └── asaas/
│       ├── client.ts         # typed fetch wrapper (ASAAS_API_KEY, ASAAS_BASE_URL)
│       ├── types.ts          # AsaasPayment, AsaasCustomer, AsaasWebhookEvent types
│       └── gateway.ts        # PaymentGateway interface + AsaasAdapter implementation
├── actions/
│   ├── charges.ts            # createCharge, getCharge, cancelCharge Server Actions
│   ├── transactions.ts       # createTransaction (manual FIN-02), listTransactions
│   ├── receivables.ts        # listReceivables, getReceivable
│   └── collection-ruler.ts  # saveCollectionRuler, getCollectionRuler
├── emails/
│   └── CollectionReminderEmail.tsx  # react-email template for overdue reminder
├── components/
│   └── financeiro/           # (all from UI-SPEC — see component inventory)
├── app/
│   ├── (dashboard)/clinica/financeiro/
│   │   ├── page.tsx                  # hub
│   │   ├── fluxo-de-caixa/page.tsx
│   │   ├── contas-a-receber/page.tsx
│   │   ├── nova-cobranca/page.tsx
│   │   └── regua-de-cobranca/page.tsx
│   └── api/
│       ├── webhooks/asaas/route.ts   # FIN-09 webhook handler
│       ├── cron/collection-ruler/route.ts  # D-09 Vercel Cron endpoint
│       └── financeiro/charges/[id]/recibo.pdf/route.ts  # FIN-08
└── supabase/migrations/
    └── 2026XXXX_financial_tables.sql
    └── 2026XXXX_financial_rls.sql
    └── 2026XXXX_financial_categories_seed.sql
```

### Pattern 1: PaymentGateway Abstraction (D-01)

```typescript
// src/lib/asaas/gateway.ts
// Source: D-01 decision + CLAUDE.md REST-direct pattern

export interface PaymentGateway {
  createCustomer(params: CreateCustomerParams): Promise<{ customerId: string }>
  createCharge(params: CreateChargeParams): Promise<ChargeResult>
  getPixQrCode(chargeId: string): Promise<{ encodedImage: string; payload: string; expirationDate: string }>
  getInstallmentCharges(installmentId: string): Promise<ChargeResult[]>
  cancelCharge(chargeId: string): Promise<void>
}

export class AsaasAdapter implements PaymentGateway {
  private baseUrl: string
  private apiKey: string
  constructor() {
    this.baseUrl = process.env.ASAAS_BASE_URL!  // 'https://api-sandbox.asaas.com/v3'
    this.apiKey = process.env.ASAAS_API_KEY!
  }
  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'access_token': this.apiKey,
        'User-Agent': 'FYNXIA/1.0',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new AsaasError(res.status, err)
    }
    return res.json() as Promise<T>
  }
  // ... implementations
}
```

### Pattern 2: Webhook Handler (D-07, FIN-09)

The key design challenge: serverless functions may terminate after the response is sent. In Vercel Fluid Compute, the function stays alive while executing, but completion is not guaranteed after `Response` is returned.

**Chosen approach (Claude's Discretion D-07):** Use a `webhook_events` dedup table. The handler:
1. Validates `asaas-access-token` header immediately → 401 if invalid
2. Parses payload
3. Upserts a `webhook_events` row with `(asaas_event_id, event_type)` unique constraint
4. If upsert returns `already exists` → return 200 immediately (idempotent dedup)
5. If new event → launch fire-and-forget Promise (does NOT await), return 200
6. Fire-and-forget Promise: process the event (update receivable status, post financial_transaction)

```typescript
// src/app/api/webhooks/asaas/route.ts
export const runtime = 'nodejs'

export async function POST(request: Request) {
  // Step 1: Auth
  const token = request.headers.get('asaas-access-token')
  if (token !== process.env.ASAAS_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Step 2: Parse
  const event = await request.json() as AsaasWebhookEvent

  // Step 3: Dedup via webhook_events table (UNIQUE on asaas_event_id)
  const admin = createAdminClient()
  const { error: upsertError, data } = await admin
    .from('webhook_events')
    .upsert({ asaas_event_id: event.id, event_type: event.event, processed: false },
             { onConflict: 'asaas_event_id', ignoreDuplicates: true })
    .select('id, processed')
    .single()

  if (upsertError && upsertError.code === '23505') {
    // Already processed
    return new Response('', { status: 200 })
  }

  // Step 4: Return 200 immediately, process asynchronously
  // Fire-and-forget is safe in Fluid Compute for short operations (< 10s)
  processWebhookEvent(event, admin).catch(err =>
    console.error('[webhook] processing error', err)
  )

  return new Response('', { status: 200 })
}
```

**`processWebhookEvent`** maps event type → local status update:
- `PAYMENT_RECEIVED` or `PAYMENT_CONFIRMED` → set receivable `status='pago'`, `paid_at=now()`, insert `financial_transactions` row (income)
- `PAYMENT_OVERDUE` → no action (vencido is derived at read time, D-04)
- `PAYMENT_REFUNDED` → set receivable `status='estornado'`, insert negative `financial_transactions` row

### Pattern 3: Vercel Cron for Collection Ruler (D-09)

```json
// vercel.json (add to existing)
{
  "regions": ["gru1"],
  "crons": [
    {
      "path": "/api/cron/collection-ruler",
      "schedule": "0 8 * * *"
    }
  ]
}
```

```typescript
// src/app/api/cron/collection-ruler/route.ts
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Query: all active collection rules per tenant
  // For each rule: find receivables matching the cadence (due today OR N days overdue)
  // For each receivable found: check collection_log for this (receivable_id + milestone)
  // If not yet logged: send Resend email, insert collection_log row
  return Response.json({ processed: count })
}
```

**FREE plan limit:** 1 cron job per project runs once per day maximum. Timing precision ±59 minutes. The daily 08:00 UTC cron covers all Brazilian timezones (05:00–11:00 BRT range). [CITED: Vercel cron pricing docs]

**CRITICAL CONSTRAINT:** Hobby plan allows only **once per day** frequency. Cron expressions that run more frequently will fail deployment. `0 8 * * *` (daily at 8 AM UTC) is valid. [VERIFIED: vercel.com/docs/cron-jobs/usage-and-pricing]

### Pattern 4: Security Headers (D-11, SEC-06)

**Approach (Claude's Discretion D-11):** Static headers via `next.config.ts` for HSTS, X-Frame-Options, X-Content-Type-Options. For CSP: add Supabase + Asaas domains and `unsafe-inline` for ERP context (avoiding nonce overhead which forces full dynamic rendering on all pages — counterproductive for an ERP with many server-rendered pages).

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV === 'development'

const cspValue = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://fonts.gstatic.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.asaas.com https://api-sandbox.asaas.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ')

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Content-Security-Policy', value: cspValue },
        ],
      },
    ]
  },
}

export default nextConfig
```

The existing `src/proxy.ts` handles auth/RBAC and does NOT need to generate CSP nonces — keeping it single-purpose. [CITED: nextjs.org/docs/app/api-reference/config/next-config-js/headers, nextjs.org/docs/app/guides/content-security-policy]

**CSP note:** Supabase Realtime uses WebSocket (`wss://`). `@react-pdf/renderer` runs server-side only (no browser script). Asaas boleto PDFs open via `bankSlipUrl` link (`target="_blank"`) — no frame embed needed. Pix QR base64 images are inline data URLs — covered by `img-src 'self' blob: data:`.

---

## Data Model

### New Tables for Phase 3

```sql
-- financial_categories: seeded dental categories per tenant (D-05)
CREATE TABLE public.financial_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('receita', 'despesa')),
  is_default  BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_financial_categories_tenant ON public.financial_categories(tenant_id);
-- RLS: all roles can SELECT; only admin can INSERT/UPDATE/DELETE

-- charges: provider-agnostic charge record (D-01)
CREATE TABLE public.charges (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id          UUID        REFERENCES public.patients(id),
  provider            TEXT        NOT NULL DEFAULT 'asaas',
  provider_charge_id  TEXT,                          -- Asaas pay_xxx
  provider_installment_id TEXT,                       -- Asaas inst_xxx (if parcelado)
  billing_type        TEXT        NOT NULL CHECK (billing_type IN ('PIX', 'BOLETO', 'CREDIT_CARD')),
  description         TEXT,
  total_value         NUMERIC(12,2) NOT NULL,
  installment_count   INT         NOT NULL DEFAULT 1,
  status              TEXT        NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente', 'pago', 'cancelado', 'estornado')),
  created_by          UUID        REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_charges_tenant ON public.charges(tenant_id);
CREATE INDEX idx_charges_patient ON public.charges(patient_id);
CREATE INDEX idx_charges_provider_charge_id ON public.charges(provider_charge_id);

-- receivables: one row per parcel (FIN-03, FIN-06, D-03)
-- vencido is NEVER stored — derived at read time (D-04)
CREATE TABLE public.receivables (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  charge_id           UUID        NOT NULL REFERENCES public.charges(id) ON DELETE CASCADE,
  patient_id          UUID        REFERENCES public.patients(id),
  provider_charge_id  TEXT,          -- Asaas pay_xxx for THIS parcel
  installment_number  INT         NOT NULL DEFAULT 1,
  value               NUMERIC(12,2) NOT NULL,
  due_date            DATE        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente', 'pago', 'estornado')),
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_receivables_tenant ON public.receivables(tenant_id);
CREATE INDEX idx_receivables_charge ON public.receivables(charge_id);
CREATE INDEX idx_receivables_due_date ON public.receivables(tenant_id, due_date);
CREATE INDEX idx_receivables_provider_charge_id ON public.receivables(provider_charge_id);

-- financial_transactions: cash flow entries (D-08, FIN-01, FIN-02)
-- Audit trigger attached (SEC-03 already cites this table)
CREATE TABLE public.financial_transactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  category_id     UUID        REFERENCES public.financial_categories(id),
  receivable_id   UUID        REFERENCES public.receivables(id),   -- set for auto-posted income
  type            TEXT        NOT NULL CHECK (type IN ('receita', 'despesa')),
  amount          NUMERIC(12,2) NOT NULL,
  description     TEXT,
  transaction_date DATE        NOT NULL,
  posted_by       UUID        REFERENCES public.users(id),   -- null for auto-posted (webhook)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_financial_transactions_tenant ON public.financial_transactions(tenant_id);
CREATE INDEX idx_financial_transactions_date ON public.financial_transactions(tenant_id, transaction_date);
-- Audit trigger: CREATE TRIGGER audit_financial_transactions AFTER INSERT OR UPDATE OR DELETE
--   ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

-- webhook_events: idempotency dedup table (FIN-09, D-07)
CREATE TABLE public.webhook_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_event_id  TEXT        NOT NULL UNIQUE,
  event_type      TEXT        NOT NULL,
  processed       BOOLEAN     NOT NULL DEFAULT false,
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- No tenant_id — webhook handler uses service role; events are global

-- collection_rules: per-tenant collection ruler config (FIN-07, D-10)
CREATE TABLE public.collection_rules (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  due_date_reminder_enabled   BOOLEAN     NOT NULL DEFAULT false,
  overdue_reminder_enabled    BOOLEAN     NOT NULL DEFAULT false,
  overdue_interval_days       INT         NOT NULL DEFAULT 7,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_collection_rules_tenant ON public.collection_rules(tenant_id);

-- collection_log: idempotency for sent reminders (FIN-07, D-10)
CREATE TABLE public.collection_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  receivable_id   UUID        NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
  milestone       TEXT        NOT NULL,   -- 'due_date' | 'overdue_7' | 'overdue_14' etc.
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel         TEXT        NOT NULL DEFAULT 'email',
  UNIQUE (receivable_id, milestone, channel)
);
CREATE INDEX idx_collection_log_tenant ON public.collection_log(tenant_id);
```

### patients table amendment
```sql
-- Add asaas_customer_id column to existing patients table
ALTER TABLE public.patients
  ADD COLUMN asaas_customer_id TEXT;
CREATE INDEX idx_patients_asaas_customer ON public.patients(asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;
```

### Financial categories seed (D-05)
```sql
-- Inserted at clinic creation (triggered from the clinics INSERT or via a helper function)
-- Standard dental odontological categories:
-- Receita: 'Consulta', 'Tratamento Odontológico', 'Convênio', 'Outros'
-- Despesa: 'Aluguel', 'Materiais Odontológicos', 'Salários', 'Laboratório', 'Impostos', 'Outros'
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment processing | Custom PIX/boleto logic | Asaas REST API | PCI compliance, key management, settlement |
| Email delivery | SMTP server | Resend (already integrated) | Deliverability, bounce handling, react-email |
| PDF generation | Browser print / html2pdf | `@react-pdf/renderer` (already installed) | Server-side, no Chromium binary |
| Cron scheduling | Custom polling loop | Vercel Cron + `vercel.json` | Native, no infrastructure |
| URL-persisted filter state | `useState` | `nuqs` (already installed) | Browser history, bookmarks, SSR compat |
| Table state | Custom sort/filter | TanStack Table v8 (already installed) | Headless, type-safe |
| Idempotency key generation | UUID v4 | Asaas event `id` field | Event IDs are globally unique per Asaas |
| RLS enforcement | Application-layer tenant filter | PostgreSQL RLS via `get_my_tenant_id()` | DB-layer enforcement, established pattern |

---

## Common Pitfalls

### Pitfall 1: Asaas env mismatch (sandbox key on prod URL)
**What goes wrong:** API returns 401 with "Chave de API inválida para este ambiente".
**Why it happens:** `$aact_hmlg_` keys only work on `api-sandbox.asaas.com`; `$aact_prod_` keys only on `api.asaas.com`.
**How to avoid:** `ASAAS_BASE_URL` drives the environment. Set `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3` in `.env.local` and sandbox Vercel preview vars. Never hardcode the URL.
**Warning signs:** `401` response with `errors[0].description` mentioning "ambiente".

### Pitfall 2: Webhook returns 200 but event is NOT idempotent
**What goes wrong:** Asaas retries → double-credits income (`financial_transactions` duplicated).
**Why it happens:** At-least-once delivery. Network blip after processing but before 200 → Asaas resends.
**How to avoid:** UNIQUE constraint on `webhook_events.asaas_event_id`. Upsert on conflict → skip processing.
**Warning signs:** `financial_transactions` rows with duplicate `receivable_id` + `type='receita'`.

### Pitfall 3: PIX QR code not retrieved after charge creation
**What goes wrong:** Charge creates fine but no QR code to show to user.
**Why it happens:** PIX QR data is NOT in the charge creation response — requires a second GET call.
**How to avoid:** After `POST /v3/payments` returns `pay_xxx`, immediately call `GET /v3/payments/pay_xxx/pixQrCode` and include `encodedImage` + `payload` in the Server Action response.
**Warning signs:** UI shows "Cobrança emitida" but no QR code appears.

### Pitfall 4: Asaas installment — only first parcel returned in creation response
**What goes wrong:** After creating a 3-parcel installment, only 1 receivable row is created locally.
**Why it happens:** `POST /v3/payments` with `installmentCount=3` returns only the first parcel's `id` and the `installment` group ID.
**How to avoid:** After creation, immediately call `GET /v3/installments/{installmentId}/payments` to retrieve all parcel charge IDs and create all local receivable rows.
**Warning signs:** Receivables table shows only 1 row when 3 parcels expected.

### Pitfall 5: Vercel Cron on FREE plan running more than once per day
**What goes wrong:** Deployment fails with "Hobby accounts are limited to daily cron jobs."
**Why it happens:** Any expression that would run more than once per day fails deploy on Hobby.
**How to avoid:** Use `0 8 * * *` (exactly once daily). Do NOT use `0 */4 * * *` or similar.
**Warning signs:** Vercel deploy error message mentioning cron frequency limit.

### Pitfall 6: CRON_SECRET not set in Vercel environment variables
**What goes wrong:** Collection ruler endpoint returns 401 or is open to public.
**Why it happens:** `CRON_SECRET` must be set in Vercel Environment Variables (not in code); Vercel injects it as `Authorization: Bearer {value}` when invoking cron.
**How to avoid:** Add `CRON_SECRET` to Vercel project env vars. Validate `Authorization` header in the route handler.
**Warning signs:** Cron endpoint returns 401 on Vercel (env var missing) or is accessible without auth locally (localhost doesn't inject CRON_SECRET).

### Pitfall 7: `@react-pdf/renderer` on Edge runtime
**What goes wrong:** PDF route crashes with "Module not found: Can't resolve 'fs'" or similar.
**Why it happens:** `@react-pdf/renderer` requires Node.js. Edge runtime has no `fs`/`Buffer`.
**How to avoid:** Always `export const runtime = 'nodejs'` in the recibo PDF route.
**Warning signs:** Runtime error on `/api/financeiro/charges/[id]/recibo.pdf`.

### Pitfall 8: Missing `asaas_customer_id` → duplicate Asaas customers
**What goes wrong:** Every charge for the same patient creates a new Asaas customer.
**Why it happens:** Asaas API allows duplicate customers by design; no automatic dedup.
**How to avoid:** Before creating a charge, check `patients.asaas_customer_id`. If null → call `POST /v3/customers` → save returned `id` back to `patients.asaas_customer_id`. Then use that ID for the charge.
**Warning signs:** Multiple Asaas customers with same CPF in the Asaas dashboard.

### Pitfall 9: CSP blocking Supabase WebSocket or Asaas connects
**What goes wrong:** Realtime subscriptions fail silently; API calls blocked in browser.
**Why it happens:** CSP `connect-src` must include `wss://*.supabase.co` and `https://api{-sandbox}.asaas.com`.
**How to avoid:** Include both domains in `connect-src` in the CSP header (see code example above).
**Warning signs:** Browser console `Content Security Policy` violation errors.

### Pitfall 10: Financial transactions not scoped to tenant in cash flow query
**What goes wrong:** Clinic A sees Clinic B's income/expense.
**Why it happens:** Missing `tenant_id` filter or missing RLS `WITH CHECK`.
**How to avoid:** All financial queries use `createClient()` (RLS applies); RLS policy includes `WITH CHECK` on `tenant_id = get_my_tenant_id()`.
**Warning signs:** Totals don't match expected amounts (cross-tenant pollution).

---

## Code Examples

### Asaas Client Typed Wrapper
```typescript
// src/lib/asaas/client.ts
// Source: Asaas docs + CLAUDE.md REST-direct pattern
import 'server-only'

class AsaasError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`Asaas API error ${status}`)
  }
}

export async function asaasFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const baseUrl = process.env.ASAAS_BASE_URL  // set per env
  const apiKey = process.env.ASAAS_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error('ASAAS_BASE_URL and ASAAS_API_KEY must be set')
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'access_token': apiKey,
      'User-Agent': 'FYNXIA/1.0',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new AsaasError(res.status, err)
  }

  return res.json() as Promise<T>
}
```

### Server Action — createCharge (simplified)
```typescript
// src/actions/charges.ts
'use server'
// Source: getActor pattern from appointments.ts + Asaas REST

export async function createCharge(input: ChargeInput) {
  // 1. Validate with Zod
  // 2. getActor() → tenant scope + role gate (admin/receptionist/dentist)
  // 3. Get or create Asaas customer (check patients.asaas_customer_id)
  // 4. Call asaasFetch POST /v3/payments with billingType, value/totalValue, dueDate
  // 5. If installmentCount > 1: call GET /v3/installments/{inst_id}/payments → create all receivables
  // 6. Else: create 1 receivable row
  // 7. If PIX: call GET /v3/payments/{id}/pixQrCode → return to UI
  // 8. logBusinessEvent('charge.created', ...)
  // 9. Return charge data + QR / boleto URL
}
```

### CollectionReminderEmail (react-email template)
```typescript
// src/emails/CollectionReminderEmail.tsx
// Reuse InviteEmail.tsx pattern (Html/Head/Body/Container/Heading/Text/Button)
// Props: patientName, clinicName, chargeDescription, amount, dueDate, overdueDate?
// CTA: "Ver detalhes da cobrança" (link to boleto/pix — if still available)
```

### vencido derivation in ReceivablesTable
```typescript
// src/components/financeiro/ReceivablesTable.tsx
// Source: D-04 + 03-UI-SPEC.md
import { isPast, parseISO } from 'date-fns'

function deriveStatus(status: string, dueDate: string) {
  if (status === 'pago') return 'pago'
  if (isPast(parseISO(dueDate))) return 'vencido'
  return 'pendente'
}
```

---

## Runtime State Inventory

> Not a rename/refactor phase. Omitted per format guidance.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js runtime | ✓ | Node 20+ (Vercel) | — |
| `supabase` CLI | DB migrations (db push) | ✓ | ^2.105.0 (devDep) | — |
| Asaas sandbox account | FIN-04, FIN-05, FIN-09 testing | ✗ | — | Design against API; live test is D-02 blocking checkpoint |
| `ASAAS_API_KEY` env var | Any Asaas call | ✗ | — | Code compiles; fails at runtime gracefully |
| `ASAAS_BASE_URL` env var | Any Asaas call | ✗ | — | Same |
| `ASAAS_WEBHOOK_SECRET` env var | Webhook auth | ✗ | — | Same |
| `CRON_SECRET` env var | Vercel Cron auth | ✗ | — | Cron endpoint rejects without it |
| Resend API key | Collection emails | ✓ (Phase 1 live) | — | Already working |
| `npx shadcn@latest add switch accordion` | UI components | ✓ (CLI available) | — | — |

**Missing dependencies with no fallback:**
- Asaas sandbox account: must be created by the operator before testing FIN-04/FIN-05/FIN-09. This is a documented D-02 blocking checkpoint.

**Missing dependencies with fallback (degrade gracefully):**
- All Asaas env vars: runtime errors are caught and returned as `{ success: false, error: '...' }` by Server Actions. The rest of the app (cash flow manual entries, collection ruler config) works without Asaas credentials.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.8 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test` (alias: `vitest run`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIN-01 | financial_transactions table present with required columns | unit (SQL assertion) | `npm test` | ❌ Wave 0 |
| FIN-02 | manual transaction Server Action creates row + audit log | unit (mock Supabase) | `npm test` | ❌ Wave 0 |
| FIN-03 | receivables table present + vencido derived at read-time | unit (SQL assertion + component logic) | `npm test` | ❌ Wave 0 |
| FIN-04 | PIX charge creation calls Asaas + returns QR code fields | unit (mock asaasFetch) | `npm test` | ❌ Wave 0 |
| FIN-05 | Boleto charge creation returns bankSlipUrl | unit (mock asaasFetch) | `npm test` | ❌ Wave 0 |
| FIN-06 | installment charge creates N receivable rows locally | unit (mock) | `npm test` | ❌ Wave 0 |
| FIN-07 | collection ruler: idempotent per (receivable_id + milestone) | unit (SQL assertion + logic) | `npm test` | ❌ Wave 0 |
| FIN-08 | ReceiboPDF renders without throwing (Flexbox, runtime=nodejs) | unit (@react-pdf renderToBuffer) | `npm test` | ❌ Wave 0 |
| FIN-09 | webhook: 200 on valid token, 401 on invalid, dedup on duplicate event_id | unit (Request mock) | `npm test` | ❌ Wave 0 |
| SEC-06 | next.config.ts headers() returns CSP, HSTS, X-Frame, X-Content-Type | unit (import and check) | `npm test` | ❌ Wave 0 |

**Test patterns to follow (from existing tests):**

- **SQL migration assertions:** `src/__tests__/migrations/clinical.test.ts` pattern — `readFileSync` migration file + `expect(sql).toMatch(...)`. Use for financial migration DDL.
- **Action unit tests:** `src/__tests__/actions/patients.test.ts` pattern — mock Supabase client + validate action return shape.
- **Webhook test:** mock `Request` with `asaas-access-token` header; test 401 path (invalid token) + 200 path (valid token) + idempotency (duplicate event_id insert returns 200 without double-processing).
- **PDF test:** `renderToBuffer(createElement(ReceiboPDF, mockProps))` — assert buffer length > 0 and no thrown error.
- **CSP test:** `import nextConfig from '@/../../next.config'`; call `nextConfig.headers()` and assert each required header key+value.

### Sampling Rate
- **Per task commit:** `npm test` (full Vitest suite — fast, node env)
- **Per wave merge:** `npm test && npx tsc --noEmit`
- **Phase gate:** Full suite green + `tsc --noEmit` 0 before closing phase

### Wave 0 Gaps (all tests are new)
- [ ] `src/__tests__/migrations/financial.test.ts` — SQL assertions for all financial migration files (FIN-01..07)
- [ ] `src/__tests__/actions/charges.test.ts` — createCharge action unit test (FIN-04, FIN-05, FIN-06)
- [ ] `src/__tests__/actions/transactions.test.ts` — createTransaction action unit test (FIN-02)
- [ ] `src/__tests__/webhooks/asaas.test.ts` — webhook handler unit test (FIN-09)
- [ ] `src/__tests__/components/recibo-pdf.test.ts` — ReceiboPDF render test (FIN-08)
- [ ] `src/__tests__/config/security-headers.test.ts` — SEC-06 header assertions

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (webhook auth) | `asaas-access-token` header validation; CRON_SECRET for cron |
| V3 Session Management | no (financial API routes use Supabase session via `createClient()`) | existing `@supabase/ssr` |
| V4 Access Control | yes | RLS + `get_my_tenant_id()`; admin-only for collection ruler page + PDF |
| V5 Input Validation | yes | Zod schemas on all Server Action inputs; Asaas amount as `number`, not string |
| V6 Cryptography | no (no new secrets stored; Asaas API key in env only) | env var management |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged webhook (fake Asaas event) | Spoofing | Validate `asaas-access-token` header before any processing |
| Duplicate webhook (at-least-once delivery) | Tampering | Unique `webhook_events.asaas_event_id` + upsert dedup |
| Cross-tenant charge data leak | Info Disclosure | RLS `USING (tenant_id = get_my_tenant_id())` on all financial tables |
| Service role key exposed as NEXT_PUBLIC_ | Info Disclosure | `createAdminClient()` is server-only; `import 'server-only'` guard |
| Cron endpoint called by external attacker | Elevation of Privilege | `CRON_SECRET` bearer token validation; 401 on mismatch |
| PDF with PHI accessed by wrong role | Info Disclosure | `getActor()` gate: only admin/dentist; receptionist → 403 |
| Stored CPF in financial context | Info Disclosure | CPF appears in PDF (privileged operation, gated); not in financial table rows themselves |
| LGPD: financial records referencing deleted patients | Compliance | `charges.patient_id` FK has no CASCADE DELETE; anonymize by nulling `patient_id` on LGPD erasure (same pattern as clinical records) |
| XSS via Asaas error messages surfaced to UI | XSS | Surface only Asaas `description` field (string); never `eval` or `innerHTML` |
| Clickjacking (financial actions in iframe) | Tampering | `X-Frame-Options: DENY` + `frame-ancestors 'none'` in CSP |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` (Next.js file convention) | `proxy.ts` (Next.js 16 new name) | Next.js 16 | Already implemented correctly in this project |
| SendGrid | Resend | mid-2025 | Already using Resend |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Already using correct package |
| CSP via middleware nonces | CSP via next.config.ts headers with `unsafe-inline` (acceptable for internal ERP) | — | Simpler, avoids forced dynamic render penalty |
| Vercel `middleware.ts` CSP nonce | `proxy.ts` + static `next.config.ts` headers | Next.js 16 proxy rename | Existing proxy is auth-only; add security headers separately in next.config.ts |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `asaas_customer_id` stored directly on `patients` table (vs separate billing table) | Data Model | Low — alternative is a separate `patient_billing_profiles` table; either works, just migration scope changes |
| A2 | Fire-and-forget Promise in webhook handler is sufficient for Fluid Compute (< 10s processing) | Pattern 2 | Medium — if Vercel terminates function before async finishes, event remains in `webhook_events` as unprocessed; a reconciliation cron could catch missed events |
| A3 | `unsafe-inline` CSP is acceptable for the internal ERP context (no third-party scripts) | Pattern 4 | Low — security auditors may flag `unsafe-inline`; nonce-based alternative is feasible but forces dynamic rendering on all pages |
| A4 | Daily cron at 08:00 UTC covers all Brazilian timezones (BRT = UTC-3, BRST = UTC-2) | Pattern 3 | Low — 08:00 UTC = 05:00 BRT (pre-business-hours); acceptable for reminder delivery |
| A5 | Boleto `bankSlipUrl` is returned directly in the `POST /v3/payments` response | Asaas REST | Low — confirmed in Asaas docs search results; edge case: URL may require an additional GET if not immediately available |

---

## Open Questions (RESOLVED)

1. **Asaas webhook HTTPS URL during development**
   - What we know: Asaas webhooks require a public HTTPS URL; localhost is not reachable.
   - What's unclear: The plan must address how to test webhook delivery locally (ngrok, Vercel preview URL, or skip and test via Asaas dashboard replay).
   - Recommendation: Use `ngrok http 3000` for local webhook testing; document as a one-time developer setup step in the plan.

2. **Collection ruler: which tenant's recipients to email per cron invocation**
   - What we know: Cron runs globally, not per-tenant. All tenants' overdue receivables must be processed.
   - What's unclear: If a clinic has its collection rule disabled, the cron should skip it.
   - Recommendation: Query `collection_rules WHERE due_date_reminder_enabled OR overdue_reminder_enabled` and process per-tenant in sequence.

3. **Credit card tokenization scope**
   - What we know: CLAUDE.md says "Asaas/Stripe tokenization only; no raw card numbers."
   - What's unclear: The UI-SPEC shows `billingType: "Cartão"` in the ChargeForm but does not define the card tokenization UX (Asaas.js or redirect?).
   - Recommendation: Treat credit card as `billingType=CREDIT_CARD` in the charge form, but defer the actual tokenization implementation to a follow-up task within Phase 3. The MVP can emit PIX/boleto fully; cartão requires Asaas.js embed (not in current stack) or redirect to Asaas checkout page. Plan should include this as a gated task.

4. **Asaas webhook registration: manual vs automated**
   - What we know: Webhook endpoint URL must be registered in the Asaas account (POST /v3/webhooks or Asaas dashboard UI).
   - What's unclear: Whether registration is a one-time manual step (Asaas dashboard) or an automated setup script.
   - Recommendation: Treat as a one-time manual setup in the Asaas sandbox dashboard (not code); document as user_setup step in the plan.

---

## Sources

### Primary (HIGH confidence)
- [CITED: Asaas authentication docs — access_token header, sandbox/production URLs, User-Agent requirement](https://docs.asaas.com/docs/authentication-2)
- [CITED: Asaas charge creation — billingType, value, installmentCount, totalValue, dueDate](https://docs.asaas.com/reference/criar-nova-cobranca)
- [CITED: Asaas PIX QR code — GET /v3/payments/{id}/pixQrCode, encodedImage, payload, expirationDate](https://docs.asaas.com/docs/cobrancas-via-pix)
- [CITED: Asaas installments — installmentId vs chargeId, GET /v3/installments/{id}/payments](https://docs.asaas.com/docs/installment-payments)
- [CITED: Asaas webhook events — PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, payload structure](https://docs.asaas.com/docs/payment-events)
- [CITED: Asaas webhook about — at-least-once delivery, 15 retry limit, 14 day retention, asaas-access-token header](https://docs.asaas.com/docs/about-webhooks)
- [CITED: Asaas webhook creation via API — POST /v3/webhooks, authToken requirements](https://docs.asaas.com/docs/criar-novo-webhook-pela-api)
- [CITED: Asaas customer creation — POST /v3/customers, name, cpfCnpj, externalReference, duplicate prevention](https://docs.asaas.com/reference/criar-novo-cliente)
- [CITED: Vercel Cron Jobs — vercel.json syntax, cron expressions, CRON_SECRET, Hobby 1/day limit, ±59min precision](https://vercel.com/docs/cron-jobs)
- [CITED: Vercel Cron usage and pricing — Hobby: 100 jobs, once per day, hourly precision](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [CITED: Next.js headers() config — source pattern, key/value headers API](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers)
- [CITED: Next.js CSP guide — nonce approach, without-nonce approach, proxy.ts integration](https://nextjs.org/docs/app/guides/content-security-policy)
- [VERIFIED: package.json] — all production dependencies confirmed present
- [VERIFIED: src/proxy.ts] — existing auth middleware, CSP headers not yet applied
- [VERIFIED: src/lib/resend.ts] — Resend client already integrated
- [VERIFIED: src/emails/InviteEmail.tsx] — react-email pattern to reuse for CollectionReminderEmail
- [VERIFIED: src/components/pdf/ProntuarioPDF.tsx] — pdf pattern to reuse for ReceiboPDF
- [VERIFIED: src/app/api/patients/[id]/prontuario.pdf/route.ts] — PDF route pattern with nodejs runtime
- [VERIFIED: src/lib/audit.ts] — logBusinessEvent already works
- [VERIFIED: src/lib/supabase/admin.ts] — createAdminClient pattern for webhook handler
- [VERIFIED: vercel.json] — only regions:gru1 today; crons key missing (to be added)
- [VERIFIED: next.config.ts] — empty; no headers() yet (to be added for SEC-06)
- [VERIFIED: supabase/migrations/] — migration naming convention confirmed (YYYYMMDD + sequential suffix)
- [VERIFIED: vitest.config.ts] — test runner, include glob, node environment

### Secondary (MEDIUM confidence)
- [WebSearch + Asaas docs] Asaas installment: PAYMENT_CREATED webhook per parcel, each has separate charge ID and installment field
- [WebSearch] Vercel Cron CRON_SECRET pattern: Authorization Bearer header auto-injected by Vercel

---

## Metadata

**Confidence breakdown:**
- Asaas REST API (auth, charge, PIX QR, installments, webhooks): HIGH — multiple official doc pages verified
- Vercel Cron (syntax, FREE plan limits, CRON_SECRET): HIGH — verified from official Vercel docs
- Next.js security headers (next.config.ts, CSP guide): HIGH — verified from official Next.js 16 docs
- Data model design: HIGH — follows established Phase 2 pattern exactly
- PDF/email reuse: HIGH — source files read and confirmed
- Async webhook processing (fire-and-forget): MEDIUM — Fluid Compute behavior confirmed but long-term correctness depends on processing time < function lifetime

**Research date:** 2026-06-06
**Valid until:** 2026-08-01 (Asaas API v3 stable; Vercel Cron pricing confirmed stable; Next.js 16 headers API stable)
