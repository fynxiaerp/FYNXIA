'use server'
/**
 * Server Actions: Esterilização/CME (CME-01, CME-02, CME-03)
 *
 * registerSterilizationCycle: Zod-validates + computes status via deriveCycleStatus +
 *                             inserts tenant-scoped + logs (CME-01).
 * updateBiologicalResult:     Sets biological_result, recomputes status, logs.
 * registerKitUsage:           PATIENT-SAFETY BLOCK GUARD (CME-02) — re-fetches the cycle
 *                             SERVER-SIDE, runs isCycleUsable against the fresh row,
 *                             and REFUSES to insert when cycle is not usable. The block
 *                             lives here in the action so no client field, stale UI, or
 *                             direct API call can bypass it. On success, links
 *                             cycle→appointment→patient (CME-03) and logs.
 * listSterilizationCycles:    Tenant-scoped read.
 * getKitTraceability:         Returns kit_usages joined to cycle for lote traceability.
 *
 * Guards on every mutation:
 *   1. assertNotReadOnly() — blocks read-only roles at action boundary (T-13-14)
 *   2. Role gate: TEAM_ROLES — admin, superadmin, dentist, receptionist
 *   3. Tenant scope: clinic_id = actor.tenant_id on every insert/update (T-13-17)
 *   4. logBusinessEvent (IDs only — LGPD) (T-13-18)
 *
 * Turbopack 'use server' constraint: every export at module level must be async.
 * No re-exports, no non-async exports.
 *
 * Pre-push type cast: Phase 13 tables not yet in database.types.ts (Plan 05 pushes).
 * Uses `supabase as unknown as SupabaseClient<any>` idiom (mirrors clinical-documents.ts)
 * to keep tsc --noEmit clean before the type regeneration.
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 04
 * Requirements: CME-01, CME-02, CME-03
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { logBusinessEvent } from '@/lib/audit'
import { deriveCycleStatus, isCycleUsable } from '@/lib/esterilizacao/cycle-status'
import {
  sterilizationCycleSchema,
  kitUsageSchema,
  type SterilizationCycleInput,
  type KitUsageInput,
} from '@/lib/validators/sterilization'

// ─── Roles ────────────────────────────────────────────────────────────────────

const TEAM_ROLES = ['admin', 'superadmin', 'dentist', 'receptionist']

// ─── Actor helper (mirrors resources.ts exactly) ──────────────────────────────

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

// ─── registerSterilizationCycle ───────────────────────────────────────────────
/**
 * CME-01: Registers a new sterilization cycle (autoclave run).
 * Computes the initial status via deriveCycleStatus and stores it as a snapshot.
 *
 * T-13-14: assertNotReadOnly + TEAM_ROLES gate blocks non-team actors.
 * T-13-17: clinic_id = actor.tenant_id enforces tenant isolation.
 * T-13-18: logBusinessEvent records the cycle registration (IDs only).
 */
export async function registerSterilizationCycle(
  input: SterilizationCycleInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  await assertNotReadOnly()

  const parsed = sterilizationCycleSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  if (!TEAM_ROLES.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para registrar ciclo de esterilização' }
  }

  const {
    autoclave_id,
    unit_id,
    cycle_number,
    temperatura,
    tempo_minutos,
    pressao,
    biological_result,
    cycle_date,
    validade,
    operator_id,
    notes,
  } = parsed.data

  // Compute status snapshot at insert time
  const status = deriveCycleStatus({
    biologicalResult: biological_result,
    validade: validade ?? null,
  })

  const supabase = await createClient()
  const db = supabase as unknown as SupabaseClient<any>

  const { data: cycle, error: insertError } = await db
    .from('sterilization_cycles')
    .insert({
      clinic_id: actor.tenant_id,
      unit_id: unit_id ?? null,
      autoclave_id,
      cycle_number: cycle_number ?? null,
      temperatura: temperatura ?? null,
      tempo_minutos: tempo_minutos ?? null,
      pressao: pressao ?? null,
      biological_result,
      cycle_date,
      validade: validade ?? null,
      status,
      operator_id: operator_id ?? actor.id,
      notes: notes ?? null,
      created_by: actor.id,
    })
    .select('id')
    .single()

  if (insertError || !cycle) {
    return { success: false, error: insertError?.message ?? 'Erro ao registrar ciclo' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'sterilization.cycle.registered',
    details: {
      cycle_id: cycle.id,
      status,
      biological_result,
    },
  })

  return { success: true, id: cycle.id }
}

// ─── updateBiologicalResult ───────────────────────────────────────────────────
/**
 * Sets the biological indicator result on an existing cycle and recomputes
 * the persisted status snapshot via deriveCycleStatus.
 *
 * T-13-14: assertNotReadOnly + TEAM_ROLES gate.
 * T-13-17: .eq('clinic_id', actor.tenant_id) on the update.
 */
export async function updateBiologicalResult(
  id: string,
  biologicalResult: 'pendente' | 'aprovado' | 'reprovado'
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  if (!TEAM_ROLES.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para atualizar resultado biológico' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as SupabaseClient<any>

  // Re-fetch the cycle's validade for status recomputation
  const { data: existing, error: fetchError } = await db
    .from('sterilization_cycles')
    .select('id, validade')
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Ciclo não encontrado' }
  }

  const status = deriveCycleStatus({
    biologicalResult,
    validade: existing.validade ?? null,
  })

  const { error: updateError } = await db
    .from('sterilization_cycles')
    .update({
      biological_result: biologicalResult,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'sterilization.biological.updated',
    details: {
      cycle_id: id,
      biological_result: biologicalResult,
      status,
    },
  })

  return { success: true }
}

