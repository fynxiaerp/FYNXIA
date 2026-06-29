// seed-uat-clinic.js
// Insere dados de teste na clínica de demo (marcio@fynxia.com.br) para UAT da Fase 16.
// Idempotente: verifica existência antes de inserir.
//
// Uso:
//   node scripts/seed-uat-clinic.js
//
// Requer .env.local com:
//   NEXT_PUBLIC_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Variáveis ausentes: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.')
  console.error('    Copie .env.local.example → .env.local e preencha os valores reais.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_EMAIL = 'marcio@fynxia.com.br'

async function main() {
  console.log(`\n🌱  Seed UAT — clínica de teste: ${TEST_EMAIL}\n`)

  // ── 1. Resolve clinic_id via users.tenant_id ──────────────────────────────
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('email', TEST_EMAIL)
    .single()

  if (userErr || !user) {
    console.error('❌  Usuário não encontrado:', userErr?.message)
    process.exit(1)
  }

  const clinicId = user.tenant_id
  console.log(`   clinic_id: ${clinicId}`)

  // ── 2. Unidade (obrigatória para cost_centers) ────────────────────────────
  let unitId
  const { data: existingUnit } = await supabase
    .from('units')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('slug', 'principal-uat')
    .maybeSingle()

  if (existingUnit) {
    unitId = existingUnit.id
    console.log(`   unit já existe:          ${unitId}`)
  } else {
    const { data: newUnit, error: unitErr } = await supabase
      .from('units')
      .insert({
        clinic_id:  clinicId,
        name:       'Clínica Principal UAT',
        slug:       'principal-uat',
        is_default: true,
        ativo:      true,
      })
      .select('id')
      .single()

    if (unitErr || !newUnit) {
      console.error('❌  Erro ao criar unidade:', unitErr?.message)
      process.exit(1)
    }
    unitId = newUnit.id
    console.log(`✅  unit criada:            ${unitId}`)
  }

  // ── 3. Centro de Custo ────────────────────────────────────────────────────
  let costCenterId
  const { data: existingCC } = await supabase
    .from('cost_centers')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('unit_id', unitId)
    .eq('name', 'Clínica Geral UAT')
    .maybeSingle()

  if (existingCC) {
    costCenterId = existingCC.id
    console.log(`   cost_center já existe:   ${costCenterId}`)
  } else {
    const { data: newCC, error: ccErr } = await supabase
      .from('cost_centers')
      .insert({
        clinic_id:  clinicId,
        unit_id:    unitId,
        name:       'Clínica Geral UAT',
        is_default: true,
        ativo:      true,
      })
      .select('id')
      .single()

    if (ccErr || !newCC) {
      console.error('❌  Erro ao criar centro de custo:', ccErr?.message)
      process.exit(1)
    }
    costCenterId = newCC.id
    console.log(`✅  cost_center criado:     ${costCenterId}`)
  }

  // ── 4. Fornecedor ─────────────────────────────────────────────────────────
  let supplierId
  const { data: existingSupplier } = await supabase
    .from('suppliers')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('name', 'Fornecedor Teste UAT')
    .is('deleted_at', null)
    .maybeSingle()

  if (existingSupplier) {
    supplierId = existingSupplier.id
    console.log(`   supplier já existe:      ${supplierId}`)
  } else {
    const { data: newSupplier, error: supplierErr } = await supabase
      .from('suppliers')
      .insert({
        clinic_id: clinicId,
        name:      'Fornecedor Teste UAT',
        tipo:      'servico',
        ativo:     true,
      })
      .select('id')
      .single()

    if (supplierErr || !newSupplier) {
      console.error('❌  Erro ao criar fornecedor:', supplierErr?.message)
      process.exit(1)
    }
    supplierId = newSupplier.id
    console.log(`✅  supplier criado:        ${supplierId}`)
  }

  // ── 5. Conta Contábil ─────────────────────────────────────────────────────
  let accountId
  const { data: existingAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('code', '4.1.01')
    .maybeSingle()

  if (existingAccount) {
    accountId = existingAccount.id
    console.log(`   chart_account já existe: ${accountId}`)
  } else {
    const { data: newAccount, error: accountErr } = await supabase
      .from('chart_of_accounts')
      .insert({
        clinic_id: clinicId,
        code:      '4.1.01',
        name:      'Despesas Operacionais UAT',
        type:      'despesa',
        ativo:     true,
      })
      .select('id')
      .single()

    if (accountErr || !newAccount) {
      console.error('❌  Erro ao criar conta contábil:', accountErr?.message)
      process.exit(1)
    }
    accountId = newAccount.id
    console.log(`✅  chart_account criado:   ${accountId}`)
  }

  // ── 6. Conta Corrente ─────────────────────────────────────────────────────
  let bankId
  const { data: existingBank } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('name', 'Conta Corrente UAT')
    .maybeSingle()

  if (existingBank) {
    bankId = existingBank.id
    console.log(`   bank_account já existe:  ${bankId}`)
  } else {
    const { data: newBank, error: bankErr } = await supabase
      .from('bank_accounts')
      .insert({
        clinic_id:     clinicId,
        name:          'Conta Corrente UAT',
        banco:         'Banco Teste UAT',
        saldo_inicial: 1000.00,
        saldo_atual:   1000.00,
        ativo:         true,
      })
      .select('id')
      .single()

    if (bankErr || !newBank) {
      console.error('❌  Erro ao criar conta corrente:', bankErr?.message)
      process.exit(1)
    }
    bankId = newBank.id
    console.log(`✅  bank_account criado:    ${bankId}`)
  }

  // ── Resumo ────────────────────────────────────────────────────────────────
  console.log('\n── IDs de referência ────────────────────────────────────────────')
  console.log(`   clinic_id:     ${clinicId}`)
  console.log(`   unit_id:       ${unitId}`)
  console.log(`   cost_center:   ${costCenterId}`)
  console.log(`   supplier:      ${supplierId}`)
  console.log(`   chart_account: ${accountId}`)
  console.log(`   bank_account:  ${bankId}`)
  console.log('\n✅  Seed completo.')
  console.log('   Próximo passo: acesse fynxia.vercel.app/clinica/financeiro/contas-a-pagar')
  console.log('   → Nova Conta a Pagar → preencher todos os campos → Salvar')
  console.log('   → Registrar Pagamento com valor < total para testar baixa parcial\n')
}

main().catch((err) => {
  console.error('❌  Erro inesperado:', err.message)
  process.exit(1)
})
