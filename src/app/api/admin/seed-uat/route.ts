/**
 * GET /api/admin/seed-uat
 *
 * Rota temporária de seed para UAT da Fase 16.
 * Insere os dados mínimos para a clínica de teste (marcio@fynxia.com.br)
 * poder criar Contas a Pagar e testar baixa parcial.
 *
 * SEGURANÇA: protegida pelo mesmo CRON_SECRET das rotas cron.
 * Invocar: GET /api/admin/seed-uat
 *          Authorization: Bearer <CRON_SECRET>
 *
 * IDEMPOTENTE: verifica existência antes de inserir (maybeSingle → skip).
 * REMOVER após concluir o UAT.
 */

export const runtime = 'nodejs'

import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/cron-auth'

const TEST_EMAIL = 'marcio@fynxia.com.br'

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const log: string[] = []

  // 1. clinic_id
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('email', TEST_EMAIL)
    .single()

  if (userErr || !user) {
    return Response.json({ error: 'Usuário não encontrado', detail: userErr?.message }, { status: 500 })
  }
  const clinicId = user.tenant_id
  log.push(`clinic_id: ${clinicId}`)

  // 2. Unidade
  let unitId: string
  const { data: existingUnit } = await supabase
    .from('units')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('slug', 'principal-uat')
    .maybeSingle()

  if (existingUnit) {
    unitId = existingUnit.id
    log.push(`unit já existe: ${unitId}`)
  } else {
    const { data: newUnit, error: unitErr } = await supabase
      .from('units')
      .insert({ clinic_id: clinicId, name: 'Clínica Principal UAT', slug: 'principal-uat', is_default: true, ativo: true })
      .select('id')
      .single()
    if (unitErr || !newUnit) return Response.json({ error: 'Erro ao criar unit', detail: unitErr?.message }, { status: 500 })
    unitId = newUnit.id
    log.push(`unit criada: ${unitId}`)
  }

  // 3. Centro de Custo
  let costCenterId: string
  const { data: existingCC } = await supabase
    .from('cost_centers')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('unit_id', unitId)
    .eq('name', 'Clínica Geral UAT')
    .maybeSingle()

  if (existingCC) {
    costCenterId = existingCC.id
    log.push(`cost_center já existe: ${costCenterId}`)
  } else {
    const { data: newCC, error: ccErr } = await supabase
      .from('cost_centers')
      .insert({ clinic_id: clinicId, unit_id: unitId, name: 'Clínica Geral UAT', is_default: true, ativo: true })
      .select('id')
      .single()
    if (ccErr || !newCC) return Response.json({ error: 'Erro ao criar cost_center', detail: ccErr?.message }, { status: 500 })
    costCenterId = newCC.id
    log.push(`cost_center criado: ${costCenterId}`)
  }

  // 4. Fornecedor
  let supplierId: string
  const { data: existingSupplier } = await supabase
    .from('suppliers')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('name', 'Fornecedor Teste UAT')
    .is('deleted_at', null)
    .maybeSingle()

  if (existingSupplier) {
    supplierId = existingSupplier.id
    log.push(`supplier já existe: ${supplierId}`)
  } else {
    const { data: newSupplier, error: supplierErr } = await supabase
      .from('suppliers')
      .insert({ clinic_id: clinicId, name: 'Fornecedor Teste UAT', tipo: 'servico', ativo: true })
      .select('id')
      .single()
    if (supplierErr || !newSupplier) return Response.json({ error: 'Erro ao criar supplier', detail: supplierErr?.message }, { status: 500 })
    supplierId = newSupplier.id
    log.push(`supplier criado: ${supplierId}`)
  }

  // 5. Conta Contábil
  let accountId: string
  const { data: existingAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('code', '4.1.01')
    .maybeSingle()

  if (existingAccount) {
    accountId = existingAccount.id
    log.push(`chart_account já existe: ${accountId}`)
  } else {
    const { data: newAccount, error: accountErr } = await supabase
      .from('chart_of_accounts')
      .insert({ clinic_id: clinicId, code: '4.1.01', name: 'Despesas Operacionais UAT', type: 'despesa', ativo: true })
      .select('id')
      .single()
    if (accountErr || !newAccount) return Response.json({ error: 'Erro ao criar chart_account', detail: accountErr?.message }, { status: 500 })
    accountId = newAccount.id
    log.push(`chart_account criado: ${accountId}`)
  }

  // 6. Conta Corrente
  let bankId: string
  const { data: existingBank } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('name', 'Conta Corrente UAT')
    .maybeSingle()

  if (existingBank) {
    bankId = existingBank.id
    log.push(`bank_account já existe: ${bankId}`)
  } else {
    const { data: newBank, error: bankErr } = await supabase
      .from('bank_accounts')
      .insert({ clinic_id: clinicId, name: 'Conta Corrente UAT', banco: 'Banco Teste UAT', saldo_inicial: 1000.00, saldo_atual: 1000.00, ativo: true })
      .select('id')
      .single()
    if (bankErr || !newBank) return Response.json({ error: 'Erro ao criar bank_account', detail: bankErr?.message }, { status: 500 })
    bankId = newBank.id
    log.push(`bank_account criado: ${bankId}`)
  }

  return Response.json({
    ok: true,
    log,
    ids: { clinicId, unitId, costCenterId, supplierId, accountId, bankId },
  })
}
