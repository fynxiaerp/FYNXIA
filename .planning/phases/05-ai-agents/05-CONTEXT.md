# Phase 5: AI Agents - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Um copiloto IA contextual em toda tela do dashboard (Vercel AI Gateway, tenant-scoped, sem expor PII ao provider) que responde perguntas sobre os dados da clínica E ajuda no uso do sistema; um agente autônomo de confirmação de consultas (WhatsApp + captura da resposta) e um agente autônomo de cobrança (WhatsApp personalizado + link Asaas, auditado). Cobre AI-01/02/03 — última fase do milestone v1.

**Fora do escopo (v2):** copiloto executando ações de escrita (remarcar/cobrar via chat); voice-to-text; analytics avançado por IA.
</domain>

<decisions>
## Implementation Decisions

### Copiloto: acesso a dados + LGPD (AI-01)
- **D-01:** **Tool-calling + mascaramento de PII.** O LLM chama ferramentas read-only **tenant-scoped** (Server-side, executadas sob RLS via a sessão do usuário). As ferramentas retornam só o necessário com **PII sensível mascarada/excluída**: CPF mascarado, dados de saúde/prontuário/anamnese **NUNCA** enviados ao provider; nome + metadados de consulta (horário, dentista, status) liberados para a resposta ser útil. Stack: **AI SDK v6 + Vercel AI Gateway**, modelo **`anthropic/claude-sonnet-4.6`** (string provider/model no gateway), streaming via Route Handler (runtime nodejs).
- **D-05:** **Copiloto read-only no v1** — responde e orienta, mas NÃO executa ações de escrita (não cancela consulta, não cria cobrança). Ações continuam pelos fluxos normais da UI. Write-via-copilot é v2 (Deferred).

### Copiloto como assistente de ajuda (extensão do AI-01)
- **D-03:** O copiloto **também atua como HELP/assistente de uso** do sistema — o mesmo chat lateral responde perguntas de dados ("quais consultas tenho hoje?") E de how-to ("como cadastro um paciente?"). Implementação: uma **fonte de conteúdo de ajuda/FAQ curada** (ex.: doc estruturado por módulo) disponível ao copiloto além das tools de dados — via system prompt e/ou uma tool de busca em help-docs. Não é fase nova; é ampliar o papel do copiloto.

### Provider de IA: DPA/LGPD (Q6 — CLOSED)
- **D-02:** **Q6 fechada.** Estratégia LGPD = **Vercel AI Gateway com zero data retention** + o mascaramento de PII do D-01 (dado cru identificável de paciente nunca sai). **Sem DPA formal separado** com o provider, pois não há transferência de dado identificável sensível. Setup: usuário provisiona `AI_GATEWAY_API_KEY` no Vercel (não bloqueia o código; integração buildável/unit-testável com o modelo mockado).

### Agentes autônomos AI-02 / AI-03
- **D-04:** **Ambos LLM-driven** (mesmo modelo do copiloto via AI Gateway).
  - **AI-02 (confirmação):** envia o template de confirmação (reusa outbox/cron + template quick-reply da Fase 4) para consultas do dia seguinte; um **webhook INBOUND do WhatsApp (novo)** captura a resposta — botões Confirmar/Cancelar (payload estruturado) como caminho primário, e o **LLM interpreta respostas em texto livre** como fallback → atualiza `appointments.status` (confirmado/cancelado). Fallback seguro: se a intenção for ambígua, NÃO altera status (registra para revisão humana). Tudo auditado.
  - **AI-03 (cobrança):** identifica inadimplentes (recebíveis vencidos), o **LLM personaliza** a mensagem de cobrança (tom/contexto), envia via WhatsApp (outbox) com o **link de pagamento Asaas REAL** (`gateway.getInvoiceUrl` — nunca fabricado pelo LLM), e registra a ação no audit trail (quem foi contatado e quando).
- Ambos os agentes têm **envio live deferido** (dependem da verificação Meta, igual Fase 4) — código unit-testado (modelo + WhatsApp mockados); verificação live = UAT.

