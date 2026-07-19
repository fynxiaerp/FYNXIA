'use server'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'

// ─── Helper: get authenticated actor ────────────────────────────────────────
// Duplicated locally (not imported) — mirrors the pattern used across
// src/actions/appointments.ts, src/actions/invitations.ts, etc.

type Actor = {
  id: string
  tenant_id: string
  role: string
}

async function getActor(): Promise<{ actor: Actor } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Não autenticado' }
  }

  const { data: actor, error: actorError } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (actorError || !actor) {
    return { error: 'Usuário não encontrado' }
  }

  return { actor }
}

// ─── updateTeamMemberName ───────────────────────────────────────────────────
// Escopo estrito: edição de full_name APENAS. Não altera role, status ou
// qualquer outro campo do membro da equipe.
export async function updateTeamMemberName(
  userId: string,
  fullName: string
): Promise<{ success: boolean; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  // T-kjy-02: role-gate antes de qualquer write
  const allowedRoles = ['admin', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Apenas administradores podem editar membros da equipe' }
  }

  // T-kjy-04: validação de nome
  const trimmed = (fullName ?? '').trim()
  if (trimmed.length < 2) {
    return { success: false, error: 'Nome deve ter pelo menos 2 caracteres' }
  }

  // T-kjy-01 / WR-02 CRÍTICO: UPDATE filtrado por id AND tenant_id — nunca
  // confiar no userId cru vindo do cliente sem checagem de tenant.
  const supabase = await createClient()
  const { data: updated, error: updateError } = await supabase
    .from('users')
    .update({ full_name: trimmed })
    .eq('id', userId)
    .eq('tenant_id', actor.tenant_id) // WR-02: nunca confiar no id cru sem tenant check
    .select('id')

  if (updateError) {
    return { success: false, error: updateError.message }
  }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'Membro não encontrado nesta clínica' }
  }

  // T-kjy-03: trilha de auditoria
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'team_member.updated',
    details: { user_id: userId },
  })

  return { success: true }
}
