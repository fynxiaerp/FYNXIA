---
phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese
plan: 02
type: execute
wave: 1
depends_on: [01]
files_modified:
  - supabase/migrations/20260619000100_sterilization_cycles.sql
  - supabase/migrations/20260619000200_sterilization_rls.sql
  - src/lib/esterilizacao/cycle-status.ts
  - src/lib/validators/sterilization.ts
autonomous: true
requirements: [CME-01, CME-02, CME-03]
tags: [esterilizacao, cme, migration, database, kit-usage, block-guard, rls]

must_haves:
  truths:
    - "sterilization_cycles table exists: clinic_id (+ unit_id), autoclave_id FK→resources(id), temperatura/tempo_minutos/pressao params, biological_result CHECK (pendente/aprovado/reprovado), validade DATE, status CHECK (aprovado/reprovado/vencido), cycle_date, operator_id, deleted_at — with RLS USING+WITH CHECK + clinic_id/unit_id indexes"
    - "kit_usages table links sterilization_cycle_id → appointment_id + patient_id (the kit↔lote↔paciente traceability, CME-03) with RLS USING+WITH CHECK + indexes on cycle/patient/clinic"
    - "deriveCycleStatus + isCycleUsable are PURE (no 'use server'/server-only): isCycleUsable returns usable=false for non-aprovado biological_result OR validade < referenceDate (CME-02 block guard contract)"
    - "sterilizationCycleSchema + kitUsageSchema (Zod v3, NO .default()) validate the cycle params + the kit-usage link"
  artifacts:
    - path: "supabase/migrations/20260619000100_sterilization_cycles.sql"
      provides: "sterilization_cycles + kit_usages tables + indexes"
      contains: "CREATE TABLE public.sterilization_cycles"
    - path: "supabase/migrations/20260619000200_sterilization_rls.sql"
      provides: "RLS USING+WITH CHECK for sterilization_cycles + kit_usages"
      contains: "ENABLE ROW LEVEL SECURITY"
    - path: "src/lib/esterilizacao/cycle-status.ts"
      provides: "deriveCycleStatus + isCycleUsable pure functions (block guard logic)"
      exports: ["deriveCycleStatus", "isCycleUsable"]
    - path: "src/lib/validators/sterilization.ts"
      provides: "Zod v3 sterilizationCycleSchema + kitUsageSchema (no .default)"
      exports: ["sterilizationCycleSchema", "kitUsageSchema"]
  key_links:
    - from: "src/actions/sterilization.ts (Plan 04)"
      to: "isCycleUsable + sterilization_cycles + kit_usages"
      via: "pure import (re-check server-side) + insert"
      pattern: "isCycleUsable|kit_usages"
---

<objective>
Build the CME data + logic foundation: (1) the `sterilization_cycles` table (autoclave REUSES `resources` via `autoclave_id` FK — D-01; no dedicated autoclave table), carrying the cycle parameters (temperatura/tempo/pressão), the biological indicator result, the `validade` (expiry of the sterilized material), and a derived `status`; (2) the `kit_usages` table that links a cycle (= the lote, D-02) to an `appointment_id` + `patient_id` for the lote-level traceability (CME-03); (3) RLS USING+WITH CHECK + clinic_id/unit_id indexes on both; (4) the PURE `cycle-status.ts` lib (`deriveCycleStatus` + `isCycleUsable`) that encodes the CME-02 block-guard rule; (5) the Zod v3 schemas.

Purpose: Make the CME model + block-guard logic real so Plan 04's Server Action can register cycles and BLOCK kit usage of a non-aprovado or vencido cycle server-side. The `appointments` GIST and `financial_transactions` are NOT touched. The block-guard logic is PURE so it is unit-testable AND re-usable in the UI for a non-blocking pre-warning — but the authoritative enforcement is server-side in Plan 04.
Output: 2 migrations + 1 pure lib + 1 Zod validator. Turns cycle-status.test.ts + kit-block-guard.test.ts + migrations-phase13-cme.test.ts GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/13-esteriliza-o-cme-laborat-rio-de-pr-tese/13-CONTEXT.md
@supabase/migrations/20260617000300_resources.sql
@supabase/migrations/20260617000400_resources_rls.sql
@supabase/migrations/20260618000100_clinical_documents.sql
@supabase/migrations/20260618000200_clinical_documents_rls.sql
@src/lib/validators/resource.ts
@src/__tests__/esterilizacao/kit-block-guard.test.ts

