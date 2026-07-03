/**
 * Phase 17 — estoque/cron-validade.test.ts (Wave 0 RED scaffold)
 *
 * Source-inspection tests for src/app/api/cron/estoque-validade/route.ts
 * RED by design until Plan 06 creates that file.
 *
 * Checks:
 * - EST-03: isCronAuthorized used (security — fail-closed auth, CLAUDE.md constraint)
 * - EST-03: nodejs runtime exported (CLAUDE.md: Edge Runtime forbidden for DB routes)
 * - EST-03: createAdminClient used (CLAUDE.md: cron must use admin client, not RLS-scoped)
 * - EST-03: data_validade referenced (D-16: queries batches by expiry date)
 *
 * Convention: SRC(relPath) returns '' if file missing — RED on content, not ENOENT.
 * Mirrors pattern of src/__tests__/governance/approvals.test.ts
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

// ─── estoque-validade/route.ts source-inspection ─────────────────────────────
// RED until Plan 06 creates src/app/api/cron/estoque-validade/route.ts

describe("src/app/api/cron/estoque-validade/route.ts source-inspection (EST-03)", () => {
  const src = SRC('src/app/api/cron/estoque-validade/route.ts')

  it("exports runtime = 'nodejs' (CLAUDE.md: Edge Runtime forbidden — Supabase TCP requires Node.js)", () => {
    expect(src).toMatch(/runtime\s*=\s*['"]nodejs['"]/)
  })

  it('calls isCronAuthorized (security: fail-closed cron auth, CLAUDE.md constraint)', () => {
    expect(src).toMatch(/isCronAuthorized/)
  })

  it('uses createAdminClient (CLAUDE.md: crons bypass RLS via service role — memory note)', () => {
    expect(src).toMatch(/createAdminClient/)
  })

  it('references data_validade (D-16: queries product_batches by expiry threshold)', () => {
    expect(src).toMatch(/data_validade/)
  })

  it("references 'estoque-validade' (route identifier in logs or vercel.json cron path)", () => {
    expect(src).toMatch(/estoque-validade/)
  })
})
