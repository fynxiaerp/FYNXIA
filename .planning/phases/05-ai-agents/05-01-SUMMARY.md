---
phase: 05-ai-agents
plan: "01"
subsystem: database
tags: [supabase, postgres, rls, migrations, vitest, typescript, whatsapp, ai-agents]

# Dependency graph
requires:
  - phase: 03-financial
    provides: webhook_events no-RLS service-role pattern (mirrored for whatsapp_inbound_events)
  - phase: 04-communications
    provides: message_outbox + outbox pattern (agent_outreach_log mirrors no-client-write policy)
provides:
  - agent_outreach_log table (tenant_id→clinics FK, agent_type CHECK, SELECT-only RLS via get_my_tenant_id(), idx_agent_outreach_log_tenant_created index)
  - whatsapp_inbound_events table (wamid TEXT UNIQUE NOT NULL for idempotent dedup, service-role only, no RLS)
  - 5 Wave 0 RED-by-design test scaffolds defining behavioral contracts for plans 05-02..05-05
  - Regenerated database.types.ts including both new tables
affects: [05-02, 05-03, 05-04, 05-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 scaffold style: source-inspection via existsSync + readFileSync so tsc stays green across waves (RED-by-design tests fail with readable 'not yet created' messages)"
    - "agent_outreach_log SELECT-only RLS: no client INSERT/UPDATE/DELETE policy — service-role writes only via createAdminClient (mirrors message_outbox from 04-01)"
    - "whatsapp_inbound_events no RLS: service-role only, mirrors webhook_events from 03-01 (T-5-04 accepted)"

key-files:
  created:
    - supabase/migrations/20260610000100_agent_outreach_log.sql
    - supabase/migrations/20260610000200_agent_outreach_log_rls.sql
    - supabase/migrations/20260610000300_whatsapp_inbound_events.sql
    - src/__tests__/migrations/ai.test.ts
    - src/__tests__/ai/tools.test.ts
    - src/__tests__/ai/chat-route.test.ts
    - src/__tests__/ai/whatsapp-inbound.test.ts
    - src/__tests__/ai/collection-agent.test.ts
  modified:
    - src/types/database.types.ts

key-decisions:
  - "agent_outreach_log SELECT-only RLS (no client write): service role writes via createAdminClient; mirrors message_outbox pattern established in 04-01"
  - "whatsapp_inbound_events no RLS (service-role only): mirrors webhook_events (T-5-04 accepted); wamid UNIQUE is idempotency guard consumed by 05-04"
  - "Wave 0 scaffold style: source-inspection (existsSync + readFileSync) over direct import so tsc stays clean across wave boundaries — 4 ai/* scaffolds RED-by-design until 05-02..05-05"
  - "Supabase CLI re-auth as recurring checkpoint gate: CLI defaults to wrong account (nexus-*); must login to org kczvihafddupruvsrrsc before every db push"

patterns-established:
  - "Wave 0 scaffold pattern: test reads target source file via readFileSync/existsSync; fails with readable message if target absent; passes once target is written (downstream plan)"
  - "Service-role-only table pattern: no RLS + no client path; handler uses createAdminClient; same as webhook_events (03-01) and message_outbox (04-01)"

requirements-completed: [AI-01, AI-02, AI-03]

# Metrics
duration: ~90min (multi-session including checkpoint)
completed: 2026-06-10
---

# Phase 5 Plan 01: AI Foundation Summary

**agent_outreach_log + whatsapp_inbound_events tables live in Supabase sa-east-1, with SELECT-only tenant RLS and wamid UNIQUE dedup, plus 5 Wave 0 test scaffolds defining contracts for copilot/webhook/agent plans**

## Performance

- **Duration:** ~90 min (multi-session including db push checkpoint)
- **Started:** 2026-06-10T~20:00:00Z
- **Completed:** 2026-06-10T~22:30:00Z
- **Tasks:** 3 (Task 0, Task 1, Task 2 — Task 2 was a blocking checkpoint resolved by human)
- **Files modified:** 9

## Accomplishments

- Two new AI-layer tables deployed to Supabase sa-east-1 (São Paulo): `agent_outreach_log` (audit trail for confirmation + collection agents, powers `/clinica/ia/agentes` UI) and `whatsapp_inbound_events` (idempotent inbound dedup via `wamid UNIQUE`)
- RLS on `agent_outreach_log` enforces tenant isolation for reads (`FOR SELECT USING (tenant_id = get_my_tenant_id())`); no client write policy — all writes are service-role only (mirrors message_outbox from 04-01)
- 5 Wave 0 test scaffolds committed defining behavioral contracts: `ai.test.ts` (13/13 GREEN — SQL assertions); 4 `ai/*` tests RED-by-design with readable "not yet created" messages (turn GREEN in 05-02..05-05)
- `database.types.ts` regenerated to include both new tables; `npx tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 0: Wave 0 — 5 RED test scaffolds** - `74bd724` (test)
2. **Task 1: agent_outreach_log + whatsapp_inbound_events migrations** - `895262b` (feat)
3. **Task 2: [BLOCKING] supabase db push + type regen** - `316b84a` (feat — types) + `a5fa29b` (test — scaffold fix)

## Files Created/Modified

- `supabase/migrations/20260610000100_agent_outreach_log.sql` — CREATE TABLE agent_outreach_log (tenant_id→clinics FK, agent_type CHECK ('confirmation','collection'), SELECT-only RLS, tenant+created_at composite index)
- `supabase/migrations/20260610000200_agent_outreach_log_rls.sql` — ENABLE ROW LEVEL SECURITY + SELECT-only tenant policy; no INSERT/UPDATE/DELETE
- `supabase/migrations/20260610000300_whatsapp_inbound_events.sql` — CREATE TABLE whatsapp_inbound_events (wamid TEXT UNIQUE NOT NULL, processed BOOLEAN, service-role only, no RLS)
- `src/__tests__/migrations/ai.test.ts` — SQL file assertions for all 3 migrations (13 assertions, GREEN after db push)
- `src/__tests__/ai/tools.test.ts` — Wave 0 scaffold: masking + tools.ts contract (RED until 05-02)
- `src/__tests__/ai/chat-route.test.ts` — Wave 0 scaffold: copilot route contract (RED until 05-02)
- `src/__tests__/ai/whatsapp-inbound.test.ts` — Wave 0 scaffold: HMAC verifier + intent mapper + webhook route contract (RED until 05-04)
- `src/__tests__/ai/collection-agent.test.ts` — Wave 0 scaffold: collection-agent + confirmation-agent contracts (RED until 05-05)
- `src/types/database.types.ts` — Regenerated; now includes agent_outreach_log + whatsapp_inbound_events Row/Insert/Update types

## Decisions Made

- **agent_outreach_log SELECT-only RLS (no client write):** Service role writes via `createAdminClient`; mirrors `message_outbox` no-client-write pattern established in 04-01. Prevents tenant tampering with audit rows.
- **whatsapp_inbound_events no RLS (service-role only):** Mirrors `webhook_events` (T-5-04 accepted); `wamid UNIQUE` is the idempotency constraint consumed by 05-04.
- **Wave 0 scaffold style (source-inspection):** `existsSync` + `readFileSync` guards so `tsc --noEmit` stays clean across wave boundaries. Tests fail with self-documenting messages ("not yet created (05-02)") until target modules ship.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Converted Wave 0 scaffolds from direct-import to source-inspection style**
- **Found during:** Task 2 (post-db-push tsc verification)
- **Issue:** Original scaffolds used direct `import` from not-yet-existing modules (e.g., `src/lib/ai/tools.ts`). TypeScript compiler failed at import resolution even though tests were intended to be RED-by-design. `npx tsc --noEmit` exited non-zero, violating the plan's acceptance criteria.
- **Fix:** Rewrote all 4 `ai/*` test files to use `existsSync` + `readFileSync` source-inspection pattern. Tests now fail at runtime with a readable `expect(existsSync(...), '...not yet created (05-02)').toBe(true)` assertion instead of at compile time.
- **Files modified:** `src/__tests__/ai/tools.test.ts`, `src/__tests__/ai/chat-route.test.ts`, `src/__tests__/ai/whatsapp-inbound.test.ts`, `src/__tests__/ai/collection-agent.test.ts`
- **Verification:** `npx tsc --noEmit` exits 0; vitest reports 4 files as failed (expected RED-by-design)
- **Committed in:** `a5fa29b` (test — convert AI Wave 0 scaffolds to source-inspection)

---

**Total deviations:** 1 auto-fixed (Rule 1 — compile-time import bug in scaffolds)
**Impact on plan:** Essential for correctness — tsc must exit 0 for downstream plans to compile. No scope creep.

## Issues Encountered

- **Supabase CLI auth gate (recurring):** CLI was authenticated to wrong account (nexus-*). Required human re-login to org `kczvihafddupruvsrrsc` (FYNXIA project `jqjwyqlbbuqnrffdnlpp`) before `supabase db push` could run. Documented as recurring checkpoint pattern for all db push tasks.

## User Setup Required

Supabase CLI re-authentication was required as a human-action checkpoint (Task 2):
1. `supabase login` to confirm `jqjwyqlbbuqnrffdnlpp` visible under FYNXIA org
2. `supabase db push` (applied migrations 20260610000100/200/300)
3. `supabase gen types typescript --linked > src/types/database.types.ts`

This is a recurring gotcha — documented in STATE.md key decisions.

## Next Phase Readiness

**Ready for 05-02 (Copilot Chat API):** `database.types.ts` includes both new tables; `tsc --noEmit` exits 0; Wave 0 scaffolds define the exact behavioral contracts (`tools.test.ts`, `chat-route.test.ts`) that 05-02 must satisfy.

**Ready for 05-03 (Confirmation Agent):** `agent_outreach_log` table and types available; `confirmation-agent.test.ts` scaffold defines: must reference `TEMPLATE_APPOINTMENT_REMINDER` + `agent_outreach_log`.

**Ready for 05-04 (WhatsApp Inbound Webhook):** `whatsapp_inbound_events` (wamid UNIQUE) live; `whatsapp-inbound.test.ts` scaffold defines HMAC verifier, intent mapper, and dedup pattern.

**Ready for 05-05 (Collection Agent):** `agent_outreach_log` available; `collection-agent.test.ts` scaffold defines: `getInvoiceUrl` (no hardcoded URL), `getOutboxQueue`, `logBusinessEvent` required.

No blockers for Wave 2.

---
*Phase: 05-ai-agents*
*Completed: 2026-06-10*
