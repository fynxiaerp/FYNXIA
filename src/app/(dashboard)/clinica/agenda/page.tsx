import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { AgendaCalendar } from '@/components/agenda/AgendaCalendar'
import { NewAppointmentButton } from '@/components/agenda/NewAppointmentButton'
import { mapAppointmentToEvent } from '@/lib/validators/appointment'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { PageHeader } from '@/components/shell/PageHeader'

export default async function AgendaPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') ?? ''

  const supabase = await createClient()

  // Get actor's tenant_id
  const { data: actor } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single()

  const tenantId = actor?.tenant_id ?? ''

  // Fetch dentists for this tenant
  const { data: dentistRows } = tenantId
    ? await supabase
        .from('users')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .eq('role', 'dentist')
        .order('full_name', { ascending: true })
    : { data: [] }

  const dentists = (dentistRows ?? []).map((d) => ({
    id: d.id,
    full_name: d.full_name ?? 'Dentista',
  }))

  // Fetch appointments for the current week (Server Component initial load)
  // React Query or URL-based refresh handles client-side updates
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay()) // Sunday
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const { data: appointmentRows } = tenantId
    ? await supabase
        .from('appointments')
        .select(
          'id, start_time, end_time, dentist_id, status, notes, patient:patients(full_name)'
        )
        .eq('tenant_id', tenantId)
        .gte('start_time', weekStart.toISOString())
        .lt('start_time', weekEnd.toISOString())
        .neq('status', 'cancelado')
    : { data: [] }

  const events = (appointmentRows ?? []).map((appt) => {
    // Handle Supabase join result — patient can be array or object
    const patient = Array.isArray(appt.patient)
      ? appt.patient[0]
      : appt.patient
    return mapAppointmentToEvent({
      id: appt.id,
      start_time: appt.start_time,
      end_time: appt.end_time,
      dentist_id: appt.dentist_id,
      status: appt.status,
      notes: appt.notes,
      patient: patient ? { full_name: patient.full_name ?? '' } : null,
    })
  })

  return (
    <NuqsAdapter>
      <div className="flex h-full flex-col">
        <PageHeader
          title="Agenda"
          actions={<NewAppointmentButton />}
        />

        {/* Calendar is always rendered — even on a week with zero appointments —
            so the header button and slot-click both have a visible target. */}
        <div className="h-[calc(100vh-64px)] p-0 overflow-hidden">
          <AgendaCalendar
            dentists={dentists}
            events={events}
            tenantId={tenantId}
          />
        </div>
      </div>
    </NuqsAdapter>
  )
}
