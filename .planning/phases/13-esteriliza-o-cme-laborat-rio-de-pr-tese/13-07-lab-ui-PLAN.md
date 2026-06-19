---
phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese
plan: 07
type: execute
wave: 4
depends_on: [05]
files_modified:
  - src/components/protese/LabForm.tsx
  - src/components/protese/LabOrderForm.tsx
  - src/components/protese/LabOrderStatusBar.tsx
  - src/app/(dashboard)/clinica/protese/page.tsx
  - src/app/(dashboard)/clinica/protese/laboratorios/page.tsx
autonomous: true
requirements: [LAB-01, LAB-02]
tags: [protese, lab, ui, forms, financial, status, lab-order]

must_haves:
  truths:
    - "User can register a prosthetic lab (supplier) and open an OS protética (lab select, patient, tipo, prazo, etapas de prova, status)"
    - "User can set/confirm the OS cost; setting a postable cost posts a despesa to financial_transactions and the UI reflects that the cost is lançado no financeiro (LAB-02), with double-post prevented (cost field locks once posted)"
    - "OS status moves enviado→prova→concluído via a status control; the etapas de prova are editable"
    - "Read-only roles see no mutation CTAs; this plan touches NO shared shell files (proxy/nav owned by Plan 06)"
  artifacts:
    - path: "src/components/protese/LabOrderForm.tsx"
      provides: "RHF+Zod v3 OS form: lab select + patient + prosthesis_type + due_date + stages editor + cost"
    - path: "src/components/protese/LabOrderStatusBar.tsx"
      provides: "enviado→prova→concluído status control"
    - path: "src/app/(dashboard)/clinica/protese/page.tsx"
      provides: "lab orders list (RSC) with status + cost-posted indicator + open-OS CTA"
  key_links:
    - from: "src/components/protese/LabOrderForm.tsx"
      to: "src/actions/lab-orders.ts createLabOrder / setLabOrderCost"
      via: "form submit → createLabOrder; cost confirm → setLabOrderCost"
      pattern: "createLabOrder|setLabOrderCost"
---

<objective>
Build the Laboratório de Prótese UI (LAB-01/02) WITHOUT touching any shared shell file (proxy/nav are registered by Plan 06 — this plan is parallel-safe with it): (1) a LabForm (cadastro do laboratório fornecedor: nome, contato, telefone, email) calling createLab/updateLab; (2) a LabOrderForm (abrir OS: lab select, patient select, prosthesis_type, due_date, an etapas-de-prova editor over the `stages` array, optional cost) calling createLabOrder; (3) a LabOrderStatusBar (enviado→prova→concluído) calling updateLabOrderStatus and a cost-confirmation control calling setLabOrderCost that locks once the despesa is posted (LAB-02 — the cost generates a conta a pagar / despesa visible in financeiro, double-post prevented); (4) the OS list RSC page (status + a "lançado no financeiro" indicator) + a laboratórios cadastro page.

Purpose: Let dentists open + track prosthetic OS and confirm the cost so it flows to the financial module as a despesa (LAB-02 delivered for real now; Fase 16 evolves contas-a-pagar management). Uses design-system v1 (PageHeader, tokens, @base-ui Button render-prop NEVER asChild, RHF+Zod v3 no .default(), pt-BR). nodejs runtime on the RSC pages.
Output: 3 components + 2 pages. NO proxy/nav edits (Plan 06 owns them).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/13-esteriliza-o-cme-laborat-rio-de-pr-tese/13-CONTEXT.md
@src/lib/validators/lab-order.ts
@src/lib/protese/lab-cost.ts
@src/app/(dashboard)/clinica/receituario/page.tsx
@src/app/(dashboard)/clinica/recursos/page.tsx

<interfaces>
<!-- Contracts the executor uses. -->

From src/actions/lab-orders.ts (Plan 04):
```typescript
createLab(input: LabInput): Promise<{ success; id?; error? }>
updateLab(id: string, input: LabInput): Promise<{ success; error? }>
createLabOrder(input: LabOrderInput): Promise<{ success; id?; error? }>
setLabOrderCost(orderId: string, cost: number): Promise<{ success; financialTransactionId?; error? }>
updateLabOrderStatus(orderId: string, status: 'enviado'|'prova'|'concluido'): Promise<{ success; error? }>
listLabOrders(): Promise<{ success; data?; error? }>
listLabs(): Promise<{ success; data?; error? }>
```
From src/lib/validators/lab-order.ts (Plan 03): `labSchema`, `labOrderSchema`, `labStageSchema`, `LabInput`, `LabOrderInput`.
From src/lib/protese/lab-cost.ts (Plan 03): `isCostPostable` (client-side CTA enable for the cost confirm button).

