---
phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese
plan: 04
type: execute
wave: 2
depends_on: [02, 03]
files_modified:
  - src/actions/sterilization.ts
  - src/actions/lab-orders.ts
  - src/__tests__/esterilizacao/sterilization-action.test.ts
  - src/__tests__/protese/lab-order-action.test.ts
autonomous: true
requirements: [CME-01, CME-02, CME-03, LAB-01, LAB-02]
tags: [esterilizacao, protese, server-actions, block-guard, financial, audit, patient-safety]

must_haves:
  truths:
    - "registerSterilizationCycle validates Zod, role-gates, computes status via deriveCycleStatus, inserts the cycle tenant-scoped, logs the event (CME-01)"
    - "registerKitUsage is the PATIENT-SAFETY BLOCK: it re-fetches the cycle server-side, runs isCycleUsable, and REJECTS (no insert) when the cycle is not aprovado OR is vencido — the guard cannot be bypassed by a direct call because the check is in the action, not only the UI (CME-02); on success it links cycle→appointment→patient (CME-03) and logs"
    - "createLabOrder + setLabOrderCost: setting a postable cost creates a 'despesa' row in financial_transactions (tenant_id-scoped) and backfills lab_orders.financial_transaction_id (LAB-02); updateLabOrderStatus moves enviado→prova→concluido"
    - "Every mutation calls assertNotReadOnly + role gate + tenant scope + logBusinessEvent; financial_transactions + appointments GIST are never modified"
  artifacts:
    - path: "src/actions/sterilization.ts"
      provides: "registerSterilizationCycle + updateBiologicalResult + registerKitUsage (block guard) + listSterilizationCycles + getKitTraceability"
      exports: ["registerSterilizationCycle", "registerKitUsage"]
    - path: "src/actions/lab-orders.ts"
      provides: "createLab + createLabOrder + setLabOrderCost (financial posting) + updateLabOrderStatus + listLabOrders"
      exports: ["createLabOrder", "setLabOrderCost"]
  key_links:
    - from: "src/actions/sterilization.ts registerKitUsage"
      to: "isCycleUsable + sterilization_cycles re-fetch"
      via: "server-side re-fetch then isCycleUsable → reject if not usable"
      pattern: "isCycleUsable"
    - from: "src/actions/lab-orders.ts setLabOrderCost"
      to: "financial_transactions insert + lab_orders.financial_transaction_id backfill"
      via: "insert despesa then update lab_order"
      pattern: "financial_transactions|financial_transaction_id"
---

<objective>
Build the CME + LAB Server Action layer — the security-critical heart of the phase:
(1) `sterilization.ts`: `registerSterilizationCycle` (CME-01), `updateBiologicalResult` (set the indicator result + recompute status), `registerKitUsage` (CME-02 + CME-03 — the **patient-safety block guard**: re-fetch the cycle SERVER-SIDE, run `isCycleUsable`, and REFUSE to insert when the cycle is not `aprovado` OR is `vencido`), plus `listSterilizationCycles` + `getKitTraceability`.
(2) `lab-orders.ts`: `createLab` + `createLabOrder` (LAB-01), `setLabOrderCost` (LAB-02 — when a postable cost is set, INSERT a `despesa` row in `financial_transactions` tenant-scoped and backfill `lab_orders.financial_transaction_id`), `updateLabOrderStatus` (enviado→prova→concluido).
(3) RED source-inspection tests for both action files (asserting the guard + the financial posting are present).

Purpose: The kit-usage block is the phase's patient-safety control — it MUST live in the Server Action so it cannot be bypassed by a direct API call, a stale UI, or a race (the cycle is re-read at use time and `isCycleUsable` runs against the freshly-read validade vs server `today`). LAB-02 is delivered for real by posting to the Fase 3 `financial_transactions`; Fase 16 evolves contas-a-pagar management on top of that row. The `financial_transactions` table and the `appointments` GIST are never modified — actions only INSERT/UPDATE rows via the authenticated client (so existing RLS applies).
Output: 2 Server Action files + 2 RED-then-GREEN source-inspection test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/13-esteriliza-o-cme-laborat-rio-de-pr-tese/13-CONTEXT.md
@src/actions/resources.ts
@src/lib/auth/guards.ts
@src/lib/audit.ts
@src/lib/esterilizacao/cycle-status.ts
@src/lib/protese/lab-cost.ts
@src/lib/validators/sterilization.ts
@src/lib/validators/lab-order.ts
@supabase/migrations/20260606000100_financial_tables.sql

