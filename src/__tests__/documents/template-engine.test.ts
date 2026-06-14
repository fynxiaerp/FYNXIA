/**
 * Template engine — behavior tests (RED until Plan 02 implements the module)
 *
 * Imports { fillTemplate, detectVariables } from @/lib/documents/template-engine.
 * This module does not exist yet — these tests are RED by design and turn GREEN
 * when Plan 02 delivers src/lib/documents/template-engine.ts.
 *
 * tsc note: if the missing import breaks tsc --noEmit, the import line carries
 * a @ts-expect-error comment. Vitest runs the test fine either way (module-not-found
 * is a runtime error, not a typecheck error when the file doesn't exist).
 *
 * Phase: 08-documentos-assinatura-icp-brasil / Plan 01 (Wave 0 RED scaffold)
 * DOC-01: fillTemplate + detectVariables behavior contract
 */

import { describe, it, expect } from 'vitest'

// @ts-expect-error not-yet-implemented: src/lib/documents/template-engine.ts created in Plan 02
import { fillTemplate, detectVariables } from '@/lib/documents/template-engine'

// ─── detectVariables ──────────────────────────────────────────────────────────

describe('detectVariables', () => {
  it('extracts unique variable names in order of first appearance', () => {
    const result = detectVariables(
      'Olá {{nome_paciente}}, hoje é {{data}}. {{nome_paciente}} de novo'
    )
    // deduped, order of first appearance: nome_paciente, data
    expect(result).toEqual(['nome_paciente', 'data'])
  })

  it('returns empty array for content with no placeholders', () => {
    expect(detectVariables('Sem variáveis aqui.')).toEqual([])
  })

  it('handles multiple different variables', () => {
    const result = detectVariables('{{a}} {{b}} {{c}}')
    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('deduplicates repeated variables', () => {
    const result = detectVariables('{{x}} {{x}} {{x}}')
    expect(result).toEqual(['x'])
  })
})

// ─── fillTemplate ─────────────────────────────────────────────────────────────

describe('fillTemplate', () => {
  it('replaces a single placeholder with the context value', () => {
    const result = fillTemplate('Olá {{nome_paciente}}', { nome_paciente: 'Ana' })
    expect(result).toBe('Olá Ana')
  })

  it('leaves missing keys as verbatim placeholders', () => {
    const result = fillTemplate('{{x}} {{y}}', { x: 'A' })
    expect(result).toBe('A {{y}}')
  })

  it('replaces ALL occurrences of the same variable (global replace)', () => {
    const result = fillTemplate(
      '{{nome_paciente}} assinou. {{nome_paciente}} confirmou.',
      { nome_paciente: 'Carlos' }
    )
    expect(result).toBe('Carlos assinou. Carlos confirmou.')
  })

  it('handles multiple different variables in one template', () => {
    const result = fillTemplate(
      'Paciente: {{nome_paciente}}, Clínica: {{nome_clinica}}',
      { nome_paciente: 'Maria', nome_clinica: 'OdontoFlex' }
    )
    expect(result).toBe('Paciente: Maria, Clínica: OdontoFlex')
  })

  it('returns the original string unchanged when context is empty', () => {
    const template = 'Olá {{nome_paciente}}'
    const result = fillTemplate(template, {})
    expect(result).toBe('Olá {{nome_paciente}}')
  })
})
