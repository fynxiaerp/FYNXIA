/**
 * Phase 7 Plan 06 — Certificate upload, AI config gate, and perfis matrix tests
 * (SYS-02, SYS-03, SYS-04, ROLE-02)
 *
 * Asserts:
 * 1. certificateSchema rejects >5 MB files and non-.pfx types; accepts valid .pfx ≤5 MB
 * 2. Source-inspection: certificate.ts contains assertNotReadOnly, encrypt(, icp-certificates,
 *    an expiry check, AND declares getCertificate return type via Omit<> excluding
 *    cert_password_enc and storage_path (type-level secret exclusion — INFO 9 / T-07-18)
 * 3. ai-agent-config.ts contains assertNotReadOnly + L0..L4 enum + admin gate
 * 4. MODULE_PERMISSIONS: every READ_ONLY_ROLES member has readOnly:true on their modules;
 *    all 11 roles present; auditor.financeiro readOnly; socio.financeiro readOnly;
 *    socio.bi readOnly; socio.config readOnly (WARNING 6 — /config/perfis visible to governance)
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── Paths ────────────────────────────────────────────────────────────────────

const CERT_ACTION_PATH = resolve(process.cwd(), 'src/actions/certificate.ts')
const AI_ACTION_PATH = resolve(process.cwd(), 'src/actions/ai-agent-config.ts')

// ─── Schema imports (pure, no DB) ─────────────────────────────────────────────

import { certificateSchema, MAX_CERT_SIZE_BYTES } from '@/lib/validators/certificate'
import { MODULE_PERMISSIONS } from '@/proxy'

// ─── certificateSchema — size + type validation ───────────────────────────────

describe('certificateSchema — file validation', () => {
  const validInput = {
    filename: 'meu-cert.pfx',
    sizeBytes: 1024 * 100, // 100 KB
    password: 'senha-segura',
  }

  it('accepts a valid .pfx ≤5 MB', () => {
    const result = certificateSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('accepts a valid .p12 ≤5 MB', () => {
    const result = certificateSchema.safeParse({ ...validInput, filename: 'cert.p12' })
    expect(result.success).toBe(true)
  })

  it('accepts .PFX with uppercase extension (case-insensitive)', () => {
    const result = certificateSchema.safeParse({ ...validInput, filename: 'CERT.PFX' })
    expect(result.success).toBe(true)
  })

  it('rejects a file >5 MB', () => {
    const result = certificateSchema.safeParse({
      ...validInput,
      sizeBytes: MAX_CERT_SIZE_BYTES + 1,
    })
    expect(result.success).toBe(false)
    const msg = result.success ? '' : result.error.errors[0]?.message ?? ''
    expect(msg).toMatch(/5 MB/)
  })

  it('rejects exactly MAX_CERT_SIZE_BYTES + 1', () => {
    const result = certificateSchema.safeParse({
      ...validInput,
      sizeBytes: MAX_CERT_SIZE_BYTES + 1,
    })
    expect(result.success).toBe(false)
  })

  it('accepts exactly MAX_CERT_SIZE_BYTES', () => {
    const result = certificateSchema.safeParse({
      ...validInput,
      sizeBytes: MAX_CERT_SIZE_BYTES,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a .pdf extension', () => {
    const result = certificateSchema.safeParse({ ...validInput, filename: 'cert.pdf' })
    expect(result.success).toBe(false)
    const msg = result.success ? '' : result.error.errors[0]?.message ?? ''
    expect(msg).toMatch(/\.pfx|\.p12/i)
  })

  it('rejects a .zip extension', () => {
    const result = certificateSchema.safeParse({ ...validInput, filename: 'cert.zip' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty password', () => {
    const result = certificateSchema.safeParse({ ...validInput, password: '' })
    expect(result.success).toBe(false)
    const msg = result.success ? '' : result.error.errors[0]?.message ?? ''
    expect(msg).toMatch(/senha/i)
  })

  it('rejects an empty filename', () => {
    const result = certificateSchema.safeParse({ ...validInput, filename: '' })
    expect(result.success).toBe(false)
  })
})

// ─── certificate.ts source-inspection: security assertions ────────────────────

describe('src/actions/certificate.ts — security assertions', () => {
  it('file exists', () => {
    expect(existsSync(CERT_ACTION_PATH)).toBe(true)
  })

  it('calls assertNotReadOnly', () => {
    const src = readFileSync(CERT_ACTION_PATH, 'utf8')
    expect(src).toMatch(/assertNotReadOnly/)
  })

  it('calls encrypt( to AES-encrypt the password', () => {
    const src = readFileSync(CERT_ACTION_PATH, 'utf8')
    expect(src).toMatch(/encrypt\(/)
  })

  it('references icp-certificates bucket', () => {
    const src = readFileSync(CERT_ACTION_PATH, 'utf8')
    expect(src).toMatch(/icp-certificates/)
  })

  it('uses createAdminClient for service-role bucket upload', () => {
    const src = readFileSync(CERT_ACTION_PATH, 'utf8')
    expect(src).toMatch(/createAdminClient/)
  })

  it('rejects expired certs (not_after < now check)', () => {
    const src = readFileSync(CERT_ACTION_PATH, 'utf8')
    // Check for a comparison involving not_after and current date
    expect(src).toMatch(/not_after\s*<\s*new Date\(\)/)
  })

  it('calls extractPfxMetadata to parse the .pfx', () => {
    const src = readFileSync(CERT_ACTION_PATH, 'utf8')
    expect(src).toMatch(/extractPfxMetadata/)
  })

  it('logs a business event without password or path (audit without secrets)', () => {
    const src = readFileSync(CERT_ACTION_PATH, 'utf8')
    expect(src).toMatch(/logBusinessEvent/)
    // Details object must NOT include cert_password_enc or storage_path
    // We verify no secret field appears in the logBusinessEvent call block
    expect(src).not.toMatch(/cert_password_enc.*logBusinessEvent|logBusinessEvent.*cert_password_enc/)
  })

  it('gates on admin/superadmin/ti roles', () => {
    const src = readFileSync(CERT_ACTION_PATH, 'utf8')
    expect(src).toMatch(/'ti'/)
    expect(src).toMatch(/'admin'/)
    expect(src).toMatch(/'superadmin'/)
  })

  /**
   * INFO 9 / T-07-18: getCertificate return type MUST exclude cert_password_enc
   * and storage_path at the TYPE LEVEL — not just omitted at runtime.
   * The Omit<..., 'cert_password_enc' | 'storage_path'> (or CertificatePublic alias)
   * is a compile-time guarantee that secrets never reach the client.
   */
  it('declares getCertificate return type that excludes cert_password_enc and storage_path via Omit<> (INFO 9)', () => {
    const src = readFileSync(CERT_ACTION_PATH, 'utf8')
    // Must contain Omit< referencing both secret fields
    expect(src).toMatch(/Omit</)
    expect(src).toMatch(/cert_password_enc/)
    expect(src).toMatch(/storage_path/)
    // The exclusion must be declared (Omit<..., 'cert_password_enc' | 'storage_path'>)
    expect(src).toMatch(/Omit<[^>]*cert_password_enc[^>]*storage_path|Omit<[^>]*storage_path[^>]*cert_password_enc/)
  })

  it('exports getCertificate', () => {
    const src = readFileSync(CERT_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export async function getCertificate/)
  })

  it('exports uploadCertificate', () => {
    const src = readFileSync(CERT_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export async function uploadCertificate/)
  })
})

