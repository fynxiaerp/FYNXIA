/**
 * Template variable engine — pure functions, no dependencies, no 'use server'.
 *
 * Fills {{variable}} placeholders in document template content from a context
 * object, and detects which variables are present in a template string.
 *
 * Design (08-RESEARCH Pattern 2):
 *   - Zero runtime dependencies: built-in JS regex, no handlebars/mustache/nunjucks.
 *   - Global replace: all occurrences of a repeated variable are replaced.
 *   - Missing keys: unresolved placeholders are left verbatim (not emptied).
 *   - detectVariables: deduplicates, preserves first-appearance order.
 *
 * Safe to import in both server and client contexts (no 'use server' directive).
 *
 * Phase: 08-documentos-assinatura-icp-brasil (DOC-01)
 */

import type { DocumentContext } from './document-types'

/**
 * Replaces all {{variable}} placeholders in `content` with values from `ctx`.
 * If a key is not present in `ctx` (or its value is undefined), the placeholder
 * is left verbatim in the output — it is NOT replaced with an empty string.
 *
 * @example
 *   fillTemplate('Olá {{nome_paciente}}', { nome_paciente: 'Ana' })
 *   // => 'Olá Ana'
 *
 *   fillTemplate('{{x}} {{y}}', { x: 'A' })
 *   // => 'A {{y}}'
 */
export function fillTemplate(content: string, ctx: DocumentContext): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return ctx[key] ?? match
  })
}

/**
 * Extracts all unique {{variable}} names from `content`, in order of first
 * appearance. Repeated occurrences of the same variable produce one entry.
 *
 * @example
 *   detectVariables('{{a}} {{b}} {{a}}')
 *   // => ['a', 'b']
 *
 *   detectVariables('Sem variáveis.')
 *   // => []
 */
export function detectVariables(content: string): string[] {
  const matches = [...content.matchAll(/\{\{(\w+)\}\}/g)]
  return [...new Set(matches.map((m) => m[1]).filter((v): v is string => v !== undefined))]
}
