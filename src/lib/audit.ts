import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export async function logBusinessEvent(params: {
  tenantId: string // REQUIRED — never optional (Pitfall 4)
  actorId: string
  action: string
  details: Record<string, unknown>
}): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('audit_logs').insert({
    tenant_id: params.tenantId,
    actor_id: params.actorId,
    action: params.action,
    new_values: params.details,
  })
  if (error) {
    // WR-05: audit failure must be visible to operators even though callers are not interrupted
    // In production, pipe to a monitoring service (Sentry, Datadog, etc.)
    console.error('[audit] logBusinessEvent failed:', error.message, params)
    // Do NOT throw — callers should not fail because of audit errors,
    // but the error must be surfaced to the operator.
  }
}
