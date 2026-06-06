# Phase 3: Financial MVP - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

A clínica emite cobranças (Pix, boleto e cartão via Asaas), rastreia recebíveis e parcelas com status em tempo real, vê o fluxo de caixa do mês (entradas × saídas), dispara régua de cobrança e emite recibo em PDF. O webhook do Asaas é idempotente e responde 200 imediatamente. Cobre FIN-01..09 e SEC-06.

**Fora do escopo (outras fases):** integração real de gateways além do Asaas; envio de cobrança por WhatsApp; assinatura SaaS da clínica (Stripe); NFSe fiscal.
</domain>

<decisions>
## Implementation Decisions

### Estratégia de gateway de pagamento
- **D-01:** MVP usa **Asaas exclusivamente** (PIX, boleto, cartão via tokenização) para pagamento de pacientes, **atrás de uma abstração `PaymentGateway`** (interface + adapter Asaas). O modelo de dados de cobrança é agnóstico de provider: campos como `provider` (default `'asaas'`) e `provider_charge_id`. Adicionar PagSeguro/Mercado Pago/Infinite Pay/Stripe no futuro = escrever um novo adapter, sem reescrever Server Actions nem schema. Multi-gateway de verdade está **deferido** (ver Deferred Ideas).

### Integração Asaas
- **D-02:** **Conta Asaas ainda não existe.** Planejar a integração completa contra a API REST documentada, com base URL e API key em env vars (`ASAAS_API_KEY`, `ASAAS_BASE_URL`). O **teste real é um checkpoint bloqueante** até o usuário criar a conta (sandbox é gratuito e recomendado). Ver `user_setup`.
- **D-06:** Vínculo paciente ↔ Asaas: criar/obter o `customer` no Asaas no primeiro faturamento e armazenar `asaas_customer_id` (no paciente ou tabela de cobranças). *(Claude's discretion no detalhe de onde guardar.)*
- **D-07:** **Webhook idempotente (FIN-09):** endpoint retorna **HTTP 200 imediatamente** e processa o evento de forma assíncrona; valida o **token de acesso configurável do Asaas** (header `asaas-access-token`) antes de processar; deduplica por `event id` / `provider_charge_id` + status para nunca creditar em duplicidade. Usa o `createAdminClient()` (sem sessão).

### Recebíveis & parcelamento (FIN-03, FIN-06)
- **D-03:** **Parcelamento nativo do Asaas** (`installmentCount`/`totalValue`): o Asaas gera cada parcela com seu próprio PIX/boleto e vencimento. Cada parcela é **espelhada como uma linha de recebível local** (com `provider_charge_id`), e o status sincroniza via webhook. Menos lógica financeira própria; conciliação automática.
- **D-04:** Status **"vencido" é derivado na leitura** (`due_date < hoje E status != 'pago'`) — a visão de contas a receber **não depende de job agendado**. Estados: `pendente` / `pago` / `vencido` (derivado).

### Fluxo de caixa (FIN-01, FIN-02)
- **D-05:** **Categorias = lista padrão odontológica editável** (tabela de categorias por tenant, com seed na criação da clínica; admin adiciona/edita). Receita: consulta, tratamento, convênio… Despesa: aluguel, materiais, salários, laboratório, impostos…
- **D-08:** **Regime de caixa** (entrada/saída quando o dinheiro de fato move). Pagamento confirmado no Asaas **lança automaticamente uma receita** no fluxo de caixa. Lançamento manual (FIN-02) cobre despesas e outras receitas. Visão do mês = **totais (entradas, saídas, saldo) + lista de lançamentos**. *(Gráfico é Claude's discretion / opcional.)*

### Régua de cobrança (FIN-07)
- **D-09:** **Agendamento via Vercel Cron** (endpoint diário declarado no `vercel.json`/`vercel.ts`) — única opção compatível com o plano FREE (sem pg_cron/pgmq). O cron varre os recebíveis vencidos diariamente e roda a régua.
- **D-10:** **Escopo de envio na Fase 3 = motor + e-mail (Resend) agora; WhatsApp na Fase 4.** Entrega: config da régua (lembrar no vencimento e a cada N dias de atraso), o cron diário que identifica os alvos, e o **envio real por e-mail via Resend** (já funciona desde a Fase 1). O canal WhatsApp pluga na Fase 4. O disparo deve ser idempotente por (recebível + marco de cobrança) para não reenviar o mesmo lembrete.

### SEC-06 — Headers de segurança
- **D-11:** Configurar CSP, HSTS, X-Frame-Options, X-Content-Type-Options em todas as respostas (via `next.config` headers e/ou middleware). *(Claude's discretion na abordagem.)*

### Claude's Discretion
- Recibo em PDF (FIN-08): reusar o padrão `@react-pdf/renderer` da Fase 2 (`src/components/pdf/ProntuarioPDF.tsx` — Flexbox, runtime nodejs, fonte Latin Extended, isolamento de tenant).
- Detalhe de onde guardar `asaas_customer_id`; gráfico no fluxo de caixa; layout exato das telas (UI-SPEC define depois).
- Estrutura exata do processamento assíncrono do webhook no plano FREE (ex.: processar inline após responder, ou tabela de eventos + reconciliação no próprio request).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pagamentos (Asaas)
- `CLAUDE.md` (seção *Payment Integration → Asaas*) — decisão de REST direto sem SDK, PIX/boleto/cartão, webhooks com idempotência; anti-patterns (sem SDK comunitário, sem cartão cru, idempotência obrigatória).
- https://docs.asaas.com/ — API REST do Asaas (customers, payments, installments, pix, boleto).
- https://docs.asaas.com/docs/about-webhooks — modelo de webhooks do Asaas (eventos, autenticação por token, entrega).

### Padrões internos a reusar
- `src/actions/appointments.ts` — padrão `getActor()` (auth + tenant + role) e captura de erro Postgres a reusar nas Server Actions financeiras.
- `src/actions/public-booking.ts` / `src/actions/anamneses.ts` — padrão de `createAdminClient()` para fluxos sem sessão (modelo para o webhook handler).
- `src/components/pdf/ProntuarioPDF.tsx` + `src/app/api/patients/[id]/prontuario.pdf/route.ts` — padrão de PDF (FIN-08).
- `src/lib/audit.ts` (`logBusinessEvent`) — auditoria de eventos de negócio (pagamentos).
- `.env.local.example` — onde documentar `ASAAS_API_KEY`, `ASAAS_BASE_URL` e (já presente) `RESEND_API_KEY`.

### Régua / e-mail
- Padrão de envio Resend usado nos convites da Fase 1 (procurar em `src/` os helpers de e-mail/react-email) — reusar para os lembretes de cobrança.

[Sem ADRs/specs internos dedicados — requisitos capturados nas decisões acima + docs externas do Asaas.]
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Server Action pattern (`getActor`, role gate, tenant scope) de `src/actions/*.ts`.
- `createAdminClient()` / `createClient()` (três clientes Supabase) — webhook usa admin (sem sessão); ações autenticadas usam RLS-aware.
- `@react-pdf/renderer` já instalado e com padrão pronto (recibo FIN-08).
- Resend já integrado (convites Fase 1) — base para os lembretes por e-mail.
- `logBusinessEvent` para auditoria.

### Established Patterns
- RLS multi-tenant: toda tabela financeira nova precisa de `tenant_id` indexado, policies com `USING` + `WITH CHECK` via `get_my_tenant_id()`/`get_my_role()`.
- Auditoria SEC-03 já cita `financial_transactions` — anexar trigger `audit_table_changes()` à tabela de transações.
- Migrations via `supabase/migrations/` + `db push` (checkpoint bloqueante — conta certa do Supabase, ver memória do projeto).

### Integration Points
- Hub de navegação `/clinica` (home) — adicionar card "Financeiro".
- Pacientes (Fase 2) — cobranças e recebíveis vinculam a `patients(id)`.
- `vercel.json` (hoje só `regions: gru1`) — adicionar `crons` para a régua (D-09).
</code_context>

<specifics>
## Specific Ideas

- O usuário levantou explicitamente o interesse em **múltiplos gateways** (Stripe, PagSeguro, Infinite Pay, Mercado Pago). A resposta no MVP é a **abstração `PaymentGateway`** (D-01) que mantém a porta aberta sem custo de implementá-los agora.
</specifics>

<deferred>
## Deferred Ideas

- **Multi-gateway real** (PagSeguro, Infinite Pay, Mercado Pago, Stripe para pacientes) — implementar como novos adapters da interface `PaymentGateway` numa fase futura, quando houver demanda comercial.
- **Stripe para assinatura SaaS da clínica** (cobrança do plano FYNXIA) — secundário, separado do faturamento de pacientes; fora desta fase.
- **WhatsApp como canal da régua de cobrança** — Fase 4 (verificação Meta + templates).
- **Regras de juros/multa/desconto por atraso** customizáveis — não escolhido (parcelamento delegado ao Asaas); revisitar se necessário.
- **NFSe fiscal** — v2 (já deferido no PROJECT).

### Reviewed Todos (not folded)
Nenhum todo pendente casou com a Fase 3.
</deferred>

---

*Phase: 03-financial-mvp*
*Context gathered: 2026-06-06*
