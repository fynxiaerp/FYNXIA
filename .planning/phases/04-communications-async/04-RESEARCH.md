# Phase 4: Communications & Async — Research

**Researched:** 2026-06-06
**Domain:** WhatsApp Cloud API (Meta) + outbox message queue + Vercel Cron + Resend/React Email
**Confidence:** HIGH (core patterns verified against official docs and existing codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Infra assíncrona (COMMS-04)**
Abstração `MessageQueue` + tabela `message_outbox` (status pending/sent/failed + attempts) + worker em Vercel Cron (FREE, $0). Migração futura para pg_cron/pgmq (Supabase Pro) = trocar a implementação atrás da interface. Vercel Hobby = no máximo 1 execução/dia por cron. Lembretes são batch diário. Worker: processa linhas `pending`, marca `sent`/`failed`, retenta `failed` até N tentativas. Nenhuma falha de job derruba o app (try/catch por linha).

**D-02 — WhatsApp Meta (COMMS-01)**
Meta WhatsApp Cloud API + templates agora (env vars `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`), unit-testado, verificação live adiada como UAT. Conta Meta Business ainda NÃO iniciada. Cloud API oficial apenas — NUNCA Evolution API/Baileys.

**D-03 — Templates WhatsApp (COMMS-03)**
2 templates, categoria `utility`:
1. Lembrete de consulta (24h antes) com botões quick-reply "Confirmar" / "Cancelar" — resposta/ação é Fase 5.
2. Cobrança — com link de pagamento Asaas.

**D-04 — Lembretes: agendamento e dedup (COMMS-01, COMMS-02)**
Cron diário às ~08:00 BRT (`0 11 * * *` UTC) varre consultas do dia seguinte (status não-cancelado) e enfileira lembrete em ambos os canais (WhatsApp + e-mail). Dedup via tabela de log chaveada por `(appointment_id, channel, type)`. E-mail via Resend + React Email.

**D-05 — Canal WhatsApp da régua de cobrança (SC-3)**
A régua de cobrança (Fase 3, hoje só e-mail) passa a enfileirar também no canal WhatsApp via o mesmo outbox. O `collection_log` existente continua garantindo idempotência por (receivable_id + milestone).

### Claude's Discretion
- Estrutura exata da tabela `message_outbox` (colunas, status enum, payload JSONB) e do log de dedup de lembretes.
- Se o mesmo endpoint de Vercel Cron faz scan+enqueue+drain numa invocação, ou se há cron separado (respeitando limite de 1/dia por cron do Hobby).
- Conteúdo/cópia exata dos templates (utility locked); React Email template do lembrete por e-mail.
- Retry policy (nº de tentativas, backoff) no worker.

### Deferred Ideas (OUT OF SCOPE)
- pg_cron + pgmq nativo (upgrade para Supabase Pro).
- Captura/ação na resposta dos botões WhatsApp (Fase 5 / AI-02).
- Agendamento mais fino que diário (Vercel Pro).
- Templates além de lembrete+cobrança.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMMS-01 | Sistema envia confirmação de consulta via WhatsApp (Meta Cloud API) 24h antes | Meta Cloud API endpoint, template body, dedup via message_outbox idempotency_key |
| COMMS-02 | Sistema envia lembrete de consulta via e-mail (Resend) 24h antes | getResend() + React Email pattern established in Phase 3; AppointmentReminderEmail template |
| COMMS-03 | Templates WhatsApp separados por categoria utility vs marketing para evitar reclassificação Meta | Template categorization rules, utility examples from Meta docs, registration flow |
| COMMS-04 | Sistema usa fila assíncrona para jobs de envio de mensagens (implementação outbox por ora, interface pronta para pgmq) | message_outbox schema, MessageQueue interface, worker drain pattern |
</phase_requirements>

---

## Summary

Phase 4 builds asynchronous communications by (1) adding a Meta WhatsApp Cloud API client, (2) a `message_outbox` table + `MessageQueue` interface drained by a Vercel Cron worker, (3) a daily appointment-reminder scan cron at `0 11 * * *` UTC (08:00 BRT), and (4) plugging the WhatsApp channel into the collection ruler from Phase 3.

All patterns have direct precedent in the codebase. The WhatsApp client is a fetch wrapper (no SDK — same philosophy as Asaas). The outbox mirrors the `collection_log` idempotency pattern. The cron mirrors `src/app/api/cron/collection-ruler/route.ts`. The React Email template mirrors `CollectionReminderEmail.tsx`. The dedup key `(appointment_id, channel, type)` is the analog of `(receivable_id, milestone, channel)`.

The Meta account/verification is not started (7-14 day lead time) — the integration is built unit-tested now and live verification is UAT-deferred, exactly as Asaas was in Phase 3.

**Primary recommendation:** Build `src/lib/whatsapp/client.ts` (fetch wrapper), `message_outbox` migration, `MessageQueue` interface + `OutboxQueue` implementation, cron endpoint `src/app/api/cron/reminder-dispatch/route.ts`, and plug D-05 WhatsApp sends into `src/app/api/cron/collection-ruler/route.ts` via the outbox.

---

## Project Constraints (from CLAUDE.md)

| Directive | Implication for Phase 4 |
|-----------|------------------------|
| Meta WhatsApp Cloud API ONLY — NEVER Evolution API/Baileys | WhatsApp client is a typed fetch wrapper against `graph.facebook.com`. Any eval-time import of unofficial SDKs is prohibited. |
| Runtime Node.js for API routes touching DB or Resend | `export const runtime = 'nodejs'` on all cron/send routes |
| RLS: every tenant-scoped table needs `tenant_id` indexed + USING + WITH CHECK | `message_outbox` needs `tenant_id` with RLS policy; cron uses `createAdminClient()` |
| `getResend()` lazy singleton (not `new Resend()` at module eval) | Existing pattern in `src/lib/resend.ts` — import and use as-is |
| CRON_SECRET Bearer validation on all cron endpoints | `Authorization: Bearer ${CRON_SECRET}` check before any DB query |
| Supabase migrations via `supabase/migrations/` + `db push` — never dashboard | New migration file for `message_outbox` |
| No `z.default()` with RHF `zodResolver` | Use `defaultValues` in `useForm` for any outbox config UI |
| `@base-ui/react` render-prop pattern (no `asChild`) | If a UI component is needed, use `render={<Link/>}` pattern |
| Utility templates only (never marketing) — COMMS-03 | Template `category: "UTILITY"` in Meta registration; use appointment/billing keywords |
| `createAdminClient()` for cron workers (cross-tenant, no user session) | Pattern already used in Phase 3 cron |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Meta WhatsApp Cloud API | Graph v21.0 | Send WhatsApp template messages | Official Meta API; no SDK needed (same philosophy as Asaas) |
| `resend` | ^6.12.4 (already installed) | Send appointment reminder emails | Already in project; `getResend()` factory ready |
| `@react-email/components` | ^1.0.12 (already installed) | React Email templates | Already used for CollectionReminderEmail, InviteEmail |
| `date-fns` | ^4.4.0 (already installed) | Date arithmetic for scan window | Already used in ruler.ts |
| `date-fns-tz` | ^3.2.0 (already installed) | BRT timezone conversions | Already in project |
| Supabase PostgreSQL | existing project | `message_outbox` table | Consistent with Phase 2/3 migrations |

### No new packages needed

Phase 4 requires zero new npm dependencies. All client code (WhatsApp) is a plain `fetch()` wrapper. All email, date, and DB primitives are already installed.

**Verification:** `npm view resend version` → 4.5.0 available but project pins `^6.12.4` which is already a higher version. [VERIFIED: package.json in codebase]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fetch wrapper for WhatsApp | `@whatsapp/api-js` SDK | SDK has thin docs, adds dependency; 15-20 endpoints max — direct fetch gives full control as with Asaas |
| Outbox table in PostgreSQL | Upstash QStash / Bull | Both require external services ($); outbox is free, stays in existing DB, has RLS support |
| Vitest source-inspection tests | Integration tests with live Meta API | Live API requires verified account; source inspection tests are sufficient for UAT-deferred strategy |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── whatsapp/
│   │   └── client.ts          # Typed fetch wrapper: sendTemplateMessage()
│   ├── messaging/
│   │   ├── queue.ts           # MessageQueue interface + OutboxQueue implementation
│   │   └── types.ts           # Channel enum, OutboxRow type
│   └── collection/
│       └── ruler.ts           # EXISTING — plug WhatsApp channel here (D-05)
├── emails/
│   └── AppointmentReminderEmail.tsx   # New React Email template (COMMS-02)
├── app/api/cron/
│   ├── collection-ruler/route.ts      # EXISTING — add WhatsApp enqueue (D-05)
│   └── reminder-dispatch/route.ts     # NEW — scan appointments + drain outbox
└── __tests__/
    ├── migrations/
    │   └── comms.test.ts          # static SQL: message_outbox + message_log + RLS
    └── comms/
        ├── whatsapp.test.ts       # WhatsApp client source-inspection (mocked fetch)
        ├── outbox.test.ts         # queue + worker drain, dedup, retry, kind-switch
        ├── reminders.test.ts      # reminder-scan + cron auth source-inspection
        └── email.test.ts          # AppointmentReminderEmail render
```

### Pattern 1: WhatsApp Client (typed fetch wrapper, no SDK)

**What:** A `server-only` module that wraps `fetch()` against `graph.facebook.com/v21.0/{phoneNumberId}/messages`. Mirrors the Asaas `asaasFetch` pattern.

**When to use:** Any code path that needs to send a WhatsApp template message.

**Example:**
```typescript
// src/lib/whatsapp/client.ts
import 'server-only'

export interface WhatsAppTemplateParams {
  to: string                    // E.164 format: +5511999999999
  templateName: string          // approved template name
  languageCode: string          // 'pt_BR'
  components?: WhatsAppComponent[]
}

export interface WhatsAppComponent {
  type: 'body' | 'button'
  sub_type?: 'quick_reply'
  index?: number
  parameters: WhatsAppParameter[]
}

export type WhatsAppParameter =
  | { type: 'text'; text: string }
  | { type: 'payload'; payload: string }

export interface WhatsAppSendResult {
  success: boolean
  messageId?: string
  error?: string
  errorCode?: number
}

export async function sendTemplateMessage(
  params: WhatsAppTemplateParams
): Promise<WhatsAppSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'WhatsApp credentials not configured' }
  }

  const body = {
    messaging_product: 'whatsapp',
    to: params.to,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.languageCode },
      components: params.components ?? [],
    },
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    const errCode = errBody?.error?.code
    return {
      success: false,
      error: errBody?.error?.message ?? `HTTP ${res.status}`,
      errorCode: errCode,
    }
  }

  const data = await res.json()
  return { success: true, messageId: data.messages?.[0]?.id }
}
```

[CITED: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/]

### Pattern 2: message_outbox Schema + RLS

**What:** Persistent queue table. Worker polls `pending` rows, marks `sent`/`failed`. `idempotency_key UNIQUE` prevents double-enqueue.

**Migration pattern (mirrors Phase 3 financial tables):**
```sql
-- supabase/migrations/20260607000100_message_outbox.sql

