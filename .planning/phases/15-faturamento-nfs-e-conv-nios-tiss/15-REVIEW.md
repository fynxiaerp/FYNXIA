---
phase: 15-faturamento-nfs-e-conv-nios-tiss
reviewed: 2026-06-20T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/actions/service-orders.ts
  - src/actions/nfse.ts
  - src/actions/tiss.ts
  - src/actions/insurers.ts
  - src/actions/services.ts
  - src/app/api/webhooks/nfse/route.ts
  - supabase/migrations/20260620000100_faturamento_catalog_tables.sql
  - supabase/migrations/20260620000200_faturamento_os_tables.sql
  - supabase/migrations/20260620000300_faturamento_tiss_tables.sql
  - supabase/migrations/20260620000400_faturamento_rls.sql
  - supabase/migrations/20260620000500_faturamento_seed.sql
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-06-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 15 introduces 13 new faturamento tables across 5 migrations plus the core billing server actions (OS lifecycle, NFS-e, TISS, insurers, services). The overall architecture is sound: CAS idempotency on `faturarOs`, forward-only NFS-e status advances, integer-cent ISS math, LGPD masking on all patient outputs, and webhook signature verification are all correctly implemented. RLS coverage on all 13 new tables is present with proper `USING + WITH CHECK` pairs.

Four critical bugs were found that will cause runtime failures in production: a schema/code mismatch on `patients.first_name/last_name` (column does not exist), a missing `charge_id` column on `service_orders`, an invalid `'enviado'` status value against the `tiss_lotes` CHECK constraint, and a NULL `p_unit_id` passed to `next_os_number()` silently returns NULL. Additionally, `updateInsurer` and `deactivateInsurer` lack a tenant-scope guard allowing cross-tenant writes by any authenticated admin-role user who can craft a request with another clinic's insurer ID.

---

## Critical Issues

### CR-01: `nfse.ts` selects `first_name, last_name` but `patients` table only has `full_name`

**File:** `src/actions/nfse.ts:152`
**Issue:** `emitirNfse` builds `tomadorNome` by fetching `first_name, last_name` from the `patients` table. The `patients` schema (migration `20260605000100_clinical_tables.sql`) defines only `full_name TEXT NOT NULL`. This column mismatch will cause every NFS-e emission with a non-null `patient_id` to silently return `null` for `pt` (Supabase returns an error on unknown column selection, which the `.maybeSingle()` ignores), leaving `tomadorNome = 'Paciente'` and `tomadorCpf = ''` — the NFS-e is emitted with an empty CPF, which Focus NFe will likely reject.

**Fix:**
```typescript
// nfse.ts:150-158 — replace first_name/last_name with full_name
const { data: pt } = await admin
  .from('patients')
  .select('full_name, cpf')
  .eq('id', patientId)
  .maybeSingle()
if (pt) {
  tomadorNome = maskTomadorNome(pt.full_name)
  tomadorCpf = pt.cpf ?? ''
}
```
The `maskTomadorNome` helper already accepts a single string — no other changes needed.

---

### CR-02: `service_orders` has no `charge_id` column; `faturarOs` writes to it unconditionally

**File:** `src/actions/service-orders.ts:349-354`
**Issue:** After a successful `createCharge`, `faturarOs` does:
```typescript
await supabase
  .from('service_orders')
  .update({ charge_id: chargeResult.chargeId })
  .eq('id', osId)
```
The `service_orders` DDL in `20260620000200_faturamento_os_tables.sql` has no `charge_id` column. The forward-link between OS and charge is designed in the other direction: `charges.service_order_id` (added by the ALTER TABLE in that same migration). This update will throw a PostgreSQL error (`column "charge_id" of relation "service_orders" does not exist`), which will crash the particular-path of `faturarOs` after the CAS has already set status to `'faturada'` — leaving the OS in an inconsistent state where it is `faturada` but the error is returned to the caller.

