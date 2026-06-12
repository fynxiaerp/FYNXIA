/**
 * page-pattern.test.ts — Wave 0 scaffold (Phase 6)
 *
 * Source-inspection test: asserts that PageHeader component exists with the
 * correct props interface, that representative pages use it, and that
 * loading.tsx + error.tsx files exist for key route segments.
 * Uses readFileSync + existsSync — NEVER imports app modules.
 *
 * Status: RED-by-design until 06-04 builds PageHeader and loading/error files.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function read(rel: string): string {
  const p = resolve(process.cwd(), rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

function fileExists(rel: string): boolean {
  return existsSync(resolve(process.cwd(), rel))
}

// ---------------------------------------------------------------------------
// PageHeader component — contract assertions
// ---------------------------------------------------------------------------

describe('PageHeader.tsx — exists with required props (title, breadcrumbs, actions)', () => {
  const pageHeader = read('src/components/shell/PageHeader.tsx')

  it('file exists', () => {
    expect(fileExists('src/components/shell/PageHeader.tsx')).toBe(true)
  })

  it('declares title prop', () => {
    expect(pageHeader).toMatch(/title/)
  })

  it('declares breadcrumbs prop', () => {
    expect(pageHeader).toMatch(/breadcrumbs/)
  })

  it('declares actions prop', () => {
    expect(pageHeader).toMatch(/actions/)
  })
})

// ---------------------------------------------------------------------------
// Representative pages — must import/use PageHeader
// ---------------------------------------------------------------------------

describe('Pacientes page — imports and uses PageHeader', () => {
  const page = read('src/app/(dashboard)/clinica/pacientes/page.tsx')

  it('file exists', () => {
    expect(fileExists('src/app/(dashboard)/clinica/pacientes/page.tsx')).toBe(true)
  })

  it('references PageHeader', () => {
    expect(page).toMatch(/PageHeader/)
  })
})

describe('Financeiro / Fluxo de Caixa page — imports and uses PageHeader', () => {
  const page = read('src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx')

  it('file exists', () => {
    expect(fileExists('src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx')).toBe(true)
  })

  it('references PageHeader', () => {
    expect(page).toMatch(/PageHeader/)
  })
})

describe('Equipe page — imports and uses PageHeader', () => {
  const page = read('src/app/(dashboard)/clinica/equipe/page.tsx')

  it('file exists', () => {
    expect(fileExists('src/app/(dashboard)/clinica/equipe/page.tsx')).toBe(true)
  })

  it('references PageHeader', () => {
    expect(page).toMatch(/PageHeader/)
  })
})

describe('IA / Agentes page — imports and uses PageHeader', () => {
  const page = read('src/app/(dashboard)/clinica/ia/agentes/page.tsx')

  it('file exists', () => {
    expect(fileExists('src/app/(dashboard)/clinica/ia/agentes/page.tsx')).toBe(true)
  })

  it('references PageHeader', () => {
    expect(page).toMatch(/PageHeader/)
  })
})

// ---------------------------------------------------------------------------
// loading.tsx — must exist for key route segments
// ---------------------------------------------------------------------------

describe('loading.tsx — exists for key authenticated route segments', () => {
  const segments = [
    'src/app/(dashboard)/clinica/pacientes/loading.tsx',
    'src/app/(dashboard)/clinica/agenda/loading.tsx',
    'src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/loading.tsx',
    'src/app/(dashboard)/clinica/financeiro/contas-a-receber/loading.tsx',
    'src/app/(dashboard)/clinica/equipe/loading.tsx',
    'src/app/(dashboard)/clinica/ia/agentes/loading.tsx',
  ]

  for (const seg of segments) {
    it(`loading.tsx exists: ${seg}`, () => {
      expect(fileExists(seg)).toBe(true)
    })
  }
})

// ---------------------------------------------------------------------------
// error.tsx — must exist for the same key route segments
// ---------------------------------------------------------------------------

describe('error.tsx — exists for key authenticated route segments', () => {
  const segments = [
    'src/app/(dashboard)/clinica/pacientes/error.tsx',
    'src/app/(dashboard)/clinica/agenda/error.tsx',
    'src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/error.tsx',
    'src/app/(dashboard)/clinica/financeiro/contas-a-receber/error.tsx',
    'src/app/(dashboard)/clinica/equipe/error.tsx',
    'src/app/(dashboard)/clinica/ia/agentes/error.tsx',
  ]

  for (const seg of segments) {
    it(`error.tsx exists: ${seg}`, () => {
      expect(fileExists(seg)).toBe(true)
    })
  }
})

// ---------------------------------------------------------------------------
// EmptyState — shared primitive
// ---------------------------------------------------------------------------

describe('EmptyState.tsx — exists and references icon prop + title + description', () => {
  const emptyState = read('src/components/shell/EmptyState.tsx')

  it('file exists', () => {
    expect(fileExists('src/components/shell/EmptyState.tsx')).toBe(true)
  })

  it('has title prop/reference', () => {
    expect(emptyState).toMatch(/title/)
  })

  it('has description prop/reference', () => {
    expect(emptyState).toMatch(/description/)
  })

  it('accepts an icon prop (Lucide icon pattern)', () => {
    // The component receives an icon prop — could be named 'icon' or 'Icon'
    expect(emptyState).toMatch(/[Ii]con/)
  })
})