<interfaces>
<!-- Contracts the executor implements against. -->

RLS helpers (SECURITY DEFINER, already exist): `get_my_tenant_id()` → caller clinic UUID; `get_my_role()` → caller role TEXT.
FK targets that already exist: `public.clinics(id)`, `public.units(id)`, `public.resources(id)` (Phase 11 — autoclave is a row here, tipo='equipamento'), `public.appointments(id)`, `public.patients(id)`, `public.users(id)`.

cycle-status.ts exact signatures (kit-block-guard.test.ts + cycle-status.test.ts assert these):
```typescript
export type BiologicalResult = 'pendente' | 'aprovado' | 'reprovado'
export type CycleStatus = 'aprovado' | 'reprovado' | 'vencido'
export function deriveCycleStatus(params: {
  biologicalResult: BiologicalResult; validade: string | null; referenceDate?: string
}): CycleStatus | 'pendente'
export function isCycleUsable(params: {
  biologicalResult: BiologicalResult; validade: string | null; referenceDate?: string
}): { usable: boolean; reason: string | null }
```
Block-guard rule (CME-02): usable ONLY if biologicalResult === 'aprovado' AND (validade === null OR validade >= referenceDate). reason strings MUST include the substrings the RED tests check: 'reprovado', 'pendente' ('indicador biológico pendente'), 'vencido'. Expiry is strict `validade < referenceDate` (validade === today is still valid).

Zod v3: NO `.default()` (STATE.md D-133/D-158).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: CME migrations — sterilization_cycles + kit_usages + RLS</name>
  <files>supabase/migrations/20260619000100_sterilization_cycles.sql, supabase/migrations/20260619000200_sterilization_rls.sql</files>
  <read_first>
    - supabase/migrations/20260617000300_resources.sql (autoclave FK target + clinic_id/unit_id index style; column conventions)
    - supabase/migrations/20260617000400_resources_rls.sql (USING + WITH CHECK + role-gate idiom for clinic-scoped operational tables)
    - supabase/migrations/20260618000100_clinical_documents.sql (recent table style: appointment_id/patient_id FKs, deleted_at, partial unit_id index)
    - src/__tests__/esterilizacao/migrations-phase13-cme.test.ts (the exact substrings the source-inspection asserts — satisfy them)
  </read_first>
  <action>
