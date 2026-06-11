/**
 * Phase 5 AI-01 — copilot Route Handler source inspection
 * RED-by-design until Plan 05-02 implements src/app/api/copilot/route.ts
 *
 * Asserts: runtime nodejs, call-time key read, model string, ZDR flag,
 * streaming API, AI SDK v6 APIs (no removed v4/v5 helpers).
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = (f: string) => join(process.cwd(), 'src', f)

describe('src/app/api/copilot/route.ts — source inspection (AI-01, D-01, D-02)', () => {
  it('route.ts file exists (created in 05-02)', () => {
    expect(
      existsSync(SRC('app/api/copilot/route.ts')),
      'src/app/api/copilot/route.ts not yet created (05-02)',
    ).toBe(true)
  })

  it('export const runtime = "nodejs" (not Edge — DB connections require TCP)', () => {
    const src = readFileSync(SRC('app/api/copilot/route.ts'), 'utf8')
    expect(src).toMatch(/export const runtime = 'nodejs'/)
  })

  it('AI_GATEWAY_API_KEY is read at call-time inside POST handler (not module scope)', () => {
    const src = readFileSync(SRC('app/api/copilot/route.ts'), 'utf8')
    // The key must appear inside the POST function body, not at module top-level
    // Check: the env read appears AFTER the 'export async function POST' declaration
    const postIndex = src.indexOf('export async function POST')
    expect(postIndex, 'POST handler not found').toBeGreaterThan(-1)
    const keyIndex = src.indexOf('process.env.AI_GATEWAY_API_KEY')
    expect(keyIndex, 'AI_GATEWAY_API_KEY not found').toBeGreaterThan(-1)
    // Key read must appear after the POST function declaration
    expect(keyIndex).toBeGreaterThan(postIndex)
  })

  it("model string is 'anthropic/claude-sonnet-4.6' (D-01 locked model)", () => {
    const src = readFileSync(SRC('app/api/copilot/route.ts'), 'utf8')
    expect(src).toMatch(/'anthropic\/claude-sonnet-4\.6'/)
  })

  it('zeroDataRetention: true is set in providerOptions (D-02 LGPD)', () => {
    const src = readFileSync(SRC('app/api/copilot/route.ts'), 'utf8')
    expect(src).toMatch(/zeroDataRetention:\s*true/)
  })

  it('uses streamText from AI SDK (AI-01 streaming)', () => {
    const src = readFileSync(SRC('app/api/copilot/route.ts'), 'utf8')
    expect(src).toMatch(/streamText/)
  })

  it('uses toUIMessageStreamResponse() (AI SDK v6 preferred method)', () => {
    const src = readFileSync(SRC('app/api/copilot/route.ts'), 'utf8')
    expect(src).toMatch(/toUIMessageStreamResponse/)
  })

  it('does NOT use removed maxSteps (AI SDK v6 — use stopWhen)', () => {
    const src = readFileSync(SRC('app/api/copilot/route.ts'), 'utf8')
    expect(src).not.toMatch(/maxSteps/)
  })

  it('does NOT use removed convertToCoreMessages (renamed to convertToModelMessages in v6)', () => {
    const src = readFileSync(SRC('app/api/copilot/route.ts'), 'utf8')
    expect(src).not.toMatch(/convertToCoreMessages/)
  })
})
