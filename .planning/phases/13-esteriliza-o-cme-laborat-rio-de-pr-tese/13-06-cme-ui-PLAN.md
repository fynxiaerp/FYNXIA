---
phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese
plan: 06
type: execute
wave: 4
depends_on: [05]
files_modified:
  - src/proxy.ts
  - src/components/shell/nav-config.ts
  - src/components/shell/nav-icons.ts
  - src/components/esterilizacao/CycleForm.tsx
  - src/components/esterilizacao/KitUsageForm.tsx
  - src/app/(dashboard)/clinica/esterilizacao/page.tsx
  - src/app/(dashboard)/clinica/esterilizacao/uso-kit/page.tsx
autonomous: true
requirements: [CME-01, CME-02, CME-03]
tags: [esterilizacao, cme, ui, forms, block-guard, proxy, navigation, module-registration]

must_haves:
  truths:
    - "esterilizacao + protese modules are registered in proxy.ts (ROUTE_MODULE_MAP most-specific-first, BEFORE /clinica) + nav-config + nav-icons (string-key, RSC-safe) — this plan owns the shared shell files for BOTH modules so Plan 07 stays parallel-safe"
    - "Team can register a sterilization cycle (autoclave select from resources, params, biological indicator, validade); the cycles list shows status with vencido/reprovado visually blocked"
    - "Team can register kit usage linking a cycle to a patient/appointment; when registerKitUsage returns blocked (non-aprovado/vencido), the UI shows the block reason and does NOT present the usage as registered"
    - "Read-only roles see no mutation CTAs"
  artifacts:
    - path: "src/components/esterilizacao/CycleForm.tsx"
      provides: "RHF+Zod v3 cycle form: autoclave combobox + params + biological_result + validade"
    - path: "src/components/esterilizacao/KitUsageForm.tsx"
      provides: "kit-usage form: cycle select (usable filter) + patient/appointment link + block-reason display"
    - path: "src/app/(dashboard)/clinica/esterilizacao/page.tsx"
      provides: "cycles list (RSC) with status badges + register CTA"
  key_links:
    - from: "src/components/esterilizacao/KitUsageForm.tsx"
      to: "src/actions/sterilization.ts registerKitUsage"
      via: "form submit → registerKitUsage; blocked result → show reason"
      pattern: "registerKitUsage"
    - from: "src/proxy.ts"
      to: "esterilizacao + protese route resolution"
      via: "ROUTE_MODULE_MAP prefixes before /clinica"
      pattern: "/clinica/esterilizacao|/clinica/protese"
---

<objective>
Build the Esterilização/CME UI (CME-01/02/03) AND register BOTH new modules (esterilizacao + protese) in the proxy + nav (this plan owns the shared shell files so Plan 07 stays parallel-safe): (1) register `esterilizacao` + `protese` as ModuleKeys with MODULE_PERMISSIONS (admin/superadmin/dentist write; esterilizacao adds receptionist write since the team records cycles; auditor/dpo/socio readOnly) and ROUTE_MODULE_MAP prefixes BEFORE the generic `/clinica` entry (most-specific-first, mirrors documentos/receituario), plus nav-config + nav-icons string-key entries (RSC-safe); (2) a CycleForm (autoclave combobox over `resources` of tipo equipamento, temperatura/tempo/pressão, biological_result select, cycle_date + validade) calling registerSterilizationCycle; (3) a KitUsageForm (cycle select + patient + optional appointment) calling registerKitUsage that surfaces the server block reason when the cycle is reprovado/vencido (NON-bypassable — the server is authoritative); (4) the cycles list RSC page with status badges (aprovado/reprovado/vencido) + a uso-kit page.

Purpose: Let the clinical team register cycles + the biological indicator and link kits to patients with the patient-safety block surfaced from the server. Uses design-system v1 (PageHeader, tokens, @base-ui Button render-prop NEVER asChild, RHF+Zod v3 no .default(), pt-BR). nodejs runtime on the RSC pages.
Output: 3 shared-file edits (proxy + 2 nav) + 2 components + 2 pages. Module registration for BOTH modules lives ONLY here.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/13-esteriliza-o-cme-laborat-rio-de-pr-tese/13-CONTEXT.md
@src/proxy.ts
@src/components/shell/nav-config.ts
@src/components/shell/nav-icons.ts
@src/lib/validators/sterilization.ts
@src/lib/esterilizacao/cycle-status.ts
@src/app/(dashboard)/clinica/receituario/page.tsx
@src/app/(dashboard)/clinica/recursos/page.tsx

