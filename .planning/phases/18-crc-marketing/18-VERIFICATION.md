---
phase: 18-crc-marketing
verified: 2026-07-13T20:00:00Z
status: human_needed
score: 24/24 automated must-haves verified
overrides_applied: 0
human_verification:
  - test: "Kanban drag-and-drop (mouse + keyboard) — funil de leads"
    expected: "Dragging a lead card between columns (mouse) and moving it via KeyboardSensor (Tab/Space/Arrow) both persist the stage via moveLeadStage; dropping on Convertido opens the convert dialog before persisting, dropping on Perdido opens the reason dialog; the funil is fully operable without a mouse."
    why_human: "DnD interaction and keyboard-accessibility cannot be exercised by unit/source-inspection tests (18-07 Task 4, VALIDATION.md Manual-Only row 1)."
  - test: "Campaign create → approve → send end-to-end flow"
    expected: "3-step CampaignFormDialog creates a campaign, segment preview shows a real count, AI personalization sample renders, 'Enviar para Aprovação' moves status to Aguardando Aprovação with NO message sent; approving in the conformidade ApprovalInbox calls approveCampaignAndDispatch and (with live Meta/Resend creds) delivers a real WhatsApp/e-mail; rejecting leaves status Rejeitada and sends nothing."
    why_human: "Depends on an authenticated browser session and, for the live-send leg, real Meta/Resend credentials (18-09 Task 4, VALIDATION.md Manual-Only row 2)."
  - test: "Public NPS link → form → submit → panel classification"
    expected: "Opening /nps/[patient-id]/[token] on a mobile viewport renders a forced-light 0-10 form; submitting records the score once and shows a thank-you; reloading the same URL shows 'Link de Avaliação Inválido' (single-use enforced); a 0-6 submission surfaces the detractor banner in /clinica/crc/nps and can be marked treated; the score card shows the correct +N and breakdown."
    why_human: "Cross-device link→form→submit flow and visual/theme verification are not covered by source-inspection tests (18-10 Task 3, VALIDATION.md Manual-Only row 3)."
---

# Phase 18: CRC & Marketing Verification Report

**Phase Goal:** Deliver a CRM/marketing module for dental clinics — lead funnel with origin tracking and conversion analytics, campaign ROI (CPL/CAC) sourced from the financial module, AI-personalized reactivation campaigns dispatched only after human approval, automated post-visit NPS collection with promoter/neutral/detractor classification, and a referral program that tracks who referred whom and visible rewards.
**Verified:** 2026-07-13T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Lead cadastrado com origem percorre o funil + conversão por origem disponível | ✓ VERIFIED | `src/actions/leads.ts` exports `createLead`/`listLeadsByStage`/`moveLeadStage`/`convertLead`/`listConversionByOrigin`; `isValidStageTransition` imported and enforced; kanban UI (`LeadKanbanBoard.tsx`) calls `moveLeadStage` on drag end; `ConversionByOriginTable.tsx` renders `listConversionByOrigin()`. `leads.test.ts` (6/6) GREEN. |
| 2 | Painel de ROI mostra CPL/CAC a partir da origem financeira dos leads | ✓ VERIFIED | `src/actions/roi.ts` (`getRoiByCampaign`/`getRoiByOrigin`) sums `payables.valor_total WHERE campaign_id`, delegates to `computeCpl`/`computeCac` (never inline division); `/clinica/crc/roi/page.tsx` + `RoiKpiRow.tsx`/`RoiByOriginTable.tsx` render KPIs with `—` fallback; `PayableFormDialog.tsx` has a "Vincular a campanha" field wired to `payables.campaign_id`. |
| 3 | Campanha de reativação segmentada (WhatsApp/e-mail) com IA e aprovação humana obrigatória antes do envio | ✓ VERIFIED (build) / human_needed (live send) | `segment.ts` mandatory `marketing_whatsapp`/`revoked_at IS NULL` consent gate; `campaign-agent.ts` `buildCampaignMessage` with `zeroDataRetention:true` + static fallback; `campaigns.ts` `approveCampaignAndDispatch` enqueues via `getOutboxQueue` ONLY after `approveRequest()` succeeds (step order confirmed in source); `submitCampaignForApproval`/`rejectCampaign` never call `getOutboxQueue`; `ApprovalInbox.tsx` routes crc-campaign rows through `approveCampaignAndDispatch`/`rejectCampaign`. `campaigns.test.ts`/`segment.test.ts` (13/13) GREEN. Live create→approve→send is a pending human checkpoint (18-09 Task 4). |
| 4 | NPS automático pós-consulta com classificação promotor/neutro/detrator | ✓ VERIFIED (build) / human_needed (live flow) | `nps-scan.ts` `runNpsInviteScan` self-healing scan on `concluido` appointments with per-appointment `UNIQUE(appointment_id)` dedup; cron route `isCronAuthorized`-gated, registered in `vercel.json`; `nps.ts` `submitNpsPublic` atomic `UPDATE ... WHERE token_used_at IS NULL`; `NpsScoreCard`/`DetractorAlertBanner`/`NpsResponsesTable` consume `getNpsSummary`/`listNpsResponses`; public form never reveals classification. `nps-scan.test.ts` (6/6) GREEN. Cross-device link→form→submit is a pending human checkpoint (18-10 Task 3). |
| 5 | Programa de indicação rastreia quem indicou quem e recompensas ficam visíveis | ✓ VERIFIED | `referrals.ts` `linkReferral` (idempotent on 23505), `creditReferralReward` CAS on `credited_at IS NULL` + re-verify `stage==='convertido'`, server-side-only `REFERRAL_REWARD_DEFAULT`; `/clinica/crc/indicacoes` + `ReferralsTable`/`PatientRewardsBalanceTable` render KPIs, referral list, and per-patient balance with read-only statement Sheet. `referrals.test.ts` (5/5) GREEN. |

