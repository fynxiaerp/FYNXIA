'use server'
/**
 * Collection Ruler Server Actions
 *
 * FIN-07 / D-10: Admin-only configuration for the automated collection ruler.
 * - getCollectionRuler: load tenant's current rule (defaults if none)
 * - saveCollectionRuler: UPSERT rule — admin / superadmin only; inserts into collection_log on send
 *
 * SECURITY: Role gate — only 'admin' or 'superadmin' may save. Non-admin returns failure result.
 * IDEMPOTENCY: The cron endpoint uses collection_log UNIQUE(receivable_id, milestone, channel)
 * to deduplicate sends. This action manages the rule that drives the milestone selection.
 */
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Validation schema ────────────────────────────────────────────────────────

const collectionRulerSchema = z.object({
  dueDateReminderEnabled: z.boolean(),
  overdueReminderEnabled: z.boolean(),
  // intervalDays: 1-30 (free plan: once/day cron — intervals outside this range are meaningless)
  overdueIntervalDays: z.number().int().min(1).max(30),
})

type CollectionRulerInput = z.infer<typeof collectionRulerSchema>

// ─── Default rule values ──────────────────────────────────────────────────────

const DEFAULT_RULE = {
  due_date_reminder_enabled: false,
  overdue_reminder_enabled: false,
  overdue_interval_days: 7,
}

// ─── getCollectionRuler ───────────────────────────────────────────────────────

export async function getCollectionRuler(): Promise<{
  success: boolean
  rule?: {
    due_date_reminder_enabled: boolean
    overdue_reminder_enabled: boolean
    overdue_interval_days: number
  }
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()
  const { data: rule, error } = await supabase
    .from('collection_rules')
    .select('due_date_reminder_enabled, overdue_reminder_enabled, overdue_interval_days')
    .eq('tenant_id', actor.tenant_id)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = row not found — return defaults
    return { success: false, error: error.message }
  }

  // Return existing rule or defaults if none configured yet
  return {
    success: true,
    rule: rule ?? DEFAULT_RULE,
  }
}

// ─── saveCollectionRuler ──────────────────────────────────────────────────────
// collection_log is the idempotency table used by the cron endpoint.
// This action manages the collection_rules row that controls which milestones
// the cron will use to generate collection_log entries.

export async function saveCollectionRuler(input: CollectionRulerInput): Promise<{
  success: boolean
  error?: string
}> {
  // 1. Validate input
  const parsed = collectionRulerSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  // 2. Auth + role gate — admin/superadmin only
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  // Non-admin roles must not configure collection rules
  if (!['admin', 'superadmin'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  const supabase = await createClient()

  // 3. UPSERT on tenant_id UNIQUE — creates or updates the rule atomically
  const { error: upsertError } = await supabase
    .from('collection_rules')
    .upsert(
      {
        tenant_id: actor.tenant_id,
        due_date_reminder_enabled: data.dueDateReminderEnabled,
        overdue_reminder_enabled: data.overdueReminderEnabled,
        overdue_interval_days: data.overdueIntervalDays,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    )

  if (upsertError) {
    return { success: false, error: upsertError.message }
  }

  // 4. Audit log (no PHI in details)
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'collection_rule.saved',
    details: {
      due_date_reminder_enabled: data.dueDateReminderEnabled,
      overdue_reminder_enabled: data.overdueReminderEnabled,
      overdue_interval_days: data.overdueIntervalDays,
    },
  })

  return { success: true }
}
