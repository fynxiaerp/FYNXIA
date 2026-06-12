---
status: partial
phase: 05-ai-agents
source: [05-VERIFICATION.md]
started: "2026-06-11T22:00:00Z"
updated: "2026-06-11T22:00:00Z"
---

## Current Test

[awaiting human testing — requires AI_GATEWAY_API_KEY + Meta verification + live data]

## Tests

### 1. Copiloto responde live (tenant-scoped, sem PII ao provider) (AI-01)
expected: com `AI_GATEWAY_API_KEY` setado, abrir a sidebar em qualquer tela e perguntar "Quais consultas tenho hoje?" → resposta correta escopada ao tenant; e "Como cadastro um paciente?" → ajuda how-to (D-03). Confirmar (via logs do Gateway) que CPF/dados de saúde NÃO vão na request ao provider; ZDR ativo.
result: [pending]
setup: provisionar `AI_GATEWAY_API_KEY` no Vercel (conta com AI Gateway / Vercel Pro).

### 2. Agente de confirmação: envio + resposta inbound (AI-02)
expected: o cron `confirmation-agent` (`0 12 * * *`) envia o template de confirmação (botões Confirmar/Cancelar) para consultas do dia seguinte; o paciente toca um botão → webhook inbound atualiza `appointments.status` (confirmado/cancelado); resposta em texto livre é interpretada pelo LLM com fallback seguro.
result: [pending]
setup: verificação Meta Business + template aprovado + `WHATSAPP_*` (incl. `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`) + `CRON_SECRET` no Vercel; registrar o webhook inbound na Meta.

### 3. Agente de cobrança: WhatsApp personalizado + link Asaas real (AI-03)
expected: o cron `collection-agent` identifica inadimplentes, o LLM personaliza a mensagem, e envia via WhatsApp com o **link de pagamento Asaas real** (`gateway.getInvoiceUrl`); pula o recebível se não houver link; registra em `agent_outreach_log`.
result: [pending]
setup: Meta (item 2) + conta/sandbox Asaas com cobrança live (provider_charge_id).

### 4. Smoke test de isolamento cross-tenant no inbound de texto livre (CR-01/CR-02)
expected: com a coluna `to_phone` já aplicada (live), validar com dados de dois tenants que uma resposta em texto livre do Paciente A NUNCA confirma/cancela a consulta do Paciente B (resolução vinculada ao telefone do remetente + janela 48h + escopo por tenant). Replay do mesmo evento não duplica (dedup por wamid).
result: [pending]
setup: depende do item 2 (Meta) + dois pacientes/clínicas de teste.

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

- Todos os 4 itens dependem de runtime/live: `AI_GATEWAY_API_KEY` (item 1) e verificação Meta Business (itens 2-4). Código unit-testado (368/368 GREEN, next build limpo). Migration `to_phone` já aplicada no banco live.
- AI-01/02/03 ficam "Complete" na traceability em nível de código; a confirmação live é estes 4 itens de UAT.
