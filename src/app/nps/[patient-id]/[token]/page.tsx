import { createAdminClient } from '@/lib/supabase/admin'
import { isTokenValid } from '@/lib/validators/anamnesis'
import { NpsPublicForm } from '@/components/crc/NpsPublicForm'
import { AlertCircle } from 'lucide-react'

// ─── Public NPS Page — /nps/[patient-id]/[token] ──────────────────────────────
// Server Component. Accessible without auth (proxy.ts marks /nps as public).
// Mirrors src/app/anamnese/[patient-id]/[token]/page.tsx (T-2-07 pattern).
//
// Forces the light theme via the `.light` wrapper (UI-SPEC §6 — NOT
// next-themes) so the form renders consistently in WhatsApp/e-mail WebViews
// regardless of any stored dark-mode preference on the device's browser.
//
// Validates the token BEFORE rendering the form:
// - Fetches the nps_responses row by token + patient_id
// - Checks isTokenValid + score IS NULL (not yet answered)
// - If invalid/expired/used/already-answered -> full-page error state
// - If valid -> renders NpsPublicForm
//
// WR-05/T-18-31 (TOCTOU): this read-then-render check is NOT the security
// boundary. Single-use enforcement lives entirely in submitNpsPublic's atomic
// conditional UPDATE (token_used_at IS NULL AND token_expires_at > now() AND
// score IS NULL). If the token is concurrently consumed between this render
// and submit, the page may show the form but the submit returns the same
// generic expired/used message (T-18-21 — never distinguishes the reason,
// never leaks promotor/neutro/detrator classification to the patient).

interface PageProps {
  params: Promise<{ 'patient-id': string; token: string }>
}

export default async function PublicNpsPage({ params }: PageProps) {
  const { 'patient-id': patientId, token } = await params

  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from('nps_responses')
    .select('id, token_used_at, token_expires_at, score, clinic_id')
    .eq('token', token)
    .eq('patient_id', patientId)
    .single()

  const isValid =
    !error &&
    row !== null &&
    isTokenValid(
      { token_used_at: row.token_used_at, token_expires_at: row.token_expires_at },
      new Date()
    ) &&
    row.score === null

  if (!isValid) {
    return (
      <div className="light">
        <main className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-lg w-full mx-auto">
            <div className="flex flex-col items-center gap-6 rounded-xl border border-destructive/20 bg-card p-8 text-center shadow-sm">
              <AlertCircle className="size-14 text-destructive" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">Link de Avaliação Inválido</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  Este link de avaliação expirou ou já foi utilizado. Entre em contato com a clínica se
                  acredita que isso é um erro.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const { data: clinicRow } = await admin.from('clinics').select('name').eq('id', row.clinic_id).single()
  const clinicName = clinicRow?.name ?? 'a clínica'

  return (
    <div className="light">
      <main className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-md w-full mx-auto flex flex-col gap-6">
          <header className="text-center">
            <h1 className="text-xl font-semibold font-display text-primary">FYNXIA</h1>
            <h2 className="mt-2 text-xl font-semibold font-display text-foreground">Sua opinião importa</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              De 0 a 10, o quanto você recomendaria a {clinicName} para um amigo ou familiar?
            </p>
          </header>

          <NpsPublicForm patientId={patientId} token={token} />
        </div>
      </main>
    </div>
  )
}
