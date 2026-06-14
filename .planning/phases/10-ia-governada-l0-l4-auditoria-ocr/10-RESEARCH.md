# Phase 10: IA Governada (L0–L4) + Auditoria + OCR - Research

**Researched:** 2026-06-14
**Domain:** AI governance policy, approval queue, audit UI, OCR via vision model
**Confidence:** HIGH (all key findings verified against installed codebase + AI SDK types)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 IA enforcement:** central `withAgentPolicy()` wrapping agent/tool actions — reads ai_agent_config level (L0–L4) + limits, decides execute/suggest/block, triggers human approval for sensitive actions, logs EVERY decision to `ai_decision_log`. Wraps existing lib/ai/tools + lib/agents.
- **D-02 Approval:** unified `approval_requests` table + inbox UI serving BOTH AIG-02 (sensitive AI action) AND AUD-02 (estorno por alçada): `type`, `payload jsonb`, `required_level/alçada`, `requested_by`, `approver`, `status`, `decided_at`, `reason`.
- **D-03 OCR:** Vercel AI Gateway MULTIMODAL (vision) — upload image/PDF → structured field extraction (zod schema) + per-field confidence; below threshold → human review queue (`ocr_extractions`) before commit. Reuse Phase 5 AI infra (Gateway, ZDR, masking). No new OCR service.
- **D-04 Audit + estorno:** dedicated audit screen over existing `audit_logs` (filter entity/user/period, before/after) + generic estorno (motivo + approval-by-alçada via the unified queue); new `conformidade` RBAC module.

### Claude's Discretion
- Schema/columns/indexes of migrations (`ai_decision_log`, `approval_requests`, `ocr_extractions`); RLS USING+WITH CHECK; index clinic_id.
- Exact form of `withAgentPolicy()` (function wrapper vs tool decorator); what counts as "sensitive action" per level (configurable rule).
- Specific multimodal model via AI Gateway + extraction schema (zod) + default confidence threshold.
- Which pilot OCR form; field mapping; review UI.
- UI: approval inbox, audit screen (filters/diff), OCR upload+review — design system v1, @base-ui render-prop, tokens, pt-BR.
- **Possible split:** phase is large (3 subsystems, 8 reqs) — planner may split into sub-phases (10a IA+approval, 10b Audit+estorno, 10c OCR) if it exceeds plan budget.

### Deferred Ideas (OUT OF SCOPE)
- Concrete reversal per financial entity (Phases 14-16 consume the primitive).
- OCR linked to all forms (start with 1 pilot form).
- New product AI agents (consume the governance framework later).
- Multi-step/advanced escalation approval models.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AIG-01 | Each agent operates within inviolable action limits (configurable caps and locks) | `withAgentPolicy()` reads `ai_agent_config.autonomy_level` + `limits` JSONB. Decision matrix: L0=suggest-only, L1=execute-safe-read, L2=execute-reversible, L3=execute-sensitive+approval, L4=execute-all+log. Enforcement is server-side only. |
| AIG-02 | Sensitive actions always require human approval before executing | `approval_requests` table — agent creates pending row, action payload stored in JSONB, execution resumes only after status='approved'. Idempotency key prevents double-execution. |
| AIG-03 | Every AI decision/action is logged in an auditable log (agent catalog) | New `ai_decision_log` table (INSERT-only RLS, no UPDATE/DELETE). Wraps tool execute() and agent run functions. |
| AUD-01 | Audit trail records who did what, when, from where, before/after content | `audit_logs` (v1) already captures actor_id, action, old_values, new_values JSONB, created_at, ip_address. Exposes via RSC server component with filters. |
| AUD-02 | Reversal requires motivo + alçada approval, recorded in trail | Uses unified `approval_requests` (type='estorno'); on approve: execute reversal action + logBusinessEvent; RLS enforces that only the approver's role meets required_alçada. |
| AUD-03 | Auditor/DPO queries audit trail by entity, user, and period in dedicated screen | New `/conformidade/auditoria` route; RSC page queries `audit_logs` by tenant + optional filters (table_name, actor_id, date range); diff view of old_values vs new_values. |
| OCR-01 | User uploads/photographs a document and AI extracts fields automatically | `generateObject()` with `anthropic/claude-sonnet-4.6` (vision-capable via AI Gateway); message with `FilePart` (base64 or URL); Zod schema defines extracted fields; ZDR=true. |
| OCR-02 | Extractions below confidence threshold require human review before saving | Per-field confidence in extraction schema; rows with any field < threshold written to `ocr_extractions` with status='pending_review'; review UI confirms/edits before persisting to target form. |
</phase_requirements>

---

## Summary

Phase 10 closes the Foundation Block (Bloco A) with three governance subsystems that share one integration point: the unified `approval_requests` table acts as the backbone connecting IA governance (D-01/D-02), estorno workflow (D-04/AUD-02), and OCR human review (D-03/OCR-02). All three subsystems build on existing Phase 5–9 infrastructure — no new third-party services required.

The AI governance layer (`withAgentPolicy()`) is the most architecturally sensitive piece: it must wrap both the AI SDK v6 `tool()` execute functions and the standalone agent runner functions without breaking the existing copilot streaming. The correct pattern is manual execute-wrapper on each tool object (not `wrapLanguageModel` middleware, which operates at the LLM call level rather than the tool-execution level). For the agents (confirmation-agent, collection-agent), governance wraps the public runner function before any external side effects occur.

OCR uses `generateObject()` with a `FilePart` (base64/URL) message part — the same gateway/ZDR/masking infrastructure from Phase 5. The confidence-threshold gating stores extractions in `ocr_extractions` and surfaces a review UI before any form field is committed.

The audit screen is essentially a filtered RSC query over `audit_logs` (v1, partitioned by month) with JSON diff rendering — the table and indexing already exist and are optimized for tenant+time queries. Estorno is a Server Action that creates an `approval_requests` row then executes the reversal upon approval.

**Primary recommendation:** Split into 10a (AI governance + approval queue) and 10b (audit screen + estorno + OCR) for manageable wave size — the subsystems are loosely coupled after the `approval_requests` table exists.

---

## Standard Stack

### Core (verified against package.json and node_modules)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | 6.0.200 | `generateObject`, `generateText`, `streamText`, `wrapLanguageModel`, `tool` | Already installed; AI SDK v6 is the Phase 5 pattern |
| `@ai-sdk/gateway` | 3.0.127 | Vercel AI Gateway provider with ZDR; vision models accessible as language models | Already installed; ZDR required for LGPD; multimodal via `FilePart` |
| `zod` | ^3.25.76 | Extraction schema for `generateObject`; approval request validation | Already installed; v3 branch (v4 has RHF compat issues — CLAUDE.md) |
| `@supabase/supabase-js` | ^2.107.0 | Supabase client for new tables | Already installed |
| `react-hook-form` | ^7.77.0 | Approval/review UI forms | Already installed |

