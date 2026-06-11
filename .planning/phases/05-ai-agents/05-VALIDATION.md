---
phase: 5
slug: ai-agents
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 (installed since Phase 1) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run {changed test file}` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~2-3 seconds (full suite, 306 tests as of Phase 4) |

Test style: source-inspection for migrations/`'use server'` modules; logic/unit tests for the copilot tools (PII masking + tenant scope), the inbound webhook (HMAC signature + payload parse + status map), and the AI-03 message build (real Asaas link). Live LLM/WhatsApp sends are UAT-deferred — the model and Meta fetch are mocked in unit tests.

---

## Sampling Rate

- **After every task commit:** `npx vitest run {file}`
- **After every plan wave:** `npx vitest run` (full suite) + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** full suite GREEN + `next build` clean (catches 'use server' async-export + eager-singleton; AI SDK / gateway client must read AI_GATEWAY_API_KEY at call-time, not module scope)
- **Max feedback latency:** ~10s

---

## Per-Task Verification Map

> Populated by the planner from RESEARCH.md §Validation Architecture.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-00 | 01 | 0 | AI-01..03 | — | N/A | scaffold | `npx vitest run src/__tests__/migrations/ai.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-xx | 01 | 1 | AI-02,03 | T-5-* | agent_outreach_log + whatsapp_inbound_events RLS + dedup | static SQL | `npx vitest run src/__tests__/migrations/ai.test.ts` | ❌ W0 | ⬜ pending |
| 05-xx | — | — | AI-01 | T-5-pii | copilot tools tenant-scoped + PII masked (no CPF/saúde to model) | unit | `npx vitest run src/__tests__/ai/tools.test.ts` | ❌ W0 | ⬜ pending |
| 05-xx | — | — | AI-01 | T-5-chat | chat route streams; read-only tools only (no write tools) | unit | `npx vitest run src/__tests__/ai/chat-route.test.ts` | ❌ W0 | ⬜ pending |
| 05-xx | — | — | AI-02 | T-5-webhook | inbound webhook HMAC verify + button payload → appointments.status; dedup by message id | unit | `npx vitest run src/__tests__/ai/whatsapp-inbound.test.ts` | ❌ W0 | ⬜ pending |
| 05-xx | — | — | AI-03 | T-5-collect | collection message uses real getInvoiceUrl (never LLM-fabricated); audited | unit | `npx vitest run src/__tests__/ai/collection-agent.test.ts` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/__tests__/migrations/ai.test.ts` — SQL assertions: `agent_outreach_log` (tenant_id, agent_type, target_id, action, sent_at) + `whatsapp_inbound_events` (message id UNIQUE for idempotency); RLS enabled + WITH CHECK; tenant_id indexed.
- [ ] `src/__tests__/ai/tools.test.ts` — copilot read-only tools: tenant-scoped (use user-session client/RLS), PII masking layer (CPF masked, health/prontuário/anamnese NEVER in tool output), only read tools registered (no mutation) (AI-01, D-01, D-05).
- [ ] `src/__tests__/ai/chat-route.test.ts` — chat Route Handler: runtime nodejs, AI_GATEWAY_API_KEY read at call-time, model string 'anthropic/claude-sonnet-4.6', ZDR providerOptions set, streaming response shape (AI-01, D-02).
- [ ] `src/__tests__/ai/whatsapp-inbound.test.ts` — inbound webhook: GET hub.challenge verify-token echo; POST X-Hub-Signature-256 HMAC validation on RAW body; button payload (CONFIRM/CANCEL_APPOINTMENT_{id}) → appointments.status; free-text fallback safe (no status change if ambiguous); message-id dedup (AI-02, D-04).
- [ ] `src/__tests__/ai/collection-agent.test.ts` — AI-03: message build pulls real invoiceUrl via gateway.getInvoiceUrl (asserts NOT a fabricated/hardcoded URL); outreach written to agent_outreach_log (AI-03, D-04).

*vitest already installed — no framework install in Wave 0. New runtime deps (ai@^6, @ai-sdk/react@^3, @ai-sdk/gateway@^3) installed in the implementation task that needs them.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Copilot answers a real tenant-scoped question via live model | AI-01 | Requires AI_GATEWAY_API_KEY + live Gateway | Set key, open sidebar, ask "Quais consultas tenho hoje?", confirm correct tenant-scoped answer with no raw PII in the provider request |
| Copilot help/how-to answer | AI-01 (D-03) | Requires live model | Ask "Como cadastro um paciente?", confirm a useful how-to answer |
| AI-02 inbound confirmation updates status | AI-02 | Requires Meta verification + live inbound webhook (public URL) | Patient taps Confirmar/Cancelar on a real WhatsApp template; confirm appointments.status updates; replay same event → no duplicate update |
| AI-03 collection WhatsApp with real Asaas link | AI-03 | Requires Meta + live Asaas charge | Run collection agent; confirm personalized WhatsApp with a working Asaas payment link; outreach logged |
| ZDR active on provider requests | AI-01 (LGPD/D-02) | Requires live Gateway + Vercel Pro | Confirm zeroDataRetention providerOptions take effect on live requests |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
