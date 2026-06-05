# Phase 0: Foundation - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the secure infrastructure skeleton: Next.js 15 project scaffolded, Supabase schema with core tables (tenants, users, audit_logs), RLS policies using `get_my_tenant_id()` SECURITY DEFINER, Custom Access Token Hook injecting `tenant_id` and `user_role` into JWT, three Supabase client factories (@supabase/ssr), and the `lib/crypto.ts` AES-256 utility. No feature modules (patients, appointments, financial) are built in this phase — only the foundation they depend on.

All 6 critical pitfalls from PITFALLS.md are resolved here before any feature code is written.

</domain>

<decisions>
## Implementation Decisions

### Schema Scope
- **D-01:** Create ONLY core tables in Phase 0: `tenants`, `users`, `audit_logs`. Feature-module tables (patients, appointments, medical_records, financial_transactions, etc.) are created in their respective feature phases (2, 3).
- **D-02:** Naming convention: **plural English** — `tenants`, `users`, `audit_logs`, `patients`, `appointments`. No Portuguese names, no singular.

### Encryption Strategy (SEC-08)
- **D-03:** AES-256 encryption implemented at the **application layer** (Next.js server-side), NOT in PostgreSQL via pg_crypto. Fields are encrypted/decrypted in Vercel Functions before read/write. This keeps RLS queries over plaintext columns (enabling indexing and filtering) while protecting sensitive health data blobs at rest.
- **D-04:** `ENCRYPTION_KEY` stored as a **Vercel Environment Variable** (server-only, never `NEXT_PUBLIC_`). Accessed via `process.env.ENCRYPTION_KEY` in server components and API routes only. Key rotation handled via Vercel dashboard.
- **D-05:** Encrypted fields in Phase 0 scope: `users.sensitive_data` (JSONB blob for any health-related user metadata). Patient health fields (`medical_history`, etc.) encrypted when patient tables are created in Phase 2.

### Project Scaffold
- **D-06:** Bootstrap with `npx create-next-app@latest` — TypeScript, Tailwind CSS, App Router, `src/` directory, ESLint enabled. Then `npx shadcn@latest init` for the component library.
- **D-07:** Folder structure uses **Next.js route groups**:
  ```
  src/app/
  ├── (auth)/          # login, signup, forgot-password — no sidebar
  ├── (dashboard)/     # all protected routes — shared sidebar layout
  │   ├── clinica/
  │   ├── financeiro/
  │   ├── estoque/
  │   ├── crm/
  │   ├── bi/
  │   ├── ia/
  │   └── config/
  └── api/             # Next.js API routes
  src/lib/
  ├── supabase/
  │   ├── client.ts    # browser client (@supabase/ssr)
  │   ├── server.ts    # server component client
  │   └── middleware.ts # middleware client
  ├── crypto.ts        # AES-256 encrypt/decrypt
  └── validators/      # Zod schemas (shared)
  ```
- **D-08:** Three Supabase client factories following `@supabase/ssr` pattern (NOT deprecated `auth-helpers-nextjs`): `createBrowserClient`, `createServerClient` (for Server Components/Route Handlers), `createMiddlewareClient` (for middleware.ts).

### CI/CD Strategy
- **D-09:** Phase 0 CI uses **Vercel Preview Deployments** only — every push/PR triggers a preview build. No GitHub Actions setup in this phase. Build includes: `next build` (catches TypeScript errors since `strict: true`) + ESLint. 
- **D-10:** GitHub Actions with RLS integration tests deferred to Phase 1 when auth flow exists to generate real JWTs for testing.

**D-11:** Supabase FREE plan durante o MVP. **Custom Access Token Hook (Auth Hooks) é exclusivo do plano Pro** — não será implementado na Fase 0. Alternativa adotada: duas funções SECURITY DEFINER (`get_my_tenant_id()` + `get_my_role()`) leem `tenant_id` e `role` diretamente de `public.users` via `auth.uid()`. Todas as políticas RLS usam essas funções — sem dependência de JWT claims. Upgrade path: ao migrar para Pro, o hook pode ser adicionado como otimização de performance (reduz lookups por query), sem mudança na lógica de isolamento.

