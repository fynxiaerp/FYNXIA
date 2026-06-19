/**
 * Receituário list page — /clinica/receituario
 *
 * Gated by the 'receituario' module in proxy.ts MODULE_PERMISSIONS (Plan 06):
 *   - admin/superadmin/dentist: can issue and sign clinical documents
 *   - auditor/dpo/socio: read-only (no issue CTA)
 *   - receptionist/patient/others: blocked by middleware
 *
 * Server Component — auth + read-only resolved server-side.
 * x-read-only header set by middleware (proxy.ts Plan 06) — mirrors documentos pattern.
 *
 * nodejs runtime: the issue/sign actions reached from this flow render + sign PDFs
 * (@react-pdf/renderer + ICP signing) which require the Node.js runtime, not Edge.
 *
 * Security (T-12-21): listClinicDocuments NEVER returns storage_path or cert_pem.
 *
 * Phase: 12-receitu-rio-teleodontologia (RX-01/RX-02/RX-03)
 */

import Link from 'next/link'
import { headers } from 'next/headers'
import { FileHeart, FilePlus2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listClinicDocuments } from '@/actions/clinical-documents'
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

export const runtime = 'nodejs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
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

const DOC_TYPE_LABELS: Record<string, string> = {
  receita_simples: 'Receita Simples',
  receita_controle_especial: 'Receita de Controle Especial',
  atestado: 'Atestado',
  solicitacao_exame: 'Solicitação de Exame',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  signed: 'Assinado',
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'secondary'> = {
  draft: 'secondary',
  signed: 'default',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReceituarioPage() {
  const supabase = await createClient()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Receituário"
          breadcrumbs={[
            { label: 'Clínica', href: '/clinica' },
            { label: 'Receituário' },
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

  // ── Resolve actor tenant ──────────────────────────────────────────────────
  const { data: actor } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  const tenantId = actor?.tenant_id

  // ── Fetch patients (for display name lookup) ──────────────────────────────
  const { data: patients } = tenantId
    ? await supabase
        .from('patients')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('full_name', { ascending: true })
    : { data: [] }

  const patientMap = new Map((patients ?? []).map((p) => [p.id, p.full_name]))

  // ── Fetch clinical documents (RLS-scoped; never returns storage_path) ──────
  const result = await listClinicDocuments()
  const documents = result.success ? (result.data ?? []) : []

  return (
    <>
      <PageHeader
        title="Receituário"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Receituário' },
        ]}
        actions={
          !isReadOnly ? (
            <Button render={<Link href="/clinica/receituario/novo" />}>
              <FilePlus2 className="size-4" />
              Emitir documento
            </Button>
          ) : undefined
        }
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {isReadOnly && (
          <Alert>
            <AlertDescription>
              Acesso somente leitura. Seu papel não permite emitir ou assinar documentos clínicos.
            </AlertDescription>
          </Alert>
        )}

        {documents.length === 0 ? (
          <EmptyState
            icon={FileHeart}
            title="Nenhum documento emitido"
            description="Emita receitas, atestados e solicitações de exame. O alerta de alergia é exibido na emissão e a assinatura ICP-Brasil torna o documento oficial e imutável."
            cta={
              !isReadOnly ? (
                <Button render={<Link href="/clinica/receituario/novo" />}>
                  <FilePlus2 className="size-4" />
                  Emitir documento
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-mono text-sm">{doc.doc_number}</TableCell>
                    <TableCell className="text-sm">
                      {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                    </TableCell>
                    <TableCell className="font-medium">
                      {patientMap.get(doc.patient_id) ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[doc.status] ?? 'outline'}>
                        {STATUS_LABELS[doc.status] ?? doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(doc.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/clinica/receituario/${doc.id}`} />}
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
