---
version: v1.0
date: 2026-06-12
scope: project-wide (all v1 milestone screens)
baseline: 02-UI-SPEC.md / 03-UI-SPEC.md / 05-UI-SPEC.md + abstract 6-pillar standards
screenshots: not captured (code-only audit — no dev server)
scores:
  copywriting: 3
  visuals: 2
  color: 3
  typography: 2
  spacing: 3
  experience_design: 2
  overall: 15
---

# FYNXIA ERP — Project-Wide UI Review v1.0

**Audited:** 2026-06-12
**Baseline:** Phases 2, 3, 5 UI-SPECs + abstract 6-pillar standards
**Screenshots:** Not captured (code-only audit)
**Audit scope:** All v1 milestone screens — auth, dashboard hub, clinical module, financial module, AI copilot, public pages, team management

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Contract mostly met; empty-state icons missing; "Salvando..." inconsistency |
| 2. Visuals | 2/4 | No persistent app shell/sidebar; hub cards are the entire navigation model; screens feel disconnected |
| 3. Color | 3/4 | Token usage correct; equipe/invite pages break the system with raw slate/gray classes |
| 4. Typography | 2/4 | `font-bold` and `font-medium` used widely despite spec requiring only normal/semibold; 3 undeclared sizes |
| 5. Spacing | 3/4 | 8pt scale followed in most pages; equipe page and a few empty-state containers use inconsistent values |
| 6. Experience Design | 2/4 | No Skeleton loading states, no ErrorBoundary, no sidebar/persistent nav, patient table lacks sort indicators |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **No persistent app shell — every page is a standalone island** — Users navigating between Agenda, Pacientes, Financeiro, and IA lose orientation; there is no sidebar, no persistent header, no breadcrumb-to-home path visible on task screens like ProntuarioPage or AgendaPage. The clinica/page.tsx navigation hub is fine as a landing pad, but once the user drills into a module they lose the shell entirely. Impact: every deep page feels like a dead-end; "back" navigation is the only escape. Fix: add a persistent sidebar nav to `src/app/(dashboard)/clinica/layout.tsx` (currently a passthrough `<>{children}</>`). Minimum viable: logo + module links (Agenda, Pacientes, Financeiro, IA, Equipe) + user/sign-out in a 240px fixed left column. The DashboardLayout wrapping is already there — it just renders nothing.

2. **Typography weight contract broken across the entire codebase** — The spec declares exactly 2 weights: 400 (regular) and 600 (semibold). The implemented code uses `font-bold` (700) in 10 places and `font-medium` (500) in at least 20 application-level locations. This produces three effective heading weights (medium, semibold, bold) that erode visual hierarchy. The worst offenders are: all auth form FYNXIA wordmarks (`text-3xl font-bold`), the /clinica hub clinic name (`text-2xl font-bold`), the /agendar and /anamnese public headings (`text-2xl font-bold`), and the /equipe page (entirely written with `font-bold` + `font-medium`). Fix: standardize to `font-semibold` for all headings/labels, `font-normal` for body. The `font-bold` FYNXIA wordmark on auth pages is actually defensible for brand impact — document it as a brand exception in the spec rather than an accident.

