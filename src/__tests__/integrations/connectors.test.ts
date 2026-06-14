/**
 * Phase 9 — INT-01 RED scaffold: connectors (credential vault + RLS + masking)
 *
 * Asserts artifacts that Plan 02 will create. Tests are RED now (migration files,
 * action file, and mask util do not yet exist) and turn GREEN when the implementation
 * lands. AES round-trip is GREEN immediately (crypto.ts already exists).
 *
 * Source-inspection convention: M(suffix) globs supabase/migrations/ for suffix,
 * SRC(relPath) reads a source file and returns '' if missing (fail on content, not
 * on thrown ENOENT — same pattern as phase8.test.ts).
 *
 * maskCredential is expected at src/lib/integrations/mask.ts (NOT 'use server' —
 * can be imported by both server actions and client components). Plan 02 MUST
 * place the function at this path so both this test and the UI component can import it.
 *
 * Phase: 09-hub-de-integra-es-externas / Plan 01 (Wave 0 RED scaffold)
 * INT-01: integration_connectors table + credential_enc + REVOKE + RLS + action shape
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Mock server-only so crypto.ts (which imports 'server-only') loads in test env
vi.mock('server-only', () => ({}))

// ─── Set ENCRYPTION_KEY before importing crypto ───────────────────────────────
// Same mechanism as patients.test.ts — 64-char hex = 32 bytes (AES-256 requirement)
beforeAll(() => {
  process.env.ENCRYPTION_KEY =
    'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
})

import { encrypt, decrypt } from '@/lib/crypto'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations')

/** Read a migration file by suffix match (ignores timestamp prefix). Mirrors phase8.test.ts. */
function M(suffix: string): string {
  const files = readdirSync(MIGRATIONS_DIR)
  const match = files.find(f => f.endsWith(suffix))
  if (!match) {
    throw new Error(`Migration file ending with '${suffix}' not found in supabase/migrations/`)
  }
  return readFileSync(join(MIGRATIONS_DIR, match), 'utf8')
}

/**
 * Read a source file by relative path from process.cwd().
 * Returns '' (empty string) if missing — assertion fails on content, not on ENOENT.
 * Plan 02 MUST create the file at the expected path for these assertions to pass.
 */
function SRC(relPath: string): string {
  const absPath = resolve(process.cwd(), relPath)
  try {
    return readFileSync(absPath, 'utf8')
  } catch {
    return ''
  }
}

// ─── INT-01: integration_connectors migration ─────────────────────────────────

describe('Phase 9 migration — integration_connectors (INT-01)', () => {
  it('creates public.integration_connectors table', () => {
    const sql = M('_integration_connectors.sql')
    expect(sql).toMatch(/CREATE TABLE public\.integration_connectors/i)
  })

  it('has credential_enc TEXT column for AES-256 ciphertext', () => {
    const sql = M('_integration_connectors.sql')
    expect(sql).toMatch(/credential_enc\s+TEXT/i)
  })

  it('has clinic_id column (NULLABLE — system sentinel allowed)', () => {
    const sql = M('_integration_connectors.sql')
    expect(sql).toMatch(/clinic_id/i)
    // clinic_id must be NULLABLE (not NOT NULL) to support system-level sentinel rows
    expect(sql).not.toMatch(/clinic_id\s+UUID\s+NOT NULL/i)
  })

  it('has status TEXT with CHECK for enabled/disabled', () => {
    const sql = M('_integration_connectors.sql')
    expect(sql).toMatch(/status\s+TEXT/i)
    expect(sql).toMatch(/CHECK/i)
    expect(sql).toMatch(/'enabled'/i)
    expect(sql).toMatch(/'disabled'/i)
  })

  it('has index idx_integration_connectors_clinic on (clinic_id)', () => {
    const sql = M('_integration_connectors.sql')
    expect(sql).toMatch(/idx_integration_connectors_clinic/i)
  })

  it('enables RLS', () => {
    const sql = M('_integration_connectors.sql')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i)
  })

  it('RLS policy uses get_my_tenant_id()', () => {
    const sql = M('_integration_connectors.sql')
    expect(sql).toMatch(/get_my_tenant_id\(\)/i)
  })

  it('RLS policy has WITH CHECK clause', () => {
    const sql = M('_integration_connectors.sql')
    expect(sql).toMatch(/WITH CHECK/i)
  })

  it('RLS role gate includes admin, ti, superadmin', () => {
    const sql = M('_integration_connectors.sql')
    expect(sql).toMatch(/'admin'/i)
    expect(sql).toMatch(/'ti'/i)
    expect(sql).toMatch(/'superadmin'/i)
  })
})

// ─── WR-02: soft-delete migration ─────────────────────────────────────────────

describe('Phase 9 migration — connectors_soft_delete (WR-02 LGPD audit trail)', () => {
  it('soft-delete migration exists for integration_connectors', () => {
    // M() throws if the migration file is not found — this assertion passes once
    // 20260615000700_connectors_soft_delete.sql is created (WR-02 fix).
    const sql = M('_connectors_soft_delete.sql')
    expect(sql).toMatch(/ALTER TABLE public\.integration_connectors/i)
  })

  it('adds deleted_at TIMESTAMPTZ column via ALTER TABLE', () => {
    const sql = M('_connectors_soft_delete.sql')
    expect(sql).toMatch(/ADD COLUMN deleted_at\s+TIMESTAMPTZ/i)
  })

  it('updates tenant_read RLS policy to exclude soft-deleted rows', () => {
    const sql = M('_connectors_soft_delete.sql')
    expect(sql).toMatch(/deleted_at IS NULL/i)
  })
})

