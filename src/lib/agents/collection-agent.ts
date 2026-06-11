// src/lib/agents/collection-agent.ts
// AI-03 autonomous collection agent: identify overdue receivables, LLM-personalize
// the message text, attach the REAL Asaas payment link, enqueue via outbox, and audit.
//
// DESIGN:
//   - LLM personalizes only the message TEXT (first name + amount only — RESEARCH Pattern 6).
//   - The payment link is ALWAYS from gateway.getInvoiceUrl — never LLM-generated (D-04).
//   - If getInvoiceUrl returns null → skip (abort send, increment skipped counter).
//   - Enqueues via the Phase 4 outbox (getOutboxQueue) — idempotent per receivable per day.
//   - Writes agent_outreach_log + logBusinessEvent after successful enqueue.
//   - Uses createAdminClient (service-role cron) — explicit LGPD predicates required.
//   - Live send is UAT-deferred (Meta verification pending).
//
// HARD INVARIANT (enforced by collection-agent.test.ts):
//   This file MUST reference getInvoiceUrl; must never contain a hardcoded domain
//   URL pattern or template-literal URL construction. The paymentLink param passed
//   to buildCollectionComponents is ALWAYS the resolved gateway.getInvoiceUrl value.
import 'server-only'

import { generateText } from 'ai'
import type { GatewayProviderOptions } from '@ai-sdk/gateway'
import { createAdminClient } from '@/lib/supabase/admin'
import { gateway } from '@/lib/asaas/gateway'
import { getOutboxQueue } from '@/lib/messaging/queue'
import { logBusinessEvent } from '@/lib/audit'
import { toE164 } from '@/lib/phone'
import { formatBRL } from '@/lib/format/money'
import {
  TEMPLATE_COLLECTION,
  WHATSAPP_LANGUAGE,
  buildCollectionComponents,
} from '@/lib/whatsapp/templates'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── LLM message personalization ─────────────────────────────────────────────

/**
 * Generates an empathetic 1-2 sentence pt-BR collection message personalized
 * for the patient's first name and overdue amount.
 *
 * Privacy (RESEARCH Pattern 6 + T-5-collect-I):
 *   Only first name + formatted amount are sent to the LLM.
 *   No CPF, phone, health data, or full name.
 *
 * If AI_GATEWAY_API_KEY is absent (dev/test/UAT): returns a neutral static fallback
 * so the agent remains functional without the LLM dependency.
 *
 * The system prompt explicitly instructs the model NOT to include any URL or
 * payment link — the link is always injected server-side from getInvoiceUrl.
 */