[VERIFIED: package.json]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-table` | ^8.21.3 | Audit log table with sort/filter | Audit screen paginated table |
| `nuqs` | ^2.8.9 | URL-based filter state (entity, user, date range) | Audit screen — bookmarkable queries |
| `date-fns` | ^4.4.0 | Date range formatting for audit queries | Already installed |
| `lucide-react` | ^1.17.0 | Icons for status badges (pending/approved/rejected) | Design system v1 |

[VERIFIED: package.json]

### No New Dependencies Required

All Phase 10 functionality is achievable with the currently installed stack. The vision/multimodal capability is already available via `@ai-sdk/gateway` (Claude Sonnet 4.6 supports vision), and `FilePart` / `ImagePart` types are exported from `@ai-sdk/provider-utils`.

[VERIFIED: node_modules/@ai-sdk/gateway/dist/index.d.ts — `anthropic/claude-sonnet-4.6` in GatewayModelId; node_modules/@ai-sdk/provider-utils/dist/index.d.ts — `FilePart`, `ImagePart` exports]

---

## Architecture Patterns

### Recommended Project Structure (new files)

```
src/
├── lib/
│   └── ai/
│       └── policy.ts          # withAgentPolicy() — central governance gate
├── actions/
│   ├── approval-actions.ts    # createApprovalRequest, approveRequest, rejectRequest
│   ├── audit-actions.ts       # queryAuditLogs (RSC), createEstorno
│   └── ocr-actions.ts         # extractDocumentFields, confirmOcrExtraction
├── app/
│   ├── api/
│   │   └── ocr/
│   │       └── route.ts       # POST /api/ocr — multipart upload → generateObject
│   └── conformidade/
│       ├── layout.tsx
│       ├── auditoria/
│       │   └── page.tsx       # AUD-03 audit screen (RSC)
│       ├── aprovacoes/
│       │   └── page.tsx       # AIG-02 + AUD-02 approval inbox (RSC)
│       └── ocr/
│           └── page.tsx       # OCR-01 upload + OCR-02 review queue
supabase/
└── migrations/
    ├── 20260616000100_ai_decision_log.sql
    ├── 20260616000200_ai_decision_log_rls.sql
    ├── 20260616000300_approval_requests.sql
    ├── 20260616000400_approval_requests_rls.sql
    ├── 20260616000500_ocr_extractions.sql
    └── 20260616000600_ocr_extractions_rls.sql
src/__tests__/
├── migrations/
│   └── phase10.test.ts        # SQL source-inspection (RED by design)
├── ai/
│   └── policy.test.ts         # Decision matrix L0–L4, unit tests
├── actions/
│   └── approval.test.ts       # Source-inspection: createApprovalRequest, logBusinessEvent
└── ocr/
    └── extract.test.ts        # Mock generateObject, confidence threshold gating
```

### Pattern 1: Tool Execute Wrapper (withAgentPolicy)

**What:** Each AI SDK v6 `tool()` object's `execute` function is replaced by a wrapper that checks `ai_agent_config`, makes a policy decision, inserts into `ai_decision_log`, and either calls the original `execute` or throws/returns a "blocked" sentinel.

**When to use:** Wrapping read-only tools in `lib/ai/tools.ts` (current tools are read-only; at L0/L1 they can execute freely; future write tools at L3/L4 require approval).

**Key insight from codebase inspection:** The existing tools use the AI SDK v6 `tool({ description, inputSchema, execute })` pattern. [VERIFIED: src/lib/ai/tools.ts]. The wrapper intercepts `execute` at the function level — no middleware needed.

```typescript
// src/lib/ai/policy.ts
// Source: AI SDK v6 tool() pattern from src/lib/ai/tools.ts + ai_agent_config schema
import 'server-only'
import type { Tool } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { logBusinessEvent } from '@/lib/audit'

export type PolicyDecision = 'execute' | 'suggest' | 'block' | 'pending_approval'

export interface PolicyContext {
  clinicId: string
  agentKey: string
  actorId: string | null
  action: string
  actionSensitivity: 'safe' | 'reversible' | 'sensitive'
}

// Decision matrix — maps L0–L4 + sensitivity → decision
// L0: suggest only; L1: execute safe; L2: execute reversible; L3: sensitive→approval;
// L4: all execute (still logged)
export function computePolicyDecision(
  level: string,
  sensitivity: 'safe' | 'reversible' | 'sensitive',
): PolicyDecision {
  if (level === 'L0') return 'suggest'
  if (level === 'L1') return sensitivity === 'safe' ? 'execute' : 'suggest'
  if (level === 'L2') return sensitivity === 'sensitive' ? 'pending_approval' : 'execute'
  if (level === 'L3') return sensitivity === 'sensitive' ? 'pending_approval' : 'execute'
  if (level === 'L4') return 'execute' // L4 executes all but still logs
  return 'block'
}

export async function withAgentPolicy<TInput, TOutput>(
  ctx: PolicyContext,
  originalExecute: (input: TInput) => Promise<TOutput>,
): Promise<TOutput | { _policy: PolicyDecision; reason: string }> {
  const admin = createAdminClient()

  // 1. Read current level from ai_agent_config
  const { data: config } = await admin
    .from('ai_agent_config')
    .select('autonomy_level, enabled, limits')
    .eq('clinic_id', ctx.clinicId)
    .eq('agent_key', ctx.agentKey)
    .is('unit_id', null)
    .single()

  const level = config?.autonomy_level ?? 'L0'
  const enabled = config?.enabled ?? false

  const decision = !enabled
    ? ('block' as PolicyDecision)
    : computePolicyDecision(level, ctx.actionSensitivity)

  // 2. Log the decision (AIG-03)
  await admin.from('ai_decision_log').insert({
    clinic_id: ctx.clinicId,
    agent_key: ctx.agentKey,
    action: ctx.action,
    autonomy_level: level,
    decision,
    actor_id: ctx.actorId,
    reason: `level=${level} sensitivity=${ctx.actionSensitivity} enabled=${enabled}`,
  })

  // 3. Act on decision
  if (decision === 'execute') {
    return originalExecute(ctx as unknown as TInput)
  }
  if (decision === 'pending_approval') {
    // Caller creates approval_request row separately with payload
    return { _policy: 'pending_approval', reason: `Requer aprovação (${level})` }
  }
  return { _policy: decision, reason: `Bloqueado: ${decision} (${level})` }
}
```

[ASSUMED — exact function signature; verified types from AI SDK + Supabase client patterns]

### Pattern 2: AI Gateway Multimodal OCR with generateObject

**What:** POST /api/ocr route (nodejs runtime) receives multipart file, converts to base64, calls `generateObject()` with a FilePart and Zod schema for structured extraction + per-field confidence.

**Key facts verified:**
- `FilePart` type exists in `@ai-sdk/provider-utils` and is used in user message content [VERIFIED: node_modules/@ai-sdk/provider-utils/dist/index.d.ts]
- `anthropic/claude-sonnet-4.6` is a valid GatewayModelId [VERIFIED: node_modules/@ai-sdk/gateway/dist/index.d.ts]
- `generateObject()` is exported from `ai` v6 [VERIFIED: node_modules/ai/dist/index.d.ts]
- `ImagePart` (type: 'image') and `FilePart` (type: 'file') both available
- Route must be `export const runtime = 'nodejs'` — same as copilot/route.ts [VERIFIED: src/app/api/copilot/route.ts]

```typescript
// src/app/api/ocr/route.ts
// Source: Pattern from src/app/api/copilot/route.ts + @ai-sdk/provider-utils types
import 'server-only'
export const runtime = 'nodejs'

