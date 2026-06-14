---
phase: 10-ia-governada-l0-l4-auditoria-ocr
fixed_at: 2026-06-14T20:51:53Z
review_path: .planning/phases/10-ia-governada-l0-l4-auditoria-ocr/10-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-06-14T20:51:53Z
**Source review:** .planning/phases/10-ia-governada-l0-l4-auditoria-ocr/10-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (CR-01, CR-02, CR-03, WR-01, WR-02, WR-03, WR-04, TEST-FIX)
- Fixed: 8
- Skipped: 0

**Verification:** 910/910 tests green, tsc --noEmit exit 0.

---

## Fixed Issues

### TEST-FIX: estorno.test.ts imports canApprove from wrong module

**Files modified:** `src/__tests__/audit/estorno.test.ts`
**Commit:** `59daf9b`
**Applied fix:** Changed `importCanApprove` to resolve from `src/lib/ai/policy-types.ts` instead of `src/actions/approval-actions.ts`. The 'use server' file cannot export sync functions (Turbopack constraint D-131); `canApprove` lives in `policy-types.ts` only. This restored the 3 failing tests to green (907 → 910).

---

### CR-01: generateObject not wrapped in try/catch

**Files modified:** `src/app/api/ocr/route.ts`
**Commit:** `7ac28d7`
**Applied fix:** Wrapped the `generateObject` call in a `try/catch` block. On AI Gateway failure (rate limit, network timeout, schema validation error), the route now returns `Response.json({ error: 'Falha no serviço de IA. Tente novamente.' }, { status: 502 })`. The catch block logs only `(aiErr as Error).message` — not the full error body which may echo prompt content (LGPD / T-10-21). The `object` variable is declared with `let` before the try block so it remains in scope for the subsequent confidence and INSERT logic.

---

### CR-03: clinicId resolved after AI call — tenant guard must precede generateObject

**Files modified:** `src/app/api/ocr/route.ts`
**Commit:** `7ac28d7`
**Applied fix:** Moved the `createAdminClient()` + `users.tenant_id` lookup to run before the base64 encoding and `generateObject` call. If `clinicId` is null/undefined, the route returns `Response.json({ error: 'Usuário sem clínica associada.' }, { status: 403 })` immediately — before sending any document content to the AI provider. Removed the now-duplicate `admin`, `userRow`, and `clinicId` declarations that previously appeared in the persist section. The `admin` and `clinicId` are reused from the early guard for the `ocr_extractions` INSERT.

---

### CR-02: getGovContext sentinel strings ('unauthenticated', 'unknown') inserted into ai_decision_log.clinic_id UUID column

**Files modified:** `src/lib/ai/tools.ts`, `src/lib/ai/policy.ts`
**Commit:** `c491f5d`
**Applied fix (tools.ts):** Changed `getGovContext` return type from `{ clinicId: string; ... }` to `{ clinicId: string | null; ... }`. Returns `null` instead of `'unauthenticated'` or `'unknown'`. Each tool's execute block now checks `if (!clinicId) return originalExecute()` before calling `withAgentPolicy` — skipping the governance log entirely when no valid tenant is resolved. For these read-only tools, RLS on the Supabase client still enforces tenant isolation even without the governance log.

**Applied fix (policy.ts):** Added a UUID regex guard (`UUID_RE.test(ctx.clinicId)`) around the `ai_decision_log` INSERT as defense-in-depth. If a non-UUID string somehow reaches `withAgentPolicy` (e.g. from agents other than copilot tools), the INSERT is skipped with a `console.warn` rather than silently failing inside the try/catch. The guard does not affect the decision logic — the action is still executed/blocked/suggested regardless of logging.

---

### WR-01: rejectRequest missing executed_at IS NULL guard

**Files modified:** `src/actions/approval-actions.ts`
**Commit:** `8dd11ba`
**Applied fix:** Added `.is('executed_at', null).select('id')` to the rejectRequest UPDATE, mirroring approveRequest's race protection. Added affected-row count check: if `!updated || updated.length === 0`, returns `{ success: false, error: 'Já decidido por outro ator (corrida de aprovação).' }`. This prevents duplicate `approval.rejected` audit events on concurrent reject calls and correctly detects approve-vs-reject races.

---

### WR-02: canApprove unknown requiredRole returns false for all roles including superadmin

**Files modified:** `src/lib/ai/policy-types.ts`
**Commits:** `8dd11ba`, `3d11b06`
**Applied fix:** Replaced the single-expression `?? Infinity` fallback with an explicit `undefined` check. When `APPROVER_RANK[requiredRole]` is `undefined` (unknown role), the function now requires `actorRank >= (APPROVER_RANK['superadmin'] ?? 100)` — superadmin is the only escape hatch for permanently stuck rows with misspelled `required_role`. Lower roles (admin, dentist, etc.) still cannot approve unknown-role requests. A second commit (`3d11b06`) fixed a `tsc --noEmit` error (TS2532: Object is possibly 'undefined') caused by `noUncheckedIndexedAccess` — resolved by adding `?? 100` to the superadmin lookup. All existing canApprove tests pass unchanged.

---

### WR-03: AuditTrail renders old_values/new_values raw — PII exposed in UI

**Files modified:** `src/components/conformidade/AuditTrail.tsx`
**Commit:** `d381803`
**Applied fix:** Added a `maskPiiFields(obj)` function that replaces the value of known PII keys with `'***'` before `JSON.stringify`. The `PII_DISPLAY_FIELDS` set covers: `cpf`, `phone`, `telefone`, `email`, `rg`, `date_of_birth`, `data_nascimento`, `medical_history`, `historico_medico`, `allergies`, `alergias`, `medications`, `medicamentos`, `health_notes`, `observacoes_saude`, `password`, `senha`. Key lookup is case-insensitive via `.toLowerCase()`. `masking.ts` was not imported (it has `import 'server-only'` and cannot be used in a client component) — the display mask is defined inline as a client-safe pure function. Auditors see structure and non-PII values; sensitive fields are redacted in the UI. Server-stored audit data remains unmasked for DPO export.

---

### WR-04: approveRequest logs approval.payload.dispatched phantom event

**Files modified:** `src/actions/approval-actions.ts`
**Commit:** `59c5329`
**Applied fix:** Removed the phantom `approval.payload.dispatched` `logBusinessEvent` call that fired on every approval even though no concrete payload executor is wired in Phase 10. Consolidated to a single `approval.approved` event with `payload_dispatched: false` in the details — explicitly documenting that no reversal occurred. This eliminates duplicate audit events and prevents auditors from reading a false "dispatched" signal for actions that were never executed.

---

## Skipped Issues

None — all 8 findings were fixed.

---

_Fixed: 2026-06-14T20:51:53Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
