// src/lib/financeiro/budget-schema.ts
// REP-02 (Plan 19-05): Zod schema for budget target rows (Orçamento).
// NO 'use server' — pure Zod module importable from client and server contexts.
//
// D-133/D-176: NO .default() anywhere — RHF defaultValues (future Orçamento screen,
// Plan 11) supplies initial values; .default() creates an RHF v7 + resolvers v5
// input/output type mismatch (mirrors transactionClassificationSchema, documentTemplateSchema).
//
// D-12/D-13: one budgetTargetSchema payload = 1 conta contábil × 1 unidade (ou rede) ×
// 1 ano, com os 12 valores mensais editáveis em bloco.

import { z } from 'zod'

export const budgetTargetSchema = z.object({
  accountId: z
    .string({
      required_error: 'Conta contábil obrigatória',
      invalid_type_error: 'Conta contábil obrigatória',
    })
    .uuid({ message: 'Conta contábil obrigatória' }),
  // unitId absent/null = meta consolidada de rede (budget_targets.unit_id IS NULL, Plan 03)
  unitId: z.string().uuid({ message: 'Unidade inválida' }).nullable().optional(),
  ano: z
    .number({ required_error: 'Ano obrigatório', invalid_type_error: 'Ano obrigatório' })
    .int('Ano inválido')
    .min(2020, 'Ano inválido')
    .max(2100, 'Ano inválido'),
  meses: z
    .array(
      z.object({
        mes: z.number().int('Mês inválido').min(1, 'Mês inválido').max(12, 'Mês inválido'),
        valor: z.number({ invalid_type_error: 'Valor inválido' }).min(0, 'Valor não pode ser negativo'),
      })
    )
    .length(12, 'Orçamento deve conter os 12 meses do ano'),
})

export type BudgetTargetInput = z.infer<typeof budgetTargetSchema>
