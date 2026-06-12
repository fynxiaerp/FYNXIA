// Admin team management page — Server Component
// Route: /clinica/equipe (under /clinica/* — accessible to admin/dentist/receptionist per D-07)
// Invite form is admin-gated: non-admins see a read-only notice.
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { InviteForm } from '@/components/invitations/InviteForm'
import { PageHeader } from '@/components/shell/PageHeader'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  dentist: 'Dentista',
  receptionist: 'Recepcionista',
  patient: 'Paciente',
  superadmin: 'Superadmin',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  accepted: 'Aceito',
  expired: 'Expirado',
  revoked: 'Revogado',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function EquipePage() {
  // Role resolved by proxy.ts — read from request header (no extra DB call)
  const headersList = await headers()
  const userRole = headersList.get('x-user-role') ?? 'receptionist'
  const isAdmin = userRole === 'admin' || userRole === 'superadmin'

  // Fetch pending invitations scoped to current tenant (RLS-enforced)
  const supabase = await createClient()
  const { data: pendingInvites } = await supabase
    .from('invitations')
    .select('id, email, role, status, expires_at, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return (
    <>
      <PageHeader
        title="Equipe"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Equipe' },
        ]}
      />

      <main className="p-6 max-w-4xl mx-auto w-full space-y-8">
        {/* Invite section — admin only */}
        <section className="bg-card rounded-xl border border-border">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="text-xl font-semibold font-display">
              Adicionar membro
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Convite por e-mail (válido 24h) ou criação direta com senha temporária
            </p>
          </div>

          <div className="px-6 py-6">
            {isAdmin ? (
              <InviteForm />
            ) : (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-sm text-amber-800">
                  Apenas administradores podem convidar novos membros.
                  Entre em contato com o administrador da clínica.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Pending invitations table */}
        <section className="bg-card rounded-xl border border-border">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="text-xl font-semibold font-display">
              Convites pendentes
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Convites enviados aguardando aceitação
            </p>
          </div>

          {!pendingInvites || pendingInvites.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum convite pendente no momento.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      E-mail
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Perfil
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Expira em
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingInvites.map((invite) => (
                    <tr key={invite.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3 text-foreground">{invite.email}</td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {ROLE_LABELS[invite.role] ?? invite.role}
                      </td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">
                          {STATUS_LABELS[invite.status] ?? invite.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {formatDate(invite.expires_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