### Claude's Discretion
- Exact shadcn/ui theme configuration (colors, radius) — can use neutral defaults
- ESLint rule set beyond `next/core-web-vitals` — standard recommended config
- Exact `vercel.json` content beyond `regions: ["gru1"]` and function config
- `middleware.ts` exact matcher pattern (apply auth check to all routes except `/api/health` and `/(auth)/*`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Security & Architecture
- `.planning/research/PITFALLS.md` — 6 critical pitfalls ALL resolved in Phase 0. Read before writing any RLS policy or auth code.
- `.planning/research/ARCHITECTURE.md` — JWT Custom Claims Hook pattern (Custom Access Token Hook), `get_my_tenant_id()` SECURITY DEFINER function pattern, Supabase client factory pattern.
- `.planning/research/STACK.md` — Confirmed library versions: Next.js 15, `@supabase/ssr` (NOT auth-helpers-nextjs), Zod v3 (NOT v4), Resend (NOT SendGrid), `@react-pdf/renderer` (NOT Puppeteer).

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 0 REQ-IDs: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, SEC-07, SEC-08.
- `.planning/research/SUMMARY.md` — Key decisions synthesis: São Paulo region enforcement, `getUser()` vs `getSession()`, `unstable_cache` tenantId requirement.

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, key decisions.
- `.planning/ROADMAP.md` — Phase 0 success criteria (what must be verifiably true at phase end).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — greenfield project. Phase 0 creates the foundational patterns all other phases reuse.

### Established Patterns (to create in this phase)
- **Three Supabase clients**: browser, server, middleware — all other phases import from `src/lib/supabase/`
- **`get_my_tenant_id()` SECURITY DEFINER**: every RLS policy across all phases uses this function — never queries `users` directly
- **`lib/crypto.ts`**: AES-256 encrypt/decrypt utility — imported by any server-side code that handles health data

### Integration Points
- `src/middleware.ts` — gates all `(dashboard)/*` routes; every feature phase relies on auth being enforced here
- `public.tenants` and `public.users` tables — referenced by FK in every feature table created in later phases
- `public.audit_logs` — written to by triggers created in Phases 1+ (trigger function defined here)

</code_context>

<specifics>
## Specific Ideas

- Vercel `vercel.json` must declare `"regions": ["gru1"]` (São Paulo) — this is a hard requirement from Stack research, not a preference
- Custom Access Token Hook: PostgreSQL function that reads `public.users.tenant_id` and `public.users.role` and injects them into `app_metadata` of the JWT — must be registered in Supabase Auth dashboard under "Hooks"
- `middleware.ts` must call `supabase.auth.getUser()` (NOT `getSession()`) — pitfall C-4. getSession() only validates JWT format, not authenticity.
- All timestamp columns: `TIMESTAMPTZ` not `TIMESTAMP` — Brazil has multiple time zones (SP = UTC-3, AM = UTC-4)
- `import 'server-only'` at the top of `src/lib/supabase/server.ts` and any file touching `SUPABASE_SERVICE_ROLE_KEY` — pitfall C-2 prevention

</specifics>

<deferred>
## Deferred Ideas

### Scope Creep (not Phase 0)
- **HTML prototype layout for evaluation** — This is frontend UI work. Belongs in Phase 1 (Auth & Tenant Onboarding) or Phase 2 (Clinical MVP), both of which have `UI hint: yes`. Noted for `/gsd-ui-phase 1` or `/gsd-ui-phase 2`.

### CI/CD Expansion (Phase 1+)
- GitHub Actions with RLS integration tests using real JWTs — deferred to Phase 1 when auth flow exists
- Supabase CLI in CI for migration validation — deferred to Phase 1

</deferred>

---

*Phase: 00-foundation*
*Context gathered: 2026-06-03*
