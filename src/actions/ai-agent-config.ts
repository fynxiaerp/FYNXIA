'use server'
/**
 * AI Agent Config Server Actions — SYS-04 / Plan 07-06
 *
 * listAiAgentConfig: returns network-level (unit_id IS NULL) ai_agent_config rows
 *   for the authenticated tenant (confirmation + collection agents).
 * saveAiAgentConfig: upserts the network-level row for a given agent key.
 *   Uses onConflict: 'clinic_id,agent_key' scoped to WHERE unit_id IS NULL
 *   (matches the partial unique index from migration 20260614000600).
 *
 * NOTE: L0–L4 enforcement (tetos, travas, aprovação humana) arrives in Fase 10 (AIG).
 * This plan stores the config; Fase 10 reads and enforces it.
 *
 * IMPORTANT: Only async functions may be exported from a 'use server' file (Next.js constraint).
 * Constants and types live in @/lib/ai-agent-config-types to avoid the
 * "A 'use server' file can only export async functions" runtime error.
 *
 * SECURITY:
 *   1. assertNotReadOnly() — blocks auditor/dpo/socio (x-read-only header)
 *   2. role gate           — admin/superadmin only for mutations
 *   3. clinic_id from actor.tenant_id — never trusted from client
 *   4. logBusinessEvent    — audit trail on every save
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { logBusinessEvent } from '@/lib/audit'
import {
  AUTONOMY_LEVELS,
  AGENT_KEYS,
  type AgentKey,
  type AutonomyLevel,
  type AiAgentConfigRow,
} from '@/lib/ai-agent-config-types'

// ─── Internal types ───────────────────────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
}

// ─── Validation ───────────────────────────────────────────────────────────────

const saveAiAgentConfigSchema = z.object({
  agentKey: z.enum(AGENT_KEYS, {
    errorMap: () => ({ message: 'Agent key inválido' }),
  }),
  autonomyLevel: z.enum(AUTONOMY_LEVELS, {
    errorMap: () => ({ message: 'Nível de autonomia deve ser L0, L1, L2, L3 ou L4' }),
  }),
  enabled: z.boolean(),
})

// ─── Helper ───────────────────────────────────────────────────────────────────

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

// ─── listAiAgentConfig ────────────────────────────────────────────────────────

export async function listAiAgentConfig(): Promise<{
  success: boolean
  agents?: AiAgentConfigRow[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ai_agent_config')
    .select('*')
    .eq('clinic_id', actor.tenant_id)
    .is('unit_id', null) // network-level rows only
    .order('agent_key', { ascending: true })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, agents: (data ?? []) as AiAgentConfigRow[] }
}

// ─── saveAiAgentConfig ────────────────────────────────────────────────────────

export async function saveAiAgentConfig(
  agentKey: AgentKey,
  autonomyLevel: AutonomyLevel,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  // 1. Read-only gate — blocks auditor/dpo/socio at action layer
  await assertNotReadOnly()

  // 2. Validate inputs
  const parsed = saveAiAgentConfigSchema.safeParse({ agentKey, autonomyLevel, enabled })
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  // 3. Auth + role gate — admin/superadmin only (AI autonomy config is a high-privilege op)
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  // 4. Upsert network-level row (unit_id IS NULL)
  // onConflict targets the partial unique index: (clinic_id, agent_key) WHERE unit_id IS NULL
  const supabase = await createClient()

  const { error: upsertError } = await supabase
    .from('ai_agent_config')
    .upsert(
      {
        clinic_id: actor.tenant_id,
        unit_id: null, // network-level row
        agent_key: data.agentKey,
        autonomy_level: data.autonomyLevel,
        enabled: data.enabled,
        updated_by: actor.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'clinic_id,agent_key' }
    )

  if (upsertError) {
    return { success: false, error: upsertError.message }
  }

  // 5. Audit log
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'ai_agent_config.saved',
    details: {
      agent_key: data.agentKey,
      autonomy_level: data.autonomyLevel,
      enabled: data.enabled,
    },
  })

  return { success: true }
}
