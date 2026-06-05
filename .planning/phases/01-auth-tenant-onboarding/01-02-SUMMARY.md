---
phase: 01-auth-tenant-onboarding
plan: "02"
subsystem: auth
tags: [auth, rbac, server-actions, zod, react-hook-form, cpf-cnpj, proxy, supabase-ssr, lgpd]
dependency_graph:
  requires:
    - src/lib/supabase/client.ts (browser client from Phase 0)
    - src/lib/supabase/server.ts (server client from Phase 0)
    - src/lib/supabase/admin.ts (service-role client from Phase 0)
    - src/lib/supabase/middleware.ts (updateSession helper from Phase 0)
    - public.clinics (table from Plan 01-01 rename migration)
    - public.users (table from Phase 0 + Plan 01-01 with role/tenant_id)
    - public.audit_logs (partitioned table from Phase 0)
    - src/types/database.types.ts (types from Plan 01-01)
  provides:
    - src/lib/validators/auth.ts (loginSchema, signupSchema z.union CPF/CNPJ, inviteSchema, resetPasswordSchema, forgotPasswordSchema)
    - src/lib/validators/clinic.ts (clinicSettingsSchema placeholder)
    - src/lib/audit.ts (logBusinessEvent with required tenantId)
    - src/actions/auth.ts (signUpClinic, signIn, signOut, sendPasswordReset, updatePassword Server Actions)
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/signup/page.tsx
    - src/app/(auth)/forgot-password/page.tsx
    - src/app/(auth)/reset-password/page.tsx
    - src/components/auth/SignupForm.tsx
    - src/components/auth/LoginForm.tsx
    - src/components/auth/ForgotPasswordForm.tsx
    - src/app/auth/confirm/route.ts (verifyOtp token_hash exchange for invite+recovery)
    - src/app/(dashboard)/clinica/page.tsx (redirect target with signOut + x-user-role header)
    - src/proxy.ts (ROLE_ROUTES matrix + isPathAllowed + x-user-role request header)
    - src/__tests__/auth/auth.test.ts (14 validator + Server Action export tests)
    - src/__tests__/proxy/rbac.test.ts (24 RBAC + content assertion tests)
  affects:
    - All authenticated routes now gated by ROLE_ROUTES in proxy.ts
    - Server Components can read x-user-role via headers().get('x-user-role') without extra DB call
    - Signup flow creates clinics + users rows atomically with compensating rollback on failure
tech_stack:
  added:
    - react-hook-form@7.x (form state management)
    - zod@3.x (schema validation — pinned to v3 per STATE.md decision)
    - "@hookform/resolvers@5.x" (RHF ↔ Zod bridge)
    - resend@6.x (email sending — added to .env.local.example)
    - cpf-cnpj-validator@2.1.2 (Brazilian CPF/CNPJ check-digit validation with Zod adapter)
  patterns:
    - Server Actions with 'use server' + Zod safeParse for input validation
    - Compensating rollback pattern for multi-step atomic signup (deleteUser + delete clinic)
    - TDD: RED test file committed before implementation; GREEN after
    - isPathAllowed() pure helper extracted from proxy.ts for unit testability
    - Request header forwarding (x-user-role/x-user-id) in proxy.ts for Server Components
    - PKCE token_hash exchange via /auth/confirm route (invite + recovery flows)
key_files:
  created:
    - src/lib/validators/auth.ts
    - src/lib/validators/clinic.ts
    - src/lib/audit.ts
    - src/actions/auth.ts
    - src/components/auth/SignupForm.tsx
    - src/components/auth/LoginForm.tsx
    - src/components/auth/ForgotPasswordForm.tsx
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/signup/page.tsx
    - src/app/(auth)/forgot-password/page.tsx
    - src/app/(auth)/reset-password/page.tsx
    - src/app/auth/confirm/route.ts
    - src/app/(dashboard)/clinica/page.tsx
    - src/__tests__/auth/auth.test.ts
    - src/__tests__/proxy/rbac.test.ts
  modified:
    - src/proxy.ts (extended with ROLE_ROUTES + isPathAllowed + role DB call + request header forwarding)
    - .env.local.example (added NEXT_PUBLIC_SITE_URL + RESEND_API_KEY)
    - package.json (added react-hook-form, zod, @hookform/resolvers, resend, cpf-cnpj-validator)
decisions:
  - "signupSchema uses z.union([zCpf(), zCnpj()]) accepting both CPF (individual dentist) and CNPJ (clinic) in the document field — addresses RESEARCH.md Open Question 3"
  - "signUpClinic uses admin.auth.admin.createUser with email_confirm:true — no email gate per D-03; compensating rollback (deleteUser + delete clinic) on partial failure (T-01-01)"
  - "proxy.ts queries .from('users').select('role') directly (not RPC get_my_role) — avoids PostgREST HTTP hop; user JWT context via createClient() ensures RLS applies"
  - "x-user-role forwarded as REQUEST header (new Headers + NextResponse.next({request:{headers}})) — not supabaseResponse.headers (response headers not readable by Server Components via next/headers)"
  - "isPathAllowed() extracted as exported pure function for testability without spinning up Next.js request context"
  - "reset-password/page.tsx is a Client Component (uses React Hook Form) — acceptable because the page is reached after /auth/confirm token exchange which establishes the session"
