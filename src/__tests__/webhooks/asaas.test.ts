/**
 * Phase 3 — Asaas webhook handler tests (FIN-09, D-07)
 * Test type: source-inspection + existsSync guard
 *
 * RED until Plan 02 authors src/app/api/webhooks/asaas/route.ts.
 * The existsSync guard ensures tests FAIL (not skip) while the file is absent.
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROUTE_PATH = resolve(process.cwd(), 'src/app/api/webhooks/asaas/route.ts')

describe('Asaas webhook handler — route.ts (FIN-09)', () => {
  it('route file exists (fails RED until Plan 02)', () => {
    // This assertion is intentionally failing until the route is authored in Plan 02
    expect(existsSync(ROUTE_PATH)).toBe(true)
  })

  it('validates asaas-access-token header (D-07, T-3-01)', () => {
    if (!existsSync(ROUTE_PATH)) {
      // Force RED — file must exist for this assertion to be meaningful
      expect(existsSync(ROUTE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(ROUTE_PATH, 'utf8')
    expect(src).toMatch(/asaas-access-token/i)
    expect(src).toMatch(/ASAAS_WEBHOOK_SECRET/)
  })

  it('returns 401 on invalid token', () => {
    if (!existsSync(ROUTE_PATH)) {
      expect(existsSync(ROUTE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(ROUTE_PATH, 'utf8')
    expect(src).toMatch(/status:\s*401/)
  })

  it('returns 200 on valid token', () => {
    if (!existsSync(ROUTE_PATH)) {
      expect(existsSync(ROUTE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(ROUTE_PATH, 'utf8')
    expect(src).toMatch(/status:\s*200/)
  })

  it('uses nodejs runtime (not Edge — required for DB connections)', () => {
    if (!existsSync(ROUTE_PATH)) {
      expect(existsSync(ROUTE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(ROUTE_PATH, 'utf8')
    expect(src).toMatch(/runtime\s*=\s*['"]nodejs['"]/)
  })

  it('deduplicates events via asaas_event_id (onConflict upsert)', () => {
    if (!existsSync(ROUTE_PATH)) {
      expect(existsSync(ROUTE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(ROUTE_PATH, 'utf8')
    // Must use onConflict / ignoreDuplicates pattern for idempotency
    expect(src).toMatch(/onConflict|ignoreDuplicates|asaas_event_id/)
  })
})
