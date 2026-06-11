/**
 * Phase 5 AI-03 — collection agent + AI-02 confirmation agent
 * RED-by-design until Plan 05-05 implements:
 *   - src/lib/agents/collection-agent.ts
 *   - src/lib/agents/confirmation-agent.ts
 *
 * Tests:
 *  1. collection-agent.ts source inspection: real getInvoiceUrl, no hardcoded URL,
 *     getOutboxQueue enqueue, logBusinessEvent, agent_outreach_log reference
 *  2. confirmation-agent.ts source inspection: TEMPLATE_APPOINTMENT_REMINDER, agent_outreach_log
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = (f: string) => join(process.cwd(), 'src', f)

// ---------------------------------------------------------------------------
// Source inspection: collection-agent.ts (AI-03)
// ---------------------------------------------------------------------------
describe('src/lib/agents/collection-agent.ts — source inspection (AI-03, D-04)', () => {
  it('collection-agent.ts file exists (created in 05-05)', () => {
    expect(
      existsSync(SRC('lib/agents/collection-agent.ts')),
      'src/lib/agents/collection-agent.ts not yet created (05-05)',
    ).toBe(true)
  })

  it('references getInvoiceUrl (real Asaas link — never LLM-fabricated)', () => {
    const src = readFileSync(SRC('lib/agents/collection-agent.ts'), 'utf8')
    expect(src).toMatch(/getInvoiceUrl/)
  })

  it('does NOT contain a hardcoded asaas.com URL literal', () => {
    const src = readFileSync(SRC('lib/agents/collection-agent.ts'), 'utf8')
    // No literal asaas.com domain hardcoded (LLM must not generate URL)
    expect(src).not.toMatch(/asaas\.com\/i\//)
  })

  it('does NOT contain a template-literal URL pattern (no fabricated URL)', () => {
    const src = readFileSync(SRC('lib/agents/collection-agent.ts'), 'utf8')
    // No JS template literal building an asaas URL — e.g. `https://asaas.com/${var}`
    // Regex: https:// followed by non-whitespace chars containing ${
    expect(src).not.toMatch(/https:\/\/[^\s'"]*\$\{/)
  })

  it('references getOutboxQueue (enqueues via outbox, not direct WhatsApp call)', () => {
    const src = readFileSync(SRC('lib/agents/collection-agent.ts'), 'utf8')
    expect(src).toMatch(/getOutboxQueue/)
  })

  it('references logBusinessEvent (audit trail, D-04)', () => {
    const src = readFileSync(SRC('lib/agents/collection-agent.ts'), 'utf8')
    expect(src).toMatch(/logBusinessEvent/)
  })

  it('references agent_outreach_log (audit insert after send)', () => {
    const src = readFileSync(SRC('lib/agents/collection-agent.ts'), 'utf8')
    expect(src).toMatch(/agent_outreach_log/)
  })
})

// ---------------------------------------------------------------------------
// Source inspection: confirmation-agent.ts (AI-02)
// ---------------------------------------------------------------------------
describe('src/lib/agents/confirmation-agent.ts — source inspection (AI-02, D-04)', () => {
  it('confirmation-agent.ts file exists (created in 05-05)', () => {
    expect(
      existsSync(SRC('lib/agents/confirmation-agent.ts')),
      'src/lib/agents/confirmation-agent.ts not yet created (05-05)',
    ).toBe(true)
  })

  it('references TEMPLATE_APPOINTMENT_REMINDER (Phase 4 template reuse)', () => {
    const src = readFileSync(SRC('lib/agents/confirmation-agent.ts'), 'utf8')
    expect(src).toMatch(/TEMPLATE_APPOINTMENT_REMINDER/)
  })

  it('references agent_outreach_log (audit insert after send)', () => {
    const src = readFileSync(SRC('lib/agents/confirmation-agent.ts'), 'utf8')
    expect(src).toMatch(/agent_outreach_log/)
  })
})
