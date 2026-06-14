/**
 * Phase 8 migrations — source-inspection test scaffold (RED by design)
 *
 * Asserts SQL content that will be written in Plan 02. Tests are RED now
 * (migration files do not exist yet) and turn GREEN when the migration files
 * are created.
 *
 * Convention: glob on supabase/migrations/ for suffix patterns so timestamp
 * prefixes don't break the test. readFileSync fails clearly when file is absent.
 *
 * Phase: 08-documentos-assinatura-icp-brasil / Plan 01 (Wave 0 RED scaffold)
 * DOC-01, DOC-02, DOC-03: schema correctness + RLS immutability + bucket
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

// ─── document_tables migration ────────────────────────────────────────────────

describe('Phase 8 migration — document_tables (DOC-01/02/03)', () => {
  it('creates public.document_templates table', () => {
    const sql = M('_document_tables.sql')
    expect(sql).toMatch(/CREATE TABLE public\.document_templates/i)
  })

  it('creates public.documents table', () => {
    const sql = M('_document_tables.sql')
    expect(sql).toMatch(/CREATE TABLE public\.documents/i)
  })

  it('creates public.document_versions table', () => {
    const sql = M('_document_tables.sql')
    expect(sql).toMatch(/CREATE TABLE public\.document_versions/i)
  })

  it('has index on document_templates.clinic_id', () => {
    const sql = M('_document_tables.sql')
    expect(sql).toMatch(/idx_document_templates_clinic/i)
  })

  it('has index on documents.clinic_id', () => {
    const sql = M('_document_tables.sql')
    expect(sql).toMatch(/idx_documents_clinic/i)
  })

  it('has index on document_versions.clinic_id', () => {
    const sql = M('_document_tables.sql')
    expect(sql).toMatch(/idx_doc_versions_clinic/i)
  })

  it('document_versions has UNIQUE (document_id, version_number)', () => {
    const sql = M('_document_tables.sql')
    expect(sql).toMatch(/UNIQUE\s*\(document_id,\s*version_number\)/i)
  })

  it('documents.status CHECK includes draft and signed', () => {
    const sql = M('_document_tables.sql')
    expect(sql).toMatch(/draft/i)
    expect(sql).toMatch(/signed/i)
    expect(sql).toMatch(/CHECK/i)
  })

  it('document_versions has is_content_encrypted column', () => {
    const sql = M('_document_tables.sql')
    expect(sql).toMatch(/is_content_encrypted/i)
  })
})

// ─── document_rls migration ───────────────────────────────────────────────────

describe('Phase 8 migration — document_rls (DOC-03 INSERT-only contract)', () => {
  it('enables RLS on document_templates', () => {
    const sql = M('_document_rls.sql')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i)
    expect(sql).toMatch(/document_templates/i)
  })

  it('enables RLS on documents', () => {
    const sql = M('_document_rls.sql')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i)
    expect(sql).toMatch(/\bdocuments\b/i)
  })

  it('enables RLS on document_versions', () => {
    const sql = M('_document_rls.sql')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i)
    expect(sql).toMatch(/document_versions/i)
  })

  it('document_versions has a FOR INSERT policy WITH CHECK (append-only)', () => {
    const sql = M('_document_rls.sql')
    expect(sql).toMatch(/FOR INSERT/i)
    expect(sql).toMatch(/WITH CHECK/i)
  })

  it('document_versions has NO FOR UPDATE policy (immutability contract)', () => {
    const sql = M('_document_rls.sql')
    // Extract only the document_versions section and assert no FOR UPDATE policy.
    // Split on semicolons to inspect each statement independently.
    const stmts = sql.split(';')
    const updateOnVersions = stmts.some(
      s => /ON\s+public\.document_versions/i.test(s) && /FOR\s+UPDATE/i.test(s)
    )
    expect(updateOnVersions).toBe(false)
  })

  it('document_versions has NO FOR DELETE policy (immutability contract)', () => {
    const sql = M('_document_rls.sql')
    // Split on semicolons to inspect each statement independently.
    const stmts = sql.split(';')
    const deleteOnVersions = stmts.some(
      s => /ON\s+public\.document_versions/i.test(s) && /FOR\s+DELETE/i.test(s)
    )
    expect(deleteOnVersions).toBe(false)
  })

  it('write policies use get_my_tenant_id()', () => {
    const sql = M('_document_rls.sql')
    expect(sql).toMatch(/get_my_tenant_id\(\)/i)
  })

  it('write policies include WITH CHECK clause', () => {
    const sql = M('_document_rls.sql')
    expect(sql).toMatch(/WITH CHECK/i)
  })
})

// ─── documents_bucket migration ───────────────────────────────────────────────

describe('Phase 8 migration — documents_bucket (DOC-02 storage)', () => {
  it('inserts documents-pdf bucket', () => {
    const sql = M('_documents_bucket.sql')
    expect(sql).toMatch(/documents-pdf/i)
  })

  it('bucket is private (public = false)', () => {
    const sql = M('_documents_bucket.sql')
    // Matches: public, false  OR  'public', false  OR public false
    expect(sql).toMatch(/false/i)
    expect(sql).toMatch(/documents-pdf/i)
  })
})
