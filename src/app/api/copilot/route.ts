// src/app/api/copilot/route.ts
// FYNXIA Copilot — streaming chat Route Handler (AI-01)
// Runtime: nodejs (required for Supabase TCP connections + AI SDK streaming)
import 'server-only'
export const runtime = 'nodejs'

import { streamText, convertToModelMessages, stepCountIs } from 'ai'
import type { UIMessage } from 'ai'
import type { GatewayProviderOptions } from '@ai-sdk/gateway'
import { createClient } from '@/lib/supabase/server'
import {
  getTodayAppointments,
  getOverdueReceivables,
  getPatientSummary,
  searchHelpDocsTool,
} from '@/lib/ai/tools'

// ─── System prompt (pt-BR) ──────────────────────────────────────────────────
// D-05: READ-ONLY — copilot answers questions and guides users; it does NOT execute write actions.
// D-01: PRIVACY — never repeat full CPF or health data in responses (input-side guardrail, Pitfall 10).
const SYSTEM_PROMPT = `Você é o Copiloto FYNXIA, assistente de IA para clínicas odontológicas.

Você responde perguntas sobre os dados da clínica usando as ferramentas disponíveis, e também
ajuda com dúvidas sobre como usar o sistema FYNXIA (cadastrar pacientes, agendar consultas, gerar
cobranças, interpretar relatórios, etc.).

IMPORTANTE — SOMENTE LEITURA: Você consulta e informa, mas NÃO executa ações de escrita (cancelar
consulta, criar cobrança, alterar dados). Para realizar ações, oriente o usuário a usar a interface
do sistema diretamente.

PRIVACIDADE (LGPD): Nunca repita CPF completo, dados de saúde, prontuário, histórico médico ou
anamnese em suas respostas. Se o usuário mencionar esses dados na mensagem, responda com uma nota
de privacidade e não os reproduza.`

// ─── POST /api/copilot ───────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // V2 — auth gate: verify user session via Supabase before any tool runs (T-5-auth)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // D-02 / Pitfall 2 — read AI_GATEWAY_API_KEY at call-time (never module scope; protects next build)
  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'AI gateway not configured' }, { status: 503 })
  }

  const { messages }: { messages: UIMessage[] } = await request.json()

  const result = streamText({
    model: 'anthropic/claude-sonnet-4.6', // D-01: locked model via Vercel AI Gateway
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      getTodayAppointments,
      getOverdueReceivables,
      getPatientSummary,
      searchHelpDocs: searchHelpDocsTool,
    },
    providerOptions: {
      gateway: {
        zeroDataRetention: true, // D-02: LGPD — Gateway retains no prompt/response data
      } satisfies GatewayProviderOptions,
    },
    stopWhen: stepCountIs(5), // agentic loop limit
  })

  return result.toUIMessageStreamResponse() // AI SDK v6 preferred method for useChat
}
