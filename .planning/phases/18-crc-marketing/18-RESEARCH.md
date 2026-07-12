# Phase 18: CRC & Marketing - Research

**Researched:** 2026-07-11
**Domain:** Lead funnel (kanban), campaign ROI, WhatsApp/email reactivation campaigns with governed AI personalization, NPS collection, referral program — Next.js 15 / Supabase multi-tenant ERP
**Confidence:** HIGH (reuse audit is code-verified) / MEDIUM (dnd-kit version recommendation, financial linkage design — new territory)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Funil de leads (CRC-01)**
- **D-01:** Estágios do funil: **Novo → Contatado → Agendado → Convertido / Perdido**. "Agendado" conecta ao módulo de agenda existente.
- **D-02:** Visualização **Kanban** com arrastar-e-soltar entre estágios. Não existe componente kanban no projeto — será novo (planner pesquisa lib de DnD; respeitar Tailwind v4 + shadcn).
- **D-03:** Origem do lead via **lista fixa gerenciável** (seed: Indicação, Google, Instagram, Facebook, Walk-in, WhatsApp, Outro). Admin pode adicionar origens. NÃO usar campo livre.
- **D-04:** Conversão do lead cria/vincula um `patient` (origem 'Indicação' amarra ao programa de indicação — D-13/D-16). Lead e paciente são entidades distintas; a conversão liga as duas.

**ROI de campanha (CRC-02)**
- **D-05:** Custo da campanha **vem do módulo financeiro** (despesas de marketing lançadas em Fase 14/16), não entrada manual isolada. Amarrar campanha ↔ despesa (centro de custo/categoria de marketing, ou FK campanha→financial_transactions/payables). Trade-off aceito: mais integração em troca de auditabilidade e fonte única de verdade.
- **D-06:** Métricas: **CPL = custo / nº de leads**; **CAC = custo / nº de pacientes convertidos**. Painel exibe conversão por origem.

**Campanhas de reativação (CRC-03)**
- **D-07:** Segmentação = **"inativo há X dias" com X configurável + filtros opcionais** (último procedimento, faixa etária, unidade). NÃO é construtor de query livre.
- **D-08:** Canal = **ambos (WhatsApp e/ou e-mail)**, respeitando **preferência/opt-in do paciente** (LGPD). Reutiliza outbox + whatsapp client + resend.
- **D-09:** IA em **nível L2**: agente personaliza a mensagem (apenas primeiro nome + dados mínimos, ZDR/LGPD) e monta a campanha, mas o **disparo em massa exige aprovação humana** (alçada/approval_requests da Fase 10).
- **D-10:** Disparo **manual** em v1: marketing seleciona o segmento e aciona o envio. Agendado automático (cron) diferido.
- **D-11:** **Restrição Meta:** WhatsApp de reativação fora da janela de 24h → exige **template aprovado** (utility/marketing). Tratar como envio via template com variáveis, não texto livre.

**NPS pós-consulta (CRC-04)**
- **D-12:** Coleta em **batch diário (cron à noite)** — varre atendimentos concluídos e envia convite NPS. Não é disparo imediato.
- **D-13:** Captura via **link para mini-formulário web** (0–10 + comentário), rota pública com **token single-use** (padrão da anamnese, Fase 2).
- **D-14:** Classificação **padrão NPS**: 9–10 promotor, 7–8 neutro, 0–6 detrator. NPS = %promotores − %detratores.
- **D-15:** Detrator (0–6) gera **alerta interno** para recepção/gestor. Sem mensagem automática ao paciente detrator.

**Programa de indicação (CRC-05)**
- **D-16:** Indicação registrada ao **cadastrar o lead/paciente**: recepção vincula "indicado por" a um paciente existente. Sem código/link compartilhável em v1.
- **D-17:** Recompensa = **crédito/desconto em serviços** (valor configurável). Sem saída de caixa direta.
- **D-18:** Recompensa creditada **na conversão do indicado** (lead indicado chega a 'Convertido').
- **D-19:** Saldo de recompensas visível em **tela interna** agora, modelado para exposição no Portal (Fase 20).

### Claude's Discretion
- Escolha da lib de kanban/DnD (D-02) e do componente de tabela onde aplicável.
- Modelagem exata das tabelas (leads, lead_sources, campaigns, nps_responses, referrals, referral_rewards) e RLS multi-tenant + unit_id (seguir padrões das fases 7/16/17).
- Forma exata do vínculo campanha↔despesa financeira (D-05) — escolher o mais simples e auditável.
- Estrutura do painel de ROI/conversão e do painel de NPS (seguir UI-SPEC).

### Deferred Ideas (OUT OF SCOPE)
- Disparo agendado automático de reativação (cron recorrente) — v1 é manual (D-10).
- Código/link de indicação compartilhável — depende do Portal do Paciente (Fase 20).
- Exposição de NPS/recompensas ao paciente (self-service) — Fase 20.
- Construtor de segmento avançado (filtros AND/OR combináveis) — v1 é "X dias + filtros opcionais" (D-07).
- Sistema de pontos/gamificação de indicação — v1 é crédito em serviços (D-17).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRC-01 | Recepção/Marketing gerencia funil de leads com origem e status (Novo→Convertido/Perdido) | §Standard Stack (dnd-kit), §Architecture Pattern 1 (leads/lead_sources schema), §Don't Hand-Roll (kanban DnD) |
| CRC-02 | Sistema calcula ROI por campanha (CPL, CAC) a partir da origem dos leads | §Architecture Pattern 2 (financial linkage), §Code Examples (CPL/CAC queries) |
| CRC-03 | Campanhas disparam mensagens segmentadas (reativação automática de inativos) via WhatsApp/e-mail | §Architecture Pattern 3 (outbox reuse), §Pitfall 2 (approval_requests execution gap), §Pitfall 4 (Meta template) |
| CRC-04 | Sistema coleta NPS (0–10) e apura promotores/neutros/detratores | §Architecture Pattern 4 (NPS cron + public token route), §Pitfall 5 (dedup without date-index) |
| CRC-05 | Programa de indicação rastreia quem indicou quem e recompensas | §Architecture Pattern 1 (referrals schema), §Code Examples |
</phase_requirements>

## Summary

Phase 18 is almost entirely **composition of existing infrastructure**, not new infrastructure. The messaging outbox (`message_outbox` + `drainOutbox` + Vercel Cron), the WhatsApp Cloud API client, Resend, the `withAgentPolicy` L0–L4 governance gate, `approval_requests`, and the anamnese public-token pattern are all directly reusable with no interface changes. The only genuinely new piece of *infrastructure* is drag-and-drop for the lead kanban — and here the UI-SPEC's recommendation (`@dnd-kit/core` + `@dnd-kit/sortable`, the v6 "legacy" API) should be reconsidered: dnd-kit's maintainers now ship a rewritten `@dnd-kit/react` (v0.5.0, published within the last month) as the officially endorsed path forward, with explicit `react: ^18.0.0 || ^19.0.0` peer support, while `@dnd-kit/core` v6.3.1 has not been updated since December 2024 and only declares a loose `>=16.8.0` peer range (works, but untested against React 19 by the maintainers). Recommend `@dnd-kit/react` instead of the UI-SPEC's `@dnd-kit/core`+`@dnd-kit/sortable`.

