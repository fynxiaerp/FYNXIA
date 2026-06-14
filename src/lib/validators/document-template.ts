/**
 * Validator: document template create/edit
 *
 * Phase 8 (DOC-01):
 * - documentTemplateSchema validates the fields for creating or updating a
 *   document template (name, category, content, is_active).
 * - category defaults to 'outro' when empty.
 * - content max length set conservatively at 20000 chars (rich-text/markdown).
 *
 * Safe to import in both server and client contexts (no 'use server' directive).
 */
import { z } from 'zod'

export const documentTemplateSchema = z.object({
  name: z
    .string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(120, 'Nome deve ter no máximo 120 caracteres'),
  category: z
    .string()
    .min(1, 'Categoria é obrigatória')
    .default('outro'),
  content: z
    .string()
    .min(1, 'Conteúdo é obrigatório')
    .max(20000, 'Conteúdo deve ter no máximo 20.000 caracteres'),
  is_active: z.boolean().default(true),
})

export type DocumentTemplateInput = z.infer<typeof documentTemplateSchema>
