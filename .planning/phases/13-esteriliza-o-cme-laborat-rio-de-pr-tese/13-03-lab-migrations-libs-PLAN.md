---
phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese
plan: 03
type: execute
wave: 1
depends_on: [01]
files_modified:
  - supabase/migrations/20260619000300_prosthetic_labs.sql
  - supabase/migrations/20260619000400_lab_orders_rls.sql
  - src/lib/protese/lab-cost.ts
  - src/lib/validators/lab-order.ts
autonomous: true
requirements: [LAB-01, LAB-02]
tags: [protese, lab, migration, database, financial, rls, lab-order]

must_haves:
  truths:
    - "prosthetic_labs table exists (reusable supplier: nome, contato, deleted_at) with RLS USING+WITH CHECK + clinic_id index"
    - "lab_orders table exists: clinic_id (+unit_id), lab_id FK→prosthetic_labs, patient_id, appointment_id?, prosthesis_type, due_date, stages JSONB, status CHECK (enviado/prova/concluido), cost, financial_transaction_id (links the LAB-02 expense), deleted_at — with RLS USING+WITH CHECK + indexes"
    - "buildLabExpenseDescription + isCostPostable are PURE helpers (no 'use server'/server-only)"
    - "labSchema (lab CRUD) + labOrderSchema (Zod v3, NO .default()) validate the supplier + the OS (tipo/lab/prazo/etapas/status/custo)"
  artifacts:
    - path: "supabase/migrations/20260619000300_prosthetic_labs.sql"
      provides: "prosthetic_labs + lab_orders tables + indexes (incl. financial_transaction_id link)"
      contains: "CREATE TABLE public.lab_orders"
    - path: "supabase/migrations/20260619000400_lab_orders_rls.sql"
      provides: "RLS USING+WITH CHECK for prosthetic_labs + lab_orders"
      contains: "ENABLE ROW LEVEL SECURITY"
    - path: "src/lib/protese/lab-cost.ts"
      provides: "buildLabExpenseDescription + isCostPostable pure helpers"
      exports: ["buildLabExpenseDescription", "isCostPostable"]
    - path: "src/lib/validators/lab-order.ts"
      provides: "Zod v3 labSchema + labOrderSchema (no .default)"
      exports: ["labSchema", "labOrderSchema"]
  key_links:
    - from: "src/actions/lab-orders.ts (Plan 04)"
      to: "lab_orders.financial_transaction_id + financial_transactions"
      via: "insert lab_order → insert despesa financial_transactions → backfill financial_transaction_id"
      pattern: "financial_transaction_id|financial_transactions"
---

<objective>
Build the Laboratório de Prótese data + logic foundation: (1) the `prosthetic_labs` table (reusable supplier — D-03); (2) the `lab_orders` table (the OS protética: tipo, lab, prazo, `stages` JSONB for the etapas de prova, `status` enviado→prova→concluído, `cost`, and a `financial_transaction_id` column that links the LAB-02 expense posting back to the OS — D-04); (3) RLS USING+WITH CHECK + clinic_id/unit_id indexes; (4) the PURE `lab-cost.ts` helpers (`buildLabExpenseDescription` + `isCostPostable`); (5) the Zod v3 schemas for the lab + the OS.

Purpose: Make the OS protética model + the financial-link column real so Plan 04's Server Action can open an OS and, when a cost is set, create a `despesa` row in `financial_transactions` (Fase 3) and backfill `lab_orders.financial_transaction_id` (LAB-02 delivered for real now; Fase 16 evolves the contas-a-pagar management on top). The `financial_transactions` table itself is NOT modified — the action only INSERTs a row. The `appointments` GIST is NOT touched.
Output: 2 migrations + 1 pure lib + 1 Zod validator. Turns lab-cost.test.ts + migrations-phase13-lab.test.ts GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/13-esteriliza-o-cme-laborat-rio-de-pr-tese/13-CONTEXT.md
@supabase/migrations/20260606000100_financial_tables.sql
@supabase/migrations/20260618000100_clinical_documents.sql
@supabase/migrations/20260617000400_resources_rls.sql
@src/lib/validators/resource.ts
@src/__tests__/protese/migrations-phase13-lab.test.ts

<interfaces>
<!-- Contracts the executor implements against. -->

