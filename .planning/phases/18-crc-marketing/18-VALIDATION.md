---
phase: 18
slug: crc-marketing
status: draft
nyquist_compliant: true
wave_0_complete: false  # RED scaffolds authored in 18-01; GREEN as Waves 2-3 land
created: 2026-07-11
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated by the planner from RESEARCH.md §"Validation Architecture" and the per-plan tasks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — src/__tests__/**) |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npx vitest run src/__tests__/crc` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~2–5 s (crc subset) / full suite per project |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/crc`
- **After every plan wave:** Run `npx vitest run` (regression across prior phases)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 s (crc subset)

---

## Per-Task Verification Map

*Populated by the planner as plans are created (one row per task, mapped to CRC-01..05 and the phase threat register).*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|

| 18-01-01 | 01 | 1 | CRC-01..05 | T-18-01/02 | dnd install + WhatsApp reactivation/NPS template constants + builders | config | `npx tsc --noEmit` | — | ⬜ pending |
| 18-01-02 | 01 | 1 | CRC-02/04 | T-18-02 | computeCpl/computeCac null on zero denom; classifyNps buckets; validators reject bad input | unit (TDD) | `npx vitest run src/__tests__/crc/roi-math.test.ts src/__tests__/crc/validators.test.ts` | — | ⬜ pending |
| 18-01-03 | 01 | 1 | CRC-01..05 | — | RED source-inspection scaffolds for actions/agent/cron | unit (RED) | `npx vitest run src/__tests__/crc` | — | ⬜ pending |
| 18-02-01 | 02 | 1 | CRC-01..05 | T-18-03/04/05/06 | 6 tables + seed trigger; UNIQUE(appointment_id); no timezone-cast index | migration | `grep -c 'CREATE TABLE public\.' supabase/migrations/20260712000100_crc_tables.sql` | — | ⬜ pending |
| 18-02-02 | 02 | 1 | CRC-02/03 | T-18-03/04/05 | payables.campaign_id FK; RLS+WITH CHECK all 6 tables; nps/rewards service-role-only | migration | `grep -c 'ENABLE ROW LEVEL SECURITY' supabase/migrations/20260712000300_crc_rls.sql` | — | ⬜ pending |
| 18-02-03 | 02 | 1 | CRC-01..05 | — | [BLOCKING] db push + gen types truncation guard | cli | `grep -q 'nps_responses:' src/types/database.types.ts` | — | ⬜ pending |
| 18-03-01 | 03 | 2 | CRC-01 | T-18-07/10 | lead-sources CRUD, admin-gated soft-delete | unit | `npx tsc --noEmit` | — | ⬜ pending |
| 18-03-02 | 03 | 2 | CRC-01 | T-18-07/08/10 | createLead/moveLeadStage stage validation + WRITER_ROLES | unit | `npx vitest run src/__tests__/crc/leads.test.ts` | — | ⬜ pending |
| 18-03-03 | 03 | 2 | CRC-01 | T-18-08/09 | convertLead CAS + patient link + referral credit trigger; conversion-by-origin | unit | `npx vitest run src/__tests__/crc/leads.test.ts` | — | ⬜ pending |
| 18-04-01 | 04 | 2 | CRC-05 | T-18-13 | linkReferral idempotent + list/balance reads | unit | `npx tsc --noEmit` | — | ⬜ pending |
| 18-04-02 | 04 | 2 | CRC-05 | T-18-11/12/13 | creditReferralReward once-only CAS on credited_at; converted-only; server-side amount | unit | `npx vitest run src/__tests__/crc/referrals.test.ts` | — | ⬜ pending |
| 18-05-01 | 05 | 2 | CRC-03 | T-18-15 | segment builder w/ mandatory marketing_whatsapp consent gate + query-time unit | unit | `npx vitest run src/__tests__/crc/segment.test.ts` | — | ⬜ pending |
| 18-05-02 | 05 | 2 | CRC-03 | T-18-16 | L2 personalization ZDR + minimal data + static fallback | unit | `npx tsc --noEmit` | — | ⬜ pending |
| 18-05-03 | 05 | 2 | CRC-03 | T-18-14/16/17/18 | approval-gated dispatch: enqueue only after approveRequest success; template send | integration | `npx vitest run src/__tests__/crc/campaigns.test.ts` | — | ⬜ pending |
| 18-06-01 | 06 | 2 | CRC-04 | T-18-22/23 | self-healing NPS invite scan (per-appointment dedup) + cron auth + vercel cron | unit | `npx vitest run src/__tests__/crc/nps-scan.test.ts` | — | ⬜ pending |
| 18-06-02 | 06 | 2 | CRC-04 | T-18-19/20/21 | atomic single-use submit; detractor treatment; summary | unit | `npx tsc --noEmit` | — | ⬜ pending |
| 18-07-01 | 07 | 3 | CRC-01 | — | CRC hub + nav + lead-source manager | build | `npx tsc --noEmit` | — | ⬜ pending |
| 18-07-02 | 07 | 3 | CRC-01 | T-18-24 | kanban dnd-kit + keyboard sensor + optimistic move | build | `npx tsc --noEmit` | — | ⬜ pending |
| 18-07-03 | 07 | 3 | CRC-01 | T-18-24/25 | lead dialogs + accessible stage fallback + conversion table | build | `npx tsc --noEmit` | — | ⬜ pending |
| 18-07-04 | 07 | 3 | CRC-01 | T-18-24 | MANUAL: drag-and-drop + keyboard accessibility | manual | human-verify checkpoint | — | ⬜ pending |
| 18-08-01 | 08 | 3 | CRC-02 | T-18-26/27 | CPL/CAC aggregates from payables.campaign_id (zero-safe) | unit | `npx tsc --noEmit` | — | ⬜ pending |
| 18-08-02 | 08 | 3 | CRC-02 | — | ROI panel KPIs + origin table with '—' fallback | build | `npx tsc --noEmit` | — | ⬜ pending |
| 18-08-03 | 08 | 3 | CRC-02 | T-18-27 | payables campaign-link field | build | `npx tsc --noEmit` | — | ⬜ pending |
| 18-09-01 | 09 | 3 | CRC-03 | — | campaigns table + status badges + row actions | build | `npx tsc --noEmit` | — | ⬜ pending |
| 18-09-02 | 09 | 3 | CRC-03 | T-18-28 | 3-step CampaignFormDialog; submit-to-approval only | build | `npx tsc --noEmit` | — | ⬜ pending |
| 18-09-03 | 09 | 3 | CRC-03 | T-18-28/29/30 | ApprovalInbox campaign card → approveCampaignAndDispatch | build | `npx tsc --noEmit` | — | ⬜ pending |
| 18-09-04 | 09 | 3 | CRC-03 | T-18-28 | MANUAL: create→approve→send live | manual | human-verify checkpoint | — | ⬜ pending |
| 18-10-01 | 10 | 3 | CRC-04 | T-18-32 | NPS panel score/KPIs/detractor alert + treatment | build | `npx tsc --noEmit` | — | ⬜ pending |
| 18-10-02 | 10 | 3 | CRC-04 | T-18-31/32/33 | public single-use NPS form; no classification leak | build | `npx tsc --noEmit` | — | ⬜ pending |
| 18-10-03 | 10 | 3 | CRC-04 | T-18-31 | MANUAL: link→form→submit→classification | manual | human-verify checkpoint | — | ⬜ pending |
| 18-11-01 | 11 | 3 | CRC-05 | T-18-35 | indicações KPIs + referrals table | build | `npx tsc --noEmit` | — | ⬜ pending |
| 18-11-02 | 11 | 3 | CRC-05 | T-18-34 | per-patient rewards balance + read-only statement | build | `npx tsc --noEmit` | — | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/__tests__/crc/*.test.ts` — source-inspection RED scaffolds for CRC Server Actions + agent + cron (mirrors Phase 17 Wave 0 pattern)
- [ ] Zod validators (`src/lib/validators/crc.ts` or similar) — leadSchema, campaignSchema, npsResponseSchema, referralSchema

*Existing vitest infrastructure covers execution — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Kanban drag-and-drop entre estágios | CRC-01 | Interação de UI (DnD) não coberta por unit test | Arrastar um lead de "Novo" para "Contatado"; confirmar persistência do estágio após reload |
| Envio real de WhatsApp/e-mail de campanha | CRC-03 | Depende de credenciais Meta/Resend ao vivo + template aprovado | Disparar campanha de teste para um número/e-mail próprio; confirmar recebimento |
| Formulário público de NPS via token | CRC-04 | Fluxo cross-device (link → form → submit) | Abrir o link de NPS num celular, enviar nota, confirmar gravação e classificação |
