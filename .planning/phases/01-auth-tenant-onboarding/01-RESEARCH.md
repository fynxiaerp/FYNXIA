# Phase 1: Auth & Tenant Onboarding — Research

**Researched:** 2026-06-04
**Domain:** Supabase Auth + Next.js 16 proxy.ts + PostgreSQL migrations (rename, views, triggers)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Registro da Clínica**
- D-01: Admin fornece na tela de cadastro: nome da clínica + e-mail + senha + CNPJ + telefone.
- D-02: Entidade clínica usa tabela `public.clinics` (não `public.tenants`). A relação `public.users.tenant_id` referencia `public.clinics.id`. `public.tenants` é renomeada para `public.clinics` via `ALTER TABLE public.tenants RENAME TO public.clinics`.
- D-03: Após cadastro bem-sucedido → redirect direto para `/clinica`. Sem gate de confirmação de e-mail.

**Convites e Entrada de Membros**
- D-04: Dois caminhos: (1) Invite por e-mail (Resend); (2) Criação direta (admin define senha temporária).
- D-05: Convite expira em 24 horas, uso único. Reenvio invalida anterior. Estados: `pending → accepted | expired`.

**RBAC — Controle de Acesso por Rota**
- D-06: RBAC aplicado apenas em nível de rota no `proxy.ts` (Fase 1). Sem ocultação de componentes.
- D-07: Matriz de acesso:
  - `admin` → Todas as rotas
  - `dentist` → `/clinica/*`, `/perfil`
  - `receptionist` → `/clinica/*`, `/perfil`
  - `patient` → `/paciente/*` apenas
  - `superadmin` → Todas + `/superadmin/*`
- D-08: Role lida via `get_my_role()` SECURITY DEFINER (já existe). `proxy.ts` faz DB call para obter role.

**Contas de Pacientes**
- D-09: Infraestrutura criada na Fase 1, UI na Fase 2. Inclui backend de convite (role=`patient`) + migration `patient_consents`.
- D-10: Dois caminhos: recepcionista cadastra + convite; auto-cadastro via `/agendar/[clinic-slug]` (API endpoint criado na Fase 1, UI na Fase 2).

**Mascaramento de Dados (SEC-01)**
- D-11: Mascaramento via PostgreSQL view + RLS. Roles privilegiados (admin, dentist, superadmin) recebem dados completos; receptionist e patient recebem colunas mascaradas.
- D-12: Formato brasileiro:
  - CPF: `123.***.***-**`
  - E-mail: `jo***@gmail.com`
  - Telefone: `(11) 9****-1234`

**Auditoria (SEC-02)**
- D-13: Auditoria híbrida: (1) Trigger PostgreSQL em `clinics` e `users` (INSERT/UPDATE automático); (2) Registro manual em Server Actions para eventos de negócio.
- D-14: Trigger retorna SECURITY DEFINER para escrever em `audit_logs` sem policy de INSERT.

**UI das Telas de Auth**
- D-15: Páginas separadas: `/login`, `/signup`, `/forgot-password`.
- D-16: Branding FYNXIA fixo. Sem personalização por clínica.

### Claude's Discretion
- Estrutura exata da tabela `invitations` (campos, índices)
- Implementação do mecanismo de expiração de convite (cron vs. verificação em runtime)
- Esquema de validação Zod para formulários de cadastro e convite
- Componentes shadcn específicos usados nas telas de auth
- Cópia dos e-mails de convite e recuperação de senha

### Deferred Ideas (OUT OF SCOPE)
- White-label / branding por clínica
- Login social (Google/Apple)
- Controle de visibilidade de componentes por role (useRole() hook)
- E-mail de confirmação obrigatório para admin
- Supabase CLI em CI para validação de migrations
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Usuário pode criar conta com e-mail e senha via Supabase Auth | Supabase `signUp()` pattern; clinic signup Server Action creates row in `public.clinics` + `public.users` via admin client |
| AUTH-02 | Usuário pode fazer login e manter sessão ativa entre visitas (JWT refresh automático) | `@supabase/ssr` `updateSession()` em proxy.ts mantém cookies atualizados |
| AUTH-03 | Usuário pode fazer logout de qualquer página | `supabase.auth.signOut()` via Server Action; redirect para `/login` |
| AUTH-04 | Middleware usa `getUser()` (não `getSession()`) | proxy.ts já usa `updateSession()` que chama `getUser()` — sem alteração de contrato |
| AUTH-05 | Sistema suporta 4 perfis com RBAC: admin, dentist, receptionist, patient | `public.users.role` CHECK constraint já existe; role-check em proxy.ts via `get_my_role()` |
| AUTH-06 | Dados completamente isolados por tenant_id via RLS | `get_my_tenant_id()` SECURITY DEFINER já em todas as policies; migration renomeia tabela, não as policies |
| AUTH-07 | tenant_id e role em public.users; lidos via SECURITY DEFINER; sem JWT claims | Padrão FREE plan já implementado na Fase 0; Phase 1 adiciona clinics + invitations tables |
| SEC-01 | CPF, e-mail e telefone mascarados em listagens | PostgreSQL view com CASE/regexp masking + RLS baseada em role |
| SEC-02 | Ações sensíveis registradas em audit_logs imutável | Trigger SECURITY DEFINER em clinics+users + Server Actions manuais |
| SEC-05 | Tabela patient_consents com registro LGPD | Schema documentado em PITFALLS.md M-4; migration cria tabela com consent_type, policy_version, ip_address, revoked_at |
</phase_requirements>

---

## Summary

Phase 1 builds on the secure foundation from Phase 0 and delivers the full auth + tenant lifecycle. The primary technical complexity is in four areas: (1) renaming `public.tenants` to `public.clinics` safely while preserving the SECURITY DEFINER functions, foreign keys, and RLS policies that depend on it; (2) implementing role-based routing in `proxy.ts` (Node.js runtime in Next.js 16) using `get_my_role()` with per-request DB call efficiency; (3) the invite flow using Supabase `admin.inviteUserByEmail()` with a token_hash callback route; and (4) PostgreSQL view-based data masking with role-conditional logic for LGPD compliance.

