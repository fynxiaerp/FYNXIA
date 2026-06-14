/**
 * Phase 8 Server Actions — source-inspection test scaffold (RED by design)
 *
 * Reads src/actions/document-templates.ts and src/actions/documents.ts as text
 * and asserts structural contracts. Tests are RED until Plan 02 creates these files.
 *
 * Uses readFileSync (not import) so tsc stays green and tests fail clearly at
 * runtime when the target files are absent.
 *
 * Phase: 08-documentos-assinatura-icp-brasil / Plan 01 (Wave 0 RED scaffold)
 * DOC-01/02/03: Server Action structural + security contracts
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const TEMPLATES_ACTION_PATH = resolve(
  process.cwd(),
  'src/actions/document-templates.ts'
)
const DOCUMENTS_ACTION_PATH = resolve(
  process.cwd(),
  'src/actions/documents.ts'
)

// ─── document-templates.ts ────────────────────────────────────────────────────

describe('src/actions/document-templates.ts — structural contract (DOC-01)', () => {
  it('file exists', () => {
    // readFileSync throws clearly if file absent — RED until Plan 02
    expect(() => readFileSync(TEMPLATES_ACTION_PATH, 'utf8')).not.toThrow()
  })

  it("starts with 'use server' directive", () => {
    const src = readFileSync(TEMPLATES_ACTION_PATH, 'utf8')
    expect(src.trimStart()).toMatch(/^['"]use server['"]/)
  })

  it('exports async createTemplate function', () => {
    const src = readFileSync(TEMPLATES_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export\s+async\s+function\s+createTemplate/i)
  })

  it('exports async updateTemplate function', () => {
    const src = readFileSync(TEMPLATES_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export\s+async\s+function\s+updateTemplate/i)
  })

  it('exports async deleteTemplate function', () => {
    const src = readFileSync(TEMPLATES_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export\s+async\s+function\s+deleteTemplate/i)
  })

  it('exports async listTemplates function', () => {
    const src = readFileSync(TEMPLATES_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export\s+async\s+function\s+listTemplates/i)
  })

  it('mutating functions call assertNotReadOnly (security gate)', () => {
    const src = readFileSync(TEMPLATES_ACTION_PATH, 'utf8')
    // At least one assertNotReadOnly call must be present in mutation bodies
    expect(src).toMatch(/assertNotReadOnly/i)
  })
})

// ─── documents.ts ─────────────────────────────────────────────────────────────

describe('src/actions/documents.ts — structural contract (DOC-01/02/03)', () => {
  it('file exists', () => {
    expect(() => readFileSync(DOCUMENTS_ACTION_PATH, 'utf8')).not.toThrow()
  })

  it("starts with 'use server' directive", () => {
    const src = readFileSync(DOCUMENTS_ACTION_PATH, 'utf8')
    expect(src.trimStart()).toMatch(/^['"]use server['"]/)
  })

  it('exports async generateDocument function', () => {
    const src = readFileSync(DOCUMENTS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export\s+async\s+function\s+generateDocument/i)
  })

  it('exports async signDocument function', () => {
    const src = readFileSync(DOCUMENTS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export\s+async\s+function\s+signDocument/i)
  })

  it('exports async verifyDocumentSignature function', () => {
    const src = readFileSync(DOCUMENTS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export\s+async\s+function\s+verifyDocumentSignature/i)
  })

  it('exports async listDocumentVersions function', () => {
    const src = readFileSync(DOCUMENTS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export\s+async\s+function\s+listDocumentVersions/i)
  })

  it('mutating functions call assertNotReadOnly (security gate)', () => {
    const src = readFileSync(DOCUMENTS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/assertNotReadOnly/i)
  })

  it('references createAdminClient (service role for storage access)', () => {
    const src = readFileSync(DOCUMENTS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/createAdminClient/i)
  })

  it('references decrypt (AES cert password decryption)', () => {
    const src = readFileSync(DOCUMENTS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/\bdecrypt\b/i)
  })

  it('references renderToBuffer (@react-pdf/renderer PDF generation)', () => {
    const src = readFileSync(DOCUMENTS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/renderToBuffer/i)
  })

  it('references documents-pdf storage bucket', () => {
    const src = readFileSync(DOCUMENTS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/documents-pdf/i)
  })
})