CREATE TYPE public.message_channel AS ENUM ('whatsapp', 'email');
CREATE TYPE public.message_status AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE public.message_outbox (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  channel           message_channel NOT NULL,
  status            message_status  NOT NULL DEFAULT 'pending',
  attempts          INT           NOT NULL DEFAULT 0,
  max_attempts      INT           NOT NULL DEFAULT 3,
  payload           JSONB         NOT NULL,          -- channel-specific send params
  idempotency_key   TEXT          NOT NULL,          -- UNIQUE guard
  scheduled_for     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  last_attempted_at TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT message_outbox_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE INDEX idx_message_outbox_tenant       ON public.message_outbox(tenant_id);
CREATE INDEX idx_message_outbox_status       ON public.message_outbox(status, scheduled_for);
CREATE INDEX idx_message_outbox_idempotency  ON public.message_outbox(idempotency_key);

ALTER TABLE public.message_outbox ENABLE ROW LEVEL SECURITY;

-- Staff can read their tenant's outbox (for debug/admin views)
CREATE POLICY "message_outbox_tenant_read" ON public.message_outbox
  FOR SELECT USING (tenant_id = get_my_tenant_id());

-- INSERT allowed for staff (enqueueing)
CREATE POLICY "message_outbox_staff_insert" ON public.message_outbox
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'dentist', 'receptionist', 'superadmin'));

