'use server'
import 'server-only'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Helper: get authenticated actor ────────────────────────────────────────
// Verbatim copy from src/actions/receivables.ts (getActor pattern)

type Actor = {
  id: string
  tenant_id: string
  role: string
}

async function getActor(): Promise<{ actor: Actor } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Não autenticado' }
  }

  const { data: actor, error: actorError } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (actorError || !actor) {
    return { error: 'Usuário não encontrado' }
  }

  return { actor }
}

// ─── Role gate ───────────────────────────────────────────────────────────────
// D-23: writers = admin + superadmin

const WRITER_ROLES = ['admin', 'superadmin'] as const

// ─── Money helper ─────────────────────────────────────────────────────────────

const isMoney2dp = (v: number): boolean =>
  Number.isFinite(v) && Number(v.toFixed(2)) === v

// ─── recorrenteSchema ─────────────────────────────────────────────────────────
// Inline Zod v3 schema — no .default() (D-133)

const recorrenteSchema = z.object({
  supplierId: z.string().uuid('ID do fornecedor inválido').optional().nullable(),

  accountId: z.string().uuid('ID da conta contábil inválido'),

  costCenterId: z.string().uuid('ID do centro de custo inválido'),

  unitId: z.string().uuid('ID da unidade inválido').optional().nullable(),

  descricao: z.string().min(1, 'Descrição obrigatória').max(500),

  valor: z
    .number()
    .positive('Valor deve ser maior que zero')
    .refine(isMoney2dp, { message: 'Valor deve ter no máximo 2 casas decimais' }),

  diaVencimento: z
    .number()
    .int('Dia de vencimento deve ser inteiro')
    .min(1, 'Mínimo dia 1')
    .max(28, 'Máximo dia 28 (garantido em todos os meses)'),
})

type RecorrenteInput = z.infer<typeof recorrenteSchema>

// ─── createRecorrenteTemplate ─────────────────────────────────────────────────
// Insert a recurring CP template scoped to the authenticated tenant

export async function createRecorrenteTemplate(input: RecorrenteInput): Promise<{
  success: boolean
  templateId?: string
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const parsed = recorrenteSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const supabase = await createClient()

  const { data: row, error: insertError } = await supabase
    .from('recorrente_templates')
    .insert({
      clinic_id: actor.tenant_id,
      supplier_id: data.supplierId ?? null,
      account_id: data.accountId,
      cost_center_id: data.costCenterId,
      unit_id: data.unitId ?? null,
      descricao: data.descricao,
      valor: data.valor,
      dia_vencimento: data.diaVencimento,
      ativo: true,
    })
    .select('id')
    .single()

  if (insertError || !row) {
    return { success: false, error: insertError?.message ?? 'Erro ao criar template recorrente' }
  }

  revalidatePath('/clinica/financeiro/contas-a-pagar')

  return { success: true, templateId: row.id }
}

// ─── listRecorrenteTemplates ──────────────────────────────────────────────────
// Returns all templates (ativo + inactive) scoped to tenant via RLS

export async function listRecorrenteTemplates(): Promise<{
  success: boolean
  templates?: {
    id: string
    descricao: string
    valor: number
    dia_vencimento: number
    ativo: boolean | null
    supplier_id: string | null
    account_id: string
    cost_center_id: string
    unit_id: string | null
  }[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('recorrente_templates')
    .select('id, descricao, valor, dia_vencimento, ativo, supplier_id, account_id, cost_center_id, unit_id')
    .order('descricao', { ascending: true })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, templates: data ?? [] }
}

// ─── updateRecorrenteTemplate ─────────────────────────────────────────────────

export async function updateRecorrenteTemplate(
  id: string,
  input: RecorrenteInput
): Promise<{ success: boolean; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const parsed = recorrenteSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const supabase = await createClient()

  const { error } = await supabase
    .from('recorrente_templates')
    .update({
      supplier_id: data.supplierId ?? null,
      account_id: data.accountId,
      cost_center_id: data.costCenterId,
      unit_id: data.unitId ?? null,
      descricao: data.descricao,
      valor: data.valor,
      dia_vencimento: data.diaVencimento,
    })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/clinica/financeiro/contas-a-pagar')

  return { success: true }
}

// ─── deactivateRecorrenteTemplate ─────────────────────────────────────────────
// Soft deactivate — keeps template row for history

