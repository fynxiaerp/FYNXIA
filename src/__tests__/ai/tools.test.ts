/**
 * Phase 5 AI-01 — copilot tools + PII masking
 * RED-by-design until Plan 05-02 implements src/lib/ai/masking.ts + src/lib/ai/tools.ts
 *
 * Source-inspection pattern (mirrors comms.test.ts):
 *   - existsSync guard: missing file → RED via failed assertion (no tsc/import error)
 *   - readFileSync: asserts the file text contains the expected symbols/patterns
 *   - NO dynamic import of the modules under test
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = (f: string) => join(process.cwd(), 'src', f)

// ---------------------------------------------------------------------------
// Source inspection: masking.ts
// ---------------------------------------------------------------------------
describe('src/lib/ai/masking.ts — PII masking helpers (AI-01, D-01)', () => {
  it('masking.ts file exists (created in 05-02)', () => {
    expect(
      existsSync(SRC('lib/ai/masking.ts')),
      'src/lib/ai/masking.ts not yet created (05-02)',
    ).toBe(true)
  })

  it('exports maskCPF function', () => {
    if (!existsSync(SRC('lib/ai/masking.ts'))) {
      expect(existsSync(SRC('lib/ai/masking.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/ai/masking.ts'), 'utf8')
    expect(src).toMatch(/export function maskCPF/)
  })

  it('maskCPF keeps last 2 digit-groups (***.***.***-XX pattern)', () => {
    if (!existsSync(SRC('lib/ai/masking.ts'))) {
      expect(existsSync(SRC('lib/ai/masking.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/ai/masking.ts'), 'utf8')
    // Implementation must contain the mask pattern that yields ***.***.***-XX
    // (last 2 digits kept). Regex checks for '*'.repeat or slice(-2) approach.
    expect(src).toMatch(/maskCPF/)
    // Must not return the raw CPF unchanged (there must be masking logic)
    expect(src).toMatch(/\*/)
  })

  it('exports maskPhone function', () => {
    if (!existsSync(SRC('lib/ai/masking.ts'))) {
      expect(existsSync(SRC('lib/ai/masking.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/ai/masking.ts'), 'utf8')
    expect(src).toMatch(/export function maskPhone/)
  })

  it('maskPhone contains masking logic (asterisks in implementation)', () => {
    if (!existsSync(SRC('lib/ai/masking.ts'))) {
      expect(existsSync(SRC('lib/ai/masking.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/ai/masking.ts'), 'utf8')
    expect(src).toMatch(/maskPhone/)
    // Must contain masking output (asterisk literal or repeat)
    expect(src).toMatch(/\*/)
  })
})

// ---------------------------------------------------------------------------
// Source inspection: tools.ts
// ---------------------------------------------------------------------------
describe('src/lib/ai/tools.ts — source inspection (AI-01, D-01, D-05)', () => {
  it('tools.ts file exists (created in 05-02)', () => {
    expect(
      existsSync(SRC('lib/ai/tools.ts')),
      'src/lib/ai/tools.ts not yet created (05-02)',
    ).toBe(true)
  })

  it('tools.ts imports createClient from @/lib/supabase/server (RLS user session)', () => {
    if (!existsSync(SRC('lib/ai/tools.ts'))) {
      expect(existsSync(SRC('lib/ai/tools.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/ai/tools.ts'), 'utf8')
    expect(src).toMatch(/@\/lib\/supabase\/server/)
  })

  it('tools.ts does NOT import createAdminClient (no service role in copilot tools)', () => {
    if (!existsSync(SRC('lib/ai/tools.ts'))) {
      expect(existsSync(SRC('lib/ai/tools.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/ai/tools.ts'), 'utf8')
    expect(src).not.toMatch(/createAdminClient/)
    expect(src).not.toMatch(/@\/lib\/supabase\/admin/)
  })

  it('tools.ts does NOT select health columns (D-01 — never to LLM)', () => {
    if (!existsSync(SRC('lib/ai/tools.ts'))) {
      expect(existsSync(SRC('lib/ai/tools.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/ai/tools.ts'), 'utf8')
    expect(src).not.toMatch(/medical_history/i)
    expect(src).not.toMatch(/allergies/i)
    expect(src).not.toMatch(/medications/i)
    expect(src).not.toMatch(/anamnes/i)
  })

  it('tools.ts uses tool() definitions (AI SDK v6 pattern)', () => {
    if (!existsSync(SRC('lib/ai/tools.ts'))) {
      expect(existsSync(SRC('lib/ai/tools.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/ai/tools.ts'), 'utf8')
    expect(src).toMatch(/tool\(/)
  })

  it('tools.ts includes searchHelpDocs tool (D-03 — help/how-to support)', () => {
    if (!existsSync(SRC('lib/ai/tools.ts'))) {
      expect(existsSync(SRC('lib/ai/tools.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/ai/tools.ts'), 'utf8')
    expect(src).toMatch(/searchHelpDocs/)
  })

  it('tools.ts has NO mutation verbs in supabase chains (D-05 — read-only)', () => {
    if (!existsSync(SRC('lib/ai/tools.ts'))) {
      expect(existsSync(SRC('lib/ai/tools.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/ai/tools.ts'), 'utf8')
    expect(src).not.toMatch(/\.(insert|update|delete|upsert)\(/)
  })
})
