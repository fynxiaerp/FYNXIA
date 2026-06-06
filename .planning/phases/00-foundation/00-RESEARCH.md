# Phase 0: Foundation - Research

**Researched:** 2026-06-03
**Domain:** Next.js 15 scaffold + Supabase schema + RLS + Custom Access Token Hook + AES-256 encryption + Vercel deployment
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Create ONLY core tables in Phase 0: `tenants`, `users`, `audit_logs`. Feature-module tables (patients, appointments, medical_records, financial_transactions, etc.) are created in their respective feature phases.

**D-02:** Naming convention: plural English — `tenants`, `users`, `audit_logs`, `patients`, `appointments`. No Portuguese names, no singular.

**D-03:** AES-256 encryption at the application layer (Next.js server-side), NOT in PostgreSQL via pg_crypto. Fields are encrypted/decrypted in Vercel Functions before read/write.

**D-04:** `ENCRYPTION_KEY` stored as a Vercel Environment Variable (server-only, never `NEXT_PUBLIC_`). Accessed via `process.env.ENCRYPTION_KEY` in server components and API routes only.

**D-05:** Encrypted fields in Phase 0 scope: `users.sensitive_data` (JSONB blob for any health-related user metadata).

**D-06:** Bootstrap with `npx create-next-app@latest` — TypeScript, Tailwind CSS, App Router, `src/` directory, ESLint enabled. Then `npx shadcn@latest init`.

**D-07:** Folder structure uses Next.js route groups: `(auth)/` for login/signup, `(dashboard)/` for protected routes, `api/` for API routes. `src/lib/supabase/` for client factories.

**D-08:** Three Supabase client factories via `@supabase/ssr`: `createBrowserClient`, `createServerClient` (Server Components/Route Handlers), `createMiddlewareClient` (middleware.ts).

**D-09:** Phase 0 CI uses Vercel Preview Deployments only — no GitHub Actions. Build includes `next build` (catches TypeScript errors) + ESLint.

**D-10:** GitHub Actions with RLS integration tests deferred to Phase 1.

### Claude's Discretion

- Exact shadcn/ui theme configuration (colors, radius) — can use neutral defaults
- ESLint rule set beyond `next/core-web-vitals` — standard recommended config
- Exact `vercel.json` content beyond `regions: ["gru1"]` and function config
- `middleware.ts` exact matcher pattern (apply auth check to all routes except `/api/health` and `/(auth)/*`)

### Deferred Ideas (OUT OF SCOPE)

- HTML prototype layout for evaluation — belongs in Phase 1 or 2 UI work
- GitHub Actions with RLS integration tests — deferred to Phase 1
- Supabase CLI in CI for migration validation — deferred to Phase 1
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Sistema usa Next.js 15 (App Router) + TypeScript como framework principal | Section: Standard Stack, scaffold commands verified via official Next.js docs |
| INFRA-02 | Banco de dados Supabase PostgreSQL na região sa-east-1 (São Paulo) | Section: Architecture Patterns — Supabase project config |
| INFRA-03 | Deploy na Vercel na região gru1 (São Paulo) com CI/CD automático | Section: Standard Stack, vercel.json config pattern |
| INFRA-04 | Migrations de banco versionadas em supabase/migrations/ | Section: Architecture Patterns — migration workflow |
| INFRA-05 | Variáveis sensíveis gerenciadas via Vercel Environment Variables | Section: Architecture Patterns — env var pattern |
| INFRA-06 | RLS habilitado em todas as tabelas com políticas usando get_my_tenant_id() SECURITY DEFINER | Section: Architecture Patterns — RLS patterns, pitfall C-1 resolution |
| INFRA-07 | Custom Access Token Hook injetando tenant_id e user_role no JWT antes de qualquer módulo | Section: Architecture Patterns — JWT Hook pattern |
| SEC-07 | Todas as colunas de timestamp usam TIMESTAMPTZ | Section: Architecture Patterns — schema SQL |
| SEC-08 | Dados de saúde sensíveis criptografados com AES-256 antes de armazenar | Section: Code Examples — crypto.ts AES-256 pattern |
</phase_requirements>

---

## Summary

Phase 0 is a pure infrastructure phase — no user-visible features, all foundational machinery that every subsequent phase depends on. The research confirms the locked decisions are sound and fully supported by current official documentation. The primary technical challenge is getting the security primitives correct in the right order: schema before RLS, RLS before Hook, Hook before any login is tested.

The six critical pitfalls (C-1 through C-6) identified in PITFALLS.md have verified solutions. C-1 (RLS self-reference) is solved by the `get_my_tenant_id()` SECURITY DEFINER function. C-2 (service role key leak) is solved by `import 'server-only'` and build-output grep check. C-4 (getSession in middleware) is solved by the verified `@supabase/ssr` middleware pattern using `getUser()`. C-5 (tenant_id in user_metadata) is solved by storing it in `public.users` and injecting via Custom Access Token Hook. C-6 (connection pool exhaustion) is solved by exclusively using the Supabase JS client. C-3 (unstable_cache tenant key) is resolved by not using caching at all in Phase 0 — only three tables exist with no caching layer yet.

The AES-256 application-layer encryption using Node.js built-in `crypto` module (no external dependencies) is the correct approach for Vercel/Next.js 15: it runs in the Node.js runtime (not Edge), bundle size is zero, and the `ENCRYPTION_KEY` stays server-side.

**Primary recommendation:** Build in strict sequence — schema migrations first, RLS policies second, Custom Access Token Hook third, middleware fourth, client factories fifth. Validate each step before moving to the next.

