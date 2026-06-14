'use server'
/**
 * Approval Server Actions — AIG-02 / AUD-02 / Plan 10-03
 *
 * createApprovalRequest: INSERT a pending approval_requests row for a sensitive
 *   AI action or estorno. Uses createClient() (RLS enforces tenant scope via
 *   WITH CHECK). Idempotent: returns the existing row id on unique conflict.
 *
 * approveRequest: APPROVE a pending request — idempotent execute (UPDATE WHERE
 *   status='pending' AND executed_at IS NULL + affected-row check). Enforces
 *   alçada (actor.role vs required_role) and assertNotReadOnly. Logs via
 *   logBusinessEvent. (T-10-12: prevents double-execution / Pitfall 2)
 *
 * rejectRequest: REJECT a pending request — assertNotReadOnly + alçada + UPDATE
 *   status='rejected'. No payload execution. Logs via logBusinessEvent.
 *
 * SECURITY:
 *   1. assertNotReadOnly() — blocks auditor/dpo/socio at action layer
 *   2. alçada check      — canApprove(actor.role, request.required_role)
 *   3. clinic_id always from actor.tenant_id — never trusted from client
 *   4. logBusinessEvent  — audit trail on every approve/reject
 *   5. UPDATE WHERE status='pending' AND executed_at IS NULL — idempotency guard
 *
 * IMPORTANT: Only async functions may be exported from a 'use server' file
 * (Next.js constraint D-131). canApprove is re-exported from policy-types.ts
 * for test discoverability; it is a pure sync function and not a Server Action.
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { logBusinessEvent } from '@/lib/audit'
import { canApprove as _canApprove } from '@/lib/ai/policy-types'
// NOTE: do NOT re-export canApprove here — a 'use server' file may only export
// async functions (Turbopack build error). canApprove lives in policy-types.ts.

// ─── Internal types ───────────────────────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
}

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

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const createApprovalRequestSchema = z.object({
  type: z.enum(['ai_action', 'estorno'], {
    errorMap: () => ({ message: 'Tipo de aprovação inválido' }),
  }),
  payload: z.record(z.unknown()).default({}),
  agentKey: z.string().optional(),
  requiredRole: z.string().min(1).default('admin'),
  idempotencyKey: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
})

// ─── createApprovalRequest ────────────────────────────────────────────────────

/**
 * createApprovalRequest — creates a pending approval_requests row.
 *
 * Uses createClient() so the tenant RLS WITH CHECK policy enforces that
 * clinic_id matches the actor's tenant. clinic_id is ALWAYS from actor.tenant_id
 * (never trusted from client payload).
 *
 * Idempotent: on unique constraint violation for idempotency_key, returns the
 * existing row id rather than failing (T-10-12).
 */
