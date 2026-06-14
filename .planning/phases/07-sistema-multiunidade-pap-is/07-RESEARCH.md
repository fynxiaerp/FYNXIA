# Phase 7: Sistema, Multiunidade & Papéis — Research

**Researched:** 2026-06-13
**Domain:** Supabase RLS multi-unit scoping, PostgreSQL role expansion, RBAC matrix, PKCS12 metadata extraction, AI config storage
**Confidence:** HIGH (core stack verified from codebase; PKCS12 library MEDIUM — node-forge not yet installed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 Multiunidade:** `clinics` = rede (tenant) + nova tabela `units` (FK clinic_id). Linhas operacionais (appointments, financial_*) ganham `unit_id`. RLS por `clinic_id` preservada + novo helper `get_my_unit_ids()`. Cada clínica v1 vira rede com 1 unidade default.

**D-02 ICP Keystore:** `.pfx` em bucket privado Supabase Storage. Senha cifrada AES-256 reutilizando `ENCRYPTION_KEY` do v1. Assinatura server-side. Só metadados (titular/CNPJ/validade/thumbprint) legíveis. Esta fase: upload + storage + metadados + validação básica (uso para assinar é Fase 8).

**D-03 RBAC:** Evoluir `ROLE_ROUTES` (src/proxy.ts) para matriz role × módulo (allow/deny). Adicionar enum roles: `dpo`, `auditor`, `socio`, `ti`, `implantacao`, `aluno`.

**D-04 Papéis × Unidade:** Papéis de rede (admin/superadmin/socio/auditor/dpo/ti) veem todas as unidades; operacionais (dentist/receptionist/aluno) restritos à(s) unidade(s). auditor/dpo/socio read-only.

**D-05 Autonomia IA L0–L4:** Tabela `ai_agent_config` (clinic_id, agent_key, autonomy_level, enabled, limits jsonb) — só armazenamento. Enforcement na Fase 10.

### Claude's Discretion

- Estrutura exata das migrations (ordem, nomes), nomes de colunas/constraints, índices.
- Forma do helper de unidade (`get_my_unit_id` singular vs `get_my_unit_ids` array) — N:N preferido se houver caso de usuário em múltiplas filiais.
- UI das telas de configuração dentro do design system v1.
- Validação de CNPJ/regime tributário; máscaras; biblioteca de leitura do .pfx para extrair metadados server-side.
- Single `users.unit_id` vs tabela N:N `user_units` — preferir N:N se houver caso de usuário em múltiplas filiais.

### Deferred Ideas (OUT OF SCOPE)

- Tabela de permissões 100% configurável pelo admin (role × módulo × ação editável na UI).
- Permissões por ação finas (além de read-only/admin-only).
- Enforcement dos limites de IA L0–L4 + aprovação humana — Fase 10.
- Motor de assinatura ICP — Fase 8.
- Hub de credenciais/integrações — Fase 9.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYS-01 | Admin cadastra empresa (CNPJ/CPF, regime tributário) e múltiplas unidades da rede | D-01: tabela `units`, formulários RHF+Zod, `cpf-cnpj-validator` já instalado |
| SYS-02 | Admin faz upload do Certificado ICP-Brasil (A1) | D-02: Supabase Storage bucket privado + `node-forge` para metadados; senha AES-256 via crypto.ts existente |
| SYS-03 | Admin define perfis de acesso por módulo (RBAC granular) | D-03/D-04: evolução de `ROLE_ROUTES` em proxy.ts + `MODULE_PERMISSIONS` matrix |
| SYS-04 | Admin define nível de autonomia IA (L0–L4) por agente | D-05: tabela `ai_agent_config` + UI de configuração |
| SYS-05 | Dados e relatórios filtrados por unidade (centro de custo) | D-01: `unit_id` em linhas operacionais + `get_my_unit_ids()` helper |
| ROLE-01 | Sistema suporta 6 papéis adicionais: DPO, Auditor, Sócio, TI, Implantação, Aluno | Expansão do CHECK constraint em `users.role` e `invitations.role` |
| ROLE-02 | Cada papel vê apenas módulos/ações permitidos (gating server-side por unidade) | Matriz `MODULE_PERMISSIONS` em proxy.ts + `get_my_unit_ids()` |
</phase_requirements>

---

## Summary

Phase 7 evolves the v1 single-clinic multi-tenant foundation into a true multi-unit network architecture. The existing `clinics` table already serves as the tenant root; this phase adds a `units` layer beneath it and wires unit-scoping into every operational row. The approach keeps the existing `get_my_tenant_id()` / `get_my_role()` SECURITY DEFINER pattern intact and adds `get_my_unit_ids()` as a companion that returns an array of unit UUIDs (all units for network roles, assigned units for operational roles).

The role system uses a `TEXT CHECK` constraint (not a PostgreSQL enum), which is confirmed from the codebase. This is critical: adding 6 new roles requires dropping and recreating the CHECK constraint — a fast DDL operation on PostgreSQL, not a blocking enum migration. The `invitations` table has its own identical CHECK that must be updated in the same migration.

ICP-Brasil A1 certificate metadata extraction server-side requires `node-forge` (pure JS, no native binaries). This library is NOT currently installed and must be added as a new production dependency. The certificate password is encrypted with the same AES-256-GCM function already in `src/lib/crypto.ts`. The `.pfx` file lives in a private Supabase Storage bucket; service role bypasses RLS for reads, while the Server Action uses the admin client for upload.

**Primary recommendation:** Use N:N `user_units` table (not `users.unit_id` column) because multi-filial assignment is inherent in the franchise target market. Write `get_my_unit_ids()` to return `UUID[]` with `STABLE` + `SECURITY DEFINER` + `SET search_path = public` — same pattern as existing helpers. Use TEXT CHECK constraint expansion (not enum) for role addition.

---

## Standard Stack

### Core (already installed — verified from package.json)

| Library | Installed Version | Purpose | Verified |
|---------|------------------|---------|---------|
| `@supabase/supabase-js` | ^2.107.0 | Supabase client for Storage + DB | [VERIFIED: package.json] |
| `@supabase/ssr` | ^0.10.3 | SSR auth client | [VERIFIED: package.json] |
| `zod` | ^3.25.76 (v3 pinned) | Schema validation for forms | [VERIFIED: package.json] |
| `react-hook-form` | ^7.77.0 | Form state | [VERIFIED: package.json] |
| `@hookform/resolvers` | ^5.4.0 | Zod adapter for RHF | [VERIFIED: package.json] |
| `cpf-cnpj-validator` | ^2.1.2 | CNPJ/CPF validation (SYS-01) | [VERIFIED: package.json] |
| `zustand` | ^5.0.14 | Unit selector state (UI) | [VERIFIED: package.json] |
| `nuqs` | ^2.8.9 | URL-persisted unit filter (SYS-05) | [VERIFIED: package.json] |

### New Dependency Required

| Library | Latest Version | Purpose | Why |
|---------|---------------|---------|-----|
| `node-forge` | 1.4.0 | PKCS12 .pfx parse: subject, validity, thumbprint | Pure JS, no native binaries, runs in Vercel Node.js runtime. Only option for PKCS12 without openssl CLI. |

**Installation:**
```bash
npm install node-forge
npm install --save-dev @types/node-forge
```

**Version verification:** `npm show node-forge version` → `1.4.0` [VERIFIED: npm registry via Bash]

### No New UI Libraries Needed

All UI requirements (forms, file upload, tables) covered by existing shadcn/ui + @base-ui/react installed stack.

---

## Architecture Patterns

### Recommended Project Structure for Phase 7

```
supabase/migrations/
├── 20260614000100_units_table.sql          # units table + indexes
├── 20260614000200_units_rls.sql            # RLS on units
├── 20260614000300_user_units.sql           # N:N user_units + get_my_unit_ids()
├── 20260614000400_role_expansion.sql       # DROP/ADD CHECK on users.role + invitations.role
├── 20260614000500_certificates.sql         # certificates metadata table
├── 20260614000600_ai_agent_config.sql      # ai_agent_config table + RLS
├── 20260614000700_operational_unit_id.sql  # ADD COLUMN unit_id to appointments, charges, receivables

src/
├── lib/
│   ├── icp/
│   │   └── pfx-metadata.ts               # node-forge: extract cert metadata server-side
│   ├── validators/
│   │   ├── unit.ts                        # Zod schema for unit creation/update
│   │   └── certificate.ts                 # Zod schema for cert upload form
├── app/(dashboard)/config/
│   ├── empresa/
│   │   └── page.tsx                       # SYS-01: Company + units management
│   ├── certificado/
│   │   └── page.tsx                       # SYS-02: ICP cert upload + metadata view
│   ├── perfis/
│   │   └── page.tsx                       # SYS-03: RBAC matrix per role
│   └── ia/
│       └── page.tsx                       # SYS-04: AI autonomy level config
├── __tests__/
│   ├── migrations/
│   │   └── phase7.test.ts                 # Source-inspection tests for migrations
│   ├── proxy/
│   │   └── rbac-v2.test.ts               # Expanded role matrix tests
│   └── icp/
│       └── pfx-metadata.test.ts           # node-forge extraction unit tests
```

### Pattern 1: `get_my_unit_ids()` — SECURITY DEFINER returning UUID[]

**What:** Returns all unit UUIDs accessible to the authenticated user. Network roles get all units for their clinic; operational roles get only assigned units via `user_units`.
**When to use:** In RLS policies on operational tables (appointments, charges, etc.) where unit-level isolation applies.

```sql
-- Source: modeled on existing get_my_tenant_id() pattern (supabase/migrations/20260603000000_initial_schema.sql)
CREATE OR REPLACE FUNCTION public.get_my_unit_ids()
RETURNS UUID[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN get_my_role() IN ('admin','superadmin','socio','auditor','dpo','ti')
      -- Network roles: all active units for their tenant
      THEN ARRAY(
        SELECT id FROM public.units
        WHERE clinic_id = get_my_tenant_id()
          AND deleted_at IS NULL
      )
    ELSE
      -- Operational roles: only assigned units
      ARRAY(
        SELECT unit_id FROM public.user_units
        WHERE user_id = auth.uid()
      )
  END
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_unit_ids() FROM PUBLIC;
```

**Performance note:** Wrap in `(SELECT get_my_unit_ids())` in RLS policies so PostgreSQL caches the result once per statement rather than calling per row. [CITED: supabase.com/docs RLS performance guide]

**RLS usage pattern:**
```sql
-- Example: appointments scoped by unit
CREATE POLICY "appointments_unit_isolation" ON public.appointments
  FOR SELECT USING (
    tenant_id = get_my_tenant_id()
    AND unit_id = ANY((SELECT get_my_unit_ids()))
  );
```

### Pattern 2: TEXT CHECK Constraint Expansion for New Roles

**What:** The v1 schema uses `TEXT NOT NULL CHECK (role IN (...))`, not a Postgres enum. [VERIFIED: codebase — supabase/migrations/20260603000000_initial_schema.sql:39]
**When to use:** Adding new role values.
**Why NOT enum:** `ALTER TYPE ... ADD VALUE` in PostgreSQL 12–17 is non-transactional (the new value cannot be used in the same transaction it was added). TEXT CHECK avoids this entirely. [CITED: PostgreSQL 18 docs + crunchy data blog]

```sql
-- Safe pattern: drop named constraint, add new one with all values
-- Source: pattern for CHECK constraint evolution on TEXT column
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check,
  ADD CONSTRAINT users_role_check
    CHECK (role IN (
      'admin', 'dentist', 'receptionist', 'patient', 'superadmin',
      'dpo', 'auditor', 'socio', 'ti', 'implantacao', 'aluno'
    ));

-- Same update needed on invitations.role (separate CHECK on that table)
ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_role_check,
  ADD CONSTRAINT invitations_role_check
    CHECK (role IN (
      'admin', 'dentist', 'receptionist', 'patient', 'superadmin',
      'dpo', 'auditor', 'socio', 'ti', 'implantacao', 'aluno'
    ));
```

**Important:** The constraint name in PostgreSQL defaults to `{table}_{column}_check` but may differ. Verify actual constraint name with:
```sql
SELECT conname FROM pg_constraint WHERE conrelid = 'public.users'::regclass AND contype = 'c';
```

### Pattern 3: RBAC Module × Role Matrix in proxy.ts

**What:** Evolves `ROLE_ROUTES` (prefix-based) into `MODULE_PERMISSIONS` (role × module allow/deny with read-only flag).
**When to use:** Every authenticated request through middleware.

```typescript
// src/proxy.ts (evolved from ROLE_ROUTES)
// Source: existing pattern + D-03/D-04 decisions

export const NETWORK_ROLES = ['admin', 'superadmin', 'socio', 'auditor', 'dpo', 'ti'] as const
export const OPERATIONAL_ROLES = ['dentist', 'receptionist', 'aluno'] as const
export const READ_ONLY_ROLES = ['auditor', 'dpo', 'socio'] as const

export type AppRole = 
  | 'admin' | 'superadmin' | 'dentist' | 'receptionist' | 'patient'
  | 'dpo' | 'auditor' | 'socio' | 'ti' | 'implantacao' | 'aluno'

type ModuleKey = 'clinica' | 'config' | 'superadmin' | 'paciente' | 'financeiro' | 'ia' | 'bi'

interface ModuleAccess {
  allowed: boolean
  readOnly?: boolean  // true for auditor/dpo/socio on operational modules
}

export const MODULE_PERMISSIONS: Record<AppRole, Partial<Record<ModuleKey, ModuleAccess>>> = {
  superadmin:   { clinica: {allowed:true}, config: {allowed:true}, superadmin: {allowed:true}, paciente: {allowed:true}, financeiro: {allowed:true}, ia: {allowed:true}, bi: {allowed:true} },
  admin:        { clinica: {allowed:true}, config: {allowed:true}, superadmin: {allowed:true}, financeiro: {allowed:true}, ia: {allowed:true}, bi: {allowed:true} },
  dentist:      { clinica: {allowed:true} },
  receptionist: { clinica: {allowed:true} },
  patient:      { paciente: {allowed:true} },
  dpo:          { clinica: {allowed:true, readOnly:true}, config: {allowed:true, readOnly:true}, bi: {allowed:true, readOnly:true} },
  auditor:      { clinica: {allowed:true, readOnly:true}, financeiro: {allowed:true, readOnly:true}, bi: {allowed:true, readOnly:true} },
  socio:        { financeiro: {allowed:true, readOnly:true}, bi: {allowed:true, readOnly:true}, config: {allowed:true, readOnly:true} },
  ti:           { config: {allowed:true}, ia: {allowed:true} },
  implantacao:  { clinica: {allowed:true}, config: {allowed:true, readOnly:true} },
  aluno:        { clinica: {allowed:true} },
}

// isPathAllowed becomes module-aware
export function isPathAllowed(role: AppRole, pathname: string): boolean {
  const permissions = MODULE_PERMISSIONS[role] ?? {}
  for (const [module, access] of Object.entries(permissions)) {
    if (access?.allowed && pathname.startsWith(`/${module}`)) return true
  }
  // /perfil is universal (own profile)
  return pathname.startsWith('/perfil')
}

export function isReadOnly(role: AppRole, pathname: string): boolean {
  const permissions = MODULE_PERMISSIONS[role] ?? {}
  for (const [module, access] of Object.entries(permissions)) {
    if (pathname.startsWith(`/${module}`)) return access?.readOnly ?? false
  }
  return false
}
```

**Read-only enforcement:** Pass `x-read-only: true` header (alongside `x-user-role`) from middleware to Server Components. Server Actions must check this header before any mutation. The DB-level read-only for auditor/dpo/socio is enforced via RLS policies that exclude mutating roles.

### Pattern 4: node-forge PKCS12 Metadata Extraction

**What:** Extract certificate subject (CN, O, CNPJ from OID 2.16.76.1.3.3), validity dates, and SHA-1 thumbprint from a `.pfx` buffer server-side.
**When to use:** In the certificate upload Server Action before storing metadata.

```typescript
// src/lib/icp/pfx-metadata.ts
// Source: node-forge 1.4.0 API [ASSUMED — based on training knowledge, verify against node-forge docs]
import 'server-only'
import forge from 'node-forge'

export interface CertificateMetadata {
  subject_cn: string        // Common Name (razão social / dentista)
  cnpj: string | null       // From OID 2.16.76.1.3.3 (ICP-Brasil specific)
  cpf: string | null        // From OID 2.16.76.1.3.1
  not_before: Date
  not_after: Date
  thumbprint_sha1: string   // Hex string (SHA-1 of DER-encoded cert)
  serial_number: string
  issuer_cn: string
}

export function extractPfxMetadata(pfxBuffer: Buffer, password: string): CertificateMetadata {
  // 1. Parse PKCS#12 ASN.1
  const pfxDer = forge.util.binary.raw.encode(new Uint8Array(pfxBuffer))
  const pfxAsn1 = forge.asn1.fromDer(pfxDer)
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password)

  // 2. Get certificate bag
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })
  const certBag = certBags[forge.pki.oids.certBag]?.[0]
  if (!certBag?.cert) throw new Error('No certificate found in PFX')
  const cert = certBag.cert

  // 3. Extract metadata
  const subjectCN = cert.subject.getField('CN')?.value ?? ''
  const issuerCN = cert.issuer.getField('CN')?.value ?? ''

  // ICP-Brasil OIDs: 2.16.76.1.3.3 = CNPJ, 2.16.76.1.3.1 = CPF
  // These appear in Subject Alternative Name or Subject extensions
  let cnpj: string | null = null
  let cpf: string | null = null
  for (const attr of cert.subject.attributes) {
    if (attr.type === '2.16.76.1.3.3') cnpj = attr.value
    if (attr.type === '2.16.76.1.3.1') cpf = attr.value
  }

  // 4. SHA-1 thumbprint (fingerprint)
  const md = forge.md.sha1.create()
  md.update(forge.asn1.toDer(cert.toAsn1()).getBytes())
  const thumbprint = md.digest().toHex()

  return {
    subject_cn: subjectCN,
    cnpj,
    cpf,
    not_before: cert.validity.notBefore,
    not_after: cert.validity.notAfter,
    thumbprint_sha1: thumbprint,
    serial_number: cert.serialNumber,
    issuer_cn: issuerCN,
  }
}
```

**[ASSUMED: ICP-Brasil OID placement in Subject attributes]** — CNPJ/CPF in ICP-Brasil A1 certs appear in Subject Alternative Name extensions, not always in Subject attributes. May require iterating `cert.extensions`. Verify with a real test cert. Risk: low (metadata display only in Phase 7; signing is Phase 8).

### Pattern 5: N:N `user_units` Table (preferred over single `users.unit_id`)

**Recommendation:** N:N via `user_units` table because:
- Product targets redes/franquias where a user (e.g., a floating dentist) may work across multiple units.
- Single `users.unit_id` column would require application-level denormalization for multi-unit users.
- N:N also allows future: per-unit role overrides (a user might be `admin` at one unit and `dentist` at another).

```sql
-- user_units: N:N assignment table
CREATE TABLE public.user_units (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  unit_id    UUID        NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  clinic_id  UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, unit_id)
);
CREATE INDEX idx_user_units_user_id   ON public.user_units(user_id);
CREATE INDEX idx_user_units_unit_id   ON public.user_units(unit_id);
CREATE INDEX idx_user_units_clinic_id ON public.user_units(clinic_id);
```

### Pattern 6: Supabase Storage Private Bucket for .pfx

**Bucket configuration:**
- Name: `icp-certificates` (private, no public access)
- Service role bypasses RLS entirely — admin client (`createAdminClient()`) used in Server Action for both upload and read [CITED: supabase.com/docs/guides/storage/security/access-control]
- No RLS SELECT policy needed for bucket objects — service role is the only reader
- Upload via admin client directly (not signed URL flow, since the file never touches client-side)

```typescript
// Upload pattern (Server Action)
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

async function uploadCertificate(clinicId: string, pfxBuffer: Buffer): Promise<string> {
  const admin = createAdminClient()
  const path = `${clinicId}/${crypto.randomUUID()}.pfx`
  const { error } = await admin.storage
    .from('icp-certificates')
    .upload(path, pfxBuffer, {
      contentType: 'application/x-pkcs12',
      upsert: false,
    })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return path // store this path in certificates table, never expose to client
}
```

### Pattern 7: V1 Migration — Backfilling `unit_id`

**Migration strategy for existing data:**
1. Create `units` table.
2. Insert one default unit per existing clinic (`INSERT INTO units SELECT id as clinic_id, name, ...`).
3. Backfill `unit_id` on `appointments`, `charges`, `receivables` using the default unit for that clinic.

```sql
-- Step: create default unit for every existing clinic
INSERT INTO public.units (id, clinic_id, name, slug, is_default, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,                           -- clinic_id (the tenant)
  c.name || ' (Principal)',        -- display name
  c.slug || '-principal',          -- slug
  true,                            -- is_default = true
  now(), now()
FROM public.clinics c
WHERE c.deleted_at IS NULL;

-- Backfill unit_id on appointments (FK to default unit of the appointment's clinic)
UPDATE public.appointments a
SET unit_id = u.id
FROM public.units u
WHERE u.clinic_id = a.tenant_id AND u.is_default = true;

-- Same for charges, receivables
```

**Constraint timing:** Add `unit_id` as `NULLABLE` first, run the backfill UPDATE, then add `NOT NULL` constraint. Never add `NOT NULL` before backfill on existing rows.

### Anti-Patterns to Avoid

- **Using `ALTER TYPE ADD VALUE` for roles:** v1 uses TEXT CHECK constraint (not enum), so this is N/A — but avoid introducing a Postgres enum for roles; TEXT CHECK is more migration-friendly.
- **Single `users.unit_id` column:** Inadequate for multi-unit users. Use N:N `user_units`.
- **Storing `.pfx` file in the `certificates` DB table (bytea):** Binary files belong in Storage; only metadata in DB.
- **Exposing `.pfx` path as a public Storage URL:** Always use admin client for cert reads; never generate public URLs for `icp-certificates` bucket.
- **Calling `get_my_unit_ids()` without `(SELECT ...)` wrapper in RLS:** Without the subquery wrapper, PostgreSQL may call the function per-row rather than once per statement.
- **Adding `x-read-only` header enforcement only in middleware:** Must ALSO be checked in Server Actions, because Server Actions are invoked directly via POST — middleware only fires for navigation requests, not Server Action invocations via `fetch`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PKCS12 parse + metadata extraction | Custom ASN.1 parser | `node-forge` 1.4.0 | PKCS#12 has deeply nested ASN.1; hand-rolling is error-prone and untested against ICP-Brasil A1 variants |
| CNPJ/CPF validation | Custom regex | `cpf-cnpj-validator` (already installed) | Handles digit-verification algorithm and formatting |
| Role-gating middleware | Re-reading DB on every request for permissions | MODULE_PERMISSIONS static map in proxy.ts | One DB call for `role`, then constant-time lookup in the static map |
| Certificate password encryption | Custom crypto | `src/lib/crypto.ts` AES-256-GCM (already exists) | Existing tested, consistent with medical data encryption |
| Unit assignment lookup in RLS | App-level filtering after fetch | `get_my_unit_ids()` SECURITY DEFINER | DB-enforced isolation; cannot be bypassed from application layer |

---

## Runtime State Inventory

> This phase adds new tables and backfills existing operational rows. It does NOT rename strings.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `appointments`, `charges`, `receivables` — rows without `unit_id` column | Backfill migration: ADD COLUMN unit_id NULLABLE, UPDATE from default unit, then NOT NULL |
| Live service config | Supabase Storage: `icp-certificates` bucket does not exist yet | Create bucket via migration or Supabase CLI `supabase storage create` |
| OS-registered state | None — no task scheduler or cron relevant to this phase | None |
| Secrets/env vars | `ENCRYPTION_KEY` already in Vercel env — reused for cert password encryption. No new env var needed for this phase | None |
| Build artifacts | `src/types/database.types.ts` is stale after new tables are added | Run `supabase gen types typescript --project-id jqjwyqlbbuqnrffdnlpp > src/types/database.types.ts` after `db push` |

---

## Common Pitfalls

### Pitfall 1: RLS Recursion in `get_my_unit_ids()`
**What goes wrong:** The function calls `get_my_role()` internally, which itself calls `get_my_tenant_id()`. If any of these functions reference a table that has RLS enabled and the policy calls back into these functions, you get infinite recursion.
**Why it happens:** Circular dependency between SECURITY DEFINER functions and RLS policies.
**How to avoid:** All three functions (`get_my_tenant_id`, `get_my_role`, `get_my_unit_ids`) are SECURITY DEFINER, which means they bypass RLS when executing internally. No recursion possible as long as the chain terminates at `auth.uid()` without a further RLS-protected table lookup.
**Warning signs:** Supabase query returning "infinite recursion detected in policy" error.

### Pitfall 2: `NOT NULL` on `unit_id` Before Backfill
**What goes wrong:** Migration adds `unit_id UUID NOT NULL` to `appointments` before backfilling — fails immediately because existing rows have NULL.
**Why it happens:** Standard mistake when adding required FK columns to tables with existing data.
**How to avoid:** Always: (1) ADD COLUMN as NULLABLE, (2) run UPDATE backfill, (3) ALTER COLUMN SET NOT NULL. Three separate statements in one migration.
**Warning signs:** Migration fails on `supabase db push` with "null value in column violates not-null constraint".

### Pitfall 3: CHECK Constraint Name May Differ
**What goes wrong:** `DROP CONSTRAINT users_role_check` fails if the actual constraint name differs (PostgreSQL auto-generates `users_role_check` but it depends on how the original migration defined it).
**Why it happens:** The initial migration used an inline CHECK without naming it explicitly.
**How to avoid:** Before writing the migration, query: `SELECT conname FROM pg_constraint WHERE conrelid = 'public.users'::regclass AND contype = 'c';` — or use `DROP CONSTRAINT IF EXISTS users_role_check` and also try the actual name from the query.
**Warning signs:** Migration fails with "constraint does not exist".

### Pitfall 4: node-forge ICP-Brasil OID Locations
**What goes wrong:** CNPJ extracted from `cert.subject.attributes` returns null because ICP-Brasil A1 certificates store the CNPJ in the Subject Alternative Name (SAN) extension, not in subject attributes.
**Why it happens:** ICP-Brasil has OIDs that map to extensions (`2.16.76.1.3.3` for CNPJ) — the precise ASN.1 path varies by CA.
**How to avoid:** Implement extraction with fallback: try `cert.subject.attributes` first, then iterate `cert.extensions` and look for the OID in SAN `otherName` entries. Test with a real ICP-Brasil A1 test certificate.
**Warning signs:** `cnpj` field is always null in extracted metadata.

### Pitfall 5: Server Actions Bypass Middleware Read-Only Gate
**What goes wrong:** Middleware sets `x-read-only: true` for auditor/dpo/socio. But Server Actions are invoked via direct POST fetch — they bypass the middleware's redirect logic (middleware still runs, but the response is not an HTML navigation).
**Why it happens:** Next.js middleware intercepts all requests, but for Server Actions the middleware cannot redirect (a redirect in middleware on a Server Action request results in a broken client-side `useFormState`). The header IS forwarded, but if the Server Action doesn't check it, mutations go through.
**How to avoid:** ALL Server Actions that perform mutations must check `headers().get('x-read-only') !== 'true'` before proceeding. Create a helper `assertNotReadOnly()` in `src/lib/auth/guards.ts`.
**Warning signs:** Auditor can successfully call a mutation Server Action via DevTools or curl.

### Pitfall 6: Supabase CLI Auth Gotcha (BLOCKING)
**What goes wrong:** `supabase db push` fails or pushes to the wrong project if CLI is logged in to the wrong Supabase org.
**Why it happens:** Documented gotcha (STATE.md): CLI often stays logged into org `nexus-*` from previous sessions.
**How to avoid:** Before every `supabase db push`, run:
```bash
supabase login
supabase link --project-ref jqjwyqlbbuqnrffdnlpp
supabase db push
```
**Warning signs:** Push succeeds but the schema changes aren't visible in the FYNXIA project dashboard (check the org `kczvihafddupruvsrrsc`).

### Pitfall 7: `invitations` Table Also Has a Role CHECK
**What goes wrong:** The `users.role` CHECK is updated but `invitations.role` keeps the old 5-value list. Inviting a DPO fails with a DB constraint violation.
**Why it happens:** Two separate tables have independent CHECK constraints on `role` TEXT columns.
**How to avoid:** Update BOTH in the same migration: `users_role_check` AND the invitations table role constraint.
**Warning signs:** `POST /api/invitations` returns 400 with "violates check constraint" for new role values.

### Pitfall 8: node-forge Bundle in Vercel
**What goes wrong:** node-forge is ~3.6 MB unminified; it may increase cold start time if bundled naively.
**Why it happens:** node-forge includes many modules (TLS, SSH, etc.) beyond what PKCS12 parsing needs.
**How to avoid:** Import only what's needed: `import forge from 'node-forge'` is fine for Node.js since Next.js tree-shakes server-only code. The cert upload Server Action runs in Vercel Fluid Compute (Node.js runtime, no 1 MB limit). Keep the pfx extraction function in a `server-only` module.
**Warning signs:** None expected for this stack; note it only if build bundle analysis shows issues.

---

## Code Examples

### Verified Patterns from Codebase

#### Existing AES-256-GCM for cert password (reuse as-is)
```typescript
// src/lib/crypto.ts — already in use for medical_history/allergies
// Reuse encrypt() for cert password storage
import { encrypt, decrypt } from '@/lib/crypto'

const encryptedPassword = encrypt(certPassword)  // store in certificates.cert_password_enc
const plainPassword = decrypt(encryptedPassword) // retrieve for signing (Phase 8)
```

#### Existing admin client for service-role operations (reuse)
```typescript
// src/lib/supabase/admin.ts — already exists
import { createAdminClient } from '@/lib/supabase/admin'
const admin = createAdminClient()
// admin bypasses RLS → use for Storage upload and cert reads
```

#### Existing RLS pattern to follow for new tables
```sql
-- From: supabase/migrations/20260604000400_rls_phase1.sql
-- Pattern: USING + WITH CHECK both present; tenant isolation via get_my_tenant_id()
CREATE POLICY "units_tenant_read" ON public.units
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "units_admin_write" ON public.units
  FOR ALL
  USING (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin'))
  WITH CHECK (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin'));
```

#### Existing source-inspection test pattern to follow
```typescript
// From: src/__tests__/migrations/schema.test.ts
// Pattern: readFileSync + regex assertions on SQL content (no DB connection)
const M = (f: string) => readFileSync(join(process.cwd(), 'supabase/migrations', f), 'utf8')

describe('Phase 7 migrations', () => {
  it('creates units table with clinic_id FK', () => {
    const sql = M('20260614000100_units_table.sql')
    expect(sql).toMatch(/CREATE TABLE public\.units/i)
    expect(sql).toMatch(/clinic_id.*REFERENCES public\.clinics/i)
  })
  // ...
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| `ROLE_ROUTES` prefix array per role | `MODULE_PERMISSIONS` matrix with allow/readOnly | Phase 7 | Enables 11 roles × N modules; read-only gating |
| Single clinic = tenant | Clinic (rede) + Units (filiais) | Phase 7 | Unlocks franchise BI, unit cost centers |
| No ICP cert storage | Private Storage bucket + metadata table | Phase 7 | Enables Phase 8 (document signing) |
| No AI config persistence | `ai_agent_config` table per agent | Phase 7 | Enables Phase 10 (L0–L4 enforcement) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ICP-Brasil A1 CNPJ stored in `cert.subject.attributes` with OID `2.16.76.1.3.3` | Pattern 4 (node-forge extraction) | CNPJ shows as null in metadata; must fallback to SAN extension parsing. Low risk: metadata display only in Phase 7 |
| A2 | node-forge 1.4.0 runs without issues in Vercel Node.js runtime (no native binaries) | Standard Stack | If node-forge uses native addons, it won't deploy on Vercel. Verify: node-forge is pure JS by design, confirmed by description "JavaScript implementations of...cryptography" |
| A3 | PostgreSQL CHECK constraint name on `users` is `users_role_check` | Pattern 2 (role expansion) | Migration `DROP CONSTRAINT users_role_check` fails; use `IF EXISTS` + runtime query to confirm name |
| A4 | Module permission matrix for `implantacao`, `aluno`, `ti` roles is sufficient as defined | Pattern 3 (RBAC matrix) | Wrong access level for a role; easily corrected by updating the constant map |

---

## Open Questions

1. **Supabase Storage bucket creation method**
   - What we know: Supabase CLI supports `supabase storage create` and buckets can be created via SQL (`INSERT INTO storage.buckets`).
   - What's unclear: Whether to create the bucket via migration SQL or via CLI command (CI consistency).
   - Recommendation: Create via `INSERT INTO storage.buckets` in a migration SQL file for version-controlled reproducibility.

2. **node-forge + ICP-Brasil A1 edge cases**
   - What we know: node-forge handles PKCS12 parsing and SHA-1 thumbprint extraction.
   - What's unclear: Exact OID path for CNPJ in real ICP-Brasil A1 certificates from CAs like Certisign, Serpro.
   - Recommendation: Add a test fixture with a real or synthetic ICP-Brasil A1 .pfx. Mark CNPJ as optional (nullable) in metadata table — display "N/A" if not extractable. Log raw extensions on extraction for debugging.

3. **`invitations` table `tenant_id` column naming**
   - What we know: `invitations.tenant_id` references `clinics(id)` (correct per migration). The column is `tenant_id` even though the table being referenced was renamed `clinics`.
   - What's unclear: Whether Phase 7 should also rename this FK to `clinic_id` for consistency.
   - Recommendation: Defer the rename — it would require a separate migration that changes `invitations.tenant_id` to `invitations.clinic_id`, touching RLS policies. Not required by Phase 7 requirements.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | node-forge runtime | Yes | v24.14.0 | — |
| npm | Package install | Yes | bundled with Node | — |
| supabase CLI | `db push` + type gen | Yes | ^2.105.0 (devDep) | — |
| `node-forge` | PKCS12 metadata extraction | NOT INSTALLED | 1.4.0 (npm registry) | None — required |
| `@types/node-forge` | TypeScript types for node-forge | NOT INSTALLED | latest | None — required for TS |
| Supabase project `jqjwyqlbbuqnrffdnlpp` | `db push` | Requires re-auth before use | — | — |
| `icp-certificates` Storage bucket | SYS-02 | Does not exist yet | — | Create in migration |

**Missing dependencies with no fallback:**
- `node-forge` + `@types/node-forge`: must be installed before implementing SYS-02 certificate upload.

**Missing dependencies with fallback:**
- Supabase re-auth: not a missing tool, but a required step before each `supabase db push` (documented gotcha).

---

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json`

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` (exists) |
| Test directory | `src/__tests__/` |
| Quick run command | `npm test` (= `vitest run`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYS-01 | `units` table created with clinic_id FK, indexes, soft delete | source-inspection | `npm test -- migrations/phase7` | Wave 0 |
| SYS-01 | `get_my_unit_ids()` SECURITY DEFINER present in migration | source-inspection | `npm test -- migrations/phase7` | Wave 0 |
| SYS-02 | `certificates` table with all metadata columns | source-inspection | `npm test -- migrations/phase7` | Wave 0 |
| SYS-02 | `extractPfxMetadata` returns valid shape (unit test with fixture) | unit | `npm test -- icp/pfx-metadata` | Wave 0 |
| SYS-02 | cert password encrypted via AES-256 (crypto.ts reuse) | source-inspection | `npm test -- icp/pfx-metadata` | Wave 0 |
| SYS-03 | `MODULE_PERMISSIONS` contains all 11 roles | source-inspection | `npm test -- proxy/rbac-v2` | Wave 0 |
| SYS-03 | `isPathAllowed` returns false for auditor → mutation routes | unit | `npm test -- proxy/rbac-v2` | Wave 0 |
| SYS-04 | `ai_agent_config` table created with correct columns | source-inspection | `npm test -- migrations/phase7` | Wave 0 |
| SYS-05 | `appointments` and `charges` have `unit_id` column in migration | source-inspection | `npm test -- migrations/phase7` | Wave 0 |
| ROLE-01 | CHECK constraint includes all 11 roles on `users` | source-inspection | `npm test -- migrations/phase7` | Wave 0 |
| ROLE-01 | CHECK constraint includes all 11 roles on `invitations` | source-inspection | `npm test -- migrations/phase7` | Wave 0 |
| ROLE-02 | `isReadOnly` returns true for auditor/dpo/socio on operational paths | unit | `npm test -- proxy/rbac-v2` | Wave 0 |
| ROLE-02 | `assertNotReadOnly()` guard exists in server-side guard module | source-inspection | `npm test -- proxy/rbac-v2` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` (full suite, ~5s, no DB required — source-inspection tests)
- **Per wave merge:** `npm test && npm run build`
- **Phase gate:** Full suite green + `npm run build` passing before `/gsd-verify-work`

### Wave 0 Gaps

- `src/__tests__/migrations/phase7.test.ts` — source-inspection tests for all new migration files
- `src/__tests__/proxy/rbac-v2.test.ts` — expanded RBAC matrix tests including new roles + read-only flag
- `src/__tests__/icp/pfx-metadata.test.ts` — node-forge extraction unit tests with synthetic fixture
- Fixture: `src/__tests__/icp/fixtures/test-cert.pfx` — a self-signed PKCS12 cert for testing (can be generated with openssl locally)
- `src/lib/auth/guards.ts` — `assertNotReadOnly()` utility for Server Actions

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (auth already implemented in v1) | — |
| V3 Session Management | No | — |
| V4 Access Control | YES — new roles + module gating | `MODULE_PERMISSIONS` matrix server-side; `get_my_unit_ids()` RLS; `assertNotReadOnly()` in mutations |
| V5 Input Validation | YES — CNPJ/CNPJ, cert upload, autonomy level | zod schemas for all forms; file type + size validation on .pfx upload |
| V6 Cryptography | YES — cert password AES-256, thumbprint SHA-1 | `src/lib/crypto.ts` (AES-256-GCM existing) for password; node-forge SHA-1 for thumbprint (display only, not security-critical) |

### Known Threat Patterns for this Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Role escalation via direct POST to mutation Server Action | Elevation of Privilege | `assertNotReadOnly()` in every mutation SA; `get_my_role()` re-checked server-side, not just from header |
| Certificate file exfiltration | Information Disclosure | `icp-certificates` bucket: no public URL; service role only; never expose bucket path to client |
| Tenant cross-contamination via unit assignment | Elevation of Privilege | `user_units` RLS must include `clinic_id = get_my_tenant_id()` check; `get_my_unit_ids()` already scoped to tenant |
| Oversized .pfx upload (DoS) | Denial of Service | File size limit in Server Action before forwarding to Storage (recommend: max 5 MB) |
| Storing cert password as plaintext | Information Disclosure | Always encrypt with `encrypt()` from crypto.ts before inserting into `certificates` table |
| CNPJ injection via malicious certificate subject | Tampering | Treat all extracted metadata as user-controlled input; display only, never execute |

---

## Sources

### Primary (HIGH confidence)
- Codebase — `supabase/migrations/20260603000000_initial_schema.sql`: TEXT CHECK constraint pattern for `role`, SECURITY DEFINER function pattern [VERIFIED]
- Codebase — `src/lib/crypto.ts`: AES-256-GCM encrypt/decrypt implementation [VERIFIED]
- Codebase — `src/proxy.ts`: ROLE_ROUTES structure, x-user-role header forwarding [VERIFIED]
- Codebase — `src/__tests__/proxy/rbac.test.ts`: source-inspection test pattern [VERIFIED]
- Codebase — `package.json`: all installed dependencies and versions [VERIFIED]
- npm registry — `node-forge` version 1.4.0 [VERIFIED via `npm show node-forge version`]
- npm registry — `@peculiar/x509` version 2.0.0 [VERIFIED via `npm show` — not recommended here, node-forge preferred for PKCS12]

### Secondary (MEDIUM confidence)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — service role bypasses RLS; INSERT policy for authenticated upload [CITED]
- [Crunchy Data: ENUMs vs CHECK Constraints](https://www.crunchydata.com/blog/enums-vs-check-constraints-in-postgres) — CHECK constraint flexibility over enum for evolving value sets [CITED]
- [Supabase RLS SECURITY DEFINER discussion](https://github.com/orgs/supabase/discussions/26988) — UUID array return pattern for RLS policies [CITED]

### Tertiary (LOW confidence)
- node-forge PKCS12 ICP-Brasil OID paths — training knowledge, not verified against real ICP-Brasil A1 cert [ASSUMED: A1]
- MODULE_PERMISSIONS shape for `implantacao`, `aluno`, `ti` roles — reasonable inference from D-03/D-04 but exact module access not specified in CONTEXT.md [ASSUMED: A4]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages verified from package.json; node-forge version from npm registry
- Architecture (multiunidade RLS): HIGH — pattern follows existing SECURITY DEFINER functions verified in codebase
- Architecture (PKCS12 extraction): MEDIUM — node-forge API modeled from training knowledge; actual ICP-Brasil OID paths assumed
- Role expansion: HIGH — TEXT CHECK constraint pattern verified from codebase; constraint name caveat documented
- Pitfalls: HIGH — derived from actual codebase patterns and documented PostgreSQL behavior

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (30 days — stable dependencies)
