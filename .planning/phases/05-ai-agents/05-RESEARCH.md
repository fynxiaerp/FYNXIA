# Phase 5: AI Agents - Research

**Researched:** 2026-06-10
**Domain:** AI SDK v6 + Vercel AI Gateway + Meta WhatsApp inbound webhook + tenant-scoped LLM tools
**Confidence:** HIGH (core stack verified via official Vercel/AI SDK docs; WhatsApp payload shape MEDIUM via third-party guide cross-referenced with official structure)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Tool-calling + mascaramento de PII. LLM chama ferramentas read-only TENANT-SCOPED (server-side, RLS via sessão do usuário). PII sensível mascarada/excluída: CPF mascarado, dados de saúde/prontuário/anamnese NUNCA enviados; nome + metadados de consulta liberados. Stack: AI SDK v6 + Vercel AI Gateway, modelo `anthropic/claude-sonnet-4.6`, streaming via Route Handler (runtime nodejs).
- **D-02:** AI_GATEWAY_API_KEY lido em call-time; zero-retention = estratégia LGPD (Q6 fechada). Sem DPA formal separado pois dado identificável sensível nunca sai.
- **D-03:** Copiloto também atua como HELP/assistente de uso — mesmo chat responde data queries E how-to. Fonte de help/FAQ curada disponível ao copiloto via system prompt e/ou tool de busca.
- **D-04:** AI-02 webhook INBOUND WhatsApp (botão Confirmar/Cancelar primário + LLM interpreta texto livre fallback seguro) → appointments.status; AI-03 LLM personaliza cobrança + link Asaas REAL (getInvoiceUrl, nunca fabricado), auditado. Envio live deferido (Meta).
- **D-05:** Copiloto READ-ONLY no v1 — responde e orienta, não executa ações de escrita.

### Claude's Discretion

- UX do copiloto: sidebar slide-over, streaming via useChat, prompts sugeridos por contexto, estados loading/erro.
- Estrutura da fonte de help/FAQ (D-03); formato das tools read-only e do mascaramento; system prompt.
- Guardrails de prompt-injection (tools são RLS-scoped de qualquer forma).
- Formato do log de auditoria dos agentes; schema de agent_outreach_log se necessária.

### Deferred Ideas (OUT OF SCOPE)

- Copiloto executando ações de escrita (remarcar, cobrar via chat).
- Texto livre como único canal no AI-02 (botões são primários).
- Voice-to-text / analytics avançado por IA.
- Envio live WhatsApp dos agentes (depende verificação Meta, mesmo UAT Fase 4).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-01 | Copiloto IA disponível em toda tela via chat lateral (Vercel AI Gateway) | AI SDK v6 streamText + useChat + route handler + Vercel AI Gateway provider string |
| AI-02 | Agente autônomo confirma consultas do dia seguinte via WhatsApp e registra resposta | Meta webhook INBOUND (GET verify + POST HMAC-SHA256) + appointments.status update + LLM intent classification |
| AI-03 | Agente autônomo identifica inadimplentes e envia mensagem de cobrança personalizada | Phase 3 gateway.getInvoiceUrl + Phase 4 outbox/worker reuse + LLM generateText personalization + agent_outreach_log |
</phase_requirements>

---

## Summary

Phase 5 adds three AI capabilities on top of the completed Phases 1-4 stack. The core technology is AI SDK v6 (`ai@6.0.200`, `@ai-sdk/react@3.0.202`) with Vercel AI Gateway, which requires no new provider adapter — passing the string `'anthropic/claude-sonnet-4.6'` to `streamText`/`generateText` is enough and `AI_GATEWAY_API_KEY` is auto-picked from the environment. Zero Data Retention is available per-request via `providerOptions.gateway.zeroDataRetention: true` (no extra cost for per-request; $0.10/1k for team-wide) with no code change — this is the D-02 LGPD strategy.

The copilot (AI-01) is a Route Handler (`POST /api/copilot`) using `streamText` with read-only, tenant-scoped tools that return PII-masked data. The client mounts `useChat` from `@ai-sdk/react` in the Sheet sidebar (per UI-SPEC). The WhatsApp inbound webhook (AI-02) is a new route handler (`GET`/`POST /api/webhooks/whatsapp`) using the same HMAC-SHA256 + 200-immediately + dedup pattern from Phase 3's Asaas webhook. AI-03 reuses the Phase 4 outbox and Phase 3 `gateway.getInvoiceUrl` with `generateText` for message personalization.

**Primary recommendation:** Install `ai@^6` + `@ai-sdk/react@^3` + `@ai-sdk/gateway@^3` (for `GatewayProviderOptions` type). Use string model ID `'anthropic/claude-sonnet-4.6'` directly. Add `AI_GATEWAY_API_KEY` to Vercel env vars. All other infrastructure (outbox, worker, cron, audit, Supabase clients) reuses existing Phase 3/4 code without modification.

---

## Standard Stack

### Core (new additions for Phase 5)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | ^6.0.200 [VERIFIED: npm registry] | streamText, generateText, tool(), UIMessage, convertToModelMessages | Official Vercel AI SDK — only package needed for server-side |
| `@ai-sdk/react` | ^3.0.202 [VERIFIED: npm registry] | useChat hook (client-side chat state + streaming) | Official React bindings for AI SDK v6 |
| `@ai-sdk/gateway` | ^3.0.127 [VERIFIED: npm registry] | `GatewayProviderOptions` TypeScript type | Provides typed `providerOptions.gateway` for ZDR, routing |

### Reused (no new install)

| Library | Version | Purpose |
|---------|---------|---------|
| `zod` | ^3.25.76 (already installed) | Tool `parameters` / `inputSchema` schema definition |
| `@supabase/ssr` + `@supabase/supabase-js` | already installed | createClient() (user RLS) for copilot tools; createAdminClient() for webhook/cron |

### No Separate Provider SDK Needed

