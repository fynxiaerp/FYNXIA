/**
 * Phase 11 migrations — source-inspection test scaffold (RED by design for new artifacts)
 *
 * Asserts SQL content that Plans 02/03 will create. New-artifact assertions are RED now
 * (migration files do not exist yet) and turn GREEN when each migration lands.
 * MM(suffix) returns '' if missing — fail on content, NOT on throw — so the suite runs clean.
 *
 * REGRESSION GUARD (CRITICAL — must stay GREEN):
 * Locks the existing appointments EXCLUDE GIST + status CHECK in
 * 20260605000100_clinical_tables.sql as UNCHANGED. No Phase 11 migration may
 * DROP CONSTRAINT no_overlap or ALTER COLUMN status on appointments.
 *
 * Phase: 11-profissionais-recursos / Plan 01 (Wave 0 RED scaffold)
 * PRO-01: professionals + professional_availability + professional_availability_exceptions
 * PRO-01 (RLS): ENABLE ROW LEVEL SECURITY, SELECT + write policies
 * RES-01: resources table + indexes
 * RES-01 (RLS): ENABLE ROW LEVEL SECURITY + policies
 * RES-02: appointment.resource_id ADD COLUMN
 * RES-03: realtime publication + proxy public route
 *
 * ES2017 gotcha: never use /s (dotAll) flag — not supported under this repo's tsconfig.
 * Use multiple separate .toMatch() calls for multi-line SQL assertions.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations')

/**
 * Read a migration file by suffix match (ignores timestamp prefix).
 * Throws clearly when file is absent — use for EXISTING migrations only.
 */
function M(suffix: string): string {
  const files = readdirSync(MIGRATIONS_DIR)
  const match = files.find(f => f.endsWith(suffix))
  if (!match) {
    throw new Error(`Migration file ending with '${suffix}' not found in supabase/migrations/`)
  }
  return readFileSync(join(MIGRATIONS_DIR, match), 'utf8')
}

/**
 * Like M() but returns '' when no migration matches.
 * Use for Phase 11 target migrations (RED by design until Plans 02/03 land).
 * Assertions on '' will fail with a clear content mismatch — not a crash.
 */
function MM(suffix: string): string {
  const files = readdirSync(MIGRATIONS_DIR)
  const match = files.find(f => f.endsWith(suffix))
  return match ? readFileSync(join(MIGRATIONS_DIR, match), 'utf8') : ''
}

/**
 * Read a source file by relative path from process.cwd().
 * Returns '' if missing — assertion fails on content, not on ENOENT.
 */
function SRC(rel: string): string {
  const p = resolve(process.cwd(), rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

// ─── REGRESSION GUARD (must be GREEN now — reads existing migration) ──────────

describe('REGRESSION: appointments GIST + status CHECK unchanged', () => {
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

  it('regression: appointments status CHECK still contains all 5 original values', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/'agendado'/)
    expect(sql).toMatch(/'confirmado'/)
    expect(sql).toMatch(/'em_atendimento'/)
    expect(sql).toMatch(/'concluido'/)
    expect(sql).toMatch(/'cancelado'/)
  })

  it('regression: no Phase 11 migration file drops the no_overlap constraint', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'))
    const anyDrop = files.some(f => {
      const content = readFileSync(join(MIGRATIONS_DIR, f), 'utf8')
      return /DROP CONSTRAINT no_overlap/i.test(content)
    })
    expect(anyDrop).toBe(false)
  })

  it('regression: no Phase 11 migration alters appointments.status column type', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'))
    // Exclude the original clinical_tables migration — only check subsequent ones
    const phase11Files = files.filter(f => !f.includes('20260605000100'))
    const anyAlterStatus = phase11Files.some(f => {
      const content = readFileSync(join(MIGRATIONS_DIR, f), 'utf8')
      // Matches: ALTER TABLE appointments ALTER COLUMN status ...
      return /ALTER TABLE[^;]*appointments[^;]*ALTER COLUMN status/i.test(content)
    })
    expect(anyAlterStatus).toBe(false)
  })
})

// ─── Phase 11: _professionals.sql (PRO-01) ────────────────────────────────────

