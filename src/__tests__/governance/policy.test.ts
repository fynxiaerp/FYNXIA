/**
 * Phase 10 — governance/policy.test.ts (Wave 0 RED scaffold)
 *
 * Covers:
 * - AIG-01: computePolicyDecision matrix (L0–L4 × action sensitivity) — PURE unit
 * - AIG-03: withAgentPolicy source-inspection (import 'server-only', ai_decision_log insert,
 *           createAdminClient, reads ai_agent_config)
 * - T-10-03: governance bypass prevention (server-only guard)
 *
 * Convention (mirrors connectors.test.ts):
 * - vi.mock('server-only', () => ({})) for ESM mock
 * - SRC(relPath) reads source file, returns '' if missing (RED on content, not ENOENT)
 * - Dynamic import with existsSync guard for the computePolicyDecision unit tests
 *   (avoids TS2307 on missing module — stays tsc-clean until Plan 03 creates the file)
 *
 * Tests marked "RED by design" fail until Plan 03 creates src/lib/ai/policy.ts.
 * The PURE unit assertions for computePolicyDecision will be GREEN the moment
 * the file is created with the decision matrix.
 *
 * Phase: 10-ia-governada-l0-l4-auditoria-ocr / Plan 01 (Wave 0 RED scaffold)
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Mock server-only so modules with 'import server-only' can be inspected
vi.mock('server-only', () => ({}))

// ─── SRC helper (mirrors connectors.test.ts) ─────────────────────────────────

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

// ─── AIG-01: computePolicyDecision PURE unit tests ───────────────────────────
// Decision matrix (from RESEARCH.md Pattern 1):
// L0 → 'suggest' (regardless of sensitivity)
// L1 + 'safe' → 'execute'; L1 + 'sensitive'|'reversible' → 'suggest'
// L2 + 'reversible'|'safe' → 'execute'; L2 + 'sensitive' → 'pending_approval'
// L3 + 'sensitive' → 'pending_approval'; L3 + others → 'execute'
// L4 + anything → 'execute'
// unknown level → 'block'

describe('computePolicyDecision — L0–L4 decision matrix (AIG-01)', () => {
  // Dynamic import with existsSync guard: tsc stays clean even when file is absent.
  // These tests will fail (RED by design) until Plan 03 creates src/lib/ai/policy.ts.
  // D-144: use absolute path resolve to avoid tsconfig @-alias resolution on missing file.

  async function importComputePolicyDecision() {
    const p = resolve(process.cwd(), 'src/lib/ai/policy.ts')
    if (!existsSync(p)) {
      return null
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ p) as any
    return mod.computePolicyDecision as (
      level: string,
      sensitivity: 'safe' | 'reversible' | 'sensitive',
    ) => string
  }

  it('L0 → suggest (read-only tools log but suggest — AIG-01)', async () => {
    const fn = await importComputePolicyDecision()
    if (!fn) expect.fail('src/lib/ai/policy.ts does not exist yet — Plan 03 target')
    expect(fn('L0', 'safe')).toBe('suggest')
    expect(fn('L0', 'reversible')).toBe('suggest')
    expect(fn('L0', 'sensitive')).toBe('suggest')
  })

  it('L1 + safe → execute', async () => {
    const fn = await importComputePolicyDecision()
    if (!fn) expect.fail('src/lib/ai/policy.ts does not exist yet — Plan 03 target')
    expect(fn('L1', 'safe')).toBe('execute')
  })

  it('L1 + sensitive → suggest (L1 does not execute sensitive actions)', async () => {
    const fn = await importComputePolicyDecision()
    if (!fn) expect.fail('src/lib/ai/policy.ts does not exist yet — Plan 03 target')
    expect(fn('L1', 'sensitive')).toBe('suggest')
  })

  it('L2 + reversible → execute', async () => {
    const fn = await importComputePolicyDecision()
    if (!fn) expect.fail('src/lib/ai/policy.ts does not exist yet — Plan 03 target')
    expect(fn('L2', 'reversible')).toBe('execute')
  })

  it('L2 + sensitive → pending_approval (AIG-02 trigger)', async () => {
    const fn = await importComputePolicyDecision()
    if (!fn) expect.fail('src/lib/ai/policy.ts does not exist yet — Plan 03 target')
    expect(fn('L2', 'sensitive')).toBe('pending_approval')
  })

  it('L3 + sensitive → pending_approval', async () => {
    const fn = await importComputePolicyDecision()
    if (!fn) expect.fail('src/lib/ai/policy.ts does not exist yet — Plan 03 target')
    expect(fn('L3', 'sensitive')).toBe('pending_approval')
  })

  it('L4 + anything → execute (L4 executes all, still logs — AIG-03)', async () => {
    const fn = await importComputePolicyDecision()
    if (!fn) expect.fail('src/lib/ai/policy.ts does not exist yet — Plan 03 target')
    expect(fn('L4', 'safe')).toBe('execute')
    expect(fn('L4', 'reversible')).toBe('execute')
    expect(fn('L4', 'sensitive')).toBe('execute')
  })

  it('unknown level → block (fail-safe default)', async () => {
    const fn = await importComputePolicyDecision()
    if (!fn) expect.fail('src/lib/ai/policy.ts does not exist yet — Plan 03 target')
    expect(fn('L99', 'safe')).toBe('block')
    expect(fn('', 'sensitive')).toBe('block')
  })
})

// ─── AIG-03/T-10-03: withAgentPolicy source-inspection ──────────────────────
// These tests are RED by design until Plan 03 creates src/lib/ai/policy.ts.

describe('src/lib/ai/policy.ts source-inspection (AIG-03, T-10-03)', () => {
  const src = SRC('src/lib/ai/policy.ts')

  it('starts with import server-only (T-10-03: governance bypass prevention)', () => {
    // server-only makes the module crash if accidentally imported in a client component
    expect(src).toMatch(/import ['"]server-only['"]/)
  })

  it('references ai_decision_log table (AIG-03: every decision logged)', () => {
    expect(src).toMatch(/ai_decision_log/)
  })

  it('uses createAdminClient (AIG-03: INSERT via admin — bypasses RLS for log writes)', () => {
    expect(src).toMatch(/createAdminClient/)
  })

  it('reads ai_agent_config table (AIG-01: level read at runtime)', () => {
    expect(src).toMatch(/ai_agent_config/)
  })

  it('exports computePolicyDecision function', () => {
    expect(src).toMatch(/export.*function computePolicyDecision|export const computePolicyDecision/)
  })

  it('exports withAgentPolicy function', () => {
    expect(src).toMatch(/export.*function withAgentPolicy|export const withAgentPolicy|export async function withAgentPolicy/)
  })
})

// ─── Regression guards: existing tool/agent files ────────────────────────────
// Assert that the tool/agent source files still reference their existing read paths.
// Plan 03 wraps them — these guards verify the wrap is additive (doesn't remove existing logic).

describe('regression guard — existing lib/ai/tools.ts (pre-wrap baseline)', () => {
  const src = SRC('src/lib/ai/tools.ts')

  it('tools.ts exists (will be wrapped by Plan 03 — not replaced)', () => {
    expect(src).not.toBe('')
  })

  it('tools.ts references tool() from ai SDK', () => {
    expect(src).toMatch(/\btool\b/)
  })
})

describe('regression guard — existing lib/agents/confirmation-agent.ts (pre-wrap baseline)', () => {
  const src = SRC('src/lib/agents/confirmation-agent.ts')

  it('confirmation-agent.ts exists', () => {
    expect(src).not.toBe('')
  })

  it('confirmation-agent.ts has a public runner function', () => {
    // The runner function (runConfirmationAgent or similar) is the wrap target in Plan 03
    expect(src).toMatch(/export.*function|export async function/)
  })
})

describe('regression guard — existing lib/agents/collection-agent.ts (pre-wrap baseline)', () => {
  const src = SRC('src/lib/agents/collection-agent.ts')

  it('collection-agent.ts exists', () => {
    expect(src).not.toBe('')
  })

  it('collection-agent.ts has a public runner function', () => {
    expect(src).toMatch(/export.*function|export async function/)
  })
})
