'use server'
// Proxy server actions for client component use.
// Cannot re-export from service-orders.ts because it also exports the sync
// isValidOsTransition helper, which Turbopack rejects in 'use server' files.
// These wrappers delegate directly to the real implementations.

import {
  faturarOs as _faturarOs,
  cancelarOs as _cancelarOs,
  getOs as _getOs,
  listOs as _listOs,
  createOs as _createOs,
} from './service-orders'

export async function faturarOs(
  osId: string,
  input: Record<string, unknown>
): Promise<{ success: boolean; osId?: string; error?: string }> {
  return _faturarOs(osId, input)
}

export async function cancelarOs(
  osId: string,
  motivo: string
): Promise<{ success: boolean; approvalRequestId?: string; error?: string }> {
  return _cancelarOs(osId, motivo)
}

export async function getOs(
  id: string
): ReturnType<typeof _getOs> {
  return _getOs(id)
}

export async function listOs(
  filters?: { status?: string; pagador?: string; month?: string; unitId?: string }
): ReturnType<typeof _listOs> {
  return _listOs(filters)
}

export async function createOs(
  input: Parameters<typeof _createOs>[0]
): ReturnType<typeof _createOs> {
  return _createOs(input)
}
