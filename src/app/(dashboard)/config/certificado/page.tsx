/**
 * Certificado ICP-Brasil config page — SYS-02 / Plan 07-06
 *
 * Admin/superadmin/ti: upload + view ICP-Brasil A1 certificate metadata.
 * Non-admin: in-page Alert "Acesso restrito" — NO redirect (v1 UI convention).
 *
 * Server Component — auth + role resolved server-side.
 * Cert bytes and password NEVER leave the server (Type-level guarantee via CertificatePublic).
 */
import { createClient } from '@/lib/supabase/server'
import { getCertificate } from '@/actions/certificate'
import { CertificateUpload } from '@/components/config/CertificateUpload'
import { PageHeader } from '@/components/shell/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function CertificadoPage() {
  const supabase = await createClient()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Certificado ICP-Brasil"
          breadcrumbs={[
            { label: 'Configurações', href: '/config' },
            { label: 'Certificado' },
          ]}
        />
        <main className="p-6 max-w-2xl mx-auto w-full">
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

  // cert upload is admin/superadmin/ti
  if (!actor || !['admin', 'superadmin', 'ti'].includes(actor.role)) {
    return (
      <>
        <PageHeader
          title="Certificado ICP-Brasil"
          breadcrumbs={[
            { label: 'Configurações', href: '/config' },
            { label: 'Certificado' },
          ]}
        />
        <main className="p-6 max-w-2xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>
              Acesso restrito. Esta área é exclusiva para administradores e TI.
            </AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Load current certificate metadata ────────────────────────────────────────
  const certResult = await getCertificate()
  const currentCert = certResult.success ? certResult.certificate : undefined

  return (
    <>
      <PageHeader
        title="Certificado ICP-Brasil"
        breadcrumbs={[
          { label: 'Configurações', href: '/config' },
          { label: 'Certificado' },
        ]}
      />

      <main className="p-6 max-w-2xl mx-auto w-full space-y-6">
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Faça upload do seu certificado digital A1 (.pfx) para habilitar a
            assinatura eletrônica de documentos. O arquivo e a senha são armazenados
            com segurança — nunca expostos ao cliente.
          </p>
          <CertificateUpload current={currentCert} />
        </div>
      </main>
    </>
  )
}