RLS helpers: `get_my_tenant_id()` / `get_my_role()`.
FK targets that exist: `public.clinics(id)`, `public.units(id)`, `public.patients(id)`, `public.appointments(id)`, `public.users(id)`, `public.financial_transactions(id)`.

CRITICAL — financial_transactions column names (from 20260606000100_financial_tables.sql): it uses `tenant_id` (NOT clinic_id), `category_id` (FK→financial_categories), `type` CHECK ('receita','despesa'), `amount NUMERIC(12,2)`, `description`, `transaction_date DATE`, `posted_by`. The LAB expense in Plan 04 inserts `{ tenant_id, type:'despesa', amount, description, transaction_date, category_id?, posted_by }`. THIS plan only adds the `financial_transaction_id` FK column on lab_orders so the action can backfill it — it does NOT alter financial_transactions.

lab-cost.ts exact signatures (lab-cost.test.ts asserts):
```typescript
export function buildLabExpenseDescription(params: {
  labName: string; prosthesisType: string; orderNumber: string
}): string   // must include orderNumber, prosthesisType, labName
export function isCostPostable(cost: number | null): boolean  // true iff cost != null && cost > 0
```

Zod v3: NO `.default()` (D-133).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: LAB migrations — prosthetic_labs + lab_orders (+financial link) + RLS</name>
  <files>supabase/migrations/20260619000300_prosthetic_labs.sql, supabase/migrations/20260619000400_lab_orders_rls.sql</files>
  <read_first>
    - supabase/migrations/20260606000100_financial_tables.sql (financial_transactions uses tenant_id NOT clinic_id — the lab_orders.financial_transaction_id FK targets financial_transactions(id); DO NOT alter that table)
    - supabase/migrations/20260618000100_clinical_documents.sql (recent table style: patient_id/appointment_id FKs, JSONB-able columns, deleted_at, partial unit_id index)
    - supabase/migrations/20260617000400_resources_rls.sql (USING + WITH CHECK + role-gate idiom)
    - src/__tests__/protese/migrations-phase13-lab.test.ts (the exact substrings the source-inspection asserts)
  </read_first>
  <action>
Create `supabase/migrations/20260619000300_prosthetic_labs.sql`:
  - `CREATE TABLE public.prosthetic_labs (`
    `id UUID PRIMARY KEY DEFAULT gen_random_uuid(),`
    `clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,`
    `nome TEXT NOT NULL,`
    `cnpj TEXT,`
    `contato_nome TEXT,`
    `telefone TEXT,`
    `email TEXT,`
    `notes TEXT,`
    `created_at TIMESTAMPTZ NOT NULL DEFAULT now(),`
    `updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),`
    `deleted_at TIMESTAMPTZ`
    `);`
  - `CREATE INDEX idx_prosthetic_labs_clinic ON public.prosthetic_labs(clinic_id);`
  - `CREATE TABLE public.lab_orders (`
    `id UUID PRIMARY KEY DEFAULT gen_random_uuid(),`
    `clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,`
    `unit_id UUID REFERENCES public.units(id),`
    `lab_id UUID NOT NULL REFERENCES public.prosthetic_labs(id),`
    `patient_id UUID NOT NULL REFERENCES public.patients(id),`
    `appointment_id UUID REFERENCES public.appointments(id),`
    `order_number TEXT,`                                            -- optional human label OS-YYYY-####
    `prosthesis_type TEXT NOT NULL,`                                -- tipo de prótese (free text — coroa, ppr, protocolo...)
    `due_date DATE,`                                                -- prazo previsto
    `stages JSONB NOT NULL DEFAULT '[]'::jsonb,`                    -- etapas de prova: [{ nome, prevista, concluida_em }]
    `status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','prova','concluido')),`
    `cost NUMERIC(12,2),`                                           -- custo do lab; quando definido → gera despesa (LAB-02)
    `financial_transaction_id UUID REFERENCES public.financial_transactions(id),`  -- D-04: links the despesa back to the OS
    `notes TEXT,`
    `created_by UUID REFERENCES public.users(id),`
    `created_at TIMESTAMPTZ NOT NULL DEFAULT now(),`
    `updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),`
    `deleted_at TIMESTAMPTZ`
    `);`
  - Indexes: `CREATE INDEX idx_lab_orders_clinic ON public.lab_orders(clinic_id);` `CREATE INDEX idx_lab_orders_lab ON public.lab_orders(lab_id);` `CREATE INDEX idx_lab_orders_patient ON public.lab_orders(patient_id);` `CREATE INDEX idx_lab_orders_status ON public.lab_orders(clinic_id, status);` `CREATE INDEX idx_lab_orders_unit ON public.lab_orders(unit_id) WHERE unit_id IS NOT NULL;` `CREATE INDEX idx_lab_orders_fin_txn ON public.lab_orders(financial_transaction_id) WHERE financial_transaction_id IS NOT NULL;`
  - CRITICAL: do NOT `ALTER TABLE public.financial_transactions`, do NOT touch `public.appointments` / its GIST. The link is a FK column ON lab_orders pointing AT financial_transactions(id).

