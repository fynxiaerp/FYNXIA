// src/lib/agents/stock-agent.ts
// EST-03 — Agente de compras L2: ao detectar saldo <= estoque_minimo, cria rascunho
// de CP (payables, origem='estoque_agente') + approval_request quando o produto tem
// preferred_supplier_id + estoque_maximo configurados. Caso contrário, apenas gera
// um stock_alert tipo='minimo' para aparecer no banner (D-15).
//
// GOVERNANÇA (Phase 10, AIG-01/02): withAgentPolicy é chamado com o clinicId REAL do
// produto/unidade — nunca null/agregado (Pitfall 3 do 17-RESEARCH.md, mirrors
// collection-agent.ts). agentKey='stock_replenishment' precisa estar seedado em
// ai_agent_config (autonomy_level L2) para o agente executar em vez de apenas sugerir.
//
// requested_by NULL = ator de sistema (Plan 02 tornou approval_requests.requested_by
// nullable — Open Question 2 do RESEARCH resolvida).
//
// DEDUP DIÁRIA DE ALERTAS (deviation da migration): o índice único
// uq_stock_alerts_daily usa a expressão ((created_at AT TIME ZONE 'America/Sao_Paulo')::date),
// que o cliente supabase-js NÃO consegue expressar como onConflict target (PostgREST
// upsert só aceita nomes de coluna, não expressões). insertStockAlert portanto checa
// a existência de um alerta já criado no dia corrente (fuso America/Sao_Paulo) ANTES
// de inserir, com um catch defensivo do erro 23505 como rede de segurança contra
// corrida (o índice único continua sendo o backstop atômico no banco).
import 'server-only'

import { withAgentPolicy } from '@/lib/ai/policy'
import { createAdminClient } from '@/lib/supabase/admin'
import { logBusinessEvent } from '@/lib/audit'

type AdminClient = ReturnType<typeof createAdminClient>

// ─── insertStockAlert ──────────────────────────────────────────────────────────

/**
 * Brasil não observa horário de verão desde 2019 — America/Sao_Paulo é UTC-3 fixo.
 * Calcula os limites [00:00, 24:00) do dia corrente em fuso de São Paulo, expressos
 * como instantes UTC, para filtrar `stock_alerts.created_at` (timestamptz) sem
 * depender de funções de data não-IMMUTABLE em índice (mirrors a nota da migration).
 */
function saoPauloDayBoundsUTC(now: Date = new Date()): { startUTC: string; endUTC: string } {
  const SP_OFFSET_MS = 3 * 60 * 60 * 1000 // UTC-3 fixo (sem DST)
  const spWallClock = new Date(now.getTime() - SP_OFFSET_MS)
  const y = spWallClock.getUTCFullYear()
  const m = spWallClock.getUTCMonth()
  const d = spWallClock.getUTCDate()
  const startUTC = new Date(Date.UTC(y, m, d, 0, 0, 0) + SP_OFFSET_MS)
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000)
  return { startUTC: startUTC.toISOString(), endUTC: endUTC.toISOString() }
}

/**
 * insertStockAlert — insere um alerta de estoque (tipo 'minimo' ou 'validade'),
 * idempotente por produto/unidade/tipo/dia (fuso America/Sao_Paulo).
 *
 * NÃO propaga erro — uma falha de alerta não pode quebrar a baixa de estoque nem
 * o cron de validade que a chamam (mesmo padrão de resiliência de logBusinessEvent).
 */
export async function insertStockAlert(
  clinicId: string,
  unitId: string,
  productId: string,
  tipo: 'minimo' | 'validade',
  batchId: string | null = null,
): Promise<void> {
  const admin: AdminClient = createAdminClient()
  const { startUTC, endUTC } = saoPauloDayBoundsUTC()

  try {
    // 1. Checagem de idempotência diária (aplicação) — evita insert desnecessário.
    const { data: existing, error: existingError } = await admin
      .from('stock_alerts')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('unit_id', unitId)
      .eq('product_id', productId)
      .eq('tipo', tipo)
      .gte('created_at', startUTC)
      .lt('created_at', endUTC)
      .limit(1)
      .maybeSingle()

    if (existingError) {
      console.error('[stock-agent] insertStockAlert: failed to check existing alert:', existingError.message)
      // Segue para o insert — o índice único é o backstop atômico.
    }

    if (existing) {
      return // já existe alerta hoje para este produto/unidade/tipo — idempotente, no-op
    }

    // 2. Insert — se outro processo inseriu entre a checagem e este insert, o índice
    //    único uq_stock_alerts_daily rejeita com 23505; capturamos e ignoramos.
    const { error: insertError } = await admin.from('stock_alerts').insert({
      clinic_id: clinicId,
      unit_id: unitId,
      product_id: productId,
      batch_id: batchId,
      tipo,
    })

    if (insertError) {
      if (insertError.code === '23505') {
        return // corrida com outro insert no mesmo dia — idempotência preservada
      }
      console.error('[stock-agent] insertStockAlert: insert failed:', insertError.message)
    }
  } catch (err) {
    // Nunca propagar — alerta é best-effort (não pode quebrar baixa/cron chamadores)
    console.error('[stock-agent] insertStockAlert: unexpected error:', err)
  }
}

