---
phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - src/__tests__/esterilizacao/cycle-status.test.ts
  - src/__tests__/esterilizacao/kit-block-guard.test.ts
  - src/__tests__/esterilizacao/migrations-phase13-cme.test.ts
  - src/__tests__/protese/lab-cost.test.ts
  - src/__tests__/protese/migrations-phase13-lab.test.ts
  - src/__tests__/esterilizacao/regression-guard-phase13.test.ts
autonomous: true
requirements: [CME-01, CME-02, CME-03, LAB-01, LAB-02]
tags: [esterilizacao, protese, tests, red, scaffold, tdd, migration]

must_haves:
  truths:
    - "RED test files exist for: cycle status derivation (vencido), the kit-usage block guard, the CME migrations source-inspection, the lab-cost helper, the LAB migrations source-inspection, and a Phase 11/3/2 regression guard"
    - "Every dynamic import of a not-yet-existing module uses an ABSOLUTE path + existsSync guard so tsc stays at exit 0 (D-144 — @-alias causes TS2307 before the target exists)"
    - "The regression guard asserts the appointments GIST (no_overlap) + status CHECK and financial_transactions structure are NOT touched by any Phase 13 migration"
  artifacts:
    - path: "src/__tests__/esterilizacao/kit-block-guard.test.ts"
      provides: "RED cases for the patient-safety block guard (CME-02): reject non-aprovado, reject vencido"
      contains: "isCycleUsable"
    - path: "src/__tests__/esterilizacao/migrations-phase13-cme.test.ts"
      provides: "source-inspection asserts for sterilization_cycles + kit_usages migrations + RLS"
      contains: "sterilization_cycles"
    - path: "src/__tests__/protese/migrations-phase13-lab.test.ts"
      provides: "source-inspection asserts for prosthetic_labs + lab_orders migrations + RLS"
      contains: "lab_orders"
    - path: "src/__tests__/esterilizacao/regression-guard-phase13.test.ts"
      provides: "guard that no Phase 13 migration drops the GIST / alters appointments / mutates financial_transactions schema"
      contains: "no_overlap"
  key_links:
    - from: "src/__tests__/esterilizacao/kit-block-guard.test.ts"
      to: "src/lib/esterilizacao/cycle-status.ts (Plan 02)"
      via: "absolute-path dynamic import + existsSync guard"
      pattern: "isCycleUsable|deriveCycleStatus"
---

<objective>
Write the RED test scaffolds for Phase 13 (Esterilização/CME + Laboratório de Prótese) so the Wave 1/2 plans have failing tests to turn GREEN. This is the test-first foundation: pure-logic unit tests (cycle status derivation + the kit-usage block guard + lab cost helper) and source-inspection tests for the four new migrations and the regression guard.

Purpose: Lock the contracts before implementation. The kit-usage block guard (CME-02) is a patient-safety control — its RED cases (reject a cycle that is not `aprovado`, reject a cycle whose `validade < hoje`) MUST exist before the guard is written so the GREEN transition proves the control. All not-yet-existing modules are imported via absolute path + `existsSync` guard so `tsc --noEmit` stays at exit 0 while the targets are empty (D-144).
Output: 6 test files (all RED / skipped-via-guard), tsc green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/13-esteriliza-o-cme-laborat-rio-de-pr-tese/13-CONTEXT.md
@src/__tests__/receituario/migrations-phase12-rx.test.ts
@src/__tests__/teleodontologia/migrations-phase12-tel.test.ts

<interfaces>
<!-- Contracts the scaffolds assert against. The Wave 1/2 plans implement these exactly. -->

cycle-status pure lib (Plan 02) — `src/lib/esterilizacao/cycle-status.ts` (PURE, NO 'use server', NO server-only):
```typescript
export type BiologicalResult = 'pendente' | 'aprovado' | 'reprovado'
export type CycleStatus = 'aprovado' | 'reprovado' | 'vencido'
// derive the effective status from biological indicator + validade vs a reference date
export function deriveCycleStatus(params: {
  biologicalResult: BiologicalResult
  validade: string | null   // ISO date 'YYYY-MM-DD'
  referenceDate?: string    // ISO date; defaults to today
}): CycleStatus | 'pendente'
// the block guard (CME-02): a cycle is usable ONLY if status === 'aprovado' AND not expired
export function isCycleUsable(params: {
  biologicalResult: BiologicalResult
  validade: string | null
  referenceDate?: string
}): { usable: boolean; reason: string | null }
```
Cases the scaffold asserts:
- biologicalResult 'reprovado' → isCycleUsable.usable === false, reason mentions 'reprovado'
- biologicalResult 'pendente' → usable === false, reason mentions 'indicador biológico pendente'
- biologicalResult 'aprovado' + validade in the past → usable === false, reason mentions 'vencido'
- biologicalResult 'aprovado' + validade today or future → usable === true, reason === null
- biologicalResult 'aprovado' + validade === null → treat as usable (no expiry set) — usable === true
- deriveCycleStatus 'aprovado' + past validade → 'vencido'

