---
phase: "06"
plan: "05"
subsystem: "ux-shell"
tags: ["ui", "typography", "tokens", "hub", "auth", "public-pages"]
dependency_graph:
  requires: ["06-03", "06-04"]
  provides: ["hub-overview", "auth-brand-tokens", "invite-token-rewrite", "public-pages-tokens"]
  affects: ["clinica-hub", "auth-forms", "invite-page", "agendar-page", "anamnese-page"]
tech_stack:
  added: []
  patterns:
    - "PageHeader on hub (title=Início, no breadcrumb)"
    - "CardGridSkeleton for hub loading.tsx"
    - "2-weight typography system (font-semibold/font-normal) across auth + public"
    - "Brand wordmark exception: text-2xl font-bold font-display tracking-tight text-primary"
    - "Design tokens only: bg-background/bg-card/text-foreground/text-muted-foreground/border-border"
    - "Auth layout: bg-background + dark radial brand blob via before: pseudo"
key_files:
  created:
    - src/app/(dashboard)/clinica/loading.tsx
  modified:
    - src/app/(dashboard)/clinica/page.tsx
    - src/app/(auth)/layout.tsx
    - src/components/auth/LoginForm.tsx
    - src/components/auth/SignupForm.tsx
    - src/components/auth/ForgotPasswordForm.tsx
    - src/app/(auth)/reset-password/page.tsx
    - src/app/invite/[token]/page.tsx
    - src/app/agendar/[clinic-slug]/page.tsx
    - src/app/anamnese/[patient-id]/[token]/page.tsx
decisions:
  - "Hub removes Sair button + role/plan slug (sidebar footer owns identity per 06-03 shell)"
  - "Auth forms wrap content in bg-card rounded-xl border border-border p-8 shadow-md card"
  - "Invite page replaces inline SVGs with lucide-react icons (UserCircle2, AlertTriangle) for consistency"
  - "Anamnese page gets FYNXIA chip above section title to unify public page brand pattern"
  - "agendar h1 uses font-semibold font-display (not font-bold) — heading level, not brand wordmark"
metrics:
  duration_minutes: 25
  completed_date: "2026-06-12"
  tasks_completed: 3
  files_modified: 9
  files_created: 1
---

# Phase 06 Plan 05: Hub + Auth + Public Pages Token Sweep Summary

Wave 3 typography/token sweep across hub, auth, and public surfaces: redesigned `/clinica` hub as a dashboard overview with time-based greeting + 3 RLS-scoped stat cards + shortcut grid; applied the 2-weight brand system and `bg-card` wrapper to all auth forms; fully rewrote `/invite/[token]` on design tokens; corrected the anamnesis title copy and public page typography.

## What Was Built

### Task 1 — Hub redesign + loading.tsx (commit `6106714`)

Rewrote `src/app/(dashboard)/clinica/page.tsx`:

- Removed `<form action={signOut}>` Sair button and `"Perfil: {role} · Plano: {plan}"` line — sidebar footer owns user identity.
- Added `<PageHeader title="Início" />` (no breadcrumb — top-level).
- Time-based greeting: `"Bom dia/Boa tarde/Boa noite, {firstName}"` at `text-2xl font-semibold font-display`.
- 3 RLS-scoped quick-stat cards via `supabase.from(...).select('*', { count: 'exact', head: true })`: Consultas hoje (appointments today by date), Pacientes ativos (non-deleted patients), Recebíveis em aberto (pendente receivables).
- 2-col shortcut grid: Nova Consulta, Novo Paciente, Emitir Cobrança, Abrir Copiloto — icons `text-muted-foreground group-hover:text-primary`.
- Public booking link preserved; `font-medium` link replaced with `font-semibold`.
- Created `src/app/(dashboard)/clinica/loading.tsx` using `CardGridSkeleton` (3 stats + 4 shortcuts).

### Task 2 — Auth pages brand chip + 2-weight system (commit `804df27`)

- `(auth)/layout.tsx`: Added centering + dark radial brand blob via `before:` pseudo (opacity 0 light / opacity 100 dark).
- `LoginForm.tsx`, `SignupForm.tsx`, `ForgotPasswordForm.tsx`: wordmark `text-3xl font-bold` → `text-2xl font-bold font-display tracking-tight`; `font-medium` labels → `font-semibold`; footer links `font-medium` → `font-semibold`; form content wrapped in `bg-card rounded-xl border border-border p-8 shadow-md`.
- `reset-password/page.tsx`: same wordmark fix, `font-medium` label → `font-semibold`; outer layout wrapper removed (auth/layout.tsx owns centering).

### Task 3 — Invite rewrite + public pages token sweep (commit `88f1f45`)

- `invite/[token]/page.tsx`: Full token rewrite — `bg-gray-50` → `bg-background`, `bg-white` → `bg-card`, `text-slate-900` → `text-foreground`, `text-slate-500/600` → `text-muted-foreground`, `border-slate-200` → `border-border`. Inline SVGs replaced with `lucide-react` (`UserCircle2`, `AlertTriangle`). FYNXIA wordmark `text-2xl font-bold font-display text-primary`. `font-medium` → `font-semibold`. 44px touch target on login link via `min-h-[44px] min-w-[44px] inline-flex`.
- `anamnese/[patient-id]/[token]/page.tsx`: Title "Anamnese Digital" → "Anamnese Odontológica". Added FYNXIA wordmark chip `text-2xl font-bold font-display text-primary`. Progress indicator `font-medium` → `font-semibold`.
- `agendar/[clinic-slug]/page.tsx`: h1 `font-bold` → `font-semibold font-display` (heading, not brand wordmark).

## Verification Results

- `npx vitest run src/__tests__/ui/`: 124 passed / 1 pre-existing failure (`contas-a-receber` — out of scope for this plan, belongs to 06-06/07)
- All plan-specific typography assertions PASS: clinica hub, LoginForm, SignupForm, ForgotPasswordForm, reset-password, invite token, agendar, anamnese
- `npx tsc --noEmit`: exit 0
- `npx next build`: green (29/29 static pages, compiled successfully in 7.4s)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `inline-block flex` conflict on invite login link**
- **Found during:** Task 3
- **Issue:** Wrote `inline-block ... flex items-center justify-center` — conflicting display values on the same element.
- **Fix:** Changed to `inline-flex items-center justify-center`.
- **Files modified:** `src/app/invite/[token]/page.tsx`
- **Commit:** `88f1f45` (fixed before commit)

**2. [Rule 2 - Enhancement] Added FYNXIA brand chip to anamnese page**
- **Found during:** Task 3
- **Issue:** Plan specifies "FYNXIA chip text-primary" for the anamnese page (06-UI-SPEC line 712). The page had no brand chip at all.
- **Fix:** Added `<h1 className="text-2xl font-bold font-display tracking-tight text-primary">FYNXIA</h1>` above the section title for brand consistency on public pages.
- **Files modified:** `src/app/anamnese/[patient-id]/[token]/page.tsx`
- **Commit:** `88f1f45`

## Known Stubs

None. All stat card values are live RLS-scoped server queries (count: 'exact', head: true). No placeholder/hardcoded data flows to the UI.

## Threat Flags

None. Presentation-only changes. Token validation logic in invite/anamnese server actions left untouched per T-06-10. Hub stats are RLS-scoped reads (T-06-09 accepted).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/app/(dashboard)/clinica/loading.tsx` | FOUND |
| `src/app/(dashboard)/clinica/page.tsx` | FOUND |
| commit `6106714` (hub redesign) | FOUND |
| commit `804df27` (auth pages) | FOUND |
| commit `88f1f45` (invite + public) | FOUND |