3. **Equipe page is an isolated design system island** — `src/app/(dashboard)/clinica/equipe/page.tsx` was written with raw `slate-*` and `gray-50` Tailwind classes, bypassing the entire CSS variable token system. It uses `bg-gray-50` (background), `bg-white` (cards), `text-slate-900/600/500/400`, `border-slate-200`, `bg-amber-50 border-amber-200` (warning state), `bg-yellow-100 text-yellow-800` (badge), and a raw `<table>` instead of the shadcn Table component. It also uses `text-2xl font-bold`, `text-lg font-semibold`, and a "← Voltar" anchor link instead of the Breadcrumb pattern used everywhere else. Visually it will render differently from every other authenticated page. Fix: rewrite using design tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`) and the shadcn Table/Badge/Breadcrumb components.

---

## Design Direction Recommendation

FYNXIA v1 is functionally complete but architecturally "flat" — it is a collection of loosely connected pages rather than a unified application. The single highest-leverage design investment for clarity and polish is **a persistent sidebar shell**. Without it, every page feels like it could be the entire app. A 240px sidebar with module icons + labels, the FYNXIA logo at top, and user info at bottom would:

- Give users constant orientation (wayfinding)
- Make the CopilotTrigger FAB feel less intrusive (it currently floats over a blank canvas)
- Allow breadcrumbs to shrink (they would no longer need to anchor back to "Clínica")
- Enable the hub pages (clinica/page.tsx, financeiro/page.tsx) to be retired or repurposed as dashboards with summary widgets

Secondary priorities in order of impact:
- Add `loading.tsx` files per route segment (Next.js 14 convention) to show Skeleton states during server fetches — currently all pages load blank then pop in
- Normalize typography to the 2-weight system (it takes an hour to grep-replace)
- Strengthen empty states by adding a contextual icon (e.g., `CalendarX` for agenda, `UserX` for patients) above the heading — currently they are text-only
- Add a "quick stats" strip to clinica/page.tsx (patients count, today's appointments, open receivables) so the hub is informative rather than just a nav menu

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**What works:** CTA labels across all modules match the spec contract precisely — "Salvar Agendamento", "Cadastrar Paciente", "Salvar Alterações", "Registrar Atendimento", "Emitir Cobrança", "Lançar Transação", "Assinar e Enviar", "Confirmar Agendamento". Error messages are in pt-BR and specific (not generic "An error occurred"). The copilot uses exact spec copy: "Copiloto FYNXIA", "Pergunte sobre sua clínica...", "Olá, como posso ajudar?", "Faça uma pergunta…".

**Issues:**

- `src/components/agenda/AgendaCalendar.tsx:184` — Button label `'Salvando...'` uses three ASCII dots instead of the ellipsis character (`…`) used in all other loading states. Minor inconsistency but breaks scan-matching.
- `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx:154-165` and `:168-179` — The Prontuário and Odontograma tab panels inside the patient detail page render as "stub" cards with generic "Acesse o prontuário completo..." copy and a hardcoded `bg-primary` anchor link styled to look like a Button but is actually a plain `<a>`. These tabs exist as placeholders despite the routes being live. A user clicking "Prontuário" in the tab bar would expect the content there, not a redirect card. The spec calls for the patient chart to contain the content in tabs.
- `src/app/(dashboard)/clinica/financeiro/contas-a-receber/page.tsx:89` — Empty state heading uses `text-sm font-medium` (not `font-semibold` as specified for empty state headings).
- `src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx:151` — Same issue: empty state heading uses `font-medium`.
- `src/app/(dashboard)/clinica/equipe/page.tsx:153` — Phase note "Gestão completa de equipe... disponível na Fase 2" is stale — the product is past Phase 5. Should be removed or updated.
- Public anamnesis page: title is "Anamnese Digital" (`src/app/anamnese/.../page.tsx:75`) but the spec names it "Anamnese Odontológica". Minor deviation.

**Verdict:** Contract 85% met. The main copy gaps are the stale phase note and the tab-stub placeholder UX.

---

### Pillar 2: Visuals (2/4)

**What works:** The FullCalendar implementation correctly follows the spec focal-point contract — the calendar grid fills the viewport, the header row is restrained. Cash flow totals correctly establish a visual anchor with `text-2xl` amounts. The copilot trigger button (48px circle, bottom-right, shadow-lg) is well-positioned. Navigation hub cards have a consistent hover treatment. Public pages use `max-w-lg mx-auto` centered containers as specified.

**Critical issues:**

**No persistent app shell.** Both `src/app/(dashboard)/layout.tsx` and `src/app/(dashboard)/clinica/layout.tsx` are passthrough renderers that add zero visual chrome. Every authenticated page is a free-floating `<main>` with no navigation context. The spec `Layout Patterns §Authenticated App Layout` declared a 240px fixed sidebar — it was never built. This is the most impactful visual gap in the product.

**Hub pages as the only navigation model.** The flow is: `/clinica` (hub) → module page → `/clinica` (hub again to go elsewhere). There is no cross-module navigation. On a deeply-nested page like `/clinica/pacientes/[id]/prontuario`, the only way back to the agenda is 4 breadcrumb clicks. With a sidebar, it would be 1 click.

**Patient detail tabs are stubs for two of four tabs.** The `Prontuário` and `Odontograma` tabs in `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx` render redirect cards instead of content. This is a focal-point failure — tabs imply content, not navigation. A user who opens a patient chart and clicks "Prontuário" expects to see the prontuário inline, not a card telling them to go somewhere else. (Human/visual judgment required — the redirect card may be intentional for layout reasons, but it will confuse users.)

**Empty states lack icons.** Every empty state in the product (patient list, cash flow, receivables, prontuário history) is text-only. The spec mentions icon usage contextually, and the visual pattern without an icon is very plain — a CalendarX, UserX, or ReceiptX icon above the heading would give these states visual weight and communicate the context immediately. The copilot's empty state follows this correctly with the SuggestedPrompts chip area providing visual content.

**The clinica/page.tsx hub renders the user's role and plan name** in the header: `"Perfil: dentist · Plano: free"`. Showing "free" plan to paying users or showing raw role slugs ("dentist" vs "Dentista") is both a copy and a visual concern. Needs capitalization and localization.

---

### Pillar 3: Color (3/4)

**What works:** Accent color (`--primary`) is correctly scoped in the core modules — used only for primary CTAs, icon accent on hub cards, CopilotTrigger background, active link hover states. The odontogram status colors are correctly isolated to the SVG component via `STATUS_COLORS` hex constants. Financial status badges (pendente/pago/vencido) use the spec-defined amber/green/red Tailwind classes. All design tokens in globals.css are correct and match the spec.

**Issues:**

**Equipe page breaks the token system completely** (`src/app/(dashboard)/clinica/equipe/page.tsx`). Uses `bg-gray-50`, `bg-white`, `text-slate-900`, `text-slate-600`, `text-slate-500`, `text-slate-400`, `border-slate-200`, `bg-slate-50`, `bg-amber-50 border-amber-200`, `bg-yellow-100 text-yellow-800`. In dark mode, this page will render incorrectly. The raw gray/slate scale has no dark-mode counterpart in the design system. Estimated 22 raw color class violations on this one page alone.

**Invite acceptance page** (`src/app/invite/[token]/page.tsx`) uses `bg-gray-50`, `text-slate-900`, `text-slate-500`, `border-slate-200` — same system break as equipe.

**The "Perfil" role display in the hub** uses `text-muted-foreground capitalize` which is correct token-wise but the value `"dentist"` gets capitalized to "Dentist" instead of "Dentista" — this is a copy + color context issue.

**Accent overuse on nav icons:** All module icons in `/clinica/page.tsx` and `/clinica/financeiro/page.tsx` use `text-primary` (`size-6 text-primary`). The spec reserves accent for CTAs, active nav state, and focus rings. Decorative nav card icons should use `text-muted-foreground` and shift to `text-primary` only on hover (which already happens via `group-hover:text-primary` on the title). Change the static icon `text-primary` to `text-muted-foreground`. This is a minor deviation with meaningful visual impact — right now every card is "shouting" accent color before any interaction.

---

### Pillar 4: Typography (2/4)

**What works:** Body copy is consistently `text-sm font-normal leading-relaxed`. Table cells are `text-sm`. Financial amounts correctly use `text-2xl font-semibold tabular-nums`. The copilot is fully compliant: `text-sm font-semibold` for the panel title, `text-sm font-normal` for message bodies. Breadcrumbs, muted metadata, and form labels follow the spec scale.

**Weight violations — the core problem:**

The spec declares exactly 2 weights: 400 and 600. The codebase uses 4: 400 (`font-normal`), 500 (`font-medium`), 600 (`font-semibold`), and 700 (`font-bold`).

- `font-bold` (700) appears 10 times in application code, all in headings: auth FYNXIA wordmarks (`LoginForm.tsx:36`, `SignupForm.tsx:38`, `ForgotPasswordForm.tsx:37`, `reset-password/page.tsx:39`), hub clinic name (`clinica/page.tsx:68`), public page headings (`agendar/.../page.tsx:59`, `anamnese/.../page.tsx:75`), and equipe (`equipe/page.tsx:53`). The auth/public `font-bold` on "FYNXIA" creates a 3-weight scale: the wordmark is bolder than page titles, which are bolder than labels. This produces inconsistent perceived hierarchy.
- `font-medium` (500) appears in at least 20 non-UI-component locations. Notable: all column header `<th>` elements in the equipe raw table, the month label in cash flow, several inline link labels, and the `reset-password` form label.

**Undeclared type sizes:**
- `text-3xl` (30px) — auth FYNXIA wordmark. Not in spec (spec max is `text-2xl`/28px Display role). 6 occurrences.
- `text-lg` (18px) — equipe section headings. Not in spec (spec goes xl→base, skipping lg). 2 occurrences.
- `text-base` (16px) — used for empty state headings and a card title. Spec declares body at `text-sm` (14px) and the next step is `text-xl` (20px). The `text-base` usage at 16px creates a mid-size that is not clearly body or heading.

**Impact:** The visual hierarchy across authenticated pages is undermined. Page titles are `text-xl font-semibold`, section headings are `text-base font-semibold` (correct), but sub-section elements sometimes use `text-base` (16px) and sometimes `text-sm` (14px) — creating 3-4 effective body sizes that compete.

---

### Pillar 5: Spacing (3/4)

**What works:** The 8pt grid is consistently applied across all financial, clinical, and copilot components. `p-4`/`p-6`/`p-8` page padding, `gap-4`/`gap-6` grid gaps, `space-y-4`/`space-y-6`/`space-y-8` stacked sections. The CashFlowTotals `min-h-[72px]` card exception is correctly documented. The copilot `p-4`/`p-6` header/input padding follows the spec. Public pages use `py-8 px-4` container padding matching the spec.

**Issues:**

**Inconsistent page-level padding patterns.** Financial pages use `p-8 min-h-screen` in a `<main>` with `max-w-4xl`/`max-w-5xl mx-auto`. Clinical pages (pacientes, prontuario) use `p-4` with no max-width or centering. Agenda uses no page-level padding at all (correct for a full-viewport calendar). The result is noticeable inconsistency: the financeiro pages feel "padded and contained" while the clinical pages feel "flush and raw."

**Agenda page missing page-level top padding.** `src/app/(dashboard)/clinica/agenda/page.tsx` wraps content in `<div className="flex h-full flex-col">` with no padding. The `<h1 className="text-xl font-semibold">` in the border-b header has `px-4 py-3` but renders flush against the viewport edge. With no sidebar shell this is tolerable, but with a sidebar it will look cramped.

**Equipe page spacing deviations.** Section header uses `px-6 py-5`, content uses `px-6 py-6` — these are close to spec `p-6` but the `py-5` is an off-grid value (20px, not 24px). The pendente invite table uses `py-3` cell padding which is 12px (off-grid).

**Arbitrary values that are non-compliant but justified:** `min-w-[120px]` on the month label (cash flow), `w-[240px]` on the dentist Select. These are reasonable one-off constraints and not worth normalizing.

---

### Pillar 6: Experience Design (2/4)

**What works:** Form submission states are consistently handled — every submit button shows a loading label ("Enviando...", "Salvando...", "Entrando…"). Error states exist for all major mutations via inline Alert components. The copilot has excellent state coverage: typing indicator, streaming cursor, error bubbles, empty-state suggestions, clear-conversation. The anamnesis token-expired page is a well-designed full-page error state. Public booking handles no-slots and race conditions per spec.

**Critical gaps:**

**No Skeleton loading states for data-fetching routes.** All authenticated pages are Server Components that block on data fetches. There is no `loading.tsx` in any route segment. Users hitting `/clinica/pacientes` with 500 patients, or `/clinica/financeiro/fluxo-de-caixa` during a slow Supabase call, see a blank screen (or the browser's default loading state) until the full page renders. The spec explicitly lists `Skeleton` in the component inventory. Fix: add `loading.tsx` files in at minimum: `/clinica/pacientes/`, `/clinica/agenda/`, `/clinica/financeiro/fluxo-de-caixa/`, `/clinica/financeiro/contas-a-receber/`.

**No ErrorBoundary anywhere.** Zero occurrences of `ErrorBoundary` in the entire codebase. If a Server Component throws, Next.js will show the default error page. The spec requires error state handling. Fix: add `error.tsx` files alongside `loading.tsx` files, using the spec's generic error copy: "Ocorreu um erro. Tente novamente."

**Patient table actions are redundant.** `PatientTable.tsx:149-173` has both an `Eye` (view) button and a `Pencil` (edit) button, but both navigate to the same URL (`/clinica/pacientes/[id]`). The comment `// WR-07: no /editar route exists — editing lives in the detail page's "Dados" tab` confirms this. From a UX perspective, having two distinct icon buttons that do the same thing is confusing. Either remove the Pencil button or route it directly to `?tab=dados`.