-- No UPDATE/DELETE via client — worker uses createAdminClient()
```

### Pattern 3: MessageQueue Interface + OutboxQueue Implementation

**What:** Interface that decouples enqueue callers from the outbox implementation. Enables future swap to pgmq without changing callers (D-01 migration path).

```typescript
// src/lib/messaging/queue.ts
import 'server-only'

export interface EnqueueOptions {
  tenantId: string
  channel: 'whatsapp' | 'email'
  idempotencyKey: string         // caller-controlled dedup key
  payload: Record<string, unknown>
  scheduledFor?: Date
  maxAttempts?: number
}

export interface MessageQueue {
  enqueue(opts: EnqueueOptions): Promise<{ success: boolean; error?: string }>
}

// OutboxQueue: implements MessageQueue against message_outbox table
export class OutboxQueue implements MessageQueue {
  constructor(private admin: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>) {}

  async enqueue(opts: EnqueueOptions): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.admin.from('message_outbox').insert({
      tenant_id: opts.tenantId,
      channel: opts.channel,
      payload: opts.payload,
      idempotency_key: opts.idempotencyKey,
      scheduled_for: (opts.scheduledFor ?? new Date()).toISOString(),
      max_attempts: opts.maxAttempts ?? 3,
    })

    if (error) {
      // 23505 = UNIQUE violation = already enqueued (idempotent skip)
      if (error.code === '23505') return { success: true }
      return { success: false, error: error.message }
    }

    return { success: true }
  }
}
```

### Pattern 4: Worker Drain Loop (Vercel Cron endpoint)

**What:** GET endpoint that processes pending outbox rows. Single cron handles both reminder scan+enqueue AND drain in one invocation (Hobby plan = 1 cron/day).

**Critical design decision:** The single daily cron at `0 11 * * *` does THREE things in sequence:
1. **Scan** tomorrow's appointments → enqueue reminder rows into `message_outbox`
2. **Drain** all `pending` / retryable `failed` rows from `message_outbox` → send via WhatsApp client or Resend
3. Return summary

This avoids burning the single daily execution on just scanning, and another on just draining.

```typescript
// Worker drain loop core logic (inside cron endpoint)
const DRAIN_BATCH = 100  // max rows per invocation

const { data: rows } = await admin
  .from('message_outbox')
  .select('*')
  .in('status', ['pending'])
  .lte('scheduled_for', new Date().toISOString())
  .lt('attempts', /* max_attempts col */ )
  .order('scheduled_for', { ascending: true })
  .limit(DRAIN_BATCH)

for (const row of rows ?? []) {
  // Mark in-flight (attempts++)
  await admin.from('message_outbox')
    .update({ attempts: row.attempts + 1, last_attempted_at: new Date().toISOString() })
    .eq('id', row.id)

  try {
    if (row.channel === 'whatsapp') {
      await sendTemplateMessage(row.payload as WhatsAppTemplateParams)
    } else {
      await resend.emails.send(row.payload as ResendPayload)
    }
    await admin.from('message_outbox')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', row.id)
  } catch (err) {
    const newStatus = row.attempts + 1 >= row.max_attempts ? 'failed' : 'pending'
    await admin.from('message_outbox')
      .update({ status: newStatus, error_message: String(err) })
      .eq('id', row.id)
  }
}
```

### Pattern 5: Appointment Reminder Dedup Key

**What:** The `idempotency_key` for reminder messages follows the same pattern as `collection_log`.

```
idempotency_key = `reminder:${appointmentId}:${channel}:24h`
```

This key is inserted via `OutboxQueue.enqueue()`. Because `idempotency_key` has a UNIQUE constraint, re-running the cron (e.g., Vercel at-least-once delivery) produces a `23505` conflict → skipped silently.

### Pattern 6: Appointment Scan Query

**What:** Query `appointments` + `patients` for tomorrow's non-cancelled appointments.

```typescript
// Inside reminder-dispatch cron
const tomorrow = startOfDay(addDays(new Date(), 1))
const dayAfter = startOfDay(addDays(new Date(), 2))

const { data: appointments } = await admin
  .from('appointments')
  .select(`
    id,
    start_time,
    tenant_id,
    patients!inner(id, full_name, email, phone)
  `)
  .gte('start_time', tomorrow.toISOString())
  .lt('start_time', dayAfter.toISOString())
  .neq('status', 'cancelado')  // [VERIFIED: 20260605000100_clinical_tables.sql CHECK constraint]