### Claude's Discretion
- UX do copiloto: sidebar slide-over acionável em toda tela do dashboard, streaming via AI SDK `useChat`, prompts sugeridos por contexto (agenda/financeiro/ajuda), estados loading/erro.
- Estrutura da fonte de help/FAQ (D-03); formato das tools de dados read-only e do mascaramento; system prompt do copiloto.
- Guardrails de prompt-injection no copiloto (entrada do usuário não escala privilégio — as tools são RLS-scoped de qualquer forma).
- Formato do log de auditoria dos agentes; schema de qualquer tabela nova (ex.: agent_outreach_log) se necessária.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### IA
- `CLAUDE.md` (seções *AI / Vercel AI Gateway* e knowledge-update) — Vercel AI Gateway GA, strings `provider/model`, zero data retention, fallbacks; default para modelos Claude recentes; AI SDK v6.
- Vercel AI Gateway docs — configuração, `AI_GATEWAY_API_KEY`, roteamento de modelo, observabilidade.
- Vercel AI SDK v6 docs — `streamText`/`generateText`, tool-calling, `useChat` (streaming UI), Route Handler.

### Infra a reusar
- Fase 4 WhatsApp + outbox/cron: `src/lib/whatsapp/{client,templates}.ts`, `src/lib/messaging/{queue,worker}.ts`, `src/app/api/cron/*` — os agentes AI-02/03 reusam o envio; o webhook inbound do AI-02 é novo (`src/app/api/webhooks/whatsapp/route.ts`).
- Fase 3: `gateway.getInvoiceUrl` (Asaas invoiceUrl real) para o AI-03; régua/recebíveis para identificar inadimplentes.
- Fase 2: appointments (AI-02 status), patients (dados read-only mascarados).
- RLS multi-tenant: as tools do copiloto rodam sob a sessão do usuário (RLS), nunca service-role com dado cru ao LLM.
- `logBusinessEvent` (src/lib/audit.ts) — auditoria dos agentes.
- Padrão de mascaramento (Fase 1/2: CPF mascarado em listagens) — reusar para as tools.

[Sem ADRs internos dedicados — requisitos nas decisões acima + docs Vercel AI Gateway/SDK.]
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- WhatsApp client + outbox/worker + cron (Fase 4) — AI-02/03 enfileiram via o mesmo outbox.
- `gateway.getInvoiceUrl` (Fase 3) — link Asaas real para o AI-03.
- Padrão de mascaramento de PII (CPF) das listagens (Fase 1/2) — base para as tools read-only do copiloto.
- `logBusinessEvent` — auditoria.
- `createClient()` (RLS-aware, sessão do usuário) para as tools do copiloto; `createAdminClient()` só onde já estabelecido (webhook/cron, sem mandar PII ao LLM).

### Established Patterns
- Server Actions/Route Handlers nodejs; `import 'server-only'`; leitura de credenciais em call-time (ex.: AI_GATEWAY_API_KEY, igual WHATSAPP_*/getResend).
- Webhook protegido + idempotente (Fase 3 Asaas / Fase 4) — modelo para o webhook inbound do WhatsApp (verificação de assinatura Meta + dedup).
- Migrations via supabase/migrations + db push (checkpoint bloqueante — conta FYNXIA; ver memória).

### Integration Points
- Hub/layout do dashboard (`src/app/(dashboard)/clinica/`) — montar a sidebar do copiloto em todas as telas.
- Webhook inbound WhatsApp novo → atualiza appointments.status (AI-02).
- vercel.json — o AI-03 pode rodar no cron de cobrança existente (régua) ou num cron próprio.
</code_context>

<specifics>
## Specific Ideas

- O usuário quer explicitamente que a IA também seja uma **área de HELP** que facilite o uso do sistema (D-03) — o copiloto é data + how-to, não só consulta de dados.
- Reusar a filosofia de abstração/segurança das fases anteriores: tools RLS-scoped, PII mascarada, link Asaas real (nunca fabricado pelo LLM), auditoria.
</specifics>

<deferred>
## Deferred Ideas

- **Copiloto executando ações de escrita** (remarcar consulta, gerar cobrança via chat, com confirmação) — v2 (D-05 mantém read-only no v1).
- **Interpretação de texto livre como único canal** — AI-02 prioriza botões; texto livre é fallback.
- **Voice-to-text / analytics avançado por IA** — v2 (já deferido no PROJECT).
- Envio live de WhatsApp dos agentes — depende da verificação Meta (mesmo UAT da Fase 4).

### Reviewed Todos (not folded)
Nenhum todo pendente casou com a Fase 5.
</deferred>

---

*Phase: 05-ai-agents*
*Context gathered: 2026-06-08*
