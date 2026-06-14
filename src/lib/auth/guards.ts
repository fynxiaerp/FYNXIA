import 'server-only'
import { headers } from 'next/headers'

/**
 * assertNotReadOnly
 *
 * Call this at the TOP of every mutation Server Action that can be reached by
 * read-only roles (auditor, dpo, socio). Middleware sets `x-read-only: true`
 * in Plan 03 and forwards it as a request header — but because Server Actions
 * are invoked via direct POST (not a navigation request), the middleware
 * redirect logic does NOT block them. This guard provides the mandatory second
 * enforcement layer at the action level.
 *
 * Note: In Next.js 15, `headers()` is async and MUST be awaited.
 *
 * Usage:
 *   export async function updatePatient(formData: FormData) {
 *     'use server'
 *     await assertNotReadOnly()
 *     // ... mutation logic
 *   }
 *
 * @throws {Error} if the `x-read-only` request header is set to `'true'`
 */
export async function assertNotReadOnly(): Promise<void> {
  const headerStore = await headers()
  if (headerStore.get('x-read-only') === 'true') {
    throw new Error('Acesso somente leitura: este papel não pode alterar dados.')
  }
}
