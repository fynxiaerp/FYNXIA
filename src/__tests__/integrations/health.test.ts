/**
 * Phase 9 — INT-03 RED scaffold: deriveHealth unit + drainIntegrationEvents CAS + cron route
 *
 * Asserts artifacts that Plans 02-04 will create. Tests are RED now:
 *  - src/lib/integrations/health.ts (deriveHealth) does not exist
 *  - src/lib/integrations/worker.ts (drainIntegrationEvents) does not exist
 *  - src/app/api/cron/integration-retry/route.ts does not exist
 *  - vercel.json integration-retry cron entry does not exist
 *
 * deriveHealth unit tests will be GREEN once health.ts is created (Plan 02).
 *
 * Source-inspection convention: M(suffix) for migrations, SRC(relPath) for source files.
 * Both helpers are identical to connectors.test.ts and phase8.test.ts.
 *
 * Phase: 09-hub-de-integra-es-externas / Plan 01 (Wave 0 RED scaffold)
 * INT-03: health derivation + retry worker CAS + cron route
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations')

/** Read a migration file by suffix match (ignores timestamp prefix). Mirrors phase8.test.ts. */
function M(suffix: string): string {
  const files = readdirSync(MIGRATIONS_DIR)
  const match = files.find(f => f.endsWith(suffix))
  if (!match) {
    throw new Error(`Migration file ending with '${suffix}' not found in supabase/migrations/`)
  }
  return readFileSync(join(MIGRATIONS_DIR, match), 'utf8')
}

/**
 * Read a source file by relative path from process.cwd().
 * Returns '' (empty string) if missing — assertion fails on content, not on ENOENT.
 */
function SRC(relPath: string): string {
  const absPath = resolve(process.cwd(), relPath)
  try {
    return readFileSync(absPath, 'utf8')
  } catch {
    return ''
  }
}

// ─── Event fixture builder ────────────────────────────────────────────────────
// Builds minimal IntegrationEventRow-compatible objects for deriveHealth tests.
// status and created_at are the only fields deriveHealth needs.

type EventFixture = {
  status: 'received' | 'pending' | 'processed' | 'failed'
  created_at: string
}

function makeEvent(
  status: EventFixture['status'],
  offsetMs = 0
): EventFixture {
  return {
    status,
    created_at: new Date(Date.now() - offsetMs).toISOString(),
  }
}

const ONE_HOUR_MS  = 60 * 60 * 1000
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS
const TWENTY_FIVE_HOURS_MS = 25 * ONE_HOUR_MS

// ─── INT-03: deriveHealth unit tests ─────────────────────────────────────────
// These tests will be RED until src/lib/integrations/health.ts is created (Plan 02).
// Plan 02 MUST export: function deriveHealth(recentEvents): 'ok' | 'degraded' | 'failed' | 'unknown'
//
// Health rules (from 09-RESEARCH.md Pattern 4):
//   [] → 'unknown'
//   0 failed in last 24h → 'ok'
//   failed/total >= 0.5 in last 24h → 'failed'
//   else → 'degraded'
//   Events older than 24h are excluded from the window.

describe('deriveHealth unit tests (INT-03)', () => {
  // Dynamic import to avoid static import failure when health.ts doesn't exist
  let deriveHealth: ((events: EventFixture[]) => string) | undefined

  beforeAll(async () => {
    const healthPath = resolve(process.cwd(), 'src/lib/integrations/health.ts')
    if (!existsSync(healthPath)) {
      // File not created yet — tests will fail with expect.fail() below
      deriveHealth = undefined
      return
    }
    // health.ts does not import server-only (pure derivation util), so no mock needed
    // Use absolute path import to stay tsc-clean when module does not yet exist
    // (the @-alias causes TS2307 on missing files)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ healthPath) as any
    deriveHealth = mod.deriveHealth as typeof deriveHealth
  })

  function getHealth(events: EventFixture[]): string {
    if (!deriveHealth) {
      throw new Error('src/lib/integrations/health.ts does not exist yet — Plan 02 target')
    }
    return deriveHealth(events)
  }

  it('returns "unknown" for empty event array', () => {
    expect(getHealth([])).toBe('unknown')
  })

  it('returns "ok" when all recent events (last 24h) are processed (0 failed)', () => {
    const events = [
      makeEvent('processed', ONE_HOUR_MS),
      makeEvent('processed', 2 * ONE_HOUR_MS),
      makeEvent('processed', 3 * ONE_HOUR_MS),
    ]
    expect(getHealth(events)).toBe('ok')
  })

  it('returns "ok" when no events in last 24h have failed (received/pending count as non-failed)', () => {
    const events = [
      makeEvent('received', ONE_HOUR_MS),
      makeEvent('pending', 2 * ONE_HOUR_MS),
    ]
    expect(getHealth(events)).toBe('ok')
  })

  it('returns "failed" when 2 of 2 recent events are failed (100% failure rate)', () => {
    const events = [
      makeEvent('failed', ONE_HOUR_MS),
      makeEvent('failed', 2 * ONE_HOUR_MS),
    ]
    expect(getHealth(events)).toBe('failed')
  })

  it('returns "failed" when failed/total >= 0.5 in last 24h (exactly 50%)', () => {
    const events = [
      makeEvent('failed', ONE_HOUR_MS),
      makeEvent('processed', 2 * ONE_HOUR_MS),
    ]
    // 1 failed of 2 = 50% — threshold is >= 0.5 → 'failed'
    expect(getHealth(events)).toBe('failed')
  })

  it('returns "degraded" when 1 of 4 recent events are failed (25% failure rate)', () => {
    const events = [
      makeEvent('failed', ONE_HOUR_MS),
      makeEvent('processed', 2 * ONE_HOUR_MS),
      makeEvent('processed', 3 * ONE_HOUR_MS),
      makeEvent('processed', 4 * ONE_HOUR_MS),
    ]
    // 1 failed of 4 = 25% < 0.5 threshold → 'degraded'
    expect(getHealth(events)).toBe('degraded')
  })

  it('excludes events older than 24h from the health window', () => {
    const events = [
      // Old failed event (25h ago) — must be excluded from the 24h window
      makeEvent('failed', TWENTY_FIVE_HOURS_MS),
      // Recent success (1h ago) — inside the window
      makeEvent('processed', ONE_HOUR_MS),
    ]
    // If old events were included: 1 failed of 2 = 50% → 'failed'
    // If old events are excluded: 0 failed of 1 → 'ok'
    expect(getHealth(events)).toBe('ok')
  })

  it('returns "unknown" when all events are outside the 24h window', () => {
    const events = [
      // All old events — all outside the 24h window
      makeEvent('processed', TWENTY_FIVE_HOURS_MS),
      makeEvent('failed', TWENTY_FIVE_HOURS_MS),
    ]
    // 0 events in last 24h → same as empty array → 'unknown'
    expect(getHealth(events)).toBe('unknown')
  })
})

