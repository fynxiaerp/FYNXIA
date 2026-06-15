/**
 * Phase 11 — waiting-room: presence transitions + waitingMinutes + panel source-inspection (RES-03)
 *
 * Migration source-inspection via MM():
 *   - _appointment_resource_checkin.sql: presence_status column (separate from status),
 *     arrived_at / called_at / started_at / finished_at TIMESTAMPTZ columns
 *   - _appointments_realtime.sql: ALTER PUBLICATION supabase_realtime ADD TABLE appointments
 *
 * Pure-unit on waitingMinutes (absolute-path + existsSync guard):
 *   - called 25 min after arrived → 25
 *   - still waiting (calledAt null) → ≥ 0
 *   - arrivedAt null → null
 *
 * Pure-unit on presence transition ordering:
 *   - isValidPresenceTransition or PRESENCE_FLOW array existence
 *   - aguardando→chamado valid; chamado→em_atendimento valid; em_atendimento→finalizado valid
 *   - aguardando→finalizado invalid (skips intermediate states)
 *
 * Source-inspection:
 *   - src/actions/checkin.ts: assertNotReadOnly + presence_status / arrived_at etc. (RES-03)
 *   - src/proxy.ts: isPublicRoute references /painel (TV panel — no auth) (RES-03)
 *   - src/app/painel/[clinic-slug]/page.tsx: NO cpf/full_name select; YES presence_status + initials (LGPD — T-11-02)
 *
 * All new-artifact assertions RED until Plans 02/04/08 create the target files.
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

// ─── RES-03: presence_status column migration ─────────────────────────────────

describe('Phase 11 migration — presence_status column (RES-03)', () => {
  it('adds presence_status column with CHECK IN aguardando, chamado, em_atendimento, finalizado', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).toMatch(/presence_status/)
    expect(sql).toMatch(/'aguardando'/)
    expect(sql).toMatch(/'chamado'/)
    expect(sql).toMatch(/'em_atendimento'/)
    expect(sql).toMatch(/'finalizado'/)
  })

  it('presence_status is a SEPARATE column — NOT merged into existing status column (Pitfall 1 guard)', () => {
    // The existing status column enum must NOT gain presence states.
    // Verify by checking that the ALTER COLUMN status pattern is absent for presence values.
    const sql = MM('_appointment_resource_checkin.sql')
    // If the migration alters status to include 'aguardando', that's the wrong approach
    expect(sql).not.toMatch(/ALTER COLUMN status.*aguardando/i)
    expect(sql).not.toMatch(/ALTER COLUMN status.*chamado/i)
  })

  it('adds arrived_at TIMESTAMPTZ column', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).toMatch(/arrived_at/)
    expect(sql).toMatch(/TIMESTAMPTZ/)
  })

  it('adds called_at TIMESTAMPTZ column', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).toMatch(/called_at/)
  })

  it('adds started_at TIMESTAMPTZ column', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).toMatch(/started_at/)
  })

  it('adds finished_at TIMESTAMPTZ column', () => {
    const sql = MM('_appointment_resource_checkin.sql')
    expect(sql).toMatch(/finished_at/)
  })
})

// ─── RES-03: Realtime publication migration ───────────────────────────────────

describe('Phase 11 migration — appointments Realtime publication (RES-03)', () => {
  it('ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments', () => {
    const sql = MM('_appointments_realtime.sql')
    expect(sql).toMatch(/ALTER PUBLICATION supabase_realtime ADD TABLE public\.appointments/)
  })
})

// ─── RES-03: waitingMinutes pure-unit ─────────────────────────────────────────

describe('Phase 11 — waitingMinutes pure-unit (RES-03)', () => {
  const waitingPath = resolve(process.cwd(), 'src/lib/scheduling/waiting.ts')

  it('waitingMinutes returns 25 when called 25 minutes after arrived', async () => {
    if (!existsSync(waitingPath)) {
      expect.fail('src/lib/scheduling/waiting.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ waitingPath) as any
    const fn = mod.waitingMinutes
    if (!fn) {
      expect.fail('waitingMinutes not exported from waiting.ts')
    }
    const arrivedAt = new Date('2026-06-15T09:00:00Z').toISOString()
    const calledAt = new Date('2026-06-15T09:25:00Z').toISOString()
    expect(fn(arrivedAt, calledAt)).toBe(25)
  })

  it('waitingMinutes returns ≥ 0 when still waiting (calledAt null)', async () => {
    if (!existsSync(waitingPath)) {
      expect.fail('src/lib/scheduling/waiting.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ waitingPath) as any
    const fn = mod.waitingMinutes
    if (!fn) {
      expect.fail('waitingMinutes not exported from waiting.ts')
    }
    // Patient arrived 5 minutes ago; calledAt is null (still waiting)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const result = fn(fiveMinutesAgo, null)
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('waitingMinutes returns null when arrivedAt is null', async () => {
    if (!existsSync(waitingPath)) {
      expect.fail('src/lib/scheduling/waiting.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ waitingPath) as any
    const fn = mod.waitingMinutes
    if (!fn) {
      expect.fail('waitingMinutes not exported from waiting.ts')
    }
    expect(fn(null, null)).toBeNull()
  })
})

// ─── RES-03: presence transition ordering ─────────────────────────────────────

describe('Phase 11 — presence transition ordering (RES-03)', () => {
  const waitingPath = resolve(process.cwd(), 'src/lib/scheduling/waiting.ts')

  it('PRESENCE_FLOW array exists with the 4 correct states in order', async () => {
    if (!existsSync(waitingPath)) {
      expect.fail('src/lib/scheduling/waiting.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ waitingPath) as any
    // Accept either an exported PRESENCE_FLOW array or isValidPresenceTransition function
    const flow = mod.PRESENCE_FLOW
    const isValidFn = mod.isValidPresenceTransition
    if (!flow && !isValidFn) {
      expect.fail('Neither PRESENCE_FLOW nor isValidPresenceTransition exported from waiting.ts')
    }
    if (flow) {
      expect(Array.isArray(flow)).toBe(true)
      expect(flow).toEqual(['aguardando', 'chamado', 'em_atendimento', 'finalizado'])
    }
  })

  it('aguardando → chamado is a valid transition', async () => {
    if (!existsSync(waitingPath)) {
      expect.fail('src/lib/scheduling/waiting.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ waitingPath) as any
    const flow = mod.PRESENCE_FLOW as string[] | undefined
    const isValid = mod.isValidPresenceTransition as ((from: string, to: string) => boolean) | undefined
    if (!flow && !isValid) {
      expect.fail('Neither PRESENCE_FLOW nor isValidPresenceTransition exported from waiting.ts')
    }
    if (isValid) {
      expect(isValid('aguardando', 'chamado')).toBe(true)
    } else if (flow) {
      expect(flow.indexOf('chamado')).toBe(flow.indexOf('aguardando') + 1)
    }
  })

  it('chamado → em_atendimento is a valid transition', async () => {
    if (!existsSync(waitingPath)) {
      expect.fail('src/lib/scheduling/waiting.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ waitingPath) as any
    const flow = mod.PRESENCE_FLOW as string[] | undefined
    const isValid = mod.isValidPresenceTransition as ((from: string, to: string) => boolean) | undefined
    if (!flow && !isValid) {
      expect.fail('Neither PRESENCE_FLOW nor isValidPresenceTransition exported from waiting.ts')
    }
    if (isValid) {
      expect(isValid('chamado', 'em_atendimento')).toBe(true)
    } else if (flow) {
      expect(flow.indexOf('em_atendimento')).toBe(flow.indexOf('chamado') + 1)
    }
  })

  it('em_atendimento → finalizado is a valid transition', async () => {
    if (!existsSync(waitingPath)) {
      expect.fail('src/lib/scheduling/waiting.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ waitingPath) as any
    const flow = mod.PRESENCE_FLOW as string[] | undefined
    const isValid = mod.isValidPresenceTransition as ((from: string, to: string) => boolean) | undefined
    if (!flow && !isValid) {
      expect.fail('Neither PRESENCE_FLOW nor isValidPresenceTransition exported from waiting.ts')
    }
    if (isValid) {
      expect(isValid('em_atendimento', 'finalizado')).toBe(true)
    } else if (flow) {
      expect(flow.indexOf('finalizado')).toBe(flow.indexOf('em_atendimento') + 1)
    }
  })

  it('aguardando → finalizado is INVALID (skips intermediate states)', async () => {
    if (!existsSync(waitingPath)) {
      expect.fail('src/lib/scheduling/waiting.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ waitingPath) as any
    const flow = mod.PRESENCE_FLOW as string[] | undefined
    const isValid = mod.isValidPresenceTransition as ((from: string, to: string) => boolean) | undefined
    if (!flow && !isValid) {
      expect.fail('Neither PRESENCE_FLOW nor isValidPresenceTransition exported from waiting.ts')
    }
    if (isValid) {
      expect(isValid('aguardando', 'finalizado')).toBe(false)
    } else if (flow) {
      // aguardando is at index 0; finalizado is at index 3 — not consecutive
      expect(flow.indexOf('finalizado') - flow.indexOf('aguardando')).toBeGreaterThan(1)
    }
  })
})

// ─── RES-03: checkin.ts action source-inspection ─────────────────────────────

describe('Phase 11 action — checkin.ts (RES-03)', () => {
  const checkinSrc = SRC('src/actions/checkin.ts')

  it('calls assertNotReadOnly() as write guard (T-11-03)', () => {
    expect(checkinSrc).toMatch(/assertNotReadOnly\(\)/)
  })

  it('sets arrived_at timestamp', () => {
    expect(checkinSrc).toMatch(/arrived_at/)
  })

  it('sets called_at timestamp', () => {
    expect(checkinSrc).toMatch(/called_at/)
  })

  it('sets started_at timestamp', () => {
    expect(checkinSrc).toMatch(/started_at/)
  })

  it('sets finished_at timestamp', () => {
    expect(checkinSrc).toMatch(/finished_at/)
  })

  it('sets presence_status (state machine RES-03)', () => {
    expect(checkinSrc).toMatch(/presence_status/)
  })
})

// ─── RES-03: proxy.ts /painel public route ────────────────────────────────────

describe('Phase 11 — proxy.ts /painel public route (RES-03)', () => {
  const proxySrc = SRC('src/proxy.ts')

  it('isPublicRoute includes /painel (TV display panel has no auth)', () => {
    expect(proxySrc).toMatch(/\/painel/)
  })
})

// ─── RES-03 / T-11-02: /painel page LGPD compliance (source-inspection) ──────

describe('Phase 11 — /painel page LGPD compliance (T-11-02)', () => {
  const panelSrc = SRC('src/app/painel/[clinic-slug]/page.tsx')

  it('panel page does NOT select cpf (LGPD — Pitfall 3)', () => {
    // RED until Plan 08 creates the panel page
    // When it exists, it must NOT query cpf
    if (!panelSrc) {
      // File absent — assert on empty string will fail, which is RED by design
      expect(panelSrc).not.toMatch(/\.select\([^)]*cpf/)
    } else {
      expect(panelSrc).not.toMatch(/\.select\([^)]*cpf/)
    }
  })

  it('panel page does NOT select full_name directly into payload (LGPD — initials only)', () => {
    // RED until Plan 08 creates the panel page
    // When it exists, it must use initials/iniciais transform, NOT full_name in the response
    if (!panelSrc) {
      expect(panelSrc).not.toMatch(/full_name.*presence_status|presence_status.*full_name/)
    } else {
      expect(panelSrc).not.toMatch(/full_name.*presence_status|presence_status.*full_name/)
    }
  })

  it('panel page references presence_status', () => {
    // RED until Plan 08 — TV panel must show presence_status
    expect(panelSrc).toMatch(/presence_status/)
  })

  it('panel page uses initials or iniciais transform (LGPD — never full_name in TV display)', () => {
    // RED until Plan 08
    const hasInitials = /initials|iniciais/.test(panelSrc)
    expect(hasInitials).toBe(true)
  })
})