The rename of `public.tenants` to `public.clinics` is the highest-risk database operation in Phase 1. PostgreSQL automatically updates foreign key references and RLS policy table names when a table is renamed — but it does NOT update SQL text inside SECURITY DEFINER function bodies. The `get_my_tenant_id()` and `get_my_role()` functions both contain `FROM public.users` (which is safe), but if any function body contained `FROM public.tenants`, it would silently break at runtime. A migration that renames the table MUST also execute `CREATE OR REPLACE FUNCTION` for all functions that reference the old name. This phase's migration must also add CNPJ and phone columns to the renamed `clinics` table.

The proxy.ts role-check pattern requires careful design: `get_my_role()` is a DB call, and calling it on every request in proxy.ts would create a DB round-trip per page load. The correct architecture is to call `get_my_role()` once per authenticated request in proxy.ts using the standard `@supabase/ssr` server client, cache the result as a response header (`x-user-role`), and let Server Components read that header — not make their own DB call for the role.

**Primary recommendation:** Execute the rename migration first in an isolated plan; test RLS recursion and function validity before building any auth UI on top.

---

## Standard Stack

### Core (already installed — Phase 0)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.2.7 | App Router, proxy.ts, Server Actions |
| `@supabase/supabase-js` | ^2.107.0 | Core client |
| `@supabase/ssr` | ^0.10.3 | SSR auth integration, cookie management |
| `server-only` | ^0.0.1 | Prevents server modules from being imported client-side |

**Version verification:** [VERIFIED: npm registry — package.json in repo]

### New for Phase 1

| Package | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-hook-form` | 7.77.0 | Form state management | De facto standard; minimal re-renders; ties directly into shadcn form primitives |
| `zod` | 3.25.76 (v3 latest) | Schema validation | Project-locked to v3 (see STACK.md — `@hookform/resolvers` edge cases with v4) |
| `@hookform/resolvers` | 5.4.0 | Bridge RHF ↔ Zod | Official bridge; v5.x stable with Zod v3 |
| `resend` | 6.12.4 | Email sending | Chosen over SendGrid (SendGrid killed free tier 2025) |
| `react-email` | 6.5.0 | Email template components | Native React/TypeScript DX; Resend-native |
| `@react-email/components` | 0.0.38 | Headless email primitives | Required by react-email |
| `cpf-cnpj-validator` | 2.1.2 | Brazilian CPF/CNPJ validation | Provides Zod adapter (`zodValidator(z)`); handles digit-verification algorithm |

**Version verification:** [VERIFIED: npm registry — `npm view <pkg> version` run 2026-06-04]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `cpf-cnpj-validator` | Custom Zod `.refine()` regex | cpf-cnpj-validator handles the digit checksum algorithm; pure regex alone does NOT validate real CPF/CNPJ (123.456.789-09 passes regex but fails digit check) |
| `resend` email for invite | Supabase built-in invite email | Supabase's invite email cannot be styled with brand; custom email via Resend gives FYNXIA branding. Note: Supabase `inviteUserByEmail()` still sends its own unbranded email — see Architecture section for hybrid approach |

**Installation:**
```bash
npm install react-hook-form zod@^3 @hookform/resolvers resend react-email @react-email/components cpf-cnpj-validator
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 additions)

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── auth/
│   │       └── confirm/route.ts       ← token_hash exchange (invite + password reset)
│   ├── (dashboard)/
│   │   └── clinica/
│   │       └── page.tsx               ← redirect target after auth
│   ├── invite/
│   │   └── [token]/page.tsx           ← public invite accept page (no auth required)
│   └── api/
│       ├── auth/
│       │   └── signup/route.ts        ← clinic registration Server Action target
│       └── invitations/
│           └── route.ts               ← patient self-register endpoint
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  ← (Phase 0) browser client
│   │   ├── server.ts                  ← (Phase 0) server client
│   │   └── admin.ts                   ← (Phase 0) service-role client
│   └── validators/
│       ├── auth.ts                    ← Zod schemas: signupSchema, loginSchema, inviteSchema
│       └── clinic.ts                  ← Zod schemas: clinicSchema (CNPJ, phone)
├── emails/
│   ├── InviteEmail.tsx                ← react-email template (FYNXIA branded)
│   └── PasswordResetEmail.tsx         ← react-email template
└── actions/
    ├── auth.ts                        ← signUp, signIn, signOut, sendPasswordReset
    └── invitations.ts                 ← createInvitation, revokeInvitation, acceptInvitation
supabase/
└── migrations/
    ├── 20260603000000_initial_schema.sql  ← (Phase 0)
    ├── 20260603000100_rls_policies.sql    ← (Phase 0)
    ├── 20260604000200_rename_tenants_to_clinics.sql  ← NEW: alter table + add CNPJ/phone
    ├── 20260604000300_clinics_users_phase1.sql       ← NEW: invitations, patient_consents, audit trigger
    └── 20260604000400_rls_phase1.sql                 ← NEW: RLS on new tables + masked view
```

---

### Pattern 1: Rename `public.tenants` → `public.clinics` Migration Strategy

**What:** `ALTER TABLE public.tenants RENAME TO public.clinics` in a versioned migration.

**Critical findings on rename impact:**
- **FKs:** PostgreSQL automatically updates FK constraints that reference the renamed table. `public.users.tenant_id REFERENCES public.tenants(id)` becomes `public.users.tenant_id REFERENCES public.clinics(id)` automatically. [VERIFIED: PostgreSQL 18 docs — ALTER TABLE automatically updates dependent objects]
- **RLS policies on the renamed table:** Policy names survive; the policy's table association is updated. A policy like `"tenants_own_record"` ON `public.tenants` becomes attached to `public.clinics` automatically.
- **SECURITY DEFINER function bodies:** `get_my_tenant_id()` and `get_my_role()` both select `FROM public.users` — they do NOT reference `public.tenants`. Safe.
- **`users_tenant_isolation` policy USING clause:** Calls `get_my_tenant_id()` — safe, no table name in the body.
- **Any stored SQL text with `FROM public.tenants`:** PostgreSQL does NOT auto-update function body text strings. [ASSUMED — based on PostgreSQL function storage model: function bodies are stored as text blobs, not tracked as object dependencies. Single-source claim; official docs do not explicitly guarantee text rewriting.] If any future function body hardcodes `FROM public.tenants`, it breaks silently. Mitigation: grep migrations for `public.tenants` after rename.

**Migration pattern:**
```sql
-- Migration: 20260604000200_rename_tenants_to_clinics.sql
-- Step 1: Rename the table
ALTER TABLE public.tenants RENAME TO public.clinics;