**Fix — Option A (preferred):** Remove the reverse-link update. The link already exists via `charges.service_order_id`; add that column on insert instead:
```typescript
// In createCharge call, pass service_order_id so it is stored on charges
chargeResult = await createCharge({
  patientId,
  value: os.total ?? 0,
  description: `OS ${os.numero ?? osId}`,
  billingType: ...,
  installmentCount: ...,
  dueDate: dueDateStr,
  serviceOrderId: osId,   // add this field
})
// Remove the .update({ charge_id: ... }) block entirely
```

**Fix — Option B:** Add the column to the migration:
```sql
-- In 20260620000200_faturamento_os_tables.sql, inside service_orders DDL:
charge_id UUID REFERENCES public.charges(id) ON DELETE SET NULL,
```
Then update the RLS for `service_orders` to allow this column to be set by the writer roles.

---

### CR-03: `fecharLote` sets `status: 'enviado'` which violates `tiss_lotes` CHECK constraint

**File:** `src/actions/tiss.ts:240, 309`
**Issue:** Both the test DI path (line 240) and the production path (line 309) set `tiss_lotes.status = 'enviado'` after sending a lote. The `tiss_lotes` table has a CHECK constraint:
```sql
CHECK (status IN ('em_analise', 'autorizada', 'glosada', 'paga', 'recurso'))
```
`'enviado'` is not in this set. The UPDATE will fail with a `23514` CHECK constraint violation, causing `fecharLote` to crash at line 302–310 while the provider call (line 282) has already succeeded — the lote is sent to the insurer but the local record is not updated.

**Fix — Two options:**

Option A — Add `'enviado'` to the migration CHECK constraint:
```sql
-- In 20260620000300_faturamento_tiss_tables.sql:
status TEXT NOT NULL DEFAULT 'em_analise'
       CHECK (status IN ('em_analise', 'enviado', 'autorizada', 'glosada', 'paga', 'recurso')),
```

Option B — Map `'enviado'` to `'em_analise'` at the action layer (a lote just sent is still awaiting insurer response, so `'em_analise'` is semantically correct):
```typescript
// tiss.ts:305-311 — replace 'enviado' with 'em_analise'
await supabase
  .from('tiss_lotes')
  .update({
    protocolo: loteResult.protocolo,
    provider_ref: loteResult.provider_ref ?? null,
    data_envio: now,
    status: 'em_analise',  // 'enviado' is not in the CHECK enum
    valor_total: valorTotal,
  })
  .eq('id', loteId)
```
Option A is safer if downstream UI/reports need to distinguish "sent-awaiting" from "analyzing." The DI path (line 240) must be aligned to whichever option is chosen.

---

### CR-04: `next_os_number(NULL)` returns NULL; `createOs` and auto-OS creation silently break when `unit_id` is null

**File:** `supabase/migrations/20260620000200_faturamento_os_tables.sql:206-222`, `src/actions/service-orders.ts:128-133`, `src/actions/appointments.ts:440-444`
**Issue:** When `unit_id` is null (clinics with no units configured), `next_os_number` receives `p_unit_id = NULL`. The INSERT...SELECT WHERE u.id = NULL matches 0 rows (no-op), and the UPDATE WHERE unit_id = NULL also matches 0 rows. PostgreSQL's `RETURNING` clause yields no rows, so `next_num` stays `NULL`. The function returns `'OS-' || LPAD(NULL::TEXT, 6, '0')` which evaluates to `NULL`. The callers check `if (rpcError || !rpcData)` — `!NULL` is true — but `rpcError` is null (no error from PG), so `!rpcData` catches this and returns an error to the user. The auto-OS creation in `createOsDraftFromAppointment` throws `next_os_number RPC failed: no data`, breaking the appointment conclusion silently (try/catch swallows it). Clinics without units can never create OS.