<interfaces>
<!-- Contracts the executor uses. All verified from the codebase. -->

getActor + guard pattern (MIRROR src/actions/resources.ts EXACTLY): `'use server'`; every export async (Turbopack constraint — NO non-async / re-exports); `await assertNotReadOnly()` first; `getActor()` returns `{ actor: { id, tenant_id, role } }`; role gate via `allowedRoles.includes(actor.role)`; tenant scope `clinic_id: actor.tenant_id` on insert and `.eq('clinic_id', actor.tenant_id)` on update; `logBusinessEvent({ tenantId, actorId, action, details })` with IDs only (LGPD).

Pure libs (Plans 02/03):
- `import { deriveCycleStatus, isCycleUsable } from '@/lib/esterilizacao/cycle-status'`
- `import { isCostPostable, buildLabExpenseDescription } from '@/lib/protese/lab-cost'`
- `import { sterilizationCycleSchema, kitUsageSchema } from '@/lib/validators/sterilization'`
- `import { labSchema, labOrderSchema } from '@/lib/validators/lab-order'`

financial_transactions columns (20260606000100_financial_tables.sql — CRITICAL, uses tenant_id NOT clinic_id): insert `{ tenant_id: actor.tenant_id, type: 'despesa', amount: cost, description, transaction_date: <today ISO date>, category_id: <optional, see below>, posted_by: actor.id }`. Existing financial_transactions RLS gates this to admin write — so setLabOrderCost role gate MUST include admin/superadmin (and dentist only if they may post — set allowedRoles = ['admin','superadmin'] for the financial-posting action to match the financial RLS; createLabOrder/createLab allow dentist too).

