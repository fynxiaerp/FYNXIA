/**
 * Phase 17 — estoque/produto-schema.test.ts (Task 1 TDD)
 *
 * Tests for Zod v3 schemas in src/lib/validators/product.ts
 *
 * Covers:
 * - EST-01: productSchema validates by category (implante requires ANVISA)
 * - EST-01: stockEntrySchema validates by category (implante/medicamento require validade)
 * - EST-02: stockDrawSchema validates motivo + qtd > 0
 * - EST-02: serviceMaterialTemplateSchema validates qtd_padrao > 0
 *
 * T-17-01: productSchema.superRefine rejects implante without numero_anvisa_produto
 * T-17-02: stockDrawSchema.enum rejects invalid motivo
 *
 * Phase: 17-estoque-materiais / Plan 01
 * Requirements: EST-01, EST-02, EST-03
 */

import { describe, it, expect } from 'vitest'
import {
  productSchema,
  stockEntrySchema,
  stockDrawSchema,
  serviceMaterialTemplateSchema,
} from '@/lib/validators/product'

const VALID_UUID = '00000000-0000-4000-8000-000000000001'

// ─── productSchema ────────────────────────────────────────────────────────────

describe('productSchema', () => {
  it('rejeita implante sem numero_anvisa_produto (T-17-01)', () => {
    const result = productSchema.safeParse({
      name: 'Implante Osstem',
      category: 'implante',
      unidade_medida: 'un',
      estoque_minimo: 0,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('numero_anvisa_produto')
    }
  })

  it('aceita implante com numero_anvisa_produto preenchido', () => {
    const result = productSchema.safeParse({
      name: 'Implante Osstem',
      category: 'implante',
      unidade_medida: 'un',
      estoque_minimo: 0,
      numero_anvisa_produto: '12345.678901/2024-001',
    })
    expect(result.success).toBe(true)
  })

  it('aceita insumo sem numero_anvisa_produto', () => {
    const result = productSchema.safeParse({
      name: 'Luva Nitrila',
      category: 'insumo',
      unidade_medida: 'cx',
      estoque_minimo: 5,
    })
    expect(result.success).toBe(true)
  })

  it('rejeita name ausente', () => {
    const result = productSchema.safeParse({
      category: 'insumo',
      unidade_medida: 'un',
      estoque_minimo: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejeita category inválida', () => {
    const result = productSchema.safeParse({
      name: 'Produto',
      category: 'kit' as 'insumo',
      unidade_medida: 'un',
      estoque_minimo: 0,
    })
    expect(result.success).toBe(false)
  })
})

// ─── stockEntrySchema ─────────────────────────────────────────────────────────

describe('stockEntrySchema', () => {
  it('rejeita implante sem numero_anvisa_lote e data_validade', () => {
    const result = stockEntrySchema.safeParse({
      product_id: VALID_UUID,
      numero_lote: 'L001',
      qtd: 10,
      custo_unitario: 5.5,
      categoria_produto: 'implante',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('data_validade')
      expect(paths).toContain('numero_anvisa_lote')
    }
  })

  it('aceita insumo sem data_validade e sem numero_anvisa_lote', () => {
    const result = stockEntrySchema.safeParse({
      product_id: VALID_UUID,
      numero_lote: 'L001',
      qtd: 10,
      custo_unitario: 5.5,
      categoria_produto: 'insumo',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita medicamento sem data_validade', () => {
    const result = stockEntrySchema.safeParse({
      product_id: VALID_UUID,
      numero_lote: 'L002',
      qtd: 5,
      custo_unitario: 12.0,
      categoria_produto: 'medicamento',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('data_validade')
    }
  })

  it('aceita implante completo com todos os campos obrigatórios', () => {
    const result = stockEntrySchema.safeParse({
      product_id: VALID_UUID,
      numero_lote: 'L001',
      qtd: 10,
      custo_unitario: 5.5,
      categoria_produto: 'implante',
      data_validade: '2027-12-31',
      numero_anvisa_lote: '80219350002',
    })
    expect(result.success).toBe(true)
  })
})

// ─── stockDrawSchema ──────────────────────────────────────────────────────────

describe('stockDrawSchema', () => {
  it('rejeita qtd igual a 0 (deve ser > 0)', () => {
    const result = stockDrawSchema.safeParse({
      product_id: VALID_UUID,
      qtd: 0,
      motivo: 'perda',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('qtd')
    }
  })

  it('aceita baixa válida com qtd > 0 e motivo válido', () => {
    const result = stockDrawSchema.safeParse({
      product_id: VALID_UUID,
      qtd: 2,
      motivo: 'perda',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita motivo inválido (T-17-02)', () => {
    const result = stockDrawSchema.safeParse({
      product_id: VALID_UUID,
      qtd: 1,
      motivo: 'extravio' as 'perda',
    })
    expect(result.success).toBe(false)
  })
})

// ─── serviceMaterialTemplateSchema ───────────────────────────────────────────

describe('serviceMaterialTemplateSchema', () => {
  it('rejeita qtd_padrao igual a 0', () => {
    const result = serviceMaterialTemplateSchema.safeParse({
      service_id: VALID_UUID,
      product_id: VALID_UUID,
      qtd_padrao: 0,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('qtd_padrao')
    }
  })

  it('aceita template válido com qtd_padrao > 0', () => {
    const result = serviceMaterialTemplateSchema.safeParse({
      service_id: VALID_UUID,
      product_id: VALID_UUID,
      qtd_padrao: 2,
    })
    expect(result.success).toBe(true)
  })
})