Two design gaps need explicit resolution before planning: (1) `approval_requests` in this codebase is **audit-trail-only** — `approveRequest()` never executes the underlying action; every prior phase (Phase 16 `cancelarPayable`) that used it left the actual state change to be triggered separately. Phase 18's campaign dispatch needs a purpose-built follow-up (a dedicated Server Action that calls `approveRequest` and then performs the actual outbox enqueue, gated on success) — there is no generic "execute this approved payload" mechanism to fall back on. (2) `patients` has no `unit_id` column (only `appointments`/`charges`/`receivables` got it in Phase 7) and `patient_consents.consent_type` only has `'marketing_whatsapp'`, not a separate email-marketing consent — both are real schema gaps the planner must close (query-time unit resolution via last appointment; a CHECK-constraint ALTER for consent, or an explicit decision to reuse `marketing_whatsapp` as the umbrella marketing consent for both channels).

The financial cost linkage (D-05) has a direct precedent: `lab_orders.financial_transaction_id` (Phase 13) is a nullable FK from an operational table to `financial_transactions`. Recommend mirroring this exactly — `payables.campaign_id` (nullable FK campaign→payables, so a marketing expense lançada in Contas a Pagar can optionally be tagged with the campaign it funds) — rather than a junction table, since campaigns will typically map to 0..N marketing expenses and this keeps CPL/CAC computable with a single `SUM(payables.valor_total) WHERE campaign_id = X` aggregate, joinable from the existing Contas a Pagar screen with zero new UI on the financeiro side.