financial_categories (optional): query `financial_categories WHERE tenant_id = actor.tenant_id AND type='despesa' AND name ILIKE '%laborat%'` to find a lab/prótese despesa category; if none, leave category_id null (the column is nullable). Do NOT create categories here (Claude's discretion D-04 — reuse existing or null).

Types-before-push caveat: src/types/database.types.ts does NOT yet contain the Phase 13 tables (the db push is Plan 05). To keep `tsc --noEmit` green now, use the established pattern from Phase 12 Plan 04: cast the table access through a typed-relaxed client where needed — i.e. `const db = supabase as unknown as SupabaseClient<any>` OR `.from('sterilization_cycles' as never)` with explicit return typing, mirroring how src/actions/clinical-documents.ts handled the pre-push window. Read src/actions/clinical-documents.ts to copy the exact cast idiom it used so this file compiles before Plan 05 regenerates types.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: sterilization.ts — register cycle + biological result + KIT-USAGE BLOCK GUARD + traceability</name>
  <files>src/actions/sterilization.ts, src/__tests__/esterilizacao/sterilization-action.test.ts</files>
  <behavior>
    - registerSterilizationCycle: rejects read-only + non-team roles; Zod-validates; computes status = deriveCycleStatus({biologicalResult, validade}); inserts tenant-scoped; logs 'sterilization.cycle.registered'
    - updateBiologicalResult: sets biological_result + recomputes status via deriveCycleStatus; tenant-scoped update; logs
    - registerKitUsage (BLOCK GUARD): re-fetches the cycle by id (tenant-scoped); if not found → error; runs isCycleUsable({biologicalResult, validade}) against the FRESHLY-READ row; if NOT usable → returns { success:false, error: reason } and DOES NOT insert; if usable → inserts kit_usages (cycle→appointment→patient) tenant-scoped + logs 'kit.usage.registered'
    - getKitTraceability(cycleId|patientId): returns the kit_usages joined to cycle (lote traceability, CME-03)
  </behavior>
  <read_first>
    - src/actions/resources.ts (the getActor + assertNotReadOnly + role gate + tenant scope + logBusinessEvent skeleton to mirror exactly)
    - src/actions/clinical-documents.ts (the pre-push type-cast idiom for new tables — copy it so tsc stays green before Plan 05)
    - src/lib/esterilizacao/cycle-status.ts (deriveCycleStatus + isCycleUsable signatures + reason strings)
    - src/lib/validators/sterilization.ts (sterilizationCycleSchema + kitUsageSchema fields)
    - src/__tests__/esterilizacao/kit-block-guard.test.ts (the block-guard contract the action must honor)
  </read_first>
  <action>
Create `src/actions/sterilization.ts` (`'use server'`, all exports async, mirror resources.ts):
  - `getActor()` helper (copy from resources.ts). Team roles for cycle/usage writes: `const TEAM_ROLES = ['admin','superadmin','dentist','receptionist']`.
  - `registerSterilizationCycle(input: SterilizationCycleInput)`: `await assertNotReadOnly()`; `sterilizationCycleSchema.safeParse`; getActor; role gate `TEAM_ROLES.includes(actor.role)`; `const status = deriveCycleStatus({ biologicalResult: input.biological_result, validade: input.validade ?? null })`; insert into `sterilization_cycles` `{ clinic_id: actor.tenant_id, unit_id: input.unit_id ?? null, autoclave_id, cycle_number, temperatura, tempo_minutos, pressao, biological_result, cycle_date, validade, status, operator_id: input.operator_id ?? actor.id, notes, created_by: actor.id }` `.select('id').single()`; `logBusinessEvent({ tenantId: actor.tenant_id, actorId: actor.id, action: 'sterilization.cycle.registered', details: { cycle_id, status, biological_result: input.biological_result } })`; return `{ success:true, id }`.
  - `updateBiologicalResult(id: string, biologicalResult: 'pendente'|'aprovado'|'reprovado')`: assertNotReadOnly; getActor; role gate; re-fetch the cycle's `validade` (tenant-scoped) → `const status = deriveCycleStatus({ biologicalResult, validade })`; update `sterilization_cycles` set `biological_result`, `status`, `updated_at` `.eq('id',id).eq('clinic_id', actor.tenant_id)`; log 'sterilization.biological.updated'; return success.
  - `registerKitUsage(input: KitUsageInput)` — THE BLOCK GUARD (CME-02): `await assertNotReadOnly()`; `kitUsageSchema.safeParse`; getActor; role gate `TEAM_ROLES`. Re-fetch the cycle SERVER-SIDE: `supabase.from('sterilization_cycles').select('id, biological_result, validade, deleted_at').eq('id', input.sterilization_cycle_id).eq('clinic_id', actor.tenant_id).single()`. If error/not found OR `cycle.deleted_at` → `{ success:false, error:'Ciclo não encontrado' }`. `const check = isCycleUsable({ biologicalResult: cycle.biological_result, validade: cycle.validade })`. **If `!check.usable` → return `{ success:false, blocked:true, error: check.reason }` and DO NOT insert** (this is the patient-safety block — server-side, authoritative). Else insert `kit_usages` `{ clinic_id: actor.tenant_id, unit_id: input.unit_id ?? null, sterilization_cycle_id, appointment_id: input.appointment_id ?? null, patient_id, kit_label, used_by: actor.id }` `.select('id').single()`; `logBusinessEvent({ ..., action:'kit.usage.registered', details:{ kit_usage_id, sterilization_cycle_id: input.sterilization_cycle_id, patient_id: input.patient_id, appointment_id: input.appointment_id ?? null } })`; return `{ success:true, id }`.
  - `listSterilizationCycles()`: getActor; select cycles tenant-scoped WHERE deleted_at IS NULL ordered cycle_date desc; return `{ success:true, data }`. (Read — no assertNotReadOnly.)
  - `getKitTraceability(params: { cycleId?: string; patientId?: string })`: getActor; select kit_usages tenant-scoped (optionally filtered by sterilization_cycle_id or patient_id) joined to the cycle fields; return `{ success:true, data }`.

Create `src/__tests__/esterilizacao/sterilization-action.test.ts` (source-inspection, mirror clinical-documents.test.ts style — read the action file text + assert substrings; do NOT execute Supabase):
  - Assert `src/actions/sterilization.ts` exists, starts with `'use server'`.
  - Assert it imports `isCycleUsable` AND `deriveCycleStatus` from the cycle-status lib.
  - Assert `registerKitUsage` re-fetches the cycle and calls `isCycleUsable` and has a guard that returns without inserting when not usable — assert the file contains both `isCycleUsable` and a `!check.usable` (or equivalent `.usable === false`) early-return BEFORE the `kit_usages` insert (assert the index of the `isCycleUsable` call is BEFORE the index of `'kit_usages'` insert string).
  - Assert it calls `assertNotReadOnly` and `logBusinessEvent`.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/esterilizacao/sterilization-action.test.ts && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - sterilization-action.test.ts GREEN: file imports isCycleUsable + deriveCycleStatus; registerKitUsage calls isCycleUsable BEFORE the kit_usages insert (block-before-write); assertNotReadOnly + logBusinessEvent present.
    - `src/actions/sterilization.ts` contains `isCycleUsable(` and the early-return guard; the `kit_usages` insert is reached ONLY when usable.
    - `npx tsc --noEmit` exits 0 (pre-push cast idiom from clinical-documents.ts applied).
    - Every export in sterilization.ts is async (no sync/re-export — Turbopack 'use server').
  </acceptance_criteria>
  <done>sterilization.ts ships register cycle + biological result + the server-side kit-usage block guard (CME-02) + traceability (CME-03); action test GREEN; tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: lab-orders.ts — lab CRUD + OS + setLabOrderCost (financial posting LAB-02) + status</name>
  <files>src/actions/lab-orders.ts, src/__tests__/protese/lab-order-action.test.ts</files>
  <behavior>
    - createLab / updateLab: admin/dentist gated; Zod labSchema; tenant-scoped; logs
    - createLabOrder: admin/dentist gated; Zod labOrderSchema; inserts the OS tenant-scoped (status defaults enviado); if input.cost is postable at creation, also posts the despesa (same path as setLabOrderCost); logs
    - setLabOrderCost(orderId, cost): admin/superadmin gated; isCostPostable(cost) guard; inserts a financial_transactions despesa (tenant_id-scoped, type='despesa', amount=cost, description=buildLabExpenseDescription, transaction_date=today); updates lab_orders SET cost + financial_transaction_id; logs 'lab.order.cost.posted' (LAB-02)
    - updateLabOrderStatus(orderId, status): admin/dentist gated; status enum guard; tenant-scoped update; logs
  </behavior>
  <read_first>
    - src/actions/resources.ts (getActor + guard + tenant scope skeleton)
    - src/actions/clinical-documents.ts (pre-push cast idiom)
    - supabase/migrations/20260606000100_financial_tables.sql (financial_transactions columns: tenant_id, type, amount, description, transaction_date, category_id, posted_by — copy these exact names)
    - src/lib/protese/lab-cost.ts (isCostPostable + buildLabExpenseDescription)
    - src/lib/validators/lab-order.ts (labSchema + labOrderSchema fields)
  </read_first>
  <action>
Create `src/actions/lab-orders.ts` (`'use server'`, all exports async, mirror resources.ts):
  - `getActor()` helper. `const ORDER_ROLES = ['admin','superadmin','dentist']`; `const COST_ROLES = ['admin','superadmin']` (financial posting matches financial_transactions admin-write RLS).
  - `createLab(input: LabInput)` / `updateLab(id, input)`: assertNotReadOnly; labSchema.safeParse; getActor; role gate ORDER_ROLES; insert/update `prosthetic_labs` `{ clinic_id: actor.tenant_id, nome, cnpj, contato_nome, telefone, email, notes }`; log 'lab.created'/'lab.updated'; return success.
  - `createLabOrder(input: LabOrderInput)`: assertNotReadOnly; labOrderSchema.safeParse; getActor; role gate ORDER_ROLES; insert `lab_orders` `{ clinic_id: actor.tenant_id, unit_id: input.unit_id ?? null, lab_id, patient_id, appointment_id: input.appointment_id ?? null, order_number, prosthesis_type, due_date, stages: input.stages ?? [], status: input.status, cost: input.cost ?? null, created_by: actor.id }` `.select('id').single()`; log 'lab.order.created'. THEN if `isCostPostable(input.cost ?? null)` AND `COST_ROLES.includes(actor.role)` → call the internal cost-posting routine (below) for the new order id. Return `{ success:true, id }`.
  - Internal cost-posting (shared by createLabOrder + setLabOrderCost) — implement as inline code in `setLabOrderCost` and call setLabOrderCost-style logic; OR factor a private async helper `postLabExpense(orderId, cost, actor, labName, prosthesisType, orderNumber)`:
    1. Fetch the order's lab name + prosthesis_type + order_number (tenant-scoped) if not passed.
    2. Optionally resolve a despesa category: `financial_categories` WHERE `tenant_id = actor.tenant_id AND type='despesa' AND name ILIKE '%laborat%'` → first id or null.
    3. INSERT `financial_transactions` `{ tenant_id: actor.tenant_id, category_id: <resolved or null>, type: 'despesa', amount: cost, description: buildLabExpenseDescription({ labName, prosthesisType, orderNumber: orderNumber ?? orderId }), transaction_date: new Date().toISOString().slice(0,10), posted_by: actor.id }` `.select('id').single()`.
    4. UPDATE `lab_orders` SET `cost = cost, financial_transaction_id = <txn id>, updated_at = now()` `.eq('id', orderId).eq('clinic_id', actor.tenant_id)`.
    5. `logBusinessEvent({ tenantId: actor.tenant_id, actorId: actor.id, action: 'lab.order.cost.posted', details: { lab_order_id: orderId, financial_transaction_id: txnId, amount: cost } })`.
  - `setLabOrderCost(orderId: string, cost: number)`: assertNotReadOnly; getActor; role gate COST_ROLES; `if (!isCostPostable(cost)) return { success:false, error:'Custo deve ser maior que zero' }`; guard against double-posting: re-fetch the order; if it already has `financial_transaction_id` → return `{ success:false, error:'Custo já lançado no financeiro para esta OS' }` (idempotency — no double despesa); else run postLabExpense; return `{ success:true, financialTransactionId }`.
  - `updateLabOrderStatus(orderId: string, status: 'enviado'|'prova'|'concluido')`: assertNotReadOnly; getActor; role gate ORDER_ROLES; validate status in the three values; update `lab_orders` set status + updated_at tenant-scoped; log 'lab.order.status.updated'; return success.
  - `listLabOrders()` / `listLabs()`: getActor; select tenant-scoped WHERE deleted_at IS NULL; return `{ success:true, data }`.

Create `src/__tests__/protese/lab-order-action.test.ts` (source-inspection):
  - Assert `src/actions/lab-orders.ts` exists + starts `'use server'`.
  - Assert it imports `isCostPostable` + `buildLabExpenseDescription`.
  - Assert `setLabOrderCost` inserts into `financial_transactions` with `type: 'despesa'` and `tenant_id` (assert the file contains both `financial_transactions` and `type: 'despesa'` and `tenant_id:`).
  - Assert it backfills `financial_transaction_id` on `lab_orders` (file contains `financial_transaction_id`).
  - Assert a double-post guard: file contains a check on existing `financial_transaction_id` before posting (assert `financial_transaction_id` appears in a conditional/return-early context — grep `já lançado` present).
  - Assert assertNotReadOnly + logBusinessEvent present.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/protese/lab-order-action.test.ts && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - lab-order-action.test.ts GREEN: imports isCostPostable + buildLabExpenseDescription; setLabOrderCost inserts financial_transactions despesa (tenant_id) + backfills financial_transaction_id; double-post guard ('já lançado') present; assertNotReadOnly + logBusinessEvent present.
    - `src/actions/lab-orders.ts` uses `tenant_id:` (NOT clinic_id) on the financial_transactions insert and `clinic_id:` on lab_orders/prosthetic_labs.
    - COST_ROLES is ['admin','superadmin'] (matches financial RLS); ORDER_ROLES includes dentist.
    - `npx tsc --noEmit` exits 0; every export async.
  </acceptance_criteria>
  <done>lab-orders.ts ships lab CRUD + OS (LAB-01) + setLabOrderCost posting a despesa to financial_transactions + financial_transaction_id backfill (LAB-02) + status transitions; action test GREEN; tsc clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client/UI → registerKitUsage | UNTRUSTED — a direct call, a stale UI, or a race could attempt to use a reprovado/vencido cycle; the action re-fetches the cycle and runs isCycleUsable server-side as the authoritative block |
| client → setLabOrderCost | UNTRUSTED cost + orderId; Zod/role-gated; despesa posted via authenticated client so financial_transactions RLS (tenant_id) applies; double-post guarded |
| action → financial_transactions | the despesa is tenant-scoped (tenant_id = actor.tenant_id) and gated to admin/superadmin (matches the financial RLS); never cross-tenant |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-12 | Spoofing/Tampering | bypassing the kit block via direct API call or stale UI (PATIENT SAFETY) | mitigate | registerKitUsage re-fetches the cycle server-side and runs isCycleUsable BEFORE any insert; the block is in the action, not only the UI; no client field overrides it |
| T-13-13 | Tampering | TOCTOU race — validade changes between read and use | mitigate | the cycle is re-read at the moment of use and isCycleUsable runs against that fresh row vs server `today`; the validity window is evaluated server-side at insert time (validade < today blocks) |
| T-13-14 | Elevation of Privilege | read-only / non-team role registering cycle or kit usage | mitigate | assertNotReadOnly + TEAM_ROLES gate on every CME mutation; RLS WITH CHECK is the DB backstop |
| T-13-15 | Tampering | double-posting the lab despesa (double-credit cash flow) | mitigate | setLabOrderCost re-checks lab_orders.financial_transaction_id and refuses if already posted (idempotency) |
| T-13-16 | Elevation of Privilege | non-admin posting a financial despesa | mitigate | COST_ROLES = ['admin','superadmin']; financial_transactions RLS admin-write is the DB backstop |
| T-13-17 | Information Disclosure | cross-tenant cycle/order/financial write | mitigate | clinic_id/tenant_id = actor.tenant_id on every insert; .eq tenant guard on every update |
| T-13-18 | Repudiation | no trail for kit usage / cost posting | mitigate | logBusinessEvent (IDs only) on every mutation: sterilization.cycle.registered, kit.usage.registered, lab.order.cost.posted |
| T-13-19 | Tampering | accidental financial_transactions / GIST modification | accept | actions only INSERT/UPDATE rows via the authenticated client; no DDL; Plan 01 regression guard backs the migrations |
</threat_model>

<verification>
- `npx vitest run src/__tests__/esterilizacao/ src/__tests__/protese/` GREEN (action source-inspection + the Wave 1 logic/migration suites + regression guard).
- `npx tsc --noEmit` clean (pre-push cast idiom).
- Existing suites unaffected; financial_transactions + appointments GIST never modified.
</verification>

<success_criteria>
- CME: register cycle (CME-01) + the server-side kit-usage BLOCK guard (CME-02, patient safety, re-fetch + isCycleUsable before insert) + traceability (CME-03).
- LAB: lab CRUD + OS (LAB-01) + setLabOrderCost posting a despesa to financial_transactions + financial_transaction_id backfill (LAB-02) with double-post + role guards.
- Every mutation: assertNotReadOnly + role gate + tenant scope + logBusinessEvent; tsc green.
</success_criteria>

<output>
After completion, create `.planning/phases/13-esteriliza-o-cme-laborat-rio-de-pr-tese/13-04-SUMMARY.md`
</output>