**Fix — add a NULL guard and a clinic-level fallback counter:**
```sql
CREATE OR REPLACE FUNCTION public.next_os_number(p_unit_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  next_num INT;
  v_clinic_id UUID;
BEGIN
  IF p_unit_id IS NULL THEN
    RAISE EXCEPTION 'next_os_number: p_unit_id must not be NULL';
  END IF;

  INSERT INTO public.unit_os_counters (unit_id, clinic_id, last_os_number)
  SELECT u.id, u.clinic_id, 0 FROM public.units u WHERE u.id = p_unit_id
  ON CONFLICT (unit_id) DO NOTHING;

  UPDATE public.unit_os_counters
    SET last_os_number = last_os_number + 1
    WHERE unit_id = p_unit_id
  RETURNING last_os_number INTO next_num;

  IF next_num IS NULL THEN
    RAISE EXCEPTION 'next_os_number: unit % not found', p_unit_id;
  END IF;

  RETURN 'OS-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;
```
On the application side, require `unitId` to be non-null before calling `createOs`. The `serviceOrderSchema` should add `.refine(() => unitId != null)` or the action should return a clear error when `unitId` is null.

---

## Warnings

### WR-01: `updateInsurer` and `deactivateInsurer` missing tenant-scope `.eq('clinic_id', actor.tenant_id)` on UPDATE

**File:** `src/actions/insurers.ts:165-168, 193-194`
**Issue:** Both mutation queries scope only by `id`, not by `clinic_id`:
```typescript
// updateInsurer (line 165-168)
await supabase.from('insurers').update(updates).eq('id', id)

// deactivateInsurer (line 193-194)
await supabase.from('insurers').update({ ativo: false, status: 'inativo' }).eq('id', id)
```
RLS with `USING (clinic_id = get_my_tenant_id())` is the backstop, but defense-in-depth requires an explicit `.eq('clinic_id', actor.tenant_id)` at the application layer, consistent with every other write action in this codebase (see `appointments.ts:313`, `service-orders.ts:199`, etc.). If RLS is ever misconfigured or bypassed via service-role key, an admin from clinic A could modify clinic B's insurer.

**Fix:**
```typescript
// updateInsurer
await supabase
  .from('insurers')
  .update(updates)
  .eq('id', id)
  .eq('clinic_id', actor.tenant_id)  // add tenant scope guard

// deactivateInsurer
await supabase
  .from('insurers')
  .update({ ativo: false, status: 'inativo' })
  .eq('id', id)
  .eq('clinic_id', actor.tenant_id)  // add tenant scope guard
```

---

### WR-02: `financeiro` role included in `insurers.ts` WRITE_ROLES but excluded from `insurers_admin_write` RLS policy

**File:** `src/actions/insurers.ts:44` vs `supabase/migrations/20260620000400_faturamento_rls.sql:116-125`
**Issue:** The server action allows `['admin', 'superadmin', 'financeiro']` to write insurers at the application layer, but the `insurers_admin_write` RLS policy only allows `('admin', 'superadmin')`. A `financeiro` user who calls `createInsurer`, `updateInsurer`, or `deactivateInsurer` will pass the application role gate but then have the write silently blocked by RLS (Supabase returns no error on RLS denial — it just returns 0 rows updated or a "permission denied" insert error). This role matrix inconsistency will confuse `financeiro` users who receive no error but their changes are not persisted.

**Fix — choose one option and align both layers:**

Option A (add `financeiro` to RLS):
```sql
-- 20260620000400_faturamento_rls.sql
CREATE POLICY "insurers_admin_write" ON public.insurers
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'financeiro')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'financeiro')
  );
```

Option B (remove `financeiro` from action layer WRITE_ROLES):
```typescript
// src/actions/insurers.ts:44
const WRITE_ROLES = ['admin', 'superadmin'] as const
```

---

### WR-03: `tiss_guides` has no DB-level UNIQUE constraint on `service_order_id`; race condition possible