Create `supabase/migrations/20260619000400_lab_orders_rls.sql`:
  - `ALTER TABLE public.prosthetic_labs ENABLE ROW LEVEL SECURITY;`
    SELECT: `CREATE POLICY "prosthetic_labs_select" ON public.prosthetic_labs FOR SELECT USING (clinic_id = get_my_tenant_id());`
    Write: `CREATE POLICY "prosthetic_labs_write" ON public.prosthetic_labs FOR ALL USING (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin','dentist')) WITH CHECK (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin','dentist'));`
  - `ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;`
    SELECT: `CREATE POLICY "lab_orders_select" ON public.lab_orders FOR SELECT USING (clinic_id = get_my_tenant_id());`
    Write: `CREATE POLICY "lab_orders_write" ON public.lab_orders FOR ALL USING (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin','dentist')) WITH CHECK (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin','dentist'));`
  - NOTE: the despesa INSERT in financial_transactions (Plan 04) is gated by the EXISTING financial_transactions RLS (tenant_id = get_my_tenant_id() + admin write) — the action uses the authenticated client so that policy applies; this plan adds NO financial_transactions policy.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/protese/migrations-phase13-lab.test.ts src/__tests__/esterilizacao/regression-guard-phase13.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - migrations-phase13-lab.test.ts turns GREEN: prosthetic_labs + lab_orders tables, lab_id REFERENCES public.prosthetic_labs(id), status CHECK (enviado/prova/concluido), clinic_id/lab/patient indexes, RLS USING+WITH CHECK, and the financial link (financial_transaction_id REFERENCES public.financial_transactions(id)) all asserted present.
    - regression-guard-phase13.test.ts stays GREEN — `20260619000300_prosthetic_labs.sql` contains NO `ALTER TABLE public.financial_transactions` and NO `ALTER TABLE public.appointments`.
    - lab_orders contains `financial_transaction_id UUID REFERENCES public.financial_transactions(id)` and `stages JSONB`.
  </acceptance_criteria>
  <done>Two LAB migrations exist; prosthetic_labs + lab_orders (+financial_transaction_id link) + RLS USING+WITH CHECK + indexes; LAB migration asserts GREEN; financial_transactions + appointments GIST untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: lab-cost pure helpers + lab/lab-order Zod schemas</name>
  <files>src/lib/protese/lab-cost.ts, src/lib/validators/lab-order.ts</files>
  <behavior>
    - isCostPostable: false for null, 0, negative; true for positive number
    - buildLabExpenseDescription: returns a pt-BR string containing the orderNumber, the prosthesisType, and the labName
    - labSchema: validates nome (required), optional cnpj/contato_nome/telefone/email/notes; NO .default()
    - labOrderSchema: validates lab_id uuid, patient_id uuid, prosthesis_type (required), optional appointment_id uuid + due_date + cost (nonnegative) + order_number + notes, status enum (enviado/prova/concluido), stages array of { nome, prevista?, concluida_em? }; NO .default()
  </behavior>
  <read_first>
    - src/__tests__/protese/lab-cost.test.ts (the exact isCostPostable + buildLabExpenseDescription cases + the substrings asserted)
    - src/lib/validators/resource.ts (Zod v3 enum + uuid + optional idiom WITHOUT .default() — D-133)
  </read_first>
  <action>