Vercel AI Gateway acts as the universal router. Passing `'anthropic/claude-sonnet-4.6'` as the `model` string to AI SDK functions automatically routes through the gateway using `AI_GATEWAY_API_KEY`. No `@anthropic-ai/sdk` install needed. [VERIFIED: vercel.com/docs/ai-gateway/sdks-and-apis/ai-sdk]

**Installation (new packages only):**
```bash
npm install ai @ai-sdk/react @ai-sdk/gateway
```

**Version verification** (run before adding to package.json):
```bash
npm view ai version        # 6.0.200 as of 2026-06-10
npm view @ai-sdk/react version   # 3.0.202
npm view @ai-sdk/gateway version # 3.0.127
```

---

## Architecture Patterns

### Recommended File Structure (Phase 5 additions)

```
src/
├── app/
│   ├── api/
│   │   ├── copilot/
│   │   │   └── route.ts              # POST — streamText + tools (AI-01)
│   │   └── webhooks/
│   │       └── whatsapp/
│   │           └── route.ts          # GET (verify) + POST (inbound AI-02)
│   └── (dashboard)/clinica/
│       ├── layout.tsx                # Add CopilotTrigger here (present on all pages)
│       └── ia/
│           └── agentes/
│               └── page.tsx          # AgentOutreachLog read-only table
├── components/
│   └── copilot/
│       ├── CopilotTrigger.tsx        # 'use client' — fixed button
│       ├── CopilotSidebar.tsx        # 'use client' — Sheet + useChat
│       ├── MessageList.tsx
│       ├── MessageBubble.tsx
│       ├── SuggestedPrompts.tsx
│       ├── CopilotInput.tsx
│       └── AgentOutreachLog.tsx      # read-only table
├── lib/
│   ├── ai/
│   │   ├── tools.ts                  # read-only tenant-scoped tool definitions
│   │   ├── masking.ts                # PII masking helpers
│   │   └── whatsapp-intent.ts        # LLM intent classification (AI-02 fallback)
│   └── agents/
│       ├── confirmation-agent.ts     # AI-02 cron: find appointments, enqueue via outbox
│       └── collection-agent.ts       # AI-03 cron: find overdue, LLM personalize, enqueue
└── __tests__/
    └── ai/
        ├── tools.test.ts             # tool masking, tenant scope
        ├── copilot-route.test.ts     # route handler structure
        ├── whatsapp-webhook.test.ts  # GET verify + POST HMAC + status update + dedup
        └── agents.test.ts            # AI-02/03 message build, real Asaas link, outbox enqueue
```

### Pattern 1: Copilot Route Handler (AI-01)

**What:** `POST /api/copilot` — streams text using AI SDK v6 `streamText` with read-only tools.
**When to use:** Every user message in the sidebar.

```typescript
// Source: vercel.com/docs/ai-gateway/sdks-and-apis/ai-sdk + ai-sdk.dev docs
// src/app/api/copilot/route.ts
import 'server-only'
import { streamText, tool, UIMessage, convertToModelMessages } from 'ai'
import type { GatewayProviderOptions } from '@ai-sdk/gateway'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request): Promise<Response> {
  // Auth gate — same pattern as all other server routes
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Read API key at call-time (D-02; same lazy pattern as WHATSAPP_*, getResend())
  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) return new Response('AI gateway not configured', { status: 503 })

  const { messages }: { messages: UIMessage[] } = await request.json()

  const result = streamText({
    model: 'anthropic/claude-sonnet-4.6',   // D-01: locked model
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      getTodayAppointments: tool({ ... }),   // defined in lib/ai/tools.ts
      getPatientSummary: tool({ ... }),
      getOverdueReceivables: tool({ ... }),
      searchHelpDocs: tool({ ... }),         // D-03: how-to support
    },
    providerOptions: {
      gateway: {
        zeroDataRetention: true,             // D-02: LGPD
      } satisfies GatewayProviderOptions,
    },
    stopWhen: stepCountIs(5),               // AI SDK v6: replaces maxSteps
  })

  return result.toUIMessageStreamResponse()
}
```

### Pattern 2: useChat Hook Wiring (AI-01 client)

**What:** `useChat` from `@ai-sdk/react` in the `CopilotSidebar` component.
**Note:** AI SDK v6 broke changes from v4: `sendMessage({text})` replaces `handleSubmit`, `status` replaces `isLoading`, `messages[].parts` replaces `messages[].content` string. [VERIFIED: ai-sdk.dev/docs/migration-guides/migration-guide-6-0]

```typescript
// src/components/copilot/CopilotSidebar.tsx
'use client'
import { useChat } from '@ai-sdk/react'

export function CopilotSidebar() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, status, error, setMessages } = useChat({
    api: '/api/copilot',
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  function handleSubmit() {
    if (!input.trim()) return
    sendMessage({ text: input })
    setInput('')
  }

  // messages[].parts — each part has type: 'text' | 'tool-*'
  // For this copilot only text parts are rendered (tools run server-side)
}
```

**CRITICAL migration note:** In AI SDK v6 the `useChat` hook no longer manages `input` state internally. The component owns the textarea value via `useState`. [VERIFIED: ai-sdk.dev migration guide]

### Pattern 3: Tool Definition (AI SDK v6)

**What:** Read-only, tenant-scoped tool using `createClient()` (user session / RLS).
**PII masking layer:** Tool's `execute` function masks before returning — the model never sees raw CPF, health data, or prontuário.

```typescript
// src/lib/ai/tools.ts — verified AI SDK v6 tool() API
import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { maskCPF, maskPhone } from './masking'  // pattern from Phase 1/2

export const getTodayAppointments = tool({
  description: 'Fetch today\'s appointments for the authenticated clinic',
  // AI SDK v6: Vercel docs show "parameters", migration guide shows "inputSchema"
  // Vercel official AI Gateway docs use "parameters" — use that
  parameters: z.object({
    date: z.string().optional().describe('ISO date YYYY-MM-DD, defaults to today'),
  }),
  execute: async ({ date }) => {
    const supabase = await createClient()    // RLS-scoped — auto-filtered to tenant
    const targetDate = date ?? new Date().toISOString().split('T')[0]

    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, start_time, end_time, status, patient:patients(name), dentist:users(name)')
      .gte('start_time', `${targetDate}T00:00:00Z`)
      .lt('start_time', `${targetDate}T23:59:59Z`)
      .is('deleted_at', null)

    // PII masking: name allowed (D-01), no CPF/health data in appointments select
    return appointments ?? []
  },
})

// maskCPF: '123.456.789-00' → '***.***.***-00' (pattern from Phase 1/2 listagens)
// NEVER select: medical_history, allergies, medications, anamnesis_records
```

