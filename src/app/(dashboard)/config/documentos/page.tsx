/**
 * Modelos de Documento config page — Phase 8 / DOC-01
 *
 * Admin/superadmin/ti: manage document templates (create, edit, soft-delete).
 * Non-admin: in-page Alert "Acesso restrito" — NO redirect (v1 UI convention).
 *
 * Server Component — auth + role resolved server-side.
 * Module: config (gated by MODULE_PERMISSIONS in proxy.ts for admin/superadmin/ti).
 */
import { createClient } from '@/lib/supabase/server'
import { listTemplates } from '@/actions/document-templates'
import { DocumentTemplatesManager } from '@/components/config/DocumentTemplatesManager'
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
          title="Modelos de Documento"
          breadcrumbs={[
            { label: 'Configurações', href: '/config' },
            { label: 'Documentos' },
          ]}
        />
        <main className="p-6 max-w-4xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>Não autenticado.</AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Role gate ─────────────────────────────────────────────────────────────────
  const { data: actor } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  // Template management is admin/superadmin/ti only
  if (!actor || !['admin', 'superadmin', 'ti'].includes(actor.role)) {
    return (
      <>
        <PageHeader
          title="Modelos de Documento"
          breadcrumbs={[
            { label: 'Configurações', href: '/config' },
            { label: 'Documentos' },
          ]}
        />
        <main className="p-6 max-w-4xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>
              Acesso restrito. Esta área é exclusiva para administradores e TI.
            </AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Load initial templates ────────────────────────────────────────────────────
  const templatesResult = await listTemplates()
  const templates = templatesResult.success ? (templatesResult.data ?? []) : []

  return (
    <>
      <PageHeader
        title="Modelos de Documento"
        breadcrumbs={[
          { label: 'Configurações', href: '/config' },
          { label: 'Documentos' },
        ]}
      />

      <main className="p-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <p className="text-sm text-muted-foreground mb-6">
            Gerencie os modelos de documento reutilizáveis da clínica. Os modelos
            suportam variáveis <code className="text-foreground text-xs">{'{{nome_variavel}}'}</code> que
            são preenchidas automaticamente com dados do paciente, clínica e profissional ao gerar um documento.
          </p>
          <DocumentTemplatesManager initial={templates} />
        </div>
      </main>
    </>
  )
}
