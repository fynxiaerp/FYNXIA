'use server'
import 'server-only'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { logBusinessEvent } from '@/lib/audit'
import { toE164 } from '@/lib/phone'
import { withAgentPolicy } from '@/lib/ai/policy'
import { createApprovalRequest, approveRequest, rejectRequest } from '@/actions/approval-actions'
import { getOutboxQueue } from '@/lib/messaging/queue'
import {
  TEMPLATE_REACTIVATION,
  WHATSAPP_LANGUAGE,
  buildReactivationComponents,
} from '@/lib/whatsapp/templates'
import { previewSegment, buildInactiveSegmentQuery } from '@/lib/crc/segment'
import { buildCampaignMessage } from '@/lib/agents/campaign-agent'
import { campaignSegmentSchema, campaignChannelSchema } from '@/lib/validators/crc'
import type { CampaignSegmentInput } from '@/lib/validators/crc'

/**
 * Campaign lifecycle Server Actions (CRC-03, D-07/D-08/D-09/D-10/D-11).
 *
 * createCampaign / updateCampaign / cancelCampaign / previewCampaignSegment /
 * requestCampaignPersonalization / submitCampaignForApproval /
 * approveCampaignAndDispatch / rejectCampaign / listCampaigns.
 *
 * SAFETY-CRITICAL (T-18-14 / Pitfall 2 / D-09 EoP threat):
 *   No message may ever be enqueued before human approval succeeds. Only
 *   approveCampaignAndDispatch enqueues via getOutboxQueue — AFTER
 *   approveRequest() returns success. submitCampaignForApproval and
 *   rejectCampaign never enqueue.
 *
 * SECURITY:
 *   1. assertNotReadOnly() — rejects auditor/dpo/socio at action layer
 *   2. WRITER_ROLES gate — no 'marketing' role exists (Pitfall 7); receptionist +
 *      admin + superadmin may write (mirrors leads.ts/referrals.ts convention)
 *   3. clinic_id always set from actor.tenant_id (never from client input)
 *   4. updateCampaign is rascunho-only (CAS `status='rascunho'` on the UPDATE) —
 *      T-18-19. cancelCampaign rejects 'enviada'/'aprovada'.
 *   5. Consent gate is re-applied at dispatch time via buildInactiveSegmentQuery
 *      (patients may have opted out since preview) — T-18-15.
 *   6. Audit logs carry IDs/counts only, never message text or PII (T-18-16).
 */

// ─── Helper: get authenticated actor ────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
}

async function getActor(): Promise<{ actor: Actor } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Não autenticado' }
  }

  const { data: actor, error: actorError } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (actorError || !actor) {
    return { error: 'Usuário não encontrado' }
  }

  return { actor }
}

// No 'marketing' role exists in the 11-value role enum (18-RESEARCH Pitfall 7) —
// receptionist/admin/superadmin write, mirrors every other Phase 18 WRITER_ROLES.
const WRITER_ROLES = ['receptionist', 'admin', 'superadmin'] as const

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// ─── Helper: resolve the actor's default unit ───────────────────────────────
// Mirrors leads.ts's resolveDefaultUnitId — campaigns.unit_id is NOT NULL but
// has no client-facing selector yet.

async function resolveDefaultUnitId(
  supabase: SupabaseClient,
  clinicId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('units')
    .select('id')
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('name')
    .limit(1)
    .maybeSingle()

  return data?.id ?? null
}

// ─── Helper: resolve the clinic's display name (for the LLM + WhatsApp template) ──

async function resolveClinicName(
  admin: ReturnType<typeof createAdminClient>,
  clinicId: string
): Promise<string> {
  const { data } = await admin.from('clinics').select('name').eq('id', clinicId).maybeSingle()
  return (data as { name?: string } | null)?.name ?? 'nossa clínica'
}

// ─── Zod schema (name + segment + channel — D-07/D-08) ──────────────────────

const campaignInputSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(120, 'Nome muito longo'),
  segment: campaignSegmentSchema,
  channel: campaignChannelSchema,
})

