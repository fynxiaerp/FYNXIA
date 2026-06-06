# Phase 4: Communications & Async - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

O sistema envia automaticamente, sem trigger manual: lembretes de consulta (WhatsApp + e-mail, na manhã do dia anterior) e mensagens de cobrança (canal WhatsApp da régua que já existe), via jobs assíncronos confiáveis (fila outbox + worker em Vercel Cron, com retry e sem envio duplicado). Cobre COMMS-01..04.

**Fora do escopo (outras fases):** capturar/agir na resposta dos botões do WhatsApp (Fase 5 / AI-02); agendamento mais fino que diário (precisa de Vercel Pro); pg_cron/pgmq nativo (futuro, ao migrar Supabase Pro).
</domain>

<decisions>
## Implementation Decisions

### Infra assíncrona (COMMS-04)
- **D-01:** **Abstração `MessageQueue` + tabela outbox + worker em Vercel Cron** (FREE, $0) — mesma filosofia do `PaymentGateway` (Fase 3). Uma interface de fila com implementação `outbox` (tabela `message_outbox` com status pending/sent/failed + attempts) drenada por um endpoint de Vercel Cron. **Migração futura para pg_cron/pgmq** (quando no Supabase Pro) = trocar a implementação atrás da interface, sem reescrever o código de envio. COMMS-04 é satisfeita pelo OUTCOME (fila assíncrona + retries + sem duplicação); a implementação nativa pgmq/pg_cron fica como upgrade.
- **Restrição conhecida:** Vercel **Hobby = no máximo 1 execução/dia por cron**. Logo, os lembretes são um **batch diário** (não envio contínuo). Granularidade horária exige Vercel Pro (deferido).
- **Idempotência + retry:** o worker processa linhas `pending` do outbox, marca `sent`/`failed`, e re-tenta `failed` até N tentativas. Nenhuma falha de job derruba o app (try/catch por linha).

### WhatsApp Meta (COMMS-01)
- **D-02:** **Construir a integração Meta WhatsApp Cloud API + templates agora** (envio de template via `WHATSAPP_*` env vars: phone-number-id, access token, business account id), unit-testado, e **adiar a verificação live como UAT** — mesma estratégia do Asaas (Fase 3). A **conta/verificação Meta Business ainda NÃO foi iniciada**; o usuário inicia em paralelo (lead-time 7-14 dias corre enquanto construímos). Cloud API oficial apenas — **nunca** Evolution API/Baileys (ToS, risco existencial — locked no PROJECT).

### Templates WhatsApp (COMMS-03)
- **D-03:** **2 templates, todos categoria `utility`** (nunca marketing — evita reclassificação Meta):
  1. **Lembrete de consulta** (24h antes) **com botões quick-reply "Confirmar" / "Cancelar"** — os botões já ficam prontos no template; **capturar/agir na resposta é Fase 5 (AI-02)**, não nesta fase.
  2. **Cobrança** — com o link de pagamento Asaas (canal WhatsApp da régua, SC-3).

### Lembretes: agendamento e dedup (COMMS-01, COMMS-02)
- **D-04:** **Cron diário às ~08:00 BRT (11:00 UTC)** varre as consultas **do dia seguinte** (status não-cancelado) e enfileira lembrete em **ambos os canais (WhatsApp + e-mail)**. Paciente recebe na manhã anterior (~16-32h antes). **Dedup** via tabela de log de envios chaveada por `(appointment_id, channel, type)` — reexecução do cron não reenvia. E-mail via Resend + React Email (COMMS-02).

### Canal WhatsApp da régua de cobrança (SC-3)
- **D-05:** A régua de cobrança da Fase 3 (hoje só e-mail) passa a **enfileirar também no canal WhatsApp** via o mesmo outbox. O `collection_log` existente continua garantindo idempotência por (recebível + marco).

