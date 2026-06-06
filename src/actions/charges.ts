'use server'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { chargeSchema, type ChargeInput } from '@/lib/validators/charge'
import { gateway } from '@/lib/asaas/gateway'
import { AsaasError } from '@/lib/asaas/client'

// ─── Helper: get authenticated actor ────────────────────────────────────────
// Copied from src/actions/appointments.ts pattern

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

// ─── createCharge ─────────────────────────────────────────────────────────────
// FIN-04 (PIX QR), FIN-05 (boleto), FIN-06 (installments → N receivable rows)
// D-06: reuses patients.asaas_customer_id when present (Pitfall 8 — no duplicate customers)
// D-03: installments mirror each parcel as a local receivable row
// T-3-charge-E: role gate (admin/dentist/receptionist/superadmin)

export async function createCharge(input: ChargeInput): Promise<{
  success: boolean
  chargeId?: string
  pix?: { encodedImage: string; payload: string }
  bankSlipUrl?: string
  error?: string
}> {
  // 1. Validate input
  const parsed = chargeSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  // 2. Auth + role gate
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const allowedRoles = ['admin', 'dentist', 'receptionist', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para emitir cobrança' }
  }

  const supabase = await createClient()

  try {
    // 3. Load patient (scoped by RLS — tenant isolation guaranteed)
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, full_name, cpf, email, phone, asaas_customer_id')
      .eq('id', data.patientId)
      .is('deleted_at', null)
      .single()

    if (patientError || !patient) {
      return { success: false, error: 'Paciente não encontrado' }
    }

    // 4. Get or create Asaas customer (D-06, Pitfall 8)
    let asaasCustomerId: string

    if (patient.asaas_customer_id) {
      asaasCustomerId = patient.asaas_customer_id
    } else {
      // Create Asaas customer — digits-only CPF
      const cpfDigits = patient.cpf.replace(/\D/g, '')
      const { customerId } = await gateway.createCustomer({
        name: patient.full_name,
        cpfCnpj: cpfDigits,
        email: patient.email ?? undefined,
        mobilePhone: patient.phone ?? undefined,
        externalReference: patient.id,
      })
      asaasCustomerId = customerId

      // Save asaas_customer_id to patient for dedup (Pitfall 8)
      await supabase
        .from('patients')
        .update({ asaas_customer_id: customerId })
        .eq('id', patient.id)
    }

    // 5. Create charge via Asaas gateway
    const chargeResult = await gateway.createCharge({
      customer: asaasCustomerId,
      billingType: data.billingType,
      value: data.installmentCount > 1 ? undefined : data.value,
      totalValue: data.installmentCount > 1 ? data.value : undefined,
      dueDate: data.dueDate,
      description: data.description,
      installmentCount: data.installmentCount,
    })

    // 6. Insert into charges table
    const { data: charge, error: chargeInsertError } = await supabase
      .from('charges')
      .insert({
        tenant_id: actor.tenant_id,
        patient_id: patient.id,
        provider: 'asaas',
        provider_charge_id: chargeResult.chargeId,
        provider_installment_id: chargeResult.installmentId ?? null,
        billing_type: data.billingType,
        description: data.description,
        total_value: data.value,
        installment_count: data.installmentCount,
        status: 'pendente',
        created_by: actor.id,
      })
      .select('id')
      .single()

    if (chargeInsertError || !charge) {
      return { success: false, error: chargeInsertError?.message ?? 'Erro ao salvar cobrança' }
    }

    // 7. Mirror receivables
    if (data.installmentCount > 1 && chargeResult.installmentId) {
      // Fetch all parcels from Asaas (Pitfall 4 — only first parcel in creation response)
      const parcels = await gateway.getInstallmentCharges(chargeResult.installmentId)

      const receivableRows = parcels.map((parcel, idx) => ({
        tenant_id: actor.tenant_id,
        charge_id: charge.id,
        patient_id: patient.id,
        provider_charge_id: parcel.chargeId,
        installment_number: idx + 1,
        value: parcel.value ?? (data.value / data.installmentCount),
        due_date: parcel.dueDate,
        status: 'pendente',
      }))

      const { error: receivablesError } = await supabase
        .from('receivables')
        .insert(receivableRows)

      if (receivablesError) {
        return { success: false, error: receivablesError.message }
      }
    } else {
      // Single receivable
      const { error: receivableError } = await supabase
        .from('receivables')
        .insert({
          tenant_id: actor.tenant_id,
          charge_id: charge.id,
          patient_id: patient.id,
          provider_charge_id: chargeResult.chargeId,
          installment_number: 1,
          value: data.value,
          due_date: data.dueDate,
          status: 'pendente',
        })

      if (receivableError) {
        return { success: false, error: receivableError.message }
      }
    }

    // 8. Retrieve payment method–specific data
    let pix: { encodedImage: string; payload: string } | undefined
    let bankSlipUrl: string | undefined

    if (data.billingType === 'PIX') {
      // PIX QR code is NOT in the charge creation response — requires a separate call (Pitfall 3)
      const qr = await gateway.getPixQrCode(chargeResult.chargeId)
      pix = { encodedImage: qr.encodedImage, payload: qr.payload }
    } else if (data.billingType === 'BOLETO' && chargeResult.bankSlipUrl) {
      bankSlipUrl = chargeResult.bankSlipUrl
    }

    // 9. Audit log (IDs only — never PHI)
    await logBusinessEvent({
      tenantId: actor.tenant_id,
      actorId: actor.id,
      action: 'charge.created',
      details: {
        charge_id: charge.id,
        billing_type: data.billingType,
        installment_count: data.installmentCount,
        total_value: data.value,
      },
    })

    return {
      success: true,
      chargeId: charge.id,
      pix,
      bankSlipUrl,
    }
  } catch (err) {
    // Surface Asaas error description to UI (T-3-xss: only description string, never raw HTML)
    if (err instanceof AsaasError) {
      const body = err.body as Record<string, unknown> | null
      const errors = Array.isArray(body?.errors)
        ? (body!.errors as Array<{ description?: string }>)
        : []
      const description = errors[0]?.description ?? `Erro Asaas (${err.status})`
      return { success: false, error: description }
    }
    const message = err instanceof Error ? err.message : 'Erro interno'
    return { success: false, error: message }
  }
}

