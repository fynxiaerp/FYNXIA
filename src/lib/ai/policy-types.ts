// src/lib/ai/policy-types.ts
// Pure policy types + decision matrix + alçada helper.
// NO 'use server', NO 'server-only' — importable in tests, client-safe utilities,
// and non-server modules. Server enforcement lives in policy.ts.
//
// D-131 constraint: computePolicyDecision + canApprove are sync/pure so they
// live HERE and are re-exported by policy.ts.

// ─── Types ────────────────────────────────────────────────────────────────────

export type PolicyDecision = 'execute' | 'suggest' | 'block' | 'pending_approval'

export type ActionSensitivity = 'safe' | 'reversible' | 'sensitive'

/**
 * PolicyContext — passed to withAgentPolicy() for every action.
 *
 * clinicId is a required non-null string: ai_decision_log.clinic_id is NOT NULL.
 * Every withAgentPolicy call MUST supply a real resolved tenant id — never null or
 * an aggregate across tenants. Agents resolve clinicId PER-ROW inside the scan loop.
 */
export interface PolicyContext {
  clinicId: string
  agentKey: string
  actorId: string | null
  action: string
  actionSensitivity: ActionSensitivity
}

// ─── Decision matrix ──────────────────────────────────────────────────────────

/**
 * computePolicyDecision — pure, synchronous, side-effect-free.
 *
 * L0–L4 × ActionSensitivity matrix (AIG-01):
 *   L0 → 'suggest'               (suggest-only; still logs at execute decision for safe reads)
 *   L1 + 'safe' → 'execute'      (execute read-only/safe actions)
 *   L1 + other → 'suggest'       (non-safe actions need higher level)
 *   L2 + 'sensitive' → 'pending_approval'
 *   L2 + other → 'execute'       (reversible + safe execute at L2)
 *   L3 + 'sensitive' → 'pending_approval'
 *   L3 + other → 'execute'       (reversible + safe execute at L3)
 *   L4 → 'execute'               (all execute; still logged — AIG-03)
 *   unknown → 'block'            (fail-safe: unknown level is rejected)
 */
export function computePolicyDecision(
  level: string,
  sensitivity: ActionSensitivity,
): PolicyDecision {
  if (level === 'L0') return 'suggest'
  if (level === 'L1') return sensitivity === 'safe' ? 'execute' : 'suggest'
  if (level === 'L2') return sensitivity === 'sensitive' ? 'pending_approval' : 'execute'
  if (level === 'L3') return sensitivity === 'sensitive' ? 'pending_approval' : 'execute'
  if (level === 'L4') return 'execute' // L4 executes all; still logged (AIG-03)
  return 'block' // unknown level → fail-safe block
}

// ─── Alçada (approval authorization) ─────────────────────────────────────────

/**
 * APPROVER_RANK maps a user role to an alçada rank.
 * Higher rank = broader approval authority.
 *
 * superadmin > admin > (everyone else has 0)
 */
export const APPROVER_RANK: Record<string, number> = {
  superadmin: 100,
  admin: 50,
  // All other roles (dentist, receptionist, auditor, dpo, socio, etc.) default to 0
}

/**
 * canApprove — pure alçada check.
 *
 * Returns true if the `role` has sufficient rank to approve a request
 * that requires `requiredRole`.
 *
 * Examples:
 *   canApprove('admin', 'admin')       → true  (equal rank)
 *   canApprove('superadmin', 'admin')  → true  (higher rank)
 *   canApprove('receptionist', 'admin') → false (lower rank)
 *   canApprove('auditor', 'admin')     → false (read-only role)
 */
export function canApprove(role: string, requiredRole: string): boolean {
  return (APPROVER_RANK[role] ?? 0) >= (APPROVER_RANK[requiredRole] ?? Infinity)
}