### Pattern 4: WhatsApp Inbound Webhook (AI-02)

**What:** `GET /api/webhooks/whatsapp` for Meta hub verification; `POST /api/webhooks/whatsapp` for inbound messages.
**Reuses:** Phase 3 Asaas webhook pattern (HMAC validation + 200 immediately + dedup + fire-and-forget).

```typescript
// src/app/api/webhooks/whatsapp/route.ts
export const runtime = 'nodejs'

// GET — Meta hub.challenge verification
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// POST — inbound messages
export async function POST(request: Request): Promise<Response> {
  // Step 1: HMAC-SHA256 signature validation (X-Hub-Signature-256)
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256') ?? ''
  if (!validateMeta256Signature(rawBody, signature, process.env.WHATSAPP_APP_SECRET!)) {
    return new Response('Forbidden', { status: 403 })
  }

  // Return 200 IMMEDIATELY (Meta retries on non-200)
  const payload = JSON.parse(rawBody)

  // Dedup: message id from payload.entry[0].changes[0].value.messages[0].id
  // (same webhook_events pattern from Phase 3, but for WhatsApp message ids)
  processWhatsAppMessage(payload).catch(console.error)  // fire-and-forget

  return new Response('', { status: 200 })
}
```

**HMAC-SHA256 validation (raw body — CRITICAL):**
```typescript
import crypto from 'crypto'

function validateMeta256Signature(rawBody: string, header: string, secret: string): boolean {
  if (!header.startsWith('sha256=')) return false
  const providedHash = header.slice(7)
  const computedHash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(providedHash))
  } catch { return false }
}
// CRITICAL: rawBody must be the unmodified text BEFORE JSON.parse
// crypto.timingSafeEqual prevents timing attacks
```

### Pattern 5: LLM Intent Classification (AI-02 fallback)

**What:** When inbound message is free text (type="text"), use `generateText` to classify intent.
**Safe fallback:** Ambiguous → NO status change, record for human review.

```typescript
// src/lib/ai/whatsapp-intent.ts
import { generateText } from 'ai'

type Intent = 'confirm' | 'cancel' | 'ambiguous'

export async function classifyConfirmationIntent(text: string): Promise<Intent> {
  const { text: result } = await generateText({
    model: 'anthropic/claude-sonnet-4.6',
    system: 'Classify the patient intent from a WhatsApp reply to an appointment confirmation request. Respond with exactly one word: confirm, cancel, or ambiguous.',
    messages: [{ role: 'user', content: [{ type: 'text', text }] }],
    providerOptions: { gateway: { zeroDataRetention: true } },
    maxOutputTokens: 10,
  })
  const intent = result.trim().toLowerCase()
  if (intent === 'confirm') return 'confirm'
  if (intent === 'cancel') return 'cancel'
  return 'ambiguous'   // safe fallback — no status change
}
```

### Pattern 6: AI-03 Collection Agent (reuses Phase 3+4)

```typescript
// src/lib/agents/collection-agent.ts
import { generateText } from 'ai'
import { gateway } from '@/lib/asaas/gateway'   // getInvoiceUrl (Phase 3)
import { getOutboxQueue } from '@/lib/messaging/queue'  // Phase 4 outbox

async function buildCollectionMessage(patient: { name: string }, amount: number): Promise<string> {
  const { text } = await generateText({
    model: 'anthropic/claude-sonnet-4.6',
    system: 'You generate WhatsApp collection messages for dental clinics in pt-BR. Be empathetic, clear, professional. 1-2 sentences max.',
    messages: [{ role: 'user', content: [{
      type: 'text',
      text: `Patient first name: ${patient.name.split(' ')[0]}. Amount overdue: R$ ${amount.toFixed(2)}.`
    }] }],
    providerOptions: { gateway: { zeroDataRetention: true } },
  })
  return text
}

// NEVER let the LLM fabricate the payment link (D-04):
// const invoiceUrl = await gateway.getInvoiceUrl(providerChargeId)
// if (!invoiceUrl) skip (don't send a broken link)
// const fullMessage = `${llmText}\n\nLink de pagamento: ${invoiceUrl}`
```

### Anti-Patterns to Avoid

- **Sending PII to the LLM:** Never include CPF, medical_history, allergies, anamnesis_records, or medications in tool results. These are explicitly excluded by D-01.
- **LLM fabricating payment URLs:** AI-03 must call `gateway.getInvoiceUrl(chargeId)` and short-circuit if null. Never ask the LLM to generate a payment link.
- **Using `isLoading` in useChat (AI SDK v6):** Removed in v6. Use `status === 'submitted' || status === 'streaming'`.
- **Using `handleSubmit`/`handleInputChange` (AI SDK v6):** These are v4 API. v6 uses `sendMessage({text})` with own controlled input state.
- **Using `maxSteps` in streamText:** Removed in v6. Use `stopWhen: stepCountIs(N)`.
- **Using `convertToCoreMessages`:** Renamed to `convertToModelMessages` in v6.
- **Reading `AI_GATEWAY_API_KEY` at module scope:** Throws during `next build`. Read inside POST handler body (same pattern as WHATSAPP_*, getResend()).
- **Raw body lost before HMAC validation:** Must call `request.text()` BEFORE `JSON.parse()`. If `request.json()` is called first, the raw body is consumed and HMAC will fail.
- **Calling `useChat` without `@ai-sdk/react` import:** In AI SDK v6, `@ai-sdk/react` is the correct import, NOT `ai/react`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM streaming to browser | Custom SSE/WebSocket | AI SDK `streamText` → `toUIMessageStreamResponse()` + `useChat` | Handles token buffering, back-pressure, reconnect, message parts |
| Provider routing + fallback | Custom fetch to Anthropic | Vercel AI Gateway (model string + `AI_GATEWAY_API_KEY`) | Built-in fallback, observability, ZDR enforcement, 100+ providers |
| HMAC-SHA256 signature validation | Custom crypto | Node.js built-in `crypto.createHmac` + `timingSafeEqual` | Already available; timing-safe comparison is non-trivial |
| Message deduplication | Custom bloom filter | UNIQUE constraint on WhatsApp message ID (same as `webhook_events` pattern) | DB handles concurrent dedup correctly |
| Tool schema validation | Manual JSON parsing | Zod `parameters` in `tool()` | AI SDK validates model-generated args before calling execute |
| Message queuing for AI-02/03 | New queue | Phase 4 `OutboxQueue` / `getOutboxQueue` + `drainOutbox` | Already implemented, tested, production-ready |
| LLM as payment link source | Ask LLM to provide URL | `gateway.getInvoiceUrl(chargeId)` (Phase 3 AsaasAdapter) | LLM hallucinates URLs; only real API calls are safe |
| Tenant isolation in tools | Manual filtering | `createClient()` with user session — RLS auto-filters | DB enforces isolation; no application-level filter needed |

