/**
 * Phase 10 — ocr/extract.test.ts (Wave 0 RED scaffold)
 *
 * Covers:
 * - OCR-01: /api/ocr/route.ts uses generateObject, FilePart, zeroDataRetention=true (ZDR — LGPD)
 * - OCR-02: confidence threshold gating — fields below threshold → ocr_extractions 'pending_review'
 * - OCR-02: needsReview PURE unit (from src/lib/ai/ocr-confidence.ts)
 * - T-10-02: PII protection — ZDR present in OCR route; maskCPF referenced before logging
 *
 * Convention (mirrors connectors.test.ts):
 * - vi.mock('server-only', () => ({})) for ESM mock
 * - SRC(relPath) returns '' if file missing (RED on content, not ENOENT)
 * - Dynamic import with existsSync guard for needsReview PURE unit tests
 *   The route itself is NOT imported (imports 'ai', 'server-only' — too many deps).
 *   The route MUST delegate threshold logic to the pure helper needsReview()
 *   in src/lib/ai/ocr-confidence.ts so this test can unit-test it directly.
 *
 * Tests marked "RED by design" fail until Plan 05 creates:
 * - src/lib/ai/ocr-confidence.ts (needsReview pure helper)
 * - src/app/api/ocr/route.ts (OCR API route)
 *
 * Phase: 10-ia-governada-l0-l4-auditoria-ocr / Plan 01 (Wave 0 RED scaffold)
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Mock server-only so source modules can be inspected if needed
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

// ─── OCR-02: needsReview PURE unit tests ─────────────────────────────────────
// The OCR route delegates threshold logic to a pure helper in ocr-confidence.ts
// so this test can run without importing the route (which depends on 'ai', Supabase, etc.)
// RED by design until Plan 05 creates src/lib/ai/ocr-confidence.ts.

describe('needsReview — confidence threshold gating PURE unit (OCR-02)', () => {
  // D-144: use absolute path resolve to avoid tsconfig @-alias on missing file
  async function importNeedsReview() {
    const p = resolve(process.cwd(), 'src/lib/ai/ocr-confidence.ts')
    if (!existsSync(p)) {
      return null
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ p) as any
    return typeof mod.needsReview === 'function'
      ? mod.needsReview as (fields: Record<string, { confidence: number }>, threshold?: number) => boolean
      : null
  }

  it('all fields with confidence >= 0.80 → needsReview is false (OCR-02)', async () => {
    const fn = await importNeedsReview()
    if (!fn) expect.fail('src/lib/ai/ocr-confidence.ts does not exist yet — Plan 05 target')
    const fields = {
      full_name: { confidence: 0.95 },
      cpf: { confidence: 0.88 },
      birth_date: { confidence: 0.92 },
      address: { confidence: 0.80 }, // exactly at threshold — should NOT trigger review
    }
    expect(fn(fields)).toBe(false)
  })

  it('any field with confidence < 0.80 → needsReview is true (OCR-02)', async () => {
    const fn = await importNeedsReview()
    if (!fn) expect.fail('src/lib/ai/ocr-confidence.ts does not exist yet — Plan 05 target')
    const fields = {
      full_name: { confidence: 0.95 },
      cpf: { confidence: 0.79 }, // below threshold — triggers review
      birth_date: { confidence: 0.92 },
      address: { confidence: 0.85 },
    }
    expect(fn(fields)).toBe(true)
  })

  it('default threshold is 0.80 (explicit threshold same as default → same result)', async () => {
    const fn = await importNeedsReview()
    if (!fn) expect.fail('src/lib/ai/ocr-confidence.ts does not exist yet — Plan 05 target')
    const fields = {
      full_name: { confidence: 0.75 },
    }
    // Calling with no threshold arg and with explicit 0.80 must give the same result
    expect(fn(fields)).toBe(fn(fields, 0.80))
  })

  it('custom threshold — all above 0.60 → false when threshold is 0.60', async () => {
    const fn = await importNeedsReview()
    if (!fn) expect.fail('src/lib/ai/ocr-confidence.ts does not exist yet — Plan 05 target')
    const fields = {
      full_name: { confidence: 0.65 },
      cpf: { confidence: 0.61 },
    }
    expect(fn(fields, 0.60)).toBe(false)
  })

  it('single field exactly below threshold → true', async () => {
    const fn = await importNeedsReview()
    if (!fn) expect.fail('src/lib/ai/ocr-confidence.ts does not exist yet — Plan 05 target')
    const fields = { cpf: { confidence: 0.799 } }
    expect(fn(fields)).toBe(true)
  })
})

// ─── OCR-01/02: /api/ocr/route.ts source-inspection ─────────────────────────
// RED by design until Plan 05 creates src/app/api/ocr/route.ts

describe('src/app/api/ocr/route.ts source-inspection (OCR-01, OCR-02, T-10-02)', () => {
  const src = SRC('src/app/api/ocr/route.ts')

  it('declares nodejs runtime (required for Supabase TCP + AI SDK — CLAUDE.md)', () => {
    // Same pattern as src/app/api/copilot/route.ts
    expect(src).toMatch(/export const runtime\s*=\s*['"]nodejs['"]/)
  })

  it('uses generateObject from ai SDK (OCR-01: structured field extraction)', () => {
    // generateObject() with Zod schema extracts structured fields from document image
    expect(src).toMatch(/generateObject/)
  })

  it('has FilePart (type: "file") for document upload (OCR-01: vision input)', () => {
    // FilePart pattern — multimodal input to vision model
    // type: 'file' is the FilePart discriminator in AI SDK v6
    expect(src).toMatch(/type.*['"]file['"]|['"]file['"].*type/)
  })

  it('includes zeroDataRetention: true (T-10-02: LGPD — no PII retention at gateway)', () => {
    // CRITICAL: Every gateway call with patient document must have ZDR
    // Same pattern as src/app/api/copilot/route.ts and collection-agent.ts
    expect(src).toMatch(/zeroDataRetention:\s*true/)
  })

  it('inserts into ocr_extractions table (OCR-02: stores extraction result)', () => {
    expect(src).toMatch(/ocr_extractions/)
  })

  it('sets status to pending_review when below threshold (OCR-02: human review gate)', () => {
    // When needsReview() returns true, the insertion must use status='pending_review'
    expect(src).toMatch(/['"]pending_review['"]/)
  })

  it('references maskCPF or masks CPF before logging (T-10-02: no raw CPF in logs)', () => {
    // Pitfall 3: PII in ai_decision_log payload or any log must be masked
    // The route must either call maskCPF() or contain a comment asserting no raw CPF in logs
    // Pattern: maskCPF function call OR a comment about masking CPF
    expect(src).toMatch(/maskCPF|mask.*cpf|cpf.*mask/i)
  })
})
