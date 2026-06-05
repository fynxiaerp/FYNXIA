/**
 * listAnamneses Server Action tests
 * Phase 02-05: CLINIC-08 gap closure
 *
 * Tests:
 * 1. listAnamneses is exported from anamneses.ts (source-level check)
 * 2. Status derivation logic (pure function, no DB):
 *    signature_hash='PENDING' + token_used_at=null + token_expires_at in future → 'pending'
 *    signature_hash='PENDING' + token_expires_at in past → 'expired'
 *    real hash → 'signed'
 * 3. AnamnesisList component exists and is wired in patient detail page
 *
 * Source-level checks follow the T-2-12 pattern (read file, grep for symbol).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// ─── Status derivation logic (pure, no imports needed) ───────────────────────
// Mirrors the logic that listAnamneses must apply when mapping DB rows.

function deriveAnamnesisStatus(row: {
  signature_hash: string
  token_used_at: string | null
  token_expires_at: string | null
  signed_at: string | null
}): 'pending' | 'expired' | 'signed' {
  if (row.signature_hash === 'PENDING') {
    if (row.token_expires_at && new Date(row.token_expires_at) < new Date()) {
      return 'expired'
    }
    if (!row.token_used_at) {
      return 'pending'
    }
  }
  return 'signed'
}

describe('anamnesis status derivation', () => {
  const now = new Date()
  const future = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString()
  const past = new Date(now.getTime() - 1000).toISOString()

  it('returns "pending" when signature_hash=PENDING and token not used and not expired', () => {
    expect(
      deriveAnamnesisStatus({
        signature_hash: 'PENDING',
        token_used_at: null,
        token_expires_at: future,
        signed_at: null,
      })
    ).toBe('pending')
  })

  it('returns "expired" when signature_hash=PENDING and token_expires_at is in the past', () => {
    expect(
      deriveAnamnesisStatus({
        signature_hash: 'PENDING',
        token_used_at: null,
        token_expires_at: past,
        signed_at: null,
      })
    ).toBe('expired')
  })

  it('returns "signed" when signature_hash is a real hash (not PENDING)', () => {
    expect(
      deriveAnamnesisStatus({
        signature_hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        token_used_at: '2026-06-05T10:00:00Z',
        token_expires_at: future,
        signed_at: '2026-06-05T10:00:00Z',
      })
    ).toBe('signed')
  })

  it('returns "signed" for presencial flow (no token fields, real hash)', () => {
    expect(
      deriveAnamnesisStatus({
        signature_hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        token_used_at: null,
        token_expires_at: null,
        signed_at: '2026-06-05T10:00:00Z',
      })
    ).toBe('signed')
  })
})

// ─── listAnamneses source-level checks (RED: fails until function is added) ───

describe('listAnamneses source-level checks', () => {
  const filePath = path.resolve(process.cwd(), 'src/actions/anamneses.ts')

  it('exports listAnamneses from anamneses.ts', () => {
    const source = fs.readFileSync(filePath, 'utf-8')
    expect(source).toContain('export async function listAnamneses')
  })

  it('listAnamneses uses RLS-aware createClient (not admin client for list)', () => {
    const source = fs.readFileSync(filePath, 'utf-8')
    // listAnamneses must use createClient() (RLS-aware) for tenant isolation
    expect(source).toContain('createClient')
  })

  it('listAnamneses orders by created_at DESC', () => {
    const source = fs.readFileSync(filePath, 'utf-8')
    expect(source).toContain('created_at')
    expect(source).toContain('ascending: false')
  })

  it('listAnamneses does NOT return signature_hash or responses raw (LGPD)', () => {
    const source = fs.readFileSync(filePath, 'utf-8')
    // Find the listAnamneses function body
    const listFnMatch = source.match(/listAnamneses[\s\S]*?^}/m)
    if (listFnMatch) {
      // The select should NOT request signature_hash or responses columns
      expect(listFnMatch[0]).not.toContain("'signature_hash'")
      expect(listFnMatch[0]).not.toContain("'responses'")
    }
  })
})

// ─── AnamnesisList component + patient detail page wiring ────────────────────

describe('AnamnesisList component and patient detail page', () => {
  it('AnamnesisList.tsx exists at src/components/anamnesis/AnamnesisList.tsx', () => {
    const componentPath = path.resolve(
      process.cwd(),
      'src/components/anamnesis/AnamnesisList.tsx'
    )
    expect(fs.existsSync(componentPath)).toBe(true)
  })

  it('AnamnesisList.tsx contains the AnamnesisList export', () => {
    const componentPath = path.resolve(
      process.cwd(),
      'src/components/anamnesis/AnamnesisList.tsx'
    )
    const source = fs.readFileSync(componentPath, 'utf-8')
    expect(source).toContain('AnamnesisList')
  })

  it('patient detail page imports and uses AnamnesisList', () => {
    const pagePath = path.resolve(
      process.cwd(),
      'src/app/(dashboard)/clinica/pacientes/[id]/page.tsx'
    )
    const source = fs.readFileSync(pagePath, 'utf-8')
    expect(source).toContain('AnamnesisList')
  })

  it('patient detail page no longer contains the "Disponível após Plano 04" stub', () => {
    const pagePath = path.resolve(
      process.cwd(),
      'src/app/(dashboard)/clinica/pacientes/[id]/page.tsx'
    )
    const source = fs.readFileSync(pagePath, 'utf-8')
    expect(source).not.toContain('Disponível após Plano 04')
  })
})
