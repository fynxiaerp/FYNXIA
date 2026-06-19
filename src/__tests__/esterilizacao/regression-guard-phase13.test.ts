/**
 * Phase 13 — regression-guard-phase13.test.ts
 * Regression guard: asserts no Phase 13 migration touches the appointments GIST,
 * financial_transactions schema, or any critical existing structure.
 *
 * ALWAYS runs (even with 0 Phase 13 files) — empty string passes all not.toContain checks.
 * Mirrors the regression block in migrations-phase12-rx.test.ts.
 *
 * Critical invariants (must never be broken by any Phase 13 migration):
 *   - CONSTRAINT no_overlap EXCLUDE USING GIST (appointments anti-double-booking)
 *   - ALTER TABLE public.appointments (appointments schema is frozen)
 *   - DROP TABLE public.financial_transactions
 *   - ALTER TABLE public.financial_transactions DROP (no column drops on financial core)
 *   - ALTER COLUMN status on appointments (status CHECK values are locked)
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 01 (Wave 0 RED scaffold)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { vi } from 'vitest'

vi.mock('server-only', () => ({}))

const MIG_DIR = join(process.cwd(), 'supabase/migrations')

/** Phase 13 migration files (prefix 20260619000). */
const phase13Files = readdirSync(MIG_DIR).filter(f => f.startsWith('20260619000') && f.endsWith('.sql'))

/** Concatenation of Phase 13 migrations only (empty string if none yet). */
const sql = phase13Files.map(f => readFileSync(join(MIG_DIR, f), 'utf8')).join('\n')

// ─── REGRESSION GUARD (CRITICAL — must stay GREEN always) ────────────────────

describe('REGRESSION GUARD Phase 13: no migration drops appointments GIST or alters financial_transactions', () => {
  it('no Phase 13 migration drops the no_overlap GIST constraint', () => {
    expect(sql).not.toContain('DROP CONSTRAINT no_overlap')
  })

  it('no Phase 13 migration alters the appointments table', () => {
    expect(sql).not.toContain('ALTER TABLE public.appointments')
  })

  it('no Phase 13 migration drops the financial_transactions table', () => {
    expect(sql).not.toContain('DROP TABLE public.financial_transactions')
  })

  it('no Phase 13 migration drops a column from financial_transactions', () => {
    expect(sql).not.toContain('ALTER TABLE public.financial_transactions DROP')
  })

  it('no Phase 13 migration alters appointments.status column type', () => {
    expect(sql).not.toContain('ALTER COLUMN status')
  })
})