lab-cost helper (Plan 03) — `src/lib/protese/lab-cost.ts` (PURE):
```typescript
export function buildLabExpenseDescription(params: {
  labName: string; prosthesisType: string; orderNumber: string
}): string   // e.g. 'OS protética OS-2026-0007 — Coroa metalocerâmica (Lab Dental X)'
export function isCostPostable(cost: number | null): boolean  // true iff cost != null && cost > 0
```

Migration source-inspection (Plans 02/03) assert files exist under supabase/migrations matching the 20260619000* prefix and contain the table/column/CHECK/index/REVOKE/RLS strings (mirror migrations-phase12-rx.test.ts which reads the .sql file text and asserts substrings).

Regression guard: read ALL Phase 13 .sql files (20260619000*) and assert NONE contain `DROP CONSTRAINT no_overlap`, `ALTER TABLE public.appointments`, or `ALTER TABLE public.financial_transactions ... DROP`/column-type changes. Mirror the regression block in migrations-phase12-rx.test.ts.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: RED pure-logic scaffolds — cycle-status, kit-block-guard, lab-cost</name>
  <files>src/__tests__/esterilizacao/cycle-status.test.ts, src/__tests__/esterilizacao/kit-block-guard.test.ts, src/__tests__/protese/lab-cost.test.ts</files>
  <read_first>
    - src/__tests__/receituario/migrations-phase12-rx.test.ts (the absolute-path dynamic import + existsSync guard idiom; the describe/it structure; the regression block to mirror)
    - .planning/phases/13-esteriliza-o-cme-laborat-rio-de-pr-tese/13-CONTEXT.md §decisions (D-01/D-02 — biological indicator results + block on non-aprovado OR vencido)
  </read_first>
  <action>
Create `src/__tests__/esterilizacao/cycle-status.test.ts`:
  - At the top: `import { existsSync } from 'node:fs'`; compute `const MOD = 'C:/Users/Reinaldo - Local/Desktop/Cowork/FYNXIA/src/lib/esterilizacao/cycle-status.ts'` using `path.resolve(process.cwd(), 'src/lib/esterilizacao/cycle-status.ts')` (use process.cwd() — do NOT hardcode the absolute string; portable). Guard: `const has = existsSync(MOD)`.
  - `describe('deriveCycleStatus', () => { ... })` with `it.skipIf(!has)` (or `if (!has) it.skip(...)`) cases: dynamically `await import(MOD)` then assert: `deriveCycleStatus({ biologicalResult:'aprovado', validade:'2020-01-01', referenceDate:'2026-06-19' }) === 'vencido'`; `deriveCycleStatus({ biologicalResult:'aprovado', validade:'2027-01-01', referenceDate:'2026-06-19' }) === 'aprovado'`; `deriveCycleStatus({ biologicalResult:'reprovado', validade:'2027-01-01' }) === 'reprovado'`; `deriveCycleStatus({ biologicalResult:'pendente', validade:null }) === 'pendente'`.
  - Use `path` import at top: `import path from 'node:path'`.

Create `src/__tests__/esterilizacao/kit-block-guard.test.ts` (the patient-safety control — CME-02):
  - Same existsSync/absolute-path guard against `src/lib/esterilizacao/cycle-status.ts`.
  - `describe('isCycleUsable (block guard — CME-02)')` cases (skipIf !has, dynamic import):
    1. `isCycleUsable({ biologicalResult:'reprovado', validade:'2027-01-01' })` → `.usable === false` and `.reason` includes `'reprovado'`.
    2. `isCycleUsable({ biologicalResult:'pendente', validade:'2027-01-01' })` → `.usable === false` and `.reason` includes `'pendente'`.
    3. `isCycleUsable({ biologicalResult:'aprovado', validade:'2020-01-01', referenceDate:'2026-06-19' })` → `.usable === false` and `.reason` includes `'vencido'`.
    4. `isCycleUsable({ biologicalResult:'aprovado', validade:'2026-06-19', referenceDate:'2026-06-19' })` → `.usable === true` and `.reason === null` (validade === referenceDate is still valid — expiry is `validade < hoje`).
    5. `isCycleUsable({ biologicalResult:'aprovado', validade:'2027-01-01', referenceDate:'2026-06-19' })` → `.usable === true`.
    6. `isCycleUsable({ biologicalResult:'aprovado', validade:null })` → `.usable === true` (no expiry recorded).
  - Add a source-inspection assert: read the file text (when `has`) and assert it does NOT contain `'use server'` nor `server-only` (the guard logic must stay pure + client-importable).

