---
phase: 18-crc-marketing
plan: 09
subsystem: ui
tags: [react-hook-form, zod, shadcn-tabs, approval-inbox, campaigns, base-ui]

# Dependency graph
requires:
  - phase: 18-crc-marketing (Plan 05)
    provides: campaign lifecycle Server Actions (createCampaign, updateCampaign,
      cancelCampaign, previewCampaignSegment, requestCampaignPersonalization,
      submitCampaignForApproval, approveCampaignAndDispatch, rejectCampaign,
      listCampaigns)
  - phase: 10-ia-governada-l0-l4-auditoria-ocr (Plan 07)
    provides: ApprovalInbox.tsx / approval_requests inbox (AIG-02, AUD-02)
provides:
  - "/clinica/crc/campanhas page + CampaignsTable (status badges, row actions)"
  - "CampaignFormDialog 3-step wizard (Segmento / Canal e Mensagem / Revisão)"
  - "SegmentPreview eligible-count component"
  - "ApprovalInbox campaign card branch with gated approve/reject dispatch"
affects: [18-10, 18-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CampaignFormDialog reused across create/edit/view modes via a single
      persistCampaign() helper that calls createCampaign on first call and
      updateCampaign thereafter, keyed off a local campaignId state."
    - "AI personalization sample: single requestCampaignPersonalization call
      per dialog session; 2-3 chat-bubble previews derived client-side by
      substituting the primary sample's first name (no extra LLM calls,
      first-name-only per D-09/LGPD-ZDR)."
    - "ApprovalInbox discriminates crc-campaign rows by
      (type==='ai_action' && agent_key==='crc-campaign') and routes
      approve/reject through approveCampaignAndDispatch/rejectCampaign instead
      of the generic approveRequest/rejectRequest wrappers."

key-files:
  created:
    - src/app/(dashboard)/clinica/crc/campanhas/page.tsx
    - src/components/crc/CampaignsTable.tsx
    - src/components/crc/CampaignFormDialog.tsx
    - src/components/crc/SegmentPreview.tsx
  modified:
    - src/components/conformidade/ApprovalInbox.tsx
    - src/actions/campaigns.ts

key-decisions:
  - "listCampaigns() extended to also select the filters JSON column (Rule 1
    auto-fix) — CampaignsTable's segment filter badges and
    CampaignFormDialog's edit-mode prefill both need it; the original Plan 05
    read query silently dropped it."
  - "CampaignFormDialog's campaignId lifecycle unifies create/edit: first
    'Pré-visualizar Segmento' click calls createCampaign() once; every
    subsequent persist calls updateCampaign() with the same id — this works
    identically whether the dialog opened in create or edit mode."
  - "ApprovalInbox's reject button uses variant='outline' (not destructive)
    for crc-campaign rows only, per 18-UI-SPEC Copywriting Contract; all
    other ai_action/estorno rows keep the pre-existing destructive variant
    untouched."

patterns-established:
  - "Campaign approval card confirmation: approving a crc-campaign row is
    gated behind an extra AlertDialog ('Confirmar disparo em massa') before
    calling approveCampaignAndDispatch — distinct from the one-click approve
    used by all other approval_requests rows."

requirements-completed: []  # CRC-03 not marked complete — Task 4 (human-verify checkpoint) is pending, see below.

# Metrics
duration: ~35min
completed: 2026-07-13
---

# Phase 18 Plan 09: Reactivation Campaign UI + Approval-Gated Dispatch Summary

**3-step CampaignFormDialog (Segmento → Canal e Mensagem → Revisão) wired to Plan 05's campaign actions, plus an ApprovalInbox campaign card that routes approve/reject through approveCampaignAndDispatch/rejectCampaign instead of the generic approval wrappers — no send path bypasses human approval.**

## Performance

- **Duration:** ~35 min (build tasks only; Task 4 is a pending human-verify checkpoint)
- **Started:** 2026-07-13T21:55:00Z
- **Completed (build tasks):** 2026-07-13T22:30:40Z
- **Tasks:** 3 of 4 complete (Task 4 is `checkpoint:human-verify`, not executed — see "Checkpoint Status" below)
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- `/clinica/crc/campanhas` RSC page + `CampaignsTable`: status badges
  (Rascunho/Aguardando Aprovação/Aprovada/Enviada/Rejeitada/Cancelada),
  Segmento/Canal/Destinatários columns, DropdownMenu row actions (Ver
  Detalhes, Editar rascunho-only, Enviar para Aprovação, Cancelar) wired
  directly to Plan 05 Server Actions with AlertDialog confirmations matching
  the 18-UI-SPEC Copywriting Contract.
- `CampaignFormDialog`: single component reused for create/edit/view, 3
  internal shadcn Tabs steps. Segment preview via `previewCampaignSegment`,
  AI personalization sample via `requestCampaignPersonalization` (first-name
  interpolation only), final "Enviar para Aprovação" calls
  `submitCampaignForApproval` exclusively — never
  `approveCampaignAndDispatch` (verified via `! grep -q
  "approveCampaignAndDispatch" CampaignFormDialog.tsx`).
- `ApprovalInbox.tsx` extended (not replaced) with a `crc-campaign`
  discriminator: `requestSummary()` renders "Campanha: {N} destinatários via
  {canal} — preview: {msg}" (counts + AI preview text only, no patient PII);
  approving now calls `approveCampaignAndDispatch(row.id,
  payload.campaignId)` behind a "Confirmar disparo em massa" AlertDialog;
  rejecting calls `rejectCampaign(row.id, payload.campaignId, reason)`.
  Non-campaign rows (other `ai_action`/`estorno`) are untouched.

