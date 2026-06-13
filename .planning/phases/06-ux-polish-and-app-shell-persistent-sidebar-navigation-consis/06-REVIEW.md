---
phase: 06-ux-polish-and-app-shell
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 52
files_reviewed_list:
  - src/app/layout.tsx
  - src/app/globals.css
  - src/app/(auth)/layout.tsx
  - src/app/(auth)/reset-password/page.tsx
  - src/app/(dashboard)/clinica/layout.tsx
  - src/app/(dashboard)/clinica/page.tsx
  - src/app/(dashboard)/clinica/loading.tsx
  - src/app/(dashboard)/clinica/agenda/page.tsx
  - src/app/(dashboard)/clinica/agenda/error.tsx
  - src/app/(dashboard)/clinica/agenda/loading.tsx
  - src/app/(dashboard)/clinica/equipe/page.tsx
  - src/app/(dashboard)/clinica/equipe/error.tsx
  - src/app/(dashboard)/clinica/equipe/loading.tsx
  - src/app/(dashboard)/clinica/financeiro/page.tsx
  - src/app/(dashboard)/clinica/financeiro/contas-a-receber/page.tsx
  - src/app/(dashboard)/clinica/financeiro/contas-a-receber/error.tsx
  - src/app/(dashboard)/clinica/financeiro/contas-a-receber/loading.tsx
  - src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx
  - src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/error.tsx
  - src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/loading.tsx
  - src/app/(dashboard)/clinica/financeiro/nova-cobranca/page.tsx
  - src/app/(dashboard)/clinica/financeiro/regua-de-cobranca/page.tsx
  - src/app/(dashboard)/clinica/ia/agentes/page.tsx
  - src/app/(dashboard)/clinica/ia/agentes/error.tsx
  - src/app/(dashboard)/clinica/ia/agentes/loading.tsx
  - src/app/(dashboard)/clinica/pacientes/page.tsx
  - src/app/(dashboard)/clinica/pacientes/error.tsx
  - src/app/(dashboard)/clinica/pacientes/loading.tsx
  - src/app/(dashboard)/clinica/pacientes/[id]/page.tsx
  - src/app/(dashboard)/clinica/pacientes/[id]/loading.tsx
  - src/app/agendar/[clinic-slug]/page.tsx
  - src/app/anamnese/[patient-id]/[token]/page.tsx
  - src/app/invite/[token]/page.tsx
  - src/components/shell/AppSidebar.tsx
  - src/components/shell/AppShellClient.tsx
  - src/components/shell/SidebarNavClient.tsx
  - src/components/shell/SidebarFooter.tsx
  - src/components/shell/SidebarCollapseButton.tsx
  - src/components/shell/ThemeToggle.tsx
  - src/components/shell/PageHeader.tsx
  - src/components/shell/MobileMenuTrigger.tsx
  - src/components/shell/EmptyState.tsx
  - src/components/shell/ErrorState.tsx
  - src/components/shell/skeletons.tsx
  - src/components/providers/ThemeProvider.tsx
  - src/components/copilot/CopilotSidebar.tsx
  - src/components/copilot/AgentOutreachLog.tsx
  - src/components/patients/PatientTable.tsx
  - src/components/patients/PdfButton.tsx
  - src/components/auth/LoginForm.tsx
  - src/components/auth/ForgotPasswordForm.tsx
  - src/components/ui/avatar.tsx
  - src/hooks/useSidebarStore.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-06-12
**Depth:** standard
**Files Reviewed:** 52
**Status:** issues_found

## Summary

Phase 06 introduced a complete app shell (persistent sidebar, ThemeProvider, PageHeader, EmptyState/ErrorState, skeletons) and swept all dashboard pages from raw `slate/gray/white` classes to semantic design tokens. The audit's primary concern — did any sweep accidentally change behavior, break auth, or leak PII — finds **one CRITICAL regression** in the hub page and **three warnings** worth fixing before the next release. The Phase 05 copilot wiring (useChat v6 sendMessage/status, DefaultChatTransport) is intact. PII masking in PatientTable and AgentOutreachLog is preserved. Role gating for Equipe is correctly enforced server-side in AppSidebar (not client-only). Hydration safety (suppressHydrationWarning on `<html>`, mounted-guard in ThemeToggle) is correctly implemented.

---

## Critical Issues

### CR-01: Hub page queries `appointments.date` — column does not exist

**File:** `src/app/(dashboard)/clinica/page.tsx:35`

**Issue:** The hub redesign introduced in commit `6106714` added a "Consultas hoje" stat card. The query filters on `.eq('date', today)` but the `appointments` table has **no `date` column** — the schema uses `start_time TIMESTAMPTZ`. This will produce a Supabase PostgREST error at runtime (`undefined column "date"`). The destructured `consultasHoje` will be `null` (Supabase returns `null` count on query error), so the stat card silently shows `0` rather than crashing the page, but the data is always wrong. This is a functional regression introduced by the Phase 06 hub redesign.