metrics:
  duration_minutes: 45
  tasks_completed: 3
  tasks_total: 3
  files_created: 15
  files_modified: 3
  completed_date: "2026-06-04"
---

# Phase 1 Plan 2: Auth Lifecycle + RBAC Routing Summary

**One-liner:** Full self-service auth lifecycle (signup with CPF/CNPJ validation + atomic clinic provisioning, login, logout, password reset) with RHF+Zod v3 forms, PKCE /auth/confirm route, and role-based routing matrix in proxy.ts forwarding x-user-role request headers to Server Components.

## What Was Built

### Task 1: Zod Validators + Auth Server Actions + Audit Helper (TDD)

Tests written RED first, implementation GREEN, 14/14 passing.

**`src/lib/validators/auth.ts`**
- `loginSchema`: email + min-8-char password
- `signupSchema`: clinicName + email + password + `document` (z.union CPF/CNPJ via cpf-cnpj-validator zodValidator) + phone
- `inviteSchema`: email + role enum
- `resetPasswordSchema`, `forgotPasswordSchema`: password / email respectively
- All types exported: `LoginInput`, `SignupInput`, `InviteInput`, `ResetPasswordInput`, `ForgotPasswordInput`

**`src/lib/validators/clinic.ts`**
- `clinicSettingsSchema`: name (required), phone/address/specialty (optional) — placeholder for settings UI

**`src/lib/audit.ts`**
- `logBusinessEvent({ tenantId, actorId, action, details })`: inserts into `audit_logs` via service role; `tenantId` is required (non-optional) per Pitfall 4

**`src/actions/auth.ts`** (Server Actions — `'use server'`)
- `signUpClinic(formData)`: parse → admin.createUser(email_confirm:true) → insert clinics row → insert users row (role=admin) → signInWithPassword → redirect('/clinica'); compensating rollback on any partial failure (T-01-01)
- `signIn(formData)`: parse loginSchema → signInWithPassword → redirect('/clinica') or return error
- `signOut()`: supabase.auth.signOut() → redirect('/login')
- `sendPasswordReset(email)`: resetPasswordForEmail with redirectTo pointing to /auth/confirm?type=recovery
- `updatePassword(formData)`: updateUser({password}) → redirect('/clinica')
- Zero occurrences of `getSession` anywhere

### Task 2: Auth Pages + Forms + /auth/confirm + /clinica Landing

**Client Components (RHF + zodResolver):**
- `SignupForm.tsx`: 5 fields (clinicName, email, password, document, phone), calls `signUpClinic` via startTransition, shows field-level errors, FYNXIA branding
- `LoginForm.tsx`: email + password, calls `signIn`, links to /signup + /forgot-password
- `ForgotPasswordForm.tsx`: email field, calls `sendPasswordReset`, shows success state after send

**Server Component page wrappers:**
- `/login`, `/signup`, `/forgot-password`: thin wrappers rendering respective form components
- `/reset-password`: Client Component page with resetPasswordSchema form calling `updatePassword`

**`/auth/confirm/route.ts`**: GET handler reads token_hash + type + redirect_to; calls `verifyOtp({token_hash, type})`; on success redirects to origin+next; on failure redirects to /login?error=invalid_token. Supports `invite` and `recovery` types.

**`/clinica/page.tsx`**: Server Component; reads `x-user-role` from request headers (no extra DB call); queries clinics table (RLS-scoped); renders clinic name, role, and a "Sair" form button wired to `signOut` Server Action.

**`npm run build` output:** All 9 routes compiled successfully (/, /api/health, /auth/confirm, /clinica, /forgot-password, /login, /reset-password, /signup, /_not-found).

### Task 3: Role-Based Routing Matrix in proxy.ts

**`ROLE_ROUTES` matrix (D-07):**
```
admin:        ['/clinica', '/perfil', '/config', '/superadmin']
dentist:      ['/clinica', '/perfil']
receptionist: ['/clinica', '/perfil']
patient:      ['/paciente', '/perfil']
superadmin:   ['/clinica', '/perfil', '/config', '/superadmin', '/paciente']
```

**`isPathAllowed(role, pathname)`**: exported pure function; checked against ROLE_ROUTES prefixes; defaults to patient-level access for unknown roles.

**Public route exemptions (Pitfall 5):** `/invite/*`, `/agendar/*`, `/auth/confirm` — no auth or role checks applied.

