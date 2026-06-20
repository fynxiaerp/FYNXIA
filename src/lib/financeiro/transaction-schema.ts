// src/lib/financeiro/transaction-schema.ts
// FCAD-02: Zod classification schema for manual financial_transactions.
// NO 'use server' — pure Zod module importable from client and server contexts.
//
// D-133 / D-176: NO .default() anywhere — RHF defaultValues supplies initial values.
// Decision: accountId + costCenterId are REQUIRED uuid fields for manual transactions.
//           bankAccountId is optional/nullable (optional per D-04).

import { z } from 'zod'
import { isMoney2dp } from '@/lib/validators/charge'

// ─── transactionClassificationSchema ─────────────────────────────────────────
// Used by:
//   - src/actions/transactions.ts createTransaction (manual entry — FCAD-02 enforcement)
//   - RHF form in TransactionModal (via @hookform/resolvers v5)
//
// Fields that did NOT change from the old transactionSchema:
//   type, categoryId, amount, transactionDate, description
//
// Fields ADDED for classification (FCAD-02):
//   accountId     — required (Conta contábil obrigatória)
//   costCenterId  — required (Centro de custo obrigatório)
//   bankAccountId — optional/nullable

export const transactionClassificationSchema = z.object({
  type: z.enum(['receita', 'despesa']),
  categoryId: z.string().uuid().optional().nullable(),
  // required_error fires when field is missing/undefined; uuid message fires when present but invalid format
  accountId: z
    .string({
      required_error: 'Conta contábil obrigatória',
      invalid_type_error: 'Conta contábil obrigatória',
    })
    .uuid({ message: 'Conta contábil obrigatória' }),
  costCenterId: z
    .string({
      required_error: 'Centro de custo obrigatório',
      invalid_type_error: 'Centro de custo obrigatório',
    })
    .uuid({ message: 'Centro de custo obrigatório' }),
  bankAccountId: z.string().uuid().optional().nullable(),
  amount: z
    .number()
    .positive()
    .refine(isMoney2dp, { message: 'Valor deve ter no máximo 2 casas decimais' }),
  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)'),
  description: z.string().max(500).optional().nullable(),
})

export type TransactionClassificationInput = z.infer<typeof transactionClassificationSchema>