```

[VERIFIED: 20260605000100_clinical_tables.sql] — `appointments.status` CHECK constraint is `('agendado','confirmado','em_atendimento','concluido','cancelado')`. Cancelled value is `'cancelado'` (masculine, matches GIST WHERE clause). `patients.phone TEXT` column exists; stored as user-entered string (not E.164 — normalization required).

### Pattern 7: D-05 — WhatsApp Channel in Collection Ruler

**What:** In `src/app/api/cron/collection-ruler/route.ts`, after the email is sent, also enqueue a WhatsApp outbox message via `OutboxQueue.enqueue()`.

```typescript
// After email send succeeds — enqueue WhatsApp via outbox
await queue.enqueue({
  tenantId: rule.tenant_id,
  channel: 'whatsapp',
  idempotencyKey: `collection:${target.receivableId}:${target.milestone}:whatsapp`,
  payload: {
    to: patient.phone,   // E.164 format
    templateName: 'fynxia_cobranca',
    languageCode: 'pt_BR',
    components: [
      { type: 'body', parameters: [
        { type: 'text', text: patient.full_name },
        { type: 'text', text: charge.description ?? 'cobrança odontológica' },
        { type: 'text', text: dueDateFormatted },
        { type: 'text', text: asaasPaymentLink },   // if available in charge
      ]},
    ],
  },
})
```

The existing `collection_log` INSERT remains as the email-channel dedup. The `message_outbox` `idempotency_key` handles WhatsApp-channel dedup independently.

### Anti-Patterns to Avoid

- **Sending WhatsApp directly in cron without outbox:** Bypasses retry logic. If Meta API is down, messages are lost with no recovery path.
- **Storing `idempotency_key = appointment.id` alone:** Not channel-specific — prevents sending both WhatsApp and email for the same appointment. Key must include channel.
- **Module-level `new WhatsAppClient()` at import time:** Throws during `next build` if env vars are absent (same lesson as Resend — use lazy factory or pass credentials at call time).
- **Marking `sent` before the API call returns:** Race condition. Mark in-flight (bump attempts) first, then mark `sent` on success.
- **Re-using `collection_log` for appointment reminders:** `collection_log` is keyed by `(receivable_id, milestone, channel)` — it is financially-scoped. Appointment reminders use a separate mechanism (`message_outbox` with `idempotency_key`).

---

## Meta WhatsApp Cloud API — Reference Details

### API Endpoint

```
POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
```

[VERIFIED: WebFetch from developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/]

**Current API version:** v21.0 (as of February 2026). [CITED: WebSearch 2026 sources]

### Required Headers

```
Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
Content-Type: application/json
```

### Template Message Body — Appointment Reminder with Quick-Reply Buttons

```json
{
  "messaging_product": "whatsapp",
  "to": "+5511999999999",
  "type": "template",
  "template": {
    "name": "fynxia_lembrete_consulta",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "João Silva" },
          { "type": "text", "text": "15/06/2026" },
          { "type": "text", "text": "14:00" },
          { "type": "text", "text": "Dr. Carlos" }
        ]
      },
      {
        "type": "button",
        "sub_type": "quick_reply",
        "index": 0,
        "parameters": [{ "type": "payload", "payload": "CONFIRM_APPOINTMENT" }]
      },
      {
        "type": "button",
        "sub_type": "quick_reply",
        "index": 1,
        "parameters": [{ "type": "payload", "payload": "CANCEL_APPOINTMENT" }]
      }
    ]
  }
}
```

[CITED: developers.facebook.com/docs/whatsapp/api/messages/message-templates/interactive-message-templates/]

### Template Message Body — Collection Reminder (no buttons)

```json
{
  "messaging_product": "whatsapp",
  "to": "+5511999999999",
  "type": "template",
  "template": {
    "name": "fynxia_cobranca",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "João Silva" },
          { "type": "text", "text": "Tratamento Ortodôntico" },
          { "type": "text", "text": "R$ 350,00" },
          { "type": "text", "text": "15/06/2026" },
          { "type": "text", "text": "https://pay.asaas.com/xxx" }
        ]
      }
    ]
  }
}
```

### Success Response

```json
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "+5511999999999", "wa_id": "5511999999999" }],
  "messages": [{ "id": "wamid.xxx", "message_status": "accepted" }]
}
```

### Key Error Codes

| Code | Meaning | How to Handle |
|------|---------|--------------|
| 130429 | Throughput rate limit exceeded (>80 msg/s) | Exponential backoff; dental clinic batch volumes are well below 80/s |
| 131026 | Message undeliverable (recipient not on WhatsApp, blocked, etc.) | Mark outbox row `failed` with max_attempts=1 (no retry — structural failure) |
| 132000 | Template not found or not approved | Fail fast; log error; do not retry |
| 132001 | Template parameter count mismatch | Code bug — fail fast, alert |
| 190 | Invalid/expired access token | Log critical alert; do not retry |

[CITED: https://www.heltar.com/blogs/all-meta-error-codes-explained-along-with-complete-troubleshooting-guide-2025-cm69x5e0k000710xtwup66500]

### Rate Limits

- Default: 80 messages/second per registered business phone number. [CITED: WebSearch sources]
- Dental clinic batch (100-500 patients): far below limit. No throttling needed at launch.
- Cron is daily → total volume per cron invocation is bounded by clinic size.

### Phone Number Format

All `to` values must be E.164 format: `+` country code + number, no spaces, no hyphens.
Brazil example: `+5511999999999` (country code 55, DDD 11, number 9-digit).

[ASSUMED] — `patients.phone` in the database may or may not already be stored in E.164 format. A normalization step (strip non-digits, prepend `+55`) should be applied before passing to the API. Confirm storage format against Phase 2 patient schema.

### Environment Variables Required

```bash
# .env.local.example additions:
WHATSAPP_PHONE_NUMBER_ID=       # From Meta App Dashboard > WhatsApp > API Setup
WHATSAPP_ACCESS_TOKEN=          # System User Token (permanent) or temporary test token
WHATSAPP_BUSINESS_ACCOUNT_ID=   # WhatsApp Business Account ID (needed for template mgmt)
```

---

## Template Registration Flow

### Category: UTILITY (mandatory — D-03)

Utility templates must be operational/transactional. Do NOT use marketing language. Dental appointment reminders and payment reminders qualify as utility.

**Risk:** Starting April 9, 2025, Meta auto-reclassifies templates. If Meta detects promotional language in a utility template, it reclassifies to marketing (higher cost, opt-in required). [CITED: WebSearch — template categorization changes April 2025]

**Safe utility template keywords:** "sua consulta", "agendamento", "confirmação", "pagamento", "vencimento", "cobrança" — these are transactional.

**Avoid:** "aproveite", "promoção", "desconto", "especial" — these trigger marketing reclassification.

### Template Registration Steps (Meta Business Manager)

1. Go to Meta Business Manager → WhatsApp Manager → Account → Message Templates → Create Template
2. Category: Utility
3. Language: Portuguese (Brazil) `pt_BR`
4. Template name (snake_case, no spaces): `fynxia_lembrete_consulta`, `fynxia_cobranca`
5. Define body with `{{1}}`, `{{2}}`, etc. variables
6. For appointment template: add Buttons → Quick Reply → "Confirmar" + "Cancelar"
7. Submit for review → approval typically within 30 minutes to 24 hours
8. Status: `PENDING` → `APPROVED` (or `REJECTED`)

**Approval timeline:** Usually 30 min–24 hours. Meta Business account verification is separate (7-14 days) and must be completed first. [CITED: WebSearch wati.io source]

### Template Variables (body text) — Appointment Reminder

```
Template body text:
"Olá, {{1}}! Sua consulta está agendada para {{2}} às {{3}} com {{4}}. Deseja confirmar ou cancelar?"

