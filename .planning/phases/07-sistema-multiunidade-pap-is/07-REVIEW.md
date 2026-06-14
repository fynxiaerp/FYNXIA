---
phase: 07-sistema-multiunidade-pap-is
reviewed: 2026-06-13T00:00:00Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - src/proxy.ts
  - src/lib/auth/guards.ts
  - src/lib/icp/pfx-metadata.ts
  - src/lib/crypto.ts
  - src/lib/supabase/admin.ts
  - src/lib/ai-agent-config-types.ts
  - src/lib/validators/certificate.ts
  - src/lib/validators/empresa.ts
  - src/lib/validators/unit.ts
  - src/actions/certificate.ts
  - src/actions/ai-agent-config.ts
  - src/actions/empresa.ts
  - src/actions/units.ts
  - src/app/(dashboard)/config/certificado/page.tsx
  - src/app/(dashboard)/config/empresa/page.tsx
  - src/app/(dashboard)/config/ia/page.tsx
  - src/app/(dashboard)/config/perfis/page.tsx
  - src/components/config/CertificateUpload.tsx
  - src/components/config/AiAutonomyForm.tsx
  - src/components/config/EmpresaForm.tsx
  - src/components/config/UnitsManager.tsx
  - src/components/config/PerfisMatrix.tsx
  - supabase/migrations/20260614000100_units_table.sql
  - supabase/migrations/20260614000150_clinics_regime.sql
  - supabase/migrations/20260614000200_units_rls.sql
  - supabase/migrations/20260614000300_user_units.sql
  - supabase/migrations/20260614000400_role_expansion.sql
  - supabase/migrations/20260614000500_certificates.sql
  - supabase/migrations/20260614000600_ai_agent_config.sql
  - supabase/migrations/20260614000700_operational_unit_id.sql
  - src/__tests__/config/certificate.test.ts
  - src/__tests__/config/empresa.test.ts
  - src/__tests__/icp/pfx-metadata.test.ts
  - src/__tests__/migrations/phase7.test.ts
  - src/__tests__/rbac/matrix.test.ts
  - src/__tests__/setup.ts
  - vitest.config.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-06-13
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

## Summary

Phase 7 delivers the multi-tenant multi-unit foundation (units table, user_units N:N, get_my_unit_ids SECURITY DEFINER), 11-role expansion, ICP-Brasil certificate keystore (.pfx upload + AES-256-GCM encryption), AI agent config table, and the Config UI pages.

The security-critical paths are in generally good shape:
- `getCertificate()` uses an explicit column-list SELECT that excludes `cert_password_enc` and `storage_path`. The `CertificatePublic` type enforces this at compile time.
- Every mutation Server Action (`saveEmpresa`, `createUnit`, `updateUnit`, `uploadCertificate`, `saveAiAgentConfig`) calls `assertNotReadOnly()` before the role gate, providing mandatory double enforcement.
- `get_my_unit_ids()` follows the established SECURITY DEFINER pattern (STABLE, SET search_path = public, REVOKE FROM PUBLIC). No recursion path exists.
- Role CHECK constraints are updated on both `users` AND `invitations` in the same migration (Pitfall 7 handled correctly).
- Unit backfill before NOT NULL on operational tables (Pitfall 2 handled correctly).
- Partial unique indexes on `ai_agent_config` correctly handle NULL `unit_id` deduplication.
- `createAdminClient()` is server-only (marked `import 'server-only'`) and uses `SUPABASE_SERVICE_ROLE_KEY` — never `NEXT_PUBLIC_`.
- Private bucket created with `public: false`.
- AES-256-GCM with 96-bit random IV and auth tag is correct.

Three warnings and three info items follow. No critical issues.

---

## Warnings

### WR-01: Middleware debug catch block exposes full stack trace to callers

**File:** `src/proxy.ts:197-201`

