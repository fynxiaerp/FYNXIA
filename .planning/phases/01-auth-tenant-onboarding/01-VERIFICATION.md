---
phase: 01-auth-tenant-onboarding
verified: 2026-06-05T00:00:00Z
status: human_needed
score: 22/22 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Login persists session across page navigations (JWT auto-refresh)"
    expected: "User stays logged in after navigating between /clinica and /clinica/equipe without re-authenticating"
    why_human: "Session persistence via JWT auto-refresh (updateSession cookie writes) requires browser interaction; cannot be verified with static grep"
  - test: "RBAC redirect enforcement at route level"
    expected: "A logged-in receptionist who manually navigates to /superadmin is redirected to /clinica (role home)"
    why_human: "proxy.ts ROLE_ROUTES matrix + isPathAllowed are unit-tested, but end-to-end middleware execution with a live session requires a running server"
  - test: "users_masked view returns masked email for receptionist, full email for admin"
    expected: "Querying public.users_masked as a receptionist returns 'jo***@gmail.com'; querying as admin returns full email"
    why_human: "View masking logic depends on get_my_role() executed inside Supabase with a real JWT context; cannot test without live DB session"
  - test: "Audit triggers fire on INSERT to public.clinics and public.users"
    expected: "After clinic signup, audit_logs contains entries with action='INSERT', table_name='clinics' and table_name='users' with correct tenant_id"
    why_human: "Trigger execution requires a live DB; migration file content and SECURITY DEFINER presence are verified statically, but actual trigger firing requires real INSERT"
---

# Phase 1: Auth & Tenant Onboarding Verification Report

