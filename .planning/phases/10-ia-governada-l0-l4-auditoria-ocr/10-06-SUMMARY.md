# Phase 10 Plan 06: [BLOCKING] DB Push + Type Regen — Summary

**One-liner:** Applied the 4 governance/audit/OCR migrations to the live Supabase DB and regenerated types (guarded). Fixed a 'use server' build error surfaced post-push.

## Task
| Task | Result |
|------|--------|
| [BLOCKING] supabase db push + gen types | 4 migrations applied (re-auth gotcha recurred → user re-logged to org kczvihafddupruvsrrsc); types regenerated via temp-file guard (2524 lines; ai_decision_log/approval_requests/ocr_extractions present) |

## Migrations applied (live)
- 20260616000100_ai_decision_log.sql (immutable, INSERT-only RLS)
- 20260616000200_approval_requests.sql (unified queue, idempotency partial unique, executed_at/expires_at)
- 20260616000300_ocr_extractions.sql (review queue, soft-delete)
- 20260616000400_audit_logs_indexes.sql (table_name + record_id indexes, IF NOT EXISTS partitions)

## Post-push build fix
- `next build` (Turbopack) flagged `approval-actions.ts` re-exporting the sync `canApprove` ('use server' files may only export async) → removed the re-export; `approvals.test.ts` now imports canApprove from `policy-types.ts`. tsc 0, build green, 19/19 approvals tests green.

## Verification
- 4/4 migrations applied; types regenerated guarded; 109 governance/audit/ocr/migration tests GREEN; `next build` green (/conformidade/auditoria present)

## Self-Check: PASSED
