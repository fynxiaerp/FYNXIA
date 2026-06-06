'use server'
import { createClient } from '@/lib/supabase/server'

// ─── Helper: get authenticated actor ────────────────────────────────────────

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

// ─── ReceivableRow ─────────────────────────────────────────────────────────────
// D-04: DO NOT compute vencido server-side — return raw status + due_date.
// The ReceivablesTable client component derives display status via deriveReceivableStatus.

export interface ReceivableRow {
  id: string
  charge_id: string
  patient_id: string
  patient_name: string | null
  description: string | null
  provider_charge_id: string | null
  installment_number: number
  installment_count: number   // total parcels in the charge
  value: number
  due_date: string            // YYYY-MM-DD — raw, NOT derived
  status: string              // 'pendente' | 'pago' | 'estornado' — NOT 'vencido'
  billing_type: string | null
}

export interface ReceivableFilters {
  status?: string | null
  from?: string | null
  to?: string | null
}

// ─── listReceivables ──────────────────────────────────────────────────────────
// FIN-03: receivables list with installment grouping data.
// T-3-ui-I: RLS handles tenant isolation via createClient (authenticated session).
// D-04: status column contains only DB-stored values ('pendente','pago','estornado').
//       'vencido' is derived client-side in ReceivablesTable.

export async function listReceivables(filters?: ReceivableFilters): Promise<{
  success: boolean
  receivables?: ReceivableRow[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  let query = supabase
    .from('receivables')
    .select(
      `id, charge_id, patient_id, provider_charge_id, installment_number, value, due_date, status,
       charges!inner(installment_count, description, billing_type),
       patients(full_name)`
    )
    .order('due_date', { ascending: true })

  // Apply optional filters (client passes pre-validated strings)
  if (filters?.status && filters.status !== 'vencido') {
    // 'vencido' is a derived display state — cannot filter by it in DB
    query = query.eq('status', filters.status)
  }
  if (filters?.from) {
    query = query.gte('due_date', filters.from)
  }
  if (filters?.to) {
    query = query.lte('due_date', filters.to)
  }

  const { data: rows, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  const receivables: ReceivableRow[] = (rows ?? []).map((row: {
    id: string
    charge_id: string
    patient_id: string
    provider_charge_id: string | null
    installment_number: number
    value: number
    due_date: string
    status: string
    charges: { installment_count: number; description: string | null; billing_type: string | null } | { installment_count: number; description: string | null; billing_type: string | null }[] | null
    patients: { full_name: string } | { full_name: string }[] | null
  }) => {
    const charge = row.charges
      ? (Array.isArray(row.charges) ? row.charges[0] : row.charges)
      : null
    const patient = row.patients
      ? (Array.isArray(row.patients) ? row.patients[0] : row.patients)
      : null

    return {
      id: row.id,
      charge_id: row.charge_id,
      patient_id: row.patient_id,
      patient_name: patient?.full_name ?? null,
      description: charge?.description ?? null,
      provider_charge_id: row.provider_charge_id,
      installment_number: row.installment_number,
      installment_count: charge?.installment_count ?? 1,
      value: row.value,
      due_date: row.due_date,
      status: row.status,   // raw DB value — 'vencido' derived client-side (D-04)
      billing_type: charge?.billing_type ?? null,
    }
  })

  return { success: true, receivables }
}
