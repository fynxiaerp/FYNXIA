'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logBusinessEvent } from '@/lib/audit'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { isValidPresenceTransition } from '@/lib/scheduling/waiting'
import { toInitials, type PanelRow } from '@/lib/scheduling/panel'

// ─── Helper: get authenticated actor ─────────────────────────────────────────

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

// ─── Staff role gate ──────────────────────────────────────────────────────────

const CHECKIN_ALLOWED_ROLES = ['admin', 'dentist', 'receptionist', 'superadmin'] as const

function assertStaffRole(role: string): { error: string } | null {
  if (!CHECKIN_ALLOWED_ROLES.includes(role as (typeof CHECKIN_ALLOWED_ROLES)[number])) {
    return { error: 'Permissão insuficiente para realizar check-in' }
  }
  return null
}

// ─── Shared update helper ─────────────────────────────────────────────────────

async function updatePresence(
  appointmentId: string,
  actor: Actor,
  fields: Record<string, string | null>,
  eventAction: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Read current presence_status for transition validation
  const { data: current, error: readError } = await supabase
    .from('appointments')
    .select('presence_status')
    .eq('id', appointmentId)
    .eq('tenant_id', actor.tenant_id)
    .single()

  if (readError || !current) {
    return { success: false, error: 'Agendamento não encontrado' }
  }

  const newStatus = fields.presence_status
  if (newStatus) {
    const valid = isValidPresenceTransition(current.presence_status ?? null, newStatus)
    if (!valid) {
      return {
        success: false,
        error: `Transição inválida: ${current.presence_status ?? 'sem check-in'} → ${newStatus}`,
      }
    }
  }

  const { error: updateError } = await supabase
    .from('appointments')
    .update(fields)
    .eq('id', appointmentId)
    .eq('tenant_id', actor.tenant_id) // Tenant scope guard (T-11-31)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: eventAction,
    details: { appointment_id: appointmentId },
  })

  return { success: true }
}

// ─── markArrived ──────────────────────────────────────────────────────────────
// RES-03: Patient arrives at clinic → presence_status='aguardando', arrived_at=now().
// T-11-31: assertNotReadOnly + staff role gate before any mutation.

export async function markArrived(
  appointmentId: string,
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const roleError = assertStaffRole(actor.role)
  if (roleError) return { success: false, ...roleError }

  return updatePresence(
    appointmentId,
    actor,
    {
      presence_status: 'aguardando',
      arrived_at: new Date().toISOString(),
    },
    'appointment.arrived',
  )
}

// ─── callPatient ──────────────────────────────────────────────────────────────
// RES-03: Receptionist calls patient → presence_status='chamado', called_at=now().

export async function callPatient(
  appointmentId: string,
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const roleError = assertStaffRole(actor.role)
  if (roleError) return { success: false, ...roleError }

  return updatePresence(
    appointmentId,
    actor,
    {
      presence_status: 'chamado',
      called_at: new Date().toISOString(),
    },
    'appointment.called',
  )
}

// ─── startTreatment ───────────────────────────────────────────────────────────
// RES-03: Patient enters treatment room → presence_status='em_atendimento', started_at=now().

export async function startTreatment(
  appointmentId: string,
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const roleError = assertStaffRole(actor.role)
  if (roleError) return { success: false, ...roleError }

  return updatePresence(
    appointmentId,
    actor,
    {
      presence_status: 'em_atendimento',
      started_at: new Date().toISOString(),
    },
    'appointment.started',
  )
}

// ─── finishTreatment ──────────────────────────────────────────────────────────
// RES-03: Treatment complete → presence_status='finalizado', finished_at=now().

export async function finishTreatment(
  appointmentId: string,
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const roleError = assertStaffRole(actor.role)
  if (roleError) return { success: false, ...roleError }

  return updatePresence(
    appointmentId,
    actor,
    {
      presence_status: 'finalizado',
      finished_at: new Date().toISOString(),
    },
    'appointment.finished',
  )
}

// ─── getPanelRows ─────────────────────────────────────────────────────────────
// RES-03 / LGPD: Public read for the TV panel — resolves clinic by slug via
// admin client (no session required), returns PanelRow[] with initials ONLY.
// Never returns full_name or cpf to the client (T-11-29).
//
// Called from the WaitingPanel client component on Realtime events.

export async function getPanelRows(
  clinicSlug: string,
  unitId?: string,
): Promise<PanelRow[]> {
  if (!clinicSlug) return []

  const admin = createAdminClient()

  // Resolve clinic by slug (tenant isolated — no cross-clinic leak possible)
  const { data: clinic } = await admin
    .from('clinics')
    .select('id')
    .eq('slug', clinicSlug)
    .is('deleted_at', null)
    .single()

  if (!clinic) return []

  // Today's date range in UTC (panel shows today's active appointments)
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setUTCHours(23, 59, 59, 999)

  // Build query — select ONLY non-PII columns + join patient full_name for initials computation
  // full_name is used server-side ONLY and never included in the returned PanelRow
  let query = admin
    .from('appointments')
    .select('id, presence_status, arrived_at, called_at, patient:patients(full_name)')
    .eq('tenant_id', clinic.id)
    .in('presence_status', ['aguardando', 'chamado', 'em_atendimento'])
    .gte('start_time', todayStart.toISOString())
    .lte('start_time', todayEnd.toISOString())

  if (unitId) {
    query = query.eq('unit_id', unitId)
  }

  const { data: rows } = await query

  if (!rows) return []

  // Map to PanelRow — compute initials server-side; full_name is dropped here (T-11-29)
  return rows.map((row) => {
    // Supabase join can return array or object depending on cardinality inference.
    // Cast through unknown to extract full_name safely.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPatient = row.patient as unknown as any
    const fullName: string | null =
      rawPatient == null
        ? null
        : Array.isArray(rawPatient)
          ? (rawPatient[0]?.full_name ?? null)
          : (rawPatient.full_name ?? null)

    return {
      id: row.id,
      presence_status: row.presence_status ?? 'aguardando',
      initials: toInitials(fullName),
      arrived_at: row.arrived_at,
      called_at: row.called_at,
    }
  })
}
