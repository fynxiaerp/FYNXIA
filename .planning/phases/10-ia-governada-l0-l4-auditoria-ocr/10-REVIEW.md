---
phase: 10-ia-governada-l0-l4-auditoria-ocr
reviewed: 2026-06-14T12:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - supabase/migrations/20260616000100_ai_decision_log.sql
  - supabase/migrations/20260616000200_approval_requests.sql
  - supabase/migrations/20260616000300_ocr_extractions.sql
  - supabase/migrations/20260616000400_audit_logs_indexes.sql
  - src/lib/ai/policy-types.ts
  - src/lib/ai/policy.ts
  - src/lib/ai/tools.ts
  - src/lib/ai/ocr-confidence.ts
  - src/lib/agents/collection-agent.ts
  - src/lib/agents/confirmation-agent.ts
  - src/actions/approval-actions.ts
  - src/actions/audit-actions.ts
  - src/actions/ocr-actions.ts
  - src/app/api/ocr/route.ts
  - src/lib/audit-query-types.ts
  - src/proxy.ts
  - src/app/(dashboard)/conformidade/auditoria/page.tsx
  - src/app/(dashboard)/conformidade/aprovacoes/page.tsx
  - src/app/(dashboard)/conformidade/ocr/page.tsx
  - src/components/conformidade/ApprovalInbox.tsx
  - src/components/conformidade/AuditTrail.tsx
  - src/components/conformidade/OcrUploadReview.tsx
  - src/__tests__/audit/audit-ui.test.ts
  - src/__tests__/audit/estorno.test.ts
  - src/__tests__/governance/approvals.test.ts
  - src/__tests__/ocr/extract.test.ts
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 10: Code Review Report — IA Governada L0–L4 + Auditoria + OCR

**Reviewed:** 2026-06-14T12:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Phase 10 introduces the AI governance layer (L0–L4 `withAgentPolicy`), approval/estorno queue, audit trail query, and OCR document extraction. The overall architecture is sound: governance is enforced server-side via `server-only`, the L0–L4 × sensitivity decision matrix is correct, RLS is enabled with USING + WITH CHECK on all writable tables, and the audit admin-client pattern is properly gated.

Three critical issues were found:

1. **`generateObject` is not wrapped in try/catch** — an AI Gateway failure (network error, rate limit, invalid schema) returns an unhandled exception and a raw 500 stack trace rather than a clean JSON error response. The extracted `object` may also be returned as raw JSON to the client, which could contain unmasked CPF.
2. **Sentinel `clinicId` values (`'unauthenticated'`, `'unknown'`) can be inserted into `ai_decision_log.clinic_id`** — the `clinic_id NOT NULL` column accepts any non-null string, so these placeholder strings bypass the intent of the constraint and produce garbage audit rows when a copilot tool is called by an unauthenticated or tenant-less session (the tools route itself is protected, but the pattern is fragile).
3. **`clinicId` is never validated to be a UUID before being written to `ai_decision_log`** — the same as above, but explicitly: `'unauthenticated'` and `'unknown'` are not UUIDs and will silently corrupt the audit log if the config-read path fails inside `withAgentPolicy`.