**Fix:**
```typescript
// Replace .eq('date', today) with a time-range on start_time
supabase
  .from('appointments')
  .select('*', { count: 'exact', head: true })
  .gte('start_time', `${today}T00:00:00.000Z`)
  .lt('start_time', `${today}T23:59:59.999Z`),
```

Or more robustly using ISO day boundaries:
```typescript
const todayStart = new Date(today + 'T00:00:00.000Z').toISOString()
const todayEnd   = new Date(today + 'T23:59:59.999Z').toISOString()

supabase
  .from('appointments')
  .select('*', { count: 'exact', head: true })
  .gte('start_time', todayStart)
  .lt('start_time', todayEnd),
```

---

## Warnings

### WR-01: `CardGridSkeleton` uses a dynamic Tailwind class that will not be generated

**File:** `src/components/shell/skeletons.tsx:55`

**Issue:** The `columns` prop is interpolated into a Tailwind class at runtime: `` `sm:grid-cols-${columns}` ``. Tailwind v4 (like v3) requires full class names to appear as complete strings in source; it does not generate classes from dynamic string concatenation. The classes `sm:grid-cols-2` and `sm:grid-cols-3` will be absent from the compiled CSS unless they appear elsewhere in the codebase. In practice only `sm:grid-cols-3` is currently used (hub and financeiro), but if any consumer passes `columns={2}` the layout will silently break (no columns).

**Fix:**
```typescript
// Replace the dynamic class with an explicit map
const colsClass: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
}

// In the JSX:
className={`grid grid-cols-1 gap-4 ${colsClass[columns] ?? 'sm:grid-cols-3'}`}
```

### WR-02: `MobileMenuTrigger` is built but not wired into any page — mobile navigation is broken

**File:** `src/components/shell/MobileMenuTrigger.tsx` (component), `src/components/shell/PageHeader.tsx:22` (slot exists but unused)

**Issue:** `PageHeader` exposes a `mobileMenuTrigger?: React.ReactNode` slot, and `MobileMenuTrigger` was built for that slot. However, no page in the Phase 06 sweep passes `mobileMenuTrigger` to `PageHeader`. On screens narrower than `md` (768px), the sidebar is hidden (`hidden md:flex` in AppShellClient) and no hamburger appears. The result is a completely inaccessible navigation on mobile — there is no way to navigate between sections.

**Fix:** Pass `MobileMenuTrigger` with the same role-gated `navItems` constructed in `AppSidebar` to each page's `PageHeader`. The cleanest approach is to compute `navItems` once in `clinica/layout.tsx` and pass them down via a prop or expose a `MobileMenuTrigger` server-side wrapper that reads the role:

```tsx
// In clinica/layout.tsx, after building navItems (same logic as AppSidebar):
// Pass a pre-rendered MobileMenuTrigger to children via a layout slot,
// or render it directly inside AppShellClient for the mobile header bar.

// Simplest fix: add a mobile header bar inside AppShellClient:
// <div className="md:hidden flex items-center h-14 border-b px-4 bg-background">
//   <MobileMenuTrigger items={navItems} />
// </div>
```

Note: the role-gating logic (Equipe hidden for non-admin) must be replicated in the mobile nav. Since `AppSidebar` already runs server-side, the cleanest path is to accept pre-built `navItems` from the layout and pass them to both `SidebarNavClient` and the mobile trigger.

### WR-03: `InviteAcceptForm` uses raw `slate/white` classes — dark mode is broken for invite flow

**File:** `src/app/invite/[token]/InviteAcceptForm.tsx:52,61,66,74,78`

**Issue:** The Phase 06 invite page sweep (`88f1f45`) correctly converted `invite/[token]/page.tsx` to tokens, but `InviteAcceptForm.tsx` was not in the diff and retains all pre-Phase-06 raw color classes: `text-slate-700`, `border-slate-200`, `bg-slate-50`, `text-slate-500`, `bg-white`, `placeholder:text-slate-400`, `focus:ring-slate-900`, `text-red-600`, `bg-red-50`. In dark mode these are invisible or extremely poor contrast (white-on-dark-navy `bg-white` fields, `text-slate-700` on dark background). Since the invite page is a public onboarding surface, this is a visible regression.

**Fix:** Apply the same token pattern used in `LoginForm.tsx` and `ResetPasswordPage`:
```tsx
// Replace raw slate/white classes:
<label className="block text-sm font-semibold">          {/* was text-slate-700 */}
<input className="w-full rounded-md border border-input bg-muted px-3 py-2
                  text-sm text-muted-foreground cursor-not-allowed" />  {/* was bg-slate-50 border-slate-200 */}
<input className="w-full rounded-md border border-input bg-background px-3 py-2
                  text-sm placeholder:text-muted-foreground
                  focus:outline-none focus:ring-2 focus:ring-ring" />   {/* was bg-white focus:ring-slate-900 */}
<p className="text-xs text-destructive">{errors.password.message}</p>  {/* was text-red-600 */}
{serverError && (
  <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
    {serverError}
  </p>  /* was bg-red-50 text-red-700 border-red-200 */
)}
```