Create `src/__tests__/protese/lab-cost.test.ts`:
  - existsSync/absolute-path guard against `src/lib/protese/lab-cost.ts`.
  - cases (skipIf !has, dynamic import): `isCostPostable(0) === false`; `isCostPostable(null) === false`; `isCostPostable(-5) === false`; `isCostPostable(120.5) === true`; `buildLabExpenseDescription({ labName:'Lab Dental X', prosthesisType:'Coroa metalocerâmica', orderNumber:'OS-2026-0007' })` returns a string that includes `'OS-2026-0007'`, `'Coroa metalocerâmica'`, and `'Lab Dental X'`.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/esterilizacao/cycle-status.test.ts src/__tests__/esterilizacao/kit-block-guard.test.ts src/__tests__/protese/lab-cost.test.ts && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - All three files exist; each uses `existsSync` + `path.resolve(process.cwd(), ...)` (grep: `process.cwd()` AND `existsSync` present in each).
    - kit-block-guard.test.ts contains the six `isCycleUsable` cases (grep: `isCycleUsable` appears ≥6 times) AND asserts the target has no `'use server'`/`server-only`.
    - `npx tsc --noEmit` exits 0 (modules not yet existing do not break compile — dynamic import + guard).
    - Suites run with cases skipped (targets absent) — vitest exits 0 with skipped tests, no failures.
  </acceptance_criteria>
  <done>cycle-status, kit-block-guard, lab-cost RED scaffolds exist; absolute-path+existsSync guard; tsc green; vitest green (skipped).</done>
</task>

<task type="auto">
  <name>Task 2: RED migration source-inspection + regression guard scaffolds</name>
  <files>src/__tests__/esterilizacao/migrations-phase13-cme.test.ts, src/__tests__/protese/migrations-phase13-lab.test.ts, src/__tests__/esterilizacao/regression-guard-phase13.test.ts</files>
  <read_first>
    - src/__tests__/receituario/migrations-phase12-rx.test.ts (how it locates the .sql file via fs.readdirSync on supabase/migrations + asserts substrings + the GIST regression block — mirror exactly)
    - supabase/migrations/20260617000300_resources.sql (the resources table shape the autoclave FK points at — assert sterilization_cycles references resources)
    - supabase/migrations/20260606000100_financial_tables.sql (financial_transactions uses tenant_id NOT clinic_id; the LAB migration must NOT alter it — regression guard asserts this)
  </read_first>
  <action>
Create `src/__tests__/esterilizacao/migrations-phase13-cme.test.ts`:
  - Helper: `const MIG_DIR = path.resolve(process.cwd(), 'supabase/migrations')`; `const files = fs.readdirSync(MIG_DIR).filter(f => f.startsWith('20260619000') && f.endsWith('.sql'))`; `const sql = files.map(f => fs.readFileSync(path.join(MIG_DIR,f),'utf8')).join('\n')`. Guard each `it` with `it.skipIf(files.length === 0)`.
  - Assert `sql` contains: `CREATE TABLE public.sterilization_cycles`; `autoclave_id` and `REFERENCES public.resources(id)`; `biological_result` with CHECK listing `'pendente'`, `'aprovado'`, `'reprovado'`; `status` CHECK listing `'aprovado'`, `'reprovado'`, `'vencido'`; columns `temperatura`, `tempo_minutos`, `pressao`, `validade`, `cycle_date`, `operator_id`, `deleted_at`; `clinic_id` and `unit_id`; `idx_sterilization_cycles_clinic`; `CREATE TABLE public.kit_usages`; kit_usages columns `sterilization_cycle_id`, `appointment_id`, `patient_id`, `clinic_id`; `ENABLE ROW LEVEL SECURITY` for both tables; `USING` and `WITH CHECK`; `idx_kit_usages_cycle` and `idx_kit_usages_patient`.