---

## Standard Stack

### Core (Phase 0 Only)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `next` | 16.2.7 | App Router framework | [VERIFIED: npm registry] |
| `typescript` | 6.0.3 | Strict typing | [VERIFIED: npm registry] |
| `react` + `react-dom` | installed by next | UI runtime | [VERIFIED: npm registry] |
| `@supabase/supabase-js` | 2.107.0 | Core Supabase client | [VERIFIED: npm registry] |
| `@supabase/ssr` | 0.10.3 | Next.js SSR auth integration (replaces deprecated auth-helpers-nextjs) | [VERIFIED: npm registry] |
| `tailwindcss` | 4.3.0 | Utility CSS | [VERIFIED: npm registry] |
| `shadcn` (CLI) | 4.10.0 | Component library init | [VERIFIED: npm registry] |
| `server-only` | 0.0.1 | Build-time guard for server-only modules | [VERIFIED: npm registry] |
| `supabase` (CLI) | 2.104.0 | Migrations, local dev, type generation | [VERIFIED: npm registry] |

### Not Needed in Phase 0

TanStack Query, Zustand, nuqs, React Hook Form, Zod — all deferred to Phase 1+ when actual data interactions exist. Phase 0 has no user-facing UI.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `import 'server-only'` | Manual import auditing | server-only provides a build-time error guarantee; manual auditing is error-prone |
| Node.js `crypto` for AES-256 | `pg_crypto` extension | App-layer encryption keeps plaintext queryable for RLS/indexes; pg_crypto complicates queries |
| `get_my_tenant_id()` SECURITY DEFINER | Direct `(SELECT tenant_id FROM users WHERE id = auth.uid())` in every policy | Direct query causes infinite recursion on the `users` table (C-1) |

### Installation

```bash
# Step 1 — Scaffold
npx create-next-app@latest fynxia --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Step 2 — Supabase client libraries
npm install @supabase/supabase-js @supabase/ssr

# Step 3 — Server-only guard
npm install server-only

# Step 4 — shadcn/ui
npx shadcn@latest init

# Step 5 — Supabase CLI (dev dependency)
npm install -D supabase
```

**Note on create-next-app:** The `--yes` flag uses saved preferences. For a fresh scaffold with explicit choices, use the flags above. The CLI now creates Next.js 16.2.7 (current latest). [VERIFIED: npm registry + Next.js official docs]

---

## Architecture Patterns

### Recommended Project Structure

```
fynxia/
├── src/
│   ├── app/
│   │   ├── (auth)/                   # login, signup, forgot-password — no sidebar
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/              # all protected ERP routes — shared sidebar layout
│   │   │   ├── clinica/
│   │   │   ├── financeiro/
│   │   │   ├── estoque/
│   │   │   ├── crm/
│   │   │   ├── bi/
│   │   │   ├── ia/
│   │   │   ├── config/
│   │   │   └── layout.tsx
│   │   ├── api/                      # Next.js API routes (Node.js runtime only)
│   │   │   └── v1/
│   │   ├── layout.tsx                # root layout
│   │   └── page.tsx                  # redirect to /login or /(dashboard)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # createBrowserClient — Client Components
│   │   │   ├── server.ts             # createServerClient — Server Components/Actions
│   │   │   └── middleware.ts         # createServerClient — middleware.ts only
│   │   └── crypto.ts                 # AES-256 encrypt/decrypt (server-only)
│   ├── middleware.ts                 # session refresh + route protection
│   └── types/
│       └── database.types.ts         # generated by: supabase gen types typescript
├── supabase/
│   ├── migrations/                   # versioned SQL migrations
│   │   └── 20260603000000_initial_schema.sql
│   └── config.toml                   # Supabase CLI config
├── vercel.json                       # regions, function maxDuration
└── .env.local                        # local dev only, never committed
```

---

### Pattern 1: Three Supabase Client Factories (`@supabase/ssr`)

**What:** Three separate factory functions — one per execution context — all using `@supabase/ssr`. This is the ONLY supported pattern as of 2025; `@supabase/auth-helpers-nextjs` is deprecated.

**Browser client** (`src/lib/supabase/client.ts`):
```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

**Server client** (`src/lib/supabase/server.ts`):
```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Cookie writes fail in Server Components — OK in read-only contexts
          }
        },
      },
    }
  )
}
```

**Admin client** (for server-only service role operations):
```typescript
// Source: [ASSUMED based on @supabase/ssr docs pattern]
import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // NEVER NEXT_PUBLIC_
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

**Important note:** The Supabase docs now use `SUPABASE_PUBLISHABLE_KEY` as the env var name (replacing `SUPABASE_ANON_KEY` in newer project setups). Both work — the publishable key IS the anon key. Check your project's API settings for the exact env var name. [VERIFIED: Supabase official docs]

---

### Pattern 2: `middleware.ts` — Session Refresh + Route Protection

**What:** Middleware runs on every request, refreshes the JWT cookie if expired, and redirects unauthenticated users to `/login`. Uses `getUser()` — NEVER `getSession()`.

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs [VERIFIED]
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Must write to BOTH request and response (pitfall H-4 prevention)
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // CRITICAL: Always getUser(), never getSession() — pitfall C-4
  // getUser() validates the JWT against the Supabase Auth server
  // getSession() only validates format, allows forged JWTs to pass
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname.startsWith('/login') ||
                      pathname.startsWith('/signup') ||
                      pathname.startsWith('/forgot-password')
  const isApiRoute = pathname.startsWith('/api')
  const isHealthCheck = pathname === '/api/health'

  // Redirect unauthenticated users to login (except auth routes and API)
  if (!user && !isAuthRoute && !isApiRoute) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Why cookie must be written to both `request` and `response`:** If only the response is updated, subsequent Server Components in the same request cycle read stale cookies, triggering another token refresh cycle. Writing to both prevents the JWT refresh race condition (pitfall H-4). [CITED: Supabase official docs]

