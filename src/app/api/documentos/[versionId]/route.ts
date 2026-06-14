/**
 * GET /api/documentos/[versionId]
 *
 * Streams a signed document PDF from the private documents-pdf bucket.
 *
 * SECURITY:
 *   T-08-19: raw storage_path is NEVER returned to the client — only signed URL or streamed bytes.
 *   Uses a short-TTL signed URL (60 s) from the private bucket (service role).
 *   Cross-tenant guard: document's clinic_id must match the actor's tenant_id.
 *   Cache-Control: no-store — PDF contains patient PII (LGPD).
 *
 * RUNTIME: nodejs — @react-pdf/renderer requires Node.js TCP connections.
 * Node modules (path, crypto, Buffer) are available in this runtime.
 *
 * Phase: 08-documentos-assinatura-icp-brasil (DOC-02/03)
 */

// CRITICAL: Node.js runtime — documents-pdf bucket access requires full Node.js (CLAUDE.md)
export const runtime = 'nodejs'
export const maxDuration = 30

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface RouteParams {
  params: Promise<{ versionId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { versionId } = await params

  try {
    // 1. Authenticate via RLS-scoped client
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response('Não autenticado', { status: 401 })
    }

    // 2. Get actor's tenant_id for cross-tenant guard
    const { data: actor, error: actorError } = await supabase
      .from('users')
      .select('id, tenant_id')
      .eq('id', user.id)
      .single()

    if (actorError || !actor) {
      return new Response('Usuário não encontrado', { status: 401 })
    }

    // 3. Fetch version metadata via admin (storage_path is REVOKE-protected from normal RLS)
    const admin = createAdminClient()
    const { data: version, error: verError } = await admin
      .from('document_versions')
      .select('storage_path, document_id')
      .eq('id', versionId)
      .single()

    if (verError || !version) {
      return new Response('Versão não encontrada', { status: 404 })
    }

    if (!version.storage_path) {
      // Version exists but PDF not yet generated (unsigned draft with no upload)
      return new Response('PDF ainda não gerado para esta versão', { status: 404 })
    }

    // 4. Cross-tenant guard: verify document belongs to the actor's clinic
    const { data: doc, error: docError } = await admin
      .from('documents')
      .select('clinic_id')
      .eq('id', version.document_id)
      .single()

    if (docError || !doc) {
      return new Response('Documento não encontrado', { status: 404 })
    }

    if (doc.clinic_id !== actor.tenant_id) {
      // T-08-21: cross-tenant access — return 404 (not 403) to avoid information disclosure
      return new Response('Documento não encontrado', { status: 404 })
    }

    // 5. Create short-TTL signed URL (60 seconds) — raw path never sent to client (T-08-19)
    const { data: signedData, error: signError } = await admin.storage
      .from('documents-pdf')
      .createSignedUrl(version.storage_path, 60)

    if (signError || !signedData?.signedUrl) {
      // Fallback: stream the bytes directly if signed URL creation fails
      const { data: pdfBlob, error: dlError } = await admin.storage
        .from('documents-pdf')
        .download(version.storage_path)

      if (dlError || !pdfBlob) {
        return new Response('PDF não encontrado no armazenamento', { status: 404 })
      }

      const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())
      const uint8Array = new Uint8Array(pdfBuffer)
      const safeFileName = `documento-${versionId}.pdf`

      return new Response(uint8Array, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeFileName}"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
    }

    // 6. Redirect to the short-TTL signed URL (client fetches directly from storage CDN)
    // The redirect itself does not expose the raw storage_path — only the time-limited URL.
    // WR-03: add Cache-Control: no-store so intermediaries (Vercel edge, browser) do NOT
    // cache the redirect response — the signed URL itself has a 60s TTL and contains PII.
    return new Response(null, {
      status: 302,
      headers: {
        'Location': signedData.signedUrl,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    })
  } catch (error) {
    console.error('[documentos/route] PDF download error:', error)
    return new Response(
      JSON.stringify({ error: 'Não foi possível baixar o documento. Tente novamente.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