**Role DB call pattern:** `createClient().from('users').select('role').eq('id', user.id).single()` — single DB call per request using user JWT context (not RPC, not user_metadata).

**Request header forwarding:** `new Headers(request.headers)` + `requestHeaders.set('x-user-role', role)` + `requestHeaders.set('x-user-id', user.id)` + `NextResponse.next({ request: { headers: requestHeaders } })` — request headers are readable by Server Components via `next/headers`; response headers are not.

**Test coverage:** 24 tests in `src/__tests__/proxy/rbac.test.ts` covering ROLE_ROUTES matrix assertions, isPathAllowed true/false cases for all roles, and source content assertions (no getSession, contains ROLE_ROUTES, contains .select('role'), marks /invite + /agendar + /auth/confirm as public).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error in reset-password/page.tsx**
- **Found during:** Task 2 `npx tsc --noEmit` verification
- **Issue:** `updatePassword` returns `{ error: string | ZodFormattedError<...> }` — passing `result.error` directly to `setError('root', { message })` failed because `message` expects `string | undefined`, not `ZodFormattedError`
- **Fix:** Added `typeof result.error === 'string' ? result.error : 'Erro ao atualizar senha.'` guard before passing to setError
- **Files modified:** `src/app/(auth)/reset-password/page.tsx`
- **Commit:** included in 65236be

**2. [Rule 3 - Blocking] Added vi.mock for server-only + @supabase/ssr in rbac.test.ts**
- **Found during:** Task 3 first test run
- **Issue:** `proxy.ts` imports `createClient` from `@/lib/supabase/server` which has `import 'server-only'`; vitest node environment cannot import it without mocking
- **Fix:** Added `vi.mock('server-only', () => ({}))` + mocks for `@/lib/supabase/server` and `@/lib/supabase/middleware` in rbac.test.ts (same pattern as auth.test.ts)
- **Files modified:** `src/__tests__/proxy/rbac.test.ts`
- **Commit:** included in 0f69c17

## Known Stubs

None — all data flows are wired:
- SignupForm → signUpClinic → public.clinics + public.users (live DB)
- LoginForm → signIn → Supabase Auth (live)
- clinica/page → queries clinics via RLS (live, x-user-role from proxy)
- /auth/confirm → verifyOtp (live Supabase Auth)

The only "placeholder" is `clinicSettingsSchema` in `src/lib/validators/clinic.ts` — this is intentional and documented as a placeholder for Phase 2 settings UI. It does not block any plan goal.

## Threat Flags

No new threat surface beyond the plan's `<threat_model>`. All seven STRIDE mitigations applied:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-01-01 | compensating rollback in signUpClinic (deleteUser + delete clinic) |
| T-01-02 | proxy updateSession() calls getUser() — JWT validated against Supabase Auth server |
| T-01-04 | getSession() forbidden — grep across all src/ returns 0 matches in actual code |
| T-01-05 | ROLE_ROUTES + isPathAllowed in proxy.ts; receptionist/dentist cannot reach /superadmin |
| T-01-12 | Zod min(8) password + cpf-cnpj-validator check-digit validation in signupSchema |
| T-01-13 | tenant_id/role written only to public.users via admin client; no user_metadata usage |
| T-01-14 | /invite, /agendar, /auth/confirm exempt from auth redirect (Pitfall 5) |

## Self-Check: PASSED

### Files verified to exist:
- src/lib/validators/auth.ts — FOUND
- src/lib/validators/clinic.ts — FOUND
- src/lib/audit.ts — FOUND
- src/actions/auth.ts — FOUND
- src/components/auth/SignupForm.tsx — FOUND
- src/components/auth/LoginForm.tsx — FOUND
- src/components/auth/ForgotPasswordForm.tsx — FOUND
- src/app/(auth)/login/page.tsx — FOUND
- src/app/(auth)/signup/page.tsx — FOUND
- src/app/(auth)/forgot-password/page.tsx — FOUND
- src/app/(auth)/reset-password/page.tsx — FOUND
- src/app/auth/confirm/route.ts — FOUND
- src/app/(dashboard)/clinica/page.tsx — FOUND
- src/__tests__/auth/auth.test.ts — FOUND
- src/__tests__/proxy/rbac.test.ts — FOUND

### Commits verified:
- 8a25d78 — feat(01-02): Zod validators + auth Server Actions + audit helper
- 65236be — feat(01-02): Auth pages + forms + /auth/confirm route + /clinica landing
- 0f69c17 — feat(01-02): Role-based routing matrix in proxy.ts (D-06/D-07/D-08)

### Verification commands passed:
- `npx vitest run src/__tests__` — 41/41 tests GREEN (3 test files)
- `npx tsc --noEmit` — exit 0
- `npm run build` — succeeded (9 routes compiled)
- `grep "getSession" src/proxy.ts` — no matches (exit 1 = not found)
- `grep -r "user_metadata" src/` — no matches