-- Step 2: Rename the index for consistency (indexes are NOT auto-renamed)
ALTER INDEX idx_tenants_slug RENAME TO idx_clinics_slug;

-- Step 3: Rename the RLS policies for consistency (optional but recommended)
ALTER POLICY "tenants_own_record" ON public.clinics RENAME TO "clinics_own_record";
ALTER POLICY "tenants_admin_update" ON public.clinics RENAME TO "clinics_admin_update";

-- Step 4: Add Phase 1 columns
ALTER TABLE public.clinics
  ADD COLUMN cnpj         TEXT,      -- validated at application layer
  ADD COLUMN phone        TEXT,
  ADD COLUMN address      TEXT,
  ADD COLUMN specialty    TEXT,
  ADD COLUMN logo_url     TEXT;

-- Step 5: Add index for CNPJ uniqueness (clinic registry is unique in Brazil)
CREATE UNIQUE INDEX idx_clinics_cnpj ON public.clinics(cnpj) WHERE cnpj IS NOT NULL;
```

**Post-rename verification (Plan-level checklist):**
```sql
-- Verify no policies reference old table name
SELECT policyname, tablename FROM pg_policies WHERE tablename = 'tenants';
-- Must return 0 rows

-- Verify FKs updated
SELECT tc.constraint_name, ccu.table_name AS referenced_table
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'users';
-- Should show referenced_table = 'clinics'

-- Verify SECURITY DEFINER functions are valid
SELECT proname, prosrc FROM pg_proc WHERE proname IN ('get_my_tenant_id', 'get_my_role');
-- Confirm body text does not contain 'tenants'
```

---

### Pattern 2: Role-Based Routing in `proxy.ts`

**What:** proxy.ts runs on Node.js runtime (Next.js 16). It can make DB calls — but should do so efficiently using the existing `@supabase/ssr` server client. The role is fetched once per request and forwarded as a header.

**Key finding:** `proxy.ts` runs on Node.js runtime (not Edge) as of Next.js 16.0.0. [VERIFIED: nextjs.org/docs/app/api-reference/file-conventions/proxy — "Proxy defaults to using the Node.js runtime"]

**DB call efficiency:** `get_my_role()` is STABLE + SECURITY DEFINER — PostgreSQL caches the result per transaction. A single call to `get_my_role()` per request in proxy.ts is acceptable. This is NOT an N+1 issue because proxy.ts is one request, not one-per-row.

**Caching concern from CONTEXT.md:** The proxy.ts already calls `updateSession()` which calls `supabase.auth.getUser()`. The role lookup adds one additional DB call per request. For FYNXIA's scale this is acceptable. The result should be set as a request header so downstream Server Components do NOT make their own `get_my_role()` call.

```typescript
// src/proxy.ts — Phase 1 extended version
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createClient } from '@/lib/supabase/server'

// Role → allowed path prefixes
const ROLE_ROUTES: Record<string, string[]> = {
  admin:        ['/clinica', '/perfil', '/config', '/superadmin'],
  dentist:      ['/clinica', '/perfil'],
  receptionist: ['/clinica', '/perfil'],
  patient:      ['/paciente', '/perfil'],
  superadmin:   ['/clinica', '/perfil', '/config', '/superadmin', '/paciente'],
}

