'use server'
/**
 * src/actions/audit-actions.ts — AUD-01 / AUD-02 / Plan 10-04
 *
 * queryAuditLogs (AUD-01):
 *   Filters audit_logs by entity (table_name), user (actor_id), and period
 *   (created_at range), paginated, with old_values/new_values (before/after).
 *   Uses createAdminClient() AFTER an explicit role gate because the v1
 *   audit_logs_tenant_select RLS policy restricts SELECT to admin/superadmin.
 *   auditor/dpo are NOT in that allowlist — a createClient() read returns ZERO
 *   rows for them, breaking AUD-03 (their primary screen). The admin client
 *   bypasses RLS, so tenant isolation is enforced MANUALLY via an explicit
 *   .eq('tenant_id', actor.tenant_id) — tenant always from actor, never client.
 *
 * createEstorno (AUD-02):
 *   Generic motivo + alçada-approved reversal primitive. Creates an
 *   approval_requests row (type='estorno', idempotency guard) and records the
 *   request in the audit trail. Concrete per-entity reversal (e.g.
 *   receivables.status='estornado') is deferred to Phases 14–16 which import
 *   executeEstornoPayload and extend the switch.
 *
 * SECURITY (T-10-16, T-10-17, T-10-18, T-10-19, T-10-19b):
 *   - AUDIT_PERMITTED_ROLES gate precedes the admin-client query (T-10-19b)
 *   - Explicit .eq('tenant_id', actor.tenant_id) — cross-tenant read prevention (T-10-16)
 *   - assertNotReadOnly() on createEstorno — write guard (T-10-17)
 *   - logBusinessEvent on estorno.requested + estorno.executed (T-10-18)
 *   - idempotencyKey 'estorno:{table}:{record}' — one open estorno per record (T-10-19)
 *
 * IMPORTANT: Only async functions may be exported from a 'use server' file
 * (Next.js constraint D-131).
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { logBusinessEvent } from '@/lib/audit'
import { createApprovalRequest } from '@/actions/approval-actions'
import {
  AUDIT_PERMITTED_ROLES,
  AUDIT_PAGE_SIZE,
  type AuditFilters,
  type AuditLogRow,
  type EstornoInput,
} from '@/lib/audit-query-types'

// ─── Internal types ───────────────────────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
}

// ─── Helper: getActor ─────────────────────────────────────────────────────────

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

// ─── queryAuditLogs (AUD-01) ──────────────────────────────────────────────────

/**
 * queryAuditLogs — audit trail query lib.
 *
 * Access boundary: explicit AUDIT_PERMITTED_ROLES role gate BEFORE the admin-client
 * query. The gate is the security boundary (T-10-19b). Tenant isolation is enforced
 * by a mandatory .eq('tenant_id', actor.tenant_id) — never from client payload (T-10-16).
 *
 * Returns paginated AuditLogRow[] including old_values/new_values for before/after diff.
 */
export async function queryAuditLogs(
  filters: AuditFilters,
): Promise<{ success: boolean; rows?: AuditLogRow[]; error?: string }> {
  // 1. Authenticate
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  // 2. ROLE GATE — access boundary: auditor/dpo/admin/superadmin only.
  //    This gate PRECEDES the admin-client query. The admin client bypasses RLS;
  //    the gate is what enforces conformidade read permissions (T-10-19b).
  if (!AUDIT_PERMITTED_ROLES.includes(actor.role as (typeof AUDIT_PERMITTED_ROLES)[number])) {
    return { success: false, error: 'Acesso restrito' }
  }

  // 3. Admin client — DEFINITIVE (not createClient RLS).
  //    Rationale: v1 audit_logs_tenant_select RLS restricts SELECT to admin/superadmin.
  //    auditor/dpo are excluded — createClient() returns ZERO rows for them (AUD-03 break).
  const admin = createAdminClient()

  // 4. Build query — mandatory tenant filter from actor (never client payload, T-10-16)
  const page = filters.page ?? 0
  const offset = page * AUDIT_PAGE_SIZE

  let query = admin
    .from('audit_logs')
    .select('id, actor_id, action, table_name, record_id, old_values, new_values, created_at')
    .eq('tenant_id', actor.tenant_id)

  if (filters.tableName) {
    query = query.eq('table_name', filters.tableName)
  }

  if (filters.actorId) {
    query = query.eq('actor_id', filters.actorId)
  }

  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom)
  }

  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + AUDIT_PAGE_SIZE - 1)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, rows: (data ?? []) as AuditLogRow[] }
}

