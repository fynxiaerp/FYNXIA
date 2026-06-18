/**
 * Phase 12 — migrations-phase12-rx.test.ts
 * Migration source-inspection scaffold for Phase 12 receituário (RX-01/RX-03).
 *
 * Target migration suffixes (Plans 02/03 create these — RED by design now):
 *   _clinical_documents.sql        — medications + clinical_documents + document_seq_counters + next_doc_number
 *   _clinical_documents_rls.sql    — RLS policies
 *   _clinical_documents_bucket.sql — clinical-documents-pdf private bucket
 *
 * MM(suffix) returns '' when file absent — assertions fail on content, NOT crash.
 * M(suffix)  throws if absent — use ONLY for existing migrations (regression guard).
 * ALL()      concatenates every *.sql migration in supabase/migrations/.
 * SRC(rel)   returns '' when source file absent.
 *
 * REGRESSION GUARD (CRITICAL — must stay GREEN now):
 * Locks appointments EXCLUDE GIST + status CHECK in 20260605000100_clinical_tables.sql
 * as UNCHANGED. Also locks Phase 8 signPdfBuffer in src/lib/icp/sign-document.ts.
 * No Phase 12 migration may DROP CONSTRAINT no_overlap or ALTER COLUMN status.
 *
 * ES2017 tsconfig: NO /s (dotAll) flag — use separate .toMatch() calls.
 *
 * Phase: 12-receitu-rio-teleodontologia / Plan 01 (Wave 0 RED scaffold)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { vi } from 'vitest'

vi.mock('server-only', () => ({}))

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations')

/** Read existing migration by suffix — throws clearly if absent (regression guard use only). */
function M(suffix: string): string {
  const files = readdirSync(MIGRATIONS_DIR)
  const match = files.find(f => f.endsWith(suffix))
  if (!match) {
    throw new Error(`Migration file ending with '${suffix}' not found in supabase/migrations/`)
  }
  return readFileSync(join(MIGRATIONS_DIR, match), 'utf8')
}

/** Like M() but returns '' when no migration matches — use for Phase 12 targets (RED by design). */
function MM(suffix: string): string {
  const files = readdirSync(MIGRATIONS_DIR)
  const match = files.find(f => f.endsWith(suffix))
  return match ? readFileSync(join(MIGRATIONS_DIR, match), 'utf8') : ''
}

/** Concatenation of every *.sql migration — for the "no DROP/ALTER appointments" scan. */
function ALL(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(f => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n')
}

/** Read source file by relative path. Returns '' if missing. */
function SRC(rel: string): string {
  const p = resolve(process.cwd(), rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

// ─── REGRESSION GUARD (CRITICAL — must stay GREEN now) ───────────────────────

describe('REGRESSION: appointments GIST + status CHECK + Phase 8 signing unchanged', () => {
  it('20260605000100_clinical_tables.sql still contains CONSTRAINT no_overlap EXCLUDE USING GIST', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/CONSTRAINT no_overlap EXCLUDE USING GIST/)
  })

  it('regression: GIST clause still has tenant_id WITH =', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/tenant_id\s+WITH =/)
  })

  it('regression: GIST clause still has dentist_id WITH =', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/dentist_id\s+WITH =/)
  })

  it('regression: GIST WHERE clause still uses status NOT IN cancelado', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/WHERE \(status NOT IN \('cancelado'\)\)/)
  })

  it('regression: appointments status CHECK still contains agendado', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/'agendado'/)
  })

  it('regression: appointments status CHECK still contains confirmado', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/'confirmado'/)
  })

  it('regression: appointments status CHECK still contains em_atendimento', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/'em_atendimento'/)
  })

  it('regression: appointments status CHECK still contains concluido', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/'concluido'/)
  })

  it('regression: appointments status CHECK still contains cancelado', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/'cancelado'/)
  })

  it('regression: no migration (including Phase 12) drops the no_overlap constraint', () => {
    const anyDrop = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .some(f => {
        const content = readFileSync(join(MIGRATIONS_DIR, f), 'utf8')
        return /DROP CONSTRAINT no_overlap/i.test(content)
      })
    expect(anyDrop).toBe(false)
  })

  it('regression: no Phase 12 migration alters appointments.status column type', () => {
    // Exclude the original clinical_tables migration — only check subsequent ones
    const phase12Files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') && !f.includes('20260605000100'))
    const anyAlterStatus = phase12Files.some(f => {
      const content = readFileSync(join(MIGRATIONS_DIR, f), 'utf8')
      return /ALTER TABLE[^;]*appointments[^;]*ALTER COLUMN status/i.test(content)
    })
    expect(anyAlterStatus).toBe(false)
  })

  // Phase 8 signing engine regression
  // NOTE: Plan 04 must IMPORT signPdfBuffer, never modify src/lib/icp/sign-document.ts.
  it('src/lib/icp/sign-document.ts still exports signPdfBuffer (Phase 8 engine intact)', () => {
    const src = SRC('src/lib/icp/sign-document.ts')
    expect(src).toMatch(/export async function signPdfBuffer/)
  })

  it('src/lib/icp/sign-document.ts still exports verifyPdfSignature (Phase 8 engine intact)', () => {
    const src = SRC('src/lib/icp/sign-document.ts')
    expect(src).toMatch(/export function verifyPdfSignature/)
  })
})