export async function proxy(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  const isAuthRoute = /^\/(login|signup|forgot-password)/.test(pathname)
  const isApiRoute = pathname.startsWith('/api')
  const isPublicRoute = pathname.startsWith('/invite') || pathname.startsWith('/agendar')
  const isAuthCallbackRoute = pathname.startsWith('/auth/confirm')

  // Unauthenticated → redirect to login
  if (!user && !isAuthRoute && !isApiRoute && !isPublicRoute && !isAuthCallbackRoute) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Authenticated user on auth page → redirect to dashboard
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/clinica', request.url))
  }

  // For authenticated users on protected routes: enforce role-based routing
  if (user && !isAuthRoute && !isApiRoute && !isPublicRoute) {
    // Single DB call for role — cached at PostgreSQL STABLE function level
    const supabase = await createClient()
    const { data: roleRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = roleRow?.role ?? 'patient'
    const allowedPrefixes = ROLE_ROUTES[role] ?? ['/paciente']

    const isAllowed = allowedPrefixes.some(prefix => pathname.startsWith(prefix))
    if (!isAllowed) {
      // Redirect to role-appropriate home
      const home = role === 'patient' ? '/paciente' : '/clinica'
      return NextResponse.redirect(new URL(home, request.url))
    }

    // Forward role as header so Server Components don't need to re-query
    supabaseResponse.headers.set('x-user-role', role)
    supabaseResponse.headers.set('x-user-id', user.id)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Anti-pattern to avoid:** Using `get_my_role()` RPC in proxy.ts with the anon key — the SECURITY DEFINER function requires the session context (`auth.uid()` returns the user's UUID only when the request carries the user's JWT, not the anon key). Use `createClient()` from `server.ts` (which passes the user's cookies/JWT), then query `users` table directly with `.from('users').select('role').eq('id', user.id).single()`.

---

### Pattern 3: Signup + Tenant Provisioning Server Action

**What:** Admin signup creates: (1) Supabase Auth user, (2) `public.clinics` row, (3) `public.users` row with `role='admin'`. All three must succeed atomically — use the admin client (`createAdminClient()`) to create the user row bypassing RLS, and wrap clinics+users inserts in a PostgreSQL function.

```typescript
// src/actions/auth.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { signupSchema } from '@/lib/validators/auth'
import { redirect } from 'next/navigation'

export async function signUpClinic(formData: FormData) {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.format() }

  const { email, password, clinicName, cnpj, phone } = parsed.data
  const admin = createAdminClient()

  // Step 1: Create Supabase Auth user (service role, email_confirm: true skips confirmation email)
  // Note: email_confirm:true marks email as confirmed WITHOUT sending an email
  const { data: authUser, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,  // D-03: no email confirmation gate
  })
  if (signUpError || !authUser.user) return { error: signUpError?.message }

  // Step 2: Create clinic row (bypasses RLS — user doesn't have tenant_id yet)
  const slug = clinicName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const { data: clinic, error: clinicError } = await admin
    .from('clinics')
    .insert({ name: clinicName, slug, cnpj, phone })
    .select('id')
    .single()

  if (clinicError) {
    // Rollback: delete auth user
    await admin.auth.admin.deleteUser(authUser.user.id)
    return { error: clinicError.message }
  }

  // Step 3: Create users row linking auth.user → clinic
  const { error: userError } = await admin
    .from('users')
    .insert({
      id: authUser.user.id,
      tenant_id: clinic.id,
      email,
      full_name: '',  // filled in settings
      role: 'admin',
    })

  if (userError) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    await admin.from('clinics').delete().eq('id', clinic.id)
    return { error: userError.message }
  }

  // Step 4: Sign in the newly created user (creates a session)
  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email, password })

  redirect('/clinica')
}
```

**Important note on `email_confirm: true`:** Using `admin.auth.admin.createUser()` with `email_confirm: true` creates the user and marks their email as verified WITHOUT sending any confirmation email. This is the correct implementation for D-03 (no email gate). [VERIFIED: Supabase JS reference docs — "createUser() will not send a confirmation email to the user. email_confirm:true marks the email as verified in the system without triggering email notifications."]

---

### Pattern 4: Invite Flow (Email Invite Path)

**What:** Admin invites staff by email. The system: (1) creates an `invitations` table row, (2) calls `admin.auth.admin.inviteUserByEmail()` which sends Supabase's built-in invite email, (3) the invited user clicks the link → `/auth/confirm?token_hash=...&type=invite` → session is established.

**Invitations table schema (Claude's Discretion — recommendation):**
```sql
CREATE TABLE public.invitations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  invited_by    UUID        NOT NULL REFERENCES public.users(id),
  email         TEXT        NOT NULL,
  role          TEXT        NOT NULL CHECK (role IN ('admin','dentist','receptionist','patient','superadmin')),
  token         UUID        NOT NULL DEFAULT gen_random_uuid(),  -- for internal tracking only
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',  -- D-05
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email, status)  -- one pending invite per email per clinic
);

CREATE INDEX idx_invitations_tenant_id ON public.invitations(tenant_id);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_expires_at ON public.invitations(expires_at)
  WHERE status = 'pending';  -- partial index for expiry sweeps
```

**Expiry mechanism recommendation (Claude's Discretion):** Runtime check on acceptance is the correct approach for Phase 1 — check `expires_at < now()` when the user clicks the invite link. A cron job to update expired rows to `status='expired'` can be added in Phase 4 when pg_cron is available (Supabase FREE plan). No cron needed for correctness; only for display accuracy.

**PKCE flow for invite links:** Supabase's `inviteUserByEmail()` sends a built-in email with a token hash URL. Configure the Supabase invite email template to use `token_hash`:
```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&redirect_to=/set-password
```

**`/auth/confirm` Route Handler:**
```typescript
// src/app/auth/confirm/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'invite' | 'recovery' | 'signup' | null
  const next = searchParams.get('redirect_to') ?? '/clinica'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Invalid or expired token
  return NextResponse.redirect(`${origin}/login?error=invalid_token`)
}
```

[CITED: supabase.com/docs/guides/auth/server-side/nextjs — token_hash + verifyOtp pattern for PKCE flow]

**Direct creation path (D-04 path 2):**
```typescript
// Admin creates user with known password — no email sent
const { data, error } = await admin.auth.admin.createUser({
  email,
  password: temporaryPassword,
  email_confirm: true,
  user_metadata: { role, tenant_id: clinicId }  // informational only — real role in public.users
})
// Then insert into public.users with role + tenant_id
```

**Important:** `inviteUserByEmail()` accepts `options.data` which goes into `auth.users.user_metadata`. Do NOT use this to store `tenant_id` or `role` for security purposes (C-5 — user-mutable). Use it only for display metadata. The canonical `tenant_id` and `role` are always from `public.users`. [VERIFIED: Supabase API reference — `options.data` maps to `auth.users.user_metadata` column]

---

### Pattern 5: PostgreSQL View for Data Masking (SEC-01)

**What:** A view over `public.users` that masks CPF, email, and phone based on `get_my_role()`. Because views in PostgreSQL are evaluated with the caller's security context by default (`SECURITY INVOKER`), the RLS on `public.users` still applies — the view only changes the column values, not the rows returned.

**Important:** Users table in Phase 0 does NOT have CPF/phone/medical fields (those are in Phase 2's patients table). For Phase 1, masking applies to the `users` table email column only. The full masking view (CPF + phone) will be on the `patients` table in Phase 2. Phase 1 should establish the pattern with users.email masking.

```sql
-- Migration: 20260604000400_rls_phase1.sql

-- Masked view over users — readable by receptionist/patient with masked columns
CREATE OR REPLACE VIEW public.users_masked AS
SELECT
  id,
  tenant_id,
  -- Email masking: jo***@gmail.com
  CASE
    WHEN get_my_role() IN ('admin', 'dentist', 'superadmin')
    THEN email
    ELSE
      CASE WHEN position('@' IN email) > 2
        THEN substring(email, 1, 2) || '***' || substring(email, position('@' IN email))
        ELSE '***' || substring(email, position('@' IN email))
      END
  END AS email,
  full_name,
  role,
  created_at,
  updated_at,
  deleted_at
FROM public.users;

-- RLS on the view follows the underlying table's RLS
-- No separate RLS policy needed — view inherits users' RLS
-- (View is SECURITY INVOKER by default in PostgreSQL)
```

**For Phase 2 — patient masking pattern (documented here for planner awareness):**
```sql
-- Pattern for patients view (Phase 2)
-- CPF: 123.***.***-**
substring(cpf, 1, 3) || '.***.***-' || substring(cpf, 13, 2)

-- Phone: (11) 9****-1234
substring(phone, 1, 5) || '9****-' || substring(phone, length(phone)-3)
```

[CITED: hoop.dev/blog/masking-sensitive-data-with-row-level-security — RLS + view combination for column masking]

---

### Pattern 6: Hybrid Audit Trigger

**What:** A SECURITY DEFINER trigger function that fires on INSERT/UPDATE of `public.clinics` and `public.users`, writing to `public.audit_logs`. The D-14 decision requires SECURITY DEFINER because `audit_logs` has no INSERT RLS policy — only SECURITY DEFINER functions may write to it.

```sql
-- Trigger function for automatic DB-level audit
CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tenant_id,
    actor_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    created_at
  ) VALUES (
    COALESCE(
      CASE TG_OP WHEN 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END,
      (SELECT get_my_tenant_id())  -- fallback for tables without tenant_id
    ),
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply to clinics table
CREATE TRIGGER audit_clinics
  AFTER INSERT OR UPDATE OR DELETE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

-- Apply to users table
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();
```

**Server Action manual audit pattern (D-13 business events):**
```typescript
// src/lib/audit.ts (server-only helper)
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export async function logBusinessEvent(params: {
  tenantId: string
  actorId: string
  action: string
  details: Record<string, unknown>
}) {
  const admin = createAdminClient()
  await admin.from('audit_logs').insert({
    tenant_id: params.tenantId,
    actor_id: params.actorId,
    action: params.action,
    new_values: params.details,
  })
}

// Usage in Server Action:
// await logBusinessEvent({
//   tenantId, actorId: user.id,
//   action: 'INVITE_SENT',
//   details: { invitedEmail, role, invitedBy: user.email }
// })
```

**Note:** Manual audit inserts via `createAdminClient()` bypass RLS (service role). This is intentional — the `audit_logs_no_delete` and `audit_logs_no_update` policies still protect the records from modification; only insertion is allowed via this path. [ASSUMED: Service role INSERT into audit_logs bypasses the RLS "no INSERT policy" correctly — compatible with Supabase RLS model where service role bypasses all policies]

---

### Pattern 7: patient_consents Table (SEC-05)

**What:** LGPD compliance table from PITFALLS.md M-4. Phase 1 creates the schema; Phase 2 wires it to patient registration UI.

```sql
CREATE TABLE public.patient_consents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id      UUID        NOT NULL,  -- will FK to patients(id) in Phase 2
  consent_type    TEXT        NOT NULL
                              CHECK (consent_type IN (
                                'data_processing',      -- LGPD Art. 6 — core processing
                                'marketing_whatsapp',   -- LGPD Art. 8 — opt-in comms
                                'medical_record_sharing', -- CFO requirement
                                'ai_processing'         -- LGPD Art. 33 — AI feature opt-in
                              )),
  policy_version  TEXT        NOT NULL,  -- e.g. '1.0', '1.1' — bump on privacy policy changes
  ip_address      INET,
  user_agent      TEXT,
  consented_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,            -- NULL = active; SET = revoked
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTE: patient_id FK to patients(id) added in Phase 2 migration
-- Using separate ALTER TABLE to avoid circular dependency

CREATE INDEX idx_patient_consents_tenant_id ON public.patient_consents(tenant_id);
CREATE INDEX idx_patient_consents_patient_id ON public.patient_consents(patient_id);

-- RLS: patients and staff can read; only system (service role) writes
ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_consents_tenant_read" ON public.patient_consents
  FOR SELECT
  USING (tenant_id = get_my_tenant_id());
```

---

### Pattern 8: Zod v3 + React Hook Form Auth Forms

**What:** Shared Zod schemas validate on client (instant feedback) and server (security). `@hookform/resolvers` v5.x bridges RHF ↔ Zod v3.

```typescript
// src/lib/validators/auth.ts
import { z } from 'zod'
import { zodValidator } from 'cpf-cnpj-validator/zod'

const { cnpj: zCnpj } = zodValidator(z)

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

export const signupSchema = z.object({
  clinicName: z.string().min(2, 'Nome da clínica é obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  cnpj: zCnpj('CNPJ inválido'),
  phone: z.string()
    .regex(/^\(\d{2}\)\s9?\d{4}-\d{4}$/, 'Telefone inválido — use (11) 99999-9999'),
})

export const inviteSchema = z.object({
  email: z.string().email('E-mail inválido'),
  role: z.enum(['admin', 'dentist', 'receptionist', 'patient']),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type InviteInput = z.infer<typeof inviteSchema>
```

```tsx
// Client Component usage pattern
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signupSchema, type SignupInput } from '@/lib/validators/auth'

export function SignupForm() {
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { clinicName: '', email: '', password: '', cnpj: '', phone: '' },
  })
  // form.handleSubmit calls Server Action
}
```

**CPF/CNPJ validation note:** `cpf-cnpj-validator` validates the check-digit algorithm, not just the format. This prevents `000.000.000-00`, `111.111.111-11` etc. (which pass regex but are invalid). Requires `moduleResolution: "bundler"` or `"node16"` in tsconfig.json for subpath import — verify tsconfig before using. [VERIFIED: npm registry — cpf-cnpj-validator v2.1.2 README]

---

### Pattern 9: Resend + react-email Templates

**What:** FYNXIA-branded invite and password reset emails sent via Resend.

```typescript
// src/emails/InviteEmail.tsx
import { Html, Body, Head, Heading, Text, Button, Container } from '@react-email/components'

interface InviteEmailProps {
  inviterName: string
  clinicName: string
  inviteUrl: string
  role: string
  expiresInHours: number
}

export function InviteEmail({ inviterName, clinicName, inviteUrl, role, expiresInHours }: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9fafb' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
          <Heading>Convite para {clinicName}</Heading>
          <Text>{inviterName} convidou você para entrar como {role}.</Text>
          <Button href={inviteUrl} style={{ backgroundColor: '#0f172a', color: '#fff', padding: '12px 24px' }}>
            Aceitar convite
          </Button>
          <Text style={{ color: '#6b7280', fontSize: '12px' }}>
            Este convite expira em {expiresInHours} horas.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

```typescript
// src/actions/invitations.ts — sending the invite email
import { Resend } from 'resend'
import { InviteEmail } from '@/emails/InviteEmail'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendInviteEmail(params: {
  to: string
  inviterName: string
  clinicName: string
  inviteUrl: string  // Supabase invite link from inviteUserByEmail response
  role: string
}) {
  await resend.emails.send({
    from: 'noreply@fynxia.com.br',
    to: params.to,
    subject: `Convite para ${params.clinicName} — FYNXIA`,
    react: InviteEmail({ ...params, expiresInHours: 24 }),
  })
}
```

**Important architecture note:** `inviteUserByEmail()` sends its own unbranded Supabase email AND returns the magic link in the response `data`. The recommended pattern for FYNXIA branding is to:
1. Call `admin.auth.admin.inviteUserByEmail()` to get the token
2. In the Supabase Dashboard → Auth → Email Templates → "Invite User" template: replace the default with a minimal redirect to the FYNXIA app (or disable it if possible)
3. Send the FYNXIA-branded email via Resend using the same invite URL

Alternatively, use `createUser()` path which does NOT send any Supabase email at all — but then the app must generate and manage the one-time invite token entirely. The `invitations` table token field can serve this purpose. [ASSUMED — the option to suppress Supabase's built-in invite email may not be available on FREE plan; verify in Supabase dashboard Auth settings before choosing the email strategy]

---

### Anti-Patterns to Avoid

- **Storing `tenant_id` in `inviteUserByEmail()` options.data:** Goes into user_metadata (mutable by user — C-5 violation). Use `public.users.tenant_id` exclusively.
- **Calling `get_my_role()` via RPC from proxy.ts:** The Supabase RPC call context in proxy.ts uses the user's JWT cookie — this is correct. But using `supabase.rpc('get_my_role')` adds an extra HTTP hop through PostgREST. Use `.from('users').select('role').eq('id', user.id).single()` directly instead — simpler, same security.
- **Using `getSession()` anywhere in auth checks:** All auth decisions use `getUser()` only (C-4). The existing `updateSession()` already enforces this.
- **Hard-deleting users or clinics:** LGPD requires soft delete. Always set `deleted_at`.
- **Single SQL transaction for signup:** Supabase Admin API calls are HTTP and cannot participate in a PostgreSQL transaction. Use compensating actions (rollback via admin.deleteUser) for partial failures.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CPF/CNPJ digit validation | Custom regex | `cpf-cnpj-validator` | Check-digit algorithm is complex and error-prone; pure regex rejects all CPFs because format ≠ validity |
| Email template rendering | Hand-written HTML strings | `react-email` + `@react-email/components` | Email client compatibility is notoriously hard; react-email handles Outlook, Gmail quirks |
| Password strength validation | Custom function | Zod `.min(8)` + NIST guidance | Zod + RHF gives instant UI feedback; don't reinvent |
| Invite token generation | `Math.random()` or custom UUID | `gen_random_uuid()` in PostgreSQL | Cryptographically secure; no collision risk; no custom entropy implementation |
| JWT verification in proxy.ts | Manual JWT decode | `supabase.auth.getUser()` | getUser() validates against Supabase Auth server; manual decode is C-4 pitfall |

**Key insight:** The most common hand-roll mistakes in auth phases are CPF validation (regex looks correct but misses invalid check-digits) and invite token management (re-implementing what Supabase already provides via inviteUserByEmail).

---

## Common Pitfalls

### Pitfall 1: Rename Migration Breaks Function Bodies

**What goes wrong:** `ALTER TABLE tenants RENAME TO clinics` succeeds, but a future SECURITY DEFINER function body contains `FROM public.tenants` — returns 0 rows silently (no error, just empty results).

**Why it happens:** PostgreSQL stores function bodies as text strings. Table renames do NOT update text in function bodies. [ASSUMED — based on PostgreSQL function storage model; single-source inference]

**How to avoid:** After rename migration, run `SELECT prosrc FROM pg_proc WHERE prosrc LIKE '%tenants%'` — must return 0 rows.

**Warning signs:** `get_my_tenant_id()` returns NULL for all users (role check fails, users can't see their data).

---

### Pitfall 2: RLS on Renamed Table — Index Names Not Propagated

**What goes wrong:** After rename, the `idx_tenants_slug` index still exists with the old name. This is cosmetic only — it works — but causes confusion and makes future migrations harder.

**How to avoid:** Explicitly rename the index: `ALTER INDEX idx_tenants_slug RENAME TO idx_clinics_slug`.

---

### Pitfall 3: Invite Email Contains Raw Token in URL Fragment

**What goes wrong:** Using default Supabase `{{ .ConfirmationURL }}` in the email template sends the token in the URL fragment (hash). `@supabase/ssr`'s PKCE flow rejects this — the browser client expects a `code` parameter in the query string, not a hash fragment.

**How to avoid:** Configure the invite email template to use `token_hash`: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`. The `/auth/confirm` route handler then calls `verifyOtp({ token_hash, type: 'invite' })`. [CITED: multiple Supabase community sources confirming this pattern for PKCE/SSR compatibility]

---

### Pitfall 4: audit_logs INSERT via Service Role — Missing `tenant_id`

**What goes wrong:** The `logBusinessEvent()` helper inserts into `audit_logs` via service role. If the caller forgets to pass `tenantId`, the row has a NULL `tenant_id` and becomes invisible to all tenant queries (RLS SELECT policy requires `tenant_id = get_my_tenant_id()`).

**How to avoid:** Make `tenantId` required (not optional) in the `logBusinessEvent()` signature. Add a TypeScript type that enforces it. The trigger-based automatic audit always has `tenant_id` via `NEW.tenant_id`.

---

### Pitfall 5: `proxy.ts` Role Check on Public Routes Causes Redirect Loop

**What goes wrong:** The `/invite/[token]` public page requires NO authentication. If proxy.ts role-checks all routes including this one, unauthenticated invite recipients get redirected to `/login`, which passes them back to the invite URL — infinite redirect loop.

**How to avoid:** The `isPublicRoute` check in proxy.ts must include `/invite/*` and `/agendar/*`. Also add `/auth/confirm` as an exempt route (it's the token exchange endpoint).

---

### Pitfall 6: CNPJ Uniqueness — No Constraint Prevents Duplicate Clinics

**What goes wrong:** Two different admin users register with the same CNPJ (possible if CNPJ ownership changes or if someone re-registers). Without a DB-level unique constraint, the duplicate is accepted.

**How to avoid:** `CREATE UNIQUE INDEX idx_clinics_cnpj ON public.clinics(cnpj) WHERE cnpj IS NOT NULL` (partial index so NULL is allowed during onboarding before CNPJ entry).

---

### Pitfall 7: Missing Audit Log Partition for July 2026

**What goes wrong:** Phase 0 only created the `audit_logs_2026_06` partition. Phase 1 implementation happens in June 2026. If development/testing spills into July 2026, INSERTs into `audit_logs` will fail with "no partition of relation 'audit_logs' found for row" because July's partition doesn't exist.

**How to avoid:** The Phase 1 migration must create July and future partitions proactively:
```sql
CREATE TABLE public.audit_logs_2026_07 PARTITION OF public.audit_logs
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE public.audit_logs_2026_08 PARTITION OF public.audit_logs
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
```

---

## Code Examples

### Supabase signOut Server Action
```typescript
// src/actions/auth.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

### Password Reset Email Flow
```typescript
// src/actions/auth.ts
export async function sendPasswordReset(email: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?type=recovery&redirect_to=/reset-password`,
  })
  if (error) return { error: error.message }
  return { success: true }
}
```

### Get Clinic Data (Server Component — uses `x-user-role` header)
```typescript
// src/app/(dashboard)/clinica/page.tsx
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export default async function ClinicaPage() {
  // Role already resolved by proxy.ts — no additional DB call needed
  const headersList = await headers()
  const role = headersList.get('x-user-role') ?? 'receptionist'

  const supabase = await createClient()
  const { data: clinic } = await supabase
    .from('clinics')
    .select('*')
    .single()
  // RLS automatically scopes to the user's tenant

  return <div>...</div>
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` in Next.js | `proxy.ts` in Next.js 16 | v16.0.0 (Oct 2025) | Rename only; identical logic; runs on Node.js runtime (not Edge) |
| Edge runtime for middleware | Node.js runtime for proxy.ts | v16.0.0 | proxy.ts can make DB calls directly; no more `fetch()` workarounds |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | auth-helpers-nextjs deprecated; `@supabase/ssr` is the current standard |
| Custom Access Token Hook for role/tenant in JWT | `get_my_role()` + `get_my_tenant_id()` SECURITY DEFINER | Supabase FREE plan constraint | FREE plan equivalent; hook can be added later as performance optimization |
| Supabase invite default HTML email | Supabase invite email with custom redirect + Resend for branding | Ongoing pattern | Two-email strategy or configure Supabase email template |

**Deprecated/outdated:**
- `getServerSideProps` / `getStaticProps` — Pages Router patterns; use Server Components + Server Actions
- `unstable_cache` — Being replaced by `use cache` directive in Next.js 16 `cacheComponents` mode (opt-in)
- `middleware.ts` — deprecated in Next.js 16; auto-renamed to `proxy.ts`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgreSQL does NOT auto-update SQL text inside function bodies when a table is renamed | Pattern 1: Rename Migration | LOW risk — the current SECURITY DEFINER functions (`get_my_tenant_id`, `get_my_role`) reference `public.users`, not `public.tenants`, so this is safe regardless. Risk only materializes if a future function body hardcodes `FROM public.tenants` |
| A2 | Supabase's built-in invite email cannot be disabled on FREE plan | Pattern 4: Invite Flow | MEDIUM risk — if it CAN be suppressed, the branding strategy is simpler (Resend only). If it cannot, two emails are sent on invite. Verify in Supabase Dashboard → Auth → Email Templates before implementing |
| A3 | Service role INSERT into `audit_logs` bypasses RLS INSERT restriction | Pattern 6: Audit Trigger | LOW risk — this is standard Supabase behavior (service role bypasses ALL RLS); verified for general RLS behavior but not tested with this specific "no INSERT policy" table design |

---

## Open Questions (RESOLVED)

1. **Can Supabase's built-in invite email be suppressed on the FREE plan?**
   - What we know: `inviteUserByEmail()` sends a built-in email AND returns a token
   - What's unclear: Whether the Supabase invite email template can be entirely disabled so only Resend sends the email
   - Recommendation: Check Supabase Dashboard → Auth → Email Templates on the actual project before implementing the invite flow. If suppression is not available, either: (a) accept two emails, (b) use `createUser()` path instead of `inviteUserByEmail()` and manage the token entirely in the `invitations` table.

2. **`proxy.ts` DB call performance: acceptable at launch?**
   - What we know: `get_my_role()` is 1 additional DB call per request (after `getUser()` already makes 1). Total: 2 DB calls per page load in proxy.ts.
   - What's unclear: Whether this is acceptable under load for a dental clinic with 10+ concurrent users
   - Recommendation: Accept for Phase 1 (10 concurrent users). When migrating to Supabase Pro, add the Custom Access Token Hook — injects role into JWT, eliminating the proxy.ts role DB call entirely.

3. **CNPJ field: required at signup or optional?**
   - Decided: D-01 says CNPJ is required at signup screen
   - What's unclear: Validation edge case — what if the admin has an individual CPF/practice (not a formal CNPJ)? The `cpf-cnpj-validator` validates format and digit; accepting both formats may be needed
   - Recommendation: Accept both CPF (individual dentist) and CNPJ (clinic company) at signup. Use `z.union([zCpf(), zCnpj()])` in Zod schema.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js 16 | Assumed present (Phase 0 completed) | Node 20+ | — |
| Supabase CLI | `supabase db push` for migrations | Present (Phase 0 installed) | ^2.105.0 | — |
| Resend API key | Email sending | Requires account creation | — | No fallback — must create account before Phase 1 Wave 3 (email features) |
| `RESEND_API_KEY` env var | Resend emails | Not yet in `.env.local` | — | Add to `.env.local.example` in Phase 1 |
| `NEXT_PUBLIC_SITE_URL` env var | Auth redirect URLs | Not yet defined | — | Add to `.env.local.example` |

**Missing dependencies with no fallback:**
- Resend API key — required for invite email and password reset. Create account at resend.com before testing email flows. The Resend free tier (3,000 emails/month) is sufficient for development and early clinics.

**Missing dependencies with fallback:**
- `NEXT_PUBLIC_SITE_URL` — can default to `http://localhost:3000` in development; production value must be set in Vercel env vars before deploy.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — Wave 0 must create test infrastructure |
| Config file | None found |
| Quick run command | TBD — see Wave 0 Gaps |
| Full suite command | TBD — see Wave 0 Gaps |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Admin can create clinic account | integration | `npx vitest run tests/auth/signup.test.ts` | Wave 0 |
| AUTH-02 | Session persists across navigations | integration | `npx vitest run tests/auth/session.test.ts` | Wave 0 |
| AUTH-03 | Logout clears session cookies | unit | `npx vitest run tests/auth/logout.test.ts` | Wave 0 |
| AUTH-04 | proxy.ts uses getUser(), not getSession() | unit | `npx vitest run tests/proxy/auth.test.ts` | Wave 0 |
| AUTH-05 | All 4 roles can log in | integration | `npx vitest run tests/auth/rbac.test.ts` | Wave 0 |
| AUTH-06 | Tenant A cannot see Tenant B data | integration | `npx vitest run tests/auth/tenant-isolation.test.ts` | Wave 0 |
| AUTH-07 | tenant_id from public.users, not JWT metadata | unit | `npx vitest run tests/auth/tenant-source.test.ts` | Wave 0 |
| SEC-01 | Masked columns in list views | unit | `npx vitest run tests/security/masking.test.ts` | Wave 0 |
| SEC-02 | Audit log entry created on data change | integration | `npx vitest run tests/security/audit.test.ts` | Wave 0 |
| SEC-05 | patient_consents table exists with correct schema | unit (migration) | `npx vitest run tests/migrations/patient-consents.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/auth/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest` + `@vitest/coverage-v8` — not installed; install: `npm install -D vitest @vitest/coverage-v8`
- [ ] `vitest.config.ts` — create with test environment config
- [ ] `tests/` directory structure — create: `tests/auth/`, `tests/security/`, `tests/migrations/`
- [ ] `tests/helpers/supabase-test-client.ts` — helper for creating isolated test tenants
- [ ] All test files listed above — Wave 0 stubs with skeleton assertions

*(Note: AUTH-05 tenant isolation test requires creating 2 test tenants and 2 test users to verify cross-tenant data isolation — this is a true integration test requiring a live Supabase test project or local Supabase dev environment)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth password-based; `supabase.auth.signInWithPassword()` |
| V3 Session Management | yes | `@supabase/ssr` HTTP-only cookie session; `updateSession()` in proxy.ts |
| V4 Access Control | yes | Role matrix in proxy.ts + RLS policies |
| V5 Input Validation | yes | Zod v3 schemas on both client and Server Action |
| V6 Cryptography | yes | AES-256-GCM from Phase 0 `crypto.ts`; passwords via Supabase Auth (bcrypt) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged JWT for tenant impersonation | Spoofing | `getUser()` in proxy.ts validates against Supabase Auth server (C-4) |
| `user_metadata` mutation to steal tenant_id | Elevation of Privilege | `tenant_id` stored in `public.users` only, never in `user_metadata` (C-5) |
| Invite token reuse after expiry | Tampering | `expires_at < now()` check on acceptance; tokens are single-use |
| Service role key in client bundle | Information Disclosure | `import 'server-only'` on admin.ts; `security-check` npm script (C-2) |
| Cross-tenant cache leak in Server Components | Information Disclosure | Phase 1 uses `createClient()` (user JWT context) not `unstable_cache`; TanStack Query keys must include tenantId if caching is added |
| Audit log tampering | Tampering | `USING (false)` on DELETE/UPDATE policies; INSERT only via SECURITY DEFINER trigger or service role |
| Missing LGPD consent evidence | Repudiation | `patient_consents` table with `policy_version`, `ip_address`, `consented_at`, `revoked_at` |

---

## Sources

### Primary (HIGH confidence)
- [nextjs.org/docs/app/api-reference/file-conventions/proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — proxy.ts runs on Node.js runtime (v16.0.0+), can make DB calls
- [nextjs.org/blog/next-16](https://nextjs.org/blog/next-16) — proxy.ts replaces middleware.ts in Next.js 16
- [supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) — inviteUserByEmail API, service role required, options.data → user_metadata
- [supabase.com/docs/reference/javascript/auth-admin-createuser](https://supabase.com/docs/reference/javascript/auth-admin-createuser) — createUser with email_confirm:true, no email sent
- [supabase.com/docs/guides/auth/auth-email-templates](https://supabase.com/docs/guides/auth/auth-email-templates) — {{ .TokenHash }} variable for PKCE-compatible invite URLs
- [postgresql.org/docs/current/sql-altertable.html](https://www.postgresql.org/docs/current/sql-altertable.html) — ALTER TABLE RENAME updates FK constraints and dependent objects

### Secondary (MEDIUM confidence)
- Multiple Supabase community sources confirming `token_hash` + `verifyOtp()` pattern for PKCE/SSR invite acceptance
- [hoop.dev/blog/masking-sensitive-data-with-row-level-security](https://hoop.dev/blog/masking-sensitive-data-with-row-level-security) — CASE-based column masking in PostgreSQL views
- [npm: cpf-cnpj-validator@2.1.2](https://www.npmjs.com/package/cpf-cnpj-validator) — Zod adapter for CPF/CNPJ validation

### Tertiary (LOW confidence / ASSUMED)
- PostgreSQL function body text NOT auto-updated on table rename (single-source inference from PostgreSQL function storage model — `pg_proc.prosrc` is text)
- Supabase FREE plan cannot suppress built-in invite email (not explicitly documented; assumed from platform behavior)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified via npm registry 2026-06-04
- Architecture (rename migration): HIGH for FK/RLS auto-update; ASSUMED for function body behavior
- Architecture (proxy.ts role routing): HIGH — Next.js 16 docs confirm Node.js runtime
- Architecture (invite flow): HIGH for token_hash/verifyOtp pattern; ASSUMED for email suppression
- Pitfalls: HIGH — all based on project's PITFALLS.md (pre-researched) + Phase 0 actual code review

**Research date:** 2026-06-04
**Valid until:** 2026-09-04 (90 days — Next.js/Supabase are stable; Zod v3/v4 compatibility may shift sooner)
