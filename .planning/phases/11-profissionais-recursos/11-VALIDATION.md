---
phase: 11
slug: profissionais-recursos
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-14
---

# Phase 11 — Validation Strategy

> Professionals + availability + resources + waiting-room/TV panel, extending the v1 agenda. Correctness = source-inspection (migrations/actions/agenda integration/panel) + pure-unit (availability check, resource-block, waiting-time calc) + build-green + a live `supabase db push`. CRITICAL: must NOT break the v1 agenda/booking + the EXCLUDE GIST. Live realtime panel + booking = human-UAT.

---

## Test Infrastructure
| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 |
| **Config** | `vitest.config.ts` (server-only mock + setup) |
| **Quick** | `npx vitest run {file}` |
| **Full** | `npx vitest run` |
| **Runtime** | ~4–8s |

Style: **source-inspection** (readFileSync/toMatch on migrations, the booking Server Action availability/resource hooks, the panel page, proxy public-route) + **pure-unit** (isSlotWithinAvailability(grade,exceptions,slot); isResourceAvailable(status); waitingMinutes(arrived_at,called_at); presence_status transitions). Plus `npx tsc --noEmit`, **`npx next build`**, and a **live `supabase db push`** ([BLOCKING], single checkpoint) + `gen types` (temp-file guard). Realtime publication migration included.

---

## Sampling Rate
- **After every task commit:** `npx vitest run {file}` + `npx tsc --noEmit`
- **After every wave:** full suite + `npx next build`
- **At the migration checkpoint (one plan ONLY):** `[BLOCKING] supabase db push` (re-auth org `kczvihafddupruvsrrsc` / project `jqjwyqlbbuqnrffdnlpp` first — recurring gotcha) → `gen types` (temp-file guard) → tsc green
- **Before verify:** full suite GREEN + next build clean + **regression: existing agenda/booking tests still pass (GIST untouched)** + DB checks (new tables, realtime publication, RLS) + manual UAT
- **Max latency:** ~10s unit / build ~30–60s / db push manual

---

## Per-Requirement Validation Map
| REQ | Concern | Test Type | Automated Command |
|-----|---------|-----------|-------------------|
| PRO-01 | `professionals` (user_id NULLABLE, CRO+UF, especialidades, vínculo, commission jsonb) + cadastro action/UI; backfill dentists | migration source-inspect + unit | `npx vitest run src/__tests__/professionals/professionals.test.ts` |
| PRO-02 | `professional_availability` (+exceptions); booking validates slot within availability (agenda + public link) | source-inspect + unit (isSlotWithinAvailability) | `npx vitest run src/__tests__/professionals/availability.test.ts` |
| PRO-03 | commission rule STORED on professional (jsonb), no calc | migration/source-inspect | `npx vitest run src/__tests__/professionals/professionals.test.ts` |
| RES-01 | `resources` (type/patrimonio/status) + cadastro action/UI | migration source-inspect + unit | `npx vitest run src/__tests__/resources/resources.test.ts` |
| RES-02 | appointment resource reservation (nullable FK/junction); maintenance status blocks booking | source-inspect + unit (isResourceAvailable) | `npx vitest run src/__tests__/resources/resources.test.ts` |
| RES-03 | presence_status (SEPARATE column) + timestamps; waitingMinutes; /painel realtime page; publication migration; tenant-isolated (initials only) | source-inspect + unit (waitingMinutes) | `npx vitest run src/__tests__/resources/waiting-room.test.ts` |

(Plus a regression test asserting the existing appointments GIST + status CHECK are UNCHANGED.)

---

## Manual-Only Verifications (human UAT)
| Behavior | Why Manual |
|----------|------------|
| Register a professional (ficha + horários); appointment booking only offers slots within availability | Visual + live |
| Existing v1 agenda + public booking still work (no GIST regression) | Live agenda |
| Resource in 'manutenção' is excluded from booking / blocks the slot | Live flow |
| Check-in flow (aguardando→chamado) + waiting time measured | Live |
| /painel TV page updates in real time when reception calls a patient; shows only initials (no full name/CPF) | Live Realtime + LGPD |
| Read-only roles cannot mutate professionals/resources | Live RBAC |

---

## Validation Sign-Off
- [ ] Each PRO/RES REQ has an automated check or documented manual-UAT item
- [ ] Regression-safe: v1 appointments GIST + status CHECK + agenda/booking unchanged behaviorally
- [ ] [BLOCKING] `supabase db push` task present (single checkpoint, incl. realtime publication) + gen types guard
- [ ] /painel route is tenant-isolated + exposes only presence_status + initials (LGPD)
- [ ] next build green after every wave
- [ ] `nyquist_compliant: true`

**Approval:** pending