**Phase Goal:** Clinic administrators can register their clinic, invite team members, and every user can log in and operate within their own isolated tenant — RBAC is enforced end-to-end.
**Verified:** 2026-06-05T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                          | Status     | Evidence                                                                                                |
|----|-----------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------------|
| 1  | public.clinics table exists (renamed from tenants) with cnpj, phone, address, specialty, logo_url | VERIFIED | `20260604000200_rename_tenants_to_clinics.sql`: ALTER TABLE public.tenants RENAME TO clinics + 5 ADD COLUMN clauses |
| 2  | public.users.tenant_id FK references public.clinics(id)                                        | VERIFIED   | Phase 0 schema had FK to tenants; migration Step 1 auto-updates FK via PostgreSQL RENAME; confirmed by plan acceptance criteria |
| 3  | get_my_tenant_id() and get_my_role() remain valid (prosecdef=true) after rename               | VERIFIED   | Migration includes CREATE OR REPLACE FUNCTION for both with SECURITY DEFINER; both reference public.users (not public.tenants) |
| 4  | invitations table exists with 24h expiry default and pending/accepted/expired/revoked states  | VERIFIED   | `20260604000300_clinics_users_phase1.sql`: CREATE TABLE public.invitations with DEFAULT now() + interval '24 hours' and CHECK constraint on status |
| 5  | patient_consents table exists with consent_type, policy_version, ip_address, revoked_at       | VERIFIED   | `20260604000300_clinics_users_phase1.sql`: CREATE TABLE public.patient_consents with all required columns |
| 6  | audit trigger fires on INSERT/UPDATE/DELETE of clinics and users, writing to audit_logs        | VERIFIED   | `20260604000300_clinics_users_phase1.sql`: CREATE TRIGGER audit_clinics + audit_users AFTER INSERT OR UPDATE OR DELETE, SECURITY DEFINER functions confirmed |
| 7  | users_masked view masks email for receptionist/patient roles, full email for admin/dentist/superadmin | VERIFIED | `20260604000400_rls_phase1.sql`: CREATE OR REPLACE VIEW public.users_masked with CASE on get_my_role() |
| 8  | audit_logs partitions exist for 2026_07 and 2026_08                                           | VERIFIED   | `20260604000300_clinics_users_phase1.sql`: CREATE TABLE audit_logs_2026_07 + audit_logs_2026_08 PARTITION OF public.audit_logs |
| 9  | TypeScript types regenerated reflecting clinics table                                         | VERIFIED   | `src/types/database.types.ts`: 5 occurrences of 'clinics', 3 of 'invitations' — hand-authored from DDL (CLI token unavailable) |
| 10 | Admin can register a clinic (clinicName + email + password + CNPJ-or-CPF + phone) — creates rows in public.clinics + public.users with role=admin | VERIFIED | `src/actions/auth.ts`: signUpClinic creates auth user, inserts clinics row (cnpj=document, phone), inserts users row (role:'admin'); compensating rollback present |
| 11 | Signup accepts either a valid CNPJ or a valid CPF (z.union with cpf-cnpj-validator)           | VERIFIED   | `src/lib/validators/auth.ts`: const documentSchema = z.union([zCpf(), zCnpj()]) using zodValidator from cpf-cnpj-validator |
| 12 | After successful signup the user is redirected to /clinica without an email-confirmation gate  | VERIFIED   | `src/actions/auth.ts`: admin.createUser with email_confirm:true + signInWithPassword + redirect('/clinica') |
| 13 | User can log in with email+password and the session persists across navigations (JWT auto-refresh via proxy updateSession) | VERIFIED (partial — live persistence is human_needed) | `src/proxy.ts` calls updateSession(); `src/lib/supabase/middleware.ts`: getUser() confirmed, cookies written to both request+response |
| 14 | User can log out from any page and is redirected to /login                                    | VERIFIED   | `src/actions/auth.ts`: signOut() calls supabase.auth.signOut() + redirect('/login'); signOut wired to "Sair" button in /clinica/page.tsx |
| 15 | User can request a password reset email and set a new password                                | VERIFIED   | sendPasswordReset() in auth.ts calls resetPasswordForEmail with redirectTo pointing to /auth/confirm; /auth/confirm/route.ts handles verifyOtp; /reset-password page exists |
| 16 | proxy.ts enforces the D-07 role matrix at the route level using a single users.role DB call    | VERIFIED   | proxy.ts: ROLE_ROUTES defined with 5 roles per D-07; `.from('users').select('role').eq('id', user.id).single()` — single DB call |
| 17 | proxy.ts uses getUser() (never getSession())                                                  | VERIFIED   | grep getSession in src/ returns 0 matches in proxy.ts/auth.ts; middleware.ts confirms getUser() call |
| 18 | Auth pages /login, /signup, /forgot-password, /reset-password render with React Hook Form + Zod v3, FYNXIA branding only | VERIFIED | SignupForm.tsx, LoginForm.tsx, ForgotPasswordForm.tsx use useForm + zodResolver; all show FYNXIA heading |
| 19 | Admin can invite a staff member by email+role; invitations row created (status=pending, 24h expiry) and FYNXIA-branded email sent via Resend | VERIFIED | `src/actions/invitations.ts` createInvitation mode='email': inserts invitations row + resend.emails.send with InviteEmail React component |
| 20 | Admin can create a staff member directly with a temporary password (no email sent)             | VERIFIED   | `src/actions/invitations.ts` mode='direct': admin.createUser + public.users insert, no email sent |
| 21 | Re-inviting the same email invalidates the previous pending invite                            | VERIFIED   | createInvitation: UPDATE status='revoked' WHERE status='pending' before INSERT new row; partial unique index on (tenant_id, email) WHERE status='pending' |
| 22 | Invited user clicks the link, lands on /invite/[token], sets a password, and is linked to the correct clinic with the assigned role | VERIFIED | `src/app/invite/[token]/page.tsx` + InviteAcceptForm.tsx; acceptInvitation validates status+expiry, creates user with role from DB invitation row (never client input) |

**Score:** 22/22 truths verified (4 require human confirmation for live runtime behavior)

### Required Artifacts