Create `src/__tests__/protese/migrations-phase13-lab.test.ts`:
  - Same MIG_DIR/files/sql helper + `it.skipIf(files.length === 0)`.
  - Assert `sql` contains: `CREATE TABLE public.prosthetic_labs` with `clinic_id`, `nome`, `deleted_at`; `idx_prosthetic_labs_clinic`; `CREATE TABLE public.lab_orders` with `lab_id` and `REFERENCES public.prosthetic_labs(id)`, `patient_id`, `appointment_id`, `prosthesis_type`, `due_date`, `stages`, `cost`, `status` CHECK listing `'enviado'`, `'prova'`, `'concluido'`, `clinic_id`, `unit_id`, `deleted_at`; `idx_lab_orders_clinic`, `idx_lab_orders_lab`, `idx_lab_orders_patient`; `ENABLE ROW LEVEL SECURITY` + `USING` + `WITH CHECK` for both tables; a column linking the financial transaction back to the order (assert lab_orders contains `financial_transaction_id` OR the LAB financial migration references `lab_order`).

Create `src/__tests__/esterilizacao/regression-guard-phase13.test.ts`:
  - Same MIG_DIR/files/sql helper.
  - Assert (always run, even with 0 files — empty string passes): `sql` does NOT contain `DROP CONSTRAINT no_overlap`; does NOT contain `ALTER TABLE public.appointments`; does NOT contain `DROP TABLE public.financial_transactions`; does NOT contain `ALTER TABLE public.financial_transactions DROP`; does NOT contain `ALTER COLUMN status` on appointments. (Mirror the Phase 12 regression block; use `expect(sql).not.toContain(...)`.)
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/esterilizacao/ src/__tests__/protese/ && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - Three files exist; each uses `fs.readdirSync` filtered on `20260619000` prefix (grep present in cme + lab + regression files).
    - migrations-phase13-cme.test.ts asserts `sterilization_cycles`, `kit_usages`, `REFERENCES public.resources(id)`, the two status/biological CHECK sets, and RLS USING+WITH CHECK (grep these substrings present as assertion args).
    - migrations-phase13-lab.test.ts asserts `prosthetic_labs`, `lab_orders`, the enviado/prova/concluido CHECK, and the financial link.
    - regression-guard-phase13.test.ts asserts `not.toContain('DROP CONSTRAINT no_overlap')` and `not.toContain('ALTER TABLE public.appointments')`.
    - `npx tsc --noEmit` exits 0; vitest exits 0 (CME/LAB asserts skipped until migrations exist; regression guard passes on empty set).
  </acceptance_criteria>
  <done>Three migration/regression scaffolds exist; prefix-filtered file read; CME+LAB asserts skipped pending migrations; regression guard green; tsc clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test scaffold → not-yet-existing modules | absolute-path dynamic import + existsSync guard keeps tsc at exit 0 (no untrusted runtime input — tests only) |
| RED guard → patient-safety control | kit-block-guard.test.ts encodes the CME-02 control contract BEFORE implementation, so the GREEN transition proves the guard exists |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-01 | Tampering | scaffold imports break the build (TS2307) before targets exist | mitigate | absolute-path (process.cwd()+resolve) dynamic import + existsSync skip guard (D-144) — tsc stays 0 |
| T-13-02 | Spoofing | patient-safety guard ships without test coverage | mitigate | kit-block-guard.test.ts encodes all six block cases as RED before Plan 04 writes the guard; GREEN proves the control |
| T-13-03 | Tampering | a Phase 13 migration silently alters the appointments GIST / financial_transactions | mitigate | regression-guard-phase13.test.ts asserts not.toContain DROP CONSTRAINT no_overlap / ALTER appointments / financial_transactions drops |
</threat_model>

<verification>
- `npx vitest run src/__tests__/esterilizacao/ src/__tests__/protese/` exits 0 (CME/LAB/pure cases skipped pending targets; regression guard passes).
- `npx tsc --noEmit` exits 0.
- No existing suite regressed.
</verification>

<success_criteria>
- 6 RED scaffolds exist: cycle-status, kit-block-guard (6 cases), lab-cost, CME migrations, LAB migrations, regression guard.
- All imports of not-yet-existing modules use absolute path + existsSync (tsc clean).
- The patient-safety block-guard contract is locked before implementation.
</success_criteria>

<output>
After completion, create `.planning/phases/13-esteriliza-o-cme-laborat-rio-de-pr-tese/13-01-SUMMARY.md`
</output>
