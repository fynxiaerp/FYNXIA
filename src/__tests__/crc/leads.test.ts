/**
 * Phase 18 — crc/leads.test.ts (Wave 1 RED scaffold)
 *
 * Source-inspection tests for src/actions/leads.ts
 * RED by design until a later Phase 18 plan creates that file.
 *
 * Checks:
 * - CRC-01: 'use server' directive present
 * - CRC-01: moveLeadStage exported (Kanban drag-and-drop persistence, D-02)
 * - CRC-01: isValidStageTransition referenced (forward-only guard, D-01)
 * - CRC-01: WRITER_ROLES gate present (Pitfall 7 — no 'marketing' role exists)
 * - CRC-01/D-04: convertLead exported (creates/links a patient)
 * - CRC-02/D-06: listConversionByOrigin exported (conversion-by-origin aggregate)
 *
 * Convention: SRC(relPath) returns '' if file missing — RED on content, not ENOENT.
 *
 * Phase: 18-crc-marketing / Plan 01
 * Requirements: CRC-01, CRC-02
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

// ─── leads.ts source-inspection ──────────────────────────────────────────────
// RED until a downstream Phase 18 plan creates src/actions/leads.ts

describe('src/actions/leads.ts source-inspection (CRC-01, CRC-02)', () => {
  const src = SRC('src/actions/leads.ts')

  it("has 'use server' directive (required for Server Actions)", () => {
    expect(src).toMatch(/'use server'/)
  })

  it('exports moveLeadStage (D-02: Kanban drag-and-drop persistence)', () => {
    expect(src).toMatch(/moveLeadStage/)
  })

  it('references isValidStageTransition (D-01: forward-only stage guard)', () => {
    expect(src).toMatch(/isValidStageTransition/)
  })

  it('gates writes with WRITER_ROLES (Pitfall 7: no marketing role exists)', () => {
    expect(src).toMatch(/WRITER_ROLES/)
  })

  it('exports convertLead (D-04: conversion creates/links a patient)', () => {
    expect(src).toMatch(/convertLead/)
  })

  it('exports listConversionByOrigin (D-06: conversion-by-origin aggregate)', () => {
    expect(src).toMatch(/listConversionByOrigin/)
  })
})
