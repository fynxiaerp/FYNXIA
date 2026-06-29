---
phase: quick-260629-qji
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/actions/units.ts
  - src/components/config/UnitFormDialog.tsx
  - src/components/config/UnitsTable.tsx
  - src/app/(dashboard)/config/unidades/page.tsx
autonomous: true
requirements: [SYS-01]

must_haves:
  truths:
    - "An admin/superadmin can navigate to /config/unidades and see all active units in a table"
    - "An admin can create a new unit via a dialog (name, slug, CNPJ, phone, address, ativo)"
    - "An admin can edit an existing unit via the same dialog pre-filled"
    - "An admin can deactivate (soft delete) a non-default unit; the default unit cannot be deleted"
    - "A non-admin (dentist/receptionist) sees an 'Acesso restrito' alert, not the unit management UI"
  artifacts:
    - path: "src/app/(dashboard)/config/unidades/page.tsx"
      provides: "RSC page: role gate + listUnits + UnitsTable + create button"
      min_lines: 60
    - path: "src/components/config/UnitFormDialog.tsx"
      provides: "Create/edit unit dialog (RHF + zodResolver + unitSchema)"
      min_lines: 100
    - path: "src/components/config/UnitsTable.tsx"
      provides: "Table of units with edit + deactivate actions"
      min_lines: 60
    - path: "src/actions/units.ts"
      provides: "deactivateUnit soft-delete action (deleted_at) with default-unit guard"
      contains: "export async function deactivateUnit"
  key_links:
    - from: "src/app/(dashboard)/config/unidades/page.tsx"
      to: "listUnits"
      via: "import from @/actions/units"
      pattern: "listUnits"
    - from: "src/components/config/UnitsTable.tsx"
      to: "deactivateUnit"
      via: "import from @/actions/units"
      pattern: "deactivateUnit"
    - from: "src/components/config/UnitFormDialog.tsx"
      to: "createUnit / updateUnit"
      via: "import from @/actions/units"
      pattern: "createUnit|updateUnit"
---

<objective>
Create a dedicated unit (filial) management page at `/config/unidades` with full CRUD —
list, create, edit, deactivate — following the EXACT page pattern of
`/clinica/financeiro/centros-de-custo` and `/clinica/financeiro/fornecedores`
(RSC page → PageHeader + Table component + FormDialog component).

Units already have `listUnits`, `createUnit`, and `updateUnit` Server Actions in
`src/actions/units.ts` plus a `unitSchema` validator. They are currently managed only
inside the `/config/empresa` page via the embedded `UnitsManager` component. This task
gives units their OWN config route that mirrors the standard cadastro pages, and adds
the one missing action: `deactivateUnit` (soft delete via `deleted_at`).

Purpose: Units are referenced by `cost_centers.unit_id` and other modules; a standalone,
discoverable CRUD page matching the established cadastro UX makes them first-class.

Output: A working `/config/unidades` page (RBAC-gated), a `UnitFormDialog` component,
a `UnitsTable` component, and a `deactivateUnit` soft-delete Server Action.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md

# Page pattern to follow EXACTLY (RSC → PageHeader + Table + FormDialog)
@src/app/(dashboard)/clinica/financeiro/fornecedores/page.tsx
@src/app/(dashboard)/clinica/financeiro/centros-de-custo/page.tsx
@src/components/financeiro/SuppliersTable.tsx
@src/components/financeiro/CostCenterFormDialog.tsx

# Config-route role-gate convention (in-page Acesso restrito, no redirect)
@src/app/(dashboard)/config/empresa/page.tsx

# Existing units actions + validator + current manager (reuse these)
@src/actions/units.ts
@src/lib/validators/unit.ts
@src/components/config/UnitsManager.tsx

<interfaces>
<!-- Executor: use these directly. No codebase exploration needed. -->

From src/actions/units.ts (existing — DO NOT recreate listUnits/createUnit/updateUnit):
```typescript
export type UnitRow = {
  id: string
  name: string
  cnpj: string | null
  slug: string
  phone: string | null
  address: string | null
  ativo: boolean
  is_default: boolean
  clinic_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}
export async function listUnits(): Promise<{ success: boolean; units?: UnitRow[]; error?: string }>
export async function createUnit(input: UnitInput): Promise<{ success: boolean; unitId?: string; error?: string }>
export async function updateUnit(unitId: string, input: UnitInput): Promise<{ success: boolean; error?: string }>
// getActor() helper + assertNotReadOnly() + logBusinessEvent() already present in this file.
// listUnits already filters `.is('deleted_at', null)` and scopes to actor.tenant_id.
```

