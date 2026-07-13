/**
 * Phase 18 — crc/nps-scan.test.ts (Wave 1 RED scaffold)
 *
 * Source-inspection tests for src/lib/crc/nps-scan.ts and
 * src/app/api/cron/nps-scan/route.ts. RED by design until later Phase 18
 * plans create those files.
 *
 * Checks (src/lib/crc/nps-scan.ts):
 * - CRC-04/D-12: 'concluido' referenced (scans appointments in this status)
 * - CRC-04/D-13: nps_responses referenced (invite row + token per appointment)
 * - CRC-04/Pitfall 5: self-healing dedup marker present (NOT EXISTS / already-invited
 *   guard) — no date-window/expression-index dedup (avoids the Phase 17 42P17 trap)
 *
 * Checks (src/app/api/cron/nps-scan/route.ts):
 * - D-12: isCronAuthorized referenced (CRON_SECRET auth)
 * - D-12: drainOutbox referenced (mirrors collection-agent cron structure)
 * - D-12: nodejs runtime declared (not Edge — Supabase needs TCP)
 *
 * Convention: SRC(relPath) returns '' if file missing — RED on content, not ENOENT.
 *
 * Phase: 18-crc-marketing / Plan 01
 * Requirements: CRC-04
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

// ─── nps-scan.ts source-inspection ───────────────────────────────────────────
// RED until a downstream Phase 18 plan creates src/lib/crc/nps-scan.ts

describe('src/lib/crc/nps-scan.ts source-inspection (CRC-04)', () => {
  const src = SRC('src/lib/crc/nps-scan.ts')

  it("references 'concluido' (D-12: scans completed appointments)", () => {
    expect(src).toMatch(/concluido/)
  })

  it('references nps_responses (D-13: invite row + single-use token per appointment)', () => {
    expect(src).toMatch(/nps_responses/)
  })

  it('has a self-healing dedup marker (Pitfall 5: NOT EXISTS / already-invited guard)', () => {
    expect(src).toMatch(/NOT EXISTS|not.*exists|already/i)
  })
})

// ─── cron/nps-scan/route.ts source-inspection ────────────────────────────────
// RED until a downstream Phase 18 plan creates src/app/api/cron/nps-scan/route.ts

describe('src/app/api/cron/nps-scan/route.ts source-inspection (CRC-04, D-12)', () => {
  const src = SRC('src/app/api/cron/nps-scan/route.ts')

  it('references isCronAuthorized (CRON_SECRET auth)', () => {
    expect(src).toMatch(/isCronAuthorized/)
  })

  it('references drainOutbox (mirrors collection-agent cron structure)', () => {
    expect(src).toMatch(/drainOutbox/)
  })

  it('declares nodejs runtime (not Edge — Supabase needs TCP)', () => {
    expect(src).toMatch(/runtime.*nodejs/)
  })
})
