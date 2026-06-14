/**
 * AI agent config shared types and constants.
 *
 * Extracted from src/actions/ai-agent-config.ts because a 'use server' file
 * can only export async functions (Next.js constraint). Non-async exports
 * (constants, types) must live in a separate module.
 *
 * Imported by both the Server Action (ai-agent-config.ts) and client components.
 */

/**
 * Autonomy levels for AI agents (D-05):
 * L0 = sugere (suggest only — human always decides)
 * L1 = rascunha (drafts message, human sends)
 * L2 = executa com confirmação (executes after human confirmation)
 * L3 = executa com notificação (executes, notifies human after)
 * L4 = executa autonomamente (fully autonomous — enforcement via Fase 10)
 */
export const AUTONOMY_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number]

export const AGENT_KEYS = ['confirmation', 'collection'] as const
export type AgentKey = (typeof AGENT_KEYS)[number]

export interface AiAgentConfigRow {
  id: string
  clinic_id: string
  unit_id: string | null
  agent_key: string
  autonomy_level: string
  enabled: boolean
  limits: Record<string, unknown> | null
  updated_by: string | null
  created_at: string
  updated_at: string
}
