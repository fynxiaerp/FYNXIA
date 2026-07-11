/**
 * Phase 17 — estoque/stock-entries.test.ts
 *
 * Source-inspection tests for src/actions/stock-entries.ts + the atomic entry RPC.
 *
 * NOTE (WR-04): a entrada de estoque foi movida para um RPC atômico
 * (public.create_stock_entry, migration 20260711000100) — lote + entrada +
 * recálculo de custo médio móvel rodam numa única transação com FOR UPDATE no
 * produto. Por isso a fórmula do custo médio e o insert de product_batches são
 * inspecionados na migration, não mais no arquivo .ts. A Server Action apenas
 * valida (Zod + role gate) e delega ao RPC.
 *
 * Checks:
 * - EST-01: Server Action delega ao RPC atômico create_stock_entry (WR-04)
 * - EST-01/D-02: RPC calcula custo médio móvel e cria product_batches
 * - EST-01: custo-medio.ts exporta calcularCustoMedioMovel (lib pura — usada no preview client)
 *
 * Convention: SRC(relPath) returns '' if file missing — RED on content, not ENOENT.
 *
 * Phase: 17-estoque-materiais / Plan 01 (updated for WR-04 code-review fix)
 * Requirements: EST-01
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('server-only', () => ({}))

// ─── SRC helper ──────────────────────────────────────────────────────────────

function SRC(relPath: string): string {
  const absPath = resolve(process.cwd(), relPath)
  try {
    return readFileSync(absPath, 'utf8')
  } catch {
    return ''
  }
}

// ─── stock-entries.ts source-inspection ──────────────────────────────────────

describe('src/actions/stock-entries.ts source-inspection (EST-01)', () => {
  const src = SRC('src/actions/stock-entries.ts')

  it("has 'use server' directive (required for Server Actions)", () => {
    expect(src).toMatch(/'use server'/)
  })

  it('delegates the entry to the atomic create_stock_entry RPC (WR-04)', () => {
    expect(src).toMatch(/create_stock_entry/)
  })

  it('references stock_entries (records the entry / lists history)', () => {
    expect(src).toMatch(/stock_entries/)
  })
})

// ─── create_stock_entry RPC migration source-inspection (EST-01, D-02, WR-04) ─
// A fórmula do custo médio móvel e a criação do lote vivem no RPC atômico.

describe('create_stock_entry RPC migration source-inspection (EST-01, D-02)', () => {
  const src = SRC('supabase/migrations/20260711000100_stock_entry_rpc.sql')

  it('creates the create_stock_entry function', () => {
    expect(src).toMatch(/FUNCTION public\.create_stock_entry/)
  })

  it('computes moving-average cost (D-02: weighted average on each entry)', () => {
    expect(src).toMatch(/v_saldo_atual \* v_custo_anterior/)
  })

  it('creates a product_batches record per entry (D-11)', () => {
    expect(src).toMatch(/INSERT INTO public\.product_batches/)
  })

  it('serializes concurrent entries with FOR UPDATE on the product row (WR-04)', () => {
    expect(src).toMatch(/FOR UPDATE/)
  })
})

// ─── custo-medio.ts lib source-inspection ────────────────────────────────────
// Lib pura ainda usada no preview client-side (StockEntryFormDialog).

describe('src/lib/stock/custo-medio.ts source-inspection (EST-01, D-02)', () => {
  const src = SRC('src/lib/stock/custo-medio.ts')

  it('exports calcularCustoMedioMovel function (pure lib)', () => {
    expect(src).toMatch(/calcularCustoMedioMovel/)
  })
})
