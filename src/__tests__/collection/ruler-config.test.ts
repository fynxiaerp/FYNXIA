/**
 * Phase 3 — Collection Ruler config tests (FIN-07, D-09, D-10)
 * Test type: behavioral source-inspection via readFileSync (Phase 2 pattern)
 *
 * Asserts:
 * 1. src/actions/collection-ruler.ts exports saveCollectionRuler and gates on role (admin)
 * 2. regua-de-cobranca/page.tsx shows "Acesso restrito" for non-admin
 * 3. CollectionRulerForm.tsx includes the Fase 4 WhatsApp deferral note
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ACTION_PATH = resolve(process.cwd(), 'src/actions/collection-ruler.ts')
const PAGE_PATH = resolve(
  process.cwd(),
  'src/app/(dashboard)/clinica/financeiro/regua-de-cobranca/page.tsx'
)
const FORM_PATH = resolve(
  process.cwd(),
  'src/components/financeiro/CollectionRulerForm.tsx'
)

describe('collection-ruler action — src/actions/collection-ruler.ts', () => {
  it('file exists', () => {
    expect(existsSync(ACTION_PATH)).toBe(true)
  })

  it('exports saveCollectionRuler', () => {
    const src = readFileSync(ACTION_PATH, 'utf8')
    expect(src).toMatch(/export async function saveCollectionRuler/)
  })

  it('calls getActor for authentication', () => {
    const src = readFileSync(ACTION_PATH, 'utf8')
    expect(src).toMatch(/getActor/)
  })

  it('gates on admin role', () => {
    const src = readFileSync(ACTION_PATH, 'utf8')
    expect(src).toMatch(/admin/)
  })

  it('references collection_log for context (idempotency key managed by cron)', () => {
    const src = readFileSync(ACTION_PATH, 'utf8')
    // collection_log is referenced in comments documenting the idempotency contract
    expect(src).toMatch(/collection_log/)
  })

  it('references milestone for idempotency documentation', () => {
    const src = readFileSync(ACTION_PATH, 'utf8')
    expect(src).toMatch(/milestone/)
  })
})

describe('regua-de-cobranca page — admin gate', () => {
  it('file exists', () => {
    expect(existsSync(PAGE_PATH)).toBe(true)
  })

  it('renders "Acesso restrito" for non-admin roles (no redirect — UI-SPEC)', () => {
    const src = readFileSync(PAGE_PATH, 'utf8')
    expect(src).toMatch(/Acesso restrito/)
  })
})

describe('CollectionRulerForm — WhatsApp Fase 4 deferral note', () => {
  it('file exists', () => {
    expect(existsSync(FORM_PATH)).toBe(true)
  })

  it('includes the Fase 4 WhatsApp deferral note (D-10)', () => {
    const src = readFileSync(FORM_PATH, 'utf8')
    // D-10: WhatsApp deferred to Phase 4 — muted informational note in the form
    expect(src).toMatch(/Fase 4/)
  })

  it('has Switch components with htmlFor labels (accessibility — 03-UI-SPEC)', () => {
    const src = readFileSync(FORM_PATH, 'utf8')
    expect(src).toMatch(/htmlFor/)
  })
})