**Patient sorting is not keyboard-accessible.** The `PatientTable` has `getSortedRowModel()` wired up but no sort trigger in the column headers — no `onClick` on `<TableHead>`. Users cannot sort the patient list. The spec's Table component contract implies sortable columns.

**Agenda dentist filter has no "show all" option after selection.** The Select has `placeholder="Selecionar dentista..."` but once a dentist is selected, there is no way to return to "all dentists" view via the dropdown. `onValueChange={(v) => setDentistId(v || null)}` handles empty string, but the SelectContent has no "Todos os dentistas" item. A user who selects dentist A cannot see all appointments without clearing the URL manually.

**Prontuário and Odontograma are separate pages, not inline tabs.** The patient detail tab bar shows "Prontuário" and "Odontograma" as tabs, but clicking them renders redirect cards pointing to separate routes. This is a navigation dead-end and breaks the tab mental model. (Visual judgment required.)

**Missing loading feedback on PDF download buttons.** The `"Baixar Prontuário PDF"` button in `prontuario/page.tsx:95-101` is a plain `<a>` anchor. The spec requires "Button shows loading spinner (skeleton) during generation." The plain anchor gives no feedback — the user will click it and nothing visible happens for several seconds while the PDF renders server-side.

---

## Per-Module Observations

### Auth Module
Files: `src/components/auth/LoginForm.tsx`, `SignupForm.tsx`, `ForgotPasswordForm.tsx`, `src/app/(auth)/reset-password/page.tsx`