**Issue:** The `try/catch` block added as "TEMP-DEBUG" returns the complete error stack trace (`error?.stack`) in a plain-text HTTP 500 response to any browser or API caller that triggers a middleware crash. This exposes internal file paths, module names, and Node.js runtime details. Because this wraps the entire `proxy()` function, any future middleware crash (e.g., a Supabase client error, a malformed cookie) would leak server internals in production.

```typescript
// CURRENT — leaks stack trace to caller
return new NextResponse(
  `MIDDLEWARE ERROR (proxy.ts)\n\n${(error as Error)?.stack ?? String(error)}`,
  { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } }
)
```

**Fix:** Remove the try/catch entirely before production — Next.js middleware errors are caught by the framework and logged server-side without leaking to the client. If a debug aid is still needed during active development, log to console and return a generic 500:

```typescript
} catch (error) {
  console.error('[middleware] unhandled error:', error)
  return new NextResponse('Internal Server Error', { status: 500 })
}
```

---

### WR-02: `certificates` RLS SELECT policy exposes `cert_password_enc` and `storage_path` at DB layer

**File:** `supabase/migrations/20260614000500_certificates.sql:38-39`

**Issue:** `certificates_tenant_read` grants `FOR SELECT` with no column restriction — every authenticated tenant member can SELECT all columns, including `cert_password_enc` (AES-256-GCM encrypted password) and `storage_path` (Supabase storage object path). The comment acknowledges this and says it is "further restricted at the application layer."

The application-layer protection works today: `getCertificate()` uses an explicit column list that omits both fields. However:
1. Any future developer writing `.select('*')` against `certificates` will silently receive the encrypted password and storage path.
2. A role like `dpo` (has `config` read access per MODULE_PERMISSIONS) has no DB-level barrier to these fields if they construct a direct query.
3. `cert_password_enc`, even encrypted, is a high-value target — its exposure reduces the cost of a brute-force attack if the encryption key is also compromised.

Supabase supports column-level security natively via a view or by revoking column privileges. The cleanest mitigation here is a PostgreSQL column privilege revoke on the two secret columns for the `authenticated` role:

```sql
-- After creating the table, revoke column-level read from authenticated users
REVOKE SELECT (cert_password_enc, storage_path)
  ON public.certificates FROM authenticated;
```

This is a defense-in-depth measure. The service role (admin client) bypasses column privileges, so Phase 8 signing logic is unaffected.

---

### WR-03: `saveAiAgentConfig` upsert `onConflict` column list may not target the partial index

**File:** `src/actions/ai-agent-config.ts:144-158`

**Issue:** The upsert targets the conflict resolution via `onConflict: 'clinic_id,agent_key'`. The actual unique constraint that deduplicates network-level rows is a **partial** unique index (`uq_ai_agent_config_network`) defined as `(clinic_id, agent_key) WHERE unit_id IS NULL`. PostgREST (the API layer Supabase uses) resolves `ON CONFLICT (clinic_id, agent_key)` by looking for a standard unique constraint on those columns, not the partial index. There is no plain `UNIQUE (clinic_id, agent_key)` constraint — only the partial index.

When PostgREST cannot resolve the conflict target, it either falls back to an `INSERT ... ON CONFLICT DO NOTHING` (silently inserting duplicates) or throws an error depending on the Supabase/PostgREST version. This means that after the first successful insert, subsequent calls to `saveAiAgentConfig` for the same agent may create duplicate rows instead of updating the existing record.

The safe fix is to use `ignoreDuplicates: false` with an explicit `.upsert()` or, better, separate the upsert into an explicit `UPDATE` + conditional `INSERT`:

