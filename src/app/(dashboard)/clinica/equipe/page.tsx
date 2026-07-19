// Admin team management page — Server Component
// Route: /clinica/equipe (under /clinica/* — accessible to admin/dentist/receptionist per D-07)
// Invite form is admin-gated: non-admins see a read-only notice.
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { InviteForm } from '@/components/invitations/InviteForm'
import { EditMemberDialog } from '@/components/team/EditMemberDialog'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Users } from 'lucide-react'

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

  // Resolve tenant_id do actor autenticado (o header só dá o role, não o tenant)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: actor } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user?.id ?? '')
    .single()
  const tenantId = actor?.tenant_id ?? null

  // Membros ativos da equipe (usuários já aceitos, não convites pendentes)
  const { data: members } = tenantId
    ? await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('tenant_id', tenantId)
        .order('full_name', { ascending: true })
    : { data: [] }

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
              <Alert>
                <AlertDescription>
                  Apenas administradores podem convidar novos membros.
                  Entre em contato com o administrador da clínica.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </section>

        {/* Active team members — Server Component with client Edit dialog */}
        <section className="bg-card rounded-xl border border-border">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="text-xl font-semibold font-display">
              Membros da Equipe
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Usuários ativos desta clínica
            </p>
          </div>

          {!members || members.length === 0 ? (
            <div className="px-6 py-8">
              <EmptyState
                icon={Users}
                title="Nenhum membro ativo"
                description="Convide membros para começar."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6 text-sm font-semibold">Nome</TableHead>
                  <TableHead className="px-6 text-sm font-semibold">E-mail</TableHead>
                  <TableHead className="px-6 text-sm font-semibold">Perfil</TableHead>
                  {isAdmin && (
                    <TableHead className="px-6 text-sm font-semibold">Ações</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="px-6 text-foreground">
                      {member.full_name || '—'}
                    </TableCell>
                    <TableCell className="px-6 text-muted-foreground">
                      {member.email}
                    </TableCell>
                    <TableCell className="px-6 text-muted-foreground">
                      {ROLE_LABELS[member.role] ?? member.role}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="px-6">
                        <EditMemberDialog
                          userId={member.id}
                          currentName={member.full_name ?? ''}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
            <div className="px-6 py-8">
              <EmptyState
                icon={Users}
                title="Nenhum membro na equipe"
                description="Convide dentistas e recepcionistas para trabalhar com você."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6 text-sm font-semibold">E-mail</TableHead>
                  <TableHead className="px-6 text-sm font-semibold">Perfil</TableHead>
                  <TableHead className="px-6 text-sm font-semibold">Status</TableHead>
                  <TableHead className="px-6 text-sm font-semibold">Expira em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="px-6 text-foreground">{invite.email}</TableCell>
                    <TableCell className="px-6 text-muted-foreground">
                      {ROLE_LABELS[invite.role] ?? invite.role}
                    </TableCell>
                    <TableCell className="px-6">
                      <Badge variant="secondary">
                        {STATUS_LABELS[invite.status] ?? invite.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 text-muted-foreground">
                      {formatDate(invite.expires_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </main>
    </>
  )
}