**File:** `supabase/migrations/20260620000300_faturamento_tiss_tables.sql`
**Issue:** The idempotency guard in `criarGuia` and `criarGuiaForOs` is purely application-level (a `maybeSingle()` SELECT before INSERT). If `faturarOs` is called concurrently for the same OS (e.g., double-click), both requests can pass the `existing` check simultaneously before either has inserted, resulting in duplicate `tiss_guides` rows for the same `service_order_id`. The `service_orders` table has a partial UNIQUE INDEX on `appointment_id` for the analogous OS case — the same backstop is missing here.

Compare: `service_orders` has:
```sql
CREATE UNIQUE INDEX idx_service_orders_appointment
  ON public.service_orders(appointment_id)
  WHERE appointment_id IS NOT NULL;
```

**Fix:** Add a partial UNIQUE INDEX on `tiss_guides`:
```sql
-- New migration or add to 20260620000300_faturamento_tiss_tables.sql
CREATE UNIQUE INDEX idx_tiss_guides_service_order
  ON public.tiss_guides(service_order_id);
```
Then handle `23505` unique_violation in `criarGuia` the same way `createOsDraftFromAppointment` does for `service_orders`.

---

### WR-04: `faturarOs` has no explicit role gate at the application layer

**File:** `src/actions/service-orders.ts:216-427`
**Issue:** `createOs` (line 116-118) gates on `FATURAR_ROLES`, but `faturarOs` itself contains no role check — it relies solely on RLS (`service_orders_role_write` allows `dentist/receptionist/admin/superadmin`) to reject unauthorized callers. D-18 specifies that faturar is restricted to `receptionist/admin/financeiro`, but `dentist` can also create OS rascunhos. Any `dentist` who can create an OS can also call `faturarOs` since the RLS permits it. If the role matrix should exclude `dentist` from `faturarOs`, the check must be at the action layer. Additionally, `financeiro` is mentioned in T-15-16 as allowed to faturar but is excluded from `service_orders_role_write` RLS.

**Fix:** Add a role gate to `faturarOs` consistent with D-18:
```typescript
// After the getActor() call inside faturarOs production path (around line 263):
const FATURAR_ROLES = ['admin', 'superadmin', 'receptionist', 'financeiro']
if (!FATURAR_ROLES.includes(actor.role)) {
  return { success: false, error: 'Permissão insuficiente para faturar OS' }
}
```
Align `service_orders_role_write` RLS to also include `financeiro` if that role should be able to write to the table.

---

### WR-05: `appointment_procedures` DDL missing `description`, `tuss_code`, `account_id`, `cost_center_id` columns that `createOsDraftFromAppointment` selects

**File:** `src/actions/appointments.ts:475`, `supabase/migrations/20260620000200_faturamento_os_tables.sql:55-69`
**Issue:** `createOsDraftFromAppointment` selects these columns from `appointment_procedures`:
```typescript
.select('service_id, description, quantity, valor_unitario, professional_id, tuss_code, dente, face, account_id, cost_center_id')
```
The `appointment_procedures` DDL has: `service_id`, `professional_id`, `quantity`, `valor_unitario`, `desconto`, `nota`, `dente`, `face` — no `description`, `tuss_code`, `account_id`, or `cost_center_id`. Supabase will return an error for an unknown column in a `.select()`, causing `procedures` to be `null` and silently skipping procedure seeding. The OS is created with zero items when procedures exist.

**Fix — add missing columns to the migration DDL:**
```sql
-- In 20260620000200_faturamento_os_tables.sql, appointment_procedures table:
  service_id       UUID        NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  professional_id  UUID        REFERENCES public.professionals(id) ON DELETE SET NULL,
  description      TEXT,                          -- add this
  tuss_code        TEXT,                          -- add this
  quantity         INT         NOT NULL DEFAULT 1,
  valor_unitario   NUMERIC(12,2) NOT NULL,
  desconto         NUMERIC(12,2) NOT NULL DEFAULT 0,
  nota             TEXT,
  dente            TEXT,
  face             TEXT,
  account_id       UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,  -- add this
  cost_center_id   UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,       -- add this
```
This schema gap is a runtime bug in the OS auto-seeding path, though it only affects existing `appointment_procedures` rows (none yet in Phase 15).