The auth forms are clean and functional. The FYNXIA wordmark treatment (`text-3xl font-bold text-primary`) is visually strong and creates a good brand moment. However, `font-bold` is not in the spec — it should be documented as a brand exception. The `reset-password/page.tsx` uses raw HTML `<label>` with `font-medium` instead of the shadcn Form + Label pattern used in `PatientForm.tsx`. Minor inconsistency in the form pattern across auth pages.

### Hub + Nav
Files: `src/app/(dashboard)/clinica/page.tsx`, `clinica/layout.tsx`

The hub card grid pattern is well-executed. The icon cards have good hover states and the dashed-border booking link section adds visual variety. The weakness is structural: this page is doing too much work as the primary navigation mechanism. The missing sidebar means it is also the only reliable navigation surface in the app. The `"FYNXIA"` label above the clinic name is `text-xs uppercase tracking-widest` — a reasonable brand treatment that is off-spec (not in the type scale) but visually appropriate.

### Clinical Module
Files: agenda, pacientes, prontuario, odontograma, anamneses

The AgendaCalendar is the strongest implementation in the product — the FullCalendar config matches the spec exactly (locale, slotMinTime, slotMaxTime, status colors, event aria-labels). The PatientTable has correct masking logic and TanStack Table integration. The prontuário card layout is clean with good use of `CardHeader`/`CardContent` and the metadata labeling pattern (`text-xs font-semibold uppercase tracking-wide text-muted-foreground`).

