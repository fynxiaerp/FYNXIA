/**
 * Phase 3 — Security headers tests (SEC-06, D-11)
 * Test type: source-inspection of next.config.ts
 *
 * RED until Plan 04 Task 1 adds headers() to next.config.ts.
 * Asserts CSP, HSTS, X-Frame-Options, X-Content-Type-Options are present
 * and that Supabase WSS + Asaas sandbox domain appear in CSP connect-src.
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const NEXT_CONFIG_PATH = resolve(process.cwd(), 'next.config.ts')

describe('next.config.ts security headers (SEC-06)', () => {
  it('next.config.ts file exists', () => {
    expect(existsSync(NEXT_CONFIG_PATH)).toBe(true)
  })

  it('contains Content-Security-Policy header (D-11)', () => {
    const src = readFileSync(NEXT_CONFIG_PATH, 'utf8')
    expect(src).toMatch(/Content-Security-Policy/)
  })

  it('contains Strict-Transport-Security header (SEC-06)', () => {
    const src = readFileSync(NEXT_CONFIG_PATH, 'utf8')
    expect(src).toMatch(/Strict-Transport-Security/)
  })

  it('contains X-Frame-Options header (anti-clickjacking)', () => {
    const src = readFileSync(NEXT_CONFIG_PATH, 'utf8')
    expect(src).toMatch(/X-Frame-Options/)
  })

  it('contains X-Content-Type-Options header', () => {
    const src = readFileSync(NEXT_CONFIG_PATH, 'utf8')
    expect(src).toMatch(/X-Content-Type-Options/)
  })

  it('CSP connect-src includes wss://*.supabase.co (Supabase Realtime — Pitfall 9)', () => {
    const src = readFileSync(NEXT_CONFIG_PATH, 'utf8')
    expect(src).toMatch(/wss:\/\/\*\.supabase\.co/)
  })

  it('CSP connect-src includes api-sandbox.asaas.com (Pitfall 9)', () => {
    const src = readFileSync(NEXT_CONFIG_PATH, 'utf8')
    expect(src).toMatch(/api-sandbox\.asaas\.com/)
  })
})
