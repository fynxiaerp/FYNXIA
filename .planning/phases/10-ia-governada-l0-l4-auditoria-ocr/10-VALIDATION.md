---
phase: 10
slug: ia-governada-l0-l4-auditoria-ocr
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-14
---

# Phase 10 — Validation Strategy

> Three governance subsystems. Correctness = source-inspection (migrations/policy/actions/UI) + pure-unit (policy decision matrix L0–L4, confidence-threshold gating, alçada check, approval state machine) + a mocked OCR extract test + build-green + a live `supabase db push`. Real vision OCR + live AI governance behavior = human-UAT. Must NOT break the existing copilot/agents.

---

## Test Infrastructure
| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 |
| **Config** | `vitest.config.ts` (server-only mock + setup from Phase 7) |
| **Quick** | `npx vitest run {file}` |
| **Full** | `npx vitest run` |
| **Runtime** | ~4–8s |

Style: **source-inspection** (readFileSync/toMatch on migrations, withAgentPolicy wrap, actions, audit UI, OCR flow) + **pure-unit** (policy decision per L0–L4 × action sensitivity; confidence threshold → review-queue gating; alçada/role check; approval approve→execute idempotency) + a **mocked-model OCR extraction** test (no live API). Plus `npx tsc --noEmit`, **`npx next build`**, and a **live `supabase db push`** ([BLOCKING], single checkpoint) + `gen types` (temp-file guard).

---

## Sampling Rate
- **After every task commit:** `npx vitest run {file}` + `npx tsc --noEmit`
- **After every wave:** full suite + `npx next build`
- **At the migration checkpoint (one plan ONLY):** `[BLOCKING] supabase db push` (re-auth org `kczvihafddupruvsrrsc` / project `jqjwyqlbbuqnrffdnlpp` first — recurring gotcha) → `gen types` (temp-file guard) → tsc green
- **Before verify:** full suite GREEN + next build clean + **regression check: existing copilot/agents tests still pass** + DB checks (new tables, audit_logs indexes, RLS, ai_decision_log immutable) + manual UAT
- **Max latency:** ~10s unit / build ~30–60s / db push manual

---

## Per-Requirement Validation Map
| REQ | Concern | Test Type | Automated Command |
|-----|---------|-----------|-------------------|
| AIG-01 | `withAgentPolicy()` reads ai_agent_config level + limits; blocks over-ceiling action | unit (decision matrix) + source-inspect | `npx vitest run src/__tests__/governance/policy.test.ts` |
| AIG-02 | sensitive action → approval_requests pending; resumes/executes on approve | unit (state machine) + source-inspect | `npx vitest run src/__tests__/governance/approvals.test.ts` |
| AIG-03 | every AI decision logged to ai_decision_log (immutable) | migration source-inspect + unit | `npx vitest run src/__tests__/governance/policy.test.ts` |
| AUD-01 | audit screen queries audit_logs (entity/user/period, before/after); new indexes | source-inspect + DB check | `npx vitest run src/__tests__/audit/audit-ui.test.ts` |
| AUD-02 | estorno = motivo + approval-by-alçada via approval_requests; logged | unit (alçada) + source-inspect | `npx vitest run src/__tests__/audit/estorno.test.ts` |
| AUD-03 | auditor/dpo query trail in dedicated screen; RBAC conformidade module | source-inspect (proxy + page) | `npx vitest run src/__tests__/governance/approvals.test.ts src/__tests__/audit/audit-ui.test.ts` |
| OCR-01 | upload image/PDF → AI Gateway multimodal (FilePart + generateObject) → structured fields | unit (mocked model) + source-inspect | `npx vitest run src/__tests__/ocr/extract.test.ts` |
| OCR-02 | per-field confidence < threshold → ocr_extractions review queue before commit | unit (threshold gating) + source-inspect | `npx vitest run src/__tests__/ocr/extract.test.ts` |

---

## Manual-Only Verifications (human UAT)
| Behavior | Why Manual |
|----------|------------|
| L0 agent only suggests; L4 executes; sensitive action pauses for approval | Live AI + config |
| Approver inbox: approve a pending action → it executes; reject → it doesn't | Live flow |
| Audit screen: filter by entity/user/period, see before/after diff | Visual + data |
| Estorno requires motivo + alçada approval; appears in the trail | Live RBAC/flow |
| Upload a real RG/comprovante → fields extracted; low-confidence flagged for review | Real document + vision |
| Existing copilot + confirmation/collection agents still work (no governance regression) | Live AI |

---

## Validation Sign-Off
- [ ] Each AIG/AUD/OCR REQ has an automated check or documented manual-UAT item
- [ ] Regression-safe: existing copilot/agents behavior preserved
- [ ] [BLOCKING] `supabase db push` task present (single checkpoint) + gen types guard
- [ ] next build green after every wave
- [ ] `nyquist_compliant: true`

**Approval:** pending