<interfaces>
<!-- Contracts the executor uses. -->

From src/actions/sterilization.ts (Plan 04):
```typescript
registerSterilizationCycle(input: SterilizationCycleInput): Promise<{ success; id?; error? }>
updateBiologicalResult(id: string, biologicalResult: 'pendente'|'aprovado'|'reprovado'): Promise<{ success; error? }>
registerKitUsage(input: KitUsageInput): Promise<{ success; id?; blocked?: boolean; error? }>
listSterilizationCycles(): Promise<{ success; data?; error? }>
getKitTraceability(params: { cycleId?: string; patientId?: string }): Promise<{ success; data?; error? }>
```
From src/lib/validators/sterilization.ts (Plan 02): `sterilizationCycleSchema`, `kitUsageSchema`, `SterilizationCycleInput`, `KitUsageInput`.
From src/lib/esterilizacao/cycle-status.ts (Plan 02): `isCycleUsable`, `deriveCycleStatus` — used in the UI for a NON-blocking pre-warning + filtering the cycle select to usable cycles (the SERVER block is authoritative; the UI filter is convenience only).

proxy.ts current shape (mirror the receituario registration from Phase 12):
- `type ModuleKey` → ADD `'esterilizacao' | 'protese'`.
- `MODULE_PERMISSIONS`: esterilizacao → superadmin/admin/dentist `{allowed:true}` + receptionist `{allowed:true}` (team records cycles) + auditor/dpo/socio `{allowed:true, readOnly:true}`. protese → superadmin/admin/dentist `{allowed:true}` + auditor/dpo/socio `{allowed:true, readOnly:true}` (NO receptionist — OS is clinical/financial).
- `ROUTE_MODULE_MAP` (most-specific-first): INSERT `{ prefix: '/clinica/esterilizacao', module: 'esterilizacao' }` and `{ prefix: '/clinica/protese', module: 'protese' }` BEFORE `{ prefix: '/clinica', module: 'clinica' }`.

nav-config.ts: `NavIconKey` union → add `'esterilizacao' | 'protese'`; `ALL_NAV_ITEMS` → add two entries (after Teleodontologia). nav-icons.ts: `NAV_ICONS` Record → add `esterilizacao` + `protese` keys mapped to Lucide icons (RSC string-key — client-only map). Suggested icons: esterilizacao → `ShieldCheck` (or `Biohazard` if available), protese → `Boxes` (or `Layers`).

autoclave source: query `resources WHERE clinic_id = tenant AND tipo='equipamento' AND deleted_at IS NULL` for the autoclave combobox (D-01 — autoclave is a resources row). Patients list + appointments for the kit-usage link come from existing tenant-scoped queries (mirror receituario/page.tsx patient fetch).

