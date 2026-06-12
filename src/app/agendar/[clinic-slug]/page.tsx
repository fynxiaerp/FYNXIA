import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { PublicBookingForm } from '@/components/booking/PublicBookingForm'

// ─── Public Booking Page — /agendar/[clinic-slug] ─────────────────────────────
// Server Component. Accessible without auth (proxy.ts marks /agendar as public).
// CLINIC-09: Patients book appointments without a login.
//
// Resolves clinic by slug via service-role client.
// Fetches active dentists for the clinic.
// Renders PublicBookingForm which calls createPublicAppointment Server Action.
// 23P01 GIST race condition is handled gracefully in PublicBookingForm.

interface PageProps {
  params: Promise<{ 'clinic-slug': string }>
}

export default async function PublicBookingPage({ params }: PageProps) {
  const { 'clinic-slug': clinicSlug } = await params

  const admin = createAdminClient()

  // Resolve clinic by slug — 404 if not found or deleted
  const { data: clinic, error: clinicError } = await admin
    .from('clinics')
    .select('id, name, logo_url')
    .eq('slug', clinicSlug)
    .is('deleted_at', null)
    .single()

  if (clinicError || !clinic) {
    notFound()
  }

  // Fetch active dentists for this clinic
  const { data: dentists } = await admin
    .from('users')
    .select('id, full_name')
    .eq('tenant_id', clinic.id)
    .eq('role', 'dentist')
    .is('deleted_at', null)
    .order('full_name', { ascending: true })

  const activeDentists = dentists ?? []

  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg w-full mx-auto flex flex-col gap-6">
        {/* Header */}
        <header className="text-center">
          {clinic.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clinic.logo_url}
              alt={`Logo ${clinic.name}`}
              className="mx-auto mb-3 h-12 w-auto object-contain"
            />
          )}
          <h1 className="text-2xl font-semibold font-display text-foreground">Agendar Consulta</h1>
          <p className="mt-1 text-sm text-muted-foreground">{clinic.name}</p>
        </header>

        {/* Public Booking Form */}
        <PublicBookingForm
          clinicSlug={clinicSlug}
          dentists={activeDentists}
        />
      </div>
    </main>
  )
}