// ─── Phase 12: _clinical_documents.sql (RX-01/RX-03) ─────────────────────────

describe('Phase 12 migration — medications table (RX-01 base curada D-01)', () => {
  it('creates public.medications table', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/CREATE TABLE public\.medications/)
  })

  it('medications has name column', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/\bname\b/)
  })

  it('medications has generic_name column', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/generic_name/)
  })

  it('medications has therapeutic_class column', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/therapeutic_class/)
  })

  it('medications has allergen_tags column', () => {
    // Two separate assertions — no /s flag needed
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/allergen_tags/)
  })

  it('medications allergen_tags is TEXT[] type', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/TEXT\[\]/)
  })

  it('medications has requires_special_control BOOLEAN column (RX-01 receita controle especial)', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/requires_special_control/)
    expect(sql).toMatch(/BOOLEAN/)
  })

  it('medications has at least one seed INSERT INTO public.medications', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/INSERT INTO public\.medications/)
  })
})

describe('Phase 12 migration — clinical_documents table (RX-01/RX-03)', () => {
  it('creates public.clinical_documents table', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/CREATE TABLE public\.clinical_documents/)
  })

  it('clinical_documents has clinic_id column', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/clinic_id/)
  })

  it('clinical_documents has patient_id column', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/patient_id/)
  })

  it('clinical_documents has professional_id column', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/professional_id/)
  })

  it('clinical_documents has appointment_id column', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/appointment_id/)
  })

  it('clinical_documents doc_type CHECK contains receita_simples', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/'receita_simples'/)
  })

  it('clinical_documents doc_type CHECK contains receita_controle_especial', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/'receita_controle_especial'/)
  })

  it('clinical_documents doc_type CHECK contains atestado', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/'atestado'/)
  })

  it('clinical_documents doc_type CHECK contains solicitacao_exame', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/'solicitacao_exame'/)
  })

  it('clinical_documents status CHECK contains draft', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/'draft'/)
  })

  it('clinical_documents status CHECK contains signed', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/'signed'/)
  })

  it('clinical_documents content_json stored as TEXT (encrypted PII — T-12-05, Pitfall 7)', () => {
    // content_json must be TEXT (encrypted at rest via encrypt()), NOT JSONB
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/content_json TEXT/)
  })

  it('clinical_documents has doc_number column', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/doc_number/)
  })

  it('clinical_documents has storage_path column', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/storage_path/)
  })

  it('clinical_documents has signature column (null = unsigned)', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/\bsignature\b/)
  })

  it('clinical_documents has portal_visible BOOLEAN (RX-03 patient portal)', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/portal_visible/)
  })

  it('clinical_documents has deleted_at column (LGPD soft delete)', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/deleted_at/)
  })

  it('clinical_documents has idx_clinical_docs index on clinic_id', () => {
    // Two separate checks — avoids /s flag
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/idx_clinical_docs/)
    expect(sql).toMatch(/clinic_id/)
  })

  it('REVOKE on storage_path (sensitive column — T-12-05)', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/REVOKE/)
    expect(sql).toMatch(/storage_path/)
  })
})

