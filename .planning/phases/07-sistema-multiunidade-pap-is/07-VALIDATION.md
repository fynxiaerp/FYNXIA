---
phase: 7
slug: sistema-multiunidade-pap-is
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-12
---

# Phase 7 — Validation Strategy

> Per-phase validation contract. Foundation phase (schema + RBAC + security + config UI). Most correctness is structural (source-inspection + DB-shape checks) + build-green + a live `supabase db push`; true RLS/role isolation is verified with DB checks and human UAT.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run {changed test file}` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~3–5s |

Test style: **source-inspection** (readFileSync + toMatch on migrations/helpers/proxy/config) — the v1 convention (see `src/__tests__/migrations/*.test.ts`). Plus `npx tsc --noEmit`, **`npx next build`**, and a **live `supabase db push`** ([BLOCKING]) followed by `supabase gen types` to prove the schema is real (types from the live DB, not config). Pure-unit tests for the RBAC matrix (`isPathAllowed`/module gating) and the AES round-trip of the cert password.

---

## Sampling Rate

- **After every task commit:** `npx vitest run {file}` + `npx tsc --noEmit`
- **After every wave:** full suite + `npx next build`
- **At the migration checkpoint:** `[BLOCKING] supabase db push` (re-auth on org `kczvihafddupruvsrrsc` / project `jqjwyqlbbuqnrffdnlpp` first) → `supabase gen types typescript` → tsc green against regenerated types
- **Before verify:** full suite GREEN + next build clean + DB checks (units backfilled, role CHECK updated, RLS policies present) + manual RBAC/multiunidade UAT
- **Max feedback latency:** ~10s (unit) / build ~30–60s / db push manual

---

## Per-Requirement Validation Map

| REQ | Concern | Test Type | Automated Command |
|-----|---------|-----------|-------------------|
| SYS-01 | `units` table + `clinics` as rede; empresa fields (CNPJ/regime); v1 clinics migrated to 1 default unit | migration source-inspect + DB check | `npx vitest run src/__tests__/migrations/units.test.ts` + post-push row check |
| SYS-02 | Cert keystore: private bucket policy, AES password column, metadata table; node-forge reads .pfx metadata; password AES round-trips | source-inspect + unit (crypto) | `npx vitest run src/__tests__/icp/keystore.test.ts` |
| SYS-03 | role×module matrix exists; module gating server-side | unit (pure fn) | `npx vitest run src/__tests__/rbac/matrix.test.ts` |
| SYS-04 | `ai_agent_config` table (autonomy L0–L4) + config UI writes it | source-inspect + DB check | `npx vitest run src/__tests__/migrations/ai-config.test.ts` |
| SYS-05 | operational rows have `unit_id`; `get_my_unit_ids()` SECURITY DEFINER; unit filter helper | migration source-inspect + DB check | `npx vitest run src/__tests__/migrations/unit-scope.test.ts` |
| ROLE-01 | 6 new roles in role CHECK (users + invitations) | migration source-inspect + DB check | `npx vitest run src/__tests__/migrations/roles.test.ts` |
| ROLE-02 | role gating per module + unit; `assertNotReadOnly()` on mutations; auditor/dpo/socio read-only | source-inspect + unit | `npx vitest run src/__tests__/rbac/readonly.test.ts` |

---

## Manual-Only Verifications (human UAT)

| Behavior | Why Manual |
|----------|------------|
| Cross-unit isolation: operational user sees only their unit; network role sees all | Live RLS + session; multi-user |
| Read-only roles (auditor/dpo/socio) cannot mutate (server action blocked) | Live POST behavior |
| Cert upload: valid A1 accepted (metadata shown), invalid/expired rejected | Real .pfx file |
| Config screens (empresa, unidades, perfis, certificado, agentes IA) usable in both themes | Visual |

---

## Validation Sign-Off

- [ ] Every SYS-/ROLE- REQ has an automated check or a documented manual-UAT item
- [ ] [BLOCKING] `supabase db push` task present in plans (schema is real, types regenerated)
- [ ] next build green after every wave
- [ ] `nyquist_compliant: true`

**Approval:** pending