```typescript
// Option A: explicit UPDATE first, INSERT if no rows updated
const { data: existing } = await supabase
  .from('ai_agent_config')
  .select('id')
  .eq('clinic_id', actor.tenant_id)
  .eq('agent_key', data.agentKey)
  .is('unit_id', null)
  .single()

if (existing) {
  await supabase.from('ai_agent_config')
    .update({ autonomy_level: data.autonomyLevel, enabled: data.enabled, updated_by: actor.id, updated_at: new Date().toISOString() })
    .eq('id', existing.id)
} else {
  await supabase.from('ai_agent_config')
    .insert({ clinic_id: actor.tenant_id, unit_id: null, agent_key: data.agentKey, autonomy_level: data.autonomyLevel, enabled: data.enabled, updated_by: actor.id })
}
```

Alternatively, promote the partial index to a named unique constraint:
```sql
ALTER TABLE public.ai_agent_config
  ADD CONSTRAINT uq_ai_agent_config_network_constraint
  UNIQUE (clinic_id, agent_key)
  DEFERRABLE INITIALLY IMMEDIATE;
-- Note: PostgreSQL partial UNIQUE constraints require wrapping in a WHERE predicate,
-- which standard ALTER TABLE ADD CONSTRAINT UNIQUE does not support.
-- The SELECT/UPDATE pattern above is the cleanest workaround.
```

---

## Info

### IN-01: `TEMP-DEBUG` comment markers should be removed

**File:** `src/proxy.ts:122, 197`

**Issue:** Two `// TEMP-DEBUG` comments mark the try/catch block as temporary. These should be tracked in a task and removed (or converted to the generic handler in WR-01) before shipping to production. They signal an incomplete state in a security-critical file.

**Fix:** Remove the comments as part of resolving WR-01.

---

### IN-02: `implantacao` role has write access to `/config` module at middleware level but no explicit block in empresa/units actions

**File:** `src/proxy.ts:31`, `src/actions/empresa.ts:116`, `src/actions/units.ts:125`

**Issue:** `implantacao` is configured as `config: { allowed:true, readOnly:true }` in `MODULE_PERMISSIONS`. Middleware correctly sets `x-read-only: true` for `implantacao` on `/config` routes, so `assertNotReadOnly()` in `saveEmpresa`/`createUnit`/`updateUnit` will block them. The double enforcement works correctly.

However, `implantacao` is not listed in the role comments of any mutation action (the comments say "admin/superadmin only"). This creates a silent reliance on the `assertNotReadOnly()` guard for `implantacao` rather than an explicit `role gate` mention. This is correct behavior but could mislead a future developer into thinking `implantacao` is unreachable on `/config` entirely (it can read, but not write).

**Fix:** Update the security comments in `saveEmpresa`, `createUnit`, and `updateUnit` to note that `implantacao` is blocked by `assertNotReadOnly()` rather than the role gate:

```typescript
// SECURITY:
//   1. assertNotReadOnly() — rejects auditor/dpo/socio + implantacao (x-read-only header)
//   2. role gate — only 'admin' | 'superadmin' may mutate
```

---

### IN-03: `getCertificate` creates a second Supabase client instance after `getActor()` already created one

**File:** `src/actions/certificate.ts:222`

**Issue:** `getCertificate()` calls `getActor()` (which internally calls `createClient()` and returns an actor), then creates another `createClient()` instance at line 222 to run the SELECT query. This results in two separate Supabase client instantiations per `getCertificate()` call. The same pattern appears in `ai-agent-config.ts:143` (`saveAiAgentConfig`).

This is not a security or correctness issue — both clients use the same authenticated session cookie. It is a minor inefficiency and a code quality inconsistency (the other read-only actions like `listUnits` and `getEmpresa` do the same).

**Fix:** Return the Supabase client from `getActor()` alongside the actor:

```typescript
async function getActor(): Promise<{ actor: Actor; supabase: SupabaseClient } | { error: string }> {
  const supabase = await createClient()
  // ... existing logic
  return { actor, supabase }
}
```

---

## Findings by Priority

