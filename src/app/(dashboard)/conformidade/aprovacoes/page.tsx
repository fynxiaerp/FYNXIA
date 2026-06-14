/**
 * /conformidade/aprovacoes — Approval Inbox (AIG-02, AUD-02)
 *
 * Server Component (RSC — NO 'use client'): queries pending approval_requests
 * for the tenant server-side via createClient() (RLS-scoped). No 'use client' —
 * auth gate and data fetch must remain server-side.
 *
 * One queue for both AI-sensitive actions (type='ai_action') and estornos
 * (type='estorno'). Auditor/DPO can view pending items but cannot approve
 * (server-side enforcement in approveRequest/rejectRequest via assertNotReadOnly
 * + canApprove — T-10-29). Client disable is cosmetic UX only.
 *
 * RSC RULE: passes ONLY serializable arrays (pendingRequests) + actor role string
 * to <ApprovalInbox> — no functions/server objects across RSC boundary (T-09-25).
 *
 * Phase: 10-ia-governada-l0-l4-auditoria-ocr / Plan 07 (AIG-02, AUD-02)
 */

import { createClient } from '@/lib/supabase/server'
import { ApprovalInbox } from '@/components/conformidade/ApprovalInbox'
import { PageHeader } from '@/components/shell/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Roles permitted to access the conformidade module (mirrors MODULE_PERMISSIONS in proxy.ts)
const PERMITTED_ROLES = ['admin', 'superadmin', 'auditor', 'dpo'] as const

// ─── ApprovalRequestRow ───────────────────────────────────────────────────────
// Serializable shape from approval_requests query (passed to client component)

export interface ApprovalRequestRow {
  id: string
  type: string
  payload: Record<string, unknown> | null
  agent_key: string | null
  required_role: string
  requested_by: string | null
  status: string
  reason: string | null
  created_at: string
  expires_at: string | null
}

export default async function AprovacoesPage() {
  const supabase = await createClient()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Aprovações"
          breadcrumbs={[{ label: 'Conformidade' }, { label: 'Aprovações' }]}
        />
        <main className="p-6 max-w-4xl mx-auto w-full">
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
          title="Aprovações"
          breadcrumbs={[{ label: 'Conformidade' }, { label: 'Aprovações' }]}
        />
        <main className="p-6 max-w-4xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>
              Acesso restrito. Esta área é exclusiva para auditores, DPO e administradores.
            </AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Query pending approval_requests (RLS-scoped to actor's tenant) ────────────
  // RLS WITH CHECK on approval_requests enforces clinic_id = get_my_tenant_id().
  // No explicit tenant filter needed here — the RLS policy enforces it.
  const { data: pendingRequests, error: queryError } = await supabase
    .from('approval_requests')
    .select(
      'id, type, payload, agent_key, required_role, requested_by, status, reason, created_at, expires_at',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (queryError) {
    return (
      <>
        <PageHeader
          title="Aprovações"
          breadcrumbs={[{ label: 'Conformidade' }, { label: 'Aprovações' }]}
        />
        <main className="p-6 max-w-4xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>Erro ao carregar solicitações: {queryError.message}</AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // Cast to serializable shape — pass ONLY plain data to client component (T-09-25)
  const rows: ApprovalRequestRow[] = (pendingRequests ?? []) as ApprovalRequestRow[]

  return (
    <>
      <PageHeader
        title="Aprovações"
        breadcrumbs={[{ label: 'Conformidade' }, { label: 'Aprovações' }]}
      />

      <main className="p-6 max-w-4xl mx-auto w-full space-y-4">
        <p className="text-sm text-muted-foreground">
          Fila única de aprovação para ações sensíveis de IA e solicitações de estorno.
          {actor.role === 'auditor' || actor.role === 'dpo'
            ? ' Modo somente leitura — aprovações exigem papel de administrador.'
            : ' Aprove ou rejeite cada solicitação. O servidor verifica alçada antes de executar.'}
        </p>

        {/* RSC RULE: pass ONLY serializable rows + actor role string — no functions/objects */}
        <ApprovalInbox pendingRequests={rows} actorRole={actor.role} />
      </main>
    </>
  )
}