// ─── ai-agent-config.ts source-inspection ────────────────────────────────────

describe('src/actions/ai-agent-config.ts — security assertions', () => {
  it('file exists', () => {
    expect(existsSync(AI_ACTION_PATH)).toBe(true)
  })

  it('calls assertNotReadOnly', () => {
    const src = readFileSync(AI_ACTION_PATH, 'utf8')
    expect(src).toMatch(/assertNotReadOnly/)
  })

  it('contains L0..L4 autonomy level enum (via import from types file)', () => {
    // The enum is in the types file; the action imports and uses AUTONOMY_LEVELS
    const src = readFileSync(AI_ACTION_PATH, 'utf8')
    expect(src).toMatch(/AUTONOMY_LEVELS/)
  })

  it('gates on admin + superadmin role', () => {
    const src = readFileSync(AI_ACTION_PATH, 'utf8')
    expect(src).toMatch(/\['admin',\s*'superadmin'\]/)
  })

  it('upserts with onConflict clinic_id,agent_key (matches partial unique index)', () => {
    const src = readFileSync(AI_ACTION_PATH, 'utf8')
    expect(src).toMatch(/onConflict.*clinic_id,agent_key/)
  })

  it('exports listAiAgentConfig', () => {
    const src = readFileSync(AI_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export async function listAiAgentConfig/)
  })

  it('exports saveAiAgentConfig', () => {
    const src = readFileSync(AI_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export async function saveAiAgentConfig/)
  })

  it('calls logBusinessEvent for audit trail', () => {
    const src = readFileSync(AI_ACTION_PATH, 'utf8')
    expect(src).toMatch(/logBusinessEvent/)
  })

  it('L0..L4 enum is defined in the types file', () => {
    const typesPath = resolve(process.cwd(), 'src/lib/ai-agent-config-types.ts')
    expect(existsSync(typesPath)).toBe(true)
    const src = readFileSync(typesPath, 'utf8')
    // All 5 levels must be present
    expect(src).toMatch(/'L0'/)
    expect(src).toMatch(/'L1'/)
    expect(src).toMatch(/'L2'/)
    expect(src).toMatch(/'L3'/)
    expect(src).toMatch(/'L4'/)
  })
})

