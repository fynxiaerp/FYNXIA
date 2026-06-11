/**
 * Phase 5 AI-01 — copilot tools + PII masking
 * RED-by-design until Plan 05-02 implements src/lib/ai/masking.ts + src/lib/ai/tools.ts
 *
 * Tests:
 *  1. maskCPF / maskPhone pure functions (unit — logic tests)
 *  2. tools.ts source inspection: tenant-scoped (createClient), no health data, no mutations
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = (f: string) => join(process.cwd(), 'src', f)

// ---------------------------------------------------------------------------
// Guard: masking.ts must exist before we can import it
// ---------------------------------------------------------------------------
describe('src/lib/ai/masking.ts — PII masking helpers (AI-01, D-01)', () => {
  it('masking.ts file exists (created in 05-02)', () => {
    expect(
      existsSync(SRC('lib/ai/masking.ts')),
      'src/lib/ai/masking.ts not yet created (05-02)',
    ).toBe(true)
  })

  it('maskCPF masks all digits except last 2 groups', async () => {
    // Dynamic import so the test is RED (module-not-found) when file absent
    const { maskCPF } = await import('@/lib/ai/masking')
    expect(maskCPF('123.456.789-00')).toBe('***.***.***-00')
  })

  it('maskPhone masks digit portion of phone', async () => {
    const { maskPhone } = await import('@/lib/ai/masking')
    const masked = maskPhone('+5511999998888')
    // Should contain asterisks hiding some digits
    expect(masked).toMatch(/\*/)
    // Should NOT be the original value
    expect(masked).not.toBe('+5511999998888')
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
    const src = readFileSync(SRC('lib/ai/tools.ts'), 'utf8')
    expect(src).toMatch(/@\/lib\/supabase\/server/)
  })

  it('tools.ts does NOT import createAdminClient (no service role in copilot tools)', () => {
    const src = readFileSync(SRC('lib/ai/tools.ts'), 'utf8')
    expect(src).not.toMatch(/createAdminClient/)
    expect(src).not.toMatch(/@\/lib\/supabase\/admin/)
  })

  it('tools.ts does NOT select health columns (D-01 — never to LLM)', () => {
    const src = readFileSync(SRC('lib/ai/tools.ts'), 'utf8')
    expect(src).not.toMatch(/medical_history/i)
    expect(src).not.toMatch(/allergies/i)
    expect(src).not.toMatch(/medications/i)
    expect(src).not.toMatch(/anamnes/i)
  })

  it('tools.ts uses tool() definitions (AI SDK v6 pattern)', () => {
    const src = readFileSync(SRC('lib/ai/tools.ts'), 'utf8')
    expect(src).toMatch(/tool\(/)
  })

  it('tools.ts includes searchHelpDocs tool (D-03 — help/how-to support)', () => {
    const src = readFileSync(SRC('lib/ai/tools.ts'), 'utf8')
    expect(src).toMatch(/searchHelpDocs/)
  })

  it('tools.ts has NO mutation verbs in supabase chains (D-05 — read-only)', () => {
    const src = readFileSync(SRC('lib/ai/tools.ts'), 'utf8')
    expect(src).not.toMatch(/\.(insert|update|delete|upsert)\(/)
  })
})