Create `src/lib/protese/lab-cost.ts` (PURE — NO `'use server'`, NO `server-only`):
  - `export function isCostPostable(cost: number | null): boolean { return cost !== null && cost > 0 }`.
  - `export function buildLabExpenseDescription({ labName, prosthesisType, orderNumber }: { labName: string; prosthesisType: string; orderNumber: string }): string { return `OS protética ${orderNumber} — ${prosthesisType} (${labName})` }`.

Create `src/lib/validators/lab-order.ts` (Zod v3, NO `.default()`):
  - `export const labSchema = z.object({ nome: z.string().min(1).max(200), cnpj: z.string().max(20).optional(), contato_nome: z.string().max(200).optional(), telefone: z.string().max(40).optional(), email: z.string().email().max(200).optional().or(z.literal('')), notes: z.string().max(2000).optional() })`. Export `type LabInput = z.infer<typeof labSchema>`.
  - `export const labStageSchema = z.object({ nome: z.string().min(1).max(200), prevista: z.string().min(8).optional(), concluida_em: z.string().min(8).optional() })`.
  - `export const labOrderSchema = z.object({ lab_id: z.string().uuid(), patient_id: z.string().uuid(), appointment_id: z.string().uuid().optional(), unit_id: z.string().uuid().optional(), prosthesis_type: z.string().min(1).max(200), order_number: z.string().max(100).optional(), due_date: z.string().min(8).optional(), status: z.enum(['enviado','prova','concluido']), stages: z.array(labStageSchema).optional(), cost: z.number().nonnegative().optional(), notes: z.string().max(2000).optional() })`. Export `type LabOrderInput = z.infer<typeof labOrderSchema>`.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/protese/lab-cost.test.ts && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - lab-cost.test.ts GREEN: isCostPostable(0/null/-5)===false, isCostPostable(120.5)===true; buildLabExpenseDescription output includes orderNumber + prosthesisType + labName.
    - `src/lib/protese/lab-cost.ts` contains NO `'use server'`/`server-only` (grep — client-importable).
    - `src/lib/validators/lab-order.ts` exports labSchema + labOrderSchema and contains NO `.default(` (grep).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>lab-cost.ts exports the pure helpers; lab-order.ts exports labSchema + labOrderSchema (no .default); lab-cost suite GREEN; tsc clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → prosthetic_labs / lab_orders | RLS isolates tenants (clinic_id = get_my_tenant_id() USING + WITH CHECK); admin/dentist write only |
| lab_orders → financial_transactions | the despesa is created via the AUTHENTICATED client so the existing financial_transactions RLS (tenant_id = get_my_tenant_id() + admin write) applies; the lab_orders.financial_transaction_id FK ties the expense to the OS within the same tenant |
| cost / OS input | Zod-validated (status enum, cost nonnegative) before the action persists |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-08 | Information Disclosure | cross-tenant lab/OS read | mitigate | RLS `clinic_id = get_my_tenant_id()` USING + WITH CHECK on prosthetic_labs + lab_orders; clinic_id indexed |
| T-13-09 | Elevation of Privilege | non-clinical role opening OS | mitigate | write policy gated to admin/superadmin/dentist; re-checked in the action (Plan 04) |
| T-13-10 | Tampering | LAB expense posted to another tenant's cash flow | mitigate | despesa inserted via authenticated client → financial_transactions RLS (tenant_id = get_my_tenant_id()) + WITH CHECK enforces same-tenant scope; financial_transaction_id FK is within-tenant |
| T-13-11 | Tampering | accidental financial_transactions / GIST schema change | accept | LAB migrations only ADD tables + a FK column ON lab_orders; Plan 01 regression guard asserts no ALTER financial_transactions / appointments |
</threat_model>

<verification>
- `npx vitest run src/__tests__/protese/` GREEN (migration + lab-cost); regression guard GREEN.
- `npx tsc --noEmit` clean.
- Existing suites unaffected.
</verification>

<success_criteria>
- prosthetic_labs + lab_orders (status enviado/prova/concluido, stages JSONB, financial_transaction_id link — D-03/D-04) + RLS USING+WITH CHECK + indexes.
- isCostPostable + buildLabExpenseDescription PURE; labSchema + labOrderSchema (no .default).
- tsc green; financial_transactions + GIST intact.
</success_criteria>

<output>
After completion, create `.planning/phases/13-esteriliza-o-cme-laborat-rio-de-pr-tese/13-03-SUMMARY.md`
</output>