describe('Phase 11 migration — professionals table (PRO-01)', () => {
  it('creates public.professionals table', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/CREATE TABLE public\.professionals/)
  })

  it('has clinic_id column', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/clinic_id/)
  })

  it('has unit_id column', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/unit_id/)
  })

  it('has user_id as NULLABLE FK to public.users (not NOT NULL)', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/user_id/)
    expect(sql).toMatch(/REFERENCES public\.users/)
    // user_id must NOT have NOT NULL (professionals without login must be allowed)
    expect(sql).not.toMatch(/user_id\s+UUID\s+NOT NULL/)
  })

  it('has cro column', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/\bcro\b/)
  })

  it('has cro_uf column', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/cro_uf/)
  })

  it('has especialidades TEXT[] column', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/especialidades/)
    expect(sql).toMatch(/TEXT\[\]/)
  })

  it('has vinculo CHECK IN clt, pj, autonomo', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/vinculo/)
    expect(sql).toMatch(/CHECK/)
    expect(sql).toMatch(/'clt'/)
    expect(sql).toMatch(/'pj'/)
    expect(sql).toMatch(/'autonomo'/)
  })

  it('has commission_rules JSONB column', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/commission_rules/)
    expect(sql).toMatch(/JSONB/)
  })

  it('has deleted_at column (LGPD soft delete)', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/deleted_at/)
  })

  it('has idx_professionals_clinic_id index', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/idx_professionals_clinic_id/)
  })

  it('has partial unique index on clinic_id + user_id WHERE user_id IS NOT NULL', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/professionals\(clinic_id.*user_id\)|professionals\(.*user_id.*clinic_id/)
    expect(sql).toMatch(/WHERE user_id IS NOT NULL/)
  })

  it('partial unique index also guards deleted_at IS NULL', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/deleted_at IS NULL/)
  })

  it('creates professional_availability table with weekday, start_time, end_time', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/CREATE TABLE public\.professional_availability/)
    expect(sql).toMatch(/weekday/)
    expect(sql).toMatch(/start_time/)
    expect(sql).toMatch(/end_time/)
  })

  it('creates professional_availability_exceptions with exception_type CHECK IN folga, extra', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/CREATE TABLE public\.professional_availability_exceptions/)
    expect(sql).toMatch(/exception_type/)
    expect(sql).toMatch(/'folga'/)
    expect(sql).toMatch(/'extra'/)
  })

  it('has backfill INSERT INTO professionals FROM users WHERE role = dentist', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/INSERT INTO public\.professionals/)
    expect(sql).toMatch(/FROM public\.users/)
    expect(sql).toMatch(/'dentist'/)
  })
})

// ─── Phase 11: _professionals_rls.sql (Access Control) ───────────────────────