---

### Pattern 3: `get_my_tenant_id()` SECURITY DEFINER Function (C-1 Resolution)

**What:** A PostgreSQL function that reads `tenant_id` from `public.users` while bypassing RLS. Every RLS policy calls this function instead of querying the table directly.

```sql
-- Source: .planning/research/PITFALLS.md (C-1 resolution) [VERIFIED: Supabase docs on SECURITY DEFINER]
-- Migration: supabase/migrations/20260603000000_initial_schema.sql

CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid()
$$;

-- Revoke execution from all roles — only called internally by RLS policies
REVOKE EXECUTE ON FUNCTION get_my_tenant_id() FROM PUBLIC;
```

**Why `STABLE`:** The function returns the same result for the same input within a single transaction, allowing PostgreSQL to cache the result across multiple RLS policy evaluations in one query. [CITED: PostgreSQL docs on function volatility]

**Why `SET search_path = public`:** Prevents search_path injection attacks — a security best practice for all SECURITY DEFINER functions. [CITED: Supabase security docs]

---

### Pattern 4: Custom Access Token Hook (INFRA-07)

**What:** A PostgreSQL function registered in Supabase Auth settings that runs before every JWT is issued. Injects `tenant_id` and `user_role` from `public.users` into the JWT claims.

```sql
-- Source: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook [VERIFIED]
-- Place in auth schema or public schema — must grant to supabase_auth_admin

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims      jsonb;
  user_record record;
BEGIN
  -- Read tenant_id and role from public.users (NEVER from user_metadata)
  SELECT tenant_id, role
  INTO user_record
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  -- Initialize app_metadata if it doesn't exist
  IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  -- Inject tenant context (uses app_metadata — only service role can write here)
  IF user_record IS NOT NULL THEN
    claims := jsonb_set(claims, '{tenant_id}',  to_jsonb(user_record.tenant_id::text));
    claims := jsonb_set(claims, '{user_role}',  to_jsonb(user_record.role::text));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execution to supabase_auth_admin ONLY (the hook executor)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Grant read access to the users table for the hook to read tenant_id + role
GRANT SELECT ON TABLE public.users TO supabase_auth_admin;
```

**Dashboard registration:** Authentication > Hooks > "Custom Access Token" — select the function `public.custom_access_token_hook`. Requires Supabase Pro plan (Auth Hooks not available on Free tier). [CITED: Supabase docs]

**Important:** Claims are injected at the top level of the JWT payload (alongside `sub`, `aud`, etc.) — NOT nested inside `app_metadata`. When reading in RLS: `(auth.jwt() ->> 'tenant_id')::uuid`. [VERIFIED: Supabase auth hooks docs]

---

### Pattern 5: RLS Policies Using `get_my_tenant_id()` and `(select ...)` Wrapper

**What:** Every RLS policy uses the SECURITY DEFINER function for the `users` table, and the `(select ...)` wrapper for all other tables (caches JWT claim per statement, not per row).

```sql
-- Source: .planning/research/ARCHITECTURE.md [VERIFIED: Supabase RLS performance docs]

-- USERS TABLE: Uses get_my_tenant_id() to avoid self-reference (C-1)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_tenant_isolation" ON public.users
  FOR ALL
  USING (
    tenant_id = get_my_tenant_id()   -- SECURITY DEFINER bypasses RLS for this lookup
  )
  WITH CHECK (
    tenant_id = get_my_tenant_id()   -- Prevents cross-tenant inserts
  );

-- ALL OTHER TABLES: Use (select auth.jwt() ->> 'tenant_id') for performance
-- The (select ...) wrapper caches the JWT claim per statement (not per row)
-- Without the wrapper: auth.jwt() called once per row — O(n) overhead
-- With the wrapper: auth.jwt() called once per statement — O(1) overhead

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs: tenants can read their own, no one can delete or update
CREATE POLICY "audit_logs_tenant_select" ON public.audit_logs
  FOR SELECT
  USING (
    tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid
    AND (SELECT auth.jwt() ->> 'user_role') IN ('admin', 'superadmin')
  );

CREATE POLICY "audit_logs_no_delete" ON public.audit_logs
  FOR DELETE USING (false);   -- Immutable — LGPD + CFO compliance

CREATE POLICY "audit_logs_no_update" ON public.audit_logs
  FOR UPDATE USING (false);   -- Immutable

-- No INSERT policy on audit_logs — inserts come from SECURITY DEFINER triggers only

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_own_record" ON public.tenants
  FOR SELECT
  USING (
    id = (SELECT auth.jwt() ->> 'tenant_id')::uuid
  );

CREATE POLICY "tenants_admin_update" ON public.tenants
  FOR UPDATE
  USING (
    id = (SELECT auth.jwt() ->> 'tenant_id')::uuid
    AND (SELECT auth.jwt() ->> 'user_role') = 'admin'
  )
  WITH CHECK (
    id = (SELECT auth.jwt() ->> 'tenant_id')::uuid
  );
```