---

## Data Model

### New Table: `agent_outreach_log`

Required for AI-02/03 audit trail and the `/clinica/ia/agentes` UI page (UI-SPEC §AgentOutreachLog).

```sql
-- supabase/migrations/20260610000100_agent_outreach_log.sql
CREATE TABLE public.agent_outreach_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id),
  agent_type   TEXT NOT NULL CHECK (agent_type IN ('confirmation', 'collection')),
  patient_id   UUID REFERENCES public.patients(id),       -- nullable for audit-only rows
  appointment_id UUID REFERENCES public.appointments(id), -- AI-02 only
  receivable_id  UUID REFERENCES public.receivables(id),  -- AI-03 only
  status       TEXT NOT NULL DEFAULT 'sent'
               CHECK (status IN ('sent', 'delivered', 'responded', 'failed', 'ambiguous')),
  whatsapp_message_id TEXT,    -- Meta wamid for dedup + status tracking
  intent_result TEXT,          -- AI-02: 'confirm' | 'cancel' | 'ambiguous'
  error_message TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for UI query (last 20 per tenant, newest first)
CREATE INDEX idx_agent_outreach_log_tenant_created
  ON public.agent_outreach_log(tenant_id, created_at DESC);
```

**RLS policies (same pattern as Phase 3/4):**
```sql
-- 20260610000200_agent_outreach_log_rls.sql
ALTER TABLE public.agent_outreach_log ENABLE ROW LEVEL SECURITY;

-- Admins + dentists can read their tenant's log
CREATE POLICY "Tenant members read agent_outreach_log"
  ON public.agent_outreach_log FOR SELECT
  USING (tenant_id = get_my_tenant_id());

-- No client INSERT/UPDATE/DELETE — only service role (cron/webhook)
-- Same pattern as message_outbox (Phase 4 decision)
```

### WhatsApp Webhook Dedup Table

Option A (recommended): Reuse `webhook_events` table (already exists from Phase 3) with a new `source` column — but its schema is Asaas-specific (`asaas_event_id`). Option B (cleaner): Add a new `whatsapp_inbound_events` table.

**Recommendation — new table for clean separation:**
```sql
-- 20260610000300_whatsapp_inbound_events.sql
CREATE TABLE public.whatsapp_inbound_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid        TEXT UNIQUE NOT NULL,   -- messages[0].id, e.g. "wamid.xxx"
  from_phone   TEXT NOT NULL,
  payload      JSONB NOT NULL,
  processed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- No RLS — service-role only (same as webhook_events decision from Phase 3)
-- UNIQUE(wamid) provides the dedup constraint
```

### No Persistent Conversation Storage

Per UI-SPEC: "Limpar conversa" clears in-memory only. The copilot is **stateless** — no conversation history table needed. Each POST to `/api/copilot` carries the full conversation as `UIMessage[]` in the request body (standard AI SDK pattern). History is held in the `useChat` hook's client state only.

---

## Common Pitfalls

### Pitfall 1: AI SDK v6 `useChat` Breaking Changes vs v4/v5
**What goes wrong:** Using `handleSubmit`, `handleInputChange`, or `isLoading` from v4 — they do not exist in v6. TypeScript will catch missing properties but may not catch renamed ones.
**Why it happens:** AI SDK had significant breaking changes: v5 (AI SDK 5.0 = npm `ai@5.x`) and v6 (npm `ai@6.x`). Many tutorials still show v4 API.
**How to avoid:** Install `ai@^6` and `@ai-sdk/react@^3`. Import from `@ai-sdk/react`, not `ai/react`. Use `sendMessage({text})`, `status`, own `useState` for input.
**Warning signs:** TypeScript error `Property 'handleSubmit' does not exist`, `Property 'isLoading' does not exist`.

### Pitfall 2: `AI_GATEWAY_API_KEY` at Module Scope
**What goes wrong:** `const key = process.env.AI_GATEWAY_API_KEY` at module top level — throws during `next build` static analysis if var absent.
**Why it happens:** Same as WHATSAPP_* and Resend (already solved in Phases 3/4).
**How to avoid:** Read inside the POST handler body (`const apiKey = process.env.AI_GATEWAY_API_KEY`). Return 503 if absent.

### Pitfall 3: Raw Body Consumed Before HMAC Validation
**What goes wrong:** `const body = await request.json()` before the HMAC check — after `.json()` the body stream is exhausted; calling `.text()` after returns empty string, HMAC always fails.
**Why it happens:** Next.js Request body is a ReadableStream — can only be consumed once.
**How to avoid:** Always call `request.text()` FIRST to get rawBody, then `JSON.parse(rawBody)` for the object.