// ─── runStockReplenishmentAgent ─────────────────────────────────────────────────

/**
 * runStockReplenishmentAgent — agente de compras L2 (EST-03, D-15).
 *
 * Chamado após uma baixa de estoque detectar saldo <= estoque_minimo (D-14, real-time,
 * fora do escopo deste plano — o chamador resolve isso). clinicId DEVE ser o tenant
 * real do produto/unidade (Pitfall 3 — nunca null/agregado).
 *
 * - Sem preferred_supplier_id OU sem estoque_maximo: apenas insere stock_alert
 *   tipo='minimo' (sem criar CP) — D-15.
 * - Com ambos configurados: cria rascunho de payable (origem='estoque_agente') +
 *   approval_request (inbox humano, Fase 10) + stock_alert tipo='minimo'.
 */
export async function runStockReplenishmentAgent(params: {
  clinicId: string
  unitId: string
  productId: string
  productName: string
  saldoAtual: number
  estoqueMinimo: number
  estoqueMaximo: number | null
  preferredSupplierId: string | null
}): Promise<void> {
  const { clinicId, unitId, productId, productName, saldoAtual, estoqueMaximo, preferredSupplierId } = params

  await withAgentPolicy(
    {
      clinicId,
      agentKey: 'stock_replenishment',
      actorId: null, // ator de sistema — sem sessão de usuário
      action: 'agent.stock.create_draft_cp',
      actionSensitivity: 'reversible', // rascunho de CP é reversível (pode ser rejeitado na aprovação)
    },
    async () => {
      const admin: AdminClient = createAdminClient()

      // Sem fornecedor preferido OU sem estoque máximo configurado: apenas alerta (D-15)
      if (!preferredSupplierId || !estoqueMaximo) {
        await insertStockAlert(clinicId, unitId, productId, 'minimo')
        return { _created: false }
      }

      const qtdReposicao = estoqueMaximo - saldoAtual

      // Criar rascunho de CP — origem='estoque_agente' (CHECK constraint estendido no Plan 02)
      const { data: payable, error: payableError } = await admin
        .from('payables')
        .insert({
          clinic_id: clinicId,
          unit_id: unitId,
          supplier_id: preferredSupplierId,
          descricao: `Reposição automática: ${productName} (${qtdReposicao} un)`,
          valor_total: 0, // admin ajusta antes de aprovar
          origem: 'estoque_agente',
          status: 'pendente',
        })
        .select('id')
        .single()

      if (payableError || !payable) {
        console.error('[stock-agent] Failed to create draft payable:', payableError?.message)
        await insertStockAlert(clinicId, unitId, productId, 'minimo')
        return { _created: false }
      }

      // Criar approval_request — inbox de aprovação humana (Fase 10). requested_by=null
      // = ator de sistema (Plan 02 tornou a coluna nullable — Open Question 2 resolvida).
      const { error: approvalError } = await admin.from('approval_requests').insert({
        clinic_id: clinicId,
        type: 'ai_action',
        payload: { payable_id: payable.id, product_id: productId },
        agent_key: 'stock_replenishment',
        required_role: 'admin',
        requested_by: null,
        status: 'pending',
      })

      if (approvalError) {
        console.error('[stock-agent] Failed to create approval_request:', approvalError.message)
      }

      // Alerta na UI (banner de estoque) além do rascunho de CP
      await insertStockAlert(clinicId, unitId, productId, 'minimo')

      await logBusinessEvent({
        tenantId: clinicId,
        actorId: null,
        action: 'agent.stock.draft_cp_created',
        details: { product_id: productId, payable_id: payable.id, qtd_reposicao: qtdReposicao },
      })

      return { _created: true }
    },
  )
}