export async function createApprovalRequest(params: {
  type: string
  payload?: Record<string, unknown>
  agentKey?: string
  requiredRole?: string
  idempotencyKey?: string
  expiresAt?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const parsed = createApprovalRequestSchema.safeParse(params)
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

  const supabase = await createClient()

  // INSERT via RLS-scoped client — WITH CHECK ensures clinic_id = get_my_tenant_id()
  const { data: row, error: insertError } = await supabase
    .from('approval_requests')
    .insert({
      clinic_id: actor.tenant_id,
      type: data.type,
      payload: data.payload,
      agent_key: data.agentKey ?? null,
      required_role: data.requiredRole,
      requested_by: actor.id,
      status: 'pending',
      idempotency_key: data.idempotencyKey ?? null,
      expires_at: data.expiresAt ?? null,
    })
    .select('id')
    .single()

  if (insertError) {
    // Unique constraint violation on idempotency_key → return existing row
    if (insertError.code === '23505') {
      // Look up the existing row
      const { data: existing } = await supabase
        .from('approval_requests')
        .select('id')
        .eq('clinic_id', actor.tenant_id)
        .eq('idempotency_key', data.idempotencyKey ?? '')
        .single()
      return { success: true, id: existing?.id }
    }
    return { success: false, error: insertError.message }
  }

  return { success: true, id: row?.id }
}

// ─── approveRequest ───────────────────────────────────────────────────────────

/**
 * approveRequest — idempotently approve a pending request.
 *
 * Idempotency (T-10-12 / Pitfall 2):
 *   UPDATE WHERE status='pending' AND executed_at IS NULL — if 0 rows affected,
 *   another actor won the race; abort without executing the payload.
 *
 * Alçada: canApprove(actor.role, request.required_role) enforced server-side
 * from the users table — never from client payload (T-10-13).
 */
export async function approveRequest(
  id: string,
  note?: string,
): Promise<{ success: boolean; error?: string }> {
  // 1. Read-only gate
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()

  // 2. Load the request (RLS-scoped to actor's tenant)
  const { data: request, error: loadError } = await supabase
    .from('approval_requests')
    .select('id, status, required_role, type, payload, executed_at')
    .eq('id', id)
    .single()

  if (loadError || !request) {
    return { success: false, error: 'Solicitação não encontrada' }
  }

  // 3. Status guard — only pending requests can be approved
  if (request.status !== 'pending') {
    return { success: false, error: 'Já decidido' }
  }

  // 4. Alçada check — actor.role vs request.required_role (server-side, never client payload)
  if (!_canApprove(actor.role, request.required_role)) {
    return { success: false, error: 'Alçada insuficiente' }
  }

  const now = new Date().toISOString()

  // 5. Idempotent execute via UPDATE WHERE status='pending' AND executed_at IS NULL
  // If 0 rows affected → another actor won the race → abort
  const admin = createAdminClient()
  const { data: updated, error: updateError } = await admin
    .from('approval_requests')
    .update({
      status: 'approved',
      approver: actor.id,
      decided_at: now,
      reason: note ?? null,
      executed_at: now,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .is('executed_at', null)
    .select('id')

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  if (!updated || updated.length === 0) {
    // Another actor executed first — idempotency guard prevents double-execution
    return { success: false, error: 'Já executado por outro aprovador (corrida de aprovação)' }
  }

  // 6. Dispatch the stored payload
  // For Wave 1: dispatch records execution to the audit trail (generic).
  // Concrete per-module reversal is deferred to Plans 04/05 (estorno) and later phases.
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'approval.payload.dispatched',
    details: {
      id,
      type: request.type,
      // Payload logged without PII — for audit trail (T-10-14)
    },
  })

  // 7. Audit
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'approval.approved',
    details: {
      id,
      type: request.type,
      required_role: request.required_role,
    },
  })

  return { success: true }
}

// ─── rejectRequest ────────────────────────────────────────────────────────────

/**
 * rejectRequest — reject a pending approval request.
 *
 * No payload execution. Sets status='rejected' with reason and decided_at.
 * Logs to audit trail via logBusinessEvent.
 */
export async function rejectRequest(
  id: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  // 1. Read-only gate
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()

  // 2. Load the request (RLS-scoped)
  const { data: request, error: loadError } = await supabase
    .from('approval_requests')
    .select('id, status, required_role, type')
    .eq('id', id)
    .single()

  if (loadError || !request) {
    return { success: false, error: 'Solicitação não encontrada' }
  }

  // 3. Status guard
  if (request.status !== 'pending') {
    return { success: false, error: 'Já decidido' }
  }

  // 4. Alçada check
  if (!_canApprove(actor.role, request.required_role)) {
    return { success: false, error: 'Alçada insuficiente' }
  }

  const now = new Date().toISOString()

  // 5. UPDATE status='rejected' — mirror approveRequest's race protection (WR-01)
  // .eq('status','pending').is('executed_at', null) + affected-row count check
  // prevents duplicate reject audit events and detects approve-vs-reject races.
  const admin = createAdminClient()
  const { data: updated, error: updateError } = await admin
    .from('approval_requests')
    .update({
      status: 'rejected',
      approver: actor.id,
      decided_at: now,
      reason,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .is('executed_at', null)
    .select('id')

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  if (!updated || updated.length === 0) {
    // Another actor won the race (approved or rejected first)
    return { success: false, error: 'Já decidido por outro ator (corrida de aprovação).' }
  }

  // 6. Audit
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'approval.rejected',
    details: {
      id,
      type: request.type,
      required_role: request.required_role,
      reason,
    },
  })

  return { success: true }
}
