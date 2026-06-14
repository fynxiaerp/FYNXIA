/**
 * Phase 10 migrations — source-inspection test scaffold (RED by design)
 *
 * Asserts SQL content that will be written in Plan 02. Tests are RED now
 * (migration files do not exist yet) and turn GREEN when the migration files
 * are created.
 *
 * Convention: glob on supabase/migrations/ for suffix patterns so timestamp
 * prefixes don't break the test. M(suffix) throws clearly when file is absent.
 *
 * Phase: 10-ia-governada-l0-l4-auditoria-ocr / Plan 01 (Wave 0 RED scaffold)
 * AIG-01..03: ai_decision_log (INSERT-only RLS, immutable)
 * AIG-02, AUD-02: approval_requests (idempotency + alçada)
 * OCR-02: ocr_extractions (pending_review + soft delete LGPD)
 * AUD-01/03: audit_logs indexes (table_name + record_id)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations')

/** Read a migration file by suffix match (ignores timestamp prefix). */
function M(suffix: string): string {
  const files = readdirSync(MIGRATIONS_DIR)
  const match = files.find(f => f.endsWith(suffix))
  if (!match) {
    throw new Error(`Migration file ending with '${suffix}' not found in supabase/migrations/`)
  }
  return readFileSync(join(MIGRATIONS_DIR, match), 'utf8')
}

// ─── ai_decision_log migration (AIG-03) ──────────────────────────────────────

describe('Phase 10 migration — ai_decision_log (AIG-03)', () => {
  it('creates public.ai_decision_log table', () => {
    const sql = M('_ai_decision_log.sql')
    expect(sql).toMatch(/CREATE TABLE public\.ai_decision_log/i)
  })

  it('has clinic_id column', () => {
    const sql = M('_ai_decision_log.sql')
    expect(sql).toMatch(/clinic_id/i)
  })

  it('has agent_key column', () => {
    const sql = M('_ai_decision_log.sql')
    expect(sql).toMatch(/agent_key/i)
  })

  it('has autonomy_level column', () => {
    const sql = M('_ai_decision_log.sql')
    expect(sql).toMatch(/autonomy_level/i)
  })

  it('has decision column with CHECK IN (execute, suggest, block, pending_approval)', () => {
    const sql = M('_ai_decision_log.sql')
    expect(sql).toMatch(/decision/i)
    expect(sql).toMatch(/CHECK/i)
    expect(sql).toMatch(/'execute'/i)
    expect(sql).toMatch(/'suggest'/i)
    expect(sql).toMatch(/'block'/i)
    expect(sql).toMatch(/'pending_approval'/i)
  })

  it('has idx_ai_decision_log_clinic index on clinic_id', () => {
    const sql = M('_ai_decision_log.sql')
    expect(sql).toMatch(/idx_ai_decision_log_clinic/i)
  })

  it('enables RLS', () => {
    const sql = M('_ai_decision_log.sql')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i)
  })

  it('has SELECT policy using get_my_tenant_id() (AIG-03 tenant read)', () => {
    const sql = M('_ai_decision_log.sql')
    expect(sql).toMatch(/FOR SELECT/i)
    expect(sql).toMatch(/get_my_tenant_id\(\)/i)
  })

  it('has NO FOR INSERT client policy (INSERT-only via admin client — immutable log)', () => {
    // ai_decision_log is INSERT-only via createAdminClient; no client INSERT policy
    // Split on semicolons to inspect each statement independently (mirrors phase8.test.ts)
    const sql = M('_ai_decision_log.sql')
    const stmts = sql.split(';')
    const clientInsertPolicy = stmts.some(
      s => /ON\s+public\.ai_decision_log/i.test(s) && /FOR\s+INSERT/i.test(s)
    )
    expect(clientInsertPolicy).toBe(false)
  })

  it('has NO FOR UPDATE client policy (immutable audit log — T-10-01 Tampering)', () => {
    const sql = M('_ai_decision_log.sql')
    const stmts = sql.split(';')
    const clientUpdatePolicy = stmts.some(
      s => /ON\s+public\.ai_decision_log/i.test(s) && /FOR\s+UPDATE/i.test(s)
    )
    expect(clientUpdatePolicy).toBe(false)
  })

  it('has NO FOR DELETE client policy (immutable audit log — T-10-01 Tampering)', () => {
    const sql = M('_ai_decision_log.sql')
    const stmts = sql.split(';')
    const clientDeletePolicy = stmts.some(
      s => /ON\s+public\.ai_decision_log/i.test(s) && /FOR\s+DELETE/i.test(s)
    )
    expect(clientDeletePolicy).toBe(false)
  })
})

// ─── approval_requests migration (AIG-02, AUD-02) ────────────────────────────