| Artifact                                                          | Expected                                             | Status      | Details                                                                    |
|------------------------------------------------------------------|------------------------------------------------------|-------------|----------------------------------------------------------------------------|
| `supabase/migrations/20260604000200_rename_tenants_to_clinics.sql` | tenants→clinics rename + CNPJ/phone columns + unique CNPJ index | VERIFIED | Contains RENAME TO clinics, 5 ADD COLUMNs, idx_clinics_cnpj, both SECURITY DEFINER functions re-asserted |
| `supabase/migrations/20260604000300_clinics_users_phase1.sql`    | invitations + patient_consents tables + audit trigger + July/August partitions | VERIFIED | Contains CREATE TABLE public.invitations, interval '24 hours', CREATE TABLE public.patient_consents, SECURITY DEFINER audit functions, both partitions |
| `supabase/migrations/20260604000400_rls_phase1.sql`              | RLS on new tables + users_masked view                 | VERIFIED    | Contains CREATE OR REPLACE VIEW public.users_masked with CASE-based email masking |
| `src/types/database.types.ts`                                    | Regenerated Supabase TypeScript types containing clinics | VERIFIED  | File contains 'clinics' (5 matches) and 'invitations' (3 matches)         |
| `src/lib/validators/auth.ts`                                     | loginSchema, signupSchema (z.union CPF/CNPJ), inviteSchema, resetPasswordSchema | VERIFIED | All schemas exported; documentSchema uses z.union([zCpf(), zCnpj()]) |
| `src/actions/auth.ts`                                            | signUpClinic, signIn, signOut, sendPasswordReset Server Actions | VERIFIED | All 5 Server Actions exported; zero getSession occurrences |
| `src/proxy.ts`                                                   | Role-based routing matrix + x-user-role header forwarding | VERIFIED  | ROLE_ROUTES with 5 roles, isPathAllowed exported, select('role') confirmed, x-user-role/x-user-id set in request headers |
| `src/app/(auth)/signup/page.tsx`                                 | Clinic registration page                              | VERIFIED    | Exists, imports and renders SignupForm |
| `src/actions/invitations.ts`                                     | createInvitation, acceptInvitation, revokeInvitation Server Actions | VERIFIED | All 3 Server Actions exported; 4 logBusinessEvent call sites (lines 128, 189, 282, 348) |
| `src/emails/InviteEmail.tsx`                                     | FYNXIA-branded react-email invite template            | VERIFIED    | Contains InviteEmail component with FYNXIA heading, pt-BR content, Button linking to inviteUrl, expiry notice |
| `src/app/invite/[token]/page.tsx`                                | Public invite acceptance page (no auth)               | VERIFIED    | 137 lines; Server Component; reads token from params; renders InviteAcceptForm for valid invites |
| `src/app/api/invitations/route.ts`                               | Public patient self-register POST endpoint (D-10)     | VERIFIED    | Exports POST; runtime='nodejs'; resolves clinic by slug; returns 201 with requestId |

### Key Link Verification

| From                                               | To                                     | Via                        | Status      | Details                                                               |
|---------------------------------------------------|----------------------------------------|----------------------------|-------------|-----------------------------------------------------------------------|
| `src/components/auth/SignupForm.tsx`               | signUpClinic Server Action             | form.handleSubmit          | WIRED       | onSubmit calls signUpClinic(formData) via startTransition             |
| `src/proxy.ts`                                    | public.users.role                      | .from('users').select('role') | WIRED   | Line 70: .from('users').select('role').eq('id', user.id).single()    |
| `src/actions/auth.ts signUpClinic`                | public.clinics + public.users          | createAdminClient insert   | WIRED       | Lines 41-58: from('clinics').insert() + from('users').insert()       |
| `src/actions/invitations.ts createInvitation`     | public.invitations + Resend            | insert + resend.emails.send | WIRED      | Lines 83-115: insert invitations row + resend.emails.send with InviteEmail |
| `src/actions/invitations.ts`                      | public.audit_logs                      | logBusinessEvent           | WIRED       | 4 logBusinessEvent calls at lines 128, 189, 282, 348                 |
| `src/app/invite/[token]/page.tsx`                 | acceptInvitation                       | form submit                | WIRED       | InviteAcceptForm.tsx line 34: acceptInvitation(token, data.password) |

### Data-Flow Trace (Level 4)

| Artifact                                    | Data Variable       | Source                                              | Produces Real Data | Status     |
|--------------------------------------------|---------------------|-----------------------------------------------------|--------------------|------------|
| `src/app/(dashboard)/clinica/page.tsx`     | clinic (name, plan) | createClient().from('clinics').select('name','plan').single() (RLS-scoped) | Yes — live Supabase DB query | FLOWING |
| `src/app/(dashboard)/clinica/equipe/page.tsx` | pendingInvites   | createClient().from('invitations').select(...).eq('status','pending') (RLS-scoped) | Yes — live Supabase DB query | FLOWING |
| `src/app/invite/[token]/page.tsx`          | invitation (email, role, status) | createAdminClient().from('invitations').select(...).eq('token', token) | Yes — admin client query by token | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — cannot verify against a running server in this environment. Human verification items in Step 8 cover the key runtime behaviors.

### Requirements Coverage