**Primary recommendation:** Reuse the outbox/WhatsApp/Resend/withAgentPolicy/approval_requests/public-token stack verbatim; adopt `@dnd-kit/react` (not the legacy `@dnd-kit/core`+`@dnd-kit/sortable` combo) for the kanban; link campaign cost via a nullable `payables.campaign_id` FK; and design the campaign-approval flow as an explicit two-step Server Action (create approval → on `approveRequest` success, perform the actual segment-to-outbox enqueue) since the platform's approval queue does not auto-execute payloads.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/react` | 0.5.0 (verified via `npm view`, published 2026-07-06) | Kanban drag-and-drop (lead funnel, D-02) | Official successor to `@dnd-kit/core`; explicit `react: ^18.0.0 \|\| ^19.0.0` peer dep (project is on React 19.2.4); auto-registers `KeyboardSensor` on `DragDropProvider` (accessibility requirement in UI-SPEC is satisfied out of the box) [VERIFIED: npm registry + dndkit.com docs] |
| `message_outbox` / `OutboxQueue` / `drainOutbox` (existing) | n/a (in-repo, `src/lib/messaging/`) | Durable queue for campaign + NPS-invite sends | Already the sole dispatch path for all outbound WhatsApp/email in the codebase (COMMS-04); reusing it is mandatory per CONTEXT.md canonical refs [VERIFIED: source read] |
| `sendTemplateMessage` (existing, `src/lib/whatsapp/client.ts`) | n/a | WhatsApp Cloud API v21.0 template send | Only WhatsApp send path in the codebase; already implements permanent-vs-transient error classification [VERIFIED: source read] |
| `getResend()` (existing, `src/lib/resend.ts`) | `resend` npm pkg, lazy singleton | Email send | Only email path in the codebase [VERIFIED: source read] |
| `withAgentPolicy` (existing, `src/lib/ai/policy.ts`) | n/a | L0–L4 governance gate for campaign personalization agent (D-09) | Mandatory per CONTEXT.md — same pattern as `collection-agent.ts`/`confirmation-agent.ts` [VERIFIED: source read] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `generateText` (Vercel `ai` SDK, already installed) | n/a | LLM personalization of campaign message text | Mirrors `buildCollectionMessage` — model `'anthropic/claude-sonnet-4.6'`, `zeroDataRetention: true` in `providerOptions.gateway`, system prompt forbidding any URL/link injection [VERIFIED: source read] |
| `date-fns` (already installed) | existing | "dias inativo" computation, "dd/MM/yyyy" formatting | Already used throughout (`differenceInDays`-style patterns in reminder-scan/confirmation-agent) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@dnd-kit/react` (recommended) | `@dnd-kit/core` + `@dnd-kit/sortable` (UI-SPEC's suggestion, v6.3.1) | v6 works (loose peer range accepts React 19) and has more Stack Overflow/blog coverage, but is the now-"Legacy" branch per dndkit.com's own migration guide; no updates since Dec 2024. Picking legacy today means a migration debt from day one. |
| `@dnd-kit/react` | `@hello-pangea/dnd` (react-beautiful-dnd fork) | No official React 19 support confirmed; column-to-column D&D is more awkward than dnd-kit's droppable model; would be a second DnD philosophy in the codebase for no benefit. |
| `payables.campaign_id` nullable FK (recommended) | Junction table `campaign_costs(campaign_id, payable_id)` | Junction table supports true many-to-many (one payable split across 2 campaigns) but that scenario isn't in scope (D-05 doesn't ask for split allocation) — added complexity with no requirement driving it. |
| `payables.campaign_id` | Direct FK on `financial_transactions` instead of `payables` | `financial_transactions` rows are created by `baixarPayable` only at payment time (not at lançamento); UI-SPEC's empty-state copy explicitly points users to "lançar despesa" in Contas a Pagar (`payables`), so tagging at `payables` creation time is the earlier, more natural touchpoint and lets "Custo Total" reflect committed spend, not just paid spend. |

**Installation:**
```bash
npm install @dnd-kit/react
```
No separate `@dnd-kit/sortable`/`@dnd-kit/core`/`@dnd-kit/dom` install needed — `@dnd-kit/react` declares `@dnd-kit/dom`, `@dnd-kit/state`, `@dnd-kit/abstract` as its own dependencies and pulls them in transitively [VERIFIED: `npm view @dnd-kit/react dependencies`].

**Version verification (2026-07-11):**
```
@dnd-kit/react       0.5.0   peerDeps: react ^18.0.0 || ^19.0.0, react-dom ^18.0.0 || ^19.0.0   published 2026-07-06
@dnd-kit/core        6.3.1   peerDeps: react >=16.8.0, react-dom >=16.8.0                        published 2024-12-05 (no updates since)
@dnd-kit/sortable     n/a    peerDeps: react >=16.8.0, @dnd-kit/core ^6.3.0
project react/react-dom: 19.2.4 (package.json)
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── actions/
│   ├── leads.ts                  # createLead, moveLeadStage, convertLead, listLeadsByStage, listConversionByOrigin
│   ├── lead-sources.ts           # CRUD for lead_sources (admin)
│   ├── campaigns.ts              # createCampaign, previewSegment, requestCampaignPersonalization,
│   │                              #   submitCampaignForApproval, approveCampaignAndDispatch (see Pitfall 2)
│   ├── nps.ts                    # markDetractorTreated, listNpsResponses (invite send lives in the cron)
│   ├── referrals.ts              # linkReferral (called from LeadFormDialog), creditReferralReward,
│   │                              #   listReferrals, listRewardsBalance
│   └── roi.ts                    # getRoiByOrigin, getRoiByCampaign (CPL/CAC aggregates)
├── lib/
│   ├── crc/
│   │   ├── nps-scan.ts           # pure fn: selectNpsInviteTargets(appointments) — mirrors reminder-scan.ts
│   │   ├── segment.ts            # pure fn: buildInactiveSegmentQuery / classifyNps (score→promotor/neutro/detrator)
│   │   └── roi-math.ts           # pure fns: computeCpl, computeCac (unit-tested, no DB)
│   └── agents/
│       └── campaign-agent.ts     # buildCampaignMessage (LLM, mirrors buildCollectionMessage) + runCampaignPersonalization
├── app/
│   ├── (dashboard)/clinica/crc/
│   │   ├── page.tsx               # hub
│   │   ├── funil/page.tsx         # kanban (client island: LeadKanbanBoard)
│   │   ├── roi/page.tsx
│   │   ├── campanhas/page.tsx
│   │   ├── nps/page.tsx
│   │   └── indicacoes/page.tsx
│   └── api/cron/
│       └── nps-scan/route.ts      # nightly (D-12) — mirrors collection-agent/route.ts exactly
├── components/crc/                # per UI-SPEC Component Inventory (already fully specified)
supabase/migrations/
├── 2026071X000100_crc_tables.sql       # leads, lead_sources, campaigns, nps_responses, referrals, referral_rewards
├── 2026071X000200_crc_alters.sql       # payables.campaign_id FK, patient_consents CHECK ALTER (if adopted)
└── 2026071X000300_crc_rls.sql
```

### Pattern 1: New-table schema (leads, lead_sources, campaigns, nps_responses, referrals, referral_rewards)

**What:** All six new tables follow the Phase 16/17 convention exactly: `clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE`, `unit_id UUID NOT NULL REFERENCES units(id)` (set directly at creation — these are *new* rows created by an actor working in a unit context, unlike `patients` which predates unit_id and would need a 3-step backfill), `deleted_at TIMESTAMPTZ` soft-delete where PII is involved (leads carry name/phone — soft-delete required per LGPD convention), `created_at`/`updated_at`, and an `audit_units_changes()` trigger (this trigger reads `NEW.clinic_id`, confirmed compatible — see `cost_centers`/`chart_of_accounts` in 20260619001100).

**When to use:** All 6 new tables.

**Key columns (recommendation, not exhaustive):**
```sql
-- lead_sources: admin-managed catalog (D-03) — seed 7 rows per new clinic via trigger,
-- mirroring seed_financial_categories() pattern (20260606000300).
CREATE TABLE public.lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT true,   -- seeded rows; admin-added rows = false
  ativo BOOLEAN NOT NULL DEFAULT true,         -- soft-delete-in-use guard (UI-SPEC: "Desative-a em vez de excluir")
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- leads: funnel entity (D-01/D-04)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id),
  source_id UUID NOT NULL REFERENCES public.lead_sources(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  stage TEXT NOT NULL DEFAULT 'novo'
        CHECK (stage IN ('novo','contatado','agendado','convertido','perdido')),
  lost_reason TEXT,                            -- populated on stage='perdido' (UI-SPEC dialog)
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,  -- D-04: set on conversion
  referred_by_patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL, -- D-16
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,  -- CRC-02: attribution for CPL/CAC
  notes TEXT,
  stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- drives "X dias no estágio" (UI-SPEC LeadCard)
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- index: clinic_id (mandatory), (clinic_id, stage) for kanban column queries,
-- (clinic_id, source_id) for conversion-by-origin aggregate.

-- referrals: 1 row per (referrer, referred) pair — D-16/D-18
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  referrer_patient_id UUID NOT NULL REFERENCES public.patients(id),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE UNIQUE,  -- 1:1 — a lead is referred by exactly one patient
  reward_amount NUMERIC(12,2),           -- set on credit (D-18), NULL = not yet converted
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- referral_rewards: running ledger per referrer patient (D-19 — modeled for future Portal exposure)
CREATE TABLE public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  type TEXT NOT NULL DEFAULT 'credito' CHECK (type IN ('credito','uso')),  -- 'uso' reserved for future redemption UI
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Example (source):** mirrors `cost_centers`/`chart_of_accounts` (20260619001100_financial_cadastros_tables.sql) and `stock_alerts`/`stock_draws` (20260703000100_estoque_tables.sql) — read the migration headers for the exact indexing/audit-trigger boilerplate to copy.

### Pattern 2: Financial cost linkage (D-05) — nullable FK from `payables`, not a junction table

**What:** Add `campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL` to `payables` (ALTER, mirrors `lab_orders.financial_transaction_id` reverse-direction precedent). The Contas a Pagar `CampaignFormDialog`/`PayableFormDialog` (Phase 16, existing) needs one new optional field: "Vincular a campanha" (Select). No changes to `financial_transactions` needed.

**When to use:** Any marketing despesa lançada in Contas a Pagar that should roll up into a campaign's CPL/CAC.

**CPL/CAC query (source: derived from `listPayables`/`postLabExpense` patterns):**
```sql
-- Custo Total for a campaign
SELECT COALESCE(SUM(p.valor_total), 0) AS custo_total
FROM public.payables p
WHERE p.clinic_id = $1 AND p.campaign_id = $2 AND p.deleted_at IS NULL AND p.status <> 'cancelado';

-- CPL = custo_total / COUNT(leads WHERE campaign_id = $2)
-- CAC = custo_total / COUNT(leads WHERE campaign_id = $2 AND stage = 'convertido')
```
For "Conversão por Origem" (source-level, not campaign-level — D-06's second requirement), cost aggregates per `lead_sources.id` via leads that have no `campaign_id` set but do have a `source_id` — these two attribution axes (source vs. campaign) are independent and both need to render "—" gracefully when no cost is attributed (per UI-SPEC's `RoiByOriginTable` "—" convention).

### Pattern 3: Campaign dispatch — outbox reuse + governed approval (D-08/D-09/D-10/D-11)

**What:** Campaign send is a 3-stage pipeline, all server-side:
1. `previewSegment(filters)` — pure read query against `patients`/`appointments` (no writes).
2. `requestCampaignPersonalization(campaignId)` — calls a new `buildCampaignMessage(firstName)` (mirrors `buildCollectionMessage` in `collection-agent.ts`: `generateText` + `zeroDataRetention: true` + system prompt forbidding links/CPF/health data), writes a preview onto the `campaigns` row (`preview_message TEXT`), still no send.
3. `submitCampaignForApproval(campaignId)` — calls `createApprovalRequest({ type: 'ai_action', agentKey: 'crc-campaign', payload: { campaignId, recipientCount, channel, previewMessage }, requiredRole: 'admin' })` and sets `campaigns.status = 'aguardando_aprovacao'`. **No migration needed on `approval_requests`** — `type` stays `'ai_action'`, `agent_key = 'crc-campaign'` is the discriminator (see Pitfall 1 below — UI-SPEC's "novo entity_type" phrasing does not map onto an actual column; `agent_key` is the correct discriminator).
4. On approve (see Pitfall 2 — **this is the part that needs a NEW wrapper, not the raw `approveRequest`**): resolve the segment again (patients may have changed since preview), filter by `patient_consents` opt-in (D-08), enqueue one `message_outbox` row per (patient × channel) via `getOutboxQueue().enqueue(...)`, set `campaigns.status = 'enviada'`.
5. The existing Vercel Cron worker (any of the existing crons already call `drainOutbox()`; no new cron needed for send — but see Pitfall 6 for whether a dedicated drain trigger is needed for near-real-time dispatch after approval).

**Meta template requirement (D-11):** WhatsApp sends MUST go through `sendTemplateMessage` with a registered template (same as `TEMPLATE_COLLECTION`/`TEMPLATE_APPOINTMENT_REMINDER`). Add two new template constants to `src/lib/whatsapp/templates.ts`:
```typescript
// New Meta-approved templates needed for Phase 18 (registration is an external/manual
// step in Meta Business Manager — code only references the name + variable slots):
export const TEMPLATE_REACTIVATION = 'fynxia_reativacao'   // category: MARKETING (promotional wording allowed here — unlike utility templates)
export const TEMPLATE_NPS_INVITE = 'fynxia_pesquisa_nps'   // category: UTILITY (transactional — "avalie seu atendimento")
```
Reactivation is inherently promotional — unlike `TEMPLATE_COLLECTION`/`TEMPLATE_APPOINTMENT_REMINDER` (both UTILITY), this template should be registered as MARKETING category in Meta, which has a different (higher) per-conversation price and — per Meta's opt-in rules for MARKETING category — requires the recipient to have explicitly opted in, reinforcing D-08's consent gate rather than being just a nice-to-have.

### Pattern 4: NPS invite cron + public token form (D-12/D-13)

**What:** New cron `src/app/api/cron/nps-scan/route.ts`, structurally identical to `collection-agent/route.ts` (CRON_SECRET auth via `isCronAuthorized`, `runtime = 'nodejs'`, calls a scan function then `drainOutbox()`). Add to `vercel.json` crons array (e.g. `{ "path": "/api/cron/nps-scan", "schedule": "0 23 * * *" }` — 23:00 UTC = 20:00 BRT, "à noite" per D-12).

**Scan function (`src/lib/crc/nps-scan.ts`):**
```sql
-- Self-healing scan — no date window needed (see Pitfall 5): find every concluded
-- appointment that doesn't yet have an nps_responses row, regardless of when it concluded.
SELECT a.id, a.tenant_id, a.unit_id, a.patient_id, p.full_name, p.phone, p.email
FROM public.appointments a
JOIN public.patients p ON p.id = a.patient_id
WHERE a.status = 'concluido'
  AND p.deleted_at IS NULL AND p.is_anonymized = false
  AND NOT EXISTS (
    SELECT 1 FROM public.nps_responses n WHERE n.appointment_id = a.id
  );
```
For each row: create the `nps_responses` row (token = crypto-random, `token_expires_at` = e.g. now()+7d, mirrors `anamneses.token`/`isTokenValid`), then `queue.enqueue()` one outbox row per available channel with `idempotencyKey = 'nps-invite:' + appointmentId + ':' + channel'` (message_outbox's `idempotency_key` UNIQUE is GLOBAL, not per-tenant — confirmed from `20260607000100_message_outbox.sql`; always embed IDs, never a bare date string).

**Public form route** `src/app/nps/[patient-id]/[token]/page.tsx` — direct structural copy of `src/app/anamnese/[patient-id]/[token]/page.tsx`: Server Component reads the row via `createAdminClient()`, validates token via the same `isTokenValid`-style helper (add `isNpsTokenValid` next to `isTokenValid` in `src/lib/validators/`, or generalize the existing one — both are valid; generalizing avoids duplicate token-expiry logic), renders full-page error on invalid/expired/used, otherwise renders `NpsPublicForm` (client component, `useState`-only per UI-SPEC — no react-hook-form needed for a 1-field form). Submission is a Server Action using `createAdminClient()` (no session — public route), with the SAME TOCTOU discipline as `submitAnamnesisPublic`: the atomic single-use guarantee lives in a conditional `UPDATE ... WHERE token_used_at IS NULL AND token_expires_at > now()`, not in the page's read-then-render check.

**IMPORTANT — route path collision risk:** the anamnese route is `/anamnese/[patient-id]/[token]`; NPS should NOT reuse `/nps/[patient-id]/[token]` if `patient-id` in the URL leaks which patient a token belongs to before validation (same weakness already accepted for anamnese — this is an existing pattern, not a new regression, but worth flagging: the `patient-id` segment is not itself sensitive since the token is the actual secret and is required to match).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Kanban drag-and-drop + keyboard accessibility | Custom `onMouseDown`/`onDragStart` handlers, custom ARIA live region announcements | `@dnd-kit/react` (`DragDropProvider` + `useDraggable`/`useDroppable`/`useSortable`) | `KeyboardSensor` + ARIA live-region announcements are built in and auto-registered; UI-SPEC's hard requirement ("NUNCA depender apenas de drag-and-drop de mouse") is satisfied by the library default, not by custom code [VERIFIED: dndkit.com docs] |
| WhatsApp/email delivery reliability (retries, at-least-once dedup) | A new queue table or direct synchronous `fetch()` calls from Server Actions | Existing `message_outbox` + `drainOutbox()` (`src/lib/messaging/`) | Already solves atomic claim (CAS), permanent-vs-transient error classification, idempotency — re-solving this in Phase 18 would duplicate CR-02/WR-03/WR-04 fixes already hardened in Phase 4/5 |
| AI governance / audit trail for the personalization agent | A new "requires approval" flag or ad-hoc admin check | `withAgentPolicy` + `approval_requests` (Phase 10) | D-09 explicitly requires this exact mechanism; building a parallel gate would fragment `ai_decision_log` audit coverage |
| Public single-use token validation | New token-generation/expiry logic | Generalize the anamnese pattern (`isTokenValid`, `token`/`token_expires_at`/`token_used_at` columns) | D-13 explicitly names this as the pattern to reuse; the TOCTOU-safe atomic UPDATE discipline in `submitAnamnesisPublic` took real engineering to get right (WR-05 in that phase) — don't re-derive it |
| NPS/CPL/CAC math | Ad-hoc inline arithmetic scattered across components | Pure functions in `src/lib/crc/roi-math.ts` (`computeCpl`, `computeCac`, `classifyNps`) | Matches the project's `nyquist_validation` convention of isolating pure business logic for unit testing (mirrors `reminder-scan.ts`, `lab-cost.ts`) — also the exact place to enforce "—" when denominator is 0 |

**Key insight:** Almost nothing in this phase should be new plumbing. The engineering risk is entirely in *wiring existing plumbing correctly* (approval→execution gap, consent-gating a query, unit_id resolution for tables that don't have it) — not in building new send/queue/governance mechanisms.

## Common Pitfalls

### Pitfall 1: `approval_requests.type` CHECK does not have room for a `'campaign'` type — and UI-SPEC's "novo entity_type" language doesn't map to a real column
**What goes wrong:** A planner reads UI-SPEC's line "apenas um novo entity_type na tabela existente" and tries to `ALTER TABLE approval_requests ADD ... CHECK (type IN (..., 'campaign'))`, unnecessarily touching a Phase-10 table.
**Why it happens:** UI-SPEC used "entity_type" loosely; the actual table has `type TEXT CHECK (type IN ('ai_action','estorno'))` and a separate `agent_key TEXT` column (nullable, "for type='ai_action'" per the migration's own comment).
**How to avoid:** Use `type = 'ai_action'`, `agent_key = 'crc-campaign'`. The `ApprovalInbox.tsx` `requestSummary()` function already special-cases `type === 'ai_action'` to render `agentKey` + `payload.action` — add a small campaign-specific summary branch (payload can carry `recipientCount`/`channel`/`previewMessage` for the reviewer per UI-SPEC's "card de campanha na inbox mostra preview da mensagem").
**Warning signs:** A migration touching `approval_requests`'s CHECK constraint in a Phase 18 plan is a signal this pitfall was hit.

### Pitfall 2: `approveRequest()` does NOT execute the underlying action — campaign dispatch needs its own wrapper
**What goes wrong:** Planner assumes clicking "Aprovar Disparo" in the existing `ApprovalInbox` component automatically sends the campaign, because that's what the UX implies.
**Why it happens:** `approveRequest()` (src/actions/approval-actions.ts) sets `status='approved'` and `executed_at=now()` but never touches the `payload`. Every existing caller (`cancelarPayable` for `type='estorno'`) only creates the audit-trail row — the actual cancellation is a SEPARATE code path the codebase does not currently have wired for approved estornos either (confirmed via `approveRequest`'s own comment: `payload_dispatched: false, // explicit: no payload executed yet`).
**How to avoid:** Build a dedicated `approveCampaignAndDispatch(approvalRequestId, campaignId)` Server Action (or extend `ApprovalInbox` with a campaign-specific card/button per UI-SPEC's "aprova aqui" flow) that: (1) calls `approveRequest(approvalRequestId)`, (2) on success, re-resolves the segment (patients may have opted out or changed since the preview), (3) filters by `patient_consents`, (4) enqueues outbox rows, (5) sets `campaigns.status = 'enviada'`. If step 2-5 fails after step 1 succeeds, `campaigns.status` should have a distinguishable failure state (`'aprovada'` but not yet `'enviada'`) so a retry path exists — do not silently leave the campaign in limbo.
**Warning signs:** A plan that calls the generic `approveRequest` from `ApprovalInbox.tsx` and expects `message_outbox` rows to appear as a side effect.

### Pitfall 3: `patients` has no `unit_id` — D-07's "unidade" segment filter and NPS panel's unit filter need query-time resolution
**What goes wrong:** A migration adds `unit_id` directly to `patients` (mirroring the Phase 7 `operational_unit_id.sql` pattern used for `appointments`/`charges`/`receivables`), which is a much bigger blast-radius change than Phase 18 needs, and duplicates truth (a patient could visit multiple units).
**Why it happens:** The obvious "just add the column" instinct, following the visible Phase 7 precedent.
**How to avoid:** Resolve a patient's unit at query time from their most recent `appointments.unit_id` (`SELECT unit_id FROM appointments WHERE patient_id = $1 ORDER BY start_time DESC LIMIT 1`) — this is also naturally where "inativo há X dias" (days since last appointment) and "último procedimento" (via `appointment_procedures.service_id`) are already being computed for D-07, so the unit filter falls out of the same query for free. This mirrors the existing "resolve at query-time, no redundant FK" precedent (STATE.md: "Professional resolved at query-time via user_id — Phase 11 intentional").
**Warning signs:** A migration titled anything like `patients_add_unit_id` in Phase 18.

### Pitfall 4: `patient_consents.consent_type` CHECK has `'marketing_whatsapp'` but no `'marketing_email'` — D-08's "respeitando a preferência/opt-in" needs an explicit decision
**What goes wrong:** Campaign segment query filters WhatsApp sends by `marketing_whatsapp` consent but has no equivalent gate for the email channel, silently sending reactivation emails to patients who never consented to marketing communication via email.
**Why it happens:** The CHECK constraint (`20260604000300_clinics_users_phase1.sql`) only anticipated WhatsApp marketing consent; email marketing consent was never modeled.
**How to avoid:** Two options, both viable — (a) ALTER the CHECK constraint to add `'marketing_email'` and require a separate consent row per channel (more correct, more UI to collect it — no existing screen collects `patient_consents` today per this audit, so this is a bigger lift than it first appears), or (b) treat `marketing_whatsapp` as the umbrella "marketing communications" consent applied to both channels for v1 (simpler, ships faster, matches the fact that D-08 doesn't distinguish channel-level consent granularity). **Recommend (b) for v1** and flag it explicitly as a locked assumption needing user confirmation (see Assumptions Log A2) rather than silently picking one.
**Warning signs:** A plan that either skips consent-gating for email entirely, or invents a consent mechanism outside `patient_consents`.

### Pitfall 5: Don't build a date-expression unique index for NPS-invite dedup (repeat of the Phase 17 `42P17` immutable-index trap)
**What goes wrong:** A planner designs NPS-invite dedup as "one invite per patient per day" using a partial unique index like `((created_at AT TIME ZONE 'America/Sao_Paulo')::date)`, hitting the same `supabase-js .onConflict()` limitation documented in Phase 17 (`insertStockAlert`) — `.onConflict()` only accepts plain column names, forcing an app-level SELECT-then-INSERT dance for no reason.
**Why it happens:** Copying the Phase 17 stock-alert daily-dedup pattern without noticing NPS invites don't need a *daily* dedup at all.
**How to avoid:** Dedup NPS invites per-**appointment**, not per-day: `UNIQUE (appointment_id)` on `nps_responses` (a plain column, no date expression, `.onConflict('appointment_id')` works natively). An appointment only reaches `'concluido'` once in this schema's lifecycle (no "reopen" transition exists in the `status` CHECK), so per-appointment dedup is both correct and simpler than a date-window approach. This also means the cron scan itself is self-healing (see Pattern 4) — a missed night just gets caught the next run, with no risk of double-sending.
**Warning signs:** Any `AT TIME ZONE` expression inside a Phase 18 migration's index definition.

### Pitfall 6: No CRC-specific module key exists in `proxy.ts` — and that's consistent with the Phase 17 precedent, not a gap
**What goes wrong:** A planner adds a new `ModuleKey = ... | 'crc'` and a `ROUTE_MODULE_MAP` entry for `/clinica/crc`, assuming every phase needs its own module key.
**Why it happens:** Phases 8/9/10/12/13 each did add a dedicated module key (`documentos`, `integracoes`, `conformidade`, `receituario`, `teleodontologia`, `esterilizacao`, `protese`), so it looks like the default pattern.
**How to avoid:** Phase 17 (Estoque) did NOT add a module key — `/clinica/estoque/*` falls under the generic `clinica` prefix in `ROUTE_MODULE_MAP` (no entry for `estoque` exists), relying on `receptionist`/`dentist`/`admin`/`superadmin` all having `clinica: {allowed:true}` and RLS + Server Action role gates (`WRITER_ROLES`) for actual write restriction. Phase 18 should follow the SAME precedent: no proxy.ts change needed. Restrict writes at the Server Action / RLS layer with `WRITER_ROLES = ['receptionist', 'admin', 'superadmin']` (see Pitfall 7 — there is no distinct "marketing" role).
**Warning signs:** A proxy.ts diff in a Phase 18 plan.

### Pitfall 7: There is no `'marketing'` role in the 11-value role enum
**What goes wrong:** Server Actions gate writes with a `MARKETING_ROLES` or `CRC_ROLES` constant referencing a role value that doesn't exist in the CHECK constraint, causing every write to fail role validation in practice (or, worse, silently matching nothing and blocking everyone).
**Why it happens:** The phase description says "Recepção/Marketing gerencia" — "Marketing" reads like a role name.
**How to avoid:** The confirmed 11-value enum (`20260614000400_role_expansion.sql`) is `admin, dentist, receptionist, patient, superadmin, dpo, auditor, socio, ti, implantacao, aluno` — no `marketing`. Use `WRITER_ROLES = ['receptionist', 'admin', 'superadmin']` for lead/campaign/referral writes (mirrors every other phase's `const WRITER_ROLES = [...] as const` convention in `src/actions/*.ts`).
**Warning signs:** Any reference to a `'marketing'` string as a role value anywhere in code or RLS policy.

### Pitfall 8: Meta template category mismatch — reactivation campaigns are MARKETING, not UTILITY
**What goes wrong:** Registering `TEMPLATE_REACTIVATION` as a UTILITY-category template (like the existing `TEMPLATE_COLLECTION`/`TEMPLATE_APPOINTMENT_REMINDER`) to save cost, then having Meta auto-reclassify or reject it because the copy contains promotional language ("aproveite", "desconto", "volte") — the existing `templates.ts` file has an explicit comment warning about exactly this auto-reclassification behavior (April 2025 Meta policy change, cited in-file).
**Why it happens:** Copy-pasting the utility-template pattern without registering the new template under the correct Meta category.
**How to avoid:** Register `fynxia_reativacao` as MARKETING category in Meta Business Manager (external/manual step — same as any other template registration), accept the higher per-conversation cost, and make sure D-08's opt-in gate is airtight since MARKETING-category sends to non-opted-in numbers carry a real risk of number/quality-rating penalties from Meta. `fynxia_pesquisa_nps` should stay UTILITY (transactional, post-service — same category logic as the existing reminder/collection templates).
**Warning signs:** A single shared "reactivation-or-nps" template constant, or promotional wording review skipped before Meta registration.

## Code Examples

Verified patterns from in-repo source (all read directly, HIGH confidence):

### Outbox enqueue (campaign / NPS invite send) — mirrors `collection-agent.ts`
```typescript
// Source: src/lib/agents/collection-agent.ts (read in full during this research)
import { getOutboxQueue } from '@/lib/messaging/queue'
import { withAgentPolicy } from '@/lib/ai/policy'

const queue = getOutboxQueue(admin)

const govResult = await withAgentPolicy(
  { clinicId: tenantId, agentKey: 'crc-campaign', actorId: null, action: 'agent.campaign.notify', actionSensitivity: 'safe' },
  async () => {
    const enqueueResult = await queue.enqueue({
      tenantId,
      channel: 'whatsapp',
      idempotencyKey: `campaign:${campaignId}:${patientId}`,
      payload: {
        kind: 'whatsapp_template',
        to: e164,
        templateName: TEMPLATE_REACTIVATION,
        languageCode: WHATSAPP_LANGUAGE,
        components: buildReactivationComponents({ patientName: personalizedText, /* ... */ }),
      },
    })
    // ... audit log, return success flag
  },
)
```

### LLM personalization with ZDR — mirrors `buildCollectionMessage`
```typescript
// Source: src/lib/agents/collection-agent.ts:59-105
const { text } = await generateText({
  model: 'anthropic/claude-sonnet-4.6',
  system: `... REGRAS OBRIGATÓRIAS: Não inclua URL... Use apenas o primeiro nome...`,
  messages: [{ role: 'user', content: [{ type: 'text', text: `Primeiro nome: ${firstName}.` }] }],
  providerOptions: { gateway: { zeroDataRetention: true } satisfies GatewayProviderOptions },
})
```

### Public token route skeleton — mirrors anamnese
```typescript
// Source: src/app/anamnese/[patient-id]/[token]/page.tsx (read in full)
const admin = createAdminClient()
const { data: row, error } = await admin
  .from('nps_responses')
  .select('id, token_used_at, token_expires_at, score')
  .eq('token', token)
  .eq('appointment_id', appointmentId) // or patient_id, matching route shape
  .single()
const isValid = !error && row !== null && isTokenValid({ token_used_at: row.token_used_at, token_expires_at: row.token_expires_at }, new Date()) && row.score === null
```

### CRON route skeleton — mirrors collection-agent cron
```typescript
// Source: src/app/api/cron/collection-agent/route.ts (read in full)
export const runtime = 'nodejs'
export async function GET(request: Request): Promise<Response> {
  if (!isCronAuthorized(request.headers.get('authorization'))) return new Response('Unauthorized', { status: 401 })
  const admin = createAdminClient()
  const result = await runNpsInviteScan(admin)   // new — mirrors runCollectionAgent
  const drain = await drainOutbox(admin)
  return Response.json({ ...result, whatsapp_drained: drain.processed, whatsapp_failed: drain.failed })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@dnd-kit/core` + `@dnd-kit/sortable` (v6, "Legacy" per dndkit.com) | `@dnd-kit/react` (v0.5.x, wraps `@dnd-kit/dom`/`@dnd-kit/state`/`@dnd-kit/abstract`) | `@dnd-kit/react` first stable-labeled release within the last month (0.5.0, 2026-07-06); `@dnd-kit/core` last published 2024-12-05 | Simpler API (`useDraggable`/`useDroppable`/`useSortable` auto-register with `DragDropProvider`, no manual sensor wiring for keyboard), explicit React 19 peer support instead of an unbounded `>=16.8.0` range |

**Deprecated/outdated:**
- `@dnd-kit/core`/`@dnd-kit/sortable` (v6.x): not deprecated in the sense of being pulled from npm, but explicitly labeled "Legacy" in the maintainers' own migration guide with `@dnd-kit/react` as the documented upgrade path. New projects should not start on the legacy branch.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@dnd-kit/react` (not `@dnd-kit/core`+`@dnd-kit/sortable`) is the right choice for a brand-new kanban in this codebase, despite UI-SPEC recommending the legacy pair | Standard Stack, State of the Art | LOW-MEDIUM — if wrong, swapping back to `@dnd-kit/core`+`@dnd-kit/sortable` is a contained change (same conceptual API shape: `DndContext`≈`DragDropProvider`, `useDraggable`/`useDroppable` exist in both). Community code examples/tutorials are more abundant for the legacy API, which could slow implementation if `@dnd-kit/react`'s docs prove thin in practice. |
| A2 | `marketing_whatsapp` consent (the only existing `patient_consents.consent_type` marketing value) should gate BOTH WhatsApp and email reactivation sends in v1, rather than adding a distinct `marketing_email` type | Pitfall 4 | MEDIUM — if the user actually wants channel-granular consent, this under-models LGPD requirements for email; however no UI currently exists anywhere in the codebase to collect `patient_consents` rows at all, so this gap likely needs a broader Phase 18 (or later) UX addition regardless of which option is chosen. |
| A3 | Campaign cost should be attributed at `payables` creation time (lançamento / committed spend) rather than at `baixarPayable` time (realized / paid spend) | Architecture Pattern 2, Alternatives Considered | LOW-MEDIUM — D-05/D-06 don't specify "pago" vs. "lançado"; if the business actually wants CPL/CAC based on cash actually paid, the query needs an added `AND status IN ('pago','parcial')` filter — a one-line change, not a schema change, so low blast radius even if wrong. |
| A4 | The nightly NPS cron should run at 23:00 UTC (20:00 BRT) — "à noite" per D-12 — and this schedule doesn't conflict with existing crons | Architecture Pattern 4 | LOW — schedule is cosmetic; the existing 7 crons in `vercel.json` run at 05:00–13:00 UTC, so 23:00 UTC has no overlap. Easy to adjust if the user has a stronger preference. |
| A5 | `nps_responses.appointment_id` (not `patient_id`) is the right dedup/foreign-key anchor, meaning a patient with 2 concluded appointments gets 2 separate NPS invites | Pattern 4, Pitfall 5 | LOW — this matches "coleta NPS pós-consulta" (D-12 says per-atendimento, "varre atendimentos concluídos"), so per-appointment is the textually correct reading of the decision; flagging only because per-patient (max 1 invite/month, say) is a plausible alternate interpretation the user might actually want to avoid survey fatigue. |

## Open Questions (RESOLVED)

1. **Does the campaign approval card in `ApprovalInbox.tsx` need a bespoke UI, or can the generic `requestSummary()`/`RequestCard` render campaign payloads adequately?**
   - What we know: `ApprovalInbox.tsx` already special-cases `type === 'ai_action'` with a generic one-line summary (`agentKey` + `payload.action`). UI-SPEC says the campaign card should show "nome da campanha, N destinatários, canal, preview da mensagem" — richer than the current one-liner.
   - What's unclear: Whether to extend `requestSummary()`/`RequestCard` generically (branch on `agent_key === 'crc-campaign'`) or build a fully separate campaign-approval component that doesn't reuse `ApprovalInbox` at all.
   - Recommendation: Extend `requestSummary()` with an `agent_key === 'crc-campaign'` branch (minimal diff, keeps single approval inbox) — the planner should size this as a small task on the existing component, not a new component per UI-SPEC's own guidance ("NÃO criar um novo componente de aprovação").
   - **RESOLVED:** Closed by Plan 09 â ApprovalInbox.tsx extends requestSummary() with an `agent_key === 'crc-campaign'` branch (richer campaign card, no new approval component).

2. **Referral reward "crédito em serviços" (D-17) — is there an existing mechanism to apply a credit at charge/OS time, or is this purely a ledger with no redemption UI in v1?**
   - What we know: D-19 says balance is "visível em tela interna agora... modelado para o portal expor na Fase 20" — this implies v1 is read-only/informational, no redemption flow yet.
   - What's unclear: Whether `referral_rewards.type = 'uso'` rows are ever actually created in this phase, or whether that CHECK value is purely forward-looking schema (built now, used later).
   - Recommendation: Treat v1 as `type = 'credito'` only — no redemption UI, no `'uso'` rows created by any Phase 18 action. Keep the CHECK constraint open to `'uso'` for forward-compatibility but don't build the consuming flow.
   - **RESOLVED:** Closed by Plan 04 â v1 referral ledger is credito-only; no `'uso'` rows are created by any Phase 18 action (CHECK kept open to 'uso' for forward-compat only).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| `@dnd-kit/react` | Kanban D&D (D-02) | ✗ (not yet installed) | 0.5.0 available on npm | none needed — `npm install @dnd-kit/react` is a standard install, no external service dependency |
| Meta WhatsApp Cloud API credentials (`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN`) | Campaign + NPS WhatsApp sends (D-08/D-11/D-13) | Unknown — STATE.md Open Question #3 ("Meta Business verification concluída?") still listed **Open** as of last update | — | `sendTemplateMessage` already degrades gracefully (`{ success: false, error: 'WhatsApp credentials not configured' }`) when env vars absent — campaign/NPS flows will enqueue but the WhatsApp channel leg will fail-soft in `drainOutbox` (marked `failed` after max attempts) until Meta verification completes; email channel is unaffected |
| `RESEND_API_KEY` | Campaign + NPS email sends | Assumed present (used since Phase 3/4) | — | `getResend()` lazy-inits; if absent, `emails.send` throws at call time inside the per-row try/catch in `drainOutbox` (row marked failed, doesn't crash the drain loop) |
| `AI_GATEWAY_API_KEY` | Campaign personalization (D-09) | Assumed present (used since Phase 5) | — | `buildCampaignMessage` (mirroring `buildCollectionMessage`) must implement the same static-fallback-when-absent pattern — required, not optional, since campaign creation must not hard-fail without an LLM key |

**Missing dependencies with no fallback:**
- None — every dependency above has a defined fail-soft path already established by the existing codebase conventions.

**Missing dependencies with fallback:**
- `@dnd-kit/react` — not a runtime dependency risk, just an `npm install` the planner's Wave 0 must include.
- Meta WhatsApp credentials — if still unverified when Phase 18 executes, WhatsApp-channel campaign/NPS sends will fail-soft (existing `isPermanentError`/`drainOutbox` handling); email channel and the rest of the phase (kanban, ROI, referrals) are fully independent of this and unaffected.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (`vitest.config.ts` present) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/__tests__/<new-crc-dir>` |
| Full suite command | `npm run test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| CRC-01 | Lead stage transition is idempotent/valid (novo→...→convertido/perdido, no illegal transitions) | unit | `npx vitest run src/__tests__/crc/leads.test.ts` | ❌ Wave 0 |
| CRC-01 | Kanban stage-move Server Action enforces `WRITER_ROLES` | unit | `npx vitest run src/__tests__/crc/leads.test.ts` | ❌ Wave 0 |
| CRC-02 | `computeCpl`/`computeCac` pure functions handle zero-denominator ("—" not divide-by-zero) | unit | `npx vitest run src/__tests__/crc/roi-math.test.ts` | ❌ Wave 0 |
| CRC-03 | Campaign approval flow: `submitCampaignForApproval` creates `approval_requests` row with `type='ai_action'`, `agent_key='crc-campaign'`; `approveCampaignAndDispatch` enqueues outbox rows only after approval succeeds | integration | `npx vitest run src/__tests__/crc/campaigns.test.ts` | ❌ Wave 0 |
| CRC-03 | Consent gating: campaign segment excludes patients without `marketing_whatsapp` consent (or revoked) | unit | `npx vitest run src/__tests__/crc/segment.test.ts` | ❌ Wave 0 |
| CRC-04 | `selectNpsInviteTargets` / scan query never re-invites an appointment that already has an `nps_responses` row | unit | `npx vitest run src/__tests__/crc/nps-scan.test.ts` | ❌ Wave 0 |
| CRC-04 | `classifyNps` correctly buckets 9-10/7-8/0-6 | unit | `npx vitest run src/__tests__/crc/roi-math.test.ts` | ❌ Wave 0 |
| CRC-05 | Referral reward credited only on lead reaching `stage='convertido'`, never before | integration | `npx vitest run src/__tests__/crc/referrals.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <file>` for the file(s) touched.
- **Per wave merge:** `npm run test` (full suite) — this project's existing 30+ test directories mean full-suite run time should be checked; if slow, scope to `src/__tests__/crc/` plus any cross-cutting dirs touched (e.g. `src/__tests__/governance/` if `approval_requests` usage changed).
- **Phase gate:** Full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/__tests__/crc/leads.test.ts` — covers CRC-01
- [ ] `src/__tests__/crc/roi-math.test.ts` — covers CRC-02, CRC-04 (classifyNps)
- [ ] `src/__tests__/crc/campaigns.test.ts` — covers CRC-03
- [ ] `src/__tests__/crc/segment.test.ts` — covers CRC-03 (consent gating)
- [ ] `src/__tests__/crc/nps-scan.test.ts` — covers CRC-04
- [ ] `src/__tests__/crc/referrals.test.ts` — covers CRC-05
- [ ] Framework install: none — Vitest already configured project-wide, no new install needed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | Indirect | Public NPS route (`/nps/[patient-id]/[token]`) deliberately bypasses auth by design (mirrors anamnese) — token IS the credential; no separate auth control applies here |
| V3 Session Management | No | No new session concept introduced |
| V4 Access Control | Yes | `WRITER_ROLES = ['receptionist','admin','superadmin']` gate on every write Server Action (mirrors `payables.ts`/`products.ts` pattern); RLS `USING`+`WITH CHECK` on `clinic_id = get_my_tenant_id()` on all 6 new tables; approval alçada (`canApprove`) unchanged, reused as-is |
| V5 Input Validation | Yes | Zod v3 schemas (no `.default()` — D-133 project convention) for all new Server Action inputs (`leadSchema`, `campaignSegmentSchema`, `npsSubmitSchema`) |
| V6 Cryptography | Yes | NPS token generation must use a cryptographically random generator (mirror however `anamneses.token` is generated — check `src/actions/anamneses.ts` for the exact `crypto.randomUUID()`/`randomBytes` call used, and reuse the identical primitive rather than inventing a new one) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Public NPS form token guessing/enumeration | Spoofing | Cryptographically random token (128+ bits), single-use atomic UPDATE guard (mirrors `submitAnamnesisPublic`'s WR-05 TOCTOU fix), rate-limiting is out of scope for this phase but should be flagged if abuse is observed post-launch |
| Campaign mass-send bypassing human approval (a bug in `approveCampaignAndDispatch` that fires on `submitCampaignForApproval` instead of on actual approval) | Elevation of Privilege | Server Action MUST only enqueue after `approveRequest()` returns `{ success: true }` — never enqueue speculatively; this is the single most safety-critical wiring point in the whole phase given D-09's explicit "nenhuma mensagem sai sem aprovação humana" requirement |
| Marketing send to non-consented patient (LGPD violation) | Tampering (of consent boundary) / Information Disclosure | Explicit `patient_consents` join with `revoked_at IS NULL` filter in the segment query — never rely on "patient has a phone number" as a proxy for consent (this mistake is easy to make since `toE164(patient.phone)` filtering is already a familiar pattern from `confirmation-agent.ts`, but that agent operates on transactional/utility sends which don't require marketing opt-in) |
| PII leakage into `ai_decision_log`/`agent_outreach_log`/audit events for campaign personalization | Information Disclosure | Mirror `collection-agent.ts` exactly: audit events log IDs/counts only, never the personalized message text or patient PII beyond first name in the LLM call itself |
| Referral reward double-credit (race between two concurrent conversions of the same lead) | Tampering (financial) | Use the same CAS/atomic-UPDATE discipline as `baixarPayable`/`selectFifoBatch` (Phase 16/17 precedent: `UPDATE ... WHERE credited_at IS NULL` conditional, check affected-row count before proceeding) when crediting `referral_rewards` on stage transition to `'convertido'` |

## Sources

### Primary (HIGH confidence — direct source reads in this session)
- `src/lib/messaging/queue.ts`, `worker.ts`, `reminder-scan.ts`, `types.ts` — outbox pattern
- `src/lib/whatsapp/client.ts`, `templates.ts` — WhatsApp Cloud API wrapper + template builders
- `src/lib/resend.ts` — email send
- `src/lib/agents/collection-agent.ts`, `confirmation-agent.ts` — governed agent pattern
- `src/lib/ai/policy.ts`, `whatsapp-intent.ts` — `withAgentPolicy` L0-L4 gate
- `src/actions/approval-actions.ts`, `src/components/conformidade/ApprovalInbox.tsx` — approval queue (and its execution gap)
- `src/app/anamnese/[patient-id]/[token]/page.tsx` — public single-use token pattern
- `src/app/api/cron/collection-agent/route.ts` — cron route skeleton
- `supabase/migrations/20260616200_approval_requests.sql`, `20260607000100_message_outbox.sql`, `20260619001100_financial_cadastros_tables.sql`, `20260621000100_payables_tables.sql`, `20260606000300_financial_categories_seed.sql`, `20260605000100_clinical_tables.sql`, `20260614000700_operational_unit_id.sql`, `20260614000400_role_expansion.sql`, `20260604000300_clinics_users_phase1.sql`, `20260703000300_estoque_rls.sql` — schema/RLS precedents
- `src/actions/payables.ts` (`cancelarPayable`), `src/actions/lab-orders.ts` (`postLabExpense`) — financial linkage + approval-request-as-audit-trail-only precedent
- `src/proxy.ts` — module/role permission matrix, `ROUTE_MODULE_MAP`
- `package.json` — confirmed no `dnd-kit`/`recharts` installed, React 19.2.4, Vitest 4.1.8
- `npm view @dnd-kit/core|@dnd-kit/react|@dnd-kit/sortable version/peerDependencies/dependencies/time.modified` — version/compat verification

### Secondary (MEDIUM confidence — WebFetch of official docs, cross-checked against npm registry data)
- https://dndkit.com/react/guides/migration/ — confirms `@dnd-kit/react` is the endorsed successor, `@dnd-kit/core` labeled "Legacy"
- https://dndkit.com/react/quickstart/ — `DragDropProvider`/`useDraggable`/`useDroppable`/`useSortable` minimal API
- WebSearch "@dnd-kit/react KeyboardSensor accessibility" — confirms `KeyboardSensor` auto-registered on `DragDropProvider`, ARIA live-region announcements built in

### Tertiary (LOW confidence — not used for any load-bearing claim in this document)
- None — every claim above is either a direct source read or an official-docs WebFetch cross-checked against the npm registry.

## Metadata

**Confidence breakdown:**
- Standard stack (outbox/WhatsApp/Resend/agents/approvals reuse): HIGH — all read directly from source in this session
- Standard stack (dnd-kit choice): MEDIUM — npm registry data is HIGH confidence, but real-world React 19 production usage of `@dnd-kit/react` specifically (vs. the far more battle-tested `@dnd-kit/core`) has less community track record given its very recent stabilization
- Architecture (financial linkage, schema design): MEDIUM — no locked precedent exists for cross-module attribution (campaign↔despesa); design is a reasoned extrapolation from the `lab_orders.financial_transaction_id` precedent, not a direct copy
- Pitfalls (approval-execution gap, missing unit_id/consent columns): HIGH — all confirmed by direct source/migration reads, not inference

**Research date:** 2026-07-11
**Valid until:** 30 days for the reuse-audit findings (stable, in-repo code); 7 days for the `@dnd-kit/react` version recommendation specifically (very recently stabilized package — re-verify `npm view @dnd-kit/react version` immediately before Wave 0 if planning is delayed)