// ─── createCampaign ───────────────────────────────────────────────────────────

export async function createCampaign(
  rawInput: unknown
): Promise<{ success: boolean; id?: string; error?: string }> {
  await assertNotReadOnly()

  const parsed = campaignInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const supabase = await createClient()

  const unitId = await resolveDefaultUnitId(supabase, actor.tenant_id)
  if (!unitId) {
    return { success: false, error: 'Nenhuma unidade configurada para esta clínica' }
  }

  const { data: campaign, error: insertError } = await supabase
    .from('campaigns')
    .insert({
      clinic_id: actor.tenant_id,
      unit_id: unitId,
      name: data.name,
      inactive_days: data.segment.inactiveDays,
      filters: data.segment,
      channel_whatsapp: data.channel.whatsapp,
      channel_email: data.channel.email,
      status: 'rascunho',
    })
    .select('id')
    .single()

  if (insertError || !campaign) {
    return { success: false, error: insertError?.message ?? 'Erro ao criar campanha' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'crc.campaign.created',
    details: { campaign_id: campaign.id },
  })

  revalidatePath('/clinica/crc/campanhas')

  return { success: true, id: campaign.id }
}

// ─── updateCampaign ───────────────────────────────────────────────────────────
// RASCUNHO-ONLY (T-18-19): editing an already-submitted/dispatched campaign is
// forbidden. CAS guard: `.eq('status', 'rascunho')` on the UPDATE.

export async function updateCampaign(
  campaignId: string,
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const parsed = campaignInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const supabase = await createClient()

  const { data: current, error: fetchError } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('id', campaignId)
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !current) {
    return { success: false, error: fetchError?.message ?? 'Campanha não encontrada' }
  }

  if (current.status !== 'rascunho') {
    return { success: false, error: 'Só é possível editar campanhas em rascunho' }
  }

  // CAS guard: a concurrent submit loses the race instead of editing a
  // mid-flight campaign (0 rows affected below).
  const { data: updatedRows, error: updateError } = await supabase
    .from('campaigns')
    .update({
      name: data.name,
      inactive_days: data.segment.inactiveDays,
      filters: data.segment,
      channel_whatsapp: data.channel.whatsapp,
      channel_email: data.channel.email,
      // Clear stale preview data — segment/filters changed since last preview.
      preview_message: null,
      recipient_count: null,
    })
    .eq('id', campaignId)
    .eq('clinic_id', actor.tenant_id)
    .eq('status', 'rascunho')
    .select('id')

  if (updateError) {
    return { success: false, error: updateError.message }
  }
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: 'Só é possível editar campanhas em rascunho' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'crc.campaign.updated',
    details: { campaign_id: campaignId },
  })

  revalidatePath('/clinica/crc/campanhas')

  return { success: true }
}

// ─── cancelCampaign ───────────────────────────────────────────────────────────
// Allowed from 'rascunho' or 'aguardando_aprovacao' (not yet dispatched).
// Rejected from 'enviada'/'aprovada' — an already-dispatched campaign cannot be
// cancelled (T-18-19). Terminal states ('cancelada'/'rejeitada') are no-ops.

export async function cancelCampaign(
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const supabase = await createClient()

  const { data: current, error: fetchError } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('id', campaignId)
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !current) {
    return { success: false, error: fetchError?.message ?? 'Campanha não encontrada' }
  }

  if (current.status === 'enviada' || current.status === 'aprovada') {
    return { success: false, error: 'Campanha já disparada não pode ser cancelada' }
  }
  if (current.status === 'cancelada' || current.status === 'rejeitada') {
    return { success: false, error: 'Campanha já está em um estado final' }
  }

  const { error: updateError } = await supabase
    .from('campaigns')
    .update({ status: 'cancelada' })
    .eq('id', campaignId)
    .eq('clinic_id', actor.tenant_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'crc.campaign.cancelled',
    details: { campaign_id: campaignId },
  })

  revalidatePath('/clinica/crc/campanhas')

  return { success: true }
}

