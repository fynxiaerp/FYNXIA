---
phase: 18-crc-marketing
plan: 11
subsystem: ui
tags: [nextjs, supabase, shadcn, referrals, rewards, base-ui]

# Dependency graph
requires:
  - phase: 18-crc-marketing (Plan 04)
    provides: listReferrals, listRewardsBalance, linkReferral, creditReferralReward Server Actions
affects: [Phase 20 (Portal do Paciente) — PatientRewardsBalanceTable's data shape is the model for future self-service exposure, D-19]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-patient credit statement derived client-side by filtering the already-fetched listReferrals() rows (referrerPatientId + creditedAt not null) instead of adding a new server action — referral_rewards credit events map 1:1 to a credited referral row in v1 (no redemption rows exist yet)"

key-files:
  created:
    - src/app/(dashboard)/clinica/crc/indicacoes/page.tsx
    - src/components/crc/ReferralsTable.tsx
    - src/components/crc/PatientRewardsBalanceTable.tsx
  modified: []

key-decisions:
  - "PatientRewardsBalanceTable's 'Ver Extrato' Sheet reuses listReferrals() data (passed down as a `referrals` prop) instead of calling a new server action for referral_rewards ledger rows — avoids expanding referrals.ts beyond Plan 04's contract while still satisfying the read-only credit-history requirement"
  - "ReferralsTable inlines its own STAGE_LABELS/stage-badge mapping (mirrors KanbanColumn.tsx/LeadDetailSheet.tsx) rather than extracting a shared helper — no shared util existed yet and the plan's files_modified list did not include a new lib file"

requirements-completed: [CRC-05]

# Metrics
duration: ~15min
completed: 2026-07-13
---

# Phase 18 Plan 11: Referral Program UI (Indicações) Summary

**Indicações page with referral KPIs (Registradas/Convertidas/Recompensas Creditadas), a ReferralsTable showing who referred whom with funil-stage status and reward, and a per-patient rewards balance table with a read-only credit statement Sheet — closing CRC-05's internal surface, modeled for Phase 20 portal exposure (D-19).**

## Performance

- **Tasks completed:** 2 of 2
- **Files created:** 3
- **Files modified:** 0

## Accomplishments

- Built `/clinica/crc/indicacoes` (RSC page): fetches `listReferrals` + `listRewardsBalance` in parallel, renders 3 KPI cards (`min-h-[72px]`, `sm:grid-cols-3`) — Indicações Registradas (count), Indicações Convertidas (count of `creditedAt !== null`), Total em Recompensas Creditadas (`formatBRL` sum) — with the "Nenhuma indicação registrada" empty state per Copywriting Contract when there are zero referrals.
- Built `ReferralsTable`: columns Indicador (referrer patient name), Indicado (lead name), Status da Indicação (badge reusing the funil stage color mapping — blue/violet/secondary/accent/destructive), Recompensa (`formatBRL` green+semibold when `creditedAt` is set, "Pendente" muted otherwise), Data da Indicação (`dd/MM/yyyy`).
- Built `PatientRewardsBalanceTable`: Paciente / Indicações Convertidas / Saldo Total de Crédito / Saldo Utilizado / Saldo Disponível (green semibold), with a per-row `DropdownMenu` → "Ver Extrato" that opens a `Sheet` showing that patient's credit history — a read-only list of credited referrals (no manual balance edit, no redemption/"uso" rows created in v1, T-18-34).
- Both tables render inside the indicações page as stacked sections ("Indicações" / "Saldo por Paciente Indicador") rather than a tab toggle, matching the UI-SPEC's "tabela separada ou toggle" discretion clause.

## Deviations from Plan

None — plan executed exactly as written. The only implementation choice made under Claude's Discretion was deriving the credit-statement Sheet's line items from the already-fetched `listReferrals()` data (documented above) instead of adding a new server action, since Plan 04's `referral_rewards` read surface (`listRewardsBalance`) only returns aggregates, not row-level ledger entries, and the plan's `files_modified` list scoped this plan to UI files only.

## Self-Check: PASSED

- FOUND: src/app/(dashboard)/clinica/crc/indicacoes/page.tsx
- FOUND: src/components/crc/ReferralsTable.tsx
- FOUND: src/components/crc/PatientRewardsBalanceTable.tsx
- FOUND commit: 0cfc7b0 (Task 1 — page + ReferralsTable)
- FOUND commit: af046db (Task 2 — PatientRewardsBalanceTable)