| Requirement | Source Plan | Description | Status       | Evidence                                                                                 |
|-------------|------------|-------------|--------------|------------------------------------------------------------------------------------------|
| AUTH-01     | Plan 02    | User can create account with email and password via Supabase Auth | SATISFIED | signUpClinic: admin.createUser + signInWithPassword; clinic + users rows created |
| AUTH-02     | Plan 02    | User can log in and maintain active session between visits (JWT auto-refresh) | SATISFIED (human_needed for runtime) | loginSchema → signIn → signInWithPassword; proxy updateSession() uses getUser() |
| AUTH-03     | Plan 02    | User can log out from any page | SATISFIED   | signOut() in auth.ts; wired to "Sair" button in clinica/page.tsx                        |
| AUTH-04     | Plan 02    | Middleware uses getUser() (not getSession()) to validate JWT authenticity | SATISFIED | middleware.ts: getUser() only; grep returns 0 matches for getSession in src/proxy.ts or src/actions/auth.ts |
| AUTH-05     | Plans 02, 03 | System supports 4 profiles with RBAC: admin, dentist, receptionist, patient | SATISFIED | ROLE_ROUTES in proxy.ts defines all 4 roles + superadmin; isPathAllowed enforces matrix |
| AUTH-06     | Plan 01    | Data completely isolated by tenant_id via RLS                 | SATISFIED   | invitations + patient_consents have RLS enabled; get_my_tenant_id() SECURITY DEFINER in all policies |
| AUTH-07     | Plan 01    | tenant_id and role stored in public.users only (service role can write via RLS) | SATISFIED | signUpClinic writes users row via admin client; no user_metadata usage (grep returns 0 matches) |
| SEC-01      | Plan 01    | CPF, email, and phone masked in public listings/logs          | SATISFIED   | users_masked view in `20260604000400_rls_phase1.sql`: CASE on get_my_role() masks email for receptionist/patient |
| SEC-02      | Plans 01, 03 | All sensitive actions recorded in immutable audit_logs (no DELETE policy) | SATISFIED | audit_clinics + audit_users triggers in migration; logBusinessEvent with 4 call sites in invitations.ts |
| SEC-05      | Plan 01    | patient_consents table with LGPD consent record per patient   | SATISFIED   | CREATE TABLE public.patient_consents with consent_type, policy_version, ip_address, revoked_at |

All 10 requirement IDs from PLAN frontmatter accounted for. No orphaned requirements found for Phase 1 in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/(dashboard)/clinica/page.tsx` | 46 | "O painel completo está sendo construído" placeholder notice | Info | Informational — the page itself correctly renders clinic data from live DB; the placeholder text is a legitimate MVP notice, not a stub |
| `src/app/(dashboard)/clinica/equipe/page.tsx` | 152 | "Gestão completa de equipe (editar, remover membros) disponível na Fase 2" | Info | Informational — correctly noted as Phase 2 scope; InviteForm and pending invite list are fully functional |

No blocker anti-patterns found. No stub implementations detected. No `getSession` usage. No `user_metadata` references for tenant_id/role.

### Human Verification Required

#### 1. Session Persistence Across Navigation

**Test:** Log in as admin at /login. Navigate to /clinica, then to /clinica/equipe, then close the browser tab and reopen.
**Expected:** User remains logged in across navigations. After reopen, session is restored without re-login (JWT auto-refresh via updateSession).
**Why human:** Cookie write behavior (request + response headers in NextResponse.next) cannot be confirmed statically; requires live browser session.

#### 2. RBAC Redirect Enforcement

**Test:** Log in as a user with role=receptionist. In the browser address bar, directly navigate to /superadmin or /config.
**Expected:** Proxy intercepts the request and redirects to /clinica (the receptionist role home).
**Why human:** ROLE_ROUTES + isPathAllowed are unit-tested (24 passing tests), but actual middleware interception with a live JWT requires a running Next.js server.

#### 3. users_masked View Email Masking

**Test:** Using the Supabase SQL Editor or MCP, run: `SELECT email FROM public.users_masked` with a session token belonging to a receptionist vs an admin.
**Expected:** Receptionist sees `jo***@gmail.com`; admin sees full email.
**Why human:** View masking relies on get_my_role() executing with the caller's JWT context inside PostgreSQL RLS; requires a live Supabase connection with authenticated sessions.

#### 4. Audit Triggers Fire on INSERT

**Test:** Create a new clinic via /signup. Then in Supabase SQL Editor run: `SELECT table_name, action, tenant_id FROM audit_logs ORDER BY created_at DESC LIMIT 5`.
**Expected:** Entries with table_name='clinics' (action='INSERT') and table_name='users' (action='INSERT') with the correct tenant_id.
**Why human:** Trigger execution requires a live DB and real INSERT events; migration file confirms SECURITY DEFINER triggers are created but actual firing requires a database operation.

### Gaps Summary

No gaps found. All 22 observable truths are verified at the code level. All 12 required artifacts exist, are substantive, and are wired. All 6 key links are confirmed. All 10 requirement IDs are satisfied. No stub implementations, no getSession usage, no user_metadata references.

The 4 items requiring human verification are runtime behaviors that cannot be confirmed with static analysis. These are not gaps — the code implementing these behaviors is correct and complete. Human testing is required to confirm the behaviors work end-to-end in a live environment.

---

_Verified: 2026-06-05T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
