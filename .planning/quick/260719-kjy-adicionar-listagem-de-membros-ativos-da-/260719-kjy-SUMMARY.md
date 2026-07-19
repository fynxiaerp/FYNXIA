---
phase: quick-260719-kjy
plan: 01
subsystem: ui
tags: [supabase, server-actions, rbac, multi-tenant, team-management]

# Dependency graph
requires:
  - phase: quick-260629-qji
    provides: /clinica/equipe page shell with InviteForm + Convites pendentes table
provides:
  - "updateTeamMemberName Server Action (role-gated, tenant-checked, audited)"
  - "EditMemberDialog client component for inline name editing"
  - "Membros da Equipe section listing all active tenant users"
affects: [equipe, users, team-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getActor() helper duplicated locally per action file (project convention, not shared import)"
    - "UPDATE .eq('id', x).eq('tenant_id', actor.tenant_id).select('id') as the WR-02 cross-tenant defense — 0 rows returned means blocked, not a DB error"
    - "DialogTrigger render-prop pattern (no asChild) for @base-ui/react Button inside Dialog"

key-files:
  created:
    - src/actions/team.ts
    - src/components/team/EditMemberDialog.tsx
  modified:
    - src/app/(dashboard)/clinica/equipe/page.tsx

key-decisions:
  - "updateTeamMemberName scoped strictly to full_name edits — no role/status/other-field editing, per plan's stated scope boundary"

patterns-established:
  - "Team member CRUD: role-gate → validate → tenant-filtered UPDATE → audit log, mirrors invitations.ts/appointments.ts conventions"

requirements-completed: [QUICK-260719-kjy]

# Metrics
duration: 23min
completed: 2026-07-19
---

# Quick Task 260719-kjy: Listagem de Membros Ativos da Equipe Summary

**Nova seção "Membros da Equipe" em /clinica/equipe lista usuários ativos do tenant com edição de full_name via Server Action com defesa WR-02 (tenant_id no WHERE do UPDATE).**

## Performance

- **Duration:** 23 min
- **Started:** 2026-07-19T14:32:47-03:00 (approx, from prior commit)
- **Completed:** 2026-07-19T14:55:00-03:00
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 edited)

## Accomplishments
- Admins podem ver todos os usuários ativos (não só convites) do tenant em `/clinica/equipe`, com Nome/E-mail/Perfil
- Admins podem corrigir `full_name` vazio de usuários já ativos (o gap que causava nomes em branco em vários Selects já corrigidos em sessões anteriores)
- WR-02 (isolamento cross-tenant) garantido no UPDATE via `.eq('id', userId).eq('tenant_id', actor.tenant_id)` — 0 linhas afetadas se o usuário pertence a outro tenant
- Evento de auditoria `team_member.updated` registrado a cada edição bem-sucedida

## Task Commits

Each task was committed atomically:

1. **Task 1: Criar Server Action updateTeamMemberName** - `5410663` (feat)
2. **Task 2: Criar EditMemberDialog (Client Component)** - `1cba8ab` (feat)
3. **Task 3: Adicionar seção "Membros da Equipe" em equipe/page.tsx** - `44d3ac2` (feat)

**Plan metadata:** commit pending (orchestrator handles docs commit)

## Files Created/Modified
- `src/actions/team.ts` - Server Action `updateTeamMemberName`: getActor() local helper, role-gate (admin/superadmin), name validation (trim, min 2 chars), tenant-filtered UPDATE with 0-row detection, `logBusinessEvent('team_member.updated')`
- `src/components/team/EditMemberDialog.tsx` - Client Component: controlled Dialog with DialogTrigger render-prop Button, pre-filled Input, calls `updateTeamMemberName`, `router.refresh()` on success, destructive Alert on error, "Salvando…" submitting state
- `src/app/(dashboard)/clinica/equipe/page.tsx` - Added tenant_id resolution from authenticated actor, `members` query (all active tenant users ordered by full_name), new "Membros da Equipe" section (EmptyState when empty, Table with Nome/E-mail/Perfil/[Ações admin-only] otherwise); "Convites pendentes" section untouched

## Decisions Made
- Followed the plan's interfaces exactly (getActor duplicated, not imported; UPDATE filter pattern; Dialog render-prop pattern mirrored from `PatientDeleteDialog.tsx`) — no deviations needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. `npx tsc --noEmit` showed zero errors attributable to the 3 new/modified files (pre-existing unrelated test-file errors in `src/__tests__/` and `src/lib/financeiro/__tests__/` were out of scope per the deviation rules' scope boundary — not touched). `npx next build` completed successfully with `/clinica/equipe` compiling as a dynamic Server Component route.

## Security Verification (WR-02)

Confirmed by direct code inspection of `src/actions/team.ts`:
```typescript
const { data: updated, error: updateError } = await supabase
  .from('users')
  .update({ full_name: trimmed })
  .eq('id', userId)
  .eq('tenant_id', actor.tenant_id) // WR-02: nunca confiar no id cru sem tenant check
  .select('id')
```
This is present exactly as specified — the tenant_id filter is non-negotiable and confirmed in place.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `/clinica/equipe` now provides a complete admin path to view and correct active member data — closes the gap that left 2 test dentists with empty `full_name`.
- No blockers. This quick task did not touch role/status editing (out of scope by design); a future task could extend `EditMemberDialog` if the business need arises.

---
*Phase: quick-260719-kjy*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: src/actions/team.ts
- FOUND: src/components/team/EditMemberDialog.tsx
- FOUND: src/app/(dashboard)/clinica/equipe/page.tsx
- FOUND: 5410663
- FOUND: 1cba8ab
- FOUND: 44d3ac2