Four warnings were found covering: `rejectRequest` has no `executed_at` idempotency guard (diverging from `approveRequest`'s pattern); the OCR route response body returns the raw `object` (which contains unmasked CPF) to the client; the `canApprove` function has an asymmetric fallback for unknown `requiredRole` that makes ALL unknown roles unapprove-able by anyone; and the `AuditTrail` client component reads `old_values`/`new_values` as raw JSON and renders them verbatim without any masking.

---

## Critical Issues

### CR-01: `generateObject` in `/api/ocr` is not wrapped in try/catch — raw exception on AI Gateway failure + unmasked CPF returned in response body

**File:** `src/app/api/ocr/route.ts:112`

**Issue:** The `generateObject(...)` call at line 112 is not wrapped in a try/catch block. Any AI Gateway error (rate limit, network timeout, schema validation failure, provider error) will propagate as an unhandled exception, resulting in a Next.js-generated 500 response that may include stack traces. More critically, on success the response at line 192–196 returns `fields: object` directly to the browser. The `object` contains the raw `cpf.value` field — e.g. `"123.456.789-00"` — as returned by the model. The `maskCPF` applied at line 187 is only for the server log; the client receives the full, unmasked CPF value in the JSON response body. The OCR UI displays this in a form input (T-10-34 accepts this for the reviewer's eyes), but the concern is the Gateway exception path.

**Fix:**

```typescript
// Wrap generateObject in try/catch (line 112)
let object: z.infer<typeof PatientDocumentSchema>
try {
  const result = await generateObject({
    model: 'anthropic/claude-sonnet-4.6',
    schema: PatientDocumentSchema,
    messages: [...],
    providerOptions: {
      gateway: { zeroDataRetention: true } satisfies GatewayProviderOptions,
    },
  })
  object = result.object
} catch (aiErr) {
  // Do NOT log the error body — it may echo prompt content (LGPD)
  console.error('[ocr] AI Gateway error:', (aiErr as Error).message)
  return Response.json({ error: 'Falha no serviço de IA. Tente novamente.' }, { status: 502 })
}
```

The `fields: object` in the response is acceptable for the reviewer UI (the reviewer sees and corrects the values) — but document this explicitly as a deliberate design choice (T-10-34). The gateway error path is the actual correctness bug.

---

### CR-02: Sentinel `clinicId` values `'unauthenticated'` and `'unknown'` are inserted into `ai_decision_log.clinic_id` (NOT NULL UUID column)

**File:** `src/lib/ai/tools.ts:34,43,47`

**Issue:** `getGovContext()` returns `{ clinicId: 'unauthenticated', actorId: null }` when there is no auth session, and `{ clinicId: 'unknown', actorId: null }` when the session exists but the `users` table lookup fails. These strings are passed directly to `withAgentPolicy`, which inserts them into `ai_decision_log.clinic_id`. The column is `NOT NULL` and typed UUID in the schema (migration line 8: `clinic_id UUID NOT NULL`). PostgreSQL will reject the INSERT with a type error for non-UUID strings — but this causes the `try/catch` in `withAgentPolicy` to silently swallow the error (line 94–97 in `policy.ts`), meaning the log INSERT fails silently every time a copilot tool is called without a valid session or with a broken user record.

The tools route (`/api/copilot` or equivalent) likely has its own auth gate upstream, but the pattern in `tools.ts` is fragile: if a tool is called in any test harness or future route without an auth guard, the fallback produces a silent audit log corruption rather than a loud failure.

**Fix:**

```typescript
async function getGovContext(): Promise<{ clinicId: string | null; actorId: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { clinicId: null, actorId: null }

    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    return {
      clinicId: userData?.tenant_id ?? null,
      actorId: user.id,
    }
  } catch {
    return { clinicId: null, actorId: null }
  }
}

// In each tool's execute:
const { clinicId, actorId } = await getGovContext()
// Skip governance log if no valid clinic — do not insert invalid UUID
if (!clinicId) {
  return originalExecute()
}
const result = await withAgentPolicy(
  { clinicId, agentKey: 'copilot', actorId, action: '...', actionSensitivity: 'safe' },
  originalExecute,
)
// Read-only fallback unchanged
if (result && typeof result === 'object' && '_policy' in result) {
  return originalExecute()
}
return result
```

Alternatively, add a UUID regex guard inside `withAgentPolicy` before inserting:

```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!UUID_RE.test(ctx.clinicId)) {
  // Skip log insert — clinicId is not a valid UUID
} else {
  await admin.from('ai_decision_log').insert({ clinic_id: ctx.clinicId, ... })
}
```

---

### CR-03: OCR route inserts `clinic_id: undefined` into `ocr_extractions` when user has no `tenant_id`

**File:** `src/app/api/ocr/route.ts:156-167`

**Issue:** Lines 156–162 look up the user's `tenant_id` via `admin.from('users').select('tenant_id').eq('id', user.id).single()`. If the lookup returns no row (user exists in auth but not in `public.users`), `clinicId` is `undefined`. Line 166 then inserts `clinic_id: undefined` into `ocr_extractions`. Supabase JS v2 serializes `undefined` as `null` in JSON, so the INSERT sends `clinic_id: null` — which violates the `NOT NULL` constraint (`clinic_id UUID NOT NULL REFERENCES public.clinics(id)`). The error is caught by the `if (insertError || !extraction)` guard at line 178 and returns a 500, but the root cause is undetected before the INSERT attempt.

More importantly: there is **no early-exit guard** for `clinicId` being undefined/null. The `generateObject` call (which contains the patient's CPF) has already completed before the tenant check. If the user exists in auth but not in `public.users`, the document is fully extracted and then silently dropped — with no clear error distinguishing this from an AI failure.

**Fix:**

```typescript
// After resolving userRow (line 156), add explicit guard:
const clinicId = (userRow as { tenant_id: string } | null)?.tenant_id
if (!clinicId) {
  console.error('[ocr] User has no tenant_id — cannot persist extraction', { userId: user.id })
  return Response.json({ error: 'Usuário sem clínica associada.' }, { status: 403 })
}
// Then proceed with insert using the validated clinicId
```

Ideally move the tenant lookup to BEFORE the `generateObject` call, so the route fails fast before sending the document to the AI provider.

---

## Warnings

### WR-01: `rejectRequest` missing `executed_at IS NULL` idempotency guard — diverges from `approveRequest`

**File:** `src/actions/approval-actions.ts:307-315`

**Issue:** `approveRequest` uses an idempotent UPDATE with `.eq('status', 'pending').is('executed_at', null)` and checks `updated.length === 0` to detect race conditions (lines 218–229). `rejectRequest` uses only `.eq('status', 'pending')` in its UPDATE (line 310–315) with no affected-row count check. This means:

1. Two concurrent reject calls can both succeed without detection (no "already rejected by another actor" guard).
2. A race between approve and reject could result in a reject UPDATE succeeding after the approve has already set `executed_at`, depending on timing (the status guard catches this if approve runs first and sets status='approved', but if the reject UPDATE fires in the gap between the status check and the approve UPDATE completing, behavior is undefined).

This is lower severity than CR class because `rejectRequest` does not execute a payload (no double-execution risk), but it produces a duplicate `approval.rejected` audit event and diverges from the stated idempotency contract.

**Fix:**

```typescript
// In rejectRequest, change the UPDATE to mirror approveRequest:
const { data: updated, error: updateError } = await admin
  .from('approval_requests')
  .update({
    status: 'rejected',
    approver: actor.id,
    decided_at: now,
    reason,
  })
  .eq('id', id)
  .eq('status', 'pending')
  .select('id') // get affected rows

if (updateError) {
  return { success: false, error: updateError.message }
}
if (!updated || updated.length === 0) {
  return { success: false, error: 'Já decidido por outro ator (corrida de aprovação).' }
}
```

---

### WR-02: `canApprove` with an unknown `requiredRole` returns `false` for ALL roles including `superadmin`

**File:** `src/lib/ai/policy-types.ts:84-86`

**Issue:** When `requiredRole` is not in `APPROVER_RANK`, `APPROVER_RANK[requiredRole]` is `undefined`, and `?? Infinity` makes it `Infinity`. Any actor's rank (max 100 for superadmin) is always < `Infinity`, so `canApprove` returns `false`. This means if an `approval_requests` row is accidentally created with an unknown/misspelled `required_role` (e.g. `'superAdmin'` instead of `'superadmin'`), no actor — including superadmin — can ever approve it. The row becomes stuck permanently.

This is a correctness bug in the alçada logic. The conservative behavior (blocking) is intentional per the fail-safe design, but it produces an irrecoverable stuck request with no observable error in `approveRequest` (it returns `'Alçada insuficiente'` for everyone, including superadmin).

**Fix:** Add a fallback to handle unknown `requiredRole` explicitly:

```typescript
export function canApprove(role: string, requiredRole: string): boolean {
  const actorRank = APPROVER_RANK[role] ?? 0
  const requiredRank = APPROVER_RANK[requiredRole]
  // Unknown requiredRole: only superadmin can approve (fail-safe + escape hatch)
  if (requiredRank === undefined) {
    return actorRank >= APPROVER_RANK['superadmin']
  }
  return actorRank >= requiredRank
}
```

Alternatively, validate `requiredRole` at `createApprovalRequest` time (reject unknown roles via Zod enum).

---

### WR-03: `AuditTrail` renders `old_values`/`new_values` raw via `JSON.stringify` — may expose PII in the UI

**File:** `src/components/conformidade/AuditTrail.tsx:87-93`

**Issue:** The `DiffBlock` component renders `JSON.stringify(value, null, 2)` directly inside a `<pre>` tag. `old_values` and `new_values` from `audit_logs` can contain any column values from any audited table — including `patients.cpf`, `patients.phone`, health data columns, and other PII stored in triggers' OLD/NEW snapshots. Since auditors and DPOs have access to this screen (AUDIT_PERMITTED_ROLES), and the data is rendered verbatim, this is a potential LGPD PII exposure path.

This is a **warning** (not critical) because access is role-gated and the audit screen is explicitly intended for compliance roles — but it contradicts the project's mascaramento principle and LGPD audit trail design intent.

**Fix:** Add a masking pass over the rendered JSON object before display, or render only a summary of changed keys without values (or redact known PII fields):

```typescript
const PII_FIELDS = ['cpf', 'phone', 'email', 'rg', 'date_of_birth']

function maskPiiFields(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      k,
      PII_FIELDS.includes(k) ? '***' : v,
    ])
  )
}

// In DiffBlock:
<pre ...>{JSON.stringify(maskPiiFields(value), null, 2)}</pre>
```

---

### WR-04: `approveRequest` logs `approval.payload.dispatched` even when `executeEstornoPayload` is not called

**File:** `src/actions/approval-actions.ts:232-243`

**Issue:** The `approveRequest` function at lines 232–243 always fires a `logBusinessEvent` with action `'approval.payload.dispatched'`, then fires a second event `'approval.approved'` at lines 246–255. However, `executeEstornoPayload` (or any concrete payload dispatch) is never actually called for `type='estorno'` requests in this Phase 10 implementation — the code comment at line 233 explicitly says "dispatch records execution to the audit trail (generic)" and notes concrete reversal is deferred to Plans 04/05. This means:

1. The `approval.payload.dispatched` event falsely claims the payload was "dispatched" when no actual state change occurred.
2. Two audit events fire for every approval (dispatched + approved), creating audit log noise and potential confusion for auditors reading the trail.

**Fix:** Remove the phantom `approval.payload.dispatched` event until a concrete executor is wired in, or rename it to `'approval.payload.queued'` and document that the actual reversal is pending:

```typescript
// Replace the first logBusinessEvent with an honest event:
await logBusinessEvent({
  tenantId: actor.tenant_id,
  actorId: actor.id,
  action: 'approval.approved',         // single event
  details: {
    id,
    type: request.type,
    required_role: request.required_role,
    payload_dispatched: false,           // explicit: no payload executed yet
    note: 'Estorno executor deferred to Phase 14–16',
  },
})
// Remove the duplicate logBusinessEvent below
```

---

## Info

### IN-01: `L2` and `L3` are identical in `computePolicyDecision` — the distinction between them is lost

**File:** `src/lib/ai/policy-types.ts:52-53`

**Issue:** Lines 52 and 53 produce identical output for all inputs:
```
L2 + 'sensitive' → 'pending_approval'
L2 + other       → 'execute'
L3 + 'sensitive' → 'pending_approval'
L3 + other       → 'execute'
```
The design doc (comment lines 40–43) implies L3 should differentiate from L2, but the current implementation makes them equivalent. This may be intentional for Phase 10 (the distinction may matter for `reversible` at the network vs. unit level), but it should be validated. If L3 was intended to expand permissions over L2 (e.g., L3 + reversible → execute where L2 + reversible → pending_approval), the matrix needs a correction.

This is informational — not a bug in the current phase since no agent currently runs at L2/L3, but should be resolved before the governance config UI is exposed.

---

### IN-02: `AuditTrail` filter accepts free-text `actorId` without UUID validation

**File:** `src/components/conformidade/AuditTrail.tsx:277-283`

**Issue:** The `actorId` filter input accepts any string value. When a non-UUID string is entered, the `queryAuditLogs` server action passes it directly to `.eq('actor_id', filters.actorId)` (audit-actions.ts:129). PostgreSQL will reject the query with a type error on the UUID column, and the server action returns `{ success: false, error: error.message }`. The `AuditoriaPage` RSC renders an error alert, but the error message is the raw Postgres message (e.g., `invalid input syntax for type uuid: "abc"`) which leaks schema detail.

**Fix:** Add client-side UUID format hint or validation on the filter input, and sanitize the error message server-side:

```typescript
// In audit-actions.ts, before the query:
if (filters.actorId) {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(filters.actorId)) {
    return { success: false, error: 'ID do ator deve ser um UUID válido.' }
  }
}
```

---

## Security Positive Findings (No Issues)

The following security-critical properties were verified as correctly implemented:

- **ai_decision_log immutability:** No INSERT/UPDATE/DELETE RLS policies — writes exclusively via `createAdminClient` (service role bypasses RLS). Confirmed in migration 000100.
- **Governance server-side enforcement:** `withAgentPolicy` is in a file with `import 'server-only'`. The L0–L4 × sensitivity matrix is correct. Unknown levels return `'block'` (fail-safe).
- **Approval alçada:** `approveRequest` and `rejectRequest` both call `assertNotReadOnly()` before `canApprove(actor.role, request.required_role)`. `actor.role` is fetched server-side from `public.users` — never from client payload.
- **Idempotency (approveRequest):** UPDATE WHERE `status='pending' AND executed_at IS NULL` + affected-row count check prevents double-execution races.
- **Audit admin-client gate:** `queryAuditLogs` checks `AUDIT_PERMITTED_ROLES` BEFORE calling `createAdminClient()`. Tenant filter is always from `actor.tenant_id` — never from client payload.
- **OCR ZDR:** `zeroDataRetention: true` is set on every `generateObject` / `generateText` Gateway call.
- **OCR MIME allowlist + size guard:** Both enforced at lines 88 and 98 before any file processing.
- **OCR auth gate:** `supabase.auth.getUser()` gate returns 401 before any file handling.
- **OCR LGPD logging:** `maskCPF` applied before any `console.log` line. The raw `object` is never logged.
- **Agent per-tenant governance:** Both `collection-agent.ts` and `confirmation-agent.ts` call `withAgentPolicy` with `clinicId = receivable.tenant_id` / `appt.tenant_id` inside the scan loop — not at run level.
- **RSC boundary:** All RSC pages pass only serializable data arrays to client components. No functions or server objects cross the boundary.
- **RLS USING + WITH CHECK:** `approval_requests` and `ocr_extractions` both have USING + WITH CHECK on write policies. `ai_decision_log` has no write policy (append-only via service role).
- **'use server' async-only exports:** The fix from commit `aff7166` is in place — `canApprove` is NOT re-exported from `approval-actions.ts`. It remains in `policy-types.ts` only.
- **OCR runtime:** `export const runtime = 'nodejs'` present at line 12 (required for `@react-pdf/renderer` and Supabase TCP).
- **createEstorno motivo:** Zod validation enforces `reason.min(5)`. `assertNotReadOnly()` is called first.
- **LGPD soft-delete on OCR:** `ocr_extractions` has `deleted_at` column; `ocr/page.tsx` filters `.is('deleted_at', null)`.
- **Conformidade module RBAC:** `conformidade` module registered in `proxy.ts` `ROUTE_MODULE_MAP` at line 47. `MODULE_PERMISSIONS` grants access to correct roles.

---

_Reviewed: 2026-06-14T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