// ─── Zod schema for createEstorno ─────────────────────────────────────────────

const createEstornoSchema = z.object({
  tableName: z.string().min(1, 'Nome da tabela é obrigatório'),
  recordId: z.string().min(1, 'ID do registro é obrigatório'),
  reason: z.string().min(5, 'Motivo deve ter ao menos 5 caracteres'),
  requiredRole: z.string().optional(),
})

// ─── createEstorno (AUD-02) ───────────────────────────────────────────────────

/**
 * createEstorno — generic estorno primitive (AUD-02).
 *
 * Creates an approval_requests row (type='estorno') via createApprovalRequest
 * with an idempotency guard (one open estorno per record). The required_role
 * (alçada) defaults to 'admin'. Logs the request to the audit trail.
 *
 * Concrete per-entity reversal (e.g. receivables.status='estornado') is
 * DEFERRED to Phases 14–16 which call executeEstornoPayload with their own
 * entity-specific logic (see the extension point comment there).
 */
export async function createEstorno(
  input: EstornoInput,
): Promise<{ success: boolean; approvalId?: string; error?: string }> {
  // 1. Write guard — read-only roles (auditor, dpo, socio) cannot initiate estorno
  await assertNotReadOnly()

  // 2. Validate input with Zod (v3)
  const parsed = createEstornoSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const { tableName, recordId, reason, requiredRole } = parsed.data

  // 3. Authenticate
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  // 4. Idempotency key — one open estorno per record (T-10-19)
  const idempotencyKey = `estorno:${tableName}:${recordId}`

  // 5. Create approval request (type='estorno') via the unified approval queue (AUD-02)
  const approvalResult = await createApprovalRequest({
    type: 'estorno',
    payload: { tableName, recordId, reason },
    requiredRole: requiredRole ?? 'admin',
    idempotencyKey,
  })

  if (!approvalResult.success) {
    return { success: false, error: approvalResult.error }
  }

  // 6. Audit: record estorno request in the trail (T-10-18 — repudiation prevention)
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'estorno.requested',
    details: {
      tableName,
      recordId,
      requiredRole: requiredRole ?? 'admin',
    },
  })

  return { success: true, approvalId: approvalResult.id }
}

// ─── executeEstornoPayload (AUD-02 generic executor) ─────────────────────────

/**
 * executeEstornoPayload — generic estorno executor called by the approval dispatcher.
 *
 * For Phase 10: records the reversal to the audit trail via logBusinessEvent.
 * Concrete per-entity DB reversal (e.g. receivables.status='estornado') is
 * DEFERRED to Phases 14–16.
 *
 * EXTENSION POINT: When a concrete reversal is needed for a specific entity,
 * import this function and extend the dispatch switch:
 *
 *   switch (payload.tableName) {
 *     case 'receivables':
 *       await markReceivableEstornado(payload.recordId, tenantId)
 *       break
 *     // add cases per Phase 14-16
 *     default:
 *       // generic trail-only record (current Phase 10 behaviour)
 *   }
 *
 * Wire-up: In approval-actions.ts approveRequest dispatcher, the type==='estorno'
 * branch should call:
 *   await import('@/actions/audit-actions').then(m => m.executeEstornoPayload(...))
 */
export async function executeEstornoPayload(
  payload: { tableName: string; recordId: string; reason: string },
  actorId: string,
  tenantId: string,
): Promise<void> {
  // Generic executor: record the reversal to the audit trail (AUD-02 — T-10-18)
  // Concrete per-entity reversal logic is the extension point for Phases 14–16 (see above)
  await logBusinessEvent({
    tenantId,
    actorId,
    action: 'estorno.executed',
    details: {
      table_name: payload.tableName,
      record_id: payload.recordId,
      reason: payload.reason,
    },
  })
}
