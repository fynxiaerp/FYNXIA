---
phase: 00-foundation
plan: "01"
subsystem: foundation
tags: [nextjs, supabase, typescript, security, crypto, middleware]
dependency_graph:
  requires: []
  provides:
    - src/lib/supabase/client.ts (browser Supabase client)
    - src/lib/supabase/server.ts (server Supabase client)
    - src/lib/supabase/admin.ts (service-role admin client)
    - src/lib/supabase/middleware.ts (updateSession helper)
    - src/proxy.ts (Next.js 16 proxy — auth guard)
    - src/lib/crypto.ts (AES-256-GCM encrypt/decrypt)
    - vercel.json (gru1 region pin)
    - supabase/config.toml (Supabase CLI init)
  affects: []
tech_stack:
  added:
    - next@16.2.7
    - react@19.2.4
    - "@supabase/supabase-js@^2"
    - "@supabase/ssr@^0.10.3"
    - server-only@0.0.1
    - tailwindcss@^4
    - shadcn@4.10.0
    - supabase CLI@^2.105.0
  patterns:
    - Next.js 16 App Router with route groups
    - Three Supabase client factories (@supabase/ssr pattern)
    - AES-256-GCM application-layer encryption (Node.js crypto built-in)
    - proxy.ts (Next.js 16 successor to middleware.ts)
key_files:
  created:
    - src/lib/supabase/client.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/admin.ts
    - src/lib/supabase/middleware.ts
    - src/proxy.ts
    - src/lib/crypto.ts
    - src/app/page.tsx
    - src/app/(auth)/layout.tsx
    - src/app/(dashboard)/layout.tsx
    - src/app/api/health/route.ts
    - vercel.json
    - .env.local.example
    - supabase/config.toml
    - tsconfig.json
    - package.json
  modified: []
decisions:
  - "Next.js 16.2.7 installed (create-next-app latest) — plan specified Next.js 15 but RESEARCH.md table listed 16.2.7 as verified; stack is compatible"
  - "middleware.ts renamed to proxy.ts — Next.js 16 introduced proxy.ts as the new file convention; function renamed from middleware() to proxy()"
  - "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY used for anon key (not NEXT_PUBLIC_SUPABASE_ANON_KEY) per RESEARCH.md note on newer Supabase projects"
  - ".gitignore updated to allow .env.local.example (placeholder template) while blocking all real .env* files"
metrics:
  duration_minutes: 13
  tasks_completed: 3
  tasks_total: 3
  files_created: 18
  files_modified: 2
  completed_date: "2026-06-04"
---

# Phase 0 Plan 1: Project Scaffold and Security Primitives Summary

**One-liner:** Next.js 16 App Router scaffold with three @supabase/ssr client factories, AES-256-GCM crypto utility, proxy.ts auth guard (getUser only), and gru1 Vercel region pin — all security invariants from PITFALLS.md C-2/C-4/H-4 locked in before any feature code.

## What Was Built

### Task 1: Project Scaffold
- Bootstrapped with `create-next-app@latest` (Next.js 16.2.7, TypeScript, Tailwind v4, App Router, src/ dir)
- Installed `@supabase/supabase-js`, `@supabase/ssr`, `server-only` as runtime deps
- Installed `supabase` CLI as dev dep; ran `supabase init` to create `supabase/config.toml`
- Ran `shadcn@latest init -d` — neutral defaults; wrote `components.json` and `src/lib/utils.ts`
- Set `strict: true` + `noUncheckedIndexedAccess: true` in `tsconfig.json`
- Created route groups: `src/app/(auth)/` and `src/app/(dashboard)/` with minimal passthrough layouts
- Created `.gitkeep` files for all 7 dashboard module directories and `src/lib/validators/`

### Task 2: Security Primitives
- **`src/lib/supabase/client.ts`**: Browser client via `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **`src/lib/supabase/server.ts`**: `import 'server-only'`; async server client with `cookies()` from `next/headers`; `setAll` wrapped in try/catch for read-only Server Component contexts
- **`src/lib/supabase/admin.ts`**: `import 'server-only'`; service-role client using `createClient` from `@supabase/supabase-js`; `autoRefreshToken: false`, `persistSession: false`
- **`src/lib/supabase/middleware.ts`**: `updateSession()` helper; `setAll` writes cookies to **both** `request` and `supabaseResponse` (H-4 prevention); calls `getUser()` not `getSession()` (C-4)
- **`src/proxy.ts`**: Next.js 16 proxy; delegates auth to `updateSession()`; redirects unauthenticated users to `/login?redirectedFrom=`; redirects authenticated users away from auth routes; API routes stay public
- **`src/lib/crypto.ts`**: `import 'server-only'`; AES-256-GCM; `randomBytes(12)` IV; format `iv:authTag:ciphertext` (hex); `getKey()` validates 64-char hex `ENCRYPTION_KEY`; exports `encrypt`, `decrypt`, `encryptJSON`, `decryptJSON<T>`

### Task 3: Infrastructure Config
- **`vercel.json`**: `regions: ["gru1"]` (São Paulo); `maxDuration: 30` for API routes, `60` for documents
- **`.env.local.example`**: Documents all 4 env vars with comments; `SUPABASE_SERVICE_ROLE_KEY` and `ENCRYPTION_KEY` clearly marked SERVER ONLY
- **`src/app/api/health/route.ts`**: Public `GET /api/health` returning `{ status, ts }`; `runtime = 'nodejs'`
- **`package.json`**: Added `security-check` script

## Environment Variable Contract

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser-safe) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public (browser-safe) | Anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | SERVER ONLY | Service-role client — bypasses all RLS |
| `ENCRYPTION_KEY` | SERVER ONLY | 64-char hex (32 bytes) — AES-256 key |

## Client Factory Contracts

```typescript
// Browser (src/lib/supabase/client.ts)
export function createClient(): SupabaseClient

