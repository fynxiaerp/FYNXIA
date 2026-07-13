// src/lib/agents/campaign-agent.ts
// CRC-03 (D-09): L2 governed campaign message personalization.
//
// DESIGN:
//   - Personalizes ONLY the message TEXT — first name + clinic name (D-09
//     minimal data), mirrors buildCollectionMessage's first-name+amount pattern
//     in src/lib/agents/collection-agent.ts.
//   - ZDR (zeroDataRetention) enabled — LGPD, no data retained by the provider.
//   - Static fallback when AI_GATEWAY_API_KEY is absent — campaign creation
//     must remain functional without the LLM dependency.
//   - L2 governance gate (withAgentPolicy, L0-L4) is applied at DISPATCH time,
//     inside approveCampaignAndDispatch's per-recipient enqueue loop
//     (src/actions/campaigns.ts) — mirrors collection-agent.ts's per-tenant
//     withAgentPolicy wrap around the outbox enqueue call. This file is a pure
//     text-generation helper with no DB/outbox access, so it does not call
//     withAgentPolicy directly; the caller (campaigns.ts) is the governance
//     boundary for the actual send.
import 'server-only'

import { generateText } from 'ai'
import type { GatewayProviderOptions } from '@ai-sdk/gateway'

/**
 * Generates an empathetic 1-2 sentence pt-BR reactivation message personalized
 * for the patient's first name and the clinic's name.
 *
 * Privacy (D-09 minimal data / ZDR):
 *   Only first name + clinic name are sent to the LLM. No CPF, phone, health
 *   data, or full name — mirrors buildCollectionMessage's data-minimization.
 *
 * If AI_GATEWAY_API_KEY is absent (dev/test/UAT): returns a neutral static
 * fallback so campaign creation remains functional without the LLM dependency.
 *
 * The system prompt explicitly forbids any URL/link (WhatsApp send always goes
 * through the approved TEMPLATE_REACTIVATION — D-11 — never free text/links).
 */
export async function buildCampaignMessage(
  firstName: string,
  clinicName: string
): Promise<string> {
  // Read at call-time (never module scope) — mirrors buildCollectionMessage.
  const apiKey = process.env.AI_GATEWAY_API_KEY

  if (!apiKey) {
    // Neutral fallback — functional message without LLM dependency
    return `Olá, ${firstName}! Sentimos sua falta na ${clinicName}. Que tal agendar uma revisão?`
  }

  try {
    const { text } = await generateText({
      model: 'anthropic/claude-sonnet-4.6',
      system: `Você é um assistente de marketing de uma clínica odontológica.
Escreva 1-2 frases em português do Brasil, tom empático e convidativo, para
reengajar um paciente inativo há algum tempo.
REGRAS OBRIGATÓRIAS:
- Não inclua URL, link ou qualquer endereço web.
- Use apenas o primeiro nome e o nome da clínica fornecidos.
- Não inclua CPF, dados de saúde ou qualquer informação médica.
- Não invente informações adicionais.
- Máximo 2 frases.`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Primeiro nome: ${firstName}. Clínica: ${clinicName}.`,
            },
          ],
        },
      ],
      providerOptions: {
        gateway: {
          zeroDataRetention: true, // D-09/LGPD — no data retained by provider
        } satisfies GatewayProviderOptions,
      },
    })
    return text.trim()
  } catch (err) {
    // LLM failure must not block campaign creation — fall back to static message
    console.error('[campaign-agent] LLM personalization failed, using fallback:', err)
    return `Olá, ${firstName}! Sentimos sua falta na ${clinicName}. Que tal agendar uma revisão?`
  }
}
