/**
 * Régua de Cobrança — admin-only configuration page (FIN-07)
 *
 * 03-UI-SPEC §Régua de Cobrança:
 * - Admin/superadmin: renders breadcrumb + heading + CollectionRulerForm
 * - Non-admin: renders in-page Alert "Acesso restrito" — NO redirect (per UI-SPEC)
 *
 * Server Component — getActor runs server-side for role gate.
 */
import { createClient } from '@/lib/supabase/server'
import { getCollectionRuler } from '@/actions/collection-ruler'
import { CollectionRulerForm } from '@/components/financeiro/CollectionRulerForm'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export default async function ReguaDeCobrancaPage() {
  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>Não autenticado.</AlertDescription>
        </Alert>
      </div>
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
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Acesso restrito. Esta área é exclusiva para administradores da clínica.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // ── Load existing rule (defaults if none) ─────────────────────────────────
  const rulerResult = await getCollectionRuler()
  const initialValues = rulerResult.success ? rulerResult.rule : undefined

  return (
    <div className="p-6 max-w-2xl">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/clinica">Clínica</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/clinica/financeiro">Financeiro</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Régua de Cobrança</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Heading */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold leading-tight">Régua de Cobrança</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure os lembretes automáticos por e-mail.
        </p>
      </div>

      {/* Form */}
      <CollectionRulerForm initialValues={initialValues} />
    </div>
  )
}
