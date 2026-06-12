---
phase: 05-ai-agents
fixed_at: 2026-06-11T00:00:00Z
review_path: .planning/phases/05-ai-agents/05-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-06-11
**Source review:** .planning/phases/05-ai-agents/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 6
- Fixed: 6
- Skipped: 0

## Required follow-up (DB)

A new migration was authored:
`supabase/migrations/20260611000100_agent_outreach_log_to_phone.sql`
(additive nullable `agent_outreach_log.to_phone TEXT` + index).

**REQUIRED before deploy:** run `supabase db push` then regenerate types
(`supabase gen types typescript ... > src/types/database.types.ts`).

To keep `tsc`/`next build` green NOW (before the push), `src/types/database.types.ts`
was hand-patched to add `to_phone: string | null` to the `agent_outreach_log`
Row/Insert/Update shapes. The regen will reproduce this exactly. The runtime
`createAdminClient()` is currently untyped (returns the loose supabase client), so
the column reads/writes are not statically bound to the generated types — this is
why the build stays green without the live column. Once the column exists in prod
the inbound resolver and confirmation-agent write begin functioning as designed.

## Fixed Issues

### CR-01 + CR-02: Cross-tenant free-text inbound (root-cause fix, committed together)

**Files modified:** `supabase/migrations/20260611000100_agent_outreach_log_to_phone.sql`, `src/types/database.types.ts`, `src/lib/agents/confirmation-agent.ts`, `src/app/api/webhooks/whatsapp/route.ts`
**Commit:** 862019b
**Chosen approach:** PHONE-BINDING (the preferred fix, not the disable-free-text fallback).
**Applied fix:**
- Added a nullable `to_phone` (E.164) column + index to `agent_outreach_log` via a new
  migration with a fresh timestamp. RLS unchanged (still no INSERT/UPDATE/DELETE policy).
- `confirmation-agent.ts` now persists `to_phone: to` (the normalized E.164 recipient)
  on every `status='sent'` outreach row.
- `route.ts`: `fromPhone` is now forwarded into `processInbound`. The free-text reply
  path resolves the candidate appointment ONLY among outreach rows where
  `to_phone = toE164(fromPhone)` AND `status='sent'` AND `created_at >= now()-48h`,
  newest first. Before mutating, it verifies the resolved appointment's patient phone
  equals the sender (CR-02 ownership check). If no unambiguous, sender-owned match is
  found, NO status change occurs (logged for review).
- The appointment status `UPDATE` is now scoped by `id` AND `tenant_id`, where
  `tenant_id` is sourced from the matched outreach row (free-text path) or the
  appointment row (button path) — never from the payload.

**Requires human verification:** the free-text resolution + ownership logic is a
security-sensitive conditional. Tier 1 (re-read) and Tier 2 (tsc) confirm structure
and types only; please confirm the matching/ownership semantics manually, and verify
end-to-end after the `db push` + `gen types` once `to_phone` is populated by live sends.

### WR-02: Placeholder tenant_id would violate the clinics FK

**Files modified:** `src/app/api/webhooks/whatsapp/route.ts`
**Commit:** 862019b (same coherent `processInbound` rewrite as CR-01/CR-02)
**Applied fix:** Removed both inserts that used the fake
`00000000-0000-0000-0000-000000000000` tenant_id. For the appointment-unresolved /
sender-mismatch branch, an audit row is inserted ONLY when a real `tenant_id` is
available from the matched outreach row (insert result is now checked and logged on
failure); otherwise it logs to the server console. The fully-ambiguous branch no longer
attempts an `agent_outreach_log` insert at all — it logs to console and emits a
system-scoped `logBusinessEvent` (which does not touch the clinics FK). No silently
dropped rows.

### WR-03: `sent` outreach row never transitioned to `responded`

**Files modified:** `src/app/api/webhooks/whatsapp/route.ts`
**Commit:** 862019b (same coherent `processInbound` rewrite as CR-01/CR-02)
**Applied fix:** On a successful free-text confirm/cancel, the matched `sent` outreach
row is now UPDATEd to `status='responded'` (carrying `intent_result`, `whatsapp_message_id`,
`updated_at`) instead of inserting a new row. Combined with the 48h recency window, the
stale `sent` row can no longer be re-matched by an unrelated subsequent reply. The button/
interactive path (no matched `sent` row) still writes a fresh `responded` audit row.

### WR-04: Misleading `eslint-disable` on the `admin` param

**Files modified:** `src/app/api/webhooks/whatsapp/route.ts`
**Commit:** 862019b (same file as CR-01/CR-02)
**Applied fix:** Removed both stray
`// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments preceding the
`admin: ReturnType<typeof createAdminClient>` annotations (in `processInbound` and
`markProcessed`); there was no explicit `any` on those lines, so the disables suppressed
nothing.
**Note on scope:** The report suggested optionally typing `createAdminClient` as
`SupabaseClient<Database>`. That was attempted but reverted: adding the `<Database>`
generic to the shared admin client cascaded strict typing into unrelated pre-existing
callers (asaas webhook, audit, messaging queue/worker) and broke `tsc` with errors NOT
introduced by this finding. The scoped, build-green fix is removing the misleading
comments; tightening the admin client's generic is left as a separate, broader refactor.

### WR-01: `maskEmail` used before declaration

**Files modified:** `src/lib/ai/tools.ts`
**Commit:** 63146b5
**Applied fix:** Moved the `maskEmail` function declaration into the helpers block above
the copilot tool definitions (it was previously declared below `searchHelpDocsTool` and
relied on hoisting). The PII-masking path is now declared-before-use and safe against a
future refactor to a `const` arrow function.

## Verification

Run after all fixes (full results):

- `npx tsc --noEmit` — PASS (no errors). Note: the earlier transient cascade of errors
  came from the reverted `createAdminClient<Database>` experiment; final state is clean.
- `npx vitest run` — PASS — 33 files, 368 tests passed.
- `npx next build` — PASS (compiled, all routes generated). Only warning is the
  pre-existing "Next.js inferred your workspace root" lockfile notice, unrelated to these
  changes.

Verification per fix: Tier 1 (re-read modified sections) for all; Tier 2 (tsc full
project) for all TypeScript files. The CR-01/CR-02/WR-02/WR-03 logic in `route.ts` is
flagged for human verification (security-sensitive conditionals + DB column not yet live).

## Info findings (out of scope — not addressed)

IN-01..IN-04 were Info severity and outside the `critical_warning` scope. IN-04
(confirmation template aliasing the reminder template with variable button payloads)
intersects with the inbound button path and is worth confirming at Meta-template
registration time, per the report.

---

_Fixed: 2026-06-11_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
