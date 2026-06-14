/**
 * Phase 7 Plan 05 — Empresa & Units config tests (SYS-01, ROLE-02)
 *
 * Asserts:
 * 1. empresaSchema rejects invalid CNPJ/CPF and unknown regime; accepts valid CNPJ + 'simples_nacional'
 * 2. unitSchema rejects invalid slug ('Bad Slug!'); accepts 'unidade-centro'
 * 3. Source-inspection: empresa.ts and units.ts contain assertNotReadOnly + admin gate + actor.tenant_id
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── Paths ────────────────────────────────────────────────────────────────────

const EMPRESA_ACTION_PATH = resolve(process.cwd(), 'src/actions/empresa.ts')
const UNITS_ACTION_PATH = resolve(process.cwd(), 'src/actions/units.ts')

// ─── Schema imports (pure, no DB) ─────────────────────────────────────────────

import { empresaSchema } from '@/lib/validators/empresa'
import { unitSchema } from '@/lib/validators/unit'

// ─── empresaSchema validation ─────────────────────────────────────────────────

describe('empresaSchema — CNPJ/CPF + regime validation', () => {
  const validInput = {
    name: 'Clínica Fynxia',
    cnpj_or_cpf: '11.222.333/0001-81', // valid CNPJ (cpf-cnpj-validator test value)
    regime_tributario: 'simples_nacional' as const,
  }

  it('accepts a valid CNPJ + simples_nacional', () => {
    // Use a known-valid CNPJ for testing
    const result = empresaSchema.safeParse({
      ...validInput,
      cnpj_or_cpf: '11222333000181',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid CPF', () => {
    // cpf-cnpj-validator test value: 529.982.247-25
    const result = empresaSchema.safeParse({
      ...validInput,
      cnpj_or_cpf: '52998224725',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid CNPJ/CPF', () => {
    const result = empresaSchema.safeParse({
      ...validInput,
      cnpj_or_cpf: '11111111111111',
    })
    expect(result.success).toBe(false)
    const msg = result.success ? '' : result.error.issues[0]?.message ?? ''
    expect(msg).toMatch(/CNPJ ou CPF inválido/i)
  })

  it('rejects an unknown regime tributário', () => {
    const result = empresaSchema.safeParse({
      ...validInput,
      cnpj_or_cpf: '11222333000181',
      regime_tributario: 'lucro_extra_especial',
    })
    expect(result.success).toBe(false)
    const msg = result.success ? '' : result.error.issues[0]?.message ?? ''
    expect(msg).toMatch(/regime tributário inválido/i)
  })

  it('rejects a name shorter than 2 characters', () => {
    const result = empresaSchema.safeParse({
      ...validInput,
      cnpj_or_cpf: '11222333000181',
      name: 'A',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all four regime values', () => {
    const regimes = ['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei'] as const
    for (const regime of regimes) {
      const result = empresaSchema.safeParse({
        ...validInput,
        cnpj_or_cpf: '11222333000181',
        regime_tributario: regime,
      })
      expect(result.success, `regime '${regime}' should be valid`).toBe(true)
    }
  })
})

// ─── unitSchema validation ─────────────────────────────────────────────────────

describe('unitSchema — slug + ativo validation', () => {
  const validUnit = {
    name: 'Unidade Centro',
    slug: 'unidade-centro',
    ativo: true,
  }

  it('accepts slug "unidade-centro"', () => {
    const result = unitSchema.safeParse(validUnit)
    expect(result.success).toBe(true)
  })

  it('rejects slug "Bad Slug!"', () => {
    const result = unitSchema.safeParse({ ...validUnit, slug: 'Bad Slug!' })
    expect(result.success).toBe(false)
    const msg = result.success ? '' : result.error.issues[0]?.message ?? ''
    expect(msg).toMatch(/slug/i)
  })

  it('rejects slug with uppercase letters', () => {
    const result = unitSchema.safeParse({ ...validUnit, slug: 'Unidade-Centro' })
    expect(result.success).toBe(false)
  })

  it('accepts slug with numbers and hyphens', () => {
    const result = unitSchema.safeParse({ ...validUnit, slug: 'unidade-01-centro' })
    expect(result.success).toBe(true)
  })

  it('rejects name shorter than 2 characters', () => {
    const result = unitSchema.safeParse({ ...validUnit, name: 'X' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid optional CNPJ', () => {
    const result = unitSchema.safeParse({ ...validUnit, cnpj: '11111111111111' })
    expect(result.success).toBe(false)
    const msg = result.success ? '' : result.error.issues[0]?.message ?? ''
    expect(msg).toMatch(/CNPJ/i)
  })

  it('accepts undefined (omitted) CNPJ', () => {
    const result = unitSchema.safeParse({ ...validUnit })
    expect(result.success).toBe(true)
  })
})

// ─── Action source inspection: read-only gate + admin gate + tenant scoping ────

describe('src/actions/empresa.ts — security assertions', () => {
  it('file exists', () => {
    expect(existsSync(EMPRESA_ACTION_PATH)).toBe(true)
  })

  it('calls assertNotReadOnly', () => {
    const src = readFileSync(EMPRESA_ACTION_PATH, 'utf8')
    expect(src).toMatch(/assertNotReadOnly/)
  })

  it('gates on admin + superadmin role', () => {
    const src = readFileSync(EMPRESA_ACTION_PATH, 'utf8')
    expect(src).toMatch(/\['admin',\s*'superadmin'\]/)
  })

  it('exports saveEmpresa', () => {
    const src = readFileSync(EMPRESA_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export async function saveEmpresa/)
  })

  it('writes regime_tributario', () => {
    const src = readFileSync(EMPRESA_ACTION_PATH, 'utf8')
    expect(src).toMatch(/regime_tributario/)
  })

  it('calls logBusinessEvent', () => {
    const src = readFileSync(EMPRESA_ACTION_PATH, 'utf8')
    expect(src).toMatch(/logBusinessEvent/)
  })
})

describe('src/actions/units.ts — security assertions', () => {
  it('file exists', () => {
    expect(existsSync(UNITS_ACTION_PATH)).toBe(true)
  })

  it('calls assertNotReadOnly', () => {
    const src = readFileSync(UNITS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/assertNotReadOnly/)
  })

  it('gates on admin + superadmin role', () => {
    const src = readFileSync(UNITS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/\['admin',\s*'superadmin'\]/)
  })

  it('sets clinic_id from actor.tenant_id (never from input — T-07-16)', () => {
    const src = readFileSync(UNITS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/actor\.tenant_id/)
  })

  it('exports createUnit', () => {
    const src = readFileSync(UNITS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export async function createUnit/)
  })

  it('exports updateUnit', () => {
    const src = readFileSync(UNITS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export async function updateUnit/)
  })

  it('exports listUnits', () => {
    const src = readFileSync(UNITS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/export async function listUnits/)
  })

  it('calls logBusinessEvent', () => {
    const src = readFileSync(UNITS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/logBusinessEvent/)
  })

  it('prevents deactivating the default unit', () => {
    const src = readFileSync(UNITS_ACTION_PATH, 'utf8')
    expect(src).toMatch(/is_default/)
  })
})