### Pitfall 4: LLM Fabricates Payment Link
**What goes wrong:** System prompt says "include payment link" without explicit constraint — LLM may generate a plausible but fake URL.
**Why it happens:** LLMs complete text patterns; if the expected format is `asaas.com/i/XXX`, the model may hallucinate one.
**How to avoid:** Server-side code calls `gateway.getInvoiceUrl(chargeId)` and injects the real URL AFTER the LLM generates the message text. If `getInvoiceUrl` returns null, abort the send.

### Pitfall 5: Inbound Webhook Missing `WHATSAPP_APP_SECRET`
**What goes wrong:** `WHATSAPP_APP_SECRET` not set in Vercel env — HMAC validation always fails (returns 403 to Meta), Meta stops delivering messages.
**Why it happens:** Phase 4 only required WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN + WHATSAPP_BUSINESS_ACCOUNT_ID. AI-02 adds two new env vars: `WHATSAPP_APP_SECRET` (Meta app secret for HMAC) + `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (any secret string set in Meta dashboard).
**How to avoid:** Add both to `.env.local.example` and Vercel env vars. Document in Wave 0.

### Pitfall 6: `tool()` Parameters vs `inputSchema` Naming
**What goes wrong:** Using `inputSchema:` instead of `parameters:` (or vice versa) in `tool()` — TypeScript error or silent runtime failure.
**Why it happens:** AI SDK v5 migration guide mentions `parameters → inputSchema`. But Vercel AI Gateway docs and the live npm package for `ai@6.x` show `parameters`. The migration was partial — `parameters` is still the correct key for tool schemas in the version available at the gateway.
**How to avoid:** Use `parameters: z.object({...})` in tool definitions. Confirmed from official Vercel AI Gateway tool calling code example. [VERIFIED: vercel.com/docs/ai-gateway/sdks-and-apis/ai-sdk]

### Pitfall 7: `stopWhen` vs `maxSteps`
**What goes wrong:** Using `maxSteps: 5` in `streamText` — property does not exist in AI SDK v6; silently ignored or TypeScript error.
**Why it happens:** AI SDK v6 replaced `maxSteps` with `stopWhen: stepCountIs(N)`.
**How to avoid:** Import `stepCountIs` from `'ai'` and use `stopWhen: stepCountIs(5)`.

### Pitfall 8: Status Update Race on AI-02
**What goes wrong:** Two concurrent inbound webhooks for the same appointment (Meta may retry) both update `appointments.status` — potential double-write.
**Why it happens:** Meta webhook delivery is at-least-once.
**How to avoid:** Insert into `whatsapp_inbound_events` first with UNIQUE(wamid) — 23505 conflict = already processed, skip. Only proceed to status update after successful insert. Same pattern as Phase 3 Asaas webhook.

### Pitfall 9: `useChat` Requires `@ai-sdk/react` NOT `ai`
**What goes wrong:** `import { useChat } from 'ai'` — not found in AI SDK v6 (moved to separate package).
**Why it happens:** AI SDK v6 restructured packages. `ai` contains core server-side. `@ai-sdk/react` contains React hooks.
**How to avoid:** `import { useChat } from '@ai-sdk/react'`

### Pitfall 10: PII Leaks via `searchHelpDocs` Tool Input
**What goes wrong:** User asks "help me with patient João Silva CPF 123.456.789-00" — the user's message (containing PII) is sent to the LLM and tool input.
**Why it happens:** The user typed PII into the chat; the system can't prevent the user from doing this.
**How to avoid:** System prompt instructs the model to respond to health/PII mentions with a privacy reminder and NOT to repeat them in responses. Tools are read-only and don't log their inputs. The D-01 masking is on the OUTPUT side (tool results to model); the user input direction is harder to control. Document this known limitation. The ZDR providerOption ensures the Gateway doesn't retain the prompt at all.

---

## Code Examples

### Complete Route Handler (AI-01)

```typescript
// Source: vercel.com/docs/ai-gateway/sdks-and-apis/ai-sdk (verified 2026-06-10)
// Source: vercel.com/docs/ai-gateway/capabilities/zdr (verified 2026-06-10)
// src/app/api/copilot/route.ts
import 'server-only'
import { streamText, tool, UIMessage, convertToModelMessages, stepCountIs } from 'ai'
import type { GatewayProviderOptions } from '@ai-sdk/gateway'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getTodayAppointments, getOverdueReceivables, searchHelpDocs } from '@/lib/ai/tools'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `Você é o Copiloto FYNXIA, assistente de IA para uma clínica odontológica.
Você responde perguntas sobre os dados da clínica (usando as ferramentas disponíveis) e também
ajuda com dúvidas de como usar o sistema FYNXIA.
IMPORTANTE: Você é READ-ONLY. Não execute ações de escrita. Para ações, oriente o usuário
a usar a interface do sistema diretamente.
PRIVACIDADE: Nunca mencione dados de saúde sensíveis, números de CPF completos, ou
informações de prontuário em suas respostas.`

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'AI gateway not configured' }, { status: 503 })
  }

  const { messages }: { messages: UIMessage[] } = await request.json()

  const result = streamText({
    model: 'anthropic/claude-sonnet-4.6',
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      getTodayAppointments,
      getOverdueReceivables,
      searchHelpDocs,
    },
    providerOptions: {
      gateway: {
        zeroDataRetention: true,
      } satisfies GatewayProviderOptions,
    },
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse()
}
```

### WhatsApp HMAC Validator (reusable)

```typescript
// Source: hookdeck.com guide cross-referenced with Meta docs structure
// src/lib/whatsapp/verify-signature.ts
import 'server-only'
import crypto from 'crypto'

export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false
  const provided = signatureHeader.slice(7)
  const computed = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(provided))
  } catch { return false }
}
```

### Inbound Payload TypeScript Types

```typescript
// Source: verified payload shape from Meta webhook documentation structure [MEDIUM confidence]
// src/lib/whatsapp/inbound-types.ts

export interface WhatsAppInboundPayload {
  object: 'whatsapp_business_account'
  entry: Array<{
    id: string
    changes: Array<{
      field: 'messages'
      value: {
        messaging_product: 'whatsapp'
        metadata: { display_phone_number: string; phone_number_id: string }
        messages?: WhatsAppInboundMessage[]
        statuses?: WhatsAppStatusUpdate[]
      }
    }>
  }>
}