**Score:** 5/5 roadmap success criteria structurally verified in code; 3 of them retain a legitimately manual (not automatable) live/UI verification step.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/crc/roi-math.ts` | Pure CPL/CAC/NPS math | ✓ VERIFIED | `computeCpl`/`computeCac`/`classifyNps`/`computeNpsScore` exported; zero-denominator → null (never Infinity/NaN); 15 unit tests GREEN. |
| `src/lib/validators/crc.ts` | Zod v3 schemas + state machine | ✓ VERIFIED | `leadSchema`, `leadSourceSchema`, `campaignSegmentSchema`, `campaignChannelSchema`, `npsSubmitSchema`, `referralSchema`, `isValidStageTransition`, `LEAD_STAGES`; no `.default(` present; 32 unit tests GREEN. |
| `src/lib/whatsapp/templates.ts` | Reactivation + NPS-invite templates | ✓ VERIFIED | `TEMPLATE_REACTIVATION`, `TEMPLATE_NPS_INVITE`, `buildReactivationComponents`, `buildNpsInviteComponents` present alongside pre-existing exports. |
| 3 migrations (`20260712000100/200/300`) | 6 tables + payables FK + RLS | ✓ VERIFIED | `CREATE TABLE public.` count = 6; RLS `ENABLE ROW LEVEL SECURITY` count = 6; `WITH CHECK` count = 7; `payables.campaign_id` FK present; `seed_lead_sources_on_clinic` trigger present; live on project `jqjwyqlbbuqnrffdnlpp` (confirmed via regenerated types). |
| `src/types/database.types.ts` | Regenerated types | ✓ VERIFIED | Contains `leads:`, `nps_responses:`, `referral_rewards:`, `campaign_id`; ends with `} as const`. |
| `src/actions/lead-sources.ts`, `leads.ts` | Lead funnel Server Actions | ✓ VERIFIED | All exports present, WRITER_ROLES-gated, `isValidStageTransition` enforced, CAS on `convertLead`. |
| `src/actions/referrals.ts` | Referral program Server Actions | ✓ VERIFIED | `linkReferral`, `creditReferralReward`, `listReferrals`, `listRewardsBalance` all present, CAS-guarded. |
| `src/lib/crc/segment.ts`, `src/lib/agents/campaign-agent.ts`, `src/actions/campaigns.ts` | Campaign pipeline | ✓ VERIFIED | Consent gate, ZDR personalization, full lifecycle incl. approval-gated dispatch, reject/edit/cancel mutators. |
| `src/lib/crc/nps-scan.ts`, cron route, `src/actions/nps.ts` | NPS collection | ✓ VERIFIED | Self-healing scan, cron auth, atomic single-use submit, detractor treatment, summary reads. |
| `src/components/crc/LeadKanbanBoard.tsx` | dnd-kit board w/ keyboard a11y | ✓ VERIFIED (code) / human_needed (UX) | `DragDropProvider` + `moveLeadStage` present; `KanbanColumn.tsx` uses `useDroppable`; `LeadCard.tsx` documents auto-registered `KeyboardSensor`. Interaction correctness needs manual confirmation. |
| `src/app/(dashboard)/clinica/crc/funil/page.tsx` | Funil route | ✓ VERIFIED | Exists, fetches `listLeadsByStage`/`listLeadSources`/`listConversionByOrigin`. |
| `src/actions/roi.ts`, ROI page | ROI panel | ✓ VERIFIED | `getRoiByCampaign`/`getRoiByOrigin` exported, page renders KPI + origin table. |
| `src/components/crc/CampaignFormDialog.tsx` | 3-step campaign creation | ✓ VERIFIED | Shadcn `Tabs`, calls `submitCampaignForApproval` only (never `approveCampaignAndDispatch` — confirmed absent). |
| `src/components/conformidade/ApprovalInbox.tsx` | Campaign approval card branch | ✓ VERIFIED | `crc-campaign` discriminator, gated approve/reject routed through campaign-specific wrappers. |
| `src/app/nps/[patient-id]/[token]/page.tsx`, `NpsPublicForm.tsx` | Public NPS form | ✓ VERIFIED | Token validity check, forced `.light` theme, `aria-pressed` 0-10 buttons, `submitNpsPublic` call. |
| `src/app/(dashboard)/clinica/crc/indicacoes/page.tsx`, `PatientRewardsBalanceTable.tsx` | Referral program UI | ✓ VERIFIED | KPIs, referrals list, per-patient balance table, read-only statement Sheet (no manual balance edits). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `LeadKanbanBoard.tsx` | `src/actions/leads.ts` | `moveLeadStage` on drag end | ✓ WIRED | `moveLeadStage(leadId, toStage)` called in `handleDragEnd`, optimistic + rollback. |
| `LeadFormDialog.tsx` | `src/actions/referrals.ts` | `linkReferral` when origem=Indicação | ✓ WIRED | `createLead` (leads.ts) dynamic-imports and calls `linkReferral` when the source is "Indicação"; `leads.ts` also dynamic-imports `creditReferralReward` on conversion. |
| `campaigns.ts` | `approval-actions.ts` | `createApprovalRequest`/`approveRequest`/`rejectRequest` | ✓ WIRED | All three imported and called in the correct sequence; `approveCampaignAndDispatch` step 1 calls `approveRequest` before any enqueue. |
| `campaigns.ts` | `src/lib/messaging/queue.ts` | `getOutboxQueue().enqueue` after approval | ✓ WIRED | `getOutboxQueue` imported/used only inside `approveCampaignAndDispatch`, confirmed absent from `submitCampaignForApproval` and `rejectCampaign`. |
| `ApprovalInbox.tsx` | `campaigns.ts` | `approveCampaignAndDispatch`/`rejectCampaign` for crc-campaign rows | ✓ WIRED | Discriminated by `type==='ai_action' && agent_key==='crc-campaign'`; non-campaign rows keep generic `approveRequest`/`rejectRequest`. |
| `nps-scan/route.ts` | `nps-scan.ts` | `runNpsInviteScan` + `drainOutbox` | ✓ WIRED | Cron skeleton mirrors `collection-agent`; `isCronAuthorized` guard present. |
| `NpsPublicForm.tsx` | `src/actions/nps.ts` | `submitNpsPublic` | ✓ WIRED | Called on submit with `{patientId, token, score, comment}`. |
| `roi.ts` | `public.payables` | `SUM(valor_total) WHERE campaign_id` | ✓ WIRED | `getCostByCampaign` helper sums `valor_total` grouped by `campaign_id`, excludes `cancelado`/`deleted_at`. |
| `PayableFormDialog.tsx` | `payables.campaign_id` | "Vincular a campanha" write path | ✓ WIRED | Field present in schema + form, `createPayable`/`payableSchema` extended to accept `campaignId`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CRC unit/RED-turned-GREEN subset | `npx vitest run src/__tests__/crc` | 7 files, 77/77 tests passed | ✓ PASS |
| Full regression suite | `npx vitest run` | 106 files, 1753/1753 tests passed | ✓ PASS |
| Type-check (whole project) | `npx tsc --noEmit` | 41 pre-existing errors, all in unrelated `financeiro`/`faturamento` test files (confirmed via `deferred-items.md` and targeted grep — zero CRC-file matches) | ✓ PASS |
| Approve-gate never enqueues before approval | manual review of `campaigns.ts` (grep `getOutboxQueue` scope) | `getOutboxQueue` appears only inside `approveCampaignAndDispatch`, after `approveRequest()` success | ✓ PASS |
| Live app run (dev server / DnD / cron trigger / real send) | n/a — requires running app + browser session + external creds | not executable in this environment | ? SKIP → routed to Human Verification |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| CRC-01 | 18-03, 18-07 | Recepção/Marketing gerencia funil de leads com origem e status | ✓ SATISFIED (build) / human_needed (DnD UX) | `leads.ts`/`lead-sources.ts` + kanban UI fully wired; drag-and-drop + keyboard a11y is a pending manual checkpoint. |
| CRC-02 | 18-08 | Sistema calcula ROI por campanha (CPL, CAC) a partir da origem dos leads | ✓ SATISFIED | `roi.ts` + ROI panel + payables campaign-link field, all automated checks pass, no human checkpoint attached to this plan. |
| CRC-03 | 18-05, 18-09 | Campanhas disparam mensagens segmentadas via WhatsApp/e-mail com aprovação humana | ✓ SATISFIED (build) / human_needed (live send) | Full pipeline built and safety-reviewed; live create→approve→send is a pending manual checkpoint. |
| CRC-04 | 18-06, 18-10 | Sistema coleta NPS (0–10) e apura promotores/neutros/detratores | ✓ SATISFIED (build) / human_needed (live flow) | Cron + public form + panel built; cross-device link→form→submit is a pending manual checkpoint. |
| CRC-05 | 18-04, 18-11 | Programa de indicação rastreia quem indicou quem e recompensas | ✓ SATISFIED | `referrals.ts` + indicações UI, all automated checks pass, no human checkpoint attached to this plan. |

No orphaned requirements found — REQUIREMENTS.md's Phase 18 row (CRC-01..05) matches exactly the 5 requirement IDs declared across the 11 plans' frontmatter.

### Anti-Patterns Found

None. Scanned all Phase 18 action/lib files (`leads.ts`, `lead-sources.ts`, `referrals.ts`, `campaigns.ts`, `nps.ts`, `roi.ts`, `roi-math.ts`, `segment.ts`, `nps-scan.ts`, `campaign-agent.ts`) and all `src/components/crc/*.tsx` + CRC page routes for `TODO`/`FIXME`/`placeholder`/`not implemented`/`coming soon` markers. All matches found were legitimate form-input `placeholder=` attributes (e.g., "Nome completo do lead", "(00) 00000-0000") — not stub markers.

### Human Verification Required

### 1. Kanban drag-and-drop + keyboard accessibility

**Test:** `npm run dev`; visit `/clinica/crc/funil`. Drag a lead from "Novo" to "Contatado" with the mouse, reload, confirm persistence. Then Tab to a card, Space to pick up, Arrow to move column, Space to drop (or use the `LeadDetailSheet` stage `Select` fallback) — confirm the funil is fully operable without a mouse. Drag onto "Convertido" (create/link-patient dialog must appear before persisting) and onto "Perdido" (reason dialog must appear). Confirm the "CRC & Marketing" sidebar item and hub links work.
**Expected:** All interactions persist correctly via `moveLeadStage`/`convertLead`; keyboard path fully substitutes for mouse DnD.
**Why human:** DnD interaction and keyboard accessibility cannot be exercised by unit or source-inspection tests (per `18-VALIDATION.md` Manual-Only table).

### 2. Campaign create → approve → send end-to-end flow

**Test:** `/clinica/crc/campanhas` → "Nova Campanha" → set "inativo há 90 dias" → preview segment → check WhatsApp+E-mail → "Gerar Personalização com IA" → "Enviar para Aprovação" (confirm status becomes "Aguardando Aprovação" and nothing sends yet) → in the conformidade approval inbox, approve the campaign card (confirm status becomes "Enviada"; with live Meta/Resend creds, confirm a real message is received) → separately, confirm rejecting a campaign leaves it "Rejeitada" and sends nothing.
**Expected:** No send occurs before human approval; approved campaigns dispatch via the outbox; rejected campaigns never enqueue.
**Why human:** Requires an authenticated browser session and, for the live-send leg, real Meta/Resend credentials (per `18-VALIDATION.md` Manual-Only table).

### 3. Public NPS link → form → submit → panel classification

**Test:** Trigger an invite (run the nps-scan cron or insert a test `nps_responses` row), open `/nps/{patientId}/{token}` on a phone/mobile viewport, confirm forced light theme and 0-10 buttons, submit a score (e.g. 9) + comment → thank-you screen. Reload the same URL → "Link de Avaliação Inválido" (single-use enforced). Submit a 0-6 score from another token → confirm the detractor banner appears in `/clinica/crc/nps`, mark it treated, confirm the banner count drops. Confirm the score card shows the correct +N and breakdown.
**Expected:** Single-use token enforcement works; detractor classification never leaks to the patient; internal panel correctly classifies and tracks treatment.
**Why human:** Cross-device link→form→submit flow and forced-theme visual verification are not covered by source-inspection tests (per `18-VALIDATION.md` Manual-Only table).

### Gaps Summary

No gaps found. All 24 automated must-haves across the 11 plans (foundations, schema, lead funnel, referrals, campaigns, NPS, and all 6 UI surfaces) verified against the actual codebase — not just SUMMARY claims. Every safety-critical wiring point was independently confirmed by reading source (not just grepping for keywords): the approval→dispatch gap (no enqueue before `approveRequest()` success), the NPS TOCTOU-safe single-use submit, the referral CAS-guarded once-only credit, and the mandatory consent gate on campaign segmentation. Full regression suite (1753/1753) and the CRC subset (77/77) are GREEN, and `tsc --noEmit`'s 41 errors are confirmed pre-existing and unrelated (Phase 14-16 financeiro/faturamento test files, logged in `deferred-items.md`).

The only outstanding items are the 3 explicitly-scoped manual-only checkpoints (18-07 Task 4, 18-09 Task 4, 18-10 Task 3) that the plans themselves defer to a human because they require a running app, a real browser session, and/or live Meta/Resend credentials. These are not gaps in the implementation — they are the intended verification boundary per `18-VALIDATION.md`'s Manual-Only Verifications table. Status is therefore `human_needed`, not `gaps_found`.

Note: `.planning/REQUIREMENTS.md` currently marks CRC-01..05 as `[x]` complete, but the corresponding plan SUMMARYs (18-07, 18-09, 18-10) explicitly leave `requirements-completed: []` pending the human checkpoints. This is a pre-existing discrepancy in the requirements tracker, not something this verification introduces — flagged for the developer's awareness when closing out the 3 human checkpoints.

---

*Verified: 2026-07-13T20:00:00Z*
*Verifier: Claude (gsd-verifier)*