Variables at send time:
{{1}} = patient name
{{2}} = appointment date (e.g. "15/06/2026")
{{3}} = appointment time (e.g. "14:00")
{{4}} = dentist name
```

### Template Variables — Collection Reminder

```
Template body text:
"Olá, {{1}}. Você tem uma cobrança de {{2}} no valor de {{3}} com vencimento em {{4}}. Acesse para pagar: {{5}}"

Variables at send time:
{{1}} = patient name
{{2}} = service description
{{3}} = formatted amount
{{4}} = due date
{{5}} = Asaas payment link
```

---

## React Email — Appointment Reminder Template

### New file: src/emails/AppointmentReminderEmail.tsx

Mirror `CollectionReminderEmail.tsx` pattern exactly:
- Import from `@react-email/components`: `Html`, `Head`, `Body`, `Container`, `Heading`, `Text`, `Button`, `Section`, `Hr`
- Props: `patientName: string`, `clinicName: string`, `appointmentDate: string`, `appointmentTime: string`, `dentistName: string`
- Language: Brazilian Portuguese
- CTA button: "Ver minha agenda" (no action needed — informational)
- Send subject: `"Lembrete: sua consulta é amanhã — {clinicName}"`

[VERIFIED: existing `CollectionReminderEmail.tsx` and `InviteEmail.tsx` in codebase — pattern confirmed]

---

## Vercel Cron — Confirmed Limits

| Plan | Max crons/project | Min interval | Timing precision |
|------|-------------------|--------------|-----------------|
| Hobby | 100 | Once per day | ±59 minutes |
| Pro | 100 | Once per minute | Per-minute |

**Current vercel.json already has 1 cron** (`/api/cron/collection-ruler`, `"0 8 * * *"`). Adding reminder cron at `"0 11 * * *"` brings total to 2. Both are once-per-day expressions → within Hobby plan limits (100 daily crons allowed). [VERIFIED: https://vercel.com/docs/cron-jobs/usage-and-pricing]

**Both crons are valid on Hobby:** As of January 20, 2026, per-project cron limit is 100 on all plans. Both expressions run once per day — no upgrade needed. [CITED: vercel.com/changelog]

**Timing note:** `"0 11 * * *"` fires anywhere between 11:00–11:59 UTC (08:00–08:59 BRT). The `±59 min` Hobby imprecision is acceptable for batch reminders.

**Recommended vercel.json after Phase 4:**
```json
{
  "regions": ["gru1"],
  "crons": [
    { "path": "/api/cron/collection-ruler", "schedule": "0 8 * * *" },
    { "path": "/api/cron/reminder-dispatch", "schedule": "0 11 * * *" }
  ]
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent message dedup | Custom dedup cache | `idempotency_key UNIQUE` in `message_outbox` | PostgreSQL UNIQUE constraint is atomic and survives restarts |
| WhatsApp message retry | Custom retry scheduler | `attempts` + `max_attempts` in outbox row + re-query pending on next cron | Simple, no extra infra, works within Hobby daily batch |
| E.164 phone normalization | Regex from scratch | Single normalizer utility function | Easy to get wrong (DDD, 8 vs 9 digit numbers in Brazil) |
| Template variable injection | String interpolation in JS | Pass `parameters` array to Meta API — variables are in the approved template | Meta resolves `{{1}}` server-side; JS only provides values |
| Email template HTML | Raw HTML strings | `@react-email/components` (already in use) | Consistent, typed, tested |

**Key insight:** The Meta API handles template variable substitution entirely server-side. Callers only pass parameter values, not the template text itself. This means template content changes do not require code changes — only template re-approval.

---

## Common Pitfalls

### Pitfall 1: Burning the Daily Cron Slot on Enqueue Only
**What goes wrong:** Separate crons for "scan+enqueue" and "drain" would require 2 cron slots — both must be daily expressions on Hobby. If drain is separate, outbox messages sit unprocessed until the drain cron fires the next day.
**Why it happens:** Treating scan and drain as independent concerns without considering Hobby's once-per-day constraint.
**How to avoid:** Single cron endpoint (`reminder-dispatch`) does scan → enqueue → drain in one invocation.
**Warning signs:** Workers queued but never sent same day; vercel.json has drain-only cron with different schedule.

### Pitfall 2: Module-Level WhatsApp Client Instantiation
**What goes wrong:** `const client = new WhatsAppClient(process.env.WHATSAPP_ACCESS_TOKEN)` at module scope throws `Error: missing credentials` during `next build` static analysis when env vars are absent.
**Why it happens:** Same lesson as Resend singleton (Phase 3 Deviation 1).
**How to avoid:** Call-time credential reads inside `sendTemplateMessage()` (not module-level). Or lazy singleton factory pattern like `getResend()`.
**Warning signs:** `next build` fails with credential error even though env vars are set in Vercel.

### Pitfall 3: Phone Number Not in E.164 Format
**What goes wrong:** Meta API returns error 100 or silently fails if `to` is `"11999999999"` (no country code) or `"(11) 99999-9999"` (formatted).
**Why it happens:** DB stores phone as user-entered string; Brazilian users enter without `+55`.
**How to avoid:** Normalize `patients.phone` before enqueueing: strip non-digits, prepend `+55` if not already starting with `+55`.
**Warning signs:** 131026 errors ("Message undeliverable") when number appears valid.

### Pitfall 4: Template Not Approved Before Testing
**What goes wrong:** 132000 error ("Template not found") because template was submitted but not yet approved, or was submitted to sandbox not production.
**Why it happens:** Template approval is async (30 min–24h). Sandbox and production are separate environments.
**How to avoid:** Unit tests mock the WhatsApp client — no live API calls in CI. UAT checklist includes: verify template status = `APPROVED` before running live test.
**Warning signs:** Works in tests but fails in manual live test.

### Pitfall 5: Double-Sending on Cron Retry
**What goes wrong:** Vercel Cron uses at-least-once delivery. If the cron worker times out after sending but before marking `sent`, next invocation re-sends.
**Why it happens:** No idempotency guard between "message sent" and "status updated".
**How to avoid:** Increment `attempts` counter BEFORE sending. If status update after send fails, next invocation sees `attempts >= max_attempts` and skips. For WhatsApp specifically, 131026 (undeliverable) should set `max_attempts=1`.
**Warning signs:** Patients report receiving duplicate reminder messages.

### Pitfall 6: Re-sending Failed WhatsApp Messages Indefinitely
**What goes wrong:** Permanent failures (131026 = not on WhatsApp, 132000 = template missing) are retried repeatedly, burning Meta API quota.
**Why it happens:** Treating all failures as transient.
**How to avoid:** Distinguish transient (network error, 130429 rate limit) from permanent (131026, 132000, 190) errors. On permanent errors, set `status='failed'` and `max_attempts=attempts` (no more retries).
**Warning signs:** `message_outbox` table accumulates rows with `status='pending'` and `attempts` incrementing daily.

### Pitfall 7: Missing `export const runtime = 'nodejs'`
**What goes wrong:** Vercel deploys the cron endpoint as Edge Runtime, which has no `net` module, causing `fetch` to `graph.facebook.com` to fail with networking errors.
**Why it happens:** Default is Edge for App Router API routes in some Next.js versions.
**How to avoid:** All cron endpoints MUST have `export const runtime = 'nodejs'` (pattern already established in Phase 3).

### Pitfall 8: WhatsApp Recipient Phone Number Has No WhatsApp Account
**What goes wrong:** Sends fail with 131026 for patients who don't use WhatsApp.
**Why it happens:** Not all Brazilian phone numbers are registered on WhatsApp.
**How to avoid:** Log 131026 as a known soft failure. Do NOT mark appointment as "reminder failed" — the email channel runs independently and always fires.

---

## Data Model

### message_outbox (new table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `tenant_id` | UUID FK → clinics | Indexed; RLS USING+WITH CHECK |
| `channel` | ENUM `message_channel` | `'whatsapp'`, `'email'` |
| `status` | ENUM `message_status` | `'pending'`, `'sent'`, `'failed'` |
| `attempts` | INT | Default 0; incremented before each send |
| `max_attempts` | INT | Default 3; set to 1 for permanent failures |
| `payload` | JSONB | Channel-specific params (WhatsAppTemplateParams or ResendParams) |
| `idempotency_key` | TEXT UNIQUE | `reminder:{appointmentId}:{channel}:24h` or `collection:{receivableId}:{milestone}:{channel}` |
| `scheduled_for` | TIMESTAMPTZ | Default now(); drain skips rows where `scheduled_for > now()` |
| `last_attempted_at` | TIMESTAMPTZ | For monitoring |
| `sent_at` | TIMESTAMPTZ | Set on success |
| `error_message` | TEXT | Last error description |
| `created_at` / `updated_at` | TIMESTAMPTZ | Standard |

**Indexes:** `(status, scheduled_for)` composite for drain query; `(tenant_id)` for RLS; `(idempotency_key)` unique for dedup.

**RLS:** USING+WITH CHECK via `get_my_tenant_id()`. Worker uses `createAdminClient()` (bypasses RLS). No DELETE policy.

**Audit:** No audit trigger on outbox (high-frequency write table; sent events logged via `logBusinessEvent` in worker).

### No separate message_log table needed

The `message_outbox` itself serves as the send log. `idempotency_key UNIQUE` prevents re-enqueue. `status='sent'` rows are the audit trail. `logBusinessEvent` is called per successful send by the worker.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WhatsApp Business API (on-premise) | WhatsApp Cloud API (hosted by Meta) | Meta 2021 | No server needed; REST only; Meta manages infra |
| Template manual review 24-48h | Template review 30 min–24h (usually fast) | Meta 2023+ | Faster iteration; but auto-reclassification adds risk |
| Separate marketing/utility categories | Auto-reclassification to marketing if content matches | April 9, 2025 | Must write utility templates conservatively |
| Vercel per-team cron limits | Per-project limit 100 crons on all plans | January 20, 2026 | Can add second daily cron without upgrade |

**Deprecated/outdated:**
- `@whatsapp/api-js` Node.js SDK: thin docs, no official support signal, REST API is simpler — do not use.
- Evolution API / Baileys: ToS violation, not an option (PROJECT locked).
- Per-day limit of 1 cron total: The January 2026 Vercel update raised this to 100/project. However, the minimum frequency is still once/day for Hobby.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| ~~A1~~ | ~~`appointments.status` uses `'cancelada'` as cancelled enum value~~ | RESOLVED | [VERIFIED: clinical_tables.sql] Value is `'cancelado'` — code example updated |
| ~~A2~~ | ~~`patients.phone` exists as column, stored as user-entered string~~ | RESOLVED | [VERIFIED: clinical_tables.sql] Column is `phone TEXT` — user-entered, E.164 normalization required |
| A3 | Asaas payment links are stored on the `charges` table or derivable from `provider_charge_id` | Architecture Patterns §7 (D-05) | Collection WhatsApp template cannot include payment link without a separate Asaas API call |
| A4 | Graph API version v21.0 is current and stable as of June 2026 | Meta WhatsApp Cloud API Reference | If Meta released v22.0+ and deprecated v21.0, endpoint may return warnings; migrate to current version |
| ~~A5~~ | ~~Both `patients.phone` and `patients.email` exist in Phase 2 schema~~ | RESOLVED | [VERIFIED: clinical_tables.sql] Both `phone TEXT` and `email TEXT` confirmed in patients table |

---

## Open Questions

1. **[RESOLVED] Appointment status enum value for cancelled**
   - VERIFIED: `appointments.status` CHECK constraint includes `'cancelado'` (not 'cancelada'). Use `.neq('status', 'cancelado')` in reminder scan query.
   - Source: `supabase/migrations/20260605000100_clinical_tables.sql`

2. **[RESOLVED] Patient phone column name and format**
   - VERIFIED: `patients.phone TEXT` (nullable) — user-entered string, not E.164. E.164 normalization required before enqueueing WhatsApp message.
   - `patients.email TEXT` also confirmed (nullable).
   - Source: `supabase/migrations/20260605000100_clinical_tables.sql`

3. **Asaas payment link availability for collection WhatsApp template**
   - What we know: `charges` has `provider_charge_id` (Asaas pay_xxx)
   - What's unclear: Whether the Asaas payment link (bankSlipUrl or invoiceUrl) is stored locally or requires an API call
   - Recommendation: If link not stored, template variable should be `https://www.asaas.com/i/{provider_charge_id}` (Asaas public invoice URL pattern — [ASSUMED])

4. **Template names to register with Meta**
   - What we know: D-03 requires 2 utility templates
   - What's unclear: Final template body copy (exact Brazilian Portuguese wording, variables)
   - Recommendation: Claude's discretion — see template examples in this research

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vercel Cron (Hobby) | COMMS-04 | ✓ | Current (Jan 2026 update) | — |
| `resend` npm package | COMMS-02 | ✓ | ^6.12.4 (installed) | — |
| `@react-email/components` | COMMS-02 | ✓ | ^1.0.12 (installed) | — |
| `date-fns` | Reminder scan | ✓ | ^4.4.0 (installed) | — |
| Meta WhatsApp Cloud API | COMMS-01 | ✗ (not yet configured) | v21.0 | Unit tests mock fetch; live = UAT |
| WHATSAPP_ACCESS_TOKEN | WhatsApp client | ✗ | — | Env var placeholder; fails gracefully |
| Meta Business Account | Template registration | ✗ (7-14 day lead time) | — | Build now, verify in UAT |

**Missing dependencies with no fallback:**
- None that block code implementation. Live WhatsApp sends blocked by missing account (UAT-deferred by D-02).

**Missing dependencies with fallback:**
- Meta WhatsApp Cloud API credentials: unit tests mock fetch, client returns `{ success: false, error: 'WhatsApp credentials not configured' }` when env vars absent.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.8 |
| Config file | `vitest.config.ts` at project root |
| Quick run command | `npx vitest run src/__tests__/comms/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMMS-01 | WhatsApp client builds correct POST body for template message | unit (source inspection + mocked fetch) | `npx vitest run src/__tests__/comms/whatsapp.test.ts` | ❌ Wave 0 |
| COMMS-01 | Outbox dedup: second enqueue with same idempotency_key returns success (23505 skip) | unit (source inspection) | `npx vitest run src/__tests__/comms/outbox.test.ts` | ❌ Wave 0 |
| COMMS-02 | AppointmentReminderEmail renders with patientName, clinicName, date, time, dentistName | unit (renderToStaticMarkup) | `npx vitest run src/__tests__/comms/email.test.ts` | ❌ Wave 0 |
| COMMS-03 | WhatsApp client uses 'utility' category in template name; no marketing keywords in template body | unit (source inspection) | `npx vitest run src/__tests__/comms/whatsapp.test.ts` | ❌ Wave 0 |
| COMMS-04 | Worker marks row `sent` on success, increments `attempts` before send, marks `failed` after max_attempts | unit (source inspection) | `npx vitest run src/__tests__/comms/outbox.test.ts` | ❌ Wave 0 |
| COMMS-01/04 | Reminder scan: appointments tomorrow with non-cancelled status enqueued; cancelled not enqueued | unit (pure function test) | `npx vitest run src/__tests__/comms/reminders.test.ts` | ❌ Wave 0 |
| COMMS-01 | Cron endpoint validates CRON_SECRET Bearer before processing | unit (source inspection) | `npx vitest run src/__tests__/comms/reminders.test.ts` | ❌ Wave 0 |
| D-05 | Collection ruler cron enqueues WhatsApp channel after email send | unit (source inspection) | Covered in existing `ruler.test.ts` supplement | ❌ Wave 0 addendum |

**Note on live Meta API sends:** All tests mock `fetch()` or use source inspection. No test calls `graph.facebook.com` directly. Live delivery is verified in UAT (same strategy as Asaas Phase 3 Task 4 → `03-HUMAN-UAT.md`).

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/comms/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/migrations/comms.test.ts` — covers COMMS-04 (message_outbox + message_log schema + RLS, static SQL)
- [ ] `src/__tests__/comms/whatsapp.test.ts` — covers COMMS-01, COMMS-03
- [ ] `src/__tests__/comms/outbox.test.ts` — covers COMMS-04, dedup, retry, CRON_SECRET
- [ ] `src/__tests__/comms/reminders.test.ts` — covers scan logic, cancelled filter, dedup key format
- [ ] `src/__tests__/comms/email.test.ts` — covers COMMS-02 (AppointmentReminderEmail render)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (cron worker, no user auth) | — |
| V3 Session Management | No | — |
| V4 Access Control | Yes — cron endpoint must reject unauthorized callers | `Authorization: Bearer ${CRON_SECRET}` check (pattern from Phase 3) |
| V5 Input Validation | Yes — phone number normalization before WhatsApp API | E.164 normalization function + Zod schema for outbox payload shape |
| V6 Cryptography | No — no new secrets stored; WhatsApp token in env var only | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated cron trigger | Spoofing | `Authorization: Bearer ${CRON_SECRET}` — 401 on mismatch (Phase 3 pattern) |
| PHI in outbox payload (patient name, phone) | Information Disclosure | `message_outbox` has RLS (tenant-scoped); cron uses `createAdminClient()`; `logBusinessEvent` logs IDs only (no PHI) |
| WHATSAPP_ACCESS_TOKEN in client-side bundle | Information Disclosure | `import 'server-only'` in whatsapp/client.ts; `NEXT_PUBLIC_` prefix NEVER used |
| Message flooding via outbox INSERT | Tampering | RLS INSERT policy requires authenticated staff role; `idempotency_key UNIQUE` caps one message per (appointment, channel, window) |
| Replay of cron endpoint | Tampering | `idempotency_key` dedup + `attempts`/`max_attempts` gate; idempotent on re-run |
| WhatsApp template reclassification to marketing | Compliance | Use only transactional language; category `UTILITY`; monitor template status in Meta console |
| LGPD: patient phone in outbox table | Privacy | `message_outbox.payload` is JSONB and contains patient phone. This is acceptable — it is encrypted at rest by Supabase (Postgres data-at-rest encryption), tenant-scoped by RLS, and audit-logged. Soft-delete and anonymization of patients should null out pending outbox rows for that patient. |

---

## Sources

### Primary (HIGH confidence)
- [Vercel Cron Usage and Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Hobby plan: 100 crons/project, once/day minimum, ±59 min precision [VERIFIED via WebFetch]
- [Meta WhatsApp Cloud API Messages Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/) — POST endpoint URL, template message body, pt_BR language code, response format [VERIFIED via WebFetch]
- [WhatsApp Interactive Message Templates](https://developers.facebook.com/docs/whatsapp/api/messages/message-templates/interactive-message-templates/) — quick_reply button component structure with index and payload [CITED via WebFetch]
- Existing codebase: `src/app/api/cron/collection-ruler/route.ts` — CRON_SECRET pattern, admin client, idempotency via 23505 [VERIFIED in codebase]
- Existing codebase: `src/lib/resend.ts` — lazy singleton pattern [VERIFIED in codebase]
- Existing codebase: `src/lib/collection/ruler.ts` — pure engine pattern for unit-testable logic [VERIFIED in codebase]
- `vercel.json` — existing cron declaration pattern [VERIFIED in codebase]
- `package.json` — all required packages already installed, no new deps needed [VERIFIED in codebase]

### Secondary (MEDIUM confidence)
- [Vercel Cron 100/project changelog](https://vercel.com/changelog/cron-jobs-now-support-100-per-project-on-every-plan) — January 20, 2026 update [CITED via WebSearch]
- [WhatsApp API error codes guide](https://www.heltar.com/blogs/all-meta-error-codes-explained-along-with-complete-troubleshooting-guide-2025-cm69x5e0k000710xtwup66500) — 130429, 131026, 132000 meanings [CITED via WebSearch]
- [Meta template categorization changes April 2025](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization) — auto-reclassification behavior [CITED via WebSearch]
- [WhatsApp template approval timeline](https://support.wati.io/en/articles/12320234-understanding-meta-s-latest-updates-on-template-approval) — 30 min–24h review [CITED via WebSearch]

### Tertiary (LOW confidence)
- Asaas public invoice URL pattern `https://www.asaas.com/i/{id}` — inferred from Asaas URL conventions; not verified against Asaas API docs [ASSUMED — verify before using in collection WhatsApp template]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already in project, no new deps
- Architecture: HIGH — all patterns have direct codebase precedent (Phase 3)
- Meta API shape: HIGH — verified via official Meta docs WebFetch + multiple source cross-check
- Vercel Cron limits: HIGH — verified via official Vercel docs WebFetch
- Template approval flow: MEDIUM — official docs verified; specific timing is approximate
- Pitfalls: HIGH — derived from Phase 3 lessons + known Meta API failure modes

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (stable APIs; verify Meta API version currency if planning after this date)
