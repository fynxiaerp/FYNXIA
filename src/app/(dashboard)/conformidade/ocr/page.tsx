/**
 * /conformidade/ocr — OCR de Documentos (OCR-01, OCR-02)
 *
 * Server Component (RSC — NO 'use client'): queries pending_review extractions
 * server-side via createClient() (RLS-scoped to actor's tenant). Auth gate
 * and data fetch must remain server-side.
 *
 * OCR pilot: admin/superadmin only (conformidade module — proxy allows
 * admin/superadmin/auditor/dpo; OCR write is restricted to admin/superadmin).
 * Receptionist extension deferred — plan decision: keep OCR pilot under
 * admin/superadmin only; receptionist access is a future extension (the
 * /api/ocr route itself only needs an authenticated user).
 *
 * RSC RULE: passes ONLY serializable arrays (pendingQueue) to <OcrUploadReview> —
 * no functions, no server objects, no components across the RSC boundary (T-09-25).
 *
 * Security:
 *   T-10-35: RSC auth gate + proxy conformidade module; /api/ocr 401 gate.
 *   T-10-36: RLS tenant scope on pending_review queue — cross-tenant isolation.
 *
 * Phase: 10-ia-governada-l0-l4-auditoria-ocr / Plan 08 (OCR-01, OCR-02)
 */

import { createClient } from '@/lib/supabase/server'
import { OcrUploadReview } from '@/components/conformidade/OcrUploadReview'
import { PageHeader } from '@/components/shell/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Roles permitted to access the OCR pilot under conformidade.
// DECISION: admin/superadmin only — receptionist extension deferred (see plan).
// Auditor/dpo can view conformidade module via proxy, but OCR write requires
// admin/superadmin since it creates patient records.
const PERMITTED_ROLES = ['admin', 'superadmin'] as const

// ─── Serializable shape from ocr_extractions (passed to client component) ──────
// extracted_fields is Json in DB — typed here as per PatientDocumentSchema shape
export interface OcrExtractionQueueRow {
  id: string
  source_filename: string | null
  extracted_fields: Record<string, { value: string; confidence: number }>
  min_confidence: number
  status: string
  created_at: string
}

export default async function OcrPage() {
  const supabase = await createClient()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="OCR de Documentos"
          breadcrumbs={[{ label: 'Conformidade' }, { label: 'OCR' }]}
        />
        <main className="p-6 max-w-4xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>Acesso restrito. Faça login para continuar.</AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Role gate ─────────────────────────────────────────────────────────────────
  const { data: actor } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!actor || !(PERMITTED_ROLES as readonly string[]).includes(actor.role)) {
    return (
      <>
        <PageHeader
          title="OCR de Documentos"
          breadcrumbs={[{ label: 'Conformidade' }, { label: 'OCR' }]}
        />
        <main className="p-6 max-w-4xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>
              Acesso restrito. Esta área é exclusiva para administradores.
            </AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Query pending_review queue (RLS tenant-scoped — T-10-36) ──────────────────
  // RLS USING policy on ocr_extractions enforces clinic_id = get_my_tenant_id().
  // is('deleted_at', null) ensures soft-deleted extractions are excluded.
  const { data: queueRows, error: queryError } = await supabase
    .from('ocr_extractions')
    .select('id, source_filename, extracted_fields, min_confidence, status, created_at')
    .eq('status', 'pending_review')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (queryError) {
    return (
      <>
        <PageHeader
          title="OCR de Documentos"
          breadcrumbs={[{ label: 'Conformidade' }, { label: 'OCR' }]}
        />
        <main className="p-6 max-w-4xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>Erro ao carregar fila: {queryError.message}</AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // RSC RULE: cast to serializable shape — only pass plain data to client (T-09-25).
  // extracted_fields comes as Json from Supabase; we cast it to the expected shape.
  // The OcrUploadReview component handles malformed/partial fields gracefully.
  const pendingQueue: OcrExtractionQueueRow[] = (queueRows ?? []).map((row) => ({
    id: row.id,
    source_filename: row.source_filename,
    extracted_fields: (row.extracted_fields ?? {}) as Record<
      string,
      { value: string; confidence: number }
    >,
    min_confidence: row.min_confidence,
    status: row.status,
    created_at: row.created_at,
  }))

  return (
    <>
      <PageHeader
        title="OCR de Documentos"
        breadcrumbs={[{ label: 'Conformidade' }, { label: 'OCR' }]}
      />

      <main className="p-6 max-w-4xl mx-auto w-full space-y-4">
        <p className="text-sm text-muted-foreground">
          Envie uma imagem ou PDF de documento (RG, comprovante de residência) para extrair os
          dados do paciente automaticamente. Campos com baixa confiança são marcados para revisão
          antes de serem salvos no cadastro.
        </p>

        {/* RSC RULE: pass ONLY serializable array — no functions/server objects across boundary */}
        <OcrUploadReview pendingQueue={pendingQueue} />
      </main>
    </>
  )
}