export async function buildCollectionMessage(
  firstName: string,
  amount: number,
): Promise<string> {
  // D-02 / Pitfall 2 — read at call-time (never module scope; protects next build)
  const apiKey = process.env.AI_GATEWAY_API_KEY

  if (!apiKey) {
    // Neutral fallback — functional message without LLM dependency
    return `Olá, ${firstName}. Identificamos uma cobrança em aberto no valor de ${formatBRL(amount)}.`
  }

  try {
    const { text } = await generateText({
      model: 'anthropic/claude-sonnet-4.6',
      system: `Você é um assistente de cobrança de uma clínica odontológica.
Escreva 1-2 frases em português do Brasil, tom empático e profissional, lembrando
o paciente de uma cobrança em aberto.
REGRAS OBRIGATÓRIAS:
- Não inclua URL, link de pagamento ou qualquer endereço web (o link será adicionado automaticamente).
- Use apenas o primeiro nome e o valor fornecidos.
- Não invente informações adicionais.
- Máximo 2 frases.`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Primeiro nome: ${firstName}. Valor em aberto: ${formatBRL(amount)}.`,
            },
          ],
        },
      ],
      providerOptions: {
        gateway: {
          zeroDataRetention: true, // T-5-collect-I: LGPD — no data retained by provider
        } satisfies GatewayProviderOptions,
      },
    })
    return text.trim()
  } catch (err) {
    // LLM failure must not block collection sends — fall back to static message
    console.error('[collection-agent] LLM personalization failed, using fallback:', err)
    return `Olá, ${firstName}. Identificamos uma cobrança em aberto no valor de ${formatBRL(amount)}.`
  }
}

// ─── runCollectionAgent ───────────────────────────────────────────────────────

/**
 * AI-03 collection agent main entry point.
 *
 * Scans all overdue receivables (status='pendente', due_date < today) across all
 * tenants (admin client — service role), personalizes a pt-BR collection message
 * via the LLM, resolves the REAL Asaas payment link via gateway.getInvoiceUrl,
 * and enqueues the WhatsApp template via the Phase 4 outbox.
 *
 * Security invariants:
 *   - Payment link always from getInvoiceUrl; if null → skip (never fabricate).
 *   - LGPD: only patients with deleted_at IS NULL + is_anonymized=false (WR-06).
 *   - Idempotency: outbox idempotencyKey 'collection-agent:{receivableId}:{date}'.
 *   - Audit: agent_outreach_log + logBusinessEvent on each successful enqueue.
 *
 * @param admin - Admin Supabase client (defaults to createAdminClient()).
 * @returns { enqueued, skipped } counters for observability.
 */
export async function runCollectionAgent(
  admin = createAdminClient(),
): Promise<{ enqueued: number; skipped: number }> {
  const todayISO = new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'

  let enqueued = 0
  let skipped = 0

  // ── Query overdue receivables with patient + charge join ─────────────────────
  // Overdue = status='pendente' AND due_date < today (D-04: vencido derived here, not stored)
  // WR-06 (LGPD): inner join with explicit soft-delete/anonymize predicates —
  // createAdminClient() bypasses RLS, so these must be explicit.
  const { data: receivables, error: receivablesError } = await admin
    .from('receivables')
    .select(`
      id,
      due_date,
      status,
      value,
      tenant_id,
      patient_id,
      provider_charge_id,
      charges!inner(description),
      patients!inner(id, full_name, phone, deleted_at, is_anonymized)
    `)
    .eq('status', 'pendente')
    .lt('due_date', todayISO)
    .is('patients.deleted_at', null)
    .eq('patients.is_anonymized', false)

  if (receivablesError) {
    console.error('[collection-agent] Failed to load overdue receivables:', receivablesError.message)
    return { enqueued: 0, skipped: 0 }
  }

  if (!receivables || receivables.length === 0) {
    return { enqueued: 0, skipped: 0 }
  }

  const queue = getOutboxQueue(admin)

  // ── Process each overdue receivable ─────────────────────────────────────────
  for (const receivable of receivables) {
    const patient = receivable.patients as unknown as {
      id: string
      full_name: string
      phone: string | null
    }
    const charge = receivable.charges as unknown as {
      description: string | null
    }

    // Normalize phone to E.164 — skip if not normalizable (T-5-collect-cron guard)
    const e164 = toE164(patient.phone)
    if (!e164) {
      skipped++
      continue
    }

    // D-04 HARD INVARIANT: the payment link MUST come from gateway.getInvoiceUrl
    // (real Asaas API call). Never fabricate a link. If null → skip (no send).
    const paymentLink = receivable.provider_charge_id
      ? await gateway.getInvoiceUrl(receivable.provider_charge_id)
      : null

    if (!paymentLink) {
      // T-5-collect-T: no verified link → abort this send
      console.warn(
        `[collection-agent] Skipping receivable ${receivable.id}: no verified Asaas invoiceUrl`,
      )
      skipped++
      continue
    }

    // Build LLM-personalized message text (first name + amount only — Pattern 6)
    const firstName = patient.full_name.split(' ')[0] ?? patient.full_name
    const personalizedText = await buildCollectionMessage(firstName, receivable.value)

    // Format due date for display
    const dueDateFormatted = format(parseISO(receivable.due_date), 'dd/MM/yyyy', { locale: ptBR })

    // T-5-collect-dup: idempotency per receivable per calendar day
    const idempotencyKey = `collection-agent:${receivable.id}:${todayISO}`

    // Enqueue via Phase 4 outbox (never direct WhatsApp call)
    // NOTE: personalizedText rides in the patientName param ({{1}}) as the
    // leading body text. The paymentLink ({{5}}) is always the verified invoiceUrl.
    const enqueueResult = await queue.enqueue({
      tenantId: receivable.tenant_id,
      channel: 'whatsapp',
      idempotencyKey,
      payload: {
        kind: 'whatsapp_template',
        to: e164,
        templateName: TEMPLATE_COLLECTION,
        languageCode: WHATSAPP_LANGUAGE,
        components: buildCollectionComponents({
          patientName: personalizedText,
          description: charge.description ?? 'cobrança odontológica',
          amount: formatBRL(receivable.value),
          dueDate: dueDateFormatted,
          paymentLink, // REAL Asaas invoiceUrl — never LLM output
        }),
      },
    })

    if (!enqueueResult.success) {
      console.error(
        `[collection-agent] Failed to enqueue for receivable ${receivable.id}:`,
        enqueueResult.error,
      )
      skipped++
      continue
    }

    // Write agent_outreach_log (AI-03 audit trail — insert after successful enqueue)
    const { error: logError } = await admin.from('agent_outreach_log').insert({
      tenant_id: receivable.tenant_id,
      agent_type: 'collection',
      patient_id: receivable.patient_id ?? null,
      receivable_id: receivable.id,
      status: 'sent',
    })

    if (logError) {
      // Audit failure must not block the outbound message (same pattern as confirmation-agent)
      console.error(
        `[collection-agent] Failed to write agent_outreach_log for receivable ${receivable.id}:`,
        logError.message,
      )
    }

    // Audit event — IDs/amounts only, no PHI beyond first name (T-5-collect-I)
    await logBusinessEvent({
      tenantId: receivable.tenant_id,
      actorId: null,
      action: 'ai03.collection.sent',
      details: {
        receivableId: receivable.id,
        patientId: receivable.patient_id,
        value: receivable.value,
        dueDate: receivable.due_date,
      },
    })

    enqueued++
  }

  return { enqueued, skipped }
}
