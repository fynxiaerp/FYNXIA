// src/lib/financeiro/kpi-target-schema.ts
// BI-01 (Plan 19-07): Zod schema for kpi_targets CRUD (src/actions/kpi-targets.ts).
// NO 'use server' — pure Zod module importable from client and server contexts.
//
// D-133: NO .default() anywhere — RHF defaultValues supplies initial values when this
// schema backs a form (mirrors budget-schema.ts / partner-share-schema.ts convention).
//
// kpiKey catalogue (application-level, no DB CHECK — extensible without migration, per
// 20260719000100_bi_tables.sql comment): 'ocupacao', 'ticket_medio', 'consultas_mes',
// 'nps', 'cpl', 'cac', 'conversao_leads', 'glosa_taxa', 'atraso_pagamento',
// 'faturamento_profissional'.
// unitId NULL = meta consolidada/rede (mirrors budget_targets unit_id nullable convention).

import { z } from 'zod'

export const kpiTargetSchema = z.object({
  kpiKey: z.string().min(1),
  unitId: z.string().uuid().nullable().optional(),
  metaValor: z.number(),
})

export type KpiTargetInput = z.infer<typeof kpiTargetSchema>
