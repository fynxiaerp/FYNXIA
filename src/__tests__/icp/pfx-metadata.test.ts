/**
 * ICP-Brasil certificate metadata extraction — unit test scaffold (RED by design)
 *
 * Uses source-inspection + fixture validation approach so tsc stays GREEN while
 * the module target (src/lib/icp/pfx-metadata.ts) doesn't exist yet.
 *
 * Phase 7 Plan 03 creates extractPfxMetadata. These tests are intentionally RED
 * (source-inspection assertions fail because the file doesn't exist yet) and turn
 * GREEN when Plan 03 delivers the implementation.
 *
 * The extractPfxMetadata shape assertions use a try/require pattern that stays
 * tsc-clean because no static import of the non-existent module is used.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

// Mock server-only so pfx-metadata.ts (which will import 'server-only') loads in test env
vi.mock('server-only', () => ({}))

// ─── Paths ───────────────────────────────────────────────────────────────────

const FIXTURE_PATH = resolve(process.cwd(), 'src/__tests__/icp/fixtures/test-cert.pfx')
const FIXTURE_PASSWORD = 'test1234'
const PFX_MODULE_PATH = resolve(process.cwd(), 'src/lib/icp/pfx-metadata.ts')

// ─── Fixture existence checks ─────────────────────────────────────────────────

describe('test-cert.pfx fixture', () => {
  it('fixture file exists', () => {
    expect(existsSync(FIXTURE_PATH)).toBe(true)
  })

  it('fixture file is non-empty (> 0 bytes)', () => {
    expect(statSync(FIXTURE_PATH).size).toBeGreaterThan(0)
  })

  it('fixture is a valid PKCS12 binary (starts with DER sequence byte 0x30)', () => {
    const buf = readFileSync(FIXTURE_PATH)
    // PKCS12 files start with ASN.1 SEQUENCE tag 0x30
    expect(buf[0]).toBe(0x30)
  })
})

// ─── pfx-metadata.ts source-inspection (RED until Plan 03) ───────────────────

describe('pfx-metadata.ts — source-inspection (SYS-02 / ROLE-02)', () => {
  it('pfx-metadata.ts exists at src/lib/icp/pfx-metadata.ts', () => {
    expect(existsSync(PFX_MODULE_PATH)).toBe(true)
  })

  it('pfx-metadata.ts exports extractPfxMetadata function', () => {
    if (!existsSync(PFX_MODULE_PATH)) {
      expect.fail('pfx-metadata.ts does not exist yet — Plan 03 target')
    }
    const src = readFileSync(PFX_MODULE_PATH, 'utf-8')
    expect(src).toMatch(/export function extractPfxMetadata/i)
  })

  it('pfx-metadata.ts is server-only', () => {
    if (!existsSync(PFX_MODULE_PATH)) {
      expect.fail('pfx-metadata.ts does not exist yet — Plan 03 target')
    }
    const src = readFileSync(PFX_MODULE_PATH, 'utf-8')
    expect(src).toContain("import 'server-only'")
  })

  it('pfx-metadata.ts imports node-forge', () => {
    if (!existsSync(PFX_MODULE_PATH)) {
      expect.fail('pfx-metadata.ts does not exist yet — Plan 03 target')
    }
    const src = readFileSync(PFX_MODULE_PATH, 'utf-8')
    expect(src).toMatch(/node-forge/i)
  })

  it('pfx-metadata.ts defines CertificateMetadata interface with required fields', () => {
    if (!existsSync(PFX_MODULE_PATH)) {
      expect.fail('pfx-metadata.ts does not exist yet — Plan 03 target')
    }
    const src = readFileSync(PFX_MODULE_PATH, 'utf-8')
    expect(src).toMatch(/subject_cn/i)
    expect(src).toMatch(/not_before/i)
    expect(src).toMatch(/not_after/i)
    expect(src).toMatch(/thumbprint_sha1/i)
    expect(src).toMatch(/cnpj/i)
  })
})

// ─── extractPfxMetadata runtime shape assertions (RED until Plan 03) ─────────
// Uses dynamic require so tsc does NOT statically check the non-existent module.

describe('extractPfxMetadata — shape assertions (runtime, RED until Plan 03)', () => {
  // Attempt to load the module at runtime (not compile time)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getExtractFn(): ((buf: Buffer, password: string) => any) | undefined {
    try {
      // Node.js require (available in vitest/Node runtime)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(PFX_MODULE_PATH.replace(/\.ts$/, ''))
      return mod.extractPfxMetadata
    } catch {
      return undefined
    }
  }

  it('extractPfxMetadata is exported as a function', () => {
    const fn = getExtractFn()
    expect(typeof fn).toBe('function')
  })

  it('returns an object with subject_cn (string)', () => {
    const fn = getExtractFn()
    if (!fn) expect.fail('extractPfxMetadata not yet available — Plan 03 target')
    const result = fn(readFileSync(FIXTURE_PATH), FIXTURE_PASSWORD)
    expect(result).toHaveProperty('subject_cn')
    expect(typeof result.subject_cn).toBe('string')
  })

  it('returns not_before as a Date', () => {
    const fn = getExtractFn()
    if (!fn) expect.fail('extractPfxMetadata not yet available — Plan 03 target')
    const result = fn(readFileSync(FIXTURE_PATH), FIXTURE_PASSWORD)
    expect(result.not_before).toBeInstanceOf(Date)
  })

  it('returns not_after as a Date', () => {
    const fn = getExtractFn()
    if (!fn) expect.fail('extractPfxMetadata not yet available — Plan 03 target')
    const result = fn(readFileSync(FIXTURE_PATH), FIXTURE_PASSWORD)
    expect(result.not_after).toBeInstanceOf(Date)
  })

  it('returns thumbprint_sha1 as a 40-char hex string (SHA-1)', () => {
    const fn = getExtractFn()
    if (!fn) expect.fail('extractPfxMetadata not yet available — Plan 03 target')
    const result = fn(readFileSync(FIXTURE_PATH), FIXTURE_PASSWORD)
    expect(result.thumbprint_sha1).toMatch(/^[0-9a-f]{40}$/i)
  })

  it('cnpj is null for synthetic cert (no ICP-Brasil OIDs — acceptable)', () => {
    const fn = getExtractFn()
    if (!fn) expect.fail('extractPfxMetadata not yet available — Plan 03 target')
    const result = fn(readFileSync(FIXTURE_PATH), FIXTURE_PASSWORD)
    // Synthetic self-signed cert has no ICP-Brasil CNPJ OID — null is valid
    expect(result.cnpj === null || typeof result.cnpj === 'string').toBe(true)
  })

  it('not_after is after not_before (valid cert date range)', () => {
    const fn = getExtractFn()
    if (!fn) expect.fail('extractPfxMetadata not yet available — Plan 03 target')
    const result = fn(readFileSync(FIXTURE_PATH), FIXTURE_PASSWORD)
    expect(result.not_after.getTime()).toBeGreaterThan(result.not_before.getTime())
  })
})