A lab_order row carries `financial_transaction_id` (set once the cost is posted) — the UI uses its presence to show "Lançado no financeiro" and to LOCK the cost field / hide the "Lançar custo" CTA (double-post prevention mirrors the server guard). The despesa appears in the existing financeiro module (no new financeiro UI here).

Patients list comes from the existing tenant-scoped query (mirror receituario/page.tsx). Labs list comes from listLabs.

UI primitives: shadcn Dialog/Select/Input/Label/Textarea/Alert/Badge/Button under src/components/ui/*; Button is @base-ui (render-prop, NEVER asChild). Tokens only. RSC page pattern from receituario/page.tsx: resolve tenant via headers() x-user-id, PageHeader + content; read x-read-only to hide mutation CTAs.

DO NOT EDIT src/proxy.ts, src/components/shell/nav-config.ts, or src/components/shell/nav-icons.ts — Plan 06 registers the protese module + nav. This plan only creates components + pages under the already-registered /clinica/protese route.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: LabForm + LabOrderForm + LabOrderStatusBar (stages + cost posting)</name>
  <files>src/components/protese/LabForm.tsx, src/components/protese/LabOrderForm.tsx, src/components/protese/LabOrderStatusBar.tsx</files>
  <read_first>
    - src/lib/validators/lab-order.ts (labSchema + labOrderSchema + labStageSchema — form shapes)
    - src/lib/protese/lab-cost.ts (isCostPostable for the cost-confirm CTA enable)
    - src/components/esterilizacao/CycleForm.tsx (Plan 06 sibling — the RHF + zodResolver + @base-ui Button pattern to mirror; if not yet present, mirror an existing form like src/components/recursos/ResourceForm.tsx)
    - src/actions/lab-orders.ts (createLab / createLabOrder / setLabOrderCost / updateLabOrderStatus return shapes)
  </read_first>
  <action>
Create `src/components/protese/LabForm.tsx` (`'use client'`): RHF + `zodResolver(labSchema)`; defaultValues for all fields (NO `.default()` — D-133). Fields: `nome` (required), `cnpj`, `contato_nome`, `telefone`, `email`, `notes`. On submit call `createLab` (or `updateLab` when an `id` prop is passed); shadcn Alert on error/success (pt-BR). @base-ui Button render-prop, NEVER asChild.

Create `src/components/protese/LabOrderForm.tsx` (`'use client'`): RHF + `zodResolver(labOrderSchema)`; props: `labs` (for the lab select), `patients`, optional `appointments`. Fields:
  - `lab_id` Select (over labs — show nome); `patient_id` Select; optional `appointment_id` Select.
  - `prosthesis_type` (text — e.g. coroa, PPR, protocolo); `due_date` (date, optional); optional `order_number`.
  - an etapas-de-prova editor: a repeatable list over `stages` (each row: `nome` + optional `prevista` date) using RHF `useFieldArray` — add/remove rows; this maps to the `stages` JSONB.
  - `status` Select (enviado/prova/concluido) — default enviado on create.
  - optional `cost` (number) — note: setting cost here on CREATE will post the despesa via createLabOrder (Plan 04 posts when cost is postable); show a hint "Definir o custo lança uma despesa no financeiro".
  On submit call `createLabOrder`; on success show confirmation. @base-ui Button render-prop.

Create `src/components/protese/LabOrderStatusBar.tsx` (`'use client'`): props: `order` (id, status, cost, financial_transaction_id, lab name, prosthesis_type, order_number). Renders:
  - a status control (three steps enviado→prova→concluído) — a segmented control or Select calling `updateLabOrderStatus(order.id, next)`; reflect the current status with a Badge.
  - a cost section: if `order.financial_transaction_id` is set → show "Custo lançado no financeiro: R$ <cost>" as a locked/read indicator (NO re-post CTA — double-post prevention). Else show a number input + a "Lançar custo no financeiro" button enabled only when `isCostPostable(value)`; clicking calls `setLabOrderCost(order.id, value)`; on success show the lançado state; on error show a shadcn Alert (e.g. the server's "já lançado" message).
  @base-ui Button render-prop.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - LabOrderForm uses RHF + zodResolver(labOrderSchema) + useFieldArray for the stages editor; LabOrderStatusBar calls updateLabOrderStatus for the three statuses and setLabOrderCost gated by isCostPostable.
    - LabOrderStatusBar shows the cost as locked ("Lançado no financeiro") when financial_transaction_id is set and hides the re-post CTA (no double-post).
    - These files do NOT import or edit src/proxy.ts / nav-config.ts / nav-icons.ts.
  </acceptance_criteria>
  <done>LabForm + LabOrderForm (stages editor) + LabOrderStatusBar (status + cost posting, double-post locked) render; tsc clean.</done>
</task>

<task type="auto">
  <name>Task 2: protese OS list page + laboratórios cadastro page</name>
  <files>src/app/(dashboard)/clinica/protese/page.tsx, src/app/(dashboard)/clinica/protese/laboratorios/page.tsx</files>
  <read_first>
    - src/app/(dashboard)/clinica/receituario/page.tsx (RSC tenant resolution + PageHeader + list + x-read-only gating + nodejs runtime)
    - src/components/protese/LabOrderForm.tsx + LabOrderStatusBar.tsx + LabForm.tsx (the components rendered here — Task 1)
    - src/actions/lab-orders.ts (listLabOrders / listLabs)
  </read_first>
  <action>
Create `src/app/(dashboard)/clinica/protese/page.tsx` (RSC, `export const runtime = 'nodejs'`): resolve tenant via headers() x-user-id; fetch `listLabOrders()` + `listLabs()` + the clinic patients (mirror receituario fetch) + recent appointments. Render `PageHeader title="Laboratório de Prótese"` + a table of OS (order_number, paciente, laboratório, tipo, prazo, status Badge colored by status, and a "Financeiro" column showing "Lançado" with a check when financial_transaction_id is set else "—") + EmptyState + an "Abrir OS" CTA that renders `<LabOrderForm labs patients appointments />` (Dialog or sub-route). For each row, surface the `<LabOrderStatusBar order={...} />` (inline expand or a detail drawer) so status + cost can be managed. Add a secondary link to `/clinica/protese/laboratorios`. Read x-read-only to hide the "Abrir OS" CTA + status/cost controls for read-only roles.

Create `src/app/(dashboard)/clinica/protese/laboratorios/page.tsx` (RSC, `export const runtime = 'nodejs'`): resolve tenant; fetch `listLabs()`; render `PageHeader title="Laboratórios (Fornecedores)"` + a table (nome, contato, telefone, email) + EmptyState + a "Cadastrar laboratório" CTA rendering `<LabForm />` (Dialog). Read x-read-only to hide the CTA.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx next build</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0; `npx next build` completes clean (nodejs runtime on the RSC pages; no 'use server' sync-export error).
    - protese/page.tsx lists OS with a status Badge + a "Lançado/—" financeiro indicator driven by financial_transaction_id; "Abrir OS" renders LabOrderForm; per-row LabOrderStatusBar manages status + cost.
    - laboratorios/page.tsx lists labs + renders LabForm; read-only roles see no CTAs.
    - Neither page imports proxy/nav files.
  </acceptance_criteria>
  <done>protese OS list + laboratórios cadastro pages render; build green; LAB-01 OS lifecycle + LAB-02 cost→financeiro indicator UI complete.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser form → lab-orders actions | untrusted input; Zod-validated + admin/dentist-gated + tenant-scoped in the action (Plan 04) |
| cost confirm → setLabOrderCost | the client enables the CTA via isCostPostable, but the server re-validates cost + re-checks financial_transaction_id (double-post) + gates to admin/superadmin — the client cannot force a second despesa |
| read-only role → OS/cost/status CTA | x-read-only header hides CTAs; assertNotReadOnly blocks at the action layer |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-27 | Tampering | double-posting the lab despesa via repeated cost confirm | mitigate | LabOrderStatusBar locks the cost UI once financial_transaction_id is set; setLabOrderCost (Plan 04) re-checks server-side and refuses a second post |
| T-13-28 | Elevation of Privilege | non-clinical role opening OS / posting cost | mitigate | MODULE_PERMISSIONS gates protese to dentist/admin/superadmin (write) (Plan 06); the cost-posting action gates to admin/superadmin; read-only hidden |
| T-13-29 | Information Disclosure | cross-tenant OS / lab read | mitigate | RSC pages query tenant-scoped; lab_orders/prosthetic_labs RLS (Plan 03) is the DB backstop |
| T-13-30 | Tampering | read-only role mutating via the form | mitigate | x-read-only hides CTAs; assertNotReadOnly is the action backstop |
</threat_model>

<verification>
- `npx tsc --noEmit` clean; `npx next build` green.
- `npx vitest run src/__tests__/protese/` green.
- Existing suites unaffected; proxy/nav files untouched by this plan (Plan 06 owns them).
</verification>

<success_criteria>
- User registers labs + opens OS protética with etapas/status (LAB-01); confirms cost → despesa posted to financeiro with the lançado indicator + double-post locked (LAB-02).
- Read-only roles blocked; no shared shell-file edits (parallel-safe with Plan 06).
- build green.
</success_criteria>

<output>
After completion, create `.planning/phases/13-esteriliza-o-cme-laborat-rio-de-pr-tese/13-07-SUMMARY.md`
</output>
