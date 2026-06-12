import { createAdminClient } from '@/lib/supabase/admin'
import { isTokenValid } from '@/lib/validators/anamnesis'
import { AnamnesisForm } from '@/components/anamnesis/AnamnesisForm'
import { submitAnamnesisPublic } from '@/actions/anamneses'
import { AlertCircle } from 'lucide-react'

// ─── Public Anamnesis Page — /anamnese/[patient-id]/[token] ──────────────────
// Server Component. Accessible without auth (proxy.ts marks /anamnese as public).
//
// Validates the token BEFORE rendering the form (T-2-07):
// - Fetches the anamnesis row by token + patient_id
// - Checks isTokenValid + signature_hash === 'PENDING'
// - If invalid/expired/used → full-page error state (no form rendered)
// - If valid → renders AnamnesisForm in public mode

interface PageProps {
  params: Promise<{ 'patient-id': string; token: string }>
}

export default async function PublicAnamnesisPage({ params }: PageProps) {
  const { 'patient-id': patientId, token } = await params

  // Fetch anamnesis row by token + patient_id via service role (no session)
  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from('anamneses')
    .select('id, token_used_at, token_expires_at, signature_hash, tenant_id')
    .eq('token', token)
    .eq('patient_id', patientId)
    .single()

  // Determine validity: row must exist, token must be valid, must be PENDING.
  //
  // WR-05 (TOCTOU): this read-then-render check is NOT the authoritative gate.
  // It only decides whether to render the form. The single-use guarantee lives
  // entirely in submitAnamnesisPublic's atomic conditional UPDATE (token_used_at
  // IS NULL AND token_expires_at > now() AND signature_hash = 'PENDING'). If the
  // token is concurrently consumed between this render and submit, the page may
  // show the form but the submit returns the same generic expired/used message.
  // Do NOT treat this page check as the security boundary.
  const isValid =
    !error &&
    row !== null &&
    isTokenValid(
      { token_used_at: row.token_used_at, token_expires_at: row.token_expires_at },
      new Date()
    ) &&
    row.signature_hash === 'PENDING'

  if (!isValid) {
    // UI-SPEC Error States: full-page error — do NOT render the form
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-lg w-full mx-auto">
          <div className="flex flex-col items-center gap-6 rounded-xl border border-destructive/20 bg-card p-8 text-center shadow-sm">
            <AlertCircle className="size-14 text-destructive" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Link de Anamnese Inválido</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Este link de anamnese expirou ou já foi utilizado. Solicite um novo link à sua
                clínica.
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg w-full mx-auto flex flex-col gap-6">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-2xl font-bold font-display tracking-tight text-primary">FYNXIA</h1>
          <h2 className="mt-2 text-xl font-semibold font-display text-foreground">Anamnese Odontológica</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha o questionário de saúde e assine digitalmente para concluir.
          </p>
        </header>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">1</span>
          <span className="text-foreground font-semibold">Questionário</span>
          <div className="flex-1 h-px bg-border" />
          <span className="flex size-5 items-center justify-center rounded-full bg-border text-muted-foreground text-xs font-semibold">2</span>
          <span>Assinatura</span>
        </div>

        {/* Form */}
        <AnamnesisForm
          mode="public"
          patientId={patientId}
          token={token}
          submitAction={submitAnamnesisPublic}
        />
      </div>
    </main>
  )
}
