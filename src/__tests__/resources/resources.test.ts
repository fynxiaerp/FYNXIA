/**
 * Phase 11 — resources schema + isResourceAvailable pure-unit + booking source-inspection (RES-01/RES-02)
 *
 * Migration source-inspection via MM():
 *   - _resources.sql: columns, tipo/status CHECK, indexes (RES-01)
 *   - _resources_rls.sql: RLS policies (Access Control)
 *   - _appointment_resource_checkin.sql: resource_id FK, no GIST drop (RES-02)
 *
 * Pure-unit on isResourceAvailable (absolute-path + existsSync guard):
 *   - 'ativo' → true; 'manutencao' → false; 'inativo' → false; null/undefined → false
 *
 * Source-inspection:
 *   - src/actions/appointments.ts: resource status check + rejection message (RES-02)
 *   - src/actions/resources.ts: assertNotReadOnly + logBusinessEvent (RES-01 Access Control)
 *
 * All new-artifact assertions are RED until Plans 02/03/04 create the target files.
 * ES2017 gotcha: never use /s (dotAll) flag.
 * D-144 gotcha: use resolve(process.cwd(), …) NOT @-alias for dynamic imports.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { vi } from 'vitest'

vi.mock('server-only', () => ({}))

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations')

/**
 * MM(suffix): returns '' when migration file is absent — fail on content, not crash.
 */
function MM(suffix: string): string {
  const files = readdirSync(MIGRATIONS_DIR)
  const match = files.find(f => f.endsWith(suffix))
  return match ? readFileSync(join(MIGRATIONS_DIR, match), 'utf8') : ''
}

/**
 * SRC(rel): read source file, returns '' when missing.
 */
function SRC(rel: string): string {
  const p = resolve(process.cwd(), rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

// ─── RES-01: _resources.sql migration source-inspection ──────────────────────

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

  it('has patrimonio column (asset tag)', () => {
    const sql = MM('_resources.sql')
    expect(sql).toMatch(/patrimonio/)
  })

  it('has numero_serie column (serial number)', () => {
    const sql = MM('_resources.sql')
    expect(sql).toMatch(/numero_serie/)
  })

  it('has status CHECK IN ativo, manutencao, inativo', () => {
    const sql = MM('_resources.sql')
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

// ─── Access Control: _resources_rls.sql ──────────────────────────────────────

describe('Phase 11 migration — resources RLS (Access Control)', () => {
  it('enables RLS on resources', () => {
    const sql = MM('_resources_rls.sql')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
  })

  it('SELECT policy uses clinic_id = get_my_tenant_id()', () => {
    const sql = MM('_resources_rls.sql')
    expect(sql).toMatch(/FOR SELECT/)
    expect(sql).toMatch(/clinic_id = get_my_tenant_id\(\)/)
  })

  it('write policy has USING clause (T-11-03)', () => {
    const sql = MM('_resources_rls.sql')
    expect(sql).toMatch(/USING\s*\(/)
  })

  it('write policy has WITH CHECK clause', () => {
    const sql = MM('_resources_rls.sql')
    expect(sql).toMatch(/WITH CHECK/)
  })

  it('write policy role gate includes admin', () => {
    const sql = MM('_resources_rls.sql')
    expect(sql).toMatch(/'admin'/)
  })

  it('write policy role gate includes superadmin', () => {
    const sql = MM('_resources_rls.sql')
    expect(sql).toMatch(/'superadmin'/)
  })
})

// ─── RES-02: _appointment_resource_checkin.sql — resource_id FK ───────────────

describe('Phase 11 migration — appointment resource_id FK (RES-02)', () => {
  it('ALTER TABLE appointments adds resource_id UUID REFERENCES public.resources', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).toMatch(/ALTER TABLE public\.appointments/)
    expect(sql).toMatch(/resource_id/)
    expect(sql).toMatch(/REFERENCES public\.resources/)
  })

  it('adds idx_appointments_resource_id index', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).toMatch(/idx_appointments_resource_id/)
  })

  it('does NOT drop no_overlap GIST constraint (resource check is app-level only — RES-02)', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).not.toMatch(/DROP CONSTRAINT no_overlap/i)
  })
})

// ─── RES-01/RES-02: isResourceAvailable pure-unit ────────────────────────────

describe('Phase 11 — isResourceAvailable pure-unit (RES-01/RES-02)', () => {
  const resourcesPath = resolve(process.cwd(), 'src/lib/scheduling/resources.ts')

  it("status 'ativo' returns true (resource available)", async () => {
    if (!existsSync(resourcesPath)) {
      expect.fail('src/lib/scheduling/resources.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ resourcesPath) as any
    const fn = mod.isResourceAvailable
    if (!fn) {
      expect.fail('isResourceAvailable not exported from resources.ts')
    }
    expect(fn('ativo')).toBe(true)
  })

  it("status 'manutencao' returns false (T-11-04 — maintenance blocks booking)", async () => {
    if (!existsSync(resourcesPath)) {
      expect.fail('src/lib/scheduling/resources.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ resourcesPath) as any
    const fn = mod.isResourceAvailable
    if (!fn) {
      expect.fail('isResourceAvailable not exported from resources.ts')
    }
    expect(fn('manutencao')).toBe(false)
  })

  it("status 'inativo' returns false", async () => {
    if (!existsSync(resourcesPath)) {
      expect.fail('src/lib/scheduling/resources.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ resourcesPath) as any
    const fn = mod.isResourceAvailable
    if (!fn) {
      expect.fail('isResourceAvailable not exported from resources.ts')
    }
    expect(fn('inativo')).toBe(false)
  })

  it('null returns false (no resource selected)', async () => {
    if (!existsSync(resourcesPath)) {
      expect.fail('src/lib/scheduling/resources.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ resourcesPath) as any
    const fn = mod.isResourceAvailable
    if (!fn) {
      expect.fail('isResourceAvailable not exported from resources.ts')
    }
    expect(fn(null)).toBe(false)
  })

  it('undefined returns false (missing resource)', async () => {
    if (!existsSync(resourcesPath)) {
      expect.fail('src/lib/scheduling/resources.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ resourcesPath) as any
    const fn = mod.isResourceAvailable
    if (!fn) {
      expect.fail('isResourceAvailable not exported from resources.ts')
    }
    expect(fn(undefined)).toBe(false)
  })
})

// ─── RES-02: appointments.ts resource status check source-inspection ──────────

describe('Phase 11 — appointments.ts resource blocking (RES-02)', () => {
  const actionSrc = SRC('src/actions/appointments.ts')

  it('references resource status check (manutenção/indisponível rejection)', () => {
    // RED until Plan 04 — must check resource.status before insert
    const hasMaintenance = /manutencao|manutenção|indisponível|indisponivel/.test(actionSrc)
    expect(hasMaintenance).toBe(true)
  })

  it('references resource_id in createAppointment logic', () => {
    // RED until Plan 04 — resource_id must be accepted and checked in the action
    expect(actionSrc).toMatch(/resource_id/)
  })
})

// ─── RES-01 Access Control: resources.ts action source-inspection ─────────────

describe('Phase 11 action — resources.ts (RES-01 Access Control)', () => {
  const actionSrc = SRC('src/actions/resources.ts')

  it('calls assertNotReadOnly() as write guard (T-11-03)', () => {
    expect(actionSrc).toMatch(/assertNotReadOnly\(\)/)
  })

  it('calls logBusinessEvent for audit trail', () => {
    expect(actionSrc).toMatch(/logBusinessEvent/)
  })
})