export type WhatsAppInboundMessage =
  | { id: string; from: string; timestamp: string; type: 'text'; text: { body: string } }
  | { id: string; from: string; timestamp: string; type: 'button'; button: { text: string; payload: string } }
  | { id: string; from: string; timestamp: string; type: 'interactive'; interactive: {
      type: 'button_reply'
      button_reply: { id: string; title: string }
    }}

export interface WhatsAppStatusUpdate {
  id: string; status: 'sent' | 'delivered' | 'read' | 'failed'
  recipient_id: string; timestamp: string
}
```

### ZDR Per-Request (D-02)

```typescript
// Source: vercel.com/docs/ai-gateway/capabilities/zdr (verified 2026-06-10)
// Per-request ZDR: no additional cost (vs $0.10/1k for team-wide)
providerOptions: {
  gateway: {
    zeroDataRetention: true,
  } satisfies GatewayProviderOptions,
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `maxSteps` in streamText | `stopWhen: stepCountIs(N)` | AI SDK v6 (2025) | Must update agentic loop code |
| `handleSubmit`/`isLoading` in useChat | `sendMessage({text})`/`status` | AI SDK v5→v6 | Breaking change for UI code |
| `convertToCoreMessages` | `convertToModelMessages` | AI SDK v5 | Import rename |
| `messages[].content` string | `messages[].parts` array | AI SDK v5 | Message rendering must map `.parts` |
| `parameters` in tool() | `parameters` still valid | Verified in v6 examples | `inputSchema` migration guide note may refer to v5 internal — `parameters` confirmed in Vercel docs |
| `ai/react` import | `@ai-sdk/react` package | AI SDK v5 restructure | Separate install required |
| `toDataStreamResponse()` | `toUIMessageStreamResponse()` | AI SDK v6 recommended for useChat | Both work; `toUIMessageStreamResponse()` preferred with useChat v6 |
| WhatsApp template-only | Inbound webhook for replies | Phase 5 (new) | New env vars needed |

**Deprecated/outdated in this codebase context:**
- `@ai-sdk/openai`, `@ai-sdk/anthropic` as explicit providers: Not needed when using Vercel AI Gateway via string model IDs.
- `StreamData` class: Removed in AI SDK v5. Phase 5 does not need it.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tool()` uses `parameters:` key (not `inputSchema:`) in `ai@6.x` | Standard Stack / Pattern 3 | TypeScript compile error on execute fn; easy fix |
| A2 | WhatsApp button reply arrives as `type: 'button'` (not `type: 'interactive'`) for quick-reply template buttons | Pattern 4 / Data Model | AI-02 intent parsing misses button clicks; easy fix once tested with real Meta payload |
| A3 | `whatsapp_inbound_events` table is the cleanest dedup solution vs extending `webhook_events` | Data Model | Minor schema change if planner decides to extend existing table |
| A4 | `zeroDataRetention: true` per-request requires Vercel Pro plan (same as team-wide) | Standard Stack / ZDR | ZDR fails silently or errors if on Hobby plan; need to verify plan tier |

**If table is not empty:** A1 is the highest-risk assumption — if the Vercel/AI SDK v6 `tool()` actually requires `inputSchema`, all tool definitions need a one-line rename. Run `npm install ai@^6` in a test file and check TS types to confirm before plan execution.

---

## Open Questions

1. **Vercel plan tier for ZDR**
   - What we know: Per-request ZDR (`zeroDataRetention: true` in `providerOptions`) has no additional cost per docs; team-wide is $0.10/1k. [VERIFIED: vercel.com/docs/ai-gateway/capabilities/zdr]
   - What's unclear: Whether per-request ZDR requires Vercel Pro plan (team-wide does — "Pro and Enterprise users"). The docs say per-request is available to Pro+Enterprise but the pricing table shows "No additional cost" — ambiguous if Hobby can use it at all.
   - Recommendation: The project is already on Vercel Pro (required for `gru1` region per CLAUDE.md). Non-issue if Pro plan is confirmed.

2. **WhatsApp template button payload value for AI-02**
   - What we know: Button reply messages come as `type: 'button'` with `button.payload` = the payload string set at template registration time.
   - What's unclear: The exact `payload` value format expected — needs to be coordinated with the template registration (Phase 4 outbox). Recommend using `CONFIRM_APPOINTMENT_{appointmentId}` and `CANCEL_APPOINTMENT_{appointmentId}` as payload values.
   - Recommendation: Define payload format during Wave 0 of Phase 5; plan should include template payload design.

3. **`@ai-sdk/gateway` package version alignment**
   - What we know: `@ai-sdk/gateway@3.0.127` provides `GatewayProviderOptions` type.
   - What's unclear: Whether `@ai-sdk/gateway` must be pinned to match `ai@6.0.200` exactly or if `^3` ranges are safe.
   - Recommendation: Use `^3` for all `@ai-sdk/*` packages. If TypeScript errors arise, pin to the exact version installed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js `crypto` | HMAC signature validation | ✓ | Built-in | — |
| `ai` npm package | AI-01, AI-02, AI-03 | ✗ (not yet installed) | — | Must install |
| `@ai-sdk/react` npm package | AI-01 useChat | ✗ (not yet installed) | — | Must install |
| `@ai-sdk/gateway` npm package | AI-01 ZDR types | ✗ (not yet installed) | — | Must install (optional if ZDR typed inline) |
| `AI_GATEWAY_API_KEY` env var | AI-01, AI-02 (LLM calls) | ✗ (not in .env.local) | — | Unit tests mock model; no live AI without key |
| `WHATSAPP_APP_SECRET` env var | AI-02 webhook HMAC | ✗ (new env var) | — | Route returns 403 until configured |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` env var | AI-02 webhook GET verify | ✗ (new env var) | — | GET verify fails until configured |
| Vercel AI Gateway account | Live AI calls | Unverified | — | Unit tests mock model |

**Missing dependencies that block execution (live features):**
- `ai`, `@ai-sdk/react`, `@ai-sdk/gateway` — Wave 0 install step
- `AI_GATEWAY_API_KEY` — must be provisioned before live testing (UAT)
- `WHATSAPP_APP_SECRET` + `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — must be added to Vercel before AI-02 live testing

**Missing dependencies with fallback (unit tests unaffected):**
- All AI and WhatsApp credentials — unit tests mock the model and WhatsApp client; tests run without them

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/__tests__/ai/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-01 | Route handler reads `AI_GATEWAY_API_KEY` at call-time (not module scope) | unit (source inspection) | `npx vitest run src/__tests__/ai/copilot-route.test.ts` | ❌ Wave 0 |
| AI-01 | Route handler has `export const runtime = 'nodejs'` | unit (source inspection) | `npx vitest run src/__tests__/ai/copilot-route.test.ts` | ❌ Wave 0 |
| AI-01 | Tools never select health data columns | unit (source inspection) | `npx vitest run src/__tests__/ai/tools.test.ts` | ❌ Wave 0 |
| AI-01 | PII masking: CPF masked before tool return | unit (function) | `npx vitest run src/__tests__/ai/tools.test.ts` | ❌ Wave 0 |
| AI-01 | PII masking: no medical_history/allergies in tool output | unit (source inspection) | `npx vitest run src/__tests__/ai/tools.test.ts` | ❌ Wave 0 |
| AI-01 | `createClient()` (not `createAdminClient()`) used in copilot tools | unit (source inspection) | `npx vitest run src/__tests__/ai/tools.test.ts` | ❌ Wave 0 |
| AI-02 | GET handler echoes `hub.challenge` when verify_token matches | unit (function) | `npx vitest run src/__tests__/ai/whatsapp-webhook.test.ts` | ❌ Wave 0 |
| AI-02 | GET handler returns 403 on token mismatch | unit (function) | `npx vitest run src/__tests__/ai/whatsapp-webhook.test.ts` | ❌ Wave 0 |
| AI-02 | POST validates X-Hub-Signature-256 before processing | unit (function) | `npx vitest run src/__tests__/ai/whatsapp-webhook.test.ts` | ❌ Wave 0 |
| AI-02 | POST returns 200 immediately (before processing) | unit (function) | `npx vitest run src/__tests__/ai/whatsapp-webhook.test.ts` | ❌ Wave 0 |
| AI-02 | Duplicate wamid (UNIQUE 23505) → idempotent skip | unit (mock DB) | `npx vitest run src/__tests__/ai/whatsapp-webhook.test.ts` | ❌ Wave 0 |
| AI-02 | Button payload 'CONFIRM_*' → status update to 'confirmado' | unit (function) | `npx vitest run src/__tests__/ai/whatsapp-webhook.test.ts` | ❌ Wave 0 |
| AI-02 | Button payload 'CANCEL_*' → status update to 'cancelado' | unit (function) | `npx vitest run src/__tests__/ai/whatsapp-webhook.test.ts` | ❌ Wave 0 |
| AI-02 | LLM intent 'ambiguous' → NO status change, log for review | unit (mock LLM) | `npx vitest run src/__tests__/ai/whatsapp-webhook.test.ts` | ❌ Wave 0 |
| AI-03 | Payment link uses `getInvoiceUrl` (never LLM-generated URL) | unit (source inspection) | `npx vitest run src/__tests__/ai/agents.test.ts` | ❌ Wave 0 |
| AI-03 | `getInvoiceUrl` null → send aborted | unit (function) | `npx vitest run src/__tests__/ai/agents.test.ts` | ❌ Wave 0 |
| AI-03 | Agent enqueues via `getOutboxQueue` (not direct WhatsApp call) | unit (source inspection) | `npx vitest run src/__tests__/ai/agents.test.ts` | ❌ Wave 0 |
| AI-03 | `logBusinessEvent` called after successful enqueue | unit (mock audit) | `npx vitest run src/__tests__/ai/agents.test.ts` | ❌ Wave 0 |
| AI-02/03 | `agent_outreach_log` migration file exists | unit (source inspection) | `npx vitest run src/__tests__/ai/agents.test.ts` | ❌ Wave 0 |
| AI-02/03 | Live WhatsApp delivery | UAT (manual) | — | N/A — deferred (D-04) |
| AI-01 | Live LLM response in sidebar | UAT (manual) | — | N/A — requires `AI_GATEWAY_API_KEY` |

### Sampling Rate

- **Per task commit:** `npx vitest run src/__tests__/ai/`
- **Per wave merge:** `npx vitest run` (full suite — 306 tests currently GREEN)
- **Phase gate:** Full suite green + `npx tsc --noEmit` exit 0 + `npx next build` clean before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/ai/tools.test.ts` — covers PII masking, createClient usage, no health data columns
- [ ] `src/__tests__/ai/copilot-route.test.ts` — covers runtime nodejs, call-time key read, model string
- [ ] `src/__tests__/ai/whatsapp-webhook.test.ts` — covers GET verify, POST HMAC, dedup, status update
- [ ] `src/__tests__/ai/agents.test.ts` — covers AI-03 real link, AI-02 intent, outbox enqueue, audit log
- [ ] Framework install: `npm install ai @ai-sdk/react @ai-sdk/gateway` — if Wave 0 test imports fail

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Route handler calls `supabase.auth.getUser()` before any tool execution; 401 on unauthenticated |
| V3 Session Management | no | Session managed by existing Supabase SSR cookie pattern (Phase 1) |
| V4 Access Control | yes | Tools use `createClient()` RLS — DB-enforced tenant isolation; no cross-tenant data possible |
| V5 Input Validation | yes | Tool `parameters: z.object(...)` validates LLM-generated args before `execute`; user chat input sanitized by being passed as message text, not interpolated into queries |
| V6 Cryptography | yes | WhatsApp HMAC-SHA256: `crypto.createHmac('sha256', secret)` + `timingSafeEqual` — no hand-rolled crypto |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via user input escalating to tool write | Elevation of Privilege | D-05: no write tools registered; tools are RLS-scoped regardless of prompt content |
| Spoofed WhatsApp webhook (fake inbound messages) | Spoofing | HMAC-SHA256 X-Hub-Signature-256 validation using `WHATSAPP_APP_SECRET` before any processing |
| Replay of WhatsApp webhook (duplicate message triggers double status update) | Tampering | UNIQUE(wamid) dedup in `whatsapp_inbound_events` + check before status update |
| LLM hallucinating payment links in AI-03 | Tampering/Denial | Server code ALWAYS calls `gateway.getInvoiceUrl()` and short-circuits on null; LLM only generates message text |
| PII exfiltration to AI provider | Information Disclosure | ZDR `zeroDataRetention: true` + tool results mask CPF and exclude health data before sending to model |
| Cross-tenant tool data access | Information Disclosure | `createClient()` under user session — RLS policies enforce `tenant_id = get_my_tenant_id()` |
| Service role key in NEXT_PUBLIC | Information Disclosure | Tools use `createClient()` (anon key + session); `createAdminClient()` only in webhook/cron (server-only files) |

---

## Project Constraints (from CLAUDE.md)

- **Runtime:** All Route Handlers must have `export const runtime = 'nodejs'` (no Edge — no TCP connections, no `@react-pdf/renderer`, etc.)
- **Secrets:** Never `NEXT_PUBLIC_` for any secret. `AI_GATEWAY_API_KEY`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` are server-only.
- **Supabase clients:** `createClient()` for user-session (RLS) in copilot tools; `createAdminClient()` for webhook handler and cron agents.
- **WhatsApp:** Meta Cloud API only — no Evolution API, no Baileys.
- **Payments:** `gateway.getInvoiceUrl()` from Phase 3 AsaasAdapter — never LLM-generated links.
- **RLS:** Every table with `tenant_id` must have USING + WITH CHECK policies.
- **Credentials:** Read at call-time, never module scope (`AI_GATEWAY_API_KEY`, etc.).
- **Build safety:** `next build` must exit clean; credential reads inside handlers protect build-time.
- **Migrations:** `supabase/migrations/` + `supabase db push` — never dashboard schema changes. Re-auth gotcha: CLI must be logged into FYNXIA org (kczvihafddupruvsrrsc) before `db push`.
- **Testing:** Vitest; full suite `npx vitest run` must pass before phase gate.

---

## Sources

### Primary (HIGH confidence)
- [vercel.com/docs/ai-gateway/sdks-and-apis/ai-sdk](https://vercel.com/docs/ai-gateway/sdks-and-apis/ai-sdk) — AI SDK integration, model string format, installation, tool calling examples (last updated 2026-05-30)
- [vercel.com/docs/ai-gateway/capabilities/zdr](https://vercel.com/docs/ai-gateway/capabilities/zdr) — ZDR pricing, per-request vs team-wide, `providerOptions.gateway.zeroDataRetention` code examples (last updated 2026-05-18)
- [vercel.com/docs/ai-gateway/authentication-and-byok](https://vercel.com/docs/ai-gateway/authentication-and-byok) — `AI_GATEWAY_API_KEY` auto-use, OIDC fallback (last updated 2026-05-30)
- [vercel.com/docs/ai-gateway/models-and-providers/provider-options](https://vercel.com/docs/ai-gateway/models-and-providers/provider-options) — `providerOptions.gateway`, model fallbacks, routing (last updated 2026-06-01)
- [vercel.com/ai-gateway/models/claude-sonnet-4.6](https://vercel.com/ai-gateway/models/claude-sonnet-4.6) — model ID `anthropic/claude-sonnet-4.6`, context window 1M, release 2026-02-17
- [ai-sdk.dev/docs/migration-guides/migration-guide-6-0](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) — v5→v6 breaking changes (ToolLoopAgent, convertToModelMessages, tool helper renames)
- [ai-sdk.dev/docs/migration-guides/migration-guide-5-0](https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0) — v4→v5 breaking changes (useChat transport, sendMessage, status, messages.parts)
- [ai-sdk.dev/docs/getting-started/nextjs-app-router](https://ai-sdk.dev/docs/getting-started/nextjs-app-router) — Route handler + useChat + tool integration for Next.js App Router
- npm registry: `ai@6.0.200`, `@ai-sdk/react@3.0.202`, `@ai-sdk/gateway@3.0.127` [VERIFIED 2026-06-10]

### Secondary (MEDIUM confidence)
- [hookdeck.com/webhooks/platforms/guide-to-whatsapp-webhooks-features-and-best-practices](https://hookdeck.com/webhooks/platforms/guide-to-whatsapp-webhooks-features-and-best-practices) — WhatsApp webhook payload shapes (text, button, interactive), HMAC-SHA256 Node.js example, message ID dedup
- Existing codebase: `src/app/api/webhooks/asaas/route.ts` (Phase 3 webhook pattern); `src/lib/messaging/worker.ts` + `queue.ts` (Phase 4 outbox pattern); `src/lib/asaas/gateway.ts` (getInvoiceUrl)

### Tertiary (LOW confidence — flagged as ASSUMED where used)
- Meta official webhook documentation: Unable to directly fetch payload spec page; structure cross-referenced against hookdeck.com guide and multiple community sources. Final payload shape marked [MEDIUM] in types.

---

## Metadata

**Confidence breakdown:**
- Standard stack (packages + versions): HIGH — npm registry verified
- Vercel AI Gateway integration: HIGH — official Vercel docs verified
- AI SDK v6 API (streamText, tool, useChat): HIGH — official docs + migration guides
- ZDR configuration: HIGH — official Vercel docs with code examples
- WhatsApp inbound payload shape: MEDIUM — hookdeck guide cross-referenced, not from official Meta docs directly
- Architecture patterns: HIGH — based on locked decisions + existing codebase patterns

**Research date:** 2026-06-10
**Valid until:** 2026-09-10 (90 days — AI SDK and Gateway docs are stable; WhatsApp API structure rarely changes)