## Task Commits

1. **Task 1: Campaigns page + CampaignsTable** - `a3b9f7b` (feat)
2. **Task 2: CampaignFormDialog (3 steps) + SegmentPreview** - `e565106` (feat)
3. **Task 3: ApprovalInbox — campaign card branch + Aprovar Disparo** - `0833418` (feat)

**Task 4 (checkpoint:human-verify) — NOT executed.** Live create→approve→send
verification requires an authenticated browser session (and optionally live
Meta/Resend credentials) that this executor does not have. See "Checkpoint
Status" below.

## Files Created/Modified

- `src/app/(dashboard)/clinica/crc/campanhas/page.tsx` - RSC page: fetches
  listCampaigns/listUnits/listServices, "Nova Campanha" header action, empty
  state.
- `src/components/crc/CampaignsTable.tsx` - Status-badged list + row actions
  (Ver Detalhes/Editar/Enviar para Aprovação/Cancelar).
- `src/components/crc/CampaignFormDialog.tsx` - 3-step create/edit/view
  wizard; submit routes only to `submitCampaignForApproval`.
- `src/components/crc/SegmentPreview.tsx` - Eligible-count display + empty
  segment state.
- `src/components/conformidade/ApprovalInbox.tsx` - Campaign card branch
  (`requestSummary`, gated approve/reject).
- `src/actions/campaigns.ts` - `listCampaigns()` now also selects `filters`
  (Rule 1 deviation, see below).

## Decisions Made

- `listCampaigns()` extended to select `filters` — needed by both new
  components; the original Plan 05 query omitted it.
- `CampaignFormDialog` unifies create/edit through a single `campaignId`
  state + `persistCampaign()` helper (create on first persist, update on
  every subsequent one) rather than branching the whole component by mode.
- AI personalization "2-3 samples" (18-UI-SPEC Passo 2) are derived
  client-side from the single `requestCampaignPersonalization` response by
  substituting the primary sample's first name with the other segment
  sample names — avoids extra LLM calls while still showing multiple
  first-name-only previews.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `listCampaigns()` did not select the `filters` column**
- **Found during:** Task 1 (CampaignsTable segment badges) / Task 2
  (CampaignFormDialog edit-mode prefill)
- **Issue:** The Plan 05 `listCampaigns()` read query selected
  `inactive_days` but not `filters` — without it, `CampaignsTable` cannot
  render "Procedimento/Faixa etária/Unidade" filter badges and
  `CampaignFormDialog` cannot restore optional segment filters when
  re-opening a rascunho campaign for editing.
- **Fix:** Added `filters` to the `.select()` string and cast/mapped it to
  `CampaignSegmentInput | null` in the return value.
- **Files modified:** `src/actions/campaigns.ts`
- **Verification:** `npx tsc --noEmit` clean for the file; consumed by both
  `CampaignsTable.tsx` and `CampaignFormDialog.tsx` without further changes.
- **Committed in:** `a3b9f7b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug/correctness)
**Impact on plan:** Necessary for the Editar flow and segment filter badges
to work correctly; no scope creep beyond the already-planned `files_modified`
components' needs.

## Issues Encountered

None beyond the deviation above.

## Checkpoint Status

**Task 4 (`checkpoint:human-verify`, gate="blocking") was reached but NOT
executed by this agent.** Per the plan, this task requires a live
authenticated browser session walking through: create campaign → preview
segment → generate AI personalization → submit for approval → approve in the
conformidade inbox → (optionally, with live Meta/Resend credentials) confirm
a real send → confirm rejecting a campaign leaves it "Rejeitada" and sends
nothing. This executor has no browser/authentication access and does not
fabricate this result.

A local dev server was already running on `http://localhost:3000` at the end
of this session (confirmed via `netstat`/`curl` — both
`/clinica/crc/campanhas` and `/conformidade/aprovacoes` respond with the
expected auth-gate redirect rather than a 500, i.e. no server-side compile
crash). All three build tasks pass their own `npx tsc --noEmit` acceptance
criteria and the acceptance-criteria greps specified in the plan
(`pointer-events-none`, `updateCampaign`, `cancelCampaign`,
`submitCampaignForApproval`, `requestCampaignPersonalization`, `! grep
approveCampaignAndDispatch` in the dialog, `crc-campaign`,
`approveCampaignAndDispatch`, `rejectCampaign`, `Aprovar Disparo` in
ApprovalInbox).

**CRC-03 requirement is NOT marked complete** — the human-verify checkpoint
must pass first. `requirements-completed` above is intentionally empty.

## User Setup Required

None - no external service configuration required to reach the checkpoint.
Live WhatsApp/e-mail send verification (step 5 of `how-to-verify`) is
fail-soft if Meta/Resend credentials are absent (outbox row marked failed
rather than blocking the flow) per 18-VALIDATION.md.

## Next Phase Readiness

- All build/commit work for 18-09 is done and committed
  (`a3b9f7b`, `e565106`, `0833418`).
- Blocked on human verification of the live create→approve→send flow before
  18-09 can be marked fully complete and CRC-03 checked off.
- 18-10/18-11 (NPS, referral program) do not depend on this plan's UI and can
  proceed independently once resumed.

---
*Phase: 18-crc-marketing*
*Completed: pending (build tasks done 2026-07-13; checkpoint outstanding)*

## Self-Check: PASSED

All created/modified files verified present on disk; all 3 task commit
hashes (`a3b9f7b`, `e565106`, `0833418`) verified present in git log.
