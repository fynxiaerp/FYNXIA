# Phase 5: AI Agents - Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 05-ai-agents
**Areas discussed:** Copiloto (modelo/tool-calling/LGPD), Provider DPA/Q6, Agentes AI-02/03, UX do copiloto

---

## Copiloto: acesso a dados + LGPD (AI-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Tool-calling + mascaramento de PII | Tools read-only tenant-scoped (RLS); CPF mascarado, saúde nunca enviada; nome+horário liberados | ✓ |
| Só agregados / sem identificadores | Apenas contagens; nenhum identificador ao LLM | |
| Dados crus tenant-scoped (zero-retention) | Envia dado cru confiando no gateway; risco LGPD | |

**User's choice:** Tool-calling + mascaramento de PII (recomendado)
**Notes:** Modelo anthropic/claude-sonnet-4.6 via Vercel AI Gateway + AI SDK v6, streaming Route Handler (decidido por Claude conforme CLAUDE.md/knowledge-update).

---

## Provider de IA: DPA/LGPD (Q6) + setup

| Option | Description | Selected |
|--------|-------------|----------|
| AI Gateway zero-retention + PII mascarada | Fecha Q6; sem DPA formal separado; usuário provisiona AI_GATEWAY_API_KEY | ✓ |
| Exigir DPA formal com provider | Passo legal antes de produção | |
| Adiar IA até decisão legal | Bloqueia a fase | |

**User's choice:** AI Gateway zero-retention + PII mascarada (recomendado) — Q6 CLOSED.

---

## Agentes AI-02 / AI-03

Primeira resposta (via "Other"): "A IA também será utilizada como uma área de HELP dentro do sistema para facilitar a utilização" → capturado como D-03 (copiloto = data + how-to/ajuda), NÃO como resposta dos agentes. Pergunta re-posta:

| Option | Description | Selected |
|--------|-------------|----------|
| Híbrido: AI-02 por regra, AI-03 com LLM | AI-02 estruturado (botão→status); AI-03 personalizado por LLM | |
| Ambos com LLM | LLM nos dois, inclusive interpretar texto livre na confirmação | ✓ |
| Ambos por regra (templated) | Sem personalização por LLM | |

**User's choice:** Ambos com LLM
**Notes:** AI-02 webhook inbound (botões primário + LLM para texto livre, fallback seguro se ambíguo); AI-03 mensagem personalizada com link Asaas real (getInvoiceUrl, nunca fabricado) + auditoria. Live deferido (Meta).

---

## UX do copiloto (capacidade)

| Option | Description | Selected |
|--------|-------------|----------|
| Só leitura: responde + orienta | Tools read-only, sem ações de escrita; ações via UI normal | ✓ |
| Também executa ações (write tools) | Copiloto remarca/cobra com confirmação | |

**User's choice:** Só leitura (recomendado v1) — write-via-copilot = v2.
**Notes:** Sidebar slide-over em toda tela, streaming useChat, prompts sugeridos por contexto (Claude's discretion).

## Deferred Ideas
- Copiloto write-actions (v2); voice-to-text/analytics IA (v2); envio live WhatsApp dos agentes (depende Meta).
