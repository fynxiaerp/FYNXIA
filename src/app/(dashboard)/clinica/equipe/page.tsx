// Admin team management page — Server Component
// Route: /clinica/equipe (under /clinica/* — accessible to admin/dentist/receptionist per D-07)
// Invite form is admin-gated: non-admins see a read-only notice.
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { InviteForm } from '@/components/invitations/InviteForm'

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
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Equipe</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Gerencie convites e membros da clínica
            </p>
          </div>
          <a
            href="/clinica"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 underline underline-offset-4"
          >
            ← Voltar
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        {/* Invite section — admin only */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-5 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              Adicionar membro
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
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
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-5 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              Convites pendentes
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Convites enviados aguardando aceitação
            </p>
          </div>

          {!pendingInvites || pendingInvites.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-slate-500">
                Nenhum convite pendente no momento.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-6 py-3 text-left font-medium text-slate-600">
                      E-mail
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-slate-600">
                      Perfil
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-slate-600">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-slate-600">
                      Expira em
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingInvites.map((invite) => (
                    <tr key={invite.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 text-slate-800">{invite.email}</td>
                      <td className="px-6 py-3 text-slate-600">
                        {ROLE_LABELS[invite.role] ?? invite.role}
                      </td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800">
                          {STATUS_LABELS[invite.status] ?? invite.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-500">
                        {formatDate(invite.expires_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Phase note */}
        <p className="text-center text-xs text-slate-400">
          Gestão completa de equipe (editar, remover membros) disponível na Fase 2.
        </p>
      </main>
    </div>
  )
}