describe('Phase 10 migration — approval_requests (AIG-02, AUD-02)', () => {
  it('creates public.approval_requests table', () => {
    const sql = M('_approval_requests.sql')
    expect(sql).toMatch(/CREATE TABLE public\.approval_requests/i)
  })

  it('has type column with CHECK IN (ai_action, estorno)', () => {
    const sql = M('_approval_requests.sql')
    expect(sql).toMatch(/\btype\b/i)
    expect(sql).toMatch(/CHECK/i)
    expect(sql).toMatch(/'ai_action'/i)
    expect(sql).toMatch(/'estorno'/i)
  })

  it('has payload JSONB column', () => {
    const sql = M('_approval_requests.sql')
    expect(sql).toMatch(/payload\s+JSONB/i)
  })

  it('has required_role column (alçada)', () => {
    const sql = M('_approval_requests.sql')
    expect(sql).toMatch(/required_role/i)
  })

  it('has status column with CHECK IN (pending, approved, rejected, expired)', () => {
    const sql = M('_approval_requests.sql')
    expect(sql).toMatch(/status/i)
    expect(sql).toMatch(/'pending'/i)
    expect(sql).toMatch(/'approved'/i)
    expect(sql).toMatch(/'rejected'/i)
    expect(sql).toMatch(/'expired'/i)
  })

  it('has idempotency_key column', () => {
    const sql = M('_approval_requests.sql')
    expect(sql).toMatch(/idempotency_key/i)
  })

  it('has executed_at column (tracks when approved payload executed — Pitfall 2)', () => {
    const sql = M('_approval_requests.sql')
    expect(sql).toMatch(/executed_at/i)
  })

  it('has UNIQUE index on (clinic_id, idempotency_key) WHERE idempotency_key IS NOT NULL', () => {
    const sql = M('_approval_requests.sql')
    expect(sql).toMatch(/UNIQUE/i)
    expect(sql).toMatch(/clinic_id.*idempotency_key|idempotency_key.*clinic_id/i)
    expect(sql).toMatch(/WHERE idempotency_key IS NOT NULL/i)
  })

  it('has idx_approval_requests_status index', () => {
    const sql = M('_approval_requests.sql')
    expect(sql).toMatch(/idx_approval_requests_status/i)
  })

  it('enables RLS', () => {
    const sql = M('_approval_requests.sql')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i)
  })

  it('write policy has USING clause', () => {
    const sql = M('_approval_requests.sql')
    expect(sql).toMatch(/USING\s*\(/i)
    expect(sql).toMatch(/get_my_tenant_id\(\)/i)
  })

  it('write policy has WITH CHECK clause', () => {
    const sql = M('_approval_requests.sql')
    expect(sql).toMatch(/WITH CHECK/i)
  })
})

// ─── ocr_extractions migration (OCR-02, LGPD soft delete) ────────────────────

describe('Phase 10 migration — ocr_extractions (OCR-02)', () => {
  it('creates public.ocr_extractions table', () => {
    const sql = M('_ocr_extractions.sql')
    expect(sql).toMatch(/CREATE TABLE public\.ocr_extractions/i)
  })

  it('has extracted_fields JSONB column', () => {
    const sql = M('_ocr_extractions.sql')
    expect(sql).toMatch(/extracted_fields\s+JSONB/i)
  })

  it('has min_confidence column (threshold tracking)', () => {
    const sql = M('_ocr_extractions.sql')
    expect(sql).toMatch(/min_confidence/i)
  })

  it('has status column with CHECK including pending_review', () => {
    const sql = M('_ocr_extractions.sql')
    expect(sql).toMatch(/status/i)
    expect(sql).toMatch(/CHECK/i)
    expect(sql).toMatch(/'pending_review'/i)
  })

  it('has reviewed_by column', () => {
    const sql = M('_ocr_extractions.sql')
    expect(sql).toMatch(/reviewed_by/i)
  })

  it('has target_table column (pilot form reference)', () => {
    const sql = M('_ocr_extractions.sql')
    expect(sql).toMatch(/target_table/i)
  })

  it('has target_id column (set after commit)', () => {
    const sql = M('_ocr_extractions.sql')
    expect(sql).toMatch(/target_id/i)
  })

  it('has deleted_at column (LGPD soft delete — PII in extracted_fields)', () => {
    const sql = M('_ocr_extractions.sql')
    expect(sql).toMatch(/deleted_at/i)
  })

  it('has idx_ocr_extractions_status index on (clinic_id, status)', () => {
    const sql = M('_ocr_extractions.sql')
    expect(sql).toMatch(/idx_ocr_extractions_status/i)
  })

  it('enables RLS', () => {
    const sql = M('_ocr_extractions.sql')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i)
  })

  it('write policy has USING clause', () => {
    const sql = M('_ocr_extractions.sql')
    expect(sql).toMatch(/USING\s*\(/i)
    expect(sql).toMatch(/get_my_tenant_id\(\)/i)
  })

  it('write policy has WITH CHECK clause', () => {
    const sql = M('_ocr_extractions.sql')
    expect(sql).toMatch(/WITH CHECK/i)
  })
})

// ─── audit_logs indexes migration (AUD-01/03) ────────────────────────────────

describe('Phase 10 migration — audit_logs indexes (AUD-01/03)', () => {
  it('adds idx_audit_logs_table_name on (tenant_id, table_name) with IF NOT EXISTS', () => {
    // AUD-03: entity filter requires an index on table_name (missing from v1 schema)
    // [VERIFIED: supabase/migrations/20260603000000_initial_schema.sql — no idx on table_name]
    const sql = M('_audit_logs_indexes.sql')
    expect(sql).toMatch(/idx_audit_logs_table_name/i)
    expect(sql).toMatch(/tenant_id.*table_name|table_name.*tenant_id/i)
    expect(sql).toMatch(/IF NOT EXISTS/i)
  })

  it('adds idx_audit_logs_record_id on (tenant_id, table_name, record_id) with IF NOT EXISTS', () => {
    // AUD-03: entity-specific audit trail (e.g. one patient's history) requires record_id index
    const sql = M('_audit_logs_indexes.sql')
    expect(sql).toMatch(/idx_audit_logs_record_id/i)
    expect(sql).toMatch(/record_id/i)
    expect(sql).toMatch(/IF NOT EXISTS/i)
  })

  it('both indexes target audit_logs (base table — partitioned)', () => {
    const sql = M('_audit_logs_indexes.sql')
    expect(sql).toMatch(/ON\s+(?:public\.)?audit_logs\s*\(/i)
  })

  // Note: forward partitions for 2026-07, 2026-08, 2026-09 may already exist from earlier migrations.
  // The _audit_logs_indexes.sql migration must guard any partition creation with IF NOT EXISTS.
})