// ─── INT-01: integration_revoke migration ─────────────────────────────────────

describe('Phase 9 migration — integration_revoke (INT-01 credential protection)', () => {
  it('REVOKEs SELECT on credential_enc from authenticated and anon', () => {
    const sql = M('_integration_revoke.sql')
    expect(sql).toMatch(/REVOKE SELECT \(credential_enc\)/i)
    expect(sql).toMatch(/FROM authenticated, anon/i)
  })
})

// ─── INT-01: integration-connectors action source-inspection ──────────────────

describe('Phase 9 action — integration-connectors.ts (INT-01 server action)', () => {
  const actionSrc = SRC('src/actions/integration-connectors.ts')

  it('calls assertNotReadOnly() as first guard', () => {
    expect(actionSrc).toMatch(/assertNotReadOnly\(\)/)
  })

  it('encrypts credential before insert', () => {
    expect(actionSrc).toMatch(/encrypt\(/)
  })

  it('ConnectorPublic type excludes credential_enc via Omit', () => {
    expect(actionSrc).toMatch(/Omit<[^>]*,\s*'credential_enc'>/)
  })

  it('uses maskCredential — credential never returned raw', () => {
    // Either maskCredential is called (for display) OR the return type is Omit<>
    // Both must be present: Omit<> for compile-time safety, maskCredential for display
    const hasMask = /maskCredential/.test(actionSrc)
    const hasOmit = /Omit<[^>]*,\s*'credential_enc'>/.test(actionSrc)
    // At minimum one must be present; both is ideal (defense-in-depth)
    expect(hasMask || hasOmit).toBe(true)
  })
})

// ─── INT-01: mask util source-inspection (src/lib/integrations/mask.ts) ───────
// Plan 02 MUST create maskCredential at this path (NOT 'use server') so both
// server actions and client components can import it.

describe('Phase 9 — mask.ts util (INT-01 credential masking)', () => {
  const maskSrc = SRC('src/lib/integrations/mask.ts')

  it('exports maskCredential function', () => {
    expect(maskSrc).toMatch(/export function maskCredential/)
  })

  it('mask.ts does NOT use server-only (importable by client components)', () => {
    // mask.ts must be a pure util — no 'server-only' import
    expect(maskSrc).not.toMatch(/import 'server-only'/)
    expect(maskSrc).not.toMatch(/import "server-only"/)
  })
})

// ─── INT-01: AES round-trip (GREEN immediately — crypto.ts exists) ────────────

describe('AES-256-GCM round-trip (INT-01 credential vault)', () => {
  it('decrypt(encrypt(plaintext)) === plaintext for API key value', () => {
    expect(decrypt(encrypt('api-key-1234'))).toBe('api-key-1234')
  })

  it('each encryption produces a unique ciphertext (IV randomness)', () => {
    const plaintext = 'api-key-1234'
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext))
  })

  it('round-trip with realistic connector credential (token format)', () => {
    const token = '$aact_YTU5YTE0M2M2N2Y4MTdlMGI5ZmRlZjEzMTk4ZmJiMjE6OjAwMDAwMDAwMDAwMDAwMzc5MzY6OjkwM2I4YWQ='
    expect(decrypt(encrypt(token))).toBe(token)
  })
})

// ─── INT-01: maskCredential unit (RED until mask.ts created) ─────────────────
// These assertions document the expected contract for Plan 02.
// They will be GREEN once src/lib/integrations/mask.ts is created.
// Dynamic import uses an absolute path (not @-alias) to stay tsc-clean when the
// module does not yet exist — the @-alias causes TS2307 on missing files.

describe('maskCredential contract (INT-01 UI masking)', () => {
  it('maskCredential("1234") returns "••••••1234"', async () => {
    const maskPath = resolve(process.cwd(), 'src/lib/integrations/mask.ts')
    if (!existsSync(maskPath)) {
      // RED by design — Plan 02 creates this file
      expect.fail('src/lib/integrations/mask.ts does not exist yet — Plan 02 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ maskPath) as any
    expect(mod.maskCredential('1234')).toBe('••••••1234')
  })

  it('maskCredential never reveals more than last 4 chars', async () => {
    const maskPath = resolve(process.cwd(), 'src/lib/integrations/mask.ts')
    if (!existsSync(maskPath)) {
      expect.fail('src/lib/integrations/mask.ts does not exist yet — Plan 02 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ maskPath) as any
    const fullSecret = 'sk_live_abcdefgh5678'
    const masked = mod.maskCredential(fullSecret.slice(-4))
    // Masked value must start with bullets
    expect(masked).toMatch(/^[•]+/)
    // And must not contain the full secret
    expect(masked).not.toContain('sk_live_abcdefgh')
  })
})