import { generateObject } from 'ai'
import type { GatewayProviderOptions } from '@ai-sdk/gateway'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { maskCPF } from '@/lib/ai/masking'

// Zod schema: each field has value + confidence (0–1)
const PatientDocumentSchema = z.object({
  full_name: z.object({ value: z.string(), confidence: z.number().min(0).max(1) }),
  cpf: z.object({ value: z.string(), confidence: z.number().min(0).max(1) }),
  birth_date: z.object({ value: z.string(), confidence: z.number().min(0).max(1) }),
  address: z.object({ value: z.string(), confidence: z.number().min(0).max(1) }),
})

const CONFIDENCE_THRESHOLD = 0.80 // below this → human review queue

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = file.type || 'image/jpeg'

  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) return Response.json({ error: 'AI gateway not configured' }, { status: 503 })

  const { object } = await generateObject({
    model: 'anthropic/claude-sonnet-4.6',
    schema: PatientDocumentSchema,
    messages: [{
      role: 'user',
      content: [
        { type: 'file', data: base64, mimeType } as const, // FilePart
        { type: 'text', text: 'Extraia os campos do documento. Para cada campo, forneça o valor e um score de confiança entre 0.0 e 1.0.' },
      ],
    }],
    providerOptions: {
      gateway: { zeroDataRetention: true } satisfies GatewayProviderOptions,
    },
  })

  // Check if any field below threshold
  const needsReview = Object.values(object).some(f => f.confidence < CONFIDENCE_THRESHOLD)

  // Store in ocr_extractions (review queue or ready-to-commit)
  const admin = (await import('@/lib/supabase/admin')).createAdminClient()
  const { data: users } = await admin.from('users')
    .select('tenant_id').eq('id', user.id).single()
  const clinicId = (users as { tenant_id: string })?.tenant_id

  const { data: extraction } = await admin.from('ocr_extractions').insert({
    clinic_id: clinicId,
    created_by: user.id,
    source_filename: file.name,
    extracted_fields: object,
    min_confidence: Math.min(...Object.values(object).map(f => f.confidence)),
    status: needsReview ? 'pending_review' : 'ready',
  }).select('id').single()

  return Response.json({ extractionId: extraction?.id, needsReview, fields: object })
}
```

[ASSUMED — route implementation detail; types from AI SDK v6 verified]

### Pattern 3: wrapLanguageModel Middleware (for AI Decision Log at model level)

**What:** `wrapLanguageModel` + `LanguageModelMiddleware` intercepts at the LLM call level — useful for logging ALL model invocations (not just tool calls). Complements `withAgentPolicy` which intercepts at the tool-execute level.

**When to use:** For AIG-03 completeness — log that a model was called at all, not just tool results. Optional; the tool-level wrapper already covers per-action decisions.

**Verified API:**
```typescript
// Source: wrapLanguageModel from node_modules/ai/dist/index.d.ts
import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai'

const loggingMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v3',
  wrapGenerate: async ({ doGenerate, params }) => {
    const result = await doGenerate()
    // Log model call here (non-blocking)
    return result
  },
}

// Usage:
const wrappedModel = wrapLanguageModel({
  model: 'anthropic/claude-sonnet-4.6', // string modelId is cast via gateway()
  middleware: loggingMiddleware,
})
```

[VERIFIED: wrapLanguageModel signature from node_modules/ai/dist/index.d.ts]

**Note:** `wrapLanguageModel` expects a `LanguageModelV3` instance, not a string. When using the AI Gateway, the model string must first be resolved: `gateway('anthropic/claude-sonnet-4.6')` returns a `LanguageModelV3`. This pattern is separate from the primary `withAgentPolicy` approach (tool execute wrapper), which is simpler and sufficient.

### Pattern 4: Approval Queue — Pause-and-Resume

**What:** When `withAgentPolicy` returns `pending_approval`, the calling code creates an `approval_requests` row with the full intended action payload in JSONB. When an approver acts on the inbox, a Server Action re-executes the stored payload.

**Idempotency:** Each approval_requests row gets an `idempotency_key` (agent_key + action + hash of payload). The execution-on-approve checks for `executed_at IS NOT NULL` before running.

```typescript
// Schema intent for approval_requests (Claude's Discretion on exact columns)
// Created by: withAgentPolicy returning pending_approval
// Consumed by: approvacoes inbox → approve Server Action
{
  id: uuid,
  clinic_id: uuid,                    // tenant scoping
  type: text,                         // 'ai_action' | 'estorno'
  payload: jsonb,                     // full action parameters to re-execute
  agent_key: text | null,             // for AI actions
  required_role: text,                // min role to approve (e.g., 'admin')
  required_level: text | null,        // for alçada checks
  requested_by: uuid,                 // actor who triggered
  approver: uuid | null,              // set on decision
  status: text,                       // 'pending' | 'approved' | 'rejected'
  decided_at: timestamptz | null,
  reason: text | null,                // approver's note
  idempotency_key: text,              // prevents double-execution
  executed_at: timestamptz | null,    // set after payload is executed
  created_at: timestamptz,
}
```

### Pattern 5: Audit Screen (RSC over audit_logs)

**What:** Server Component queries `audit_logs` with nuqs URL filters, renders a table with diff viewer for old_values vs new_values.

**Existing audit_logs shape (verified from migration):**
- `id uuid`, `tenant_id uuid`, `actor_id uuid`, `action text`, `table_name text`, `record_id uuid`, `old_values jsonb`, `new_values jsonb`, `ip_address inet`, `user_agent text`, `created_at timestamptz`
- Table is PARTITIONED BY RANGE (created_at) — monthly partitions
- Indexes: `idx_audit_logs_tenant_created (tenant_id, created_at DESC)` and `idx_audit_logs_actor (actor_id)`
- `table_name` index is MISSING — need to add `idx_audit_logs_table_name (tenant_id, table_name)` in Phase 10 migration for entity filtering (AUD-03)

[VERIFIED: supabase/migrations/20260603000000_initial_schema.sql]

**Filter query pattern:**
```typescript
// RSC page — no 'use client' needed; uses createClient (RLS session)
const { data: logs } = await supabase
  .from('audit_logs')
  .select('id, actor_id, action, table_name, record_id, old_values, new_values, created_at')
  .eq('tenant_id', tenantId)
  .gte('created_at', dateFrom)
  .lte('created_at', dateTo)
  .eq('table_name', entityFilter)  // optional
  .eq('actor_id', userFilter)      // optional
  .order('created_at', { ascending: false })
  .range(offset, offset + PAGE_SIZE - 1)