---

## Info

### IN-01: `AppSidebar` logo chip uses hardcoded HSL color instead of design token

**File:** `src/components/shell/AppSidebar.tsx:43`

**Issue:** The logo chip background uses `bg-[hsl(240_20%_8%)]` — this is the dark navy value from `--dark-navy` in globals.css, hardcoded inline. It works now because the dark sidebar background happens to be this value, but it diverges from the token system and will silently stay dark in light mode (the chip will always be navy regardless of theme).

**Fix:**
```tsx
// Use the sidebar token or popover token instead:
<div className="rounded-xl overflow-hidden bg-sidebar border border-sidebar-border ...">
// Or if it must be the dark navy chip:
<div className="rounded-xl overflow-hidden bg-[hsl(var(--dark-navy))] ...">
// (requires exposing --dark-navy as a CSS variable — currently only defined in .dark block)
```

### IN-02: `SidebarWordmark` comment says "Client component" but it is a plain Server function

**File:** `src/components/shell/AppSidebar.tsx:67`

**Issue:** The comment on line 67 reads `// Client component to hide wordmark when collapsed`. The function `SidebarWordmark` is a plain server-side function inside a Server Component file — no `'use client'` directive, no hooks. The comment is misleading. There is no collapse hiding logic in `SidebarWordmark`; hiding is handled by the parent `aside` width transition in `AppShellClient`.

**Fix:** Update the comment to accurately describe the rendering:
```tsx
// Wordmark — rendered server-side. Collapse hides it via the
// parent <aside> width transition in AppShellClient (overflow: hidden).
function SidebarWordmark() {
```

### IN-03: `AgentOutreachLog` status badge uses raw Tailwind color classes — dark mode inconsistency

**File:** `src/components/copilot/AgentOutreachLog.tsx:103-113`

**Issue:** The `StatusBadge` component uses raw semantic color classes (`text-blue-700 bg-blue-50 border-blue-200`, `text-green-700 bg-green-50`, etc.) instead of the project's token system. These classes lack dark mode variants and will be low-contrast on the dark background. The file was touched in Phase 06 (converted from `<table>` to shadcn `<Table>`) so this is in scope. Note: this is not a WCAG failure in isolation but it is inconsistent with the project's "no raw slate/gray/white" rule extended by Phase 06 to all swept files.

**Fix:** Use Tailwind dark-mode variants or define semantic badge tokens. A quick fix:
```tsx
const colorClass =
  status === 'sent'
    ? 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-800'
    : status === 'delivered'
      ? 'text-green-700 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-950/40 dark:border-green-800'
    // ... etc.
```
Or, if shadcn `Badge` variants are extended to cover these semantic states, use those instead.

---

## Summary Table

| ID | Severity | File | Short description |
|----|----------|------|-------------------|
| CR-01 | CRITICAL | clinica/page.tsx:35 | `appointments.date` column missing — stat always 0 |
| WR-01 | WARNING | skeletons.tsx:55 | Dynamic Tailwind column class will not compile |
| WR-02 | WARNING | MobileMenuTrigger.tsx / PageHeader.tsx | Mobile hamburger never rendered — mobile nav inaccessible |
| WR-03 | WARNING | invite/[token]/InviteAcceptForm.tsx:52-78 | Raw slate/white classes break dark mode on invite form |
| IN-01 | INFO | AppSidebar.tsx:43 | Hardcoded HSL dark-navy on logo chip |
| IN-02 | INFO | AppSidebar.tsx:67 | Misleading "Client component" comment |
| IN-03 | INFO | AgentOutreachLog.tsx:103-113 | Raw color badges without dark mode variants |

**Totals: 1 Critical, 3 Warnings, 3 Info**

---

## Phase 06 Correctness Checklist

| Concern | Result |
|---------|--------|
| Behavioral regressions in swept pages | **CR-01**: hub `appointments.date` query broken |
| Copilot Phase 05 wiring (useChat v6 sendMessage/status/DefaultChatTransport) | Intact — only cosmetic Bot icon color changed |
| Equipe admin-only nav gating (server-side, not client-only) | Correct — AppSidebar server component gates `isAdmin` before building navItems |
| PII masking in PatientTable (CPF/phone/email for receptionist/patient roles) | Preserved — masking logic unchanged |
| PII masking in AgentOutreachLog (patient_name masked to first name + initial) | Preserved — lives in `listAgentOutreach()` action, not in component |
| next-themes hydration: suppressHydrationWarning on `<html>` | Present |
| ThemeToggle mounted-guard (no FOUC) | Present — `useState(false)` + `useEffect` pattern correct |
| `clinics.single()` RLS safety in AppSidebar | Safe — policy `id = get_my_tenant_id()` guarantees single row |
| Client/server boundary correctness | Correct throughout — 'use client' only where hooks/events used |
| Skip-link + main-content id present | Both present (layout.tsx + AppShellClient.tsx) |
| Token sweep completeness | One miss: InviteAcceptForm (WR-03) |

---

_Reviewed: 2026-06-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
