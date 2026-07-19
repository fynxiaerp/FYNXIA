// src/lib/financeiro/partner-share-schema.ts
// REP-03 (Plan 19-06): Zod schema for a partner-share vigência set (Societário).
// NO 'use server' — pure Zod module importable from client and server contexts.
//
// D-133: NO .default() anywhere — RHF defaultValues (future Societário screen,
// Plan 12) supplies initial values; .default() creates an RHF v7 + resolvers v5
// input/output type mismatch (mirrors transactionClassificationSchema, budgetTargetSchema).
//
// One partnerShareSetSchema payload = the full set of {sócio, percentual} rows that
// become active on `vigenciaInicio` (D-20/D-22). The blocking sum-to-100% check
// (D-22) happens in the Server Action via assertSharesValid/validateSharesSumTo100 —
// this schema only validates shape.

import { z } from 'zod'

export const partnerShareSetSchema = z.object({
  vigenciaInicio: z
    .string({
      required_error: 'Data de início da vigência obrigatória',
      invalid_type_error: 'Data de início da vigência obrigatória',
    })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (AAAA-MM-DD)'),
  shares: z
    .array(
      z.object({
        userId: z.string().uuid({ message: 'Sócio inválido' }),
        percentual: z
          .number({ invalid_type_error: 'Percentual inválido' })
          .gt(0, 'Percentual deve ser maior que zero')
          .max(1, 'Percentual não pode exceder 100%'),
      })
    )
    .min(1, 'Informe ao menos um sócio'),
})

export type PartnerShareSetInput = z.infer<typeof partnerShareSetSchema>