// ─── previewCampaignSegment ───────────────────────────────────────────────────
// Read-only preview (no send). Persists recipient_count for the UI/submit gate.

export async function previewCampaignSegment(campaignId: string): Promise<{
  success: boolean
  count?: number
  sample?: Array<{ patientId: string; firstName: string }>
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()

  const { data: campaign, error: fetchError } = await supabase
    .from('campaigns')
    .select('id, filters')
    .eq('id', campaignId)
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !campaign) {
    return { success: false, error: fetchError?.message ?? 'Campanha não encontrada' }
  }

  const admin = createAdminClient()
  const filters = campaign.filters as unknown as CampaignSegmentInput
  const { count, sample } = await previewSegment(admin, actor.tenant_id, filters)

  const { error: updateError } = await supabase
    .from('campaigns')
    .update({ recipient_count: count })
    .eq('id', campaignId)
    .eq('clinic_id', actor.tenant_id)

  if (updateError) {
    // Non-fatal — the preview itself succeeded; the persisted count is best-effort.
    console.error('[previewCampaignSegment] failed to persist recipient_count:', updateError.message)
  }

  return {
    success: true,
    count,
    sample: sample.map((r) => ({ patientId: r.patientId, firstName: r.firstName })),
  }
}

// ─── requestCampaignPersonalization ──────────────────────────────────────────
// L2 governed personalization (D-09) — still no send.

export async function requestCampaignPersonalization(
  campaignId: string
): Promise<{ success: boolean; preview?: string; error?: string }> {
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const supabase = await createClient()

  const { data: campaign, error: fetchError } = await supabase
    .from('campaigns')
    .select('id, filters')
    .eq('id', campaignId)
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !campaign) {
    return { success: false, error: fetchError?.message ?? 'Campanha não encontrada' }
  }

  const admin = createAdminClient()
  const filters = campaign.filters as unknown as CampaignSegmentInput
  const { sample } = await previewSegment(admin, actor.tenant_id, filters)

  const sampleFirstName = sample[0]?.firstName ?? 'Paciente'
  const clinicName = await resolveClinicName(admin, actor.tenant_id)

  const preview = await buildCampaignMessage(sampleFirstName, clinicName)

  const { error: updateError } = await supabase
    .from('campaigns')
    .update({ preview_message: preview })
    .eq('id', campaignId)
    .eq('clinic_id', actor.tenant_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  return { success: true, preview }
}

// ─── submitCampaignForApproval ───────────────────────────────────────────────
// D-09: creates the approval_requests row (type='ai_action', agent_key=
// 'crc-campaign' — Pitfall 1 discriminator) and moves the campaign to
// 'aguardando_aprovacao'. NO SEND HERE — enqueue only happens inside
// approveCampaignAndDispatch, after approveRequest() succeeds (Pitfall 2).

export async function submitCampaignForApproval(
  campaignId: string
): Promise<{ success: boolean; approvalRequestId?: string; error?: string }> {
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const supabase = await createClient()

  const { data: campaign, error: fetchError } = await supabase
    .from('campaigns')
    .select('id, status, recipient_count, preview_message, channel_whatsapp, channel_email')
    .eq('id', campaignId)
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !campaign) {
    return { success: false, error: fetchError?.message ?? 'Campanha não encontrada' }
  }

  if (campaign.status !== 'rascunho') {
    return { success: false, error: 'Campanha não está em rascunho' }
  }

  if (!campaign.recipient_count || !campaign.preview_message) {
    return {
      success: false,
      error: 'Gere a prévia do segmento e a mensagem personalizada antes de enviar para aprovação',
    }
  }

  const channel =
    campaign.channel_whatsapp && campaign.channel_email
      ? 'ambos'
      : campaign.channel_whatsapp
        ? 'whatsapp'
        : 'email'

  const approvalResult = await createApprovalRequest({
    type: 'ai_action',
    agentKey: 'crc-campaign',
    payload: {
      campaignId,
      recipientCount: campaign.recipient_count,
      channel,
      previewMessage: campaign.preview_message,
    },
    requiredRole: 'admin',
    idempotencyKey: `crc-campaign:${campaignId}`,
  })

  if (!approvalResult.success || !approvalResult.id) {
    return { success: false, error: approvalResult.error ?? 'Erro ao criar solicitação de aprovação' }
  }

  const { error: updateError } = await supabase
    .from('campaigns')
    .update({ status: 'aguardando_aprovacao', approval_request_id: approvalResult.id })
    .eq('id', campaignId)
    .eq('clinic_id', actor.tenant_id)
    .eq('status', 'rascunho')

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'crc.campaign.submitted',
    details: { campaign_id: campaignId, approval_request_id: approvalResult.id },
  })

  revalidatePath('/clinica/crc/campanhas')

  return { success: true, approvalRequestId: approvalResult.id }
}

