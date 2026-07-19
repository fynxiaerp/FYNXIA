/**
 * /conformidade/auditoria — Audit Trail Screen (AUD-01, AUD-03)
 *
 * Server Component (RSC — NO 'use client'): queries audit_logs server-side
 * via queryAuditLogs (createAdminClient + AUDIT_PERMITTED_ROLES gate +
 * mandatory tenant filter). Data access must remain server-side.
 *
 * Auth + role gate resolved here; only serializable `rows` array + plain
 * booleans passed to the <AuditTrail> client component (T-09-25 / RSC rule —
 * no functions/server objects across the RSC boundary).
 *
 * RBAC: admin, superadmin, auditor, dpo may view; isReadOnly=true for
 * auditor/dpo hides the estorno trigger (cosmetic UX — createEstorno enforces
 * assertNotReadOnly + alçada server-side, T-10-17).
 *
 * Phase: 10-ia-governada-l0-l4-auditoria-ocr / Plan 07 (AUD-01, AUD-03)
 */

import { createClient } from '@/lib/supabase/server'
import { queryAuditLogs } from '@/actions/audit-actions'
import { AuditTrail } from '@/components/conformidade/AuditTrail'
import { PageHeader } from '@/components/shell/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { AuditFilters } from '@/lib/audit-query-types'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

// Roles permitted to access the conformidade module (mirrors MODULE_PERMISSIONS in proxy.ts)
const PERMITTED_ROLES = ['admin', 'superadmin', 'auditor', 'dpo'] as const

// Read-only roles — can view the trail but cannot initiate estornos
const READ_ONLY_ROLES = ['auditor', 'dpo'] as const

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Auditoria"
          breadcrumbs={[{ label: 'Conformidade' }, { label: 'Auditoria' }]}
        />
        <main className="p-6 max-w-5xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>Acesso restrito. Faça login para continuar.</AlertDescription>
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

  if (!actor || !(PERMITTED_ROLES as readonly string[]).includes(actor.role)) {
    return (
      <>
        <PageHeader
          title="Auditoria"
          breadcrumbs={[{ label: 'Conformidade' }, { label: 'Auditoria' }]}
        />
        <main className="p-6 max-w-5xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>
              Acesso restrito. Esta área é exclusiva para auditores, DPO e administradores.
            </AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── isReadOnly — auditor/dpo cannot initiate estornos (cosmetic gate) ─────────
  const isReadOnly = (READ_ONLY_ROLES as readonly string[]).includes(actor.role)

  // ── Read filters from searchParams ───────────────────────────────────────────
  // nuqs writes to URL search params; RSC reads them for initial server-side fetch.
  const resolvedParams = await searchParams
  const filters: AuditFilters = {
    tableName: typeof resolvedParams.tableName === 'string' ? resolvedParams.tableName || undefined : undefined,
    actorId: typeof resolvedParams.actorId === 'string' ? resolvedParams.actorId || undefined : undefined,
    dateFrom: typeof resolvedParams.dateFrom === 'string' ? resolvedParams.dateFrom || undefined : undefined,
    dateTo: typeof resolvedParams.dateTo === 'string' ? resolvedParams.dateTo || undefined : undefined,
    page: typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page, 10) || 0 : 0,
  }

  // ── Server-side data fetch ────────────────────────────────────────────────────
  const result = await queryAuditLogs(filters)
  // Pass only the serializable rows array (never pass server objects to client — T-09-25)
  const rows = result.rows ?? []

  return (
    <NuqsAdapter>
      <PageHeader
        title="Auditoria"
        breadcrumbs={[{ label: 'Conformidade' }, { label: 'Auditoria' }]}
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-4">
        <p className="text-sm text-muted-foreground">
          Trilha de auditoria imutável. Filtre por entidade, usuário e período.
          Cada registro exibe o estado antes e depois da alteração (old_values / new_values).
          {isReadOnly ? ' Modo somente leitura — estornos exigem papel de administrador.' : ''}
        </p>

        {!result.success && (
          <Alert variant="destructive">
            <AlertDescription>{result.error ?? 'Erro ao carregar registros.'}</AlertDescription>
          </Alert>
        )}

        {/* RSC RULE: pass ONLY serializable arrays + plain booleans — no functions across boundary */}
        <AuditTrail initialRows={rows} isReadOnly={isReadOnly} />
      </main>
    </NuqsAdapter>
  )
}