From src/lib/validators/unit.ts (existing — REUSE, no .default(), D-133):
```typescript
export const unitSchema = z.object({
  name: z.string().min(2, ...),
  cnpj: z.string().optional().refine(...),       // CNPJ optional; validated via cpf-cnpj-validator
  slug: z.string().regex(/^[a-z0-9-]+$/, ...),
  phone: z.string().optional(),
  address: z.string().optional(),
  ativo: z.boolean(),
})
export type UnitInput = z.infer<typeof unitSchema>
```

RBAC note: `/config/unidades` falls under the `/config` prefix in proxy.ts ROUTE_MODULE_MAP
(module `config`). admin/superadmin/ti = write; dpo/socio/implantacao = read-only.
NO proxy.ts change required.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add deactivateUnit soft-delete action to src/actions/units.ts</name>
  <files>src/actions/units.ts</files>
  <action>
Append a new exported Server Action `deactivateUnit(unitId: string)` to the EXISTING
`src/actions/units.ts` (do not touch listUnits/createUnit/updateUnit). Mirror the
auth + role-gate structure already used by `updateUnit` in this same file:

1. `await assertNotReadOnly()` first (read-only gate).
2. `getActor()` — on error return `{ success: false, error }`.
3. Role gate: `if (!['admin','superadmin'].includes(actor.role)) return { success:false, error:'Permissão insuficiente' }`.
4. Default-unit guard: fetch the unit's `is_default` scoped by `.eq('id', unitId).eq('clinic_id', actor.tenant_id)`. If `is_default` is true, return `{ success:false, error:'A unidade padrão não pode ser excluída' }` (mirrors the existing deactivation guard in updateUnit).
5. Soft delete: `.from('units').update({ deleted_at: new Date().toISOString(), ativo: false, updated_at: new Date().toISOString() }).eq('id', unitId).eq('clinic_id', actor.tenant_id)`. Use `createClient()` (SSR), NOT createAdminClient — this runs in an authenticated user session.
6. On error return `{ success:false, error: error.message }`.
7. Audit: `await logBusinessEvent({ tenantId: actor.tenant_id, actorId: actor.id, action: 'unit.deleted', details: { unit_id: unitId } })` (same shape as the existing unit.created/unit.updated calls).
8. Return `{ success: true }`.

Signature: `export async function deactivateUnit(unitId: string): Promise<{ success: boolean; error?: string }>`.
Soft delete uses `deleted_at` so listUnits (which filters `deleted_at IS NULL`) excludes it.
Do NOT add `.default()` anywhere (D-133).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>`deactivateUnit` exported from src/actions/units.ts; sets deleted_at + ativo:false; blocks default unit; uses createClient(); admin/superadmin gate + assertNotReadOnly; tsc clean.</done>
</task>

<task type="auto">
  <name>Task 2: Create UnitFormDialog + UnitsTable components</name>
  <files>src/components/config/UnitFormDialog.tsx, src/components/config/UnitsTable.tsx</files>
  <action>
**UnitFormDialog.tsx** — `'use client'`, mirror `CostCenterFormDialog.tsx` structure exactly
(shadcn Dialog + RHF + zodResolver + the "contents" wrapper-div trigger that avoids nested
buttons). Differences:
- Import `createUnit`, `updateUnit`, and type `UnitRow` from `@/actions/units`; import
  `unitSchema`, `UnitInput` from `@/lib/validators/unit`. REUSE `unitSchema` as the resolver
  schema — do NOT define a new inline schema (slug regex + CNPJ refine live there).
- Props: `{ mode: 'create' | 'edit'; unit?: UnitRow; trigger: React.ReactNode }`.
- `useForm<UnitInput>` with defaultValues from `unit` (or blanks): name '', cnpj '', slug '',
  phone '', address '', ativo true. Reset on open in `handleOpen(true)` (mirror CostCenter).
  No `.default()` in schema — defaultValues supply values (D-133).
- Fields (all `<Input>` except ativo `<Switch>`, matching UnitsManager.tsx labels/placeholders):
  Nome * (name), Slug * (slug, placeholder "unidade-centro"), CNPJ (cnpj, placeholder
  "00.000.000/0001-00"), Telefone (phone), Endereço (address), and "Unidade ativa" Switch (ativo).
  In edit mode, if `unit?.is_default`, disable the ativo Switch (mirror UnitsManager).
- onSubmit: edit → `updateUnit(unit.id, values)`; create → `createUnit(values)`. On success
  `setOpen(false)` + `router.refresh()`. On failure `setServerError(result.error ?? 'Erro ao salvar...')`.
- Title: 'Nova Unidade' / 'Editar Unidade'. Submit button label 'Salvar Unidade'.
- Use design tokens only (bg-background, border-border, text-foreground) — no raw slate/gray/white.

**UnitsTable.tsx** — `'use client'`, mirror `SuppliersTable.tsx` / `CostCentersTable.tsx`:
- Import `deactivateUnit` from `@/actions/units` and type `UnitRow` from `@/actions/units`;
  import `UnitFormDialog`; import `EmptyState` from `@/components/shell/EmptyState`;
  `Building2` icon from lucide-react.