describe('Phase 11 migration — professionals RLS (Access Control)', () => {
  it('enables RLS on professionals table', () => {
    const sql = MM('_professionals_rls.sql')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
  })

  it('has SELECT policy using clinic_id = get_my_tenant_id()', () => {
    const sql = MM('_professionals_rls.sql')
    expect(sql).toMatch(/FOR SELECT/)
    expect(sql).toMatch(/clinic_id = get_my_tenant_id\(\)/)
  })

  it('write policy has USING clause (T-11-03 — non-admin cannot mutate)', () => {
    const sql = MM('_professionals_rls.sql')
    expect(sql).toMatch(/USING\s*\(/)
    expect(sql).toMatch(/get_my_tenant_id\(\)/)
  })

  it('write policy has WITH CHECK clause', () => {
    const sql = MM('_professionals_rls.sql')
    expect(sql).toMatch(/WITH CHECK/)
  })

  it('write policy role gate includes admin', () => {
    const sql = MM('_professionals_rls.sql')
    expect(sql).toMatch(/'admin'/)
  })

  it('write policy role gate includes superadmin', () => {
    const sql = MM('_professionals_rls.sql')
    expect(sql).toMatch(/'superadmin'/)
  })
})

// ─── Phase 11: _resources.sql (RES-01) ───────────────────────────────────────

describe('Phase 11 migration — resources table (RES-01)', () => {
  it('creates public.resources table', () => {
    const sql = MM('_resources.sql')
    expect(sql).toMatch(/CREATE TABLE public\.resources/)
  })

  it('has clinic_id column', () => {
    const sql = MM('_resources.sql')
    expect(sql).toMatch(/clinic_id/)
  })

  it('has unit_id column', () => {
    const sql = MM('_resources.sql')
    expect(sql).toMatch(/unit_id/)
  })

  it('has tipo CHECK IN sala, cadeira, equipamento', () => {
    const sql = MM('_resources.sql')
    expect(sql).toMatch(/tipo/)
    expect(sql).toMatch(/CHECK/)
    expect(sql).toMatch(/'sala'/)
    expect(sql).toMatch(/'cadeira'/)
    expect(sql).toMatch(/'equipamento'/)
  })

  it('has patrimonio column', () => {
    const sql = MM('_resources.sql')
    expect(sql).toMatch(/patrimonio/)
  })

  it('has numero_serie column', () => {
    const sql = MM('_resources.sql')
    expect(sql).toMatch(/numero_serie/)
  })

  it('has status CHECK IN ativo, manutencao, inativo', () => {
    const sql = MM('_resources.sql')
    expect(sql).toMatch(/status/)
    expect(sql).toMatch(/'ativo'/)
    expect(sql).toMatch(/'manutencao'/)
    expect(sql).toMatch(/'inativo'/)
  })

  it('has deleted_at column (LGPD soft delete)', () => {
    const sql = MM('_resources.sql')
    expect(sql).toMatch(/deleted_at/)
  })

  it('has idx_resources_clinic_id index', () => {
    const sql = MM('_resources.sql')
    expect(sql).toMatch(/idx_resources_clinic_id/)
  })

  it('has idx_resources_unit_id index', () => {
    const sql = MM('_resources.sql')
    expect(sql).toMatch(/idx_resources_unit_id/)
  })
})

// ─── Phase 11: _resources_rls.sql (Access Control) ───────────────────────────

describe('Phase 11 migration — resources RLS (Access Control)', () => {
  it('enables RLS on resources table', () => {
    const sql = MM('_resources_rls.sql')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
  })

  it('has SELECT policy using clinic_id = get_my_tenant_id()', () => {
    const sql = MM('_resources_rls.sql')
    expect(sql).toMatch(/FOR SELECT/)
    expect(sql).toMatch(/clinic_id = get_my_tenant_id\(\)/)
  })

  it('write policy has USING clause', () => {
    const sql = MM('_resources_rls.sql')
    expect(sql).toMatch(/USING\s*\(/)
  })

  it('write policy has WITH CHECK clause', () => {
    const sql = MM('_resources_rls.sql')
    expect(sql).toMatch(/WITH CHECK/)
  })

  it('write policy role gate includes admin and superadmin', () => {
    const sql = MM('_resources_rls.sql')
    expect(sql).toMatch(/'admin'/)
    expect(sql).toMatch(/'superadmin'/)
  })
})

// ─── Phase 11: _appointment_resource_checkin.sql (RES-02/RES-03) ─────────────

describe('Phase 11 migration — appointment resource + checkin columns (RES-02/RES-03)', () => {
  it('ALTER TABLE appointments adds resource_id UUID REFERENCES public.resources', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).toMatch(/ALTER TABLE public\.appointments/)
    expect(sql).toMatch(/resource_id/)
    expect(sql).toMatch(/REFERENCES public\.resources/)
  })

  it('adds idx_appointments_resource_id index (RES-02)', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).toMatch(/idx_appointments_resource_id/)
  })

  it('does NOT drop no_overlap constraint (RES-02: resource check is app-level only)', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).not.toMatch(/DROP CONSTRAINT no_overlap/i)
  })

  it('adds presence_status column with CHECK IN aguardando, chamado, em_atendimento, finalizado (RES-03)', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).toMatch(/presence_status/)
    expect(sql).toMatch(/'aguardando'/)
    expect(sql).toMatch(/'chamado'/)
    expect(sql).toMatch(/'em_atendimento'/)
    expect(sql).toMatch(/'finalizado'/)
  })

  it('presence_status is a separate column from status (RES-03 — not merged into status)', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    // presence_status should appear as a new column — verify it is NOT folded into status CHECK
    // Check that the existing status enum values are NOT in the same CHECK as presence_status
    expect(sql).toMatch(/presence_status/)
    // The original status column values must remain untouched
    expect(sql).not.toMatch(/ALTER COLUMN status.*aguardando/i)
  })

  it('adds arrived_at TIMESTAMPTZ column (RES-03 waiting time)', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).toMatch(/arrived_at/)
    expect(sql).toMatch(/TIMESTAMPTZ/)
  })

  it('adds called_at TIMESTAMPTZ column (RES-03 call timestamp)', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).toMatch(/called_at/)
  })

  it('adds started_at TIMESTAMPTZ column (RES-03 treatment start)', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).toMatch(/started_at/)
  })

  it('adds finished_at TIMESTAMPTZ column (RES-03 treatment end)', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).toMatch(/finished_at/)
  })
})

// ─── Phase 11: _appointments_realtime.sql (RES-03) ───────────────────────────

describe('Phase 11 migration — appointments realtime publication (RES-03)', () => {
  it('ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments', () => {
    const sql = MM('_appointments_realtime.sql')
    expect(sql).toMatch(/ALTER PUBLICATION supabase_realtime ADD TABLE public\.appointments/)
  })
})

// ─── Phase 11: proxy.ts public route for /painel (RES-03) ────────────────────

describe('Phase 11 — proxy.ts isPublicRoute includes /painel (RES-03)', () => {
  it('proxy.ts references /painel as a public route (TV display panel)', () => {
    const src = SRC('src/proxy.ts')
    expect(src).toMatch(/\/painel/)
  })
})
