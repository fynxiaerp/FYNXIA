---
phase: 18-crc-marketing
plan: 06
subsystem: api
tags: [nps, cron, outbox, whatsapp, resend, supabase, server-actions, toctou]

# Dependency graph
requires:
  - phase: 18-crc-marketing (Plan 01)
    provides: npsSubmitSchema (validators/crc.ts), classifyNps/computeNpsScore (roi-math.ts), TEMPLATE_NPS_INVITE/buildNpsInviteComponents (whatsapp/templates.ts)
  - phase: 18-crc-marketing (Plan 02)
    provides: nps_responses table (UNIQUE(appointment_id), UNIQUE(token)) + RLS (tenant_read + treat_update, no authenticated INSERT)
  - phase: 04-comunicacao (or earlier messaging plan)
    provides: message_outbox / OutboxQueue / drainOutbox (src/lib/messaging/)
  - phase: 02-cfo (anamnese)
    provides: public single-use token pattern (submitAnamnesisPublic atomic UPDATE discipline, WR-05)
provides:
  - "runNpsInviteScan: self-healing nightly scan of concluded appointments -> single-use nps_responses invite row + outbox enqueue (WhatsApp + email)"
  - "GET /api/cron/nps-scan: nightly cron (23:00 UTC), isCronAuthorized-gated, registered in vercel.json"
  - "submitNpsPublic: TOCTOU-safe atomic single-use public submit action (no session)"
  - "markDetractorTreated: closes the internal loop for detractor scores (D-15)"
  - "listNpsResponses / getNpsSummary: panel reads for the NPS dashboard (Plan 10 consumer)"
affects: [18-crc-marketing (Plan 10 - NPS panel UI, DetractorAlertBanner, NpsScoreCard), 18-crc-marketing (Plan 09 - approval inbox, unrelated but same phase)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-healing per-row dedup via a plain UNIQUE column + 23505-catch, instead of a date-window/expression index (avoids the Phase 17 42P17 immutable-index trap)"
    - "Public single-use token submit via one atomic conditional UPDATE (token_used_at IS NULL AND score IS NULL AND token_expires_at > now()) — the DB constraint IS the security boundary, not any page-level read"

key-files:
  created:
    - src/lib/crc/nps-scan.ts
    - src/app/api/cron/nps-scan/route.ts
    - src/actions/nps.ts
  modified:
    - vercel.json

key-decisions:
  - "Dedup implemented as direct INSERT + 23505 catch per appointment (no pre-check SELECT), matching the plan's exact contract and keeping the scan a single query + N inserts instead of a query + bulk-check + N inserts"
  - "NPS invite email uses the generic outbox fallback path (kind: 'nps_invite', html field) rather than a new React Email template component — no email template was specified in the plan and the worker's generic fallback (kind not matched -> emailPayload.html) already supports arbitrary HTML bodies"
  - "Cron scheduled at 23:00 UTC (20:00 BRT) per D-12 'à noite' and A4 (RESEARCH) — no conflict with the existing 7 crons (05:00-13:00 UTC)"

patterns-established:
  - "Cron route skeleton for Phase 18 mirrors /api/cron/collection-agent exactly (runtime='nodejs', isCronAuthorized, admin client, drainOutbox after the scan)"

requirements-completed: [CRC-04]

# Metrics
duration: 45min
completed: 2026-07-13
---

# Phase 18 Plan 06: NPS Collection (Invite Scan + Cron + Public Submit) Summary

**Self-healing nightly NPS invite scan (per-appointment UNIQUE dedup, no date-window index) feeding the WhatsApp/email outbox, plus a TOCTOU-safe single-use public submit action mirroring the anamnese token pattern.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-07-13T00:51:33Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `runNpsInviteScan` scans every `concluido` appointment (no date window — self-healing), creates a single-use `nps_responses` invite row per appointment, and enqueues a WhatsApp template + email invite via the Phase 4 outbox. Re-running the scan is safe: a `23505` on `UNIQUE(appointment_id)` is treated as "already invited" and skipped.
- Nightly cron `/api/cron/nps-scan` registered in `vercel.json` at 23:00 UTC (20:00 BRT), fail-closed on `isCronAuthorized`, and drains the outbox in the same invocation (mirrors `collection-agent`).
- `submitNpsPublic` is the public, session-less Server Action consumed by the future `/nps/[patient-id]/[token]` page (Plan 10) — the atomic conditional `UPDATE ... WHERE token_used_at IS NULL AND score IS NULL AND token_expires_at > now()` is the actual security boundary (TOCTOU-safe, mirrors `submitAnamnesisPublic` WR-05), never revealing the detractor classification on failure.
- `markDetractorTreated`, `listNpsResponses`, `getNpsSummary` complete the CRC-04 action surface: closing the internal loop for detractors (D-15) and feeding the NPS panel (Plan 10).

## Task Commits

Each task was committed atomically:

1. **Task 1: nps-scan.ts — self-healing invite scan + cron route + vercel.json** - `bbb6c7f` (feat)
2. **Task 2: nps.ts — public submit (TOCTOU-safe) + treatment + panel reads** - `a45d65f` (feat)

## Files Created/Modified
- `src/lib/crc/nps-scan.ts` - `runNpsInviteScan`: scans concluded appointments, creates single-use invite tokens, enqueues WhatsApp/email invites via the outbox
- `src/app/api/cron/nps-scan/route.ts` - nightly cron endpoint (isCronAuthorized + runNpsInviteScan + drainOutbox)
- `src/actions/nps.ts` - `submitNpsPublic`, `markDetractorTreated`, `listNpsResponses`, `getNpsSummary`
- `vercel.json` - added `/api/cron/nps-scan` at `0 23 * * *`

## Decisions Made
- Implemented the self-healing dedup as a direct `INSERT` per concluded appointment with a `23505`-catch, rather than pre-fetching an "already invited" set via a bulk query. This matches the plan's stated contract exactly (INSERT → on 23505 → skip) and keeps the DB constraint as the sole source of truth for dedup, eliminating any pre-check-then-insert race window.
- The NPS invite email leg uses the outbox worker's generic HTML fallback path (`payload.html`) instead of adding a new React Email component — no dedicated email template was specified in the plan or CONTEXT.md for NPS, and the generic path is already exercised by other Phase 18/4 email sends.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. (Meta WhatsApp Cloud API credentials, if still unverified, will cause the WhatsApp leg to fail-soft per the existing `drainOutbox`/`isPermanentError` handling — email leg is unaffected, per 18-RESEARCH.md Environment Availability.)

## Next Phase Readiness
- `submitNpsPublic` / `listNpsResponses` / `getNpsSummary` are ready for Plan 10's public `/nps/[patient-id]/[token]` page and the internal NPS panel (`NpsScoreCard`, `DetractorAlertBanner`).
- `TEMPLATE_NPS_INVITE` ('fynxia_pesquisa_nps') still requires external registration in Meta Business Manager as category UTILITY before live WhatsApp sends work (same pending step noted for all Phase 18 WhatsApp templates).
- No blockers for downstream Phase 18 plans.

---
*Phase: 18-crc-marketing*
*Completed: 2026-07-13*

## Self-Check: PASSED

- FOUND: src/lib/crc/nps-scan.ts
- FOUND: src/app/api/cron/nps-scan/route.ts
- FOUND: src/actions/nps.ts
- FOUND commit: bbb6c7f
- FOUND commit: a45d65f
