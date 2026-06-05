---
status: partial
phase: 01-auth-tenant-onboarding
source: [01-VERIFICATION.md]
started: 2026-06-05T00:00:00Z
updated: 2026-06-05T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Session persistence — JWT auto-refresh via updateSession
expected: Login persists across page navigations and after browser reopen
result: [pending]

### 2. RBAC redirect — receptionist cannot access /superadmin
expected: Navigating to /superadmin as receptionist redirects to /clinica
result: [pending]

### 3. users_masked view — email masking by role
expected: Querying users_masked as receptionist returns jo***@gmail.com; as admin returns full email
result: [pending]

### 4. Audit triggers fire on clinic signup
expected: audit_logs contains INSERT entries for clinics and users after signup
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
