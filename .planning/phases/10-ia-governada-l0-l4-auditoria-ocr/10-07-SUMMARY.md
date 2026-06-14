---
phase: 10-ia-governada-l0-l4-auditoria-ocr
plan: "07"
subsystem: conformidade-ui
tags: [ui, conformidade, audit, approval, rsc, nuqs]
dependency_graph:
  requires:
    - 10-03 (approval-actions.ts — approveRequest, rejectRequest, assertNotReadOnly + canApprove)
    - 10-04 (audit-actions.ts — queryAuditLogs, createEstorno; audit-query-types.ts)
    - 10-02 (approval_requests migration; conformidade RBAC in proxy.ts)
  provides:
    - src/app/(dashboard)/conformidade/auditoria/page.tsx (full RSC audit screen — auth + role gate + filters + diff render)
    - src/components/conformidade/AuditTrail.tsx (nuqs filters + before/after diff + estorno dialog)
    - src/app/(dashboard)/conformidade/aprovacoes/page.tsx (RSC approval inbox — pending list)
    - src/components/conformidade/ApprovalInbox.tsx (approve/reject wired to Server Actions + cosmetic canApprove gate)
  affects:
    - Plans 08+ (any plan building further on conformidade UI)
tech_stack:
  added: []
  patterns:
    - RSC auth + role gate + serializable-only props to client (T-09-25 RSC boundary rule)
    - nuqs URL-state filters (shareable, bookmarkable, browser history-safe)
    - canApprove cosmetic disable (UX only) + server-side assertNotReadOnly + canApprove enforcement (T-10-29)
    - PII guard — only IDs/masked fields rendered in approval inbox (T-10-30)
    - isReadOnly boolean derived from role → hides estorno trigger cosmetically
    - Dialog (base-ui render-prop) for estorno + reject forms (RHF + Zod v3)
key_files:
  created:
    - src/components/conformidade/AuditTrail.tsx
    - src/app/(dashboard)/conformidade/aprovacoes/page.tsx
    - src/components/conformidade/ApprovalInbox.tsx
  modified:
    - src/app/(dashboard)/conformidade/auditoria/page.tsx (replaced Plan 04 scaffold with full Plan 07 implementation)
decisions:
  - "ApprovalInbox imports canApprove from policy-types.ts (not from approval-actions.ts) — approval-actions.ts is 'use server', re-exporting sync functions from it would break Turbopack build (same decision as Plan 03)"
  - "ApprovalRequestRow type exported from aprovacoes/page.tsx and imported by ApprovalInbox — avoids defining the type in two places; serializable shape only (no server objects)"
  - "No toast library available — inline Alert state used for success/error feedback (no external dependency needed)"
  - "AuditTrail receives initial rows from RSC server-fetch; nuqs filter changes call router.refresh() to trigger RSC re-fetch with new URL params rather than client-side re-call of Server Action"
  - "isReadOnly=true hides estorno button cosmetically; createEstorno calls assertNotReadOnly() server-side regardless — this is the documented double-gate pattern (T-10-17, T-10-29)"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-14T20:25:27Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 10 Plan 07: Conformidade UI — Audit Screen + Approval Inbox Summary

**One-liner:** RSC audit screen (nuqs filters + before/after diff + estorno dialog) and approval inbox (one queue for AI actions + estornos; approve/reject wired to Server Actions; alçada enforced server-side; cosmetic disable by role) under `/conformidade/*`.

## What Was Built

### Task 1: Audit screen — RSC page + AuditTrail client (AUD-01/03)

**`src/app/(dashboard)/conformidade/auditoria/page.tsx`** (RSC — no 'use client'):
- `createClient().auth.getUser()` + role gate via users table (`PERMITTED_ROLES = ['admin','superadmin','auditor','dpo']`)
- In-page Alert "Acesso restrito" for unauthenticated/unauthorized (v1 convention — no redirect)
- Derives `isReadOnly = role in ['auditor','dpo']` → passed to AuditTrail as plain boolean
- Reads nuqs searchParams (tableName, actorId, dateFrom, dateTo, page) for initial server-side fetch
- Calls `queryAuditLogs(filters)` server-side; passes only serializable `rows: AuditLogRow[]` to client (T-09-25)
- PageHeader with title "Auditoria", breadcrumbs [{label:'Conformidade'}, {label:'Auditoria'}]

**`src/components/conformidade/AuditTrail.tsx`** (`'use client'`):
- nuqs `useQueryState` for tableName/actorId/dateFrom/dateTo/page — shareable/bookmarkable filters
- Card-based row display: action badge, table_name badge, actor/record IDs (truncated), timestamp
- Expandable before/after diff: `old_values` (Antes) and `new_values` (Depois) side-by-side in `<pre>` blocks with JSON.stringify
- EstornoDialog (base-ui Dialog render-prop, NOT asChild): RHF + Zod v3 `motivo` (min 5 chars) → calls `createEstorno`; success shows inline Alert "Estorno solicitado — aguardando aprovação"
- `isReadOnly=true` hides EstornoDialog entirely (cosmetic UX; `createEstorno` enforces `assertNotReadOnly` server-side, T-10-17)
- Pagination controls (Anterior/Próxima) + empty state pt-BR

