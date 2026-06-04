---
phase: 01
slug: auth-tenant-onboarding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Next.js 16 project uses vitest) |
| **Config file** | vitest.config.ts (Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-01 | T-01-01 | Signup creates row in public.clinics with correct tenant_id | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | AUTH-02 | T-01-02 | JWT refresh works via proxy.ts updateSession | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | AUTH-03 | — | Logout clears session and redirects to /login | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | AUTH-04 | T-01-04 | proxy.ts calls getUser() never getSession() | grep | `grep -r "getSession" src/proxy.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | AUTH-05 | T-01-05 | Role-based routing blocks forbidden routes | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 2 | AUTH-06 | T-01-06 | Tenant A cannot see Tenant B data via RLS | manual | SQL Editor rls-checks | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 2 | AUTH-07 | T-01-07 | tenant_id comes from public.users not user_metadata | grep | `grep -r "user_metadata" src/` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 3 | SEC-01 | T-01-08 | Masked view returns 123.***.***-** format | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 3 | SEC-02 | T-01-09 | audit_logs trigger fires on INSERT/UPDATE to clinics+users | manual | SQL Editor | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 3 | SEC-05 | — | patient_consents table exists with required columns | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — install and configure vitest for Next.js 16
- [ ] `src/__tests__/auth/signup.test.ts` — stubs for AUTH-01..03
- [ ] `src/__tests__/auth/rbac.test.ts` — stubs for AUTH-05
- [ ] `src/__tests__/security/masking.test.ts` — stubs for SEC-01

*Wave 0 is Plan 01, Task 0 (setup test infrastructure before feature work)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tenant isolation (RLS) — Tenant A cannot see Tenant B rows | AUTH-06 | Requires live DB with two tenants and authenticated sessions | Run rls-checks.sql with two test users in different tenants; verify cross-tenant SELECT returns 0 rows |
| audit_logs trigger fires on INSERT/UPDATE | SEC-02 | Requires live DB; trigger inspection needs SQL Editor | INSERT a test user, then SELECT from audit_logs WHERE actor_id = ... verify entry exists |
| Invite email arrives and link works (24h) | AUTH-02 | Email delivery is external; requires manual inbox check | Send test invite, check Resend dashboard, verify link opens /auth/confirm and completes signup |
| CNPJ validation (check digit) | AUTH-01 | Requires live input testing | Enter invalid CNPJ (wrong check digit) in signup form; verify Zod rejects with correct message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