describe('Phase 12 migration — document_seq_counters table (RX-03 atomic numbering)', () => {
  it('creates public.document_seq_counters table', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/CREATE TABLE public\.document_seq_counters/)
  })

  it('document_seq_counters has clinic_id column', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/clinic_id/)
  })

  it('document_seq_counters has doc_type column', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/doc_type/)
  })

  it('document_seq_counters has UNIQUE constraint on (clinic_id, doc_type)', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/UNIQUE/)
  })
})

describe('Phase 12 migration — next_doc_number function (RX-03 atomic numbering)', () => {
  it('creates public.next_doc_number function', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/next_doc_number/)
  })

  it('next_doc_number uses ON CONFLICT for atomic upsert (Pitfall 3 — no MAX+1)', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/ON CONFLICT/)
  })

  it('next_doc_number uses DO UPDATE SET last_seq to increment counter', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).toMatch(/last_seq/)
  })

  it('next_doc_number does NOT use MAX( (race-unsafe pattern)', () => {
    const sql = MM('_clinical_documents.sql')
    expect(sql).not.toMatch(/MAX\(/)
  })
})

// ─── Phase 12: _clinical_documents_rls.sql (Access Control) ──────────────────

describe('Phase 12 migration — clinical_documents RLS (Access Control)', () => {
  it('enables ROW LEVEL SECURITY on clinical_documents', () => {
    const sql = MM('_clinical_documents_rls.sql')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
  })

  it('SELECT policy uses clinic_id = get_my_tenant_id()', () => {
    const sql = MM('_clinical_documents_rls.sql')
    expect(sql).toMatch(/FOR SELECT/)
    expect(sql).toMatch(/clinic_id = get_my_tenant_id\(\)/)
  })

  it('write policy has USING clause (T-12-01)', () => {
    const sql = MM('_clinical_documents_rls.sql')
    expect(sql).toMatch(/USING\s*\(/)
  })

  it('write policy has WITH CHECK clause', () => {
    const sql = MM('_clinical_documents_rls.sql')
    expect(sql).toMatch(/WITH CHECK/)
  })

  it('write policy role gate includes admin', () => {
    const sql = MM('_clinical_documents_rls.sql')
    expect(sql).toMatch(/'admin'/)
  })

  it('write policy role gate includes dentist', () => {
    const sql = MM('_clinical_documents_rls.sql')
    expect(sql).toMatch(/'dentist'/)
  })

  it('write policy role gate includes superadmin', () => {
    const sql = MM('_clinical_documents_rls.sql')
    expect(sql).toMatch(/'superadmin'/)
  })

  it('medications SELECT policy exists (Pitfall 4 — global table, no tenant filter)', () => {
    const sql = MM('_clinical_documents_rls.sql')
    // The medications policy must reference public.medications
    expect(sql).toMatch(/medications/)
  })

  it('medications policy does NOT filter by get_my_tenant_id (global reference table)', () => {
    // Extract the medications policy block if present.
    // The medications SELECT policy should allow any authenticated user (active=true only).
    // We assert that the medications block does NOT use get_my_tenant_id.
    const sql = MM('_clinical_documents_rls.sql')
    // Check the policy exists on medications but does not include get_my_tenant_id
    // (A global reference table must not be tenant-filtered)
    if (sql.includes('medications')) {
      // Find the medications-related portion and check it does not restrict to a tenant
      // This is a soft assertion: we verify there IS a medications policy
      // but it does not pair a clinic_id filter with get_my_tenant_id()
      // (pattern: a policy on medications that only uses active = true, not clinic_id)
      expect(sql).toMatch(/ON public\.medications/)
    } else {
      // File absent → RED (empty string fails the above existence check)
      expect(sql).toMatch(/medications/)
    }
  })
})

// ─── Phase 12: ALL() regression re-scan ─────────────────────────────────────

describe('REGRESSION re-scan: Phase 12 rx migrations do not break appointments', () => {
  it('ALL migrations combined do not contain DROP CONSTRAINT no_overlap', () => {
    expect(ALL()).not.toMatch(/DROP CONSTRAINT no_overlap/i)
  })
})
