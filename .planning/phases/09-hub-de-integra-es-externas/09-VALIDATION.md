---
phase: 9
slug: hub-de-integra-es-externas
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-14
---

# Phase 9 — Validation Strategy

> Integration hub = registry + credential vault + event log + health/retry. Correctness = source-inspection (migrations/handlers/actions/proxy) + unit (AES credential round-trip, health derivation, masking, retry idempotency) + build-green + a live `supabase db push`. Live webhook delivery is human-UAT. CRITICAL: must NOT regress the production Asaas/WhatsApp webhooks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 |
| **Config** | `vitest.config.ts` (server-only mock + setup from Phase 7) |
| **Quick** | `npx vitest run {file}` |
| **Full** | `npx vitest run` |
| **Runtime** | ~3–6s |

Test style: **source-inspection** (readFileSync/toMatch on migrations, the existing webhook handlers' additive hub-log call, actions, proxy module) + **pure-unit** (credential AES encrypt→decrypt round-trip; connector health derivation from events; credential masking; retry idempotency/CAS). Plus `npx tsc --noEmit`, **`npx next build`**, and a **live `supabase db push`** ([BLOCKING], single checkpoint) + `gen types` (temp-file guard against truncation).

---

## Sampling Rate
- **After every task commit:** `npx vitest run {file}` + `npx tsc --noEmit`
- **After every wave:** full suite + `npx next build`
- **At the migration checkpoint (one plan ONLY):** `[BLOCKING] supabase db push` (re-auth org `kczvihafddupruvsrrsc` / project `jqjwyqlbbuqnrffdnlpp` first — recurring gotcha) → `supabase gen types typescript` → tsc green
- **Before verify:** full suite GREEN + next build clean + **regression check that Asaas/WhatsApp webhook flows still pass** + DB checks (2 tables, REVOKE on credential col, RLS) + manual UAT
- **Max latency:** ~10s unit / build ~30–60s / db push manual

---

## Per-Requirement Validation Map

| REQ | Concern | Test Type | Automated Command |
|-----|---------|-----------|-------------------|
| INT-01 | `integration_connectors` (AES credential + REVOKE col + RLS); register/update connector action (masked, server-only decrypt); RBAC `integracoes` admin/ti write | source-inspect + unit (AES round-trip + masking) | `npx vitest run src/__tests__/integrations/connectors.test.ts` |
| INT-02 | webhook_events reused; existing Asaas/WhatsApp handlers log into hub (ADDITIVE, fire-and-forget, no regression); `integration_events` inbound rows | source-inspect (handlers + migration) | `npx vitest run src/__tests__/integrations/webhooks.test.ts` |
| INT-03 | health derived from recent events (ok/degraded/failed); auto-resend via existing Vercel Cron (idempotent CAS); reprocess action; panel | source-inspect + unit (health derivation + retry) | `npx vitest run src/__tests__/integrations/health.test.ts` |

---

## Manual-Only Verifications (human UAT)
| Behavior | Why Manual |
|----------|------------|
| Register a connector with a credential; UI shows it masked; reload persists | Visual + live |
| Live Asaas/WhatsApp webhook still processes correctly (NO regression) | Live provider event |
| A failed integration event auto-resends via cron + reprocess button works | Live cron + retry |
| Health panel shows ok/degraded/failed per connector | Visual |
| Read-only roles (auditor/dpo/socio) cannot edit connectors | Live RBAC |

---

## Validation Sign-Off
- [ ] Each INT- REQ has an automated check or documented manual-UAT item
- [ ] Regression-safe: production Asaas/WhatsApp webhook handlers unchanged behaviorally (hub log is additive)
- [ ] [BLOCKING] `supabase db push` task present (single checkpoint) + gen types
- [ ] next build green after every wave
- [ ] `nyquist_compliant: true`

**Approval:** pending
