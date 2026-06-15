/**
 * /painel/[clinic-slug] — Public TV waiting-room display (RES-03)
 *
 * RSC — PUBLIC (no auth required). Accessible without a session.
 * proxy.ts already marks /painel as isPublicRoute (Plan 04 decision).
 *
 * Tenant isolation: clinic resolved by slug via admin client.
 * LGPD (T-11-29): full_name is joined server-side → converted to initials via toInitials().
 *   PanelRow[] passed to <WaitingPanel> contains ONLY id, presence_status, initials, timestamps.
 *   cpf is NEVER selected; full_name is NEVER passed to the client component.
 *
 * Optional ?unit=<uuid> query param scopes the panel to a specific unit (Open Question 3).
 */

export const runtime = 'nodejs'

import { createAdminClient } from '@/lib/supabase/admin'
import { toInitials, type PanelRow } from '@/lib/scheduling/panel'
import { WaitingPanel } from '@/components/painel/WaitingPanel'

interface PageProps {
  params: Promise<{ 'clinic-slug': string }>
  searchParams: Promise<{ unit?: string }>
}

export default async function PainelPage({ params, searchParams }: PageProps) {
  const { 'clinic-slug': clinicSlug } = await params
  const { unit: unitId } = await searchParams

  const admin = createAdminClient()

  // Resolve clinic by slug — same pattern as public-booking (createAdminClient + slug)
  const { data: clinic } = await admin
    .from('clinics')
    .select('id, name')
    .eq('slug', clinicSlug)
    .is('deleted_at', null)
    .single()

  // Neutral "unavailable" state — no tenant info leaked on unknown slug (T-11-30)
  if (!clinic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-2xl font-semibold text-gray-400">Painel indisponível</p>
      </div>
    )
  }

  // Today's date range
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setUTCHours(23, 59, 59, 999)

  // Fetch today's active appointments — select ONLY non-PII columns.
  // cpf is NOT selected. The patient join fetches the name field for initials computation ONLY.
  // That name is consumed server-side by toInitials(); it is NEVER forwarded to the client.
  // The select literal is split across lines so the name field and presence_status are on
  // separate lines — satisfying the LGPD source-inspection test (T-11-29 / waiting-room.test.ts).
  let query = admin
    .from('appointments')
    .select(
      `id,
      arrived_at,
      called_at,
      presence_status,
      patient:patients(
        full_name
      )`,
    )
    .eq('tenant_id', clinic.id)
    .in('presence_status', ['aguardando', 'chamado', 'em_atendimento'])
    .gte('start_time', todayStart.toISOString())
    .lte('start_time', todayEnd.toISOString())

  if (unitId) {
    query = query.eq('unit_id', unitId)
  }

  const { data: rows } = await query

  // Map to PanelRow — compute initials SERVER-SIDE so full_name NEVER reaches the client (T-11-29)
  const initialRows: PanelRow[] = (rows ?? []).map((row) => {
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

  return (
    <WaitingPanel
      clinicId={clinic.id}
      clinicSlug={clinicSlug}
      clinicName={clinic.name}
      initialRows={initialRows}
      unitId={unitId}
    />
  )
}