Clarity concern: the agenda empty state fires incorrectly — it shows "Nenhuma consulta esta semana" when `dentists.length === 0`, not when there are no appointments. If no dentists are configured, the user sees an empty state that suggests they should click a calendar slot — but the calendar is not even rendered. The message is misleading. Should check appointment count, not dentist count.

### Financial Module
Files: fluxo-de-caixa, contas-a-receber, nova-cobranca, regua-de-cobranca + all financeiro components

Strong implementation. `CashFlowTotals` is the best visual component in the product — the 3-card grid with tabular-nums Display-size amounts, green/red color coding, and aria-labels follows the spec precisely. `ReceivablesTable` correctly handles the installment accordion pattern and client-side `vencido` derivation. `formatBRL` and `formatBRLSigned` are correctly used throughout.

Clarity concern: `fluxo-de-caixa/page.tsx` uses `<main className="min-h-screen bg-background p-8">` which is correct, but the max-width is `max-w-4xl` while `contas-a-receber` uses `max-w-5xl`. Minor inconsistency that will be visible when both pages are in use side-by-side.

### AI / Copilot Module
Files: `src/components/copilot/*`, `src/app/(dashboard)/clinica/ia/agentes/page.tsx`

The copilot implementation is spec-complete and the highest-quality module in the v1 build. Every interaction contract is implemented: streaming cursor, typing indicator, suggested prompts with pathname routing, clear-conversation, error bubbles with `text-destructive`. The AI SDK v6 migration (using `sendMessage`/`status` instead of `handleSubmit`/`isLoading`) is cleanly handled.