| ID | Severity | Title | File |
|----|----------|-------|------|
| WR-01 | Warning | Middleware debug catch block exposes full stack trace | `src/proxy.ts:197-201` |
| WR-02 | Warning | `certificates` RLS SELECT exposes `cert_password_enc` + `storage_path` at DB layer | `supabase/migrations/20260614000500_certificates.sql:38-39` |
| WR-03 | Warning | `saveAiAgentConfig` partial-index upsert may create duplicates instead of updating | `src/actions/ai-agent-config.ts:157` |
| IN-01 | Info | `TEMP-DEBUG` marker comments in proxy.ts | `src/proxy.ts:122,197` |
| IN-02 | Info | `implantacao` write-block documentation gap in mutation action comments | `src/actions/empresa.ts:8`, `src/actions/units.ts:12` |
| IN-03 | Info | Double Supabase client instantiation in `getCertificate` and `saveAiAgentConfig` | `src/actions/certificate.ts:222`, `src/actions/ai-agent-config.ts:143` |

---

## What Passed (explicit confirmation for high-priority items)

- **Secret leakage:** `getCertificate()` uses an explicit column-list SELECT (line 227) that explicitly omits `cert_password_enc` and `storage_path`. The `CertificatePublic = Omit<CertRow, 'cert_password_enc' | 'storage_path'>` type provides compile-time enforcement. The destructure at line 199 adds a runtime peel. Secrets do not reach the client.
- **Admin client server-only:** `createAdminClient()` imports `'server-only'` and uses `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix). Storage upload at line 145 correctly uses the admin client.
- **Cert password AES encryption:** `src/lib/crypto.ts` implements AES-256-GCM with a 96-bit random IV and GCM auth tag. The `ENCRYPTION_KEY` validation (64 hex chars = 32 bytes) is enforced at call time. Plaintext password is never stored.
- **Read-only enforcement:** All five mutation actions (`saveEmpresa`, `createUnit`, `updateUnit`, `uploadCertificate`, `saveAiAgentConfig`) call `assertNotReadOnly()` as the first line. The guard reads the `x-read-only` header (injected by middleware) and throws, providing double enforcement independent of the role gate.
- **RLS USING + WITH CHECK:** All four new tables (`units`, `user_units`, `certificates`, `ai_agent_config`) have both `USING` and `WITH CHECK` on write policies. Tenant isolation via `get_my_tenant_id()` in both clauses.
- **Role CHECK on both tables:** Migration `20260614000400` updates `users.role` and `invitations.role` CHECK constraints in the same transaction. No new-role invitation would be rejected.
- **Backfill before NOT NULL:** Migration `20260614000700` follows ADD NULLABLE → UPDATE → SET NOT NULL on all three operational tables.
- **Partial unique indexes for ai_agent_config:** Two partial indexes (`WHERE unit_id IS NULL` and `WHERE unit_id IS NOT NULL`) correctly enforce deduplication without the NULL-inequality problem of standard UNIQUE constraints.
- **get_my_unit_ids SECURITY DEFINER:** STABLE, SET search_path = public, REVOKE FROM PUBLIC — consistent with the existing pattern for `get_my_tenant_id()` and `get_my_role()`. No RLS recursion possible (function accesses tables directly as definer, not through RLS).
- **Private bucket:** `icp-certificates` created with `public: false`. No storage object RLS policies are added — service role is the sole accessor.
- **RSC serialization:** Server Component pages pass only plain data objects (not functions or components) to Client Components. No serialization boundary violations found.
- **'use server' exports:** All exports from `'use server'` files (`certificate.ts`, `ai-agent-config.ts`, `empresa.ts`, `units.ts`) are `async` functions or re-exported types. No non-async value exports that would trigger Next.js runtime errors.
- **Service role not exposed client-side:** `admin.ts` imports `'server-only'` and is only called from Server Actions (`uploadCertificate`). Client components only import `CertificatePublic` type and the action function.

---

_Reviewed: 2026-06-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