export async function deactivateRecorrenteTemplate(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('recorrente_templates')
    .update({ ativo: false })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/clinica/financeiro/contas-a-pagar')

  return { success: true }
}

// ─── generateRecorrentePayables ───────────────────────────────────────────────
// D-02b: for the given competência (YYYY-MM), for each ativo template,
// create ONE payable origem='recorrente' + single installment.
// IDEMPOTENT per (recorrente_template_id, competencia) — T-16-25.
// When clinicId is passed (by cron), processes only that clinic.
// When clinicId is omitted, uses actor.tenant_id (user-initiated action).

export async function generateRecorrentePayables(
  competencia: string,
  clinicId?: string
): Promise<{
  success: boolean
  created?: number
  skipped?: number
  error?: string
}> {
  // Validate competencia format (YYYY-MM)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
    return { success: false, error: 'Competência inválida (YYYY-MM)' }
  }

  // Determine clinic scope AND client.
  // IN-02 fix: the cron path (clinicId provided, already authorized by CRON_SECRET)
  // has NO user session, so an RLS-scoped anon client would have its inserts silently
  // blocked by the write-by-role policies. Use the service-role admin client there.
  // The user-initiated path keeps the RLS-scoped client (clinic_id from actor.tenant_id).
  let targetClinicId: string
  let supabase: ReturnType<typeof createAdminClient>

  if (clinicId) {
    // Called by cron with service role — clinic provided externally
    targetClinicId = clinicId
    supabase = createAdminClient()
  } else {
    // Called by authenticated user — scope to their tenant
    const actorResult = await getActor()
    if ('error' in actorResult) {
      return { success: false, error: actorResult.error }
    }
    const { actor } = actorResult

    if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
      return { success: false, error: 'Sem permissão para esta operação' }
    }

    targetClinicId = actor.tenant_id
    supabase = (await createClient()) as unknown as ReturnType<typeof createAdminClient>
  }

  // Fetch all ativo templates for this clinic
  const { data: templates, error: templatesError } = await supabase
    .from('recorrente_templates')
    .select('id, supplier_id, account_id, cost_center_id, unit_id, descricao, valor, dia_vencimento')
    .eq('clinic_id', targetClinicId)
    .eq('ativo', true)

  if (templatesError) {
    return { success: false, error: templatesError.message }
  }

  if (!templates || templates.length === 0) {
    return { success: true, created: 0, skipped: 0 }
  }

  // Compute the year/month for due date calculation
  const [year, month] = competencia.split('-').map(Number)

  let created = 0
  let skipped = 0

  for (const template of templates) {
    // Idempotency check: skip if a payable with (recorrente_template_id, competencia) already exists (T-16-25)
    const { data: existing } = await supabase
      .from('payables')
      .select('id')
      .eq('recorrente_template_id', template.id)
      .eq('competencia', competencia)
      .maybeSingle()

    if (existing) {
      skipped++
      continue
    }

    // Compute due_date: competência + dia_vencimento, clamped to ≤28
    const diaVenc = Math.min(template.dia_vencimento, 28)
    const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`

    // Insert payable origem='recorrente'
    const { data: payable, error: payableError } = await supabase
      .from('payables')
      .insert({
        clinic_id: targetClinicId,
        supplier_id: template.supplier_id ?? null,
        account_id: template.account_id,
        cost_center_id: template.cost_center_id,
        unit_id: template.unit_id ?? null,
        descricao: template.descricao,
        valor_total: template.valor,
        origem: 'recorrente',
        recorrente_template_id: template.id,
        competencia,
        status: 'pendente',
      })
      .select('id')
      .single()

    if (payableError || !payable) {
      console.error(
        `[generateRecorrentePayables] Failed to insert payable for template ${template.id}:`,
        payableError?.message
      )
      continue
    }

    // Single installment
    const { error: installError } = await supabase
      .from('payable_installments')
      .insert({
        clinic_id: targetClinicId,
        payable_id: payable.id,
        numero: 1,
        valor: template.valor,
        due_date: dueDate,
        status: 'pendente',
      })

    if (installError) {
      console.error(
        `[generateRecorrentePayables] Failed to insert installment for payable ${payable.id}:`,
        installError.message
      )
      continue
    }

    created++
  }

  return { success: true, created, skipped }
}
