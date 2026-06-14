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

Test style: **source-inspection** (readFileSync + toMatch on migrations/helpers/proxy/config) — the v1 convention (see `src/__tests__/migrations/*.test.ts`). Plus `npx tsc --noEmit`, **`npx next build`**, and a **live `supabase db push`** ([BLOCKING], Plan 04 ONLY) followed by `supabase gen types` to prove the schema is real (types from the live DB, not config). Pure-unit tests for the RBAC matrix (`isPathAllowed`/`isReadOnly` module gating) and the AES round-trip of the cert password.

**Actual Phase 7 test files (the plans create EXACTLY these — no per-requirement split files):**

| File | Covers |
|------|--------|
| `src/__tests__/migrations/phase7.test.ts` | ALL migration source-inspection: units, clinics.regime_tributario, user_units, get_my_unit_ids, role CHECK (users+invitations), unit_id backfill, certificates + icp-certificates bucket, ai_agent_config (+ partial unique index) |
| `src/__tests__/rbac/matrix.test.ts` | MODULE_PERMISSIONS (11 roles × 7 modules), isPathAllowed, isReadOnly (incl. auditor/socio on /clinica/financeiro, socio on /bi + /config) |
| `src/__tests__/icp/pfx-metadata.test.ts` | extractPfxMetadata against the synthetic .pfx fixture |
| `src/__tests__/config/empresa.test.ts` | empresa/unit zod validation + read-only/admin gate source-inspection |
| `src/__tests__/config/certificate.test.ts` | cert validation + AI-config gate + getCertificate type-level secret exclusion + MODULE_PERMISSIONS read-only flags |

---

## Sampling Rate

- **After every task commit:** `npx vitest run {file}` + `npx tsc --noEmit`
- **After every wave:** full suite + `npx next build`
- **At the migration checkpoint (Plan 04 ONLY):** `[BLOCKING] supabase db push` (re-auth on org `kczvihafddupruvsrrsc` / project `jqjwyqlbbuqnrffdnlpp` first) → `supabase gen types typescript` → tsc green against regenerated types. No other plan runs a db push.
- **Before verify:** full suite GREEN + next build clean + DB checks (units backfilled, regime column present, role CHECK updated, RLS policies present) + manual RBAC/multiunidade UAT
- **Max feedback latency:** ~10s (unit) / build ~30–60s / db push manual

---

## Per-Requirement Validation Map

| REQ | Concern | Test Type | Automated Command |
|-----|---------|-----------|-------------------|
| SYS-01 | `units` table + `clinics` as rede; empresa fields (CNPJ/regime tributário column); v1 clinics migrated to 1 default unit | migration source-inspect + validation + DB check | `npx vitest run src/__tests__/migrations/phase7.test.ts src/__tests__/config/empresa.test.ts` + post-push row check |
| SYS-02 | Cert keystore: private bucket policy, AES password column, metadata table; node-forge reads .pfx metadata; password AES round-trips | source-inspect + unit (crypto) | `npx vitest run src/__tests__/migrations/phase7.test.ts src/__tests__/icp/pfx-metadata.test.ts src/__tests__/config/certificate.test.ts` |
| SYS-03 | role×module matrix exists (11 roles × 7 modules); module gating server-side | unit (pure fn) | `npx vitest run src/__tests__/rbac/matrix.test.ts` |
| SYS-04 | `ai_agent_config` table (autonomy L0–L4, partial unique index) + config UI writes it | source-inspect + DB check | `npx vitest run src/__tests__/migrations/phase7.test.ts src/__tests__/config/certificate.test.ts` |
| SYS-05 | operational rows have `unit_id`; `get_my_unit_ids()` SECURITY DEFINER; unit filter helper | migration source-inspect + DB check | `npx vitest run src/__tests__/migrations/phase7.test.ts` + post-push NULL-unit_id check |
| ROLE-01 | 6 new roles in role CHECK (users + invitations) | migration source-inspect + DB check | `npx vitest run src/__tests__/migrations/phase7.test.ts` + post-push constraint check |
| ROLE-02 | role gating per module + unit; `assertNotReadOnly()` on mutations; auditor/dpo/socio read-only (incl. financeiro/bi) | source-inspect + unit | `npx vitest run src/__tests__/rbac/matrix.test.ts src/__tests__/config/empresa.test.ts src/__tests__/config/certificate.test.ts` |

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
- [ ] [BLOCKING] `supabase db push` task present in Plan 04 ONLY (single push; schema real, types regenerated)
- [ ] next build green after every wave (Plans 05 & 06 serialized — 05 in Wave 3, 06 in Wave 4 — so the two builds don't collide on `.next/`)
- [ ] `nyquist_compliant: true`

**Approval:** pending
