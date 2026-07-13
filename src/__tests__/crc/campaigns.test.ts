/**
 * Phase 18 — crc/campaigns.test.ts (Wave 1 RED scaffold)
 *
 * Source-inspection tests for src/actions/campaigns.ts and
 * src/lib/agents/campaign-agent.ts. RED by design until later Phase 18
 * plans create those files.
 *
 * Checks (src/actions/campaigns.ts):
 * - CRC-03: 'use server' directive present
 * - CRC-03/D-09: submitCampaignForApproval exported (L2 human-approval gate)
 * - CRC-03/D-09: createApprovalRequest referenced (Phase 10 alçada reuse)
 * - CRC-03/D-09: 'crc-campaign' agent_key discriminator present (Pitfall 1)
 * - CRC-03/Pitfall 2: approveCampaignAndDispatch exported (dedicated wrapper —
 *   approveRequest alone never executes the payload)
 * - CRC-03/Pitfall 2: approveRequest referenced (called inside the wrapper)
 *
 * Checks (src/lib/agents/campaign-agent.ts):
 * - CRC-03/D-09: buildCampaignMessage exported (mirrors buildCollectionMessage)
 * - CRC-03/D-09: withAgentPolicy referenced (L0-L4 governance gate)
 * - CRC-03/D-09: zeroDataRetention referenced (ZDR/LGPD — minimal data to LLM)
 *
 * Convention: SRC(relPath) returns '' if file missing — RED on content, not ENOENT.
 *
 * Phase: 18-crc-marketing / Plan 01
 * Requirements: CRC-03
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

// ─── campaigns.ts source-inspection ──────────────────────────────────────────
// RED until a downstream Phase 18 plan creates src/actions/campaigns.ts

describe('src/actions/campaigns.ts source-inspection (CRC-03)', () => {
  const src = SRC('src/actions/campaigns.ts')

  it("has 'use server' directive (required for Server Actions)", () => {
    expect(src).toMatch(/'use server'/)
  })

  it('exports submitCampaignForApproval (D-09: L2 human-approval gate)', () => {
    expect(src).toMatch(/submitCampaignForApproval/)
  })

  it('references createApprovalRequest (Phase 10 alçada reuse)', () => {
    expect(src).toMatch(/createApprovalRequest/)
  })

  it("uses 'crc-campaign' as the agent_key discriminator (Pitfall 1)", () => {
    expect(src).toMatch(/crc-campaign/)
  })

  it('exports approveCampaignAndDispatch (Pitfall 2: dedicated execution wrapper)', () => {
    expect(src).toMatch(/approveCampaignAndDispatch/)
  })

  it('references approveRequest (called inside the dispatch wrapper)', () => {
    expect(src).toMatch(/approveRequest/)
  })
})

// ─── campaign-agent.ts source-inspection ─────────────────────────────────────
// RED until a downstream Phase 18 plan creates src/lib/agents/campaign-agent.ts

describe('src/lib/agents/campaign-agent.ts source-inspection (CRC-03, D-09)', () => {
  const src = SRC('src/lib/agents/campaign-agent.ts')

  it('exports buildCampaignMessage (mirrors buildCollectionMessage)', () => {
    expect(src).toMatch(/buildCampaignMessage/)
  })

  it('references withAgentPolicy (L0-L4 governance gate)', () => {
    expect(src).toMatch(/withAgentPolicy/)
  })

  it('references zeroDataRetention (ZDR/LGPD — minimal data to LLM)', () => {
    expect(src).toMatch(/zeroDataRetention/)
  })
})