// Server Components / Route Handlers / Server Actions (src/lib/supabase/server.ts)
export async function createClient(): Promise<SupabaseClient>

// Admin / service-role — server-only (src/lib/supabase/admin.ts)
export function createAdminClient(): SupabaseClient
```

## Crypto Contracts

```typescript
// src/lib/crypto.ts (server-only)
export function encrypt(plaintext: string): string         // "iv:authTag:ciphertext" hex
export function decrypt(ciphertext: string): string
export function encryptJSON(data: Record<string, unknown>): string
export function decryptJSON<T>(ciphertext: string): T
```

## Security Invariants Locked

| Pitfall | Resolution |
|---------|------------|
| C-2: Service role key in client bundle | `import 'server-only'` on admin.ts, server.ts, crypto.ts; no `NEXT_PUBLIC_` prefix; `security-check` script |
| C-4: getSession() in middleware | `updateSession()` calls `supabase.auth.getUser()` exclusively; `getSession` appears only in warning comments |
| H-4: JWT refresh token race condition | `setAll` writes to both `request.cookies.set()` AND `supabaseResponse.cookies.set()` |
| C-6: Connection pool exhaustion | Using Supabase JS client only (routes through PostgREST/Supavisor); no direct pg/Prisma connections |

## Cross-Platform Note: security-check Script

The `security-check` npm script uses `grep` which is available in bash/POSIX environments (Linux CI, macOS, WSL). On native Windows CMD/PowerShell without Git Bash, use `findstr /s "NEXT_PUBLIC_SUPABASE_SERVICE" .next\static\` instead. In Vercel CI the script will work as-is (Linux runner). The canonical post-build verification runs in Vercel's Linux environment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed middleware.ts to proxy.ts for Next.js 16 compatibility**
- **Found during:** Task 2 verification (npm run build warning)
- **Issue:** Next.js 16.2.7 deprecated `middleware.ts` in favor of `proxy.ts`; build emitted "The 'middleware' file convention is deprecated. Please use 'proxy' instead."
- **Fix:** Created `src/proxy.ts` exporting `proxy()` function (Next.js 16 convention); removed `src/middleware.ts`; `src/lib/supabase/middleware.ts` helper is unchanged (it's not at the src root, no naming conflict)
- **Files modified:** `src/proxy.ts` (created), `src/middleware.ts` (deleted)
- **Commit:** 2c558d8

**2. [Rule 1 - Bug] Fixed prefer-const lint error in middleware helper**
- **Found during:** Task 2 `npm run lint`
- **Issue:** `let supabaseResponse` was flagged as never reassigned — should be `const`
- **Fix:** Changed `let` to `const` in `src/lib/supabase/middleware.ts`
- **Files modified:** `src/lib/supabase/middleware.ts`
- **Commit:** 2c558d8

**3. [Rule 2 - Missing] Updated .gitignore to allow .env.local.example**
- **Found during:** Task 3 `git add`
- **Issue:** The broad `.env*` gitignore pattern blocked staging `.env.local.example` (which contains only placeholder values — safe to commit)
- **Fix:** Added `!.env.local.example` negation to `.gitignore`
- **Files modified:** `.gitignore`
- **Commit:** 4662ced

### Architectural Notes

- **Next.js version:** Plan specified "Next.js 15" but RESEARCH.md Standard Stack table lists `next@16.2.7` as the verified version. `create-next-app@latest` installed 16.2.7. The App Router patterns, `@supabase/ssr`, and all security primitives are fully compatible — this is a non-breaking version upgrade.
- **Workspace root warning:** A `package-lock.json` exists at `C:\Users\Reinaldo - Local\` which confuses Next.js workspace root detection. This is pre-existing and out of scope for this plan.

## Known Stubs

None — this plan creates infrastructure with no data-flow to UI. The root `page.tsx` redirects based on auth state (imports `src/lib/supabase/server.ts` which will be functional once env vars are set).

## Threat Flags

No new threat surface beyond what the plan's threat model covers. All mitigations in the STRIDE register (T-00-01 through T-00-04) were implemented.

## Self-Check: PASSED

### Files verified to exist:
- src/lib/supabase/client.ts — FOUND
- src/lib/supabase/server.ts — FOUND
- src/lib/supabase/admin.ts — FOUND
- src/lib/supabase/middleware.ts — FOUND
- src/proxy.ts — FOUND
- src/lib/crypto.ts — FOUND
- vercel.json — FOUND
- .env.local.example — FOUND
- src/app/api/health/route.ts — FOUND
- supabase/config.toml — FOUND
- src/app/(auth)/layout.tsx — FOUND
- src/app/(dashboard)/layout.tsx — FOUND

### Commits verified:
- 30cf0b1 — feat(00-01): scaffold Next.js 16.2.7 project with strict TypeScript and route groups
- 2c558d8 — feat(00-01): create Supabase client factories, proxy middleware, and AES-256-GCM crypto
- 4662ced — feat(00-01): add vercel.json (gru1), env template, health route, security-check script
