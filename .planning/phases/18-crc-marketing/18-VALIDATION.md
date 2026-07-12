---
phase: 18
slug: crc-marketing
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 18-01-01 | 01 | 1 | CRC-01..05 | — | Zod schemas reject invalid lead/campaign/nps/referral input | unit (source-inspection RED) | `npx vitest run src/__tests__/crc` | ❌ W0 | ⬜ pending |

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