// ─── approveCampaignAndDispatch ──────────────────────────────────────────────
// THE gated dispatch (Pitfall 2 / T-18-14). Step order is safety-critical:
//   (1) approveRequest() FIRST — if it fails, enqueue NOTHING.
//   (2) Only on success: campaigns.status = 'aprovada'.
//   (3) Re-resolve the segment (consent may have changed since preview).
//   (4) Per-recipient enqueue, wrapped in withAgentPolicy (L2 governance).
//   (5) campaigns.status = 'enviada'. If (3)-(5) throw after (1) succeeded,
//       leave status='aprovada' — a distinguishable retry state, never limbo.

export async function approveCampaignAndDispatch(
  approvalRequestId: string,
  campaignId: string
): Promise<{ success: boolean; enqueued?: number; skipped?: number; error?: string }> {
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  // Step 1: approveRequest FIRST — enqueue NOTHING until this succeeds.
  const appr = await approveRequest(approvalRequestId)
  if (!appr.success) {
    return { success: false, error: appr.error }
  }

  const supabase = await createClient()

  const { data: campaign, error: fetchError } = await supabase
    .from('campaigns')
    .select('id, filters, channel_whatsapp, channel_email')
    .eq('id', campaignId)
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !campaign) {
    // approveRequest already succeeded and is not rolled back here — the audit
    // trail correctly records the human decision even if the campaign row
    // itself cannot be found (e.g. wrong campaignId passed by the caller).
    return { success: false, error: fetchError?.message ?? 'Campanha não encontrada' }
  }

  // Step 2: only after approveRequest success — mark 'aprovada'.
  await supabase
    .from('campaigns')
    .update({ status: 'aprovada' })
    .eq('id', campaignId)
    .eq('clinic_id', actor.tenant_id)

  const admin = createAdminClient()
  const clinicName = await resolveClinicName(admin, actor.tenant_id)

  let enqueued = 0
  let skipped = 0

  try {
    // Step 3: re-resolve the segment — patients may have opted out since
    // preview; re-apply the consent gate (T-18-15).
    const filters = campaign.filters as unknown as CampaignSegmentInput
    const recipients = await buildInactiveSegmentQuery(admin, actor.tenant_id, filters)
    const queue = getOutboxQueue(admin)

    for (const recipient of recipients) {
      // Step 4: L2 governance gate PER-RECIPIENT — mirrors collection-agent.ts's
      // per-tenant withAgentPolicy wrap around the outbox enqueue.
      const govResult = await withAgentPolicy(
        {
          clinicId: actor.tenant_id,
          agentKey: 'crc-campaign',
          actorId: actor.id,
          action: 'agent.campaign.notify',
          actionSensitivity: 'safe',
        },
        async () => {
          const personalizedText = await buildCampaignMessage(recipient.firstName, clinicName)
          let sent = false

          if (campaign.channel_whatsapp) {
            const e164 = toE164(recipient.phone)
            if (e164) {
              const result = await queue.enqueue({
                tenantId: actor.tenant_id,
                channel: 'whatsapp',
                idempotencyKey: `campaign:${campaignId}:${recipient.patientId}:whatsapp`,
                payload: {
                  kind: 'whatsapp_template',
                  to: e164,
                  templateName: TEMPLATE_REACTIVATION,
                  languageCode: WHATSAPP_LANGUAGE,
                  components: buildReactivationComponents({
                    patientName: personalizedText,
                    clinicName,
                  }),
                },
              })
              if (result.success) sent = true
            }
          }

          if (campaign.channel_email && recipient.email) {
            const result = await queue.enqueue({
              tenantId: actor.tenant_id,
              channel: 'email',
              idempotencyKey: `campaign:${campaignId}:${recipient.patientId}:email`,
              payload: {
                to: recipient.email,
                subject: `Sentimos sua falta na ${clinicName}`,
                html: `<p>${personalizedText}</p>`,
              },
            })
            if (result.success) sent = true
          }

          return { _sent: sent }
        }
      )

      if (govResult && typeof govResult === 'object' && '_policy' in govResult) {
        // Agent disabled/blocked for this tenant — count as skipped.
        skipped++
      } else if (govResult && typeof govResult === 'object' && '_sent' in govResult && govResult._sent) {
        enqueued++
      } else {
        skipped++
      }
    }

    // Step 5: mark 'enviada'.
    await supabase
      .from('campaigns')
      .update({ status: 'enviada' })
      .eq('id', campaignId)
      .eq('clinic_id', actor.tenant_id)

    // IDs/counts only — never message text or PII (T-18-16).
    await logBusinessEvent({
      tenantId: actor.tenant_id,
      actorId: actor.id,
      action: 'crc.campaign.dispatched',
      details: { campaign_id: campaignId, recipient_count: enqueued },
    })

    revalidatePath('/clinica/crc/campanhas')

    return { success: true, enqueued, skipped }
  } catch (err) {
    // Steps 3-5 threw AFTER step 1 succeeded — leave status='aprovada' (a
    // distinguishable retry state per Pitfall 2), never silent limbo.
    console.error('[approveCampaignAndDispatch] dispatch failed after approval:', err)
    return {
      success: false,
      error:
        'Falha ao disparar a campanha após a aprovação — a campanha permanece em "aprovada" para nova tentativa',
    }
  }
}

