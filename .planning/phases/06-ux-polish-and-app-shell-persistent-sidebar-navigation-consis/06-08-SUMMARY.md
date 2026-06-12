---
phase: "06"
plan: "08"
subsystem: "ux-polish"
tags: ["design-tokens", "shadcn-table", "empty-state", "copilot", "equipe", "ia-agentes"]
dependency_graph:
  requires: ["06-03", "06-04"]
  provides: ["equipe-token-clean", "agent-log-shadcn-table", "copilot-icon-muted"]
  affects: ["src/app/(dashboard)/clinica/equipe", "src/app/(dashboard)/clinica/ia/agentes", "src/components/copilot"]
tech_stack:
  added: []
  patterns:
    - "shadcn Table primitives replace all raw HTML <table> elements"
    - "EmptyState component used for zero-data states"
    - "shadcn Alert replaces amber-colored raw div"
    - "Badge variant=secondary for neutral status chips"
key_files:
  created: []
  modified:
    - "src/app/(dashboard)/clinica/equipe/page.tsx"
    - "src/components/copilot/AgentOutreachLog.tsx"
    - "src/components/copilot/CopilotSidebar.tsx"
decisions:
  - "Equipe empty state on pending invites section (not a separate top-level empty state) — invites section is where zero-members state surfaces"
  - "StatusBadge semantic colors (blue/green/red/yellow/emerald) preserved as financial semantic exception per UI-SPEC — only muted fallback uses tokens"
  - "AgentOutreachLog wraps Table in a rounded-lg border container for visual grouping matching app style"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-12T23:41:00Z"
  tasks_completed: 3
  files_modified: 3
---

# Phase 06 Plan 08: Team / AI-Log / Copilot Visual Sweep Summary

**One-liner:** shadcn Table replaces all raw HTML tables on equipe + AI agentes pages; Bot icon demoted from accent to muted; EmptyState + Alert tokens complete the design island cleanup.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Equipe full token rewrite | `763df04` | `src/app/(dashboard)/clinica/equipe/page.tsx` |
| 2 | IA/Agentes shadcn Table + EmptyState | `5744df5` | `src/components/copilot/AgentOutreachLog.tsx` |
| 3 | Copilot Bot-icon polish | `8c2d528` | `src/components/copilot/CopilotSidebar.tsx` |

---

## What Was Built

### Task 1 — Equipe page rewrite

- **shadcn Table** (`Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`) replaces the raw `<table>` for the pending-invites list
- **shadcn `Alert`** replaces the amber-colored `bg-amber-50 border-amber-200` non-admin warning box — fully token-clean
- **EmptyState** (`Users` icon, "Nenhum membro na equipe", body copy) shown when `pendingInvites` is empty
- **`Badge variant="secondary"`** replaces the raw `<span>` with hardcoded `bg-muted text-muted-foreground` for invite status chips
- PageHeader already present from a previous sweep; breadcrumbs and structure preserved
- All token classes already correct (bg-card, text-foreground, border-border, text-muted-foreground)

### Task 2 — AgentOutreachLog shadcn Table

- Raw `<table>` fully replaced with shadcn `Table` primitives (establishes single table pattern across the app)
- **EmptyState** (`BrainCircuit` icon, "Nenhuma ação registrada ainda") replaces plain text empty div
- **`font-medium` → `font-semibold`** in `StatusBadge` (typography contract: no font-medium in audited component files)
- Existing `maskPatientName` rendering (via `patient_name` field) preserved unchanged
- Status badge semantic colors preserved as per the financial semantic color exception in UI-SPEC

### Task 3 — CopilotSidebar Bot icon

- `Bot` icon class changed from `text-primary` to `text-muted-foreground`
- Decorative icons must not consume accent color (reserved: CTA buttons, active nav, focus rings, trigger button, send button)
- Zero functional changes — Phase 5 `useChat` v6 wiring (`sendMessage`/`status`/`DefaultChatTransport`) untouched

---

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/__tests__/ui/` | 125/125 PASS |
| `npx tsc --noEmit` | Exit 0 |
| `npx next build` | Green (29 routes compiled) |

---

## Deviations from Plan

**1. [Rule 2 - Missing functionality] Equipe page already had PageHeader and mostly correct tokens**

- **Found during:** Task 1
- **Issue:** The existing equipe page had already been partially updated with PageHeader and token classes in a prior sweep; the raw `<table>` and amber warning box were the remaining violations
- **Fix:** Applied only the remaining changes (shadcn Table, Alert, EmptyState, Badge)
- **Impact:** Plan objective fully achieved; no scope expansion

**2. [Rule 1 - Bug] `font-medium` in StatusBadge of AgentOutreachLog**

- **Found during:** Task 2
- **Issue:** `StatusBadge` used `font-medium` which violates the 2-weight typography contract (only 400/600 allowed)
- **Fix:** Changed to `font-semibold` per the Label role spec
- **Files modified:** `src/components/copilot/AgentOutreachLog.tsx`
- **Commit:** `5744df5`

**3. [Out of scope] loading.tsx and error.tsx already present**

- Both equipe and ia/agentes loading/error files existed from prior Wave-3 work; no re-creation needed

---

## Known Stubs

None — all data sources wired; no placeholder text remaining.

---

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Presentation-only modifications.

---

## Self-Check: PASSED

- `src/app/(dashboard)/clinica/equipe/page.tsx` — FOUND
- `src/components/copilot/AgentOutreachLog.tsx` — FOUND
- `src/components/copilot/CopilotSidebar.tsx` — FOUND
- Commit `763df04` — FOUND
- Commit `5744df5` — FOUND
- Commit `8c2d528` — FOUND