---

## Info

### IN-01: Seed migration `glosa_motivos` idempotency guard is all-or-nothing

**File:** `supabase/migrations/20260620000500_faturamento_seed.sql:46-48`
**Issue:** The guard `WHERE NOT EXISTS (SELECT 1 FROM public.glosa_motivos WHERE clinic_id IS NULL)` prevents the entire 21-code INSERT if even one shared ANS code already exists. This means if new ANS codes need to be added in a future migration, a similar `WHERE NOT EXISTS` on the full set would skip the new codes. The pattern is not idempotent at the individual-code level.

**Fix:** Use `ON CONFLICT (codigo_ans) WHERE clinic_id IS NULL DO NOTHING` to make each row independently idempotent. This requires a partial unique index on `glosa_motivos(codigo_ans) WHERE clinic_id IS NULL`:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_glosa_motivos_shared_code
  ON public.glosa_motivos(codigo_ans) WHERE clinic_id IS NULL;

INSERT INTO public.glosa_motivos (clinic_id, codigo_ans, descricao)
VALUES (NULL, '1001', 'Número da carteira inválido'), ...
ON CONFLICT (codigo_ans) WHERE clinic_id IS NULL DO NOTHING;
```

---

### IN-02: `emitirNfse` DI path does not update `nfse_records` with provider result

**File:** `src/actions/nfse.ts:230-236`
**Issue:** The dependency-injection path (used in tests) calls `provider.emit()` but discards the result and does not perform a CAS update on `nfse_records`. The production path (lines 212-226) does the CAS update correctly. In tests using the real `insertNfseRecord` dep but a mock `getProvider`, the `nfse_records` row stays `status='processando'` indefinitely. This is a test-only concern (no production impact) but means test coverage of the CAS update is incomplete.

**Fix:** Extend the DI path to use the same CAS pattern:
```typescript
// After provider.emit() in the DI path:
const result = await provider.emit({ idempotency_key: `nfse:os:${osId}` })
// CAS update — forward-only
await admin.from('nfse_records')
  .update({ status: result.status, ... })
  .eq('id', nfseId)
  .eq('status', 'processando')
```

---

### IN-03: `getGlosas` in `tiss.ts` does not filter by insurer or month at the DB level

**File:** `src/actions/tiss.ts:564-580`
**Issue:** The `insurerId` and `month` filters passed to `getGlosas` are not applied to the query. The `tiss_guide_items` query lacks joins/filters for `insurerId` and `month`. The `filters?.insurerId` and `filters?.month` parameters are declared and destructured but the `query` builder never uses them — only `glosa_status` is filtered. This means the insurer dropdown and month filter on the Glosas page have no effect; all tenants' glosa items are returned (scoped only by RLS tenant, not by insurer or month).

**Fix:** Apply the filters before executing the query:
```typescript
// tiss.ts — inside getGlosas, after building the base query:
if (filters?.insurerId) {
  // filter via the nested tiss_guides relation
  query = query.eq('tiss_guides.insurer_id', filters.insurerId)
}
if (filters?.month) {
  const [year, month] = filters.month.split('-').map(Number)
  if (year && month) {
    const start = new Date(year, month - 1, 1).toISOString()
    const end = new Date(year, month, 1).toISOString()
    query = query.gte('created_at', start).lt('created_at', end)
  }
}
```
Note: filtering on a nested relation column in Supabase requires a `!inner` join hint in the `.select()` or a subquery via RPC.

---

_Reviewed: 2026-06-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