Create `supabase/migrations/20260619000100_sterilization_cycles.sql`:
  - `CREATE TABLE public.sterilization_cycles (`
    `id UUID PRIMARY KEY DEFAULT gen_random_uuid(),`
    `clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,`
    `unit_id UUID REFERENCES public.units(id),`
    `autoclave_id UUID NOT NULL REFERENCES public.resources(id),`   -- D-01: autoclave reuses resources (tipo='equipamento')
    `cycle_number TEXT,`                                            -- optional human label / lote ref
    `temperatura NUMERIC(6,2),`                                     -- °C
    `tempo_minutos INTEGER,`                                        -- cycle duration
    `pressao NUMERIC(6,2),`                                         -- kPa/bar
    `biological_result TEXT NOT NULL DEFAULT 'pendente' CHECK (biological_result IN ('pendente','aprovado','reprovado')),`
    `cycle_date DATE NOT NULL DEFAULT CURRENT_DATE,`
    `validade DATE,`                                                -- expiry of the sterilized material (nullable = no expiry recorded)
    `status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','reprovado','vencido')),`  -- persisted snapshot; vencido also derived at read-time by isCycleUsable
    `operator_id UUID REFERENCES public.users(id),`
    `notes TEXT,`
    `created_by UUID REFERENCES public.users(id),`
    `created_at TIMESTAMPTZ NOT NULL DEFAULT now(),`
    `updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),`
    `deleted_at TIMESTAMPTZ`
    `);`
  - Indexes: `CREATE INDEX idx_sterilization_cycles_clinic ON public.sterilization_cycles(clinic_id);` `CREATE INDEX idx_sterilization_cycles_unit ON public.sterilization_cycles(unit_id) WHERE unit_id IS NOT NULL;` `CREATE INDEX idx_sterilization_cycles_autoclave ON public.sterilization_cycles(autoclave_id);` `CREATE INDEX idx_sterilization_cycles_status ON public.sterilization_cycles(clinic_id, status);`
  - `CREATE TABLE public.kit_usages (`
    `id UUID PRIMARY KEY DEFAULT gen_random_uuid(),`
    `clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,`
    `unit_id UUID REFERENCES public.units(id),`
    `sterilization_cycle_id UUID NOT NULL REFERENCES public.sterilization_cycles(id),`   -- the lote (D-02)
    `appointment_id UUID REFERENCES public.appointments(id),`
    `patient_id UUID NOT NULL REFERENCES public.patients(id),`
    `kit_label TEXT,`                                               -- optional free-text kit descriptor (lote-level, NOT per-unit QR)
    `used_at TIMESTAMPTZ NOT NULL DEFAULT now(),`
    `used_by UUID REFERENCES public.users(id),`
    `created_at TIMESTAMPTZ NOT NULL DEFAULT now(),`
    `deleted_at TIMESTAMPTZ`
    `);`
  - Indexes: `CREATE INDEX idx_kit_usages_clinic ON public.kit_usages(clinic_id);` `CREATE INDEX idx_kit_usages_cycle ON public.kit_usages(sterilization_cycle_id);` `CREATE INDEX idx_kit_usages_patient ON public.kit_usages(patient_id);` `CREATE INDEX idx_kit_usages_appt ON public.kit_usages(appointment_id) WHERE appointment_id IS NOT NULL;` `CREATE INDEX idx_kit_usages_unit ON public.kit_usages(unit_id) WHERE unit_id IS NOT NULL;`
  - Audit trigger (rastreabilidade): attach the existing audit function — `CREATE TRIGGER audit_kit_usages AFTER INSERT OR UPDATE OR DELETE ON public.kit_usages FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();` (mirror the financial_transactions trigger; this gives CME-03 a DB-level trail in addition to logBusinessEvent in the action). If audit_table_changes expects `tenant_id` and kit_usages uses `clinic_id`, instead OMIT this trigger and rely on logBusinessEvent in Plan 04 — verify the function's column expectation by reading 20260606000100_financial_tables.sql trigger usage; if it reads NEW.tenant_id, DO NOT attach (kit_usages uses clinic_id). Default to NOT attaching the trigger and rely on logBusinessEvent (safe choice — financial_transactions uses tenant_id, kit_usages uses clinic_id).
  - CRITICAL: do NOT touch `public.appointments`, its GIST `no_overlap`, or `public.financial_transactions`.