UI primitives: shadcn Dialog/Select/Input/Label/Textarea/Alert/Badge/Button under src/components/ui/*; Button is @base-ui (render-prop, NEVER asChild). Tokens only. RSC page pattern from receituario/page.tsx: resolve tenant via headers() x-user-id, render PageHeader + content; read x-read-only to hide mutation CTAs.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Register esterilizacao + protese modules (proxy + nav-config + nav-icons)</name>
  <files>src/proxy.ts, src/components/shell/nav-config.ts, src/components/shell/nav-icons.ts</files>
  <read_first>
    - src/proxy.ts (ModuleKey union + the receituario/teleodontologia MODULE_PERMISSIONS rows + ROUTE_MODULE_MAP order from Phase 12 — mirror exactly)
    - src/components/shell/nav-config.ts (NavIconKey union + ALL_NAV_ITEMS + the receituario/teleodontologia entries)
    - src/components/shell/nav-icons.ts (client-only Lucide map; the receituario/teleodontologia keys; available imports)
  </read_first>
  <action>
Edit `src/proxy.ts`:
  - Extend `type ModuleKey` with `| 'esterilizacao' | 'protese'`.
  - In `MODULE_PERMISSIONS`, add rows mirroring receituario but per the access matrix above:
    - esterilizacao: `superadmin`/`admin`/`dentist`/`receptionist` → `{allowed:true}`; `auditor`/`dpo`/`socio` → `{allowed:true, readOnly:true}`.
    - protese: `superadmin`/`admin`/`dentist` → `{allowed:true}`; `auditor`/`dpo`/`socio` → `{allowed:true, readOnly:true}` (NO receptionist/ti/implantacao/aluno).
  - In `ROUTE_MODULE_MAP`, INSERT BEFORE `{ prefix: '/clinica', module: 'clinica' }`:
    `{ prefix: '/clinica/esterilizacao', module: 'esterilizacao' }`, `{ prefix: '/clinica/protese', module: 'protese' }`. Add a comment mirroring the receituario line (most-specific-first — Pitfall 6).

Edit `src/components/shell/nav-config.ts`:
  - Extend `NavIconKey` with `| 'esterilizacao' | 'protese'`.
  - Add to `ALL_NAV_ITEMS` (after the Teleodontologia entry): `{ href: '/clinica/esterilizacao', label: 'Esterilização', icon: 'esterilizacao' }` and `{ href: '/clinica/protese', label: 'Prótese (Lab)', icon: 'protese' }`. (NOT adminOnly — clinical team needs them.)

Edit `src/components/shell/nav-icons.ts`:
  - Import two Lucide icons (verify available in lucide-react): `ShieldCheck` and `Boxes` (fallback `Layers` if Boxes absent). Add to the existing import list.
  - Add to `NAV_ICONS`: `esterilizacao: ShieldCheck, protese: Boxes`.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run src/__tests__/proxy/ src/__tests__/rbac/</automated>
  </verify>
  <acceptance_criteria>
    - ModuleKey includes esterilizacao + protese; MODULE_PERMISSIONS rows match the matrix (esterilizacao has receptionist write; protese does not); ROUTE_MODULE_MAP has both prefixes BEFORE /clinica.
    - NavIconKey + ALL_NAV_ITEMS + NAV_ICONS all include both keys (RSC string-key, no component crossing the boundary).
    - `npx tsc --noEmit` exits 0; existing proxy/rbac suites green (derived ROLE_ROUTES still consistent).
  </acceptance_criteria>
  <done>Both modules registered in proxy + nav-config + nav-icons; most-specific-first order; tsc clean; proxy/rbac green. Plan 07 touches NONE of these files.</done>
</task>

<task type="auto">
  <name>Task 2: CycleForm + KitUsageForm + esterilização list/uso-kit pages</name>
  <files>src/components/esterilizacao/CycleForm.tsx, src/components/esterilizacao/KitUsageForm.tsx, src/app/(dashboard)/clinica/esterilizacao/page.tsx, src/app/(dashboard)/clinica/esterilizacao/uso-kit/page.tsx</files>
  <read_first>
    - src/app/(dashboard)/clinica/receituario/page.tsx (RSC tenant resolution + PageHeader + list + x-read-only gating + nodejs runtime)
    - src/app/(dashboard)/clinica/recursos/page.tsx (how the resources list is fetched + the ResourceForm pattern — mirror for the autoclave combobox source)
    - src/lib/validators/sterilization.ts (sterilizationCycleSchema + kitUsageSchema — form shape)
    - src/lib/esterilizacao/cycle-status.ts (isCycleUsable for the UI pre-warning + cycle-select filter)
    - src/actions/sterilization.ts (registerSterilizationCycle / registerKitUsage blocked return shape)
  </read_first>
  <action>
Create `src/components/esterilizacao/CycleForm.tsx` (`'use client'`): RHF + `zodResolver(sterilizationCycleSchema)`; defaultValues supply all fields (NO `.default()` in schema — D-133). Fields: an `autoclave_id` Select/combobox over the `autoclaves` prop (resources of tipo equipamento — show nome); `temperatura` (number), `tempo_minutos` (number), `pressao` (number); `biological_result` Select (pendente/aprovado/reprovado); `cycle_date` (date input, default today); `validade` (date input, optional); optional `cycle_number` + `notes`. On submit call `registerSterilizationCycle`; show shadcn Alert on error / success (pt-BR). When `biological_result` is `reprovado` show an inline warning that the cycle will be blocked for use. @base-ui Button render-prop, NEVER asChild.

Create `src/components/esterilizacao/KitUsageForm.tsx` (`'use client'`): RHF + `zodResolver(kitUsageSchema)`; props: `cycles` (list with id, status, biological_result, validade, cycle_number), `patients`, optional `appointments`. Fields: a `sterilization_cycle_id` Select — for each cycle compute `isCycleUsable({ biologicalResult, validade })` client-side and DISABLE / badge the non-usable ones (show "bloqueado: <reason>"); a `patient_id` Select; an optional `appointment_id` Select; optional `kit_label`. On submit call `registerKitUsage`; **if the result has `blocked` / an error, render a prominent shadcn Alert (destructive token) with the server's block reason and do NOT show a success state** — make explicit in a comment that the SERVER is authoritative (the client filter is convenience only; the action re-checks and blocks). On success show a confirmation + clear the form. @base-ui Button render-prop.

Create `src/app/(dashboard)/clinica/esterilizacao/page.tsx` (RSC, `export const runtime = 'nodejs'`): resolve tenant via headers() x-user-id; fetch the cycles list via listSterilizationCycles (or a tenant-scoped query) + the autoclave list (resources tipo equipamento) for the form. Render `PageHeader title="Esterilização / CME"` + a table (autoclave, data do ciclo, indicador biológico, validade, status badge) where status uses a Badge colored by deriveCycleStatus (aprovado=success token, reprovado=destructive, vencido=warning, pendente=muted) + EmptyState + a "Registrar ciclo" CTA (renders the CycleForm in a Dialog or a sub-route). Add a secondary CTA / link to `/clinica/esterilizacao/uso-kit`. Read x-read-only to hide the register CTA for read-only roles.

Create `src/app/(dashboard)/clinica/esterilizacao/uso-kit/page.tsx` (RSC, `export const runtime = 'nodejs'`): resolve tenant; fetch cycles (with biological_result + validade for the usable filter), the clinic patients, and recent appointments; render `PageHeader title="Uso de Kit (Rastreabilidade)"` + the `<KitUsageForm cycles patients appointments />` + a traceability table (getKitTraceability) showing cycle → paciente → atendimento → data. Read x-read-only to hide the form for read-only roles.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx next build</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0; `npx next build` completes clean (no 'use server' sync-export error, nodejs runtime on the RSC pages).
    - CycleForm uses RHF + zodResolver(sterilizationCycleSchema) with the autoclave combobox over resources; KitUsageForm filters/badges non-usable cycles via isCycleUsable AND renders the server block reason from registerKitUsage's blocked/error result (no success on block).
    - Cycles list shows a status badge per cycle; read-only roles see no register CTA.
  </acceptance_criteria>
  <done>CycleForm + KitUsageForm + list/uso-kit pages render; build green; CME-01 cycle registration + CME-02 block surfaced + CME-03 traceability UI complete.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser form → sterilization actions | untrusted input; Zod-validated + team-role-gated + tenant-scoped in the action (Plan 04) |
| client cycle-usable filter → registerKitUsage | the UI filter is CONVENIENCE only; the server re-fetches + isCycleUsable is authoritative — a tampered client cannot register a blocked cycle |
| read-only role → register/usage CTA | x-read-only header hides CTAs; assertNotReadOnly blocks at the action layer (defense in depth) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-23 | Spoofing | client bypassing the kit-usable filter to use a blocked cycle | mitigate | the filter is UI convenience; registerKitUsage (Plan 04) re-fetches + runs isCycleUsable server-side and rejects — no client field overrides it |
| T-13-24 | Elevation of Privilege | non-team role accessing esterilização | mitigate | MODULE_PERMISSIONS gates esterilizacao to team roles (write) + auditor/dpo/socio (readOnly); ROUTE_MODULE_MAP resolves before /clinica |
| T-13-25 | Information Disclosure | patient identity in the block-reason payload | accept | the block reason is a non-identifying generic string (reprovado/pendente/vencido) — no PII in the alert |
| T-13-26 | Tampering | read-only role mutating via the form | mitigate | x-read-only hides CTAs; assertNotReadOnly is the action backstop |
</threat_model>

<verification>
- `npx tsc --noEmit` clean; `npx next build` green.
- `npx vitest run src/__tests__/proxy/ src/__tests__/rbac/ src/__tests__/esterilizacao/` green.
- Existing suites unaffected.
</verification>

<success_criteria>
- esterilizacao + protese modules registered (proxy + nav, most-specific-first, RSC string-key icons) — owned solely by this plan.
- Team registers cycle + biological indicator; kit usage links cycle→paciente with the server block surfaced (CME-01/02/03); read-only roles blocked.
- build green.
</success_criteria>

<output>
After completion, create `.planning/phases/13-esteriliza-o-cme-laborat-rio-de-pr-tese/13-06-SUMMARY.md`
</output>