```

Note: `audit_logs` uses `createAdminClient` for writes (via `logBusinessEvent`) but the audit screen should use `createClient()` with RLS — the audit screen RLS policy must allow SELECT for the conformidade module roles (auditor, dpo, admin, superadmin) within the tenant.

[VERIFIED: src/lib/audit.ts uses createAdminClient for INSERT; pattern from existing code]

### Pattern 6: conformidade Module in Proxy

**What:** Add `conformidade` as a new `ModuleKey` in `proxy.ts` with route mappings and role permissions.

**Existing pattern (verified):**

```typescript
// proxy.ts additions (follow existing MODULE_PERMISSIONS pattern)
// Source: src/proxy.ts verified

// Add to ModuleKey union:
type ModuleKey = ... | 'conformidade'

// Add to ROUTE_MODULE_MAP (most-specific first):
{ prefix: '/conformidade', module: 'conformidade' },

// Add to MODULE_PERMISSIONS:
// auditor: conformidade read-only (their primary module)
// dpo: conformidade read-only
// admin/superadmin: conformidade read-write
// socio: NO access (financial scope, not compliance)
auditor:  { ..., conformidade: { allowed: true, readOnly: true } },
dpo:      { ..., conformidade: { allowed: true, readOnly: true } },
admin:    { ..., conformidade: { allowed: true } },
superadmin: { ..., conformidade: { allowed: true } },
```

[VERIFIED: src/proxy.ts MODULE_PERMISSIONS and ROUTE_MODULE_MAP patterns]

### Anti-Patterns to Avoid

- **Client-side policy check:** `withAgentPolicy()` must run server-side in a Server Action or API route, never in a React component. Client can display the decision outcome but not make it.
- **Skipping `ai_decision_log` on block:** Even blocked decisions must be logged — a gap in the log is evidence of bypass.
- **Using `createClient()` (RLS) for ai_decision_log INSERT:** The policy layer runs in contexts where the actor may be a cron/system process. Use `createAdminClient()` for `ai_decision_log` inserts (same pattern as `logBusinessEvent` in audit.ts). [VERIFIED: src/lib/audit.ts]
- **Resolving approval_requests on the client:** Approve/reject must be a Server Action with `assertNotReadOnly()` + role check (alçada).
- **Sending raw document bytes to LLM without ZDR:** Any OCR call must include `zeroDataRetention: true`. [VERIFIED: src/app/api/copilot/route.ts pattern]
- **CSS Grid in @react-pdf/renderer:** Not supported. Use Flexbox (from CLAUDE.md). Not applicable to Phase 10 UI but noted for review queue if PDF needed.
- **Importing `wrapLanguageModel` for per-tool governance:** wrapLanguageModel works at the LLM call level, not per-tool-execute. Use the tool execute wrapper pattern for action-level control.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multimodal OCR service | Custom OCR pipeline | `generateObject()` with `FilePart` via AI Gateway | Already available; ZDR-compliant; vision models (Claude Sonnet 4.6) handle document images |
| Per-field confidence scoring | Heuristic character-level scoring | Zod schema with `confidence` field asked from model | Model self-reports confidence; no separate scorer needed |
| Approval state machine | Custom state table + triggers | `approval_requests` table with status enum | Simple, auditable, SQL-native; no saga/event-sourcing complexity needed at this scale |
| AI call logging | Manual console.log | `ai_decision_log` table (INSERT-only RLS) | Immutable, queryable, tenant-scoped — same pattern as audit_logs |
| Audit diff computation | Client-side JSON diff library | JSON diff rendered from stored `old_values`/`new_values` JSONB | Database already stores before/after; diff is a display concern, not a storage concern |
| New OCR model/vendor | Tesseract, AWS Textract, Google Vision | AI Gateway multimodal | Zero new dependencies, ZDR, same API key, LGPD-compliant |

---

## Database Schema Design

### New Tables (Claude's Discretion on exact columns — these are recommended designs)

#### ai_decision_log

```sql
-- INSERT-only (no UPDATE/DELETE policy — immutable like audit_logs)
-- Partitioned by month like audit_logs for long-term performance
CREATE TABLE public.ai_decision_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL,                -- no FK — immutable log survives tenant delete
  agent_key       TEXT        NOT NULL,                -- 'confirmation', 'collection', 'ocr', etc.
  action          TEXT        NOT NULL,                -- specific action attempted
  autonomy_level  TEXT        NOT NULL,                -- L0–L4 at time of decision
  decision        TEXT        NOT NULL
                  CHECK (decision IN ('execute','suggest','block','pending_approval')),
  actor_id        UUID,                                -- NULL for cron/system
  reason          TEXT,                                -- human-readable explanation
  payload         JSONB,                               -- optional: sanitized action input (no PII)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_decision_log_clinic_created ON public.ai_decision_log(clinic_id, created_at DESC);
CREATE INDEX idx_ai_decision_log_agent ON public.ai_decision_log(clinic_id, agent_key);

-- RLS: SELECT for tenant; NO client INSERT (service-role only via createAdminClient)
ALTER TABLE public.ai_decision_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_decision_log_tenant_read" ON public.ai_decision_log
  FOR SELECT USING (clinic_id = get_my_tenant_id());
-- No INSERT/UPDATE/DELETE client policy (createAdminClient writes)
```

#### approval_requests

```sql
CREATE TABLE public.approval_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  type              TEXT        NOT NULL CHECK (type IN ('ai_action', 'estorno')),
  payload           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  agent_key         TEXT,                              -- for type='ai_action'
  required_role     TEXT        NOT NULL DEFAULT 'admin',  -- alçada
  requested_by      UUID        NOT NULL REFERENCES public.users(id),
  approver          UUID        REFERENCES public.users(id),
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  decided_at        TIMESTAMPTZ,
  reason            TEXT,
  idempotency_key   TEXT,                              -- unique per (clinic_id, idempotency_key)
  executed_at       TIMESTAMPTZ,                       -- set after payload execution
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_requests_clinic ON public.approval_requests(clinic_id);
CREATE INDEX idx_approval_requests_status ON public.approval_requests(clinic_id, status);
CREATE UNIQUE INDEX uq_approval_requests_idempotency
  ON public.approval_requests(clinic_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
-- Tenant members read their pending/resolved requests
CREATE POLICY "approval_requests_tenant_read" ON public.approval_requests
  FOR SELECT USING (clinic_id = get_my_tenant_id());
-- Only the requester or roles with required_role can write (INSERT via createClient for requests)
-- Approve/reject goes through Server Action with role check
CREATE POLICY "approval_requests_requester_insert" ON public.approval_requests
  FOR INSERT WITH CHECK (clinic_id = get_my_tenant_id());
-- Updates (approve/reject) only — enforced at Server Action level via role check
CREATE POLICY "approval_requests_admin_update" ON public.approval_requests
  FOR UPDATE USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );
```

#### ocr_extractions

```sql
CREATE TABLE public.ocr_extractions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_by        UUID        NOT NULL REFERENCES public.users(id),
  source_filename   TEXT,
  extracted_fields  JSONB       NOT NULL,              -- {field: {value, confidence}}
  min_confidence    NUMERIC(4,3) NOT NULL,             -- min across all fields
  status            TEXT        NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN ('pending_review', 'approved', 'committed', 'rejected')),
  reviewed_by       UUID        REFERENCES public.users(id),
  reviewed_at       TIMESTAMPTZ,
  target_table      TEXT,                              -- e.g., 'patients' (pilot form)
  target_id         UUID,                              -- set after commit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ocr_extractions_clinic ON public.ocr_extractions(clinic_id);
CREATE INDEX idx_ocr_extractions_status ON public.ocr_extractions(clinic_id, status);

ALTER TABLE public.ocr_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ocr_extractions_tenant_read" ON public.ocr_extractions
  FOR SELECT USING (clinic_id = get_my_tenant_id());
CREATE POLICY "ocr_extractions_tenant_write" ON public.ocr_extractions
  FOR ALL
  USING (clinic_id = get_my_tenant_id())
  WITH CHECK (clinic_id = get_my_tenant_id());
```

#### audit_logs — missing index (must add)

```sql
-- AUD-03: entity/table_name filter currently lacks an index
-- Add in Phase 10 migration alongside ai_decision_log
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name
  ON public.audit_logs(tenant_id, table_name);