// ─── MODULE_PERMISSIONS: read-only matrix assertions ─────────────────────────

describe('MODULE_PERMISSIONS — role × module matrix (proxy.ts)', () => {
  const ALL_ROLES = [
    'superadmin', 'admin', 'dentist', 'receptionist', 'patient',
    'dpo', 'auditor', 'socio', 'ti', 'implantacao', 'aluno',
  ] as const

  it('contains all 11 roles', () => {
    for (const role of ALL_ROLES) {
      expect(MODULE_PERMISSIONS).toHaveProperty(role)
    }
  })

  // ── Auditor read-only assertions ──────────────────────────────────────────

  it('auditor.clinica is readOnly', () => {
    expect(MODULE_PERMISSIONS.auditor.clinica?.readOnly).toBe(true)
  })

  it('auditor.financeiro is readOnly (WARNING 6)', () => {
    expect(MODULE_PERMISSIONS.auditor.financeiro?.readOnly).toBe(true)
  })

  it('auditor.bi is readOnly', () => {
    expect(MODULE_PERMISSIONS.auditor.bi?.readOnly).toBe(true)
  })

  it('auditor has NO config access', () => {
    // auditor cannot access /config — redirected by proxy
    expect(MODULE_PERMISSIONS.auditor.config).toBeUndefined()
  })

  // ── DPO read-only assertions ──────────────────────────────────────────────

  it('dpo.clinica is readOnly', () => {
    expect(MODULE_PERMISSIONS.dpo.clinica?.readOnly).toBe(true)
  })

  it('dpo.config is readOnly', () => {
    expect(MODULE_PERMISSIONS.dpo.config?.readOnly).toBe(true)
  })

  it('dpo.bi is readOnly', () => {
    expect(MODULE_PERMISSIONS.dpo.bi?.readOnly).toBe(true)
  })

  // ── Sócio read-only assertions (WARNING 6: socio can VIEW /config) ────────

  it('socio.financeiro is readOnly', () => {
    expect(MODULE_PERMISSIONS.socio.financeiro?.readOnly).toBe(true)
  })

  it('socio.bi is readOnly', () => {
    expect(MODULE_PERMISSIONS.socio.bi?.readOnly).toBe(true)
  })

  /**
   * WARNING 6: socio has config readOnly — this means /config/perfis
   * is accessible to sócios as a governance read-only view.
   * If this assertion fails, the perfis page would incorrectly deny sócios.
   */
  it('socio.config is readOnly (WARNING 6 — /config/perfis visible to governance)', () => {
    expect(MODULE_PERMISSIONS.socio.config?.allowed).toBe(true)
    expect(MODULE_PERMISSIONS.socio.config?.readOnly).toBe(true)
  })

  // ── Admin and superadmin have full config access ──────────────────────────

  it('admin.config is allowed (not readOnly)', () => {
    expect(MODULE_PERMISSIONS.admin.config?.allowed).toBe(true)
    expect(MODULE_PERMISSIONS.admin.config?.readOnly).toBeUndefined()
  })

  it('superadmin has access to all 7 modules', () => {
    const modules = ['clinica', 'config', 'superadmin', 'paciente', 'financeiro', 'ia', 'bi'] as const
    for (const mod of modules) {
      expect(MODULE_PERMISSIONS.superadmin[mod]?.allowed).toBe(true)
    }
  })

  // ── TI access ─────────────────────────────────────────────────────────────

  it('ti.config is allowed (not readOnly — TI can upload certs)', () => {
    expect(MODULE_PERMISSIONS.ti.config?.allowed).toBe(true)
    expect(MODULE_PERMISSIONS.ti.config?.readOnly).toBeUndefined()
  })

  // ── Operational roles are NOT read-only (they have full allowed access) ───

  it('dentist and receptionist are NOT readOnly on their modules', () => {
    expect(MODULE_PERMISSIONS.dentist.clinica?.readOnly).toBeUndefined()
    expect(MODULE_PERMISSIONS.receptionist.clinica?.readOnly).toBeUndefined()
  })
})