// ─── getCharge ────────────────────────────────────────────────────────────────
// Returns a charge record scoped to the current tenant (RLS enforced by createClient).

export async function getCharge(id: string): Promise<{
  success: boolean
  charge?: {
    id: string
    billing_type: string
    status: string
    total_value: number
    installment_count: number
    created_at: string
  }
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()
  const { data: charge, error } = await supabase
    .from('charges')
    .select('id, billing_type, status, total_value, installment_count, created_at')
    .eq('id', id)
    .single()

  if (error || !charge) {
    return { success: false, error: 'Cobrança não encontrada' }
  }

  return { success: true, charge }
}

// ─── cancelCharge ─────────────────────────────────────────────────────────────
// Cancels an Asaas charge and updates local status to 'cancelado'.

export async function cancelCharge(id: string): Promise<{ success: boolean; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const allowedRoles = ['admin', 'dentist', 'receptionist', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para cancelar cobrança' }
  }

  const supabase = await createClient()

  // Load charge to get provider_charge_id
  const { data: charge, error: loadError } = await supabase
    .from('charges')
    .select('id, provider_charge_id, status')
    .eq('id', id)
    .single()

  if (loadError || !charge) {
    return { success: false, error: 'Cobrança não encontrada' }
  }

  if (charge.status === 'cancelado') {
    return { success: false, error: 'Cobrança já cancelada' }
  }

  try {
    if (charge.provider_charge_id) {
      await gateway.cancelCharge(charge.provider_charge_id)
    }

    const { error: updateError } = await supabase
      .from('charges')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    await logBusinessEvent({
      tenantId: actor.tenant_id,
      actorId: actor.id,
      action: 'charge.cancelled',
      details: { charge_id: id },
    })

    return { success: true }
  } catch (err) {
    if (err instanceof AsaasError) {
      const body = err.body as Record<string, unknown> | null
      const errors = Array.isArray(body?.errors)
        ? (body!.errors as Array<{ description?: string }>)
        : []
      const description = errors[0]?.description ?? `Erro Asaas (${err.status})`
      return { success: false, error: description }
    }
    const message = err instanceof Error ? err.message : 'Erro interno'
    return { success: false, error: message }
  }
}
