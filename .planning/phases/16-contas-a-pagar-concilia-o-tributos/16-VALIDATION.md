---
phase: 16
slug: contas-a-pagar-concilia-o-tributos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — see vitest.config.ts) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/lib/financeiro` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file>`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-XX-XX | XX | N | REQ-XX | T-16-XX / — | (filled by planner) | unit/source/behavior | `npx vitest run ...` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Populated by gsd-planner per task. Tax math (computeInss/computeIrrf/computeIss), payout-math, and reconciliation matching MUST be pure-function unit tests. Migrations/RLS verified by source-inspection. Server Actions verified by behavior tests.*

---

## Wave 0 Requirements

- [ ] `src/lib/financeiro/__tests__/tax-tables.test.ts` — RED stubs for TRIB-02 (INSS/IRRF/ISS brackets by vigência)
- [ ] `src/lib/financeiro/__tests__/payout-math.test.ts` — RED stubs for TRIB-01 (deduções → base → %)
- [ ] `src/lib/financeiro/__tests__/reconciliation.test.ts` — RED stubs for FOP-02 (exact/fuzzy/N:1)
- [ ] `src/lib/financeiro/__tests__/ofx-parser.test.ts` — RED stubs for FOP-02 (FITID idempotency)
- [ ] migration source-inspection tests for FOP-01/FOP-03/TRIB-03 (new tables + ALTERs + RLS)

*Existing vitest infrastructure covers the framework; Wave 0 adds the RED scaffolds above.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OFX upload + auto-reconciliation against a real bank statement | FOP-02 | Requires a real .ofx file + browser upload flow | Upload sample .ofx at /clinica/financeiro/conciliacao; confirm exact matches auto-reconcile and fuzzy show as suggestions |
| EFD-Reinf transmission (real provider) | TRIB-03 | Gated on real provider/certificate — stub only in this phase | Verify stub returns `status: 'transmitido'` + protocolo; real transmission deferred |

*Tax math, matching, and PDF generation have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