// ─── registerKitUsage ─────────────────────────────────────────────────────────
/**
 * CME-02 + CME-03 — PATIENT-SAFETY BLOCK GUARD.
 *
 * Re-fetches the sterilization cycle SERVER-SIDE (T-13-12: cannot be bypassed by
 * a direct call, stale UI, or race — the cycle is read at the moment of use).
 * Runs isCycleUsable against the FRESHLY-READ row + server `today` (T-13-13:
 * TOCTOU mitigation — validade checked at insert time, not at form-load time).
 *
 * If NOT usable → returns { success:false, blocked:true, error: reason }
 * and DOES NOT insert into kit_usages. No client field overrides this block.
 *
 * On success → inserts the kit_usage (cycle→appointment→patient linkage, CME-03)
 * and logs 'kit.usage.registered'.
 *
 * T-13-14: assertNotReadOnly + TEAM_ROLES gate.
 * T-13-17: clinic_id = actor.tenant_id on insert.
 * T-13-18: logBusinessEvent with IDs only.
 */
export async function registerKitUsage(
  input: KitUsageInput
): Promise<{ success: boolean; id?: string; blocked?: boolean; error?: string }> {
  await assertNotReadOnly()

  const parsed = kitUsageSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  if (!TEAM_ROLES.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para registrar uso de kit' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as SupabaseClient<any>

  // ── CME-02 BLOCK GUARD: re-fetch the cycle server-side (authoritative check) ──
  // T-13-12: the block is here in the action — no client field overrides it.
  // T-13-13: validade is evaluated NOW (server today), not at form-load time.
  const { data: cycle, error: cycleError } = await db
    .from('sterilization_cycles')
    .select('id, biological_result, validade, deleted_at')
    .eq('id', parsed.data.sterilization_cycle_id)
    .eq('clinic_id', actor.tenant_id)
    .single()

  if (cycleError || !cycle) {
    return { success: false, error: 'Ciclo não encontrado' }
  }

  if (cycle.deleted_at) {
    return { success: false, error: 'Ciclo não encontrado' }
  }

  // Run the block-guard against the FRESHLY-READ cycle data
  const check = isCycleUsable({
    biologicalResult: cycle.biological_result,
    validade: cycle.validade ?? null,
  })

  // ── SAFETY BLOCK: refuse insert when cycle is not usable ──────────────────
  if (!check.usable) {
    return {
      success: false,
      blocked: true,
      error: check.reason ?? 'Ciclo não está apto para uso',
    }
  }

  // Cycle is safe to use — insert the kit_usage (CME-03 traceability)
  const { sterilization_cycle_id, patient_id, appointment_id, unit_id, kit_label } = parsed.data

  const { data: usage, error: insertError } = await db
    .from('kit_usages')
    .insert({
      clinic_id: actor.tenant_id,
      unit_id: unit_id ?? null,
      sterilization_cycle_id,
      appointment_id: appointment_id ?? null,
      patient_id,
      kit_label: kit_label ?? null,
      used_by: actor.id,
    })
    .select('id')
    .single()

  if (insertError || !usage) {
    return { success: false, error: insertError?.message ?? 'Erro ao registrar uso de kit' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'kit.usage.registered',
    details: {
      kit_usage_id: usage.id,
      sterilization_cycle_id,
      patient_id,
      appointment_id: appointment_id ?? null,
    },
  })

  return { success: true, id: usage.id }
}

// ─── listSterilizationCycles ──────────────────────────────────────────────────
/**
 * Returns all non-deleted sterilization cycles for the actor's clinic,
 * ordered by cycle_date descending.
 *
 * Read-only: no assertNotReadOnly() — listing is safe even in read-only mode.
 * T-13-17: RLS + explicit eq('clinic_id') enforce tenant isolation.
 */
export async function listSterilizationCycles(): Promise<{
  success: boolean
  data?: Record<string, unknown>[]
  error?: string
}> {
  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const supabase = await createClient()
  const db = supabase as unknown as SupabaseClient<any>

  const { data, error } = await db
    .from('sterilization_cycles')
    .select(
      'id, autoclave_id, unit_id, cycle_number, temperatura, tempo_minutos, pressao, biological_result, cycle_date, validade, status, operator_id, notes, created_at, created_by'
    )
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .order('cycle_date', { ascending: false })

  if (error) {
    return { success: false, error: 'Erro ao listar ciclos de esterilização' }
  }

  return { success: true, data: (data ?? []) as Record<string, unknown>[] }
}

// ─── getKitTraceability ───────────────────────────────────────────────────────
/**
 * CME-03: Returns kit usages joined to cycle data for lote traceability.
 * Can be filtered by cycleId (lote) or patientId (patient exposure history).
 *
 * Read-only: no assertNotReadOnly().
 * T-13-17: RLS + explicit clinic_id filter.
 */
export async function getKitTraceability(params: {
  cycleId?: string
  patientId?: string
}): Promise<{
  success: boolean
  data?: Record<string, unknown>[]
  error?: string
}> {
  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const supabase = await createClient()
  const db = supabase as unknown as SupabaseClient<any>

  let query = db
    .from('kit_usages')
    .select(
      `id, sterilization_cycle_id, patient_id, appointment_id, kit_label, used_at, used_by,
       sterilization_cycles ( cycle_number, cycle_date, validade, biological_result, status, autoclave_id )`
    )
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)

  if (params.cycleId) {
    query = query.eq('sterilization_cycle_id', params.cycleId)
  }
  if (params.patientId) {
    query = query.eq('patient_id', params.patientId)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: 'Erro ao buscar rastreabilidade do kit' }
  }

  return { success: true, data: (data ?? []) as Record<string, unknown>[] }
}
