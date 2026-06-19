/**
 * Teleodontologia session page — /clinica/teleodontologia/[id]
 *
 * Two modes:
 *   - id === 'novo': render TeleconsultationForm in create mode (patients + appointments props)
 *   - id === <uuid>: fetch session → render session detail + session controls (via TeleconsultationForm
 *     in existingSession mode) + SoapEditor so the dentist writes the SOAP record (TEL-02)
 *
 * Server Component — auth + read-only resolved server-side.
 * x-read-only header set by middleware (proxy.ts Plan 07).
 *
 * Phase: 12-receitu-rio-teleodontologia (TEL-01/TEL-02)
 */

import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shell/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { TeleconsultationForm } from '@/components/teleconsultation/TeleconsultationForm'
import { SoapEditor } from '@/components/teleconsultation/SoapEditor'

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TeleodontologiaSessionPage({ params }: PageProps) {
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
          title={isNew ? 'Nova teleconsulta' : 'Teleconsulta'}
          breadcrumbs={[
            { label: 'Clínica', href: '/clinica' },
            { label: 'Teleodontologia', href: '/clinica/teleodontologia' },
            { label: isNew ? 'Nova' : 'Sessão' },
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

  // ── Fetch patients (needed for create mode) ───────────────────────────────
  const { data: patients } = tenantId
    ? await supabase
        .from('patients')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('full_name', { ascending: true })
    : { data: [] }

  // ── Fetch appointments (needed for create mode + SOAP linking) ────────────
  const { data: appointments } = tenantId
    ? await supabase
        .from('appointments')
        .select('id, start_time, patient_id')
        .eq('tenant_id', tenantId) // appointments uses tenant_id, not clinic_id
        .order('start_time', { ascending: false })
        .limit(200)
    : { data: [] }

  // ── Fetch professionals (optional selector in create mode) ────────────────
  const { data: professionals } = tenantId
    ? await supabase
        .from('professionals')
        .select('id, full_name')
        .eq('clinic_id', tenantId)
        .order('full_name', { ascending: true })
    : { data: [] }

  // ── CREATE mode ───────────────────────────────────────────────────────────
  if (isNew) {
    return (
      <>
        <PageHeader
          title="Nova teleconsulta"
          breadcrumbs={[
            { label: 'Clínica', href: '/clinica' },
            { label: 'Teleodontologia', href: '/clinica/teleodontologia' },
            { label: 'Nova' },
          ]}
          actions={
            <Button variant="ghost" size="sm" render={<Link href="/clinica/teleodontologia" />}>
              <ArrowLeft className="size-4" />
              Voltar
            </Button>
          }
        />
        <main className="p-6 max-w-2xl mx-auto w-full space-y-6">
          {isReadOnly && (
            <Alert>
              <AlertDescription>
                Acesso somente leitura. Seu papel não permite criar teleconsultas.
              </AlertDescription>
            </Alert>
          )}
          <TeleconsultationForm
            patients={patients ?? []}
            appointments={(appointments ?? []).map((a) => ({
              id: a.id,
              start_time: a.start_time,
              patient_id: a.patient_id,
            }))}
            professionals={(professionals ?? []).map((p) => ({
              id: p.id,
              full_name: p.full_name,
            }))}
            isReadOnly={isReadOnly}
          />
        </main>
      </>
    )
  }

  // ── SESSION mode: fetch existing teleconsultation ─────────────────────────
  const { data: session, error: sessionError } = tenantId
    ? await supabase
        .from('teleconsultations')
        .select(
          'id, patient_id, professional_id, appointment_id, external_link, consent_given, status, started_at, ended_at, created_at'
        )
        .eq('id', id)
        .eq('clinic_id', tenantId)
        .single()
    : { data: null, error: new Error('No tenant') }

  if (sessionError || !session) {
    notFound()
  }

  // Patient name for heading
  const patientRow = (patients ?? []).find((p) => p.id === session.patient_id)
  const patientName = patientRow?.full_name ?? 'Paciente'

  return (
    <>
      <PageHeader
        title={`Teleconsulta — ${patientName}`}
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Teleodontologia', href: '/clinica/teleodontologia' },
          { label: patientName },
        ]}
        actions={
          <Button variant="ghost" size="sm" render={<Link href="/clinica/teleodontologia" />}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        }
      />

      <main className="p-6 max-w-2xl mx-auto w-full space-y-8">
        {isReadOnly && (
          <Alert>
            <AlertDescription>
              Acesso somente leitura. Seu papel não permite iniciar, encerrar ou registrar notas clínicas.
            </AlertDescription>
          </Alert>
        )}

        {/* Session controls — TeleconsultationForm in existing-session mode */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">Sessão</h2>
          <TeleconsultationForm
            patients={patients ?? []}
            appointments={(appointments ?? []).map((a) => ({
              id: a.id,
              start_time: a.start_time,
              patient_id: a.patient_id,
            }))}
            professionals={(professionals ?? []).map((p) => ({
              id: p.id,
              full_name: p.full_name,
            }))}
            isReadOnly={isReadOnly}
            existingSession={{
              id: session.id,
              consent_given: session.consent_given,
              status: session.status,
              started_at: session.started_at,
              ended_at: session.ended_at,
              external_link: session.external_link,
            }}
          />
        </section>

        <Separator />

        {/* SOAP Editor — TEL-02: links to teleconsultation + atendimento */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-1">
            Registro SOAP no prontuário
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Registre as notas clínicas estruturadas desta sessão. O registro será vinculado ao
            prontuário do paciente
            {session.appointment_id ? ' e ao atendimento agendado' : ''}.
          </p>
          <SoapEditor
            patientId={session.patient_id}
            teleconsultationId={session.id}
            appointmentId={session.appointment_id ?? undefined}
            isReadOnly={isReadOnly}
          />
        </section>
      </main>
    </>
  )
}