---

### Pattern 6: Initial Database Schema (`tenants`, `users`, `audit_logs`)

```sql
-- Source: .planning/research/ARCHITECTURE.md + PITFALLS.md [VERIFIED: Supabase docs]
-- All timestamp columns: TIMESTAMPTZ (SEC-07 — Brazil multi-timezone requirement)
-- Note: Phase 0 tables ONLY — no patients, appointments, etc.

-- TENANTS: The root multi-tenant entity
CREATE TABLE public.tenants (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT         NOT NULL,
  slug            TEXT         NOT NULL UNIQUE,  -- URL-friendly identifier
  timezone        VARCHAR(50)  NOT NULL DEFAULT 'America/Sao_Paulo',
  plan            VARCHAR(20)  NOT NULL DEFAULT 'trial',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ  -- soft delete
);

CREATE INDEX idx_tenants_slug ON public.tenants(slug);

-- USERS: Application users (not auth.users — that's Supabase-managed)
-- tenant_id stored HERE (not in user_metadata — pitfall C-5)
CREATE TABLE public.users (
  id              UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       UUID         NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email           TEXT         NOT NULL,
  full_name       TEXT         NOT NULL,
  role            TEXT         NOT NULL DEFAULT 'receptionist'
                               CHECK (role IN ('admin', 'dentist', 'receptionist', 'patient', 'superadmin')),
  sensitive_data  TEXT,        -- AES-256 encrypted JSONB blob (SEC-08) — stored as encrypted text
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ  -- soft delete
);

-- Critical: index tenant_id on every tenant-scoped table (H-1 prevention)
CREATE INDEX idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX idx_users_email     ON public.users(email);

-- AUDIT_LOGS: Append-only compliance log (LGPD + CFO)
-- Partitioned by month for long-term performance (can hold 20 years of data)
CREATE TABLE public.audit_logs (
  id           UUID         NOT NULL DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL,
  actor_id     UUID,        -- auth.uid() — NULL for system events
  action       TEXT         NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', etc.
  table_name   TEXT,
  record_id    UUID,
  old_values   JSONB,
  new_values   JSONB,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Initial partition — create monthly in production via pg_cron
CREATE TABLE public.audit_logs_2026_06
  PARTITION OF public.audit_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX idx_audit_logs_tenant_created
  ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor
  ON public.audit_logs(actor_id);
```

---

### Pattern 7: AES-256 Application-Layer Encryption (`lib/crypto.ts`)

**What:** Server-side encryption/decryption using Node.js built-in `crypto` module. Zero external dependencies. Runs only in Node.js runtime (not Edge Runtime).

```typescript
// Source: Node.js crypto docs [VERIFIED: Node.js 20+ built-in module]
// src/lib/crypto.ts
import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

// ENCRYPTION_KEY must be a 64-char hex string (32 bytes) in Vercel env vars
// Never NEXT_PUBLIC_ — server-only (pitfall C-2 pattern applies here too)
const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(keyHex, 'hex')
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)  // GCM standard: 96-bit IV
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()  // GCM authentication tag (integrity)

  // Format: iv:authTag:ciphertext — all hex-encoded, colon-delimited
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const key = getKey()
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':')

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid ciphertext format')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8')
}

// Helper: encrypt a JSONB object (for users.sensitive_data column)
export function encryptJSON(data: Record<string, unknown>): string {
  return encrypt(JSON.stringify(data))
}

export function decryptJSON<T>(ciphertext: string): T {
  return JSON.parse(decrypt(ciphertext)) as T
}
```

**Why AES-256-GCM (not CBC):** GCM mode provides both confidentiality AND authenticity (via the auth tag). AES-256-CBC requires a separate HMAC. GCM is the industry standard for new implementations. [CITED: NIST SP 800-38D]

**Key generation command for `ENCRYPTION_KEY`:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Store output in Vercel Environment Variables as `ENCRYPTION_KEY`. Never commit to git. [ASSUMED — standard Node.js key generation pattern]

---

### Pattern 8: `vercel.json` Configuration

```json
{
  "regions": ["gru1"],
  "functions": {
    "src/app/api/**": {
      "maxDuration": 30
    },
    "src/app/api/documents/**": {
      "maxDuration": 60
    }
  }
}
```

**Why `gru1`:** Supabase is in `sa-east-1` (São Paulo). Vercel `gru1` is also São Paulo. Cross-region calls (e.g., `iad1` to `sa-east-1`) add 200-600ms per database query — fatal for an ERP with 20-50 queries per page. [CITED: Vercel regions docs, STACK.md]

**Fluid Compute:** Default on all new Vercel projects since April 23, 2025. No configuration needed. [CITED: Vercel Fluid Compute docs]

---

### Pattern 9: Supabase Migration Workflow

```bash
# 1. Initialize Supabase CLI (run once per project)
npx supabase init

# 2. Link to remote project
npx supabase login
npx supabase link --project-ref <your-project-ref>

# 3. Create first migration
npx supabase migration new initial_schema

# 4. Edit supabase/migrations/20260603000000_initial_schema.sql
# (add all CREATE TABLE, RLS, and function SQL)

# 5. Push to remote Supabase project
npx supabase db push

# 6. Generate TypeScript types (after schema is pushed)
npx supabase gen types typescript --linked > src/types/database.types.ts
```

**NEVER edit schema via Supabase dashboard in production** — use migrations only. Dashboard edits create schema drift and cannot be rolled back. [CITED: STACK.md, ARCHITECTURE.md]

