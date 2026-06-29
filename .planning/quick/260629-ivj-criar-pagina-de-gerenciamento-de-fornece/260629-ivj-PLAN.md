---
phase: quick
plan: 260629-ivj
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(dashboard)/clinica/financeiro/fornecedores/page.tsx
  - src/app/(dashboard)/clinica/financeiro/fornecedores/loading.tsx
  - src/app/(dashboard)/clinica/financeiro/fornecedores/error.tsx
  - src/components/financeiro/SuppliersTable.tsx
  - src/components/financeiro/SupplierFormDialog.tsx
  - src/app/(dashboard)/clinica/financeiro/page.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Admin pode abrir /clinica/financeiro/fornecedores e ver tabela com todos os fornecedores não deletados do tenant"
    - "Admin pode criar novo fornecedor via dialog (nome + tipo obrigatórios)"
    - "Admin pode editar fornecedor existente via dialog"
    - "Admin pode desativar fornecedor (ativo: false) via botão na linha da tabela"
    - "Usuários não-admin veem a listagem mas sem botões de ação"
    - "Card de Fornecedores aparece no hub /clinica/financeiro"
  artifacts:
    - path: "src/app/(dashboard)/clinica/financeiro/fornecedores/page.tsx"
      provides: "RSC page — fetches role + suppliers, renders SuppliersTable + SupplierFormDialog"
    - path: "src/components/financeiro/SuppliersTable.tsx"
      provides: "Tabela shadcn com linhas de fornecedor + edit dialog + toggle desativar"
    - path: "src/components/financeiro/SupplierFormDialog.tsx"
      provides: "Dialog RHF create/edit — name, tipo, cnpj_cpf, pix_key, banco, agencia, conta, vinculo, ativo"
  key_links:
    - from: "SuppliersTable"
      to: "deactivateSupplier / updateSupplier"
      via: "useTransition + router.refresh()"
    - from: "SupplierFormDialog"
      to: "createSupplier / updateSupplier"
      via: "RHF onSubmit → server action"
    - from: "financeiro/page.tsx navItems"
      to: "/clinica/financeiro/fornecedores"
      via: "novo card na grade de navegação"
---

<objective>
Create the suppliers management page at /clinica/financeiro/fornecedores with full CRUD (list, create, edit, deactivate), following the centros-de-custo / plano-de-contas page pattern already established in the codebase. Reuse the existing server actions in src/actions/suppliers.ts.

Purpose: Give admins a dedicated UI to manage the supplier registry used throughout Contas a Pagar.
Output: RSC page + SuppliersTable client component + SupplierFormDialog + navigation card on hub.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/actions/suppliers.ts
@src/app/(dashboard)/clinica/financeiro/centros-de-custo/page.tsx
@src/components/financeiro/CostCentersTable.tsx
@src/components/financeiro/CostCenterFormDialog.tsx
@src/app/(dashboard)/clinica/financeiro/page.tsx

<interfaces>
<!-- Key types extracted from src/actions/suppliers.ts -->

