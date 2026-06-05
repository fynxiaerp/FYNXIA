import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listMedicalRecords, createMedicalRecord } from '@/actions/medical-records'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ProntuarioForm } from '@/components/prontuario/ProntuarioForm'

interface Props {
  params: Promise<{ id: string }>
}

// Format date to pt-BR
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function ProntuarioPage({ params }: Props) {
  const { id } = await params

  const headersList = await headers()
  const userRole = headersList.get('x-user-role') ?? 'receptionist'

  // Fetch patient name for breadcrumb
  const supabase = await createClient()
  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name, is_anonymized')
    .eq('id', id)
    .single()

  if (!patient) {
    notFound()
  }

  // Fetch all medical records ordered by created_at DESC (CLINIC-07, D-10)
  const recordsResult = await listMedicalRecords(id)
  const records = recordsResult.success ? (recordsResult.records ?? []) : []

  const canWrite =
    userRole === 'admin' || userRole === 'dentist' || userRole === 'superadmin'

  return (
    <div className="p-4 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/clinica" />}>Clínica</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/clinica/pacientes" />}>
              Pacientes
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/clinica/pacientes/${id}`} />}>
              {patient.full_name}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Prontuário</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold leading-tight">Prontuário Clínico</h1>
        {/* PDF download button — links to the Route Handler */}
        <a
          href={`/api/patients/${id}/prontuario.pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Baixar Prontuário PDF
        </a>
      </div>

      <Separator />

      {/* New record form — only for admin/dentist/superadmin */}
      {canWrite && (
        <div className="max-w-2xl">
          <h2 className="text-base font-semibold mb-4">Registrar Atendimento</h2>
          <ProntuarioForm patientId={id} />
        </div>
      )}

      {/* Medical records history (CLINIC-07, D-10) */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold">
          Histórico de Atendimentos
          {records.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {records.length}
            </Badge>
          )}
        </h2>

        {records.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <p className="text-base font-semibold text-muted-foreground">
              Sem prontuários registrados
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Registre o primeiro atendimento clínico usando o formulário acima.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => (
              <Card key={record.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-muted-foreground">
                      {formatDate(record.created_at)}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      Dr(a). {record.dentist?.full_name ?? 'Dentista'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {record.diagnosis && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Diagnóstico
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">{record.diagnosis}</p>
                    </div>
                  )}
                  {record.treatment_plan && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Plano de Tratamento
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">{record.treatment_plan}</p>
                    </div>
                  )}
                  {record.prescription && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Prescrição
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">{record.prescription}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