```

[VERIFIED: supabase/migrations/20260603000000_initial_schema.sql — no idx on table_name]

---

## Common Pitfalls

### Pitfall 1: Governance Bypass via Client-Side Level Check
**What goes wrong:** Policy check happens in a React component (reads ai_agent_config via TanStack Query) — user can spoof the level in dev tools.
**Why it happens:** Copy-paste from the config UI pattern.
**How to avoid:** `withAgentPolicy()` is `import 'server-only'`. Never import in client components. The `src/lib/ai/policy.ts` file MUST start with `import 'server-only'`. [VERIFIED: src/lib/ai/tools.ts, src/lib/agents/confirmation-agent.ts all use `import 'server-only'`]
**Warning signs:** Any import of `withAgentPolicy` in a file without `'use server'` directive.

### Pitfall 2: Approval Replay / Double Execution
**What goes wrong:** Approver clicks "Approve" twice quickly; action executes twice (e.g., two estornos).
**Why it happens:** No idempotency guard; two concurrent Server Action calls both read `status='pending'`.
**How to avoid:** Server Action uses a database UPDATE with `WHERE status = 'pending' AND executed_at IS NULL` and checks affected rows. Also use `idempotency_key` unique index. Pattern from collection-agent outbox.
**Warning signs:** `executed_at` column is NULL on approved rows — means execution wasn't tracked.

### Pitfall 3: PII in ai_decision_log payload
**What goes wrong:** Agent logs patient CPF or full document content in the `payload` column.
**Why it happens:** Naively serializing the full action input to the log.
**How to avoid:** Apply masking before inserting into `payload`. Use `maskCPF`, `maskPhone` from `lib/ai/masking.ts` on any patient fields. Alternatively, log only action type + record IDs, not field values. [VERIFIED: src/lib/ai/masking.ts]
**Warning signs:** JSONB `payload` contains a string matching CPF format `\d{3}\.\d{3}\.\d{3}-\d{2}`.

### Pitfall 4: PII Sent to Vision Model Without ZDR
**What goes wrong:** OCR uploads patient RG/CPF documents to Claude Sonnet via Gateway without `zeroDataRetention: true` — violates LGPD.
**Why it happens:** Forget to include `providerOptions` in `generateObject()` call.
**How to avoid:** Always include `providerOptions: { gateway: { zeroDataRetention: true } satisfies GatewayProviderOptions }` in every Gateway call. Enforce via source-inspection test. [VERIFIED: src/app/api/copilot/route.ts, src/lib/agents/collection-agent.ts both include ZDR]
**Warning signs:** Any `generateObject` or `generateText` call to gateway model without `zeroDataRetention: true`.

### Pitfall 5: Breaking the Existing Copilot Stream
**What goes wrong:** Phase 10 wraps `lib/ai/tools.ts` with `withAgentPolicy` — if the wrapper throws synchronously or changes the return type, the streaming copilot breaks.
**Why it happens:** The AI SDK v6 `tool()` execute must return the declared output type, not a union with `_policy` sentinel.
**How to avoid:** The wrapper returns either the original output (when executing) or a structured `{ _policy, reason }` object that the LLM can interpret as a "blocked" message. The LLM then responds to the user explaining the block. The outer streaming call doesn't break; it just gets a different tool result.
**Warning signs:** `TypeError: Cannot read property of undefined` in streaming response; `_policy` key appears in UI.

### Pitfall 6: audit_logs Partitioned Table + Missing Partition
**What goes wrong:** Query to `audit_logs` in AUD-03 returns no results for months where no partition exists (partition only created for 2026-06).
**Why it happens:** Phase 0 created only `audit_logs_2026_06`. Future months need new partitions.
**How to avoid:** Phase 10 migration creates partitions for 2026-07, 2026-08. Document that a pg_cron job (Phase 4+) should auto-create monthly partitions. [VERIFIED: supabase/migrations/20260603000000_initial_schema.sql — only 2026-06 partition]
**Warning signs:** INSERT into audit_logs fails for a date outside existing partition range.

### Pitfall 7: wrapLanguageModel Gateway String vs LanguageModelV3 Instance
**What goes wrong:** Passing a string to `wrapLanguageModel({ model: 'anthropic/claude-sonnet-4.6' })` — type error at runtime.
**Why it happens:** The gateway exposes models as strings in the `GatewayModelId` union but the function requires a `LanguageModelV3` instance.
**How to avoid:** Use `gateway('anthropic/claude-sonnet-4.6')` to get the instance, then pass it to `wrapLanguageModel`. Or skip `wrapLanguageModel` entirely and use the tool-execute wrapper pattern (simpler, no model-level concern). [VERIFIED: @ai-sdk/gateway exports `gateway` function; wrapLanguageModel signature from ai/dist/index.d.ts]
**Warning signs:** TypeScript error "Type 'string' is not assignable to type 'LanguageModelV3'".

### Pitfall 8: Supabase Re-Auth Before db push
**What goes wrong:** `supabase db push` runs against the wrong project (nexus-* org) and pushes to the wrong database.
**Why it happens:** CLI caches the wrong org. MEMORY.md documents this as a known gotcha.
**How to avoid:** Before every `supabase db push`: `supabase login` → re-auth for project jqjwyqlbbuqnrffdnlpp (org kczvihafddupruvsrrsc, sa-east-1). Then `supabase db push --project-ref jqjwyqlbbuqnrffdnlpp`. [CITED: MEMORY.md project_fynxia_supabase_account.md]
**Warning signs:** `supabase db push` completes too quickly or shows wrong project name in output.

### Pitfall 9: gen types temp-file guard
**What goes wrong:** `supabase gen types typescript` writes to a temp file, then tsc sees a partial write mid-build and throws.
**Why it happens:** Vercel build runs gen types and build concurrently.
**How to avoid:** Per CLAUDE.md convention — generate to a temp file first, then move atomically: `supabase gen types typescript --project-id jqjwyqlbbuqnrffdnlpp > src/types/database.types.t && mv src/types/database.types.t src/types/database.types.ts`.
**Warning signs:** TypeScript build errors referencing `database.types.ts` with `Expected ',' but got EOF`.

### Pitfall 10: `audit_logs` RLS Allows Client INSERT
**What goes wrong:** Client code accidentally calls `.from('audit_logs').insert(...)` via `createClient()` — bypassing the service-role-only write pattern.
**Why it happens:** Developer uses createClient() for everything.
**How to avoid:** `audit_logs` INSERT is always via `createAdminClient()` inside `logBusinessEvent()`. The RLS policy for `audit_logs` has no INSERT policy for authenticated/anon. [VERIFIED: src/lib/audit.ts, supabase/migrations/20260603000000_initial_schema.sql — no INSERT RLS policy shown]

---

## AI SDK v6 Tool Wrapping — Definitive Answer

**Question:** Is there an AI SDK middleware/`experimental_` hook, or do we wrap execute manually?

**Answer (verified against installed SDK):**

There are TWO distinct wrapping mechanisms in AI SDK v6, serving different purposes:

1. **`wrapLanguageModel` + `LanguageModelMiddleware`** [VERIFIED: node_modules/ai/dist/index.d.ts] — Intercepts at the **LLM call level**. `wrapGenerate` and `wrapStream` hooks execute around the full model call. Also has `transformParams` for mutating the call parameters. Use this for cross-cutting concerns like logging all model calls.

2. **Tool execute wrapper** (manual) — The AI SDK does NOT provide a per-tool middleware API. The `execute` function in `tool({ execute })` is a plain async function. To add governance, replace `execute` with a wrapped version. This is the canonical approach for action-level control.

Additionally, `generateText` and `streamText` expose `experimental_onToolCallStart` and `experimental_onToolCallFinish` callbacks [VERIFIED: node_modules/ai/dist/index.d.ts] — these are observation hooks (can log), not control hooks (cannot block execution).

**Conclusion:** For `withAgentPolicy()`, use the **tool execute wrapper** pattern (Pattern 1 above). It wraps `execute` directly in each tool object. For the agents (`confirmation-agent`, `collection-agent`), governance wraps the public runner functions (`runConfirmationAgent`, `runCollectionAgent`) at the call site (cron routes), before any external effects.

[VERIFIED: AI SDK v6 types + src/lib/ai/tools.ts + src/lib/agents/]

---

## OCR — Multimodal Confidence Strategy

**Question:** How to derive per-field confidence (model-reported vs heuristic)?

**Answer:** The AI SDK v6 `generateObject()` with a Zod schema that includes a `confidence` numeric field per extracted value. The vision model (Claude Sonnet 4.6) self-reports confidence. This is the simplest approach — the model is prompted to provide confidence scores alongside values.

**Alternative (if model-reported confidence is unreliable):** Add a second `generateObject()` call that asks the model to verify its own output field by field. [ASSUMED — no official docs verifying this pattern; LOW confidence for this alternative]

**Recommended model:** `'anthropic/claude-sonnet-4.6'` (already used in Phase 5; confirmed in GatewayModelId; [VERIFIED: node_modules/@ai-sdk/gateway/dist/index.d.ts]). For cost sensitivity, `'anthropic/claude-3.5-haiku'` is also available and cheaper but lower accuracy on handwritten documents.

**File size limit:** Vercel serverless function request body limit is 4.5MB by default (Node.js runtime). For larger PDFs, the route should enforce a client-side file size check. [ASSUMED — Vercel docs not verified in this session; treat as LOW confidence; verify before implementing]

---

## Project Constraints (from CLAUDE.md)

| Constraint | Phase 10 Implication |
|-----------|---------------------|
| AI via Gateway only (not @ai-sdk/anthropic direct) | All `generateObject/generateText` calls use model string `'anthropic/claude-sonnet-4.6'` via gateway (not direct Anthropic client) |
| ZDR for LGPD | `zeroDataRetention: true` in every gateway call, including OCR |
| PII masking before model | OCR prompt must not include CPF, phone in text; extracted CPF in log must be masked |
| `'use server'` async-only exports | ai-agent-config-types pattern: types/constants in separate non-'use server' file |
| `createAdminClient` server-only | policy.ts, audit.ts, ocr route all use createAdminClient for writes |
| RLS USING+WITH CHECK | All 3 new tables need both clauses on write policies |
| Index every clinic_id | ai_decision_log, approval_requests, ocr_extractions all need clinic_id index |
| No Puppeteer/html2pdf | Not applicable to Phase 10 |
| No `getServerSideProps` | Use Server Components + Server Actions throughout |
| `nodejs` runtime for DB routes | `/api/ocr/route.ts` must declare `export const runtime = 'nodejs'` |
| `supabase db push` re-auth gotcha | Document in each migration Wave 0 task |
| gen types temp-file guard | Use `.t` temp extension + mv atomically |
| Deploy: push master AND master:main | Wave 4 deploy task must push both refs |
| Zod v3 (not v4) | `@hookform/resolvers` compatibility — all Phase 10 schemas use `from 'zod'` (v3) |
| `@base-ui/react` for missing shadcn | Use @base-ui/react for any primitive shadcn doesn't cover; document in CLAUDE.md table |
| RSC: no functions→client | Navigation icons as string keys; no server component exports as JSX to client |
| Pages Router: never use | All new routes under `/conformidade` use App Router |
| Soft delete (LGPD) | ocr_extractions should have deleted_at if patient PII is stored in extracted_fields |

---

## Runtime State Inventory

Step 2.5 SKIPPED — Phase 10 is greenfield (new tables, new routes, new lib). No rename/refactor involved. No existing state affected except:
- `ai_agent_config` (Phase 7): Phase 10 READS this table, does NOT rename it.
- `audit_logs` (v1): Phase 10 READS + adds an index. No rename.
- `src/lib/ai/tools.ts`, `src/lib/agents/*`: Phase 10 wraps but does not rename.

No runtime state migration needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `ai` package | withAgentPolicy, generateObject | Yes | 6.0.200 | — |
| `@ai-sdk/gateway` | OCR, decision log LLM call | Yes | 3.0.127 | — |
| `zod` | OCR extraction schema | Yes | ^3.25.76 | — |
| AI_GATEWAY_API_KEY env var | All LLM calls | [ASSUMED] set in Vercel | — | Same fallback as collection-agent (skip LLM, return neutral) |
| Supabase project jqjwyqlbbuqnrffdnlpp | New migrations | Yes (sa-east-1) | — | — |
| `supabase` CLI | db push + gen types | Yes | ^2.105.0 | — |

**Missing dependencies:** None. All dependencies already installed.

[VERIFIED: package.json for all npm packages; MEMORY.md for Supabase project ref]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/__tests__/ai/ src/__tests__/migrations/phase10.test.ts` |
| Full suite command | `npx vitest run` |

[VERIFIED: vitest.config.ts + package.json devDependencies]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| AIG-01 | computePolicyDecision: L0→suggest, L1+safe→execute, L2+sensitive→pending, L4→execute | unit | `npx vitest run src/__tests__/ai/policy.test.ts` | Wave 0 |
| AIG-02 | approval_requests table: status column, idempotency index, USING+WITH CHECK | source-inspection | `npx vitest run src/__tests__/migrations/phase10.test.ts` | Wave 0 |
| AIG-03 | ai_decision_log: INSERT-only RLS, clinic_id index, decision CHECK | source-inspection | `npx vitest run src/__tests__/migrations/phase10.test.ts` | Wave 0 |
| AIG-03 | withAgentPolicy: calls admin.from('ai_decision_log').insert() | source-inspection | `npx vitest run src/__tests__/ai/policy.test.ts` | Wave 0 |
| AUD-01 | audit_logs: has old_values + new_values jsonb columns | source-inspection | `npx vitest run src/__tests__/migrations/phase10.test.ts` | Wave 0 (existing SQL) |
| AUD-02 | approval_requests: type IN ('ai_action','estorno'), required_role, idempotency | source-inspection | `npx vitest run src/__tests__/migrations/phase10.test.ts` | Wave 0 |
| AUD-03 | audit-actions.ts: queryAuditLogs references table_name filter + date range | source-inspection | `npx vitest run src/__tests__/actions/audit.test.ts` | Wave 0 |
| OCR-01 | /api/ocr/route.ts: uses generateObject, FilePart, zeroDataRetention=true | source-inspection | `npx vitest run src/__tests__/ocr/extract.test.ts` | Wave 0 |
| OCR-02 | ocr_extractions: status pending_review, min_confidence column | source-inspection | `npx vitest run src/__tests__/migrations/phase10.test.ts` | Wave 0 |
| OCR-02 | extract route: confidence < THRESHOLD → status='pending_review' in insert | source-inspection | `npx vitest run src/__tests__/ocr/extract.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/__tests__/ai/ src/__tests__/migrations/phase10.test.ts`
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work` + `npm run build`

### Wave 0 Gaps

- `src/__tests__/migrations/phase10.test.ts` — covers AIG-01..03, AUD-02, OCR-01..02 migration SQL
- `src/__tests__/ai/policy.test.ts` — covers computePolicyDecision matrix + withAgentPolicy source-inspection
- `src/__tests__/actions/audit.test.ts` — covers queryAuditLogs source-inspection + createEstorno
- `src/__tests__/ocr/extract.test.ts` — covers OCR route source-inspection (ZDR, FilePart, confidence threshold)

Pattern: all Phase 10 tests follow the source-inspection convention established in Phase 5–9 (readFileSync + toMatch). No dynamic imports of server modules.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (every route/action) | Supabase session via `createClient().auth.getUser()` |
| V3 Session Management | no (Supabase handles) | — |
| V4 Access Control | yes — alçada for approval, conformidade module | `assertNotReadOnly()` + role check in Server Actions; RLS WITH CHECK |
| V5 Input Validation | yes — OCR file, approval payload | `zod` schema on all Server Action inputs; file MIME type check |
| V6 Cryptography | no new crypto (audit_logs already encrypted at rest) | Supabase-managed encryption at rest |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Governance bypass (client-side level check) | Elevation of Privilege | `import 'server-only'` in policy.ts; server-side reads ai_agent_config |
| Approval replay / double-execution | Repudiation | `idempotency_key` UNIQUE index + `executed_at IS NULL` check before executing |
| PII leak via ai_decision_log | Information Disclosure | Mask CPF/phone before `payload` INSERT; log IDs/counts only |
| PII leak to vision model (no ZDR) | Information Disclosure | `zeroDataRetention: true` in all gateway calls; source-inspection test |
| Audit trail tampering | Tampering | INSERT-only RLS on ai_decision_log; no UPDATE/DELETE policy for any role |
| IDOR on approval_requests | Tampering | RLS USING (clinic_id = get_my_tenant_id()); approve action checks approver role |
| Malicious file upload (non-image) | Tampering | MIME type allowlist in OCR route; max file size check |
| Forged required_role in approval_requests | Elevation of Privilege | Server Action enforces alçada check from roles table, not from client payload |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI SDK v4/v5 `experimental_tool` | AI SDK v6 `tool({ inputSchema })` | v6 release (2025) | inputSchema replaces parameters; Phase 5 already on v6 |
| LanguageModelMiddleware v2 | LanguageModelV3Middleware | AI SDK v6 | specificationVersion: 'v3'; same concept |
| @ai-sdk/anthropic for direct calls | AI Gateway (ZDR mandatory for LGPD) | CLAUDE.md decision | No @ai-sdk/anthropic in project; gateway is the only path |
| Puppeteer for doc processing | generateObject with FilePart | CLAUDE.md anti-pattern | 100MB binary vs 0 new deps |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `anthropic/claude-sonnet-4.6` supports vision (image/file) inputs via AI Gateway | Architecture Patterns §OCR | OCR route generates empty extractions; need different model ID |
| A2 | Vercel serverless function request body limit is 4.5MB for nodejs runtime | Common Pitfalls §OCR | Large PDF uploads fail silently; need to increase via `next.config` or enforce client-side size check |
| A3 | `AI_GATEWAY_API_KEY` is already set in Vercel environment variables | Environment Availability | OCR + governance LLM calls return 503 in production; add to Vercel env if missing |
| A4 | withAgentPolicy returning `{ _policy, reason }` instead of TOutput is acceptable to the AI SDK streaming loop | Architecture Patterns §Policy | Streaming copilot may crash if tool result type doesn't match declared schema; may need to throw instead of returning sentinel |

**Assumptions with LOW risk (training knowledge, not verified this session):**
- None that affect critical path. A1 is the highest risk assumption — if Claude Sonnet 4.6 doesn't support vision via the gateway's API key tier, the fallback is `'anthropic/claude-3.5-haiku'` (also multimodal, also in GatewayModelId).

---

## Open Questions

1. **Does the existing copilot's tools (read-only) need governance at L0?**
   - What we know: Current tools are all read-only (SELECT only). L0 = suggest-only per the spec.
   - What's unclear: Should read-only tools skip governance entirely (they can't cause harm) or still log every call for AIG-03 completeness?
   - Recommendation: Log all calls (AIG-03 says "every decision"), but always return `execute` for read-only tools regardless of level. Sensitivity = 'safe'. L0 on read-only still logs 'execute' decision.

2. **Which patient form is the OCR pilot (D-03)?**
   - What we know: CONTEXT.md says "provável: paciente — RG/comprovante".
   - What's unclear: Confirmed pilot form is not locked.
   - Recommendation: Patient cadastro (`/clinica/pacientes/novo`). Fields: full_name, cpf, birth_date, address from RG. This is Claude's Discretion per CONTEXT.md.

3. **Audit screen: does `audit_logs` have a `record_id` index for entity lookup?**
   - What we know: `idx_audit_logs_tenant_created (tenant_id, created_at DESC)` and `idx_audit_logs_actor (actor_id)` exist. [VERIFIED]
   - What's unclear: Entity filtering by `record_id` (a specific patient's audit trail) has no index.
   - Recommendation: Add `idx_audit_logs_record_id (tenant_id, table_name, record_id)` in Phase 10 migration alongside the table_name index.

4. **Should `approval_requests` have a soft delete or expiry mechanism?**
   - What we know: `status IN ('pending','approved','rejected','expired')` covers expiry states.
   - What's unclear: What expires pending requests? Cron? Manual?
   - Recommendation: Add `expires_at timestamptz` column. Phase 10 creates rows with 7-day expiry. Expiry cron is deferred (Phase 10 can query `WHERE status='pending' AND expires_at > now()`).

---

## Split Recommendation

**Recommendation: SPLIT into 10a and 10b (strongly advised)**

**Rationale:**
- 3 subsystems × 8 requirements × new DB tables + migrations + Server Actions + UI pages = ~20+ plan tasks in a single phase, which exceeds the 5-plan budget target for well-scoped phases.
- The subsystems have ONE shared dependency (approval_requests table) but otherwise minimal coupling:
  - **10a: AI Governance + Approval Queue** (AIG-01, AIG-02, AIG-03) — new `withAgentPolicy`, `ai_decision_log`, `approval_requests`, approval inbox UI. Builds the governance primitive that OCR and estorno will consume.
  - **10b: Audit Screen + Estorno + OCR** (AUD-01, AUD-02, AUD-03, OCR-01, OCR-02) — depends on `approval_requests` (from 10a) for estorno and OCR human review. Audit screen is independent of 10a entirely.
- **Alternative SPLIT option:** 10a (AI governance + approval + audit screen), 10b (estorno + OCR) — groups approval queue with audit consumption.
- **If NOT splitting:** Phase 10 can be planned as one phase with 5 plans and 4 waves (Wave 0: migrations + tests, Wave 1: governance layer, Wave 2: approval UI + audit screen, Wave 3: OCR, Wave 4: deploy). This is feasible but dense.

**Planner decision:** This is Claude's Discretion per CONTEXT.md. The research supports splitting. If the planner opts to keep it as one phase, recommend 5 plans with clear wave boundaries.

---

## Sources

### Primary (HIGH confidence)
- `src/app/api/copilot/route.ts` — AI Gateway + ZDR + streamText + tool pattern verified in codebase
- `src/lib/ai/tools.ts` — tool() definition pattern, execute function shape
- `src/lib/agents/confirmation-agent.ts` + `collection-agent.ts` — agent runner patterns to wrap
- `src/actions/ai-agent-config.ts` — ai_agent_config table access pattern (UPDATE+INSERT, partial index)
- `src/lib/audit.ts` — logBusinessEvent pattern, createAdminClient for INSERT
- `src/lib/auth/guards.ts` — assertNotReadOnly pattern
- `src/proxy.ts` — MODULE_PERMISSIONS, ModuleKey, isReadOnly patterns
- `supabase/migrations/20260603000000_initial_schema.sql` — audit_logs schema, indexes
- `supabase/migrations/20260614000600_ai_agent_config.sql` — ai_agent_config schema + RLS
- `node_modules/ai/dist/index.d.ts` — wrapLanguageModel, generateObject, LanguageModelMiddleware, ImagePart, FilePart exports [ai@6.0.200]
- `node_modules/@ai-sdk/gateway/dist/index.d.ts` — GatewayModelId (anthropic/claude-sonnet-4.6), gateway function [@ai-sdk/gateway@3.0.127]
- `node_modules/@ai-sdk/provider/dist/index.d.ts` — LanguageModelV3Middleware full type, LanguageModelV3FilePart
- `node_modules/@ai-sdk/provider-utils/dist/index.d.ts` — FilePart, ImagePart, DataContent types
- `package.json` — all installed dependency versions
- `vitest.config.ts` — test framework configuration
- `MEMORY.md` — Supabase project ref, re-auth gotcha, Supabase FREE plan constraints

### Secondary (MEDIUM confidence)
- `.planning/MODULES-SPEC-v2.md` §22, 23, 25 — module field definitions
- `.planning/REQUIREMENTS.md` — AIG-01..03, AUD-01..03, OCR-01..02 requirement text
- `.planning/phases/10-ia-governada-l0-l4-auditoria-ocr/10-CONTEXT.md` — locked decisions D-01..D-04

### Tertiary (LOW confidence)
- A2: Vercel 4.5MB request body limit — based on training knowledge, not verified this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against node_modules
- Architecture: HIGH — patterns derived directly from existing codebase (tools.ts, agents, audit.ts, proxy.ts)
- AI SDK wrapping: HIGH — types verified against node_modules/ai/dist/index.d.ts
- Pitfalls: HIGH — derived from existing code patterns and CLAUDE.md directives
- OCR confidence threshold approach: MEDIUM — model self-reporting is a known pattern; exact accuracy for Brazilian documents unverified

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (30 days — stack is stable; AI SDK v6 unlikely to break)
