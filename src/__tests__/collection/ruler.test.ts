/**
 * Phase 3 — collection ruler tests (FIN-07, D-09, D-10)
 * Test type: source-inspection via existsSync + readFileSync
 *
 * RED until Plan 04 authors:
 *   - src/actions/collection-ruler.ts
 *   - src/app/api/cron/collection-ruler/route.ts
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RULER_ACTION_PATH = resolve(process.cwd(), 'src/actions/collection-ruler.ts')
const CRON_ROUTE_PATH = resolve(process.cwd(), 'src/app/api/cron/collection-ruler/route.ts')

describe('collection-ruler Server Action — src/actions/collection-ruler.ts (FIN-07)', () => {
  it('file exists (fails RED until Plan 04)', () => {
    expect(existsSync(RULER_ACTION_PATH)).toBe(true)
  })

  it('references collection_log table for idempotency (D-10)', () => {
    if (!existsSync(RULER_ACTION_PATH)) {
      expect(existsSync(RULER_ACTION_PATH)).toBe(true)
      return
    }
    const src = readFileSync(RULER_ACTION_PATH, 'utf8')
    expect(src).toMatch(/collection_log/)
  })

  it('references milestone for per-(receivable+milestone) idempotency (D-10)', () => {
    if (!existsSync(RULER_ACTION_PATH)) {
      expect(existsSync(RULER_ACTION_PATH)).toBe(true)
      return
    }
    const src = readFileSync(RULER_ACTION_PATH, 'utf8')
    expect(src).toMatch(/milestone/)
  })
})

describe('collection-ruler Cron endpoint — src/app/api/cron/collection-ruler/route.ts (D-09)', () => {
  it('file exists (fails RED until Plan 04)', () => {
    expect(existsSync(CRON_ROUTE_PATH)).toBe(true)
  })

  it('validates CRON_SECRET bearer token (Pitfall 6)', () => {
    if (!existsSync(CRON_ROUTE_PATH)) {
      expect(existsSync(CRON_ROUTE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CRON_ROUTE_PATH, 'utf8')
    expect(src).toMatch(/CRON_SECRET/)
  })

  it('uses nodejs runtime (not Edge — FIN-08/Pitfall 7)', () => {
    if (!existsSync(CRON_ROUTE_PATH)) {
      expect(existsSync(CRON_ROUTE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CRON_ROUTE_PATH, 'utf8')
    expect(src).toMatch(/runtime\s*=\s*['"]nodejs['"]/)
  })

  it('inserts into collection_log for idempotent milestone tracking', () => {
    if (!existsSync(CRON_ROUTE_PATH)) {
      expect(existsSync(CRON_ROUTE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CRON_ROUTE_PATH, 'utf8')
    expect(src).toMatch(/collection_log/)
  })
})
