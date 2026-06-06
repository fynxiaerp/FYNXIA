'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { isMoney2dp } from '@/lib/validators/charge'

// ─── Helper: get authenticated actor ────────────────────────────────────────
// Reuses the getActor pattern from src/actions/appointments.ts

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

// ─── Zod schema ──────────────────────────────────────────────────────────────
// FIN-02: manual transaction entry — receita/despesa, category, value, date

const transactionSchema = z.object({
  type: z.enum(['receita', 'despesa'], {
    errorMap: () => ({ message: 'Tipo inválido (receita ou despesa)' }),
  }),
  categoryId: z.string().uuid('Categoria inválida').optional().nullable(),
  amount: z
    .number()
    .positive('Valor deve ser maior que zero')
    .refine(isMoney2dp, { message: 'Valor deve ter no máximo 2 casas decimais' }),
  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)'),
  description: z.string().max(500).optional().nullable(),
})

type TransactionInput = z.infer<typeof transactionSchema>

// ─── createTransaction ────────────────────────────────────────────────────────
// FIN-02: manual cash entry — INSERT into financial_transactions scoped to tenant.
// T-3-ui-E: role gate (admin/dentist/receptionist/superadmin)
// T-3-ui-V: Zod validation + amount parsed as number (not string)

export async function createTransaction(input: TransactionInput): Promise<{
  success: boolean
  id?: string
  error?: string
}> {
  // 1. Validate input
  const parsed = transactionSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  // 2. Auth + role gate (T-3-ui-E)
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const allowedRoles = ['admin', 'dentist', 'receptionist', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para lançar transação' }
  }

  const supabase = await createClient()

  // 3. INSERT into financial_transactions (tenant_id from actor — RLS handles isolation)
  const { data: tx, error: insertError } = await supabase
    .from('financial_transactions')
    .insert({
      tenant_id: actor.tenant_id,
      type: data.type,
      category_id: data.categoryId ?? null,
      amount: data.amount,
      transaction_date: data.transactionDate,
      description: data.description ?? null,
      posted_by: actor.id,
    })
    .select('id')
    .single()

  if (insertError || !tx) {
    return { success: false, error: insertError?.message ?? 'Erro ao salvar lançamento' }
  }

  // 4. Audit log
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'transaction.created',
    details: {
      transaction_id: tx.id,
      type: data.type,
      amount: data.amount,
    },
  })

  return { success: true, id: tx.id }
}

// ─── listTransactions ─────────────────────────────────────────────────────────
// FIN-01: cash flow — SELECT financial_transactions scoped to a given month.
// RLS enforces tenant isolation automatically via createClient (authenticated session).

export interface TransactionRow {
  id: string
  type: string
  amount: number
  transaction_date: string
  description: string | null
  category_id: string | null
  category_name: string | null
  posted_by: string | null
}

export async function listTransactions(month: string): Promise<{
  success: boolean
  transactions?: TransactionRow[]
  totals?: { entradas: number; saidas: number; saldo: number }
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  // WR-07: `month` is user-controlled (searchParams). Validate strict YYYY-MM before
  // deriving the range — otherwise '2026-13' or '2026-6' produce a wrong range or a
  // malformed Postgres date string.
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return { success: false, error: 'Mês inválido (YYYY-MM)' }
  }

  // Derive month range: e.g. '2026-06' → '2026-06-01' to '2026-06-30'
  // Safe: the regex above guarantees both parts parse to valid numbers.
  const year = Number(month.slice(0, 4))
  const mon = Number(month.slice(5, 7))
  const from = `${month}-01`
  const lastDay = new Date(year, mon, 0).getDate()
  const to = `${month}-${String(lastDay).padStart(2, '0')}`

  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('financial_transactions')
    .select(
      `id, type, amount, transaction_date, description, category_id, posted_by,
       financial_categories(name)`
    )
    .gte('transaction_date', from)
    .lte('transaction_date', to)
    .order('transaction_date', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  const transactions: TransactionRow[] = (rows ?? []).map((row: {
    id: string
    type: string
    amount: number
    transaction_date: string
    description: string | null
    category_id: string | null
    posted_by: string | null
    financial_categories: { name: string } | { name: string }[] | null
  }) => {
    const catJoin = row.financial_categories
    const categoryName = catJoin
      ? (Array.isArray(catJoin) ? catJoin[0]?.name : catJoin.name) ?? null
      : null
    return {
      id: row.id,
      type: row.type,
      amount: row.amount,
      transaction_date: row.transaction_date,
      description: row.description,
      category_id: row.category_id,
      category_name: categoryName,
      posted_by: row.posted_by,
    }
  })

  // Compute totals (regime de caixa, D-08)
  const entradas = transactions
    .filter((t) => t.type === 'receita')
    .reduce((sum, t) => sum + t.amount, 0)
  const saidas = transactions
    .filter((t) => t.type === 'despesa')
    .reduce((sum, t) => sum + t.amount, 0)
  const saldo = entradas - saidas

  return { success: true, transactions, totals: { entradas, saidas, saldo } }
}

// ─── listCategories ───────────────────────────────────────────────────────────
// D-05: categories from seeded financial_categories table.

export interface CategoryRow {
  id: string
  name: string
  type: string | null
}

export async function listCategories(): Promise<{
  success: boolean
  categories?: CategoryRow[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('financial_categories')
    .select('id, name, type')
    .order('name')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, categories: data ?? [] }
}
