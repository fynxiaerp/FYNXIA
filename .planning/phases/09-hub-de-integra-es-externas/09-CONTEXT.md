# Phase 9: Hub de Integrações Externas - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Construir o **hub central de integrações**: registro de **conectores** (WhatsApp, NFS-e, banco, TISS, e-mail) com **credenciais seguras**, **recebimento de webhooks** roteados por conector, e um **painel de saúde** com **reenvio automático** em falha. Cobre INT-01..03.

Consolida o que já existe no v1 (Asaas, WhatsApp, Resend) sob uma **superfície de gestão única** — sem reescrever os handlers que funcionam. As **implementações específicas de protocolo** de conectores novos (NFS-e, banco/Open Finance, TISS) são construídas nas fases que os consomem (15/16); aqui entregamos o **registro + cofre de credenciais + log de eventos + monitor + retry**.

**Fora do escopo:** lógica de negócio de NFS-e/TISS/banco em si (fases futuras); marketplace de integrações de terceiros (deferido).
</domain>

<decisions>
## Implementation Decisions

### Credenciais (D-01)
- Tabela **`integration_connectors`** (clinic_id, type/connector, config jsonb não-sensível, **credencial cifrada AES-256** via `src/lib/crypto.ts` — mesmo padrão da senha do .pfx e dos dados de saúde, ENCRYPTION_KEY, server-only, status enabled/disabled).
- **Descriptografa só server-side** (Server Action / handler); a UI **nunca mostra o segredo** (mascarado, ex.: `••••••1234`). Sem KMS/Vault externo, sem nova dependência.
- RLS por `clinic_id` (USING+WITH CHECK); leitura do segredo só via service role server-side.

### Webhooks (D-02)
- O hub é um **registry**: `integration_connectors` + **reusar a tabela `webhook_events`** (dedup do v1, service-role) e os **handlers existentes** `/api/webhooks/{asaas,whatsapp}` — eles passam a **registrar eventos no hub** (vincular ao conector + log), sem reescrever.
- Conectores novos (NFS-e/banco/TISS) seguem o **mesmo padrão** nas fases futuras (handler + registro no hub).

### Saúde & Reenvio (D-03)
- **Generalizar o outbox** do v1 (`message_outbox` + worker em `src/lib/messaging/`): um **log de eventos de integração** (`integration_events`: connector_id, direction, status pending/sent/failed, attempts, last_error, payload ref) + **reenvio automático via o Vercel Cron já existente** (worker idempotente).
- **Saúde do conector** = derivada dos eventos recentes (ok / degradado / falha) + fila de reenvio. Painel mostra status + último erro + botão de reprocessar.

### Claude's Discretion
- Estrutura/colunas/índices exatos das migrations (sempre indexar clinic_id); nomes; se `integration_events` é tabela nova ou extensão de `webhook_events`/`message_outbox`.
- Enum de tipos de conector inicial (whatsapp, email, asaas; placeholders nfse/banco/tiss disabled).
- Como os handlers Asaas/WhatsApp existentes passam a logar no hub sem regressão (camada fina, opcional/aditiva).
- UI do painel (lista de conectores + status + form de credencial mascarado + reprocessar) no design system v1; rota sob `Configurações › Integrações` (módulo `integracoes`/config; admin/ti write; auditor/dpo read-only).
- Mascaramento da credencial na UI; validação por tipo de conector (Zod v3).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & roadmap
- `.planning/MODULES-SPEC-v2.md` — Módulo 27 (Integrações Externas: Conector/Credencial/Webhook/Status; reenvio automático; monitor de saúde).
- `.planning/ROADMAP.md` §"Phase 9" — goal, success criteria, v1 reuse.
- `.planning/REQUIREMENTS.md` — INT-01, INT-02, INT-03.

### Código v1/Fase 7-8 a reutilizar
- `src/app/api/webhooks/asaas/route.ts` + `src/app/api/webhooks/whatsapp/route.ts` — handlers existentes (idempotent webhook pattern) + tabela `webhook_events` (dedup, service-role).
- `src/lib/messaging/` (queue.ts, worker.ts, types.ts, reminder-scan.ts) + `message_outbox` — padrão outbox/retry/Cron a generalizar.
- `src/lib/crypto.ts` — AES-256-GCM para a credencial.
- `src/lib/supabase/server.ts` (createAdminClient) — acesso service-role.
- `src/proxy.ts` (MODULE_PERMISSIONS) — adicionar módulo `integracoes` (admin/superadmin/ti write; auditor/dpo/socio readOnly) + `src/lib/auth/guards.ts` (assertNotReadOnly).
- Padrão de rota/UI de config das Fases 7-8 (`/config/*`, PageHeader, tokens, @base-ui render-prop, RHF+Zod v3, pt-BR).
- `CLAUDE.md` — RLS USING+WITH CHECK; 'use server' async-only; service role server-only; nodejs runtime para handlers; deploy push em master E master:main.

[Sem ADRs dedicados.]
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **webhook_events** (dedup, service-role) + handlers Asaas/WhatsApp — base do recebimento.
- **message_outbox + worker (Vercel Cron)** — padrão de fila/retry a generalizar para integration_events.
- **crypto.ts AES-256** — cofre de credenciais.
- **Cert keystore (Fase 7)** — referência de "segredo cifrado + metadados legíveis + REVOKE de coluna".
- **Config UI + RBAC (Fases 7-8)** — PageHeader, tokens, módulo no proxy, assertNotReadOnly.

### Established Patterns
- RLS USING+WITH CHECK; index clinic_id; migrations + [BLOCKING] db push (gotcha de re-auth Supabase: org kczvihafddupruvsrrsc / projeto jqjwyqlbbuqnrffdnlpp).
- 'use server' async-only; createAdminClient server-only; nodejs runtime nas rotas de webhook.
- REVOKE SELECT de colunas-segredo (padrão Fase 7/8); UI nunca recebe o segredo.
- Deploy: push em `master` E `master:main`.

### Integration Points
- Novas tabelas: `integration_connectors`, `integration_events` (ou extensão); módulo `integracoes` no proxy.
- Handlers existentes ganham um log fino no hub (aditivo, sem regressão).
- Rota `/config/integracoes` (registry + painel de saúde).
</code_context>

<specifics>
## Specific Ideas

- Hub gerencia credenciais **por clínica/tenant** via UI (objetivo: tirar do env var fixo) — multi-tenant real.
- Reaproveitar o máximo do v1 (webhook_events, outbox, crypto) — fase de **consolidação + monitor**, não de reescrita.
- Conectores novos (NFS-e/banco/TISS) ficam como tipos **registráveis** agora; protocolo real nas fases 15/16.
</specifics>

<deferred>
## Deferred Ideas

- Implementação de protocolo NFS-e / Open Finance / TISS — Fases 15/16 (consomem o hub).
- Marketplace de integrações de terceiros.
- KMS/Vault externo (AES no DB cobre o estágio atual).

### Reviewed Todos (not folded)
Nenhum todo pendente casou com a Fase 9.
</deferred>

---

*Phase: 09-hub-de-integra-es-externas*
*Context gathered: 2026-06-14*