One spec deviation: `CopilotSidebar.tsx:58` renders the Bot icon as `text-primary` in the header. The spec says the header Bot icon should be a decorative label element, not an accent color usage. Minor.

The `AgentOutreachLog` is a plain HTML `<table>` (not shadcn Table), which is fine for a simple read-only log, but it introduces a third table rendering pattern alongside PatientTable (TanStack + shadcn Table) and EquipePage (raw `<table>` with slate classes).

### Public Pages
Files: `/agendar/[clinic-slug]`, `/anamnese/[patient-id]/[token]`, `/invite/[token]`

Public booking and anamnesis pages are well-implemented for mobile-first usage with `max-w-lg mx-auto` containers. The anamnesis progress indicator is visually clean. The invalid-token error state uses `AlertCircle` icon — the only empty state in the product with an icon, which makes it ironically the best empty state.

The `/invite/[token]` page is entirely off-design-system: `bg-gray-50`, `text-slate-900`, `text-slate-500`, raw `font-bold`, and `border-slate-200`. It also uses `text-3xl font-bold tracking-tight text-slate-900` for the FYNXIA wordmark (while auth pages use `text-primary` correctly).

### Team Management
Files: `src/app/(dashboard)/clinica/equipe/page.tsx`

This is the most design-inconsistent page in the product. It was written with a different design vocabulary: raw slate/gray token scale, no shadcn Table, `text-lg` section headings, `bg-gray-50` page background, `bg-white` cards, `<header>` + `<main>` semantic layout with custom border colors. It is visually functional but will render differently from all other authenticated pages, especially in any dark mode scenario. The "← Voltar" link is the only page in the product not using the Breadcrumb component.

---

## Files Audited

**Design tokens & shell:**
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/clinica/layout.tsx`
- `src/app/(auth)/layout.tsx`

**Auth:**
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/signup/page.tsx`
- `src/components/auth/LoginForm.tsx`
- `src/components/auth/SignupForm.tsx`
- `src/components/auth/ForgotPasswordForm.tsx`
- `src/app/(auth)/reset-password/page.tsx`

**Dashboard hub:**
- `src/app/(dashboard)/clinica/page.tsx`
- `src/app/(dashboard)/clinica/financeiro/page.tsx`

**Clinical:**
- `src/app/(dashboard)/clinica/agenda/page.tsx`
- `src/components/agenda/AgendaCalendar.tsx`
- `src/app/(dashboard)/clinica/pacientes/page.tsx`
- `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx`
- `src/app/(dashboard)/clinica/pacientes/[id]/prontuario/page.tsx`
- `src/components/patients/PatientTable.tsx`
- `src/components/patients/PatientForm.tsx`

**Financial:**
- `src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx`
- `src/app/(dashboard)/clinica/financeiro/contas-a-receber/page.tsx`
- `src/app/(dashboard)/clinica/financeiro/nova-cobranca/page.tsx`
- `src/components/financeiro/CashFlowTotals.tsx`
- `src/components/financeiro/TransactionList.tsx`
- `src/components/financeiro/ReceivablesTable.tsx`

**AI / Copilot:**
- `src/components/copilot/CopilotTrigger.tsx`
- `src/components/copilot/CopilotSidebar.tsx`
- `src/components/copilot/MessageList.tsx`
- `src/components/copilot/MessageBubble.tsx`
- `src/components/copilot/CopilotInput.tsx`
- `src/components/copilot/SuggestedPrompts.tsx`
- `src/components/copilot/AgentOutreachLog.tsx`
- `src/app/(dashboard)/clinica/ia/agentes/page.tsx`

**Public:**
- `src/app/agendar/[clinic-slug]/page.tsx`
- `src/app/anamnese/[patient-id]/[token]/page.tsx`
- `src/app/invite/[token]/page.tsx`

**Team:**
- `src/app/(dashboard)/clinica/equipe/page.tsx`