### Task 2: Approval inbox — RSC page + ApprovalInbox client (AIG-02, AUD-02)

**`src/app/(dashboard)/conformidade/aprovacoes/page.tsx`** (RSC):
- Same auth + role gate pattern; auditor/dpo allowed to view (readOnly notice) but cannot approve
- `createClient().from('approval_requests').select(...).eq('status','pending').order('created_at')` — RLS-scoped to tenant
- Passes serializable `rows: ApprovalRequestRow[]` + `actorRole: string` to `<ApprovalInbox>` (T-09-25)
- PageHeader "Aprovações", breadcrumbs [{label:'Conformidade'}, {label:'Aprovações'}]

**`src/components/conformidade/ApprovalInbox.tsx`** (`'use client'`):
- `requestSummary(row)`: ai_action → "Ação de IA: {agent_key} — {action}"; estorno → "Estorno: {tableName} / {recordId} — motivo: {reason}"
- **Cosmetic canApprove disable (UX only, T-10-29):** `canApprove(actorRole, row.required_role)` from `policy-types.ts` disables Approve + Reject buttons when insufficient alçada — with explanatory note to user
- Approve button → `approveRequest(id)` (no note); on success removes row from local state + router.refresh()
- Reject button → RejectDialog (base-ui Dialog render-prop): RHF + Zod v3 reason (min 5) → `rejectRequest(id, reason)`; on success removes row + router.refresh()
- **CRITICAL: server-side enforcement (key_link):** approveRequest/rejectRequest in `approval-actions.ts` call `await assertNotReadOnly()` + `canApprove(actor.role, request.required_role)` before any mutation — client disable is explicitly cosmetic (T-10-29)
- PII guard: only table/record IDs + action names rendered; raw CPF never echoed (T-10-30)

## Verification

- `npx vitest run src/__tests__/audit/audit-ui.test.ts src/__tests__/governance/approvals.test.ts` — **31/31 GREEN**
  - audit/audit-ui.test.ts: 12/12 GREEN (queryAuditLogs source-inspection + RSC page assertions)
  - governance/approvals.test.ts: 19/19 GREEN (canApprove alçada + approval-actions source-inspection + conformidade proxy)
- `npx tsc --noEmit` — **exit 0** (clean)
- `npx next build` — **green** (45 routes compiled; /conformidade/aprovacoes + /conformidade/auditoria both appear as ƒ Dynamic)

## Commits

| Hash | Message |
|------|---------|
| `f70cb35` | feat(10-07): audit screen RSC + AuditTrail client (AUD-01/03 + estorno trigger) |
| `a01535c` | feat(10-07): approval inbox RSC + ApprovalInbox client (AIG-02 + AUD-02) |

## Deviations from Plan

None — plan executed exactly as written. The two tasks map directly to the four delivered files.

## Known Stubs

None — all components have concrete wired implementations:
- AuditTrail: nuqs filters wired; diff display uses actual `old_values`/`new_values` from `AuditLogRow`; estorno dialog calls `createEstorno` (concrete in Plan 04)
- ApprovalInbox: approve/reject wired to actual Server Actions; `canApprove` from `policy-types.ts` is a concrete function (Plan 03)
- No placeholder text; no hardcoded empty data sources

## Threat Flags

No new threat surface beyond what the plan's threat model documents:

| Flag | File | Description |
|------|------|-------------|
| T-10-29 mitigated | src/components/conformidade/ApprovalInbox.tsx | Client-side canApprove disable is cosmetic — server enforces assertNotReadOnly + canApprove in approval-actions.ts; documented with inline comment |
| T-10-30 mitigated | src/components/conformidade/ApprovalInbox.tsx | requestSummary() renders only IDs + action labels; no raw PII fields echoed from payload |
| T-10-31 mitigated | src/app/(dashboard)/conformidade/aprovacoes/page.tsx | RLS on approval_requests scopes to tenant; audit query uses admin client + explicit tenant filter (Plan 04) |
| T-10-32 mitigated | Both RSC pages | auth.getUser() gate + role gate before any data access |

## Self-Check: PASSED

- [x] `src/app/(dashboard)/conformidade/auditoria/page.tsx` — exists (modified from Plan 04 scaffold), committed in f70cb35
- [x] `src/components/conformidade/AuditTrail.tsx` — exists, committed in f70cb35
- [x] `src/app/(dashboard)/conformidade/aprovacoes/page.tsx` — exists, committed in a01535c
- [x] `src/components/conformidade/ApprovalInbox.tsx` — exists, committed in a01535c
- [x] AuditoriaPage: no 'use client', references queryAuditLogs, passes serializable rows + isReadOnly bool
- [x] AuditTrail: 'use client', nuqs useQueryState, old_values + new_values rendered, isReadOnly hides estorno
- [x] ApprovalInbox: approveRequest + rejectRequest called, canApprove from policy-types.ts, assertNotReadOnly in approval-actions.ts (traceable key_link)
- [x] 12/12 audit-ui tests GREEN
- [x] 19/19 approvals tests GREEN
- [x] tsc exit 0
- [x] next build green (45 routes)
