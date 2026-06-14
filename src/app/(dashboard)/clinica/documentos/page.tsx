/**
 * Documentos page — /clinica/documentos
 *
 * Gated by the 'documentos' module in proxy.ts MODULE_PERMISSIONS:
 *   - admin/superadmin/dentist: can generate and sign
 *   - auditor/dpo/socio: read-only (sees version history, cannot mutate)
 *   - receptionist/patient/others: blocked by middleware (never reach this page)
 *
 * Server Component — auth + role resolved server-side.
 * isReadOnly derived from x-read-only header (set by middleware, mirrors proxy.ts logic).
 *
 * Phase: 08-documentos-assinatura-icp-brasil (DOC-02/03)
 */
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { listTemplates } from '@/actions/document-templates'
import { DocumentGenerator } from '@/components/documents/DocumentGenerator'
import { PageHeader } from '@/components/shell/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function DocumentosPage() {
  const supabase = await createClient()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Documentos"
          breadcrumbs={[
            { label: 'Clínica', href: '/clinica' },
            { label: 'Documentos' },
          ]}
        />
        <main className="p-6 max-w-3xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>Não autenticado.</AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Role + read-only from middleware headers ─────────────────────────────────
  // Middleware sets x-read-only:true for auditor/dpo/socio on /clinica/documentos
  const headerStore = await headers()
  const isReadOnly = headerStore.get('x-read-only') === 'true'

  // ── Load templates ────────────────────────────────────────────────────────────
  const templatesResult = await listTemplates()
  const templates = templatesResult.success ? (templatesResult.data ?? []) : []

  return (
    <>
      <PageHeader
        title="Documentos"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Documentos' },
        ]}
      />

      <main className="p-6 max-w-3xl mx-auto w-full space-y-6">
        {isReadOnly && (
          <Alert>
            <AlertDescription>
              Acesso somente leitura. Seu papel não permite gerar ou assinar documentos.
            </AlertDescription>
          </Alert>
        )}

        <div>
          <p className="text-sm text-muted-foreground mb-6">
            Gere documentos a partir dos modelos da clínica, assine com o certificado ICP-Brasil e
            mantenha o histórico imutável de versões.
          </p>
          <DocumentGenerator templates={templates} isReadOnly={isReadOnly} />
        </div>
      </main>
    </>
  )
}