Create `supabase/migrations/20260619000200_sterilization_rls.sql`:
  - `ALTER TABLE public.sterilization_cycles ENABLE ROW LEVEL SECURITY;`
    SELECT: `CREATE POLICY "sterilization_cycles_select" ON public.sterilization_cycles FOR SELECT USING (clinic_id = get_my_tenant_id());`
    Write: `CREATE POLICY "sterilization_cycles_write" ON public.sterilization_cycles FOR ALL USING (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin','dentist','receptionist')) WITH CHECK (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin','dentist','receptionist'));`  (the clinical TEAM records cycles — recepção/auxiliar incluída; the authoritative role gate is also re-checked in the action.)
  - `ALTER TABLE public.kit_usages ENABLE ROW LEVEL SECURITY;`
    SELECT: `CREATE POLICY "kit_usages_select" ON public.kit_usages FOR SELECT USING (clinic_id = get_my_tenant_id());`
    Write: `CREATE POLICY "kit_usages_write" ON public.kit_usages FOR ALL USING (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin','dentist','receptionist')) WITH CHECK (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin','dentist','receptionist'));`
  - NOTE: RLS guarantees tenant isolation; the patient-safety BLOCK (non-aprovado/vencido) is NOT an RLS rule (RLS cannot read validade-vs-today cleanly) — it is enforced in the Server Action (Plan 04). RLS here is the tenant boundary only.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/esterilizacao/migrations-phase13-cme.test.ts src/__tests__/esterilizacao/regression-guard-phase13.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - migrations-phase13-cme.test.ts turns GREEN: sterilization_cycles + kit_usages tables, autoclave_id REFERENCES public.resources(id), biological_result + status CHECK sets, clinic_id/unit_id + cycle/patient indexes, RLS USING+WITH CHECK all asserted present.
    - regression-guard-phase13.test.ts stays GREEN (no DROP CONSTRAINT no_overlap / ALTER appointments / financial_transactions drop in the new SQL).
    - `20260619000100_sterilization_cycles.sql` contains `REFERENCES public.resources(id)` and does NOT contain `CREATE TABLE public.autoclaves` (D-01 reuse).
  </acceptance_criteria>
  <done>Two CME migrations exist; sterilization_cycles (autoclave→resources) + kit_usages + RLS USING+WITH CHECK + indexes; CME migration asserts GREEN; appointments GIST + financial untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: cycle-status pure lib (block-guard logic) + sterilization Zod schemas</name>
  <files>src/lib/esterilizacao/cycle-status.ts, src/lib/validators/sterilization.ts</files>
  <behavior>
    - isCycleUsable: usable=false + reason 'indicador biológico reprovado' when biologicalResult==='reprovado'; usable=false + reason 'indicador biológico pendente' when 'pendente'; usable=false + reason 'ciclo vencido' when aprovado AND validade < referenceDate; usable=true + reason null when aprovado AND (validade===null OR validade>=referenceDate); never throws on null validade
    - deriveCycleStatus: 'reprovado'→'reprovado'; 'pendente'→'pendente'; 'aprovado' + past validade → 'vencido'; 'aprovado' + future/today/null validade → 'aprovado'
    - sterilizationCycleSchema: validates autoclave_id uuid, temperatura/tempo_minutos/pressao optional numbers, biological_result enum (3), cycle_date + validade ISO date strings (validade optional), unit_id optional uuid; NO .default()
    - kitUsageSchema: validates sterilization_cycle_id uuid, patient_id uuid, appointment_id optional uuid, kit_label optional; NO .default()
  </behavior>
  <read_first>
    - src/__tests__/esterilizacao/cycle-status.test.ts (deriveCycleStatus cases)
    - src/__tests__/esterilizacao/kit-block-guard.test.ts (the six isCycleUsable cases + the reason substrings + the no-server-only source assert)
    - src/lib/validators/resource.ts (Zod v3 pattern WITHOUT .default() — D-133; enum + uuid idiom)
  </read_first>
  <action>
Create `src/lib/esterilizacao/cycle-status.ts` (PURE — NO `'use server'`, NO `import 'server-only'`, NO Supabase):
  - Export `type BiologicalResult = 'pendente' | 'aprovado' | 'reprovado'` and `type CycleStatus = 'aprovado' | 'reprovado' | 'vencido'`.
  - Date compare helper: `const today = () => new Date().toISOString().slice(0,10)` and compare ISO date strings lexicographically (ISO `YYYY-MM-DD` sorts chronologically) — `const isExpired = (validade: string | null, ref: string) => validade !== null && validade < ref`.
  - `export function deriveCycleStatus({ biologicalResult, validade, referenceDate }): CycleStatus | 'pendente'`: `const ref = referenceDate ?? today()`. If `biologicalResult === 'reprovado'` return `'reprovado'`. If `biologicalResult === 'pendente'` return `'pendente'`. (aprovado:) if `isExpired(validade, ref)` return `'vencido'` else return `'aprovado'`.
  - `export function isCycleUsable({ biologicalResult, validade, referenceDate }): { usable: boolean; reason: string | null }`: `const ref = referenceDate ?? today()`. If `biologicalResult === 'reprovado'` return `{ usable:false, reason:'Ciclo com indicador biológico reprovado — uso bloqueado' }`. If `biologicalResult === 'pendente'` return `{ usable:false, reason:'Indicador biológico pendente — ciclo ainda não aprovado para uso' }`. If `isExpired(validade, ref)` return `{ usable:false, reason:'Ciclo vencido (validade expirada) — uso bloqueado' }`. Return `{ usable:true, reason:null }`. Never throw.

