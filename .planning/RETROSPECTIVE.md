# FYNXIA ERP — Living Retrospective

> Cross-milestone learnings. Appended at each milestone completion.

## Milestone: v1.0 — MVP

**Shipped:** 2026-06-12
**Phases:** 7 (0–6) | **Plans:** 32 | **Tasks:** 85 | **Commits:** 282 | **~76k LOC TS**

### What Was Built
Full multi-tenant dental ERP: secure RLS foundation → auth/RBAC/onboarding → clinical MVP (agenda, pacientes, prontuário, odontograma, anamnese) → financial MVP (Asaas Pix/boleto, receivables, PDF) → communications (WhatsApp/Resend + outbox/cron) → AI (copilot + confirmation/collection agents) → dual-theme app shell. Live on Vercel gru1 + Supabase sa-east-1.

### What Worked
- **Per-phase GSD loop** (discuss → ui → research → plan → execute → code-review → fix → verify) held quality consistently; each phase shipped verified and deployed.
- **Wave-based parallel/sequential execution** with `next build` as the wave gate caught client/server boundary + import errors that vitest/tsc missed.
- **Security-first framing** surfaced and fixed cross-tenant bugs in Phases 3, 4, and 5 during code review — before they reached production.
- **Provider-agnostic abstractions** (PaymentGateway, MessageQueue) let us ship on the Supabase FREE plan with clean upgrade seams (Asaas→Stripe, outbox→pgmq).
- **TDD source-inspection scaffolds** (readFileSync/existsSync, RED-by-design) kept tsc green across waves while still defining contracts.

### What Was Inefficient
- **Supabase CLI re-auth gotcha** recurred at every `db push` (CLI defaulting to the wrong account) — cost a checkpoint each phase. Now documented in memory.
- **STATE.md / traceability drift**: requirement checkboxes and the STATE phase table fell out of sync with reality (Phase 0/1 requirements stayed "Pending" though delivered) — had to reconcile at milestone close.
- **Session-limit cutoffs** mid-executor (Phases 5 and 6) required re-spawning continuation executors after spot-checking committed state.
- **`'use server'` async-export trap** (Phase 2) and AI SDK v6 API differences (`inputSchema` not `parameters`) cost rework that `next build` / installed-types inspection would have caught earlier.

### Patterns Established
- @base-ui render-prop everywhere (no `asChild`); shadcn-first; nuqs for URL state; Zustand for transient UI.
- Lazy singletons for external clients (`getResend()`, call-time WhatsApp/env reads) to avoid `next build` static-eval throws.
- Webhook/tenant rule: tenant always derived from the DB row, never from untrusted payload.
- Design tokens only (no raw slate/gray) for dark-mode correctness.

### Key Lessons
- Run `next build` as the real gate for any Next.js work — unit tests and tsc miss the boundary/eval errors.
- Keep STATE.md and requirement traceability updated *per phase*, not at milestone close, to avoid reconciliation debt.
- A milestone-wide audit (cross-phase integration + E2E) is worth scheduling even when each phase passed individually — deferred this time as accepted risk.

### Cost Observations
- Model mix: orchestration on Opus; execution/review/verification subagents on Sonnet.
- Notable: wave-based subagent execution kept orchestrator context lean (~15%) while delegating full context per plan.

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 7 |
| Plans | 32 |
| Cross-tenant bugs caught in review | 3 |
| Recurring friction | Supabase CLI re-auth; STATE/traceability drift |
