/**
 * Phase 19 — governance/bi-forecast-agent.test.ts (Wave 1 RED scaffold)
 *
 * Covers:
 * - BI-02: BI forecast agent (Plan 08) must follow the per-clinic withAgentPolicy
 *   convention established by stock-agent.ts/collection-agent.ts (never
 *   aggregate/null clinicId — 19-RESEARCH.md Pattern 4 / Anti-Pattern).
 * - D-34: agent never mutates budget_targets directly — only ever writes to
 *   approval_requests; the actual UPDATE happens on human approval
 *   (approveBudgetAdjustment, resolved in 19-RESEARCH Open Question 3).
 *
 * Convention (mirrors approvals.test.ts SRC() helper + D-144 absolute-path guard):
 * - existsSync guard on an ABSOLUTE path (no @-alias — TS2307 before the module
 *   exists).
 * - When src/lib/agents/bi-forecast-agent.ts is absent, the first test FAILS with
 *   an explicit message so this suite stays RED (not silently skipped) until
 *   Plan 08 creates the agent.
 * - Content assertions read '' when the file is missing (RED on content, not
 *   ENOENT), same as approvals.test.ts's SRC().
 *
 * Tests are RED by design until Plan 08 creates src/lib/agents/bi-forecast-agent.ts.
 *
 * Phase: 19-relat-rios-or-amento-bi / Plan 02 (Wave 1 RED scaffold)
 * Requirements: BI-02
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Absolute path (D-144: @-alias causes TS2307 when target missing) ────────

const AGENT_PATH = join(process.cwd(), 'src/lib/agents/bi-forecast-agent.ts')

function readAgentSource(): string {
  try {
    return readFileSync(AGENT_PATH, 'utf8')
  } catch {
    return ''
  }
}

describe('src/lib/agents/bi-forecast-agent.ts presence (Plan 08 target)', () => {
  it('bi-forecast-agent.ts exists', () => {
    if (!existsSync(AGENT_PATH)) {
      expect.fail('bi-forecast-agent.ts not yet created (Plan 08)')
    }
    expect(existsSync(AGENT_PATH)).toBe(true)
  })
})

describe('src/lib/agents/bi-forecast-agent.ts source-inspection (BI-02, governance)', () => {
  it('calls withAgentPolicy (per-row governance gate — mirrors stock-agent.ts)', () => {
    const src = readAgentSource()
    expect(src).toMatch(/withAgentPolicy/)
  })

  it("registers with agentKey: 'bi_forecast'", () => {
    const src = readAgentSource()
    expect(src).toMatch(/agentKey:\s*['"]bi_forecast['"]/)
  })

  it('clinicId is resolved per-row (real tenant) — never a literal null passed to withAgentPolicy', () => {
    // Anti-pattern guard: withAgentPolicy must never be called with clinicId: null
    // (ai_decision_log.clinic_id is NOT NULL — 19-RESEARCH Anti-Pattern / Pitfall 3 of 17-RESEARCH).
    const src = readAgentSource()
    expect(src).not.toMatch(/clinicId:\s*null/)
  })

  it('mutates only approval_requests — never budget_targets directly (D-34 "nunca toca... diretamente")', () => {
    const src = readAgentSource()
    expect(src).toMatch(/approval_requests/)
    expect(src).not.toMatch(/\.from\(['"]budget_targets['"]\)\s*\.update/)
  })
})
