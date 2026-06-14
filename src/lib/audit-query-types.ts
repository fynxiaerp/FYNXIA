/**
 * src/lib/audit-query-types.ts
 *
 * Shared types for the audit query layer (AUD-01/AUD-03).
 *
 * NO 'use server' — importable by RSC pages, Client Components, and Vitest tests.
 * Server Actions live in src/actions/audit-actions.ts.
 *
 * Phase: 10-ia-governada-l0-l4-auditoria-ocr / Plan 04
 */

// ─── AuditLogRow ──────────────────────────────────────────────────────────────

/**
 * AuditLogRow — typed projection of the audit_logs table columns
 * selected by queryAuditLogs. old_values and new_values are the before/after
 * snapshots (AUD-01: before/after diff).
 */
export interface AuditLogRow {
  id: string
  actor_id: string | null
  action: string
  table_name: string | null
  record_id: string | null
  old_values: unknown
  new_values: unknown
  created_at: string
}

// ─── AuditFilters ─────────────────────────────────────────────────────────────

/**
 * AuditFilters — query parameters accepted by queryAuditLogs.
 *
 * - tableName: filter by entity type (e.g. 'patients', 'appointments')
 * - actorId: filter by who made the change (users.id)
 * - dateFrom: ISO-8601 string; lower bound for created_at (gte)
 * - dateTo: ISO-8601 string; upper bound for created_at (lte)
 * - page: 0-indexed page number; defaults to 0
 */
export interface AuditFilters {
  tableName?: string
  actorId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
}

// ─── EstornoInput ─────────────────────────────────────────────────────────────

/**
 * EstornoInput — parameters for createEstorno.
 *
 * - tableName: entity being reversed (e.g. 'receivables')
 * - recordId: UUID of the record to reverse
 * - reason: motivo obrigatório (AUD-02)
 * - requiredRole: alçada (minimum role to approve); defaults to 'admin'
 */
export interface EstornoInput {
  tableName: string
  recordId: string
  reason: string
  requiredRole?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Number of rows per audit log query page. */
export const AUDIT_PAGE_SIZE = 50

/**
 * AUDIT_PERMITTED_ROLES — the conformidade roles that may read the audit trail.
 *
 * The v1 audit_logs_tenant_select RLS policy only allows admin/superadmin.
 * auditor and dpo were added in the role_expansion migration but NOT added to
 * that policy. queryAuditLogs uses createAdminClient() (bypasses RLS) AFTER
 * verifying the actor's role is in this list, providing the access boundary.
 */
export const AUDIT_PERMITTED_ROLES = ['auditor', 'dpo', 'admin', 'superadmin'] as const
