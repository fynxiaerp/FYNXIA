// Public invite acceptance page — no auth required (Pitfall 5 exempt in proxy.ts).
// Server Component reads the invitation, renders clinic + role info.
// Hands off to InviteAcceptForm (Client Component) for password entry.
import { createAdminClient } from '@/lib/supabase/admin'
import InviteAcceptForm from './InviteAcceptForm'

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* FYNXIA header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">FYNXIA</h1>
          <p className="mt-1 text-sm text-slate-500">ERP Odontológico</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          {isInvalid ? (
            /* Invalid or expired invitation */
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900">
                Convite inválido ou expirado
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Este convite já foi utilizado, foi revogado ou expirou (validade de 24 horas).
              </p>
              <p className="mt-4 text-sm text-slate-500">
                Solicite um novo convite ao administrador da clínica.
              </p>
              <a
                href="/login"
                className="mt-6 inline-block text-sm font-medium text-slate-900 underline underline-offset-4"
              >
                Ir para o login
              </a>
            </div>
          ) : (
            /* Valid invitation — show clinic info + accept form */
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <svg
                    className="h-6 w-6 text-slate-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Convite para {clinicName}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Você foi convidado como{' '}
                  <span className="font-medium text-slate-800">
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

        <p className="mt-6 text-center text-xs text-slate-400">
          FYNXIA — ERP Odontológico SaaS &bull; Brasil
        </p>
      </div>
    </div>
  )
}
