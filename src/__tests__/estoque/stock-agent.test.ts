/**
 * Phase 17 — estoque/stock-agent.test.ts (Wave 0 RED scaffold)
 *
 * Source-inspection tests for src/lib/agents/stock-agent.ts
 * RED by design until Plan 06 creates that file.
 *
 * Checks:
 * - EST-03: withAgentPolicy used for L0-L4 governance (D-15)
 * - EST-03: stock_replenishment agent key registered (D-15)
 * - EST-03: estoque_agente origem in payables insert (Pitfall 1 — CHECK constraint)
 * - EST-03: approval_requests created for human inbox (D-15)
 *
 * Convention: SRC(relPath) returns '' if file missing — RED on content, not ENOENT.
 *
 * Phase: 17-estoque-materiais / Plan 01
 * Requirements: EST-03
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('server-only', () => ({}))

// ─── SRC helper ──────────────────────────────────────────────────────────────

function SRC(relPath: string): string {
  const absPath = resolve(process.cwd(), relPath)
  try {
    return readFileSync(absPath, 'utf8')
  } catch {
    return ''
  }
}

// ─── stock-agent.ts source-inspection ────────────────────────────────────────
// RED until Plan 06 creates src/lib/agents/stock-agent.ts

describe('src/lib/agents/stock-agent.ts source-inspection (EST-03)', () => {
  const src = SRC('src/lib/agents/stock-agent.ts')

  it('imports withAgentPolicy (D-15: governance L0-L4 for replenishment agent)', () => {
    expect(src).toMatch(/withAgentPolicy/)
  })

  it("uses 'stock_replenishment' as agent_key (D-15: identifies this agent in ai_agent_config)", () => {
    expect(src).toMatch(/stock_replenishment/)
  })

  it("references 'estoque_agente' as payables.origem (Pitfall 1: CHECK constraint compliance)", () => {
    expect(src).toMatch(/estoque_agente/)
  })

  it('references approval_requests (D-15: creates human approval inbox entry before executing CP)', () => {
    expect(src).toMatch(/approval_requests/)
  })
})
