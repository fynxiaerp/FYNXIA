/**
 * Régua de Cobrança — admin-only configuration page (FIN-07)
 *
 * 03-UI-SPEC §Régua de Cobrança:
 * - Admin/superadmin: renders PageHeader + CollectionRulerForm
 * - Non-admin: renders in-page Alert "Acesso restrito" — NO redirect (per UI-SPEC)
 *
 * Server Component — getActor runs server-side for role gate.
 */
import { createClient } from '@/lib/supabase/server'
import { getCollectionRuler } from '@/actions/collection-ruler'
import { CollectionRulerForm } from '@/components/financeiro/CollectionRulerForm'
import { PageHeader } from '@/components/shell/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function ReguaDeCobrancaPage() {
  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Régua de Cobrança"
          breadcrumbs={[
            { label: 'Financeiro', href: '/clinica/financeiro' },
            { label: 'Régua de Cobrança' },
          ]}
        />
        <main className="p-6 max-w-xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>Não autenticado.</AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Actor + role gate ──────────────────────────────────────────────────────
  const { data: actor } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  // Non-admin sees in-page "Acesso restrito" — NO redirect (03-UI-SPEC §Error States)
  if (!actor || !['admin', 'superadmin'].includes(actor.role)) {
    return (
      <>
        <PageHeader
          title="Régua de Cobrança"
          breadcrumbs={[
            { label: 'Financeiro', href: '/clinica/financeiro' },
            { label: 'Régua de Cobrança' },
          ]}
        />
        <main className="p-6 max-w-xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>
              Acesso restrito. Esta área é exclusiva para administradores da clínica.
            </AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Load existing rule (defaults if none) ─────────────────────────────────
  const rulerResult = await getCollectionRuler()
  const initialValues = rulerResult.success ? rulerResult.rule : undefined

  return (
    <>
      <PageHeader
        title="Régua de Cobrança"
        breadcrumbs={[
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Régua de Cobrança' },
        ]}
      />
      <main className="p-6 max-w-xl mx-auto w-full">
        <p className="text-sm text-muted-foreground mb-6">
          Configure os lembretes automáticos por e-mail.
        </p>

        {/* Form */}
        <CollectionRulerForm initialValues={initialValues} />
      </main>
    </>
  )
}
