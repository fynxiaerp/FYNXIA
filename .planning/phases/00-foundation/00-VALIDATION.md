---
phase: 0
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler + ESLint + Next.js build |
| **Config file** | `tsconfig.json`, `.eslintrc.json` (created in Wave 1) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npm run lint && npm run build` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npm run lint && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green + manual JWT decode verification
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 0-01-01 | 01 | 1 | INFRA-01 | — | `src/` directory structure matches spec | file-check | `test -d src/app && test -d src/lib/supabase` | ❌ W0 | ⬜ pending |
| 0-01-02 | 01 | 1 | INFRA-01 | — | TypeScript strict mode enabled | compiler | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 0-01-03 | 01 | 1 | INFRA-02 | C-1 | `get_my_tenant_id()` SECURITY DEFINER exists in migration | grep | `grep -r "get_my_tenant_id" supabase/migrations/` | ❌ W0 | ⬜ pending |
| 0-01-04 | 01 | 1 | INFRA-02 | C-1 | No RLS policy queries `users` table directly | grep | `grep -r "FROM users" supabase/migrations/ && echo "FAIL" \|\| echo "OK"` | ❌ W0 | ⬜ pending |
| 0-01-05 | 01 | 1 | INFRA-03 | C-4 | `middleware.ts` calls `getUser()` not `getSession()` | grep | `grep "getUser" src/middleware.ts` | ❌ W0 | ⬜ pending |
| 0-01-06 | 01 | 1 | INFRA-03 | C-2 | `server-only` import in server Supabase client | grep | `grep "server-only" src/lib/supabase/server.ts` | ❌ W0 | ⬜ pending |
| 0-01-07 | 01 | 1 | INFRA-04 | C-2 | `SUPABASE_SERVICE_ROLE_KEY` not in NEXT_PUBLIC_ vars | grep | `grep -r "NEXT_PUBLIC_.*SERVICE_ROLE" . --include="*.ts" --include="*.env*" && echo "FAIL" \|\| echo "OK"` | ❌ W0 | ⬜ pending |
| 0-01-08 | 01 | 1 | INFRA-05 | — | `vercel.json` declares `"regions": ["gru1"]` | grep | `grep "gru1" vercel.json` | ❌ W0 | ⬜ pending |
| 0-01-09 | 01 | 1 | INFRA-06 | — | All timestamp columns use TIMESTAMPTZ | grep | `grep -r "TIMESTAMP " supabase/migrations/ && echo "FAIL: found TIMESTAMP without TZ" \|\| echo "OK"` | ❌ W0 | ⬜ pending |
| 0-01-10 | 01 | 1 | SEC-07 | — | audit_logs table created with immutable DELETE policy | grep | `grep "audit_logs" supabase/migrations/ -A5` | ❌ W0 | ⬜ pending |
| 0-01-11 | 01 | 1 | SEC-08 | — | `lib/crypto.ts` exports `encrypt` and `decrypt` functions | grep | `grep -E "export.*encrypt\|export.*decrypt" src/lib/crypto.ts` | ❌ W0 | ⬜ pending |
| 0-01-12 | 01 | 1 | INFRA-07 | — | Custom Access Token Hook function exists in migration | grep | `grep -r "custom_access_token_hook\|inject_tenant_claims" supabase/migrations/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tsconfig.json` with `"strict": true` — required for tsc --noEmit to catch type errors
- [ ] `package.json` with `"lint"` script — required for `npm run lint`
- [ ] `supabase/` directory with migrations folder — required for grep-based schema verification

*Note: Wave 0 in Phase 0 IS the scaffold task. The create-next-app bootstrap creates these files. Verification commands only become meaningful after Wave 1 completes.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| JWT contains `tenant_id` + `user_role` claims | INFRA-07 | Requires live Supabase Auth + registered Hook + test login | 1. Create test user, 2. Sign in, 3. Copy JWT, 4. Decode at jwt.io, 5. Verify `app_metadata.tenant_id` and `app_metadata.user_role` are present |
| Supabase project is in sa-east-1 region | INFRA-05 | Dashboard-only verification, no API | Log into Supabase dashboard → Project Settings → General → confirm region = "South America (São Paulo)" |
| Custom Access Token Hook registered in dashboard | INFRA-07 | Hooks registration is UI-only (no CLI) | Supabase dashboard → Authentication → Hooks → verify `custom_access_token_hook` is listed and enabled |
| `SUPABASE_SERVICE_ROLE_KEY` absent from `.next/static/` | SEC (C-2) | Build artifact inspection | After `npm run build`, run: `grep -r "service_role" .next/static/ && echo "LEAK DETECTED" \|\| echo "CLEAN"` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
