// Public invite acceptance page — no auth required (Pitfall 5 exempt in proxy.ts).
// Server Component reads the invitation, renders clinic + role info.
// Hands off to InviteAcceptForm (Client Component) for password entry.
import { createAdminClient } from '@/lib/supabase/admin'
import InviteAcceptForm from './InviteAcceptForm'
import { UserCircle2, AlertTriangle } from 'lucide-react'

interface PageProps {
  params: Promise<{ token: string }>
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  dentist: 'Dentista',
  receptionist: 'Recepcionista',
  patient: 'Paciente',
  superadmin: 'Superadmin',
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params
  const admin = createAdminClient()

  // Look up invitation — select only what the page needs (T-01-20: minimal disclosure)
  const { data: invitation } = await admin
    .from('invitations')
    .select('id, email, role, status, expires_at, tenant_id')
    .eq('token', token)
    .single()

  // Resolve clinic name (for FYNXIA branding)
  let clinicName = 'FYNXIA'
  if (invitation?.tenant_id) {
    const { data: clinic } = await admin
      .from('clinics')
      .select('name')
      .eq('id', invitation.tenant_id)
      .single()
    if (clinic?.name) clinicName = clinic.name
  }

  // Determine invite validity
  const isInvalid =
    !invitation ||
    invitation.status !== 'pending' ||
    new Date(invitation.expires_at) < new Date()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* FYNXIA header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold font-display tracking-tight text-primary">FYNXIA</h1>
          <p className="mt-1 text-sm text-muted-foreground">ERP Odontológico</p>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-8">
          {isInvalid ? (
            /* Invalid or expired invitation */
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                Convite inválido ou expirado
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Este convite já foi utilizado, foi revogado ou expirou (validade de 24 horas).
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Solicite um novo convite ao administrador da clínica.
              </p>
              <a
                href="/login"
                className="mt-6 inline-flex items-center justify-center text-sm font-semibold text-foreground underline underline-offset-4 min-h-[44px] min-w-[44px]"
              >
                Ir para o login
              </a>
            </div>
          ) : (
            /* Valid invitation — show clinic info + accept form */
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <UserCircle2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">
                  Convite para {clinicName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Você foi convidado como{' '}
                  <span className="font-semibold text-foreground">
                    {ROLE_LABELS[invitation.role] ?? invitation.role}
                  </span>
                </p>
              </div>

              <InviteAcceptForm
                token={token}
                email={invitation.email}
                clinicName={clinicName}
                role={invitation.role}
              />
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          FYNXIA — ERP Odontológico SaaS &bull; Brasil
        </p>
      </div>
    </div>
  )
}