### Claude's Discretion
- Estrutura exata da tabela `message_outbox` (colunas, status enum, payload JSONB) e do `message_log` de dedup.
- Se o mesmo endpoint de Vercel Cron faz scan+enqueue+drain numa invocação, ou se há um cron separado de worker (respeitando o limite de 1/dia por cron do Hobby).
- Conteúdo/cópia exata dos templates (utility é locked); React Email template do lembrete por e-mail.
- Retry policy (nº de tentativas, backoff) no worker.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mensageria
- `CLAUDE.md` (seção *Messaging*) — Meta WhatsApp Cloud API (oficial, sem Evolution/Baileys), template messages obrigatórios, categorias utility vs marketing, Resend + React Email; lista de templates sugeridos (lembrete, confirmação, cobrança).
- https://developers.facebook.com/docs/whatsapp/cloud-api — Meta WhatsApp Cloud API (envio de template messages, components/buttons).
- Resend + React Email — reusar o helper existente `src/lib/resend.ts` (factory `getResend()` lazy, lição da Fase 3) e o padrão de template de convite da Fase 1.

### Async / Cron
- `vercel.json` — já tem o cron da régua (Fase 3); adicionar o cron diário de lembretes (`0 11 * * *` UTC = 08:00 BRT). Vercel Hobby = 1 exec/dia por cron.
- `src/app/api/cron/collection-ruler/route.ts` — padrão de endpoint de cron protegido por `Authorization: Bearer $CRON_SECRET` (reusar).
- `src/lib/collection/ruler.ts` + `src/actions/collection-ruler.ts` — motor da régua (Fase 3) onde o canal WhatsApp pluga (D-05).

### Dados (Fase 2/3 a reusar)
- `appointments` (Fase 2) — fonte do scan de lembretes (start_time, patient_id, dentist_id, status).
- `patients` (Fase 2) — telefone/e-mail do destinatário (telefone em plaintext; e-mail).
- `receivables` + `collection_rules`/`collection_log` (Fase 3) — base da cobrança WhatsApp.
- Padrão de migration + RLS + audit (Fase 2/3): toda tabela nova com `tenant_id` indexado, RLS USING+WITH CHECK.

[Sem ADRs internos dedicados — requisitos nas decisões acima + docs externas Meta/Resend.]
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getResend()` (src/lib/resend.ts) + padrão React Email da Fase 1 — lembrete por e-mail (COMMS-02).
- Endpoint de Vercel Cron protegido por CRON_SECRET (src/app/api/cron/collection-ruler/route.ts) — modelo para o cron de lembretes.
- Motor da régua de cobrança (Fase 3) — ponto de plugue do canal WhatsApp (D-05).
- `logBusinessEvent` (src/lib/audit.ts) — auditoria de envios.
- `createAdminClient()` — leitura cross-tenant no worker/cron (sem sessão), com escopo explícito por tenant na query.

### Established Patterns
- Abstração de provider via interface + adapter (PaymentGateway na Fase 3) — replicar em `MessageQueue` e no envio WhatsApp/email (canais).
- Vercel Cron + endpoint nodejs protegido por Bearer CRON_SECRET (D-09 da Fase 3).
- Migrations via supabase/migrations + db push (checkpoint bloqueante — conta certa do Supabase; ver memória do projeto).

### Integration Points
- `vercel.json` crons — adicionar o cron de lembretes.
- `.env.local.example` — adicionar `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID` (e o que o template exigir).
- Régua de cobrança (Fase 3) — adicionar canal WhatsApp.
</code_context>

<specifics>
## Specific Ideas

- Reusar a filosofia de abstração do `PaymentGateway` para a fila (`MessageQueue`) e para os canais — o usuário valorizou esse padrão na Fase 3 (porta aberta para trocar infra sem reescrever).
</specifics>

<deferred>
## Deferred Ideas

- **pg_cron + pgmq nativo** — implementar a interface `MessageQueue` sobre pgmq/pg_cron ao migrar para Supabase Pro (mesmo gatilho do Custom Access Token Hook). Outcome idêntico, infra nativa.
- **Captura/ação na resposta dos botões WhatsApp** (Confirmar/Cancelar) — Fase 5 / AI-02 (agente de confirmação).
- **Agendamento mais fino que diário** (ex.: enviar exatamente Xh antes, múltiplas janelas) — exige Vercel Pro (mais de 1 cron/dia). Hoje: batch diário matinal.
- **Templates além de lembrete+cobrança** (ex.: confirmação de pagamento) — criar quando necessário (re-aprovação Meta).

### Reviewed Todos (not folded)
Nenhum todo pendente casou com a Fase 4.
</deferred>

---

*Phase: 04-communications-async*
*Context gathered: 2026-06-06*
