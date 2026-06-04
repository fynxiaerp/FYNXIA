---
status: partial
phase: 00-foundation
source: [00-VERIFICATION.md]
started: 2026-06-04T00:00:00Z
updated: 2026-06-04T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live RLS verification — run rls-checks.sql in Supabase SQL Editor
expected: All 6 checks return expected results: C-1 no recursion, get_my_tenant_id prosecdef=true, get_my_role prosecdef=true, zero bare-TIMESTAMP columns, RLS enabled on tenants/users/audit_logs. For Check 6 (REVOKE EXECUTE), use corrected query from 00-REVIEW.md (original query has no-op bug).
result: [pending]

### 2. Post-build secret check — confirm SUPABASE_SERVICE_ROLE_KEY absent from client bundle
expected: Run `npm run build` then `grep -r "service_role" .next/static/` — returns nothing (C-2 closed live).
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