// ─── INT-03: drainIntegrationEvents source-inspection ────────────────────────

describe('Phase 9 worker — drainIntegrationEvents (INT-03 CAS retry)', () => {
  const workerSrc = SRC('src/lib/integrations/worker.ts')

  it('exports async function drainIntegrationEvents', () => {
    expect(workerSrc).toMatch(/export async function drainIntegrationEvents/)
  })

  it('imports server-only', () => {
    expect(workerSrc).toMatch(/import 'server-only'/)
  })

  it('selects only pending rows (.eq("status", "pending") on fetch)', () => {
    expect(workerSrc).toMatch(/\.eq\('status', 'pending'\)/)
  })

  it('atomic claim: CAS on attempts (.eq("attempts", ...))', () => {
    // The CAS pattern requires .eq('attempts', row.attempts) in the UPDATE
    // to prevent two concurrent drains from double-claiming the same row
    expect(workerSrc).toMatch(/\.eq\('attempts'/)
  })

  it('atomic claim: also checks .eq("status", "pending") in update', () => {
    // The update that claims the row must also check status=pending
    // to prevent claiming a row already claimed by another drain
    const stmts = workerSrc.split(';')
    const updateStmts = stmts.filter(s => /\.update\(/.test(s))
    const hasClaimGuard = updateStmts.some(
      s => /\.eq\('status', 'pending'\)/.test(s) && /\.eq\('attempts'/.test(s)
    )
    expect(hasClaimGuard).toBe(true)
  })

  it('does NOT re-process already-processed rows (no .eq("status", "processed") in fetch)', () => {
    // The fetch for pending rows must not include processed rows
    // Split on lines to inspect only the select/fetch statement
    const lines = workerSrc.split('\n')
    const fetchLines = lines
      .filter(l => /\.from\('integration_events'\)/.test(l) || /\.eq\('status'/.test(l))
      .join('\n')
    // Should not have a fetch looking for 'processed' status
    expect(fetchLines).not.toMatch(/\.eq\('status', 'processed'\)/)
  })
})

// ─── INT-03: cron route source-inspection ────────────────────────────────────

describe('Phase 9 cron route — integration-retry (INT-03)', () => {
  const cronSrc = SRC('src/app/api/cron/integration-retry/route.ts')

  it('declares export const runtime = "nodejs"', () => {
    expect(cronSrc).toMatch(/export const runtime = 'nodejs'/)
  })

  it('calls isCronAuthorized() for fail-closed auth', () => {
    expect(cronSrc).toMatch(/isCronAuthorized\(/)
  })

  it('calls drainIntegrationEvents()', () => {
    expect(cronSrc).toMatch(/drainIntegrationEvents\(/)
  })

  it('returns status 401 when unauthorized (fail-closed)', () => {
    expect(cronSrc).toMatch(/status: 401/)
  })
})

// ─── INT-03: vercel.json — integration-retry cron entry ──────────────────────

describe('vercel.json — integration-retry cron schedule (INT-03)', () => {
  it('vercel.json contains integration-retry path', () => {
    const vercelJson = SRC('vercel.json')
    expect(vercelJson).toMatch(/integration-retry/)
  })

  it('vercel.json contains a cron schedule string for integration-retry', () => {
    const vercelJson = SRC('vercel.json')
    // Must have a schedule string (cron expression) paired with integration-retry path
    // The schedule pattern is any cron expression string
    const obj = JSON.parse(vercelJson || '{}') as {
      crons?: Array<{ path: string; schedule: string }>
    }
    const retryEntry = obj.crons?.find(c => c.path?.includes('integration-retry'))
    expect(retryEntry).toBeDefined()
    expect(typeof retryEntry?.schedule).toBe('string')
  })
})
