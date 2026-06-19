/**
 * Receituário issue/read page — /clinica/receituario/[id]
 *
 * Two modes:
 *   - id === 'novo': render ClinicalDocumentForm in create mode (medications + patients props).
 *     On submit → issueClinicDocument (allergy alert non-blocking) → draft → "Assinar (ICP-Brasil)".
 *   - id === <uuid>: fetch the document (tenant-scoped, NEVER storage_path/cert_pem), decrypt
 *     content_json server-side, and render the read/sign view. Signed docs are immutable (RX-03).
 *
 * Server Component — auth + read-only resolved server-side.
 * x-read-only header set by middleware (proxy.ts Plan 06).
 *
 * nodejs runtime: the sign action renders + signs a PDF (@react-pdf/renderer + ICP) which
 * requires the Node.js runtime, not Edge. Decryption of content_json also runs here (Node crypto).
 *
 * Security:
 *   - T-12-21: never selects storage_path or cert_pem.
 *   - content_json decrypted server-side; only display-safe content reaches the client.
 *
 * Phase: 12-receitu-rio-teleodontologia (RX-01/RX-02/RX-03)
 */

import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { PageHeader } from '@/components/shell/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  ClinicalDocumentForm,
  type MedicationOption,
  type PatientOption,
  type ExistingDocument,
} from '@/components/receituario/ClinicalDocumentForm'

export const runtime = 'nodejs'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ReceituarioDocumentPage({ params }: PageProps) {
  const { id } = await params
  const isNew = id === 'novo'

  const supabase = await createClient()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title={isNew ? 'Emitir documento' : 'Documento'}
          breadcrumbs={[
            { label: 'Clínica', href: '/clinica' },
            { label: 'Receituário', href: '/clinica/receituario' },
            { label: isNew ? 'Novo' : 'Documento' },
          ]}
        />
        <main className="p-6 max-w-3xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>Não autenticado.</AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Role + read-only from middleware headers ───────────────────────────────
  const headerStore = await headers()
  const isReadOnly = headerStore.get('x-read-only') === 'true'

  // ── Resolve actor tenant ──────────────────────────────────────────────────
  const { data: actor } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  const tenantId = actor?.tenant_id

  // ── Fetch patients (create mode + name lookup) ─────────────────────────────
  const { data: patientsRaw } = tenantId
    ? await supabase
        .from('patients')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('full_name', { ascending: true })
    : { data: [] }

  const patients: PatientOption[] = (patientsRaw ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
  }))

  // ── CREATE mode ───────────────────────────────────────────────────────────
  if (isNew) {
    // Medications are a global table (no clinic_id) — only active ones for the combobox.
    const { data: medsRaw } = await supabase
      .from('medications')
      .select(
        'id, name, generic_name, therapeutic_class, requires_special_control, common_dosages'
      )
      .eq('active', true)
      .order('name', { ascending: true })

    const medications: MedicationOption[] = (medsRaw ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      generic_name: m.generic_name,
      therapeutic_class: m.therapeutic_class,
      requires_special_control: m.requires_special_control,
      common_dosages: m.common_dosages ?? [],
    }))

    return (
      <>
        <PageHeader
          title="Emitir documento"
          breadcrumbs={[
            { label: 'Clínica', href: '/clinica' },
            { label: 'Receituário', href: '/clinica/receituario' },
            { label: 'Novo' },
          ]}
          actions={
            <Button variant="ghost" size="sm" render={<Link href="/clinica/receituario" />}>
              <ArrowLeft className="size-4" />
              Voltar
            </Button>
          }
        />
        <main className="p-6 max-w-2xl mx-auto w-full space-y-6">
          {isReadOnly && (
            <Alert>
              <AlertDescription>
                Acesso somente leitura. Seu papel não permite emitir documentos clínicos.
              </AlertDescription>
            </Alert>
          )}
          <ClinicalDocumentForm
            medications={medications}
            patients={patients}
            isReadOnly={isReadOnly}
          />
        </main>
      </>
    )
  }

  // ── READ/SIGN mode: fetch existing document (NEVER storage_path/cert_pem) ───
  const { data: doc, error: docError } = tenantId
    ? await supabase
        .from('clinical_documents')
        .select(
          'id, doc_number, doc_type, status, content_json, patient_id, signer_cn, signed_at, cert_thumbprint, clinic_id'
        )
        .eq('id', id)
        .eq('clinic_id', tenantId)
        .is('deleted_at', null)
        .single()
    : { data: null, error: new Error('No tenant') }

  if (docError || !doc) {
    notFound()
  }

  // Decrypt content_json server-side — only display-safe content reaches the client.
  let content: ExistingDocument['content'] = {}
  try {
    content = JSON.parse(decrypt(doc.content_json)) as ExistingDocument['content']
  } catch {
    content = {}
  }

  const patientName =
    patients.find((p) => p.id === doc.patient_id)?.full_name ?? 'Paciente'

  const existingDocument: ExistingDocument = {
    id: doc.id,
    doc_number: doc.doc_number,
    doc_type: doc.doc_type,
    status: doc.status,
    signer_cn: doc.signer_cn,
    signed_at: doc.signed_at,
    cert_thumbprint: doc.cert_thumbprint,
    content,
  }

  return (
    <>
      <PageHeader
        title={`Documento — ${patientName}`}
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Receituário', href: '/clinica/receituario' },
          { label: doc.doc_number },
        ]}
        actions={
          <Button variant="ghost" size="sm" render={<Link href="/clinica/receituario" />}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        }
      />

      <main className="p-6 max-w-2xl mx-auto w-full space-y-6">
        {isReadOnly && (
          <Alert>
            <AlertDescription>
              Acesso somente leitura. Seu papel não permite assinar documentos clínicos.
            </AlertDescription>
          </Alert>
        )}

        <ClinicalDocumentForm
          medications={[]}
          patients={patients}
          isReadOnly={isReadOnly}
          existingDocument={existingDocument}
        />
      </main>
    </>
  )
}