- Props: `{ units: UnitRow[]; canEdit: boolean }`.
- `useTransition` + `useRouter`. `handleDeactivate(id)` → `await deactivateUnit(id); router.refresh()`.
- Empty state: `<EmptyState icon={Building2} title="Nenhuma unidade cadastrada" description="Cadastre as unidades (filiais) da sua rede para vinculá-las a centros de custo e lançamentos." />`.
- Columns: Nome (with a "Padrão" `<Badge variant="secondary">` next to name when `unit.is_default`),
  Slug, CNPJ (`unit.cnpj ?? '—'`), Status (`<Badge variant="outline">` Ativa/Inativa), and an
  Ações column rendered only when `canEdit`.
- Ações: `<UnitFormDialog mode="edit" unit={unit} trigger={<Button size="sm" variant="outline">Editar</Button>} />`
  plus a "Excluir" `<Button size="sm" variant="ghost" disabled={isPending || unit.is_default} onClick={() => handleDeactivate(unit.id)}>Excluir</Button>`
  (disabled for the default unit — it cannot be deleted).
- Design tokens only.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>UnitFormDialog (create/edit, reuses unitSchema, no .default()) and UnitsTable (edit + excluir, default-unit guarded, EmptyState) compile; tsc clean.</done>
</task>

<task type="auto">
  <name>Task 3: Create /config/unidades RSC page + verify build</name>
  <files>src/app/(dashboard)/config/unidades/page.tsx</files>
  <action>
Create `src/app/(dashboard)/config/unidades/page.tsx` as a Server Component. Follow the
CONFIG-route convention from `config/empresa/page.tsx` (in-page "Acesso restrito" Alert for
non-admin, NO redirect) combined with the cadastro layout from `fornecedores/page.tsx`:

1. `const supabase = await createClient()` (SSR, from `@/lib/supabase/server`).
2. Auth: `supabase.auth.getUser()`. If no user → render PageHeader + destructive Alert "Não autenticado." (mirror empresa page).
3. Role: `supabase.from('users').select('role').eq('id', user.id).single()`; `const isAdmin = role === 'admin' || role === 'superadmin'`.
4. If NOT isAdmin → render PageHeader + destructive Alert "Acesso restrito. Esta área é exclusiva para administradores da rede." (mirror empresa page; no redirect).
5. If isAdmin → `const result = await listUnits()`; `const units = result.success ? (result.units ?? []) : []`.
6. Render:
   - `<PageHeader title="Unidades" breadcrumbs={[{ label: 'Configurações', href: '/config' }, { label: 'Unidades' }]} actions={<UnitFormDialog mode="create" trigger={<Button size="sm"><Building2 className="size-4 mr-1" />Nova Unidade</Button>} />} />`
   - `<main className="p-6 max-w-5xl mx-auto w-full">` containing: an error `<Alert variant="destructive">` when `!result.success`, then `<div className="rounded-md border"><UnitsTable units={units} canEdit={isAdmin} /></div>`.

Imports: `createClient` from `@/lib/supabase/server`; `listUnits` from `@/actions/units`;
`PageHeader` from `@/components/shell/PageHeader`; `UnitsTable` + `UnitFormDialog` from
`@/components/config/`; `Button` from `@/components/ui/button`; `Alert, AlertDescription`
from `@/components/ui/alert`; `Building2` from lucide-react.

No proxy.ts change needed — `/config/unidades` is covered by the existing `/config` → `config`
module mapping (admin/superadmin write).
  </action>
  <verify>
    <automated>npx next build</automated>
  </verify>
  <done>`/config/unidades` appears in the build route list; page renders PageHeader + Nova Unidade button + UnitsTable for admin, "Acesso restrito" for non-admin; tsc + next build clean.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` clean.
- `npx next build` succeeds; `/config/unidades` present in the route output.
- Manual (post-deploy, per UAT-Vercel convention): as admin on fynxia.vercel.app open
  /config/unidades → see units list, create a unit, edit it, "Excluir" a non-default unit
  (disappears from list), confirm default unit's Excluir is disabled.
</verification>

<success_criteria>
- New route `/config/unidades` with full CRUD matching the centros-de-custo / fornecedores UX.
- `deactivateUnit` soft-deletes via `deleted_at` (default unit protected) using createClient().
- Existing listUnits/createUnit/updateUnit + unitSchema reused (no duplication, no .default()).
- Role gating: admin/superadmin only (UI + Server Action assertNotReadOnly + role checks).
</success_criteria>

<output>
After completion, create `.planning/quick/260629-qji-criar-p-gina-de-gest-o-de-unidades-em-co/260629-qji-SUMMARY.md`
</output>