```typescript
export type SupplierInput = {
  name: string
  tipo: 'laboratorio' | 'material' | 'servico' | 'autonomo' | 'pj' | 'outro'
  cnpjCpf?: string | null
  pixKey?: string | null
  banco?: string | null
  agencia?: string | null
  conta?: string | null
  vinculo?: 'clt' | 'pj' | 'autonomo' | null
  professionalId?: string | null
  labId?: string | null
  ativo?: boolean | null
}

// listSuppliers return shape (suppliers array items):
type SupplierRow = {
  id: string
  name: string
  tipo: string
  cnpj_cpf: string | null
  vinculo: string | null
  professional_id: string | null
  lab_id: string | null
  ativo: boolean | null
}

export async function listSuppliers(filters?: { tipo?: string | null; ativo?: boolean | null }): Promise<{ success: boolean; suppliers?: SupplierRow[]; error?: string }>
export async function createSupplier(input: SupplierInput): Promise<{ success: boolean; supplierId?: string; error?: string }>
export async function updateSupplier(id: string, input: SupplierInput): Promise<{ success: boolean; error?: string }>
export async function deactivateSupplier(id: string): Promise<{ success: boolean; error?: string }>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: SupplierFormDialog + SuppliersTable client components</name>
  <files>
    src/components/financeiro/SupplierFormDialog.tsx,
    src/components/financeiro/SuppliersTable.tsx
  </files>
  <action>
Create two client components following the CostCenterFormDialog + CostCentersTable pattern exactly.

**SupplierFormDialog.tsx** (`'use client'`):
- Props: `mode: 'create' | 'edit'`, `supplier?: SupplierRow`, `trigger: React.ReactNode`
- Zod schema `supplierFormSchema` — NO `.default()` (D-133). Fields:
  - `name: z.string().min(1, 'Nome obrigatório').max(200)`
  - `tipo: z.enum(['laboratorio','material','servico','autonomo','pj','outro'])`
  - `cnpjCpf: z.string().max(20).optional().nullable()`
  - `pixKey: z.string().max(100).optional().nullable()`
  - `banco: z.string().max(100).optional().nullable()`
  - `agencia: z.string().max(20).optional().nullable()`
  - `conta: z.string().max(30).optional().nullable()`
  - `vinculo: z.enum(['clt','pj','autonomo']).optional().nullable()`
  - `ativo: z.boolean()`
- RHF `defaultValues`: populate from `supplier` prop for edit, blanks + `ativo: true` for create
- On open: `form.reset()` to current values + clear server error (mirrors CostCenterFormDialog handleOpen)
- onSubmit: call `createSupplier(values)` or `updateSupplier(supplier.id, values)`, on success `setOpen(false)` + `router.refresh()`
- Dialog layout: shadcn Dialog, max-w-lg. Fields in order: Nome (Input), Tipo (Select), Vínculo (Select, optional), CNPJ/CPF (Input, optional), PIX (Input, optional), Banco (Input, optional), Agência + Conta side-by-side in a `flex gap-2` (Input x2, optional), Ativo (Switch + FormLabel inline).
- Tipo Select labels: `laboratorio` → "Laboratório", `material` → "Material/Insumo", `servico` → "Serviço", `autonomo` → "Autônomo", `pj` → "Pessoa Jurídica (PJ)", `outro` → "Outro"
- Vínculo Select labels: `clt` → "CLT", `pj` → "PJ", `autonomo` → "Autônomo". Add empty option with value `""` to allow clearing (map `""` → `null` on submit).
- Trigger wrapper: `<div className="contents" onClick={() => handleOpen(true)} ...>` pattern (same as CostCenterFormDialog)
- Show `<Alert variant="destructive">` on serverError above the form fields.

**SuppliersTable.tsx** (`'use client'`):
- Props: `suppliers: SupplierRow[]`, `canEdit: boolean`
- Empty state: `<EmptyState icon={Truck} title="Nenhum fornecedor cadastrado" description="Cadastre fornecedores para vinculá-los às contas a pagar da clínica." />`
- shadcn `<Table>` columns: Nome, Tipo, CNPJ/CPF, Vínculo, Status, Ações (admin only)
- Tipo display map: same labels as above form
- Vínculo display: `clt` → "CLT", `pj` → "PJ", `autonomo` → "Autônomo", null → "—"
- Status column: `<Badge variant="outline">{supplier.ativo ? 'Ativo' : 'Inativo'}</Badge>`
- Ações cell (when `canEdit`):
  - `<SupplierFormDialog mode="edit" supplier={row} trigger={<Button size="sm" variant="outline">Editar</Button>} />`
  - Desativar button: only show when `supplier.ativo === true`. `<Button size="sm" variant="ghost" onClick={() => handleDeactivate(row.id)} disabled={isPending}>Desativar</Button>`
  - `handleDeactivate`: `startTransition(async () => { await deactivateSupplier(id); router.refresh() })`
- Import `Truck` from lucide-react for the empty state icon.
- useTransition + useRouter from next/navigation (mirrors CostCentersTable).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "SupplierFormDialog|SuppliersTable" | head -20</automated>
  </verify>
  <done>Both files compile without TypeScript errors. SupplierFormDialog handles create + edit with proper RHF reset. SuppliersTable renders all columns and delegates deactivation via server action.</done>
</task>

<task type="auto">
  <name>Task 2: RSC page + loading/error boundaries + hub nav card</name>
  <files>
    src/app/(dashboard)/clinica/financeiro/fornecedores/page.tsx,
    src/app/(dashboard)/clinica/financeiro/fornecedores/loading.tsx,
    src/app/(dashboard)/clinica/financeiro/fornecedores/error.tsx,
    src/app/(dashboard)/clinica/financeiro/page.tsx
  </files>
  <action>
**fornecedores/page.tsx** (RSC, no `'use client'`):
- Role fetch pattern identical to centros-de-custo/page.tsx: `createClient()` → `auth.getUser()` → `from('users').select('role').eq('id', user.id).single()` → `isAdmin = role === 'admin' || role === 'superadmin'`
- Call `listSuppliers()` (no filters — show all, including inactive, so admin can see history). Pass result to table.
- Layout mirrors centros-de-custo/page.tsx exactly:
  ```tsx
  <>
    <PageHeader
      title="Fornecedores"
      breadcrumbs={[{ label: 'Financeiro', href: '/clinica/financeiro' }, { label: 'Fornecedores' }]}
      actions={isAdmin ? <SupplierFormDialog mode="create" trigger={<Button size="sm"><Truck className="size-4 mr-1" />Novo Fornecedor</Button>} /> : null}
    />
    <main className="p-6 max-w-5xl mx-auto w-full">
      {error alert if !result.success}
      <div className="rounded-md border">
        <SuppliersTable suppliers={suppliers} canEdit={isAdmin} />
      </div>
    </main>
  </>
  ```

**fornecedores/loading.tsx**: copy from centros-de-custo/loading.tsx (or create a simple skeleton with `<div className="p-6 animate-pulse space-y-4">` + a few `<div className="h-8 bg-muted rounded" />`).

**fornecedores/error.tsx**: copy/adapt from centros-de-custo/error.tsx — `'use client'` + renders `<Alert variant="destructive">` with the error message.

**financeiro/page.tsx** — add Fornecedores nav card:
- Import `Truck` from lucide-react (add to existing import line)
- Insert into `navItems` array after the `contas-a-pagar` entry:
  ```ts
  {
    href: '/clinica/financeiro/fornecedores',
    title: 'Fornecedores',
    description: 'Cadastre e gerencie fornecedores vinculados às contas a pagar.',
    icon: Truck,
    show: true,
  },
  ```
- Do NOT reorder or remove existing items.

Also add `revalidatePath('/clinica/financeiro/fornecedores')` to `createSupplier`, `updateSupplier`, and `deactivateSupplier` in `src/actions/suppliers.ts` alongside the existing `revalidatePath('/clinica/financeiro/contas-a-pagar')` call.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "fornecedores|financeiro/page" | head -20</automated>
  </verify>
  <done>
    - /clinica/financeiro/fornecedores renders (npm run build exits 0 for the route).
    - Nav card appears in /clinica/financeiro hub grid.
    - loading.tsx and error.tsx files exist with correct exports.
    - suppliers.ts revalidates both paths.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Full CRUD UI for fornecedores: listing page, create/edit dialog, deactivate action, hub nav card.
  </what-built>
  <how-to-verify>
    1. Open https://fynxia.vercel.app/clinica/financeiro — confirm "Fornecedores" card appears in the grid.
    2. Click the card — confirm the table loads at /clinica/financeiro/fornecedores.
    3. Click "Novo Fornecedor" (admin login required) — confirm Dialog opens with all fields: Nome, Tipo, Vínculo, CNPJ/CPF, PIX, Banco, Agência, Conta, Ativo.
    4. Fill Nome + Tipo → Save — confirm new row appears in the table.
    5. Click "Editar" on the row — confirm dialog pre-fills existing values.
    6. Edit the name → Save — confirm row updates.
    7. Click "Desativar" on an active row — confirm badge changes to "Inativo" and the button disappears from that row.
    8. Log in as a non-admin user — confirm table is visible but action buttons are absent.
  </how-to-verify>
  <resume-signal>Type "aprovado" or describe any issues found</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → Server Action | SupplierInput crosses this boundary on create/edit |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ivj-01 | Elevation of Privilege | createSupplier / updateSupplier / deactivateSupplier | mitigate | WRITER_ROLES gate already in suppliers.ts — only admin/superadmin can write; UI `canEdit` is cosmetic only |
| T-ivj-02 | Spoofing | clinic_id on insert | mitigate | suppliers.ts always uses `actor.tenant_id` from server-side session — never trusts client input for clinic_id |
| T-ivj-03 | Information Disclosure | listSuppliers | accept | RLS scopes query to authenticated tenant; no PII beyond CNPJ/CPF which is displayed to admin only |
</threat_model>

<verification>
- `npx tsc --noEmit` exits 0 (no TypeScript errors across all new files)
- `npm run build` completes without error for the new route
- No `.default()` in any Zod schema (D-133 compliance)
- `clinic_id` is never accepted from client input (T-ivj-02)
</verification>

<success_criteria>
- Admin can list, create, edit, and deactivate suppliers at /clinica/financeiro/fornecedores
- Non-admin users can view the list but have no action buttons
- Hub card links correctly to the new page
- TypeScript strict mode passes
- Existing centros-de-custo and plano-de-contas pages are unaffected
</success_criteria>

<output>
After completion, create `.planning/quick/260629-ivj-criar-pagina-de-gerenciamento-de-fornece/260629-ivj-SUMMARY.md`
</output>
