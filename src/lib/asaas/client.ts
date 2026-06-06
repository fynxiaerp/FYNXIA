// src/lib/asaas/client.ts
// Source: Asaas docs + CLAUDE.md REST-direct pattern
import 'server-only'

export class AsaasError extends Error {
  constructor(
    public status: number,
    public body: unknown
  ) {
    super(`Asaas API error ${status}`)
    this.name = 'AsaasError'
  }
}

export async function asaasFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const baseUrl = process.env.ASAAS_BASE_URL
  const apiKey = process.env.ASAAS_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error('ASAAS_BASE_URL and ASAAS_API_KEY must be set')
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'access_token': apiKey,
      'User-Agent': 'FYNXIA/1.0',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new AsaasError(res.status, err)
  }

  return res.json() as Promise<T>
}