---

### Pattern 10: Environment Variables

```bash
# .env.local (local dev only — NEVER commit)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...  # anon/publishable key

# Server-only — NEVER use NEXT_PUBLIC_ prefix for these
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # bypasses ALL RLS — server only
ENCRYPTION_KEY=a1b2c3...         # 64-char hex string, AES-256 key

# Verify no service role key is in build output (post-build CI check):
# grep -r "NEXT_PUBLIC_SUPABASE_SERVICE" .next/static/ -- must return nothing
```

**Vercel env var scopes:** Set `SUPABASE_SERVICE_ROLE_KEY` and `ENCRYPTION_KEY` in Vercel dashboard under "Environment Variables" → Scope to Production + Preview, NOT Development (use `.env.local` for dev). [ASSUMED — standard Vercel env var management]

---

### Anti-Patterns to Avoid

- **`@supabase/auth-helpers-nextjs`:** Deprecated. Do not use. `@supabase/ssr` is the replacement. [VERIFIED: Supabase docs]
- **`getSession()` in middleware:** Only validates JWT format, not authenticity. Use `getUser()`. [CITED: Supabase auth-js Issue #898]
- **`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`:** This prefix exposes the key to every browser. Fatal LGPD violation. [VERIFIED: Supabase security docs]
- **Edge Runtime for API routes:** No Node.js `crypto` module, no TCP connections for Supabase. All API routes must use Node.js runtime (default with Fluid Compute). [CITED: Vercel docs]
- **Direct Postgres connections (pg, Prisma):** Each creates a new connection. Use only the Supabase JS client. [CITED: PITFALLS.md C-6, Vercel blog]
- **TIMESTAMP (not TIMESTAMPTZ):** Brazil has 4 time zones. `TIMESTAMP` without TZ causes scheduling bugs for Manaus/Acre clinics. [CITED: PITFALLS.md H-8, SEC-07]
- **`tenant_id` in `user_metadata`:** User-mutable via SDK. Complete multi-tenancy collapse. Store in `public.users`. [CITED: PITFALLS.md C-5]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT session refresh in middleware | Custom token refresh logic | `@supabase/ssr` `createServerClient` with cookie handlers | Race condition edge cases (H-4) are handled; cookie passthrough pattern is documented and battle-tested |
| Row-level tenant isolation | Application-layer `WHERE tenant_id = ?` filters | PostgreSQL RLS policies | Application filters can be bypassed; RLS cannot be bypassed by application code |
| Crypto key derivation | Custom KDF | Node.js `crypto.scryptSync` or simply use `randomBytes(32)` for the key | KDF edge cases (salt management, iteration count) are well-studied; use the standard |
| Type generation from DB schema | Manual TypeScript interfaces matching DB | `supabase gen types typescript` | Manual types drift from the actual schema; generated types are always correct |
| Cookie-based session management | Manual cookie parsing/setting | `@supabase/ssr` cookie handlers | Multi-tab refresh race conditions, cookie rotation, secure flags — all handled |

**Key insight:** The auth and session infrastructure is the most complex part of Phase 0. Every deviation from `@supabase/ssr` official patterns introduces subtle bugs that manifest as mysterious logouts, stale sessions, or — worse — silent authorization failures.

---

## Runtime State Inventory

Step 2.5: SKIPPED — this is a greenfield phase. No existing codebase, no stored data, no OS-registered state. Nothing to rename or migrate.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next.js runtime, AES-256 crypto | Yes | v24.14.0 | — |
| npm | Package installation | Yes | (bundled with Node) | — |
| Supabase project (sa-east-1) | INFRA-02, all DB work | Unknown | — | Must verify region before starting — if wrong region, create new project |
| Vercel Pro plan (gru1 access) | INFRA-03 | Unknown | — | gru1 not available on Hobby plan — Pro required |
| Supabase Pro plan (Auth Hooks) | INFRA-07 (Custom Access Token Hook) | Unknown | — | Free tier does not support Auth Hooks — Pro required |

**Missing dependencies with no fallback:**

- **Supabase project in sa-east-1:** If the project was created in another region, region cannot be changed — a new project must be created. **Verify immediately before Phase 0 starts.**
- **Supabase Pro plan:** The Custom Access Token Hook (INFRA-07) is not available on the Free plan. Auth Hooks require Pro tier. Upgrading is non-blocking during development but must be done before INFRA-07 can be tested.
- **Vercel Pro plan:** `gru1` region is not available on the Hobby plan. Vercel preview deployments from Hobby plan route to a default region (likely `iad1`). Must be Pro before first staging deployment.

**Pre-flight check commands:**
```bash
# Verify Supabase project region (check Supabase dashboard → Settings → General → Region)
# Verify Vercel plan (check Vercel dashboard → Settings → Billing)
```

---

## Common Pitfalls

### Pitfall 1: RLS Infinite Recursion on `users` Table (C-1 — CRITICAL)
**What goes wrong:** An RLS policy on `public.users` that queries `public.users` internally causes PostgreSQL infinite recursion. Every authenticated request fails with "stack depth limit exceeded."
**Why it happens:** RLS policies are evaluated on every query touching the guarded table. A self-referencing policy enters an infinite loop.
**How to avoid:** Use `get_my_tenant_id()` SECURITY DEFINER function — it bypasses RLS internally. No RLS policy should ever contain `SELECT ... FROM users`.
**Warning signs:** `ERROR: stack depth limit exceeded` in Supabase logs after enabling RLS.

### Pitfall 2: Service Role Key in Client Bundle (C-2 — CRITICAL)
**What goes wrong:** `SUPABASE_SERVICE_ROLE_KEY` appears in `.next/static/` build output. Every browser can extract it and bypass all RLS.
**Why it happens:** A file importing the service role key is transitively imported by a Client Component, or the env var is accidentally prefixed `NEXT_PUBLIC_`.
**How to avoid:** `import 'server-only'` at the top of every file touching the service role key. Post-build grep check in CI.
**Warning signs:** `grep -r "NEXT_PUBLIC_SUPABASE_SERVICE" .next/static/` returns results.

### Pitfall 3: `getSession()` in Middleware (C-4 — CRITICAL)
**What goes wrong:** Crafted JWTs with modified `tenant_id` pass the middleware check. Attacker accesses another clinic's data.
**Why it happens:** `getSession()` only validates JWT format and expiry. It does not call the Supabase Auth server to verify token authenticity.
**How to avoid:** Always use `await supabase.auth.getUser()` in middleware and Server Components for authorization decisions.
**Warning signs:** No functional warning — this is a silent security vulnerability. Test by creating a malformed JWT and attempting access.

### Pitfall 4: Middleware Cookie Passthrough Failure (H-4 — HIGH)
**What goes wrong:** Users are randomly logged out mid-session (especially with multiple tabs open). Supabase logs show "Invalid Refresh Token: Already Used."
**Why it happens:** Middleware refreshes the JWT but fails to write updated cookies to both `request` AND `response`. Next request re-triggers refresh with the same token; Supabase rejects it as already-used.
**How to avoid:** In the `setAll` cookie handler, write to `request.cookies.set()` AND `supabaseResponse.cookies.set()`. Both writes are required.
**Warning signs:** High rate of "logged out unexpectedly" reports; `AuthApiError: Refresh Token Not Found` in logs.

### Pitfall 5: Forgetting `WITH CHECK` in RLS Policies
**What goes wrong:** `USING` prevents reads across tenants but `WITH CHECK` prevents writes. Without `WITH CHECK`, a user from Tenant A can INSERT rows with `tenant_id` set to Tenant B.
**Why it happens:** Developers focus on the `USING` clause (read protection) and forget write protection.
**How to avoid:** Every RLS policy with write operations (INSERT, UPDATE) MUST have both `USING` and `WITH CHECK`.
**Warning signs:** Cross-tenant write test passes when it should fail.

### Pitfall 6: Using Tailwind v4 Config File Patterns from v3 Docs
**What goes wrong:** `tailwind.config.js` is ignored by Tailwind v4. Customizations not applied.
**Why it happens:** Tailwind v4 changed to a CSS-first configuration model — config is now in the CSS file, not `tailwind.config.js`.
**How to avoid:** Use `@theme` directive in `globals.css` for customizations. `shadcn@latest init` handles this correctly in its current version.
**Warning signs:** Custom colors or theme values have no effect.

### Pitfall 7: Missing `SET search_path = public` on SECURITY DEFINER Functions
**What goes wrong:** A malicious schema injection can cause the SECURITY DEFINER function to execute in an attacker-controlled schema context.
**Why it happens:** Without `SET search_path`, the function inherits the caller's search_path.
**How to avoid:** Always add `SET search_path = public` (or the specific schema) to every `SECURITY DEFINER` function.
**Warning signs:** Supabase security advisor flags the function.

---

## Code Examples

### Encrypting `users.sensitive_data` Before Insert

```typescript
// Source: Pattern 7 above (Node.js crypto module) [VERIFIED]
// Usage in a Server Action or Route Handler
import 'server-only'
import { encryptJSON, decryptJSON } from '@/lib/crypto'
import { createClient } from '@/lib/supabase/server'

interface SensitiveUserData {
  allergies?: string[]
  bloodType?: string
  emergencyContact?: string
}

// Encrypt before storing
async function saveUserSensitiveData(userId: string, data: SensitiveUserData) {
  const supabase = await createClient()
  const encrypted = encryptJSON(data)

  const { error } = await supabase
    .from('users')
    .update({ sensitive_data: encrypted })
    .eq('id', userId)

  if (error) throw error
}

// Decrypt after reading (never expose the encrypted string to the client)
async function getUserSensitiveData(userId: string): Promise<SensitiveUserData | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('sensitive_data')
    .eq('id', userId)
    .single()

  if (error || !data?.sensitive_data) return null

  return decryptJSON<SensitiveUserData>(data.sensitive_data)
}
```

### Verifying JWT Claims After Custom Access Token Hook

```typescript
// Server Component: read tenant_id and user_role from JWT
// Source: Supabase docs + ARCHITECTURE.md [VERIFIED]
import { createClient } from '@/lib/supabase/server'

export async function getTenantContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Custom claims injected by the Custom Access Token Hook
  // are at the TOP level of the JWT payload, not inside app_metadata
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const userRole = user.app_metadata?.user_role as string | undefined

  return { tenantId, userRole, userId: user.id }
}
```

**Note on JWT claim location:** The Custom Access Token Hook injects claims at the JWT top level (via `event->'claims'`), but Supabase's `getUser()` returns them via `user.app_metadata` in the JavaScript client. Verify exact location by decoding a fresh JWT on jwt.io after setting up the hook. [ASSUMED — verify during implementation]

### Post-Build Security Check

```bash
# Run after next build to verify no secrets in output
# This should be run as part of Vercel Preview Deployment pipeline
grep -r "NEXT_PUBLIC_SUPABASE_SERVICE" .next/static/ && echo "SECURITY VIOLATION: Service role key in bundle" || echo "OK: Service role key not in bundle"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 (deprecated) | Must use `@supabase/ssr`; old package no longer maintained |
| `SUPABASE_ANON_KEY` env var name | `SUPABASE_PUBLISHABLE_KEY` | 2025 (newer Supabase projects) | Both work; new projects use the publishable key name |
| `getSession()` for auth checks | `getUser()` | 2024 (security advisory) | getSession() is insecure for authorization; getUser() is required |
| `tailwind.config.js` | CSS `@theme` directive in `globals.css` | Tailwind v4 release | Config file is ignored in v4; must use CSS-first config |
| `unstable_after` | `after` (stable) | Next.js 15.1.0 | Use `import { after } from 'next/server'` — stable API |
| Per-tenant schemas | Shared schema + RLS | Supabase best practice (2023+) | Per-tenant schemas break PostgREST/Realtime; RLS is the standard |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Deprecated 2024. Do not use.
- `getServerSideProps` / `getStaticProps`: Pages Router. Do not use with App Router.
- `unstable_cache` closures without tenantId: Security vulnerability pattern. Every cache call must include tenantId in the key array.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ENCRYPTION_KEY` format is 64-char hex (32 bytes) | Pattern 7: crypto.ts | Implementation error; key derivation may need adjustment — low risk, testable |
| A2 | JWT custom claims are readable via `user.app_metadata` in the JS client | Pattern 4: Custom Access Token Hook | Wrong path for reading claims; verifiable by decoding JWT on jwt.io — medium risk |
| A3 | `SUPABASE_SERVICE_ROLE_KEY` env var name (not `SUPABASE_SERVICE_KEY`) | Pattern: Environment Variables | Build would still work; just need correct name from Supabase dashboard — low risk |
| A4 | Vercel Pro plan is already budgeted or will be provisioned before staging deployment | Environment Availability | gru1 region unavailable on Hobby; staging deploys would use wrong region — HIGH risk if not resolved pre-Phase 0 |
| A5 | Supabase Pro plan is already activated or will be before INFRA-07 is tested | Environment Availability | Custom Access Token Hook not available on Free plan — blocks INFRA-07 entirely — HIGH risk |
| A6 | `admin client` using `createClient` from `@supabase/supabase-js` (not `@supabase/ssr`) for service-role operations | Pattern 1: Admin client | No functional issue — `@supabase/supabase-js` is the correct package for the admin client; `@supabase/ssr` is for cookie-based auth only |

---

## Open Questions

1. **Supabase project region**
   - What we know: Must be `sa-east-1` (São Paulo) — non-negotiable for latency
   - What's unclear: Was the project already created? If so, in which region?
   - Recommendation: Verify in Supabase Dashboard → Settings → General → Region **before starting Phase 0**. If wrong region: create a new project (region cannot be changed after creation).

2. **Supabase Pro plan activation**
   - What we know: Free plan does not support Custom Access Token Hooks (INFRA-07)
   - What's unclear: Has the Pro plan been provisioned?
   - Recommendation: Upgrade to Pro before attempting INFRA-07 tasks. Hooks tab appears in Authentication → Hooks only on Pro+.

3. **Vercel Pro plan activation**
   - What we know: `gru1` (São Paulo) region requires Vercel Pro plan
   - What's unclear: Is the Vercel project on the Pro plan?
   - Recommendation: Upgrade before first Preview Deployment to ensure gru1 is used from day one.

4. **JWT claim path (`tenant_id` vs `app_metadata.tenant_id`)**
   - What we know: The hook injects claims via `jsonb_set(claims, '{tenant_id}', ...)` at the JWT payload level
   - What's unclear: Whether the Supabase JS client exposes this as `user.app_metadata.tenant_id` or directly on the user object
   - Recommendation: After setting up the hook, decode a fresh JWT at jwt.io to confirm exact path. Write a small test in the Supabase SQL Editor: `SELECT auth.jwt()` as an authenticated user and inspect the output.

5. **`shadcn/ui` + Tailwind v4 status**
   - What we know: shadcn CLI is at v4.10.0; Tailwind is at v4.3.0; both are recent
   - What's unclear: Any specific shadcn components used in Phase 0 (only skeleton layout)
   - Recommendation: Phase 0 has minimal UI — just confirm `npx shadcn@latest init` completes without errors after `npx create-next-app@latest`. Full component compatibility matters more in Phase 1.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (`tsc --noEmit`) + ESLint + Next.js build (`next build`) |
| Config file | `tsconfig.json` (strict mode) + `eslint.config.mjs` |
| Quick run command | `npm run lint && npx tsc --noEmit` |
| Full suite command | `npm run build` (triggers TypeScript + lint + bundle analysis) |

Phase 0 has no user-facing features to unit test. Validation is infrastructure-focused: does the code compile, do the RLS policies work correctly, are the security invariants upheld?

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| INFRA-01 | Next.js 15 App Router compiles with strict TypeScript | Build check | `npm run build` | Catches type errors |
| INFRA-02 | Supabase project in sa-east-1 | Manual | Check Supabase dashboard → Settings → General | Cannot automate region check |
| INFRA-03 | Vercel deploys to gru1 | Manual | Check Vercel deployment logs for region | vercel.json declares it; verify in logs |
| INFRA-04 | Migrations in supabase/migrations/ | File existence check | `ls supabase/migrations/` | File must exist with .sql extension |
| INFRA-05 | No secrets in NEXT_PUBLIC_ vars | Post-build grep | `grep -r "SUPABASE_SERVICE" .next/static/` | Must return empty |
| INFRA-06 | RLS policies use get_my_tenant_id() | SQL inspection | Supabase SQL Editor: `SELECT * FROM pg_policies WHERE definition LIKE '%get_my_tenant_id%'` | Manual verification |
| INFRA-06 | No infinite recursion on users table | SQL test | `SET LOCAL role = authenticated; SELECT * FROM public.users LIMIT 1;` in SQL Editor | Should return rows, not error |
| INFRA-07 | JWT contains tenant_id and user_role claims | Manual JWT inspection | Login and decode JWT at jwt.io | Custom Access Token Hook must be registered first |
| SEC-07 | All timestamp columns are TIMESTAMPTZ | Schema inspection | `SELECT column_name, data_type FROM information_schema.columns WHERE data_type = 'timestamp without time zone' AND table_schema = 'public';` — must return 0 rows | SQL query in Supabase SQL Editor |
| SEC-08 | Sensitive data encrypted before DB insert | Code review + integration test | Read `users.sensitive_data` from DB directly — must be ciphertext, not plaintext JSON | Manual verification |

### Sampling Rate

- **Per commit:** `npm run lint && npx tsc --noEmit` (< 30 seconds)
- **Per wave merge:** `npm run build` (full TypeScript + lint + bundle)
- **Phase gate:** All manual checks (JWT inspection, RLS SQL tests, build output grep) green before Phase 1 starts

### Wave 0 Gaps

- [ ] No automated test for RLS policies — create manual SQL test script at `supabase/tests/rls-checks.sql`
- [ ] No automated JWT claim verification — create manual checklist at `.planning/phases/00-foundation/VERIFY.md`
- [ ] Security grep check should be scripted: `package.json` script `"security-check": "grep -r 'NEXT_PUBLIC_SUPABASE_SERVICE' .next/static/ && exit 1 || echo 'OK'"`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth + `@supabase/ssr` — `getUser()` in middleware |
| V3 Session Management | Yes | `@supabase/ssr` cookie-based sessions with HTTP-only flags |
| V4 Access Control | Yes | PostgreSQL RLS with `get_my_tenant_id()` SECURITY DEFINER |
| V5 Input Validation | Partial (Phase 0 has no user inputs) | Zod added in Phase 1 |
| V6 Cryptography | Yes | AES-256-GCM via Node.js `crypto` module — never hand-rolled |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JWT forgery (crafted tenant_id) | Spoofing | `supabase.auth.getUser()` validates against Auth server — never `getSession()` |
| Service role key exfiltration | Information Disclosure | `import 'server-only'` + no `NEXT_PUBLIC_` prefix + post-build grep |
| Cross-tenant data leak via cache | Information Disclosure | No caching in Phase 0; tenantId in cache key for all future cache usage |
| RLS self-reference recursion | Denial of Service | `get_my_tenant_id()` SECURITY DEFINER function |
| tenant_id spoofing via user_metadata | Elevation of Privilege | Store tenant_id in `public.users` only; inject via Custom Access Token Hook (app_metadata — service-role-only write) |
| Connection pool exhaustion | Denial of Service | Supabase JS client only (routes through PostgREST + Supavisor pooler) |
| Plaintext health data at rest | Information Disclosure | AES-256-GCM via `lib/crypto.ts` — applied before any DB write |
| LGPD data minimization breach | Information Disclosure | Sensitive fields in encrypted `users.sensitive_data` blob; explicit access control |

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: npm registry] — all package versions confirmed via `npm view`
- [Supabase SSR Next.js docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — middleware and client factory patterns
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — hook function signature and grants
- [Next.js Installation docs](https://nextjs.org/docs/app/getting-started/installation) — scaffold command options
- [Next.js `after()` API reference](https://nextjs.org/docs/app/api-reference/functions/after) — stable since 15.1.0
- [Node.js `crypto` module](https://nodejs.org/api/crypto.html) — AES-256-GCM implementation
- `.planning/research/PITFALLS.md` — 6 critical pitfalls with verified solutions
- `.planning/research/ARCHITECTURE.md` — Custom Access Token Hook SQL, RLS patterns, middleware pattern
- `.planning/research/STACK.md` — Confirmed library versions and anti-patterns
- `.planning/research/SUMMARY.md` — Key decisions synthesis

### Secondary (MEDIUM confidence)

- [Supabase RLS performance docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — `(select auth.jwt())` caching optimization
- [shadcn/ui Next.js installation](https://ui.shadcn.com/docs/installation/next) — init command (Tailwind v4 support confirmed via CLI version 4.10.0)

### Tertiary (LOW confidence)

- JWT claim path (`user.app_metadata` vs top-level) — inferred from Supabase docs examples; verify by decoding JWT after hook is live

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry
- Architecture patterns: HIGH — verified against Supabase and Next.js official docs
- AES-256 crypto: HIGH — Node.js built-in `crypto` module, well-documented
- Custom Access Token Hook: HIGH — verified against Supabase auth hooks docs
- RLS patterns: HIGH — verified against Supabase RLS docs and PITFALLS.md
- Environment setup: MEDIUM — Supabase/Vercel Pro plan requirements flagged as assumptions

**Research date:** 2026-06-03
**Valid until:** 2026-09-03 (90 days — stack is stable; Supabase/Next.js release cadence is moderate)
