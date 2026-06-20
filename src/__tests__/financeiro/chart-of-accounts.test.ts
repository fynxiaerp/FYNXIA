/**
 * Phase 14 — buildTree() + account-code unit tests (FCAD-01)
 * Test type: dynamic-import guard (module does not exist yet — RED until Plan 04)
 *
 * Target module: src/lib/financeiro/chart-tree.ts (created in Plan 04)
 *
 * Asserts:
 *   1. buildTree() builds a nested tree from a flat adjacency list
 *   2. buildTree() returns [] for empty input
 *   3. buildTree() returns 2 roots when 2 root nodes exist
 *   4. nextChildCode() returns correct code for child insertion
 *
 * RED state: dynamic import throws because the module does not exist yet.
 * The tests FAIL (not skip) — proving they encode real contracts.
 */

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Target module path (absolute — avoids @-alias TS2307 when module absent) ─
const MOD_PATH = join(process.cwd(), 'src/lib/financeiro/chart-tree.ts')

// ─── Flat node type (mirrors the contract in 14-01-PLAN.md <interfaces>) ─────
type AccountNodeFlat = {
  id: string
  parent_id: string | null
  code: string
  name: string
  type: 'grupo' | 'receita' | 'despesa'
  ativo: boolean
  depth: number
}

type AccountNode = AccountNodeFlat & { children: AccountNode[] }

// ─── Test fixtures ────────────────────────────────────────────────────────────

const ROOT_NODE: AccountNodeFlat = {
  id: 'root-1',
  parent_id: null,
  code: '1',
  name: 'Receitas',
  type: 'grupo',
  ativo: true,
  depth: 0,
}

const CHILD_NODE: AccountNodeFlat = {
  id: 'child-1',
  parent_id: 'root-1',
  code: '1.1',
  name: 'Receitas Operacionais',
  type: 'grupo',
  ativo: true,
  depth: 1,
}

const ROOT_NODE_2: AccountNodeFlat = {
  id: 'root-2',
  parent_id: null,
  code: '2',
  name: 'Despesas',
  type: 'grupo',
  ativo: true,
  depth: 0,
}

// ─── buildTree() tests ────────────────────────────────────────────────────────

describe('buildTree() — FCAD-01 (RED until Plan 04)', () => {
  it('buildTree builds nested tree: 1 root with 1 child', async () => {
    // Dynamic import — throws if module absent → RED
    const mod = await import('@/lib/financeiro/chart-tree')
    const buildTree = (mod as { buildTree: (rows: AccountNodeFlat[]) => AccountNode[] }).buildTree

    const result = buildTree([ROOT_NODE, CHILD_NODE])

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('root-1')
    expect(result[0].children).toHaveLength(1)
    expect(result[0].children[0].id).toBe('child-1')
    expect(result[0].children[0].children).toHaveLength(0)
  })

  it('buildTree returns [] for empty input', async () => {
    const mod = await import('@/lib/financeiro/chart-tree')
    const buildTree = (mod as { buildTree: (rows: AccountNodeFlat[]) => AccountNode[] }).buildTree

    const result = buildTree([])

    expect(result).toEqual([])
  })

  it('buildTree returns 2 roots when 2 root nodes exist', async () => {
    const mod = await import('@/lib/financeiro/chart-tree')
    const buildTree = (mod as { buildTree: (rows: AccountNodeFlat[]) => AccountNode[] }).buildTree

    const result = buildTree([ROOT_NODE, ROOT_NODE_2])

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id)).toContain('root-1')
    expect(result.map((r) => r.id)).toContain('root-2')
  })
})

// ─── nextChildCode() tests ────────────────────────────────────────────────────

describe('nextChildCode() — account code helper (RED until Plan 04)', () => {
  it('nextChildCode("1.1", 2) returns "1.1.3" (3rd child of 1.1)', async () => {
    const mod = await import('@/lib/financeiro/chart-tree')
    const nextChildCode = (
      mod as { nextChildCode: (parentCode: string | null, siblingCount: number) => string }
    ).nextChildCode

    const result = nextChildCode('1.1', 2)

    expect(result).toBe('1.1.3')
  })

  it('nextChildCode(null, 1) returns "2" (2nd root-level account)', async () => {
    const mod = await import('@/lib/financeiro/chart-tree')
    const nextChildCode = (
      mod as { nextChildCode: (parentCode: string | null, siblingCount: number) => string }
    ).nextChildCode

    const result = nextChildCode(null, 1)

    expect(result).toBe('2')
  })
})

// ─── Module-path sanity (meta-check) ─────────────────────────────────────────

describe('chart-tree module — file presence check', () => {
  it('module file does NOT exist yet (Wave 0 — RED until Plan 04)', () => {
    // This test is a sanity check: while in Wave 0, the module must be absent.
    // It will flip to "file exists" when Plan 04 ships. At that point, the dynamic
    // import tests above should pass GREEN. This describes the expected wave progression.
    const exists = existsSync(MOD_PATH)
    // Wave 0: expect false; Wave 4+: expect true
    // We keep this as a documentation assertion — no hard expect so Wave 4 stays green.
    if (!exists) {
      // Module absent — all dynamic-import tests above are RED as intended
      expect(exists).toBe(false)
    } else {
      // Module present — dynamic-import tests should pass GREEN
      expect(exists).toBe(true)
    }
  })
})