Create `src/lib/validators/sterilization.ts` (Zod v3, NO `.default()`):
  - `export const sterilizationCycleSchema = z.object({ autoclave_id: z.string().uuid(), unit_id: z.string().uuid().optional(), cycle_number: z.string().max(100).optional(), temperatura: z.number().nonnegative().optional(), tempo_minutos: z.number().int().nonnegative().optional(), pressao: z.number().nonnegative().optional(), biological_result: z.enum(['pendente','aprovado','reprovado']), cycle_date: z.string().min(8), validade: z.string().min(8).optional(), operator_id: z.string().uuid().optional(), notes: z.string().max(2000).optional() })`. Export `type SterilizationCycleInput = z.infer<typeof sterilizationCycleSchema>`.
  - `export const kitUsageSchema = z.object({ sterilization_cycle_id: z.string().uuid(), patient_id: z.string().uuid(), appointment_id: z.string().uuid().optional(), unit_id: z.string().uuid().optional(), kit_label: z.string().max(200).optional() })`. Export `type KitUsageInput = z.infer<typeof kitUsageSchema>`.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/esterilizacao/cycle-status.test.ts src/__tests__/esterilizacao/kit-block-guard.test.ts && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - cycle-status.test.ts + kit-block-guard.test.ts all GREEN (six isCycleUsable cases + deriveCycleStatus cases; reason substrings 'reprovado'/'pendente'/'vencido' present).
    - `src/lib/esterilizacao/cycle-status.ts` contains NO `'use server'` and NO `server-only` (grep returns nothing — client-importable).
    - `src/lib/validators/sterilization.ts` exports sterilizationCycleSchema + kitUsageSchema and contains NO `.default(` (grep).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>cycle-status.ts exports the pure block-guard logic; sterilization.ts exports both Zod schemas (no .default); CME logic suites GREEN; tsc clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → sterilization_cycles / kit_usages | RLS isolates tenants (clinic_id = get_my_tenant_id() USING + WITH CHECK); clinical-team roles only may write |
| kit-usage block decision | the PURE isCycleUsable encodes the CME-02 rule; RLS CANNOT express validade-vs-today, so the authoritative block is the Server Action (Plan 04) — this plan only ships the logic + tenant RLS |
| cycle parameters input | Zod-validated (biological_result enum, numeric params) before the action persists |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-04 | Information Disclosure | cross-tenant cycle/kit-usage read | mitigate | RLS `clinic_id = get_my_tenant_id()` USING + WITH CHECK on both tables; clinic_id indexed |
| T-13-05 | Elevation of Privilege | non-team role writing cycles/usages | mitigate | write policy gated to admin/superadmin/dentist/receptionist; re-checked in the action (Plan 04) |
| T-13-06 | Spoofing | a reprovado/vencido cycle treated as usable | mitigate | isCycleUsable returns usable=false for non-aprovado OR validade<today; PURE + unit-tested; authoritative enforcement in Plan 04 action |
| T-13-07 | Tampering | accidental GIST / financial schema change | accept | these migrations only ADD tables; Plan 01 regression guard asserts no DROP CONSTRAINT no_overlap / ALTER appointments / financial drop |
</threat_model>

<verification>
- `npx vitest run src/__tests__/esterilizacao/` GREEN (migration + cycle-status + kit-block-guard + regression).
- `npx tsc --noEmit` clean.
- Existing suites unaffected.
</verification>

<success_criteria>
- sterilization_cycles (autoclave→resources, D-01) + kit_usages (lote↔paciente, CME-03) + RLS USING+WITH CHECK + indexes.
- isCycleUsable PURE block-guard logic (CME-02) + deriveCycleStatus; Zod schemas (no .default).
- tsc green; GIST + financial_transactions intact.
</success_criteria>

<output>
After completion, create `.planning/phases/13-esteriliza-o-cme-laborat-rio-de-pr-tese/13-02-SUMMARY.md`
</output>
