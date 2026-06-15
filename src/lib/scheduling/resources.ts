/**
 * Pure scheduling helpers: resource availability (RES-01 / RES-02)
 *
 * PURE module — no 'use server', no 'server-only', no Supabase imports.
 * Importable in client components (TV panel), server components, and tests alike.
 *
 * isResourceAvailable: determines if a resource can be booked based on its status.
 * RES-02: 'manutencao' and 'inativo' block booking; only 'ativo' allows it.
 */

export const RESOURCE_STATUS = ['ativo', 'manutencao', 'inativo'] as const
export const RESOURCE_TYPES = ['sala', 'cadeira', 'equipamento'] as const

export type ResourceStatus = (typeof RESOURCE_STATUS)[number]
export type ResourceType = (typeof RESOURCE_TYPES)[number]

/**
 * Returns true only when the resource status is 'ativo'.
 * null/undefined (no resource selected) → false (treat as unavailable).
 * 'manutencao' or 'inativo' → false (T-11-10 / RES-02 maintenance block).
 */
export function isResourceAvailable(status: string | null | undefined): boolean {
  return status === 'ativo'
}
