---
phase: 01-auth-tenant-onboarding
plan: "03"
subsystem: invitations
tags: [resend, react-email, server-actions, invitations, rbac, lgpd, audit, patient-infra]
dependency_graph:
  requires:
    - public.invitations (table from Plan 01-01 migration)
    - public.clinics (renamed table from Plan 01-01)
    - public.users (table from Phase 0 + Plan 01-01)
    - public.audit_logs (partitioned table from Phase 0)
    - src/lib/audit.ts (logBusinessEvent from Plan 01-02)
    - src/lib/supabase/admin.ts (createAdminClient from Phase 0)
    - src/lib/supabase/server.ts (createClient from Phase 0)
    - src/lib/validators/auth.ts (inviteSchema from Plan 01-02)
    - src/proxy.ts (public route exemptions for /invite/* from Plan 01-02)
  provides:
    - src/lib/resend.ts (Resend client singleton + FROM_EMAIL)
    - src/emails/InviteEmail.tsx (FYNXIA-branded react-email invite template)
    - src/emails/PasswordResetEmail.tsx (FYNXIA-branded password reset template)
    - src/lib/validators/invitation.ts (createInviteSchema + patientSelfRegisterSchema + acceptInvitationSchema)
    - src/actions/invitations.ts (createInvitation, acceptInvitation, revokeInvitation Server Actions)
    - src/app/api/invitations/route.ts (public POST patient self-register endpoint D-10)
    - src/app/invite/[token]/page.tsx (public invite accept page)
    - src/app/invite/[token]/InviteAcceptForm.tsx (Client Component accept form)
    - src/components/invitations/InviteForm.tsx (admin invite form component)
    - src/app/(dashboard)/clinica/equipe/page.tsx (admin team management page)
  affects:
    - Admin team workflow: /clinica/equipe provides invite entry point
    - Patient account infrastructure: POST /api/invitations enables /agendar self-register in Phase 2
    - Audit trail: INVITE_SENT, INVITE_ACCEPTED, INVITE_REVOKED, USER_CREATED_DIRECT, PATIENT_SELF_REGISTER_REQUEST events
tech_stack:
  added:
    - "@react-email/components@1.0.12" (email template components)
    - "react-email@3.x" (email development tooling)
  patterns:
    - Server Action with Zod safeParse + admin role check before any DB write
    - Compensating rollback on partial failure (createUser + rollback on userRow insert failure)
    - Re-invite invalidation via UPDATE status='revoked' before INSERT (D-05 single-pending guarantee)
    - Token-based invite redemption: token in invitations row; role from DB row (never from client input — T-01-17)
    - Public API route with runtime='nodejs' for patient self-register (D-10)
    - Server Component reads x-user-role from request header (set by proxy.ts — no extra DB call)
    - react-email components with Flexbox-only layout (anti-pattern: no CSS Grid)
key_files:
  created:
    - src/lib/resend.ts
    - src/emails/InviteEmail.tsx
    - src/emails/PasswordResetEmail.tsx
    - src/lib/validators/invitation.ts
    - src/actions/invitations.ts
    - src/app/api/invitations/route.ts
    - src/app/invite/[token]/page.tsx
    - src/app/invite/[token]/InviteAcceptForm.tsx
    - src/components/invitations/InviteForm.tsx
    - src/app/(dashboard)/clinica/equipe/page.tsx
    - src/__tests__/auth/invitations.test.ts
  modified:
    - .env.local.example (added RESEND_FROM_EMAIL)
    - package.json (added @react-email/components, react-email)
    - src/components/auth/SignupForm.tsx (show actual server error — fix 79230d1)
    - src/actions/invitations.ts (expose actual Resend error — fix 31f3f27)
    - src/proxy.ts (add /api/invitations to public routes — fix d1b9468)
decisions:
  - "createUser() path (not inviteUserByEmail) chosen for invite flow — no Supabase native email; app manages token in invitations table; Resend sends FYNXIA-branded email only (D-16, additional_decisions)"
  - "Invite token stored in invitations.token (UUID gen_random_uuid); acceptInvitation validates status=pending AND expires_at >= now() (T-01-16)"
  - "Role for accepted user taken from invitation row, never from client input at acceptance time (T-01-17)"
  - "Public /api/invitations resolves clinic by slug + finds clinic admin user as invited_by FK (no system actor UUID needed)"
  - "Re-invite flow: UPDATE status='revoked' WHERE status='pending' THEN INSERT new pending row — partial unique index (tenant_id,email) WHERE status='pending' prevents duplicates"
  - "InviteAcceptForm is a Client Component co-located in app/invite/[token]/ — acceptable for a public one-time-use page"
metrics:
  duration_minutes: 75
  tasks_completed: 4
  tasks_total: 4
  files_created: 11
  files_modified: 4
  completed_date: "2026-06-05"
---

# Phase 1 Plan 3: Invite Lifecycle + Email Templates + Team Page Summary

**One-liner:** Full member-entry lifecycle with Resend-delivered FYNXIA-branded invite emails, two react-email templates, createInvitation (email+direct) / acceptInvitation / revokeInvitation Server Actions with SEC-02 audit logging on all paths, public POST /api/invitations for patient self-registration, /invite/[token] accept page, and the /clinica/equipe admin team page with InviteForm.

## What Was Built

### Task 1: Resend wrapper + FYNXIA-branded email templates + invitation validators

**`src/lib/resend.ts`** — `import 'server-only'`; exports `resend` (Resend singleton keyed by `RESEND_API_KEY`) and `FROM_EMAIL` (defaults to `FYNXIA <onboarding@resend.dev>` for dev, overridden via `RESEND_FROM_EMAIL` env var for production domain).

**`src/emails/InviteEmail.tsx`** — FYNXIA-branded react-email template using `@react-email/components`. Props: `inviterName`, `clinicName`, `inviteUrl`, `role`, `expiresInHours`. Layout: slate-900 header with FYNXIA logotype, body with clinic name + role label (mapped to pt-BR labels), centered CTA Button, expiry notice, fallback URL for copy-paste, and a footer. Flexbox-only layout (no CSS Grid — anti-pattern per CLAUDE.md).

**`src/emails/PasswordResetEmail.tsx`** — Matching FYNXIA-branded template for password reset. Props: `resetUrl`, `expiresInHours`. Provided for use when `sendPasswordReset` in auth.ts is wired to Resend.

**`src/lib/validators/invitation.ts`** — Three Zod schemas:
- `createInviteSchema`: email + role enum + mode enum ('email'|'direct') + optional tempPassword; `.refine()` enforces tempPassword >= 8 when mode='direct'
- `patientSelfRegisterSchema`: clinicSlug + email + fullName
- `acceptInvitationSchema`: password (min 8) for the invite accept form

**`@react-email/components@1.0.12`** + `react-email@3.x` installed. `npx tsc --noEmit` exits 0.

### Task 2: Invitation Server Actions + patient self-register API + accept page

**`src/actions/invitations.ts`** (`'use server'`) — Three exported Server Actions:

**`createInvitation(input)`:**
- Parses `createInviteSchema`; gets current user via `createClient().auth.getUser()` + their actor row from `public.users`
- Server-side role guard: only `admin` or `superadmin` may proceed (RLS also enforces on the DB side)
- `mode='email'`: UPDATEs existing pending invites for (tenant_id, email) to `status='revoked'` (D-05 re-invite invalidation); INSERTs new pending invitation row; builds `inviteUrl = ${SITE_URL}/invite/${token}`; sends via `resend.emails.send({ react: InviteEmail({...}) })`; rolls back invitation on email send failure; calls `logBusinessEvent({ action: 'INVITE_SENT' })` (SEC-02)
- `mode='direct'`: `createAdminClient().auth.admin.createUser({ email_confirm: true })`; INSERTs `public.users` row; INSERTs invitation row with `status='accepted'`; compensating rollback (deleteUser) on `public.users` insert failure; calls `logBusinessEvent({ action: 'USER_CREATED_DIRECT' })` (SEC-02)

**`acceptInvitation(token, password)`:**
- Looks up invitation by token (admin client for public page access)
- Rejects non-pending (`status !== 'pending'` → error)
- Rejects expired (`expires_at < now()` → UPDATE to `status='expired'` + error) — T-01-16
- `createAdminClient().auth.admin.createUser({ email_confirm: true })` with email from DB row
- INSERTs `public.users` with role from **invitation row** (never from client input — T-01-17)
- UPDATEs invitation `status='accepted'`, `accepted_at=now()`
- `logBusinessEvent({ action: 'INVITE_ACCEPTED' })` (SEC-02)
- Signs in the new user with `createClient().auth.signInWithPassword`
- Redirects to `/paciente` for patients, `/clinica` for all other roles

**`revokeInvitation(id)`:**
- Role-checks current user (admin/superadmin only)
- UPDATEs with tenant_id scope guard (prevents cross-tenant revoke)
- `logBusinessEvent({ action: 'INVITE_REVOKED' })` (SEC-02)

**logBusinessEvent call count:** 5 occurrences in file (1 import + 4 call sites — INVITE_SENT, USER_CREATED_DIRECT, INVITE_ACCEPTED, INVITE_REVOKED).

**`src/app/api/invitations/route.ts`** (`runtime='nodejs'`, public POST — D-10):
- Parses `patientSelfRegisterSchema`
- Resolves clinic by `slug` (admin client, `deleted_at IS NULL`)
- Revokes any existing pending invite for same tenant+email
- Finds clinic admin user as `invited_by` FK (required by invitations table constraint)
- INSERTs `status='pending', role='patient'`
- `logBusinessEvent({ action: 'PATIENT_SELF_REGISTER_REQUEST' })`
- Returns 201 `{ requestId, message }` or 4xx/5xx `{ error }`

**`src/app/invite/[token]/page.tsx`** (Server Component, public — Pitfall 5 exempt):
- Reads token param (`params.Promise<{ token }>` for Next.js 16 async params)
- Looks up invitation (admin client — no user session required)
- Resolves clinic name for display
- Invalid/expired → error state with "Convite inválido ou expirado" message
- Valid → shows clinic name + role label + `InviteAcceptForm` Client Component

**`src/app/invite/[token]/InviteAcceptForm.tsx`** (Client Component):
- RHF + `acceptInvitationSchema` zodResolver
- Email field is read-only + disabled (T-01-17 — role from DB, email shown but not editable)
- Password input with min-8 validation
- Calls `acceptInvitation(token, data.password)`; on success the redirect() in the Server Action unmounts the component

**`src/__tests__/auth/invitations.test.ts`** — 18 tests GREEN:
- `createInviteSchema`: email mode (valid/invalid email, invalid role), direct mode (no tempPassword, short password, valid)
- All 4 valid roles accepted in direct mode
- `patientSelfRegisterSchema`: valid payload, empty slug, invalid email, short fullName
- Export assertions: `createInvitation`, `acceptInvitation`, `revokeInvitation` are functions
- `createInvitation` input validation: returns `success=false` for invalid email, missing tempPassword, unauthenticated user

### Task 3: Admin team page with InviteForm

**`src/components/invitations/InviteForm.tsx`** (`'use client'`) — RHF form with `createInviteSchema`:
- Mode radio buttons: "Convite por e-mail" | "Criação direta"
- Email input + role select (admin/dentist/receptionist/patient)
- Conditional `tempPassword` field rendered only when `mode === 'direct'` (via `watch('mode')`)
- Calls `createInvitation(data)` via `startTransition`
- Shows localized success message (different for email vs direct) and error state
- Calls `onSuccess?.()` callback after success

**`src/app/(dashboard)/clinica/equipe/page.tsx`** (Server Component):
- Reads `x-user-role` from request headers (set by proxy.ts — no extra DB call per RESEARCH.md Pattern 2)
- `isAdmin = role === 'admin' || role === 'superadmin'`
- Fetches pending invitations via `createClient().from('invitations').select(...).eq('status','pending')` (RLS-scoped to caller's tenant)
- Renders `InviteForm` for admins; amber-background notice for non-admins
- Pending invitations table showing email, role (pt-BR label), status badge, expiry date
- Placeholder note: "Full team management (edit/remove members) available in Phase 2"

**`npm run build`** — 13 routes compiled successfully:
- `/clinica/equipe` (dynamic — Server Component)
- `/invite/[token]` (dynamic — Server Component)
- `/api/invitations` (dynamic — route handler, nodejs runtime)

### Task 4: Human verification — CLEARED

All 7 verification steps passed by the user:

1. Signup — clinic + admin created, redirect to /clinica
2. Email invite — Resend delivered FYNXIA-branded invite to real inbox
3. Accept invite — dentist logged in with correct Perfil: Dentist and RBAC
4. Re-invite — previous invite revoked, new one sent (single-pending enforced)
5. Direct creation — receptionist created without email, account functional at /login
6. Public API — `POST /api/invitations` returned 201 with correct requestId
7. Audit logs — INVITE_SENT, INVITE_ACCEPTED, USER_CREATED_DIRECT, PATIENT_SELF_REGISTER_REQUEST all present with correct tenant_id

Three bug fixes were applied during verification (documented in Deviations below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] InviteAcceptForm co-located in app/invite/[token]/ directory**
- **Found during:** Task 2 implementation
- **Issue:** The plan listed `src/app/invite/[token]/page.tsx` as a Server Component that "renders a client form", but the task files list did not include an `InviteAcceptForm.tsx`. Client Components cannot be inlined into the `page.tsx` file as default exports without explicit 'use client'.
- **Fix:** Created `src/app/invite/[token]/InviteAcceptForm.tsx` as a co-located Client Component; `page.tsx` imports and renders it. This is the standard Next.js pattern for mixed Server/Client composition.
- **Files created:** `src/app/invite/[token]/InviteAcceptForm.tsx`

**2. [Rule 2 - Missing Critical Functionality] Added email send failure rollback**
- **Found during:** Task 2 `createInvitation` implementation review
- **Issue:** If `resend.emails.send()` fails after the invitation row is inserted, the row would remain as `status='pending'` but no email was ever sent — the user could not redeem it, and the re-invite mechanism would consider the prior invite already revoked.
- **Fix:** On email send failure, UPDATE the newly inserted invitation to `status='revoked'` before returning `{ error }`. This prevents orphaned pending invitations.
- **Files modified:** `src/actions/invitations.ts`

**3. [Rule 2 - Missing Critical Functionality] public API required valid invited_by FK**
- **Found during:** Task 2 POST /api/invitations implementation
- **Issue:** The invitations table has `invited_by UUID NOT NULL REFERENCES public.users(id)`. A patient self-register request has no authenticated actor. The plan said "invited_by = clinic owner or NULL-safe system actor" — but the column is NOT NULL.
- **Fix:** The route resolves the clinic admin user (`role='admin'` for the tenant) and uses that ID as `invited_by`. This is semantically correct: the clinic admin implicitly owns all pending patient requests until a receptionist confirms in Phase 2.
- **Files modified:** `src/app/api/invitations/route.ts`

### Fixes Applied During Human Verification (Task 4)

**4. [Rule 1 - Bug] SignupForm showed generic error instead of server error**
- **Found during:** Task 4 verification — step 1 (signup)
- **Issue:** `src/components/auth/SignupForm.tsx` returned a hardcoded generic error message instead of propagating the actual server error from the `signup` Server Action. When signup failed (e.g., email already exists), users saw a useless generic message.
- **Fix:** Updated `SignupForm.tsx` to display the actual `result.error` string returned by the action.
- **Files modified:** `src/components/auth/SignupForm.tsx`
- **Commit:** `79230d1` — fix(01-02): show actual server error in signup form instead of generic message

**5. [Rule 1 - Bug] Invite failure masked actual Resend error**
- **Found during:** Task 4 verification — step 2 (email invite)
- **Issue:** `createInvitation` in `invitations.ts` swallowed the Resend API error and returned a generic "Erro ao enviar e-mail de convite" message with no actionable detail. When `RESEND_API_KEY` is missing or invalid, debugging was impossible.
- **Fix:** Updated error return to include `emailError.message` (Resend's error detail) appended to the user-facing string.
- **Files modified:** `src/actions/invitations.ts`
- **Commit:** `31f3f27` — fix(01-03): expose actual Resend error in invite failure message

**6. [Rule 3 - Blocking Issue] /api/invitations not listed as public route in proxy.ts**
- **Found during:** Task 4 verification — step 6 (public API curl test)
- **Issue:** `src/proxy.ts` matched `/api/*` as a general public pattern but the middleware was still returning 401 on `POST /api/invitations` because the route was not explicitly exempted. The patient self-register endpoint (D-10) requires no auth.
- **Fix:** Added `/api/invitations` as an explicit public route entry in `proxy.ts` matcher config.
- **Files modified:** `src/proxy.ts`
- **Commit:** `d1b9468` — fix(01-02): add /api/invitations to public API routes for patient self-registration (D-10)

## Known Stubs

None — all data flows are wired:
- `InviteForm` → `createInvitation` → `public.invitations` + Resend (live DB + email)
- `acceptInvitation` → `public.users` + `public.invitations` (live DB)
- `equipe/page.tsx` → `public.invitations` via RLS (live DB, x-user-role from proxy)
- POST `/api/invitations` → `public.invitations` (live DB)

The `PasswordResetEmail.tsx` template is provided but not yet wired to `sendPasswordReset` in `auth.ts` (which uses Supabase's built-in reset email). This is intentional per the plan ("for now provide the template") — it is not a stub that blocks any plan goal.

## Threat Flags

No new threat surface beyond what the plan's `<threat_model>` covers. All six STRIDE mitigations applied:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-01-15 | Server-side role check (admin/superadmin only) in `createInvitation` + RLS `invitations_admin_write` |
| T-01-16 | `acceptInvitation` checks `status === 'pending'` AND `expires_at >= now()`; flips expired to `status='expired'`; UPDATEs to `accepted` after use (single-use) |
| T-01-17 | Role taken from invitation DB row at acceptance; email read-only in `InviteAcceptForm`; no client input used for security decisions |
| T-01-18 | Accepted (low-value, deferred to Phase 3 rate limiting) — no auth account created at POST /api/invitations |
| T-01-19 | `logBusinessEvent` on all 4 paths: INVITE_SENT, INVITE_ACCEPTED, INVITE_REVOKED, USER_CREATED_DIRECT (+ PATIENT_SELF_REGISTER_REQUEST for public API) |
| T-01-20 | Token is `gen_random_uuid()` (unguessable); invite page reveals only clinic name + role (not full email, T-01-17) |

## Self-Check: PASSED

### Files verified to exist:
- src/lib/resend.ts — FOUND
- src/emails/InviteEmail.tsx — FOUND
- src/emails/PasswordResetEmail.tsx — FOUND
- src/lib/validators/invitation.ts — FOUND
- src/actions/invitations.ts — FOUND
- src/app/api/invitations/route.ts — FOUND
- src/app/invite/[token]/page.tsx — FOUND
- src/app/invite/[token]/InviteAcceptForm.tsx — FOUND
- src/components/invitations/InviteForm.tsx — FOUND
- src/app/(dashboard)/clinica/equipe/page.tsx — FOUND
- src/__tests__/auth/invitations.test.ts — FOUND
- src/components/auth/SignupForm.tsx — FOUND (modified: fix 79230d1)
- src/proxy.ts — FOUND (modified: fix d1b9468)

### Commits verified:
- a8475a5 — feat(01-03): Resend wrapper + FYNXIA-branded email templates + invitation validators
- f9ea8b1 — feat(01-03): Invitation Server Actions + patient self-register API + accept page
- 453f2e9 — feat(01-03): Admin team page with InviteForm (email + direct modes)
- 79230d1 — fix(01-02): show actual server error in signup form instead of generic message
- 31f3f27 — fix(01-03): expose actual Resend error in invite failure message
- d1b9468 — fix(01-02): add /api/invitations to public API routes for patient self-registration (D-10)

### Verification commands passed:
- `npx vitest run src/__tests__/auth/invitations.test.ts` — 18/18 tests GREEN
- `npx vitest run src/__tests__` — 59/59 tests GREEN (4 test files)
- `npx tsc --noEmit` — exit 0
- `npm run build` — succeeded (13 routes compiled)
- `grep -c "logBusinessEvent" src/actions/invitations.ts` — 5 (1 import + 4 call sites >= 4 required)
- Human verification: all 7 steps approved
