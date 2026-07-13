/**
 * Phase 18 — crc/segment.test.ts (Wave 1 RED scaffold)
 *
 * Source-inspection tests for src/lib/crc/segment.ts
 * RED by design until a later Phase 18 plan creates that file.
 *
 * Checks:
 * - CRC-03/D-08/A2: marketing_whatsapp consent gate referenced (umbrella
 *   marketing consent for both WhatsApp and e-mail channels in v1)
 * - CRC-03/D-07: previewSegment or buildInactiveSegment exported (inactive-days
 *   segment builder, not a free query builder)
 * - CRC-03/D-08: patient_consents referenced (consent table gating the send)
 * - CRC-03/D-08: revoked_at referenced (opt-out guard — only non-revoked consent counts)
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

// ─── segment.ts source-inspection ────────────────────────────────────────────
// RED until a downstream Phase 18 plan creates src/lib/crc/segment.ts

describe('src/lib/crc/segment.ts source-inspection (CRC-03)', () => {
  const src = SRC('src/lib/crc/segment.ts')

  it('references marketing_whatsapp consent gate (D-08/A2: umbrella consent for both channels)', () => {
    expect(src).toMatch(/marketing_whatsapp/)
  })

  it('exports previewSegment or buildInactiveSegment (D-07: inactive-days segment builder)', () => {
    expect(src).toMatch(/previewSegment|buildInactiveSegment/)
  })

  it('references patient_consents (D-08: consent table gating the send)', () => {
    expect(src).toMatch(/patient_consents/)
  })

  it('references revoked_at (D-08: opt-out guard — only non-revoked consent counts)', () => {
    expect(src).toMatch(/revoked_at/)
  })
})
