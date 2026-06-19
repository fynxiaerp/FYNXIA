/**
 * Teleodontologia list page — /clinica/teleodontologia
 *
 * Gated by the 'teleodontologia' module in proxy.ts MODULE_PERMISSIONS (Plan 06):
 *   - admin/superadmin/dentist: can create and manage sessions
 *   - auditor/dpo/socio: read-only (no create CTA)
 *   - receptionist/patient/others: blocked by middleware
 *
 * Server Component — auth + read-only resolved server-side.
 * x-read-only header set by middleware (Plan 07/proxy.ts) — mirrors documentos pattern.
 *
 * Phase: 12-receitu-rio-teleodontologia (TEL-01/TEL-02)
 */

import Link from 'next/link'
import { headers } from 'next/headers'
import { Video, VideoOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listTeleconsultations } from '@/actions/teleconsultations'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const STATUS_LABELS: Record<string, string> = {
  agendada: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'secondary'> = {
  agendada: 'secondary',
  em_andamento: 'default',
  concluida: 'outline',
  cancelada: 'outline',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TeleodontologiaPage() {
  const supabase = await createClient()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Teleodontologia"
          breadcrumbs={[
            { label: 'Clínica', href: '/clinica' },
            { label: 'Teleodontologia' },
          ]}
        />
        <main className="p-6 max-w-5xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>Não autenticado.</AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Role + read-only from middleware headers ───────────────────────────────
  const headerStore = await headers()
  const isReadOnly = headerStore.get('x-read-only') === 'true'

  // ── Fetch patients (for display name lookup) ──────────────────────────────
  const { data: actor } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  const tenantId = actor?.tenant_id

  const { data: patients } = tenantId
    ? await supabase
        .from('patients')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('full_name', { ascending: true })
    : { data: [] }

  const patientMap = new Map((patients ?? []).map((p) => [p.id, p.full_name]))

  // ── Fetch teleconsultations ──────────────────────────────────────────────
  const result = await listTeleconsultations()
  const sessions = result.success ? (result.data ?? []) : []

  return (
    <>
      <PageHeader
        title="Teleodontologia"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Teleodontologia' },
        ]}
        actions={
          !isReadOnly ? (
            <Button render={<Link href="/clinica/teleodontologia/novo" />}>
              <Video className="size-4" />
              Nova teleconsulta
            </Button>
          ) : undefined
        }
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {isReadOnly && (
          <Alert>
            <AlertDescription>
              Acesso somente leitura. Seu papel não permite criar ou gerenciar teleconsultas.
            </AlertDescription>
          </Alert>
        )}

        {sessions.length === 0 ? (
          <EmptyState
            icon={VideoOff}
            title="Nenhuma teleconsulta registrada"
            description="Crie a primeira sessão de teleodontologia vinculando um paciente, registrando o consentimento CFO e o link da reunião."
            cta={
              !isReadOnly ? (
                <Button render={<Link href="/clinica/teleodontologia/novo" />}>
                  <Video className="size-4" />
                  Nova teleconsulta
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Consentimento CFO</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Encerramento</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">
                      {patientMap.get(session.patient_id) ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[session.status] ?? 'outline'}>
                        {STATUS_LABELS[session.status] ?? session.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {session.consent_given ? (
                        <span className="text-sm text-green-700 dark:text-green-400">Sim</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Não</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(session.started_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(session.ended_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(session.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/clinica/teleodontologia/${session.id}`} />}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </>
  )
}
