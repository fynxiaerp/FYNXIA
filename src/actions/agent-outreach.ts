'use server'
/**
 * Agent Outreach Read Action
 *
 * AI-02 / AI-03 visibility surface: returns the last 20 agent actions from
 * agent_outreach_log for the authenticated user's tenant (RLS-scoped).
 *
 * SECURITY:
 * - Uses createClient() (RLS) — tenant isolation is automatic via the
 *   `agent_outreach_log` SELECT policy (`tenant_id = get_my_tenant_id()`).
 * - Patient name is MASKED (first name + last initial) per SEC-01.
 * - Read-only — no mutations in this module.
 *
 * ROLES: readable by admin, dentist, receptionist, superadmin (all authenticated
 * clinic staff). Unauthenticated requests are rejected by createClient().
 */

import { createClient } from '@/lib/supabase/server'

// ─── View model ────────────────────────────────────────────────────────────────

export interface AgentOutreachRow {
  id: string
  agent_type: string
  status: string
  created_at: string
  /** Patient name masked: "Maria S." — first name + last initial. */
  patient_name: string | null
}

// ─── Masking helper ───────────────────────────────────────────────────────────

/**
 * Masks a patient full name to "FirstName L." (first name + last initial).
 * Example: "Maria Silva" → "Maria S."
 * If only one word: "João" → "João"
 */
function maskPatientName(fullName: string | null | undefined): string | null {
  if (!fullName) return null
  const parts = fullName.trim().split(/\s+/)
  const firstName = parts[0] ?? fullName
  if (parts.length === 1) return firstName
  const lastWord = parts[parts.length - 1]
  const lastInitial = lastWord ? lastWord[0]?.toUpperCase() : null
  return lastInitial ? `${firstName} ${lastInitial}.` : firstName
}

// ─── listAgentOutreach ────────────────────────────────────────────────────────

/**
 * Returns the last 20 agent outreach log entries for the authenticated tenant,
 * newest-first. Patient names are masked per SEC-01.
 *
 * RLS handles tenant isolation automatically — no explicit tenant_id filter needed.
 */
export async function listAgentOutreach(): Promise<AgentOutreachRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('agent_outreach_log')
    .select('id, agent_type, status, created_at, patients(full_name)')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[agent-outreach] Failed to load agent_outreach_log:', error.message)
    return []
  }

  return (data ?? []).map((row) => {
    const patient = row.patients as { full_name?: string } | null
    return {
      id: row.id,
      agent_type: row.agent_type,
      status: row.status,
      created_at: row.created_at,
      patient_name: maskPatientName(patient?.full_name),
    }
  })
}