// ─── rejectCampaign ───────────────────────────────────────────────────────────
// The reject counterpart of approveCampaignAndDispatch (makes the UI-SPEC
// 'Rejeitada' badge reachable — rejectRequest alone is audit-only and never
// touches campaigns.status). Enqueues NOTHING — no send ever happens on reject.

export async function rejectCampaign(
  approvalRequestId: string,
  campaignId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  // Step 1: rejectRequest FIRST — on failure, DO NOT touch campaigns.status.
  const rej = await rejectRequest(approvalRequestId, reason)
  if (!rej.success) {
    return { success: false, error: rej.error }
  }

  const supabase = await createClient()

  // Step 2: only on success — campaigns.status='rejeitada'. No enqueue, ever.
  const { error: updateError } = await supabase
    .from('campaigns')
    .update({ status: 'rejeitada' })
    .eq('id', campaignId)
    .eq('clinic_id', actor.tenant_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'crc.campaign.rejected',
    details: { campaign_id: campaignId, reason },
  })

  revalidatePath('/clinica/crc/campanhas')

  return { success: true }
}

// ─── listCampaigns ────────────────────────────────────────────────────────────
// Read list for the campaigns table (Plan 09).

export async function listCampaigns(): Promise<{
  success: boolean
  data?: Array<{
    id: string
    name: string
    status: string
    channel_whatsapp: boolean
    channel_email: boolean
    inactive_days: number
    recipient_count: number | null
    preview_message: string | null
    approval_request_id: string | null
    created_at: string
  }>
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('campaigns')
    .select(
      'id, name, status, channel_whatsapp, channel_email, inactive_days, recipient_count, preview_message, approval_request_id, created_at'
    )
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data ?? [] }
}
