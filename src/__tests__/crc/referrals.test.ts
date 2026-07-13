/**
 * Phase 18 — crc/referrals.test.ts (Wave 1 RED scaffold)
 *
 * Source-inspection tests for src/actions/referrals.ts
 * RED by design until a later Phase 18 plan creates that file.
 *
 * Checks:
 * - CRC-05: 'use server' directive present
 * - CRC-05/D-16: linkReferral exported (registered at lead/patient cadastro)
 * - CRC-05/D-18: creditReferralReward exported (credited on lead conversion)
 * - CRC-05/D-18: credited_at referenced (CAS guard — idempotent single credit)
 * - CRC-05/D-19: listRewardsBalance exported (internal balance screen)
 *
 * Convention: SRC(relPath) returns '' if file missing — RED on content, not ENOENT.
 *
 * Phase: 18-crc-marketing / Plan 01
 * Requirements: CRC-05
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

// ─── referrals.ts source-inspection ──────────────────────────────────────────
// RED until a downstream Phase 18 plan creates src/actions/referrals.ts

describe('src/actions/referrals.ts source-inspection (CRC-05)', () => {
  const src = SRC('src/actions/referrals.ts')

  it("has 'use server' directive (required for Server Actions)", () => {
    expect(src).toMatch(/'use server'/)
  })

  it('exports linkReferral (D-16: registered at lead/patient cadastro)', () => {
    expect(src).toMatch(/linkReferral/)
  })

  it('exports creditReferralReward (D-18: credited on lead conversion)', () => {
    expect(src).toMatch(/creditReferralReward/)
  })

  it('references credited_at (D-18: CAS guard — idempotent single credit)', () => {
    expect(src).toMatch(/credited_at/)
  })

  it('exports listRewardsBalance (D-19: internal balance screen)', () => {
    expect(src).toMatch(/listRewardsBalance/)
  })
})
