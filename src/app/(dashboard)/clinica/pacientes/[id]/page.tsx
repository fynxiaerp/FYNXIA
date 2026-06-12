import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPatientDecrypted } from '@/actions/patients'
import { listAnamneses } from '@/actions/anamneses'
import { listMedicalRecords } from '@/actions/medical-records'
import { PatientForm } from '@/components/patients/PatientForm'
import { PatientDeleteDialog } from '@/components/patients/PatientDeleteDialog'
import { AnamnesisList } from '@/components/anamnesis/AnamnesisList'
import { ProntuarioForm } from '@/components/prontuario/ProntuarioForm'
import { Odontogram } from '@/components/odontogram/Odontogram'
import { PdfButton } from '@/components/patients/PdfButton'
import { PageHeader } from '@/components/shell/PageHeader'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

export default async function PatientDetailPage({ params }: Props) {
  const { id } = await params

  // WR-03: derive the role from a fresh authenticated lookup — do NOT trust the
  // forwarded `x-user-role` header for masking / edit-gating security decisions.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: actor } = user
    ? await supabase.from('users').select('role').eq('id', user.id).single()
    : { data: null }
  const userRole = actor?.role ?? 'receptionist'

  const result = await getPatientDecrypted(id)

  if (!result.success || !result.patient) {
    notFound()
  }

  const patient = result.patient

  // Fetch anamneses for the Anamneses tab (CLINIC-08)
  const anamnesisResult = await listAnamneses(patient.id)
  const anamnesisItems = anamnesisResult.anamneses ?? []

  // Fetch medical records for inline Prontuário tab (CLINIC-07)
  const recordsResult = await listMedicalRecords(id)
  const records = recordsResult.success ? (recordsResult.records ?? []) : []

  // Fetch dental records for inline Odontograma tab (D-15)
  const { data: dentalRecords } = await supabase
    .from('dental_records')
    .select('id, tooth_number, status, created_at')
    .eq('patient_id', id)
    .order('created_at', { ascending: false })

  // Mask CPF for receptionist/patient roles (SEC-01, T-2-10)
  const shouldMask = userRole === 'receptionist' || userRole === 'patient'
  const displayCpf = shouldMask
    ? `${patient.cpf.slice(0, 3)}.***.***-**`
    : patient.cpf

  const age = patient.date_of_birth
    ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()
    : null

  const isAdmin = userRole === 'admin' || userRole === 'superadmin'
  const canWrite = userRole === 'admin' || userRole === 'dentist' || userRole === 'superadmin'
  const editable = userRole === 'admin' || userRole === 'dentist'

  return (
    <>
      <PageHeader
        title={patient.full_name}
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Pacientes', href: '/clinica/pacientes' },
          { label: patient.full_name },
        ]}
        actions={<PdfButton patientId={id} />}
      />

      <div className="p-4">
        {/* Patient sub-header: CPF + age + anonymized badge + delete action */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="font-mono text-sm text-muted-foreground">
              CPF: {displayCpf}
              {age !== null && ` · ${age} anos`}
            </p>
            {patient.is_anonymized && (
              <Badge variant="destructive">Anonimizado</Badge>
            )}
          </div>
          {isAdmin && !patient.is_anonymized && (
            <PatientDeleteDialog
              patientId={patient.id}
              patientName={patient.full_name}
            />
          )}
        </div>

        <Separator className="mb-4" />

        {/* Tab structure: Dados, Prontuário (inline), Odontograma (inline), Anamneses */}
        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados do Paciente</TabsTrigger>
            <TabsTrigger value="prontuario">Prontuário</TabsTrigger>
            <TabsTrigger value="odontograma">Odontograma</TabsTrigger>
            <TabsTrigger value="anamneses">Anamneses</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="p-4">
            {patient.is_anonymized ? (
              <p className="text-sm text-muted-foreground">
                Este paciente foi anonimizado. Os dados de identificação não estão mais disponíveis.
              </p>
            ) : (
              <div className="max-w-2xl">
                <PatientForm
                  mode="edit"
                  patientId={patient.id}
                  defaultValues={{
                    full_name: patient.full_name,
                    cpf: patient.cpf,
                    date_of_birth: patient.date_of_birth ?? '',
                    phone: patient.phone ?? '',
                    email: patient.email ?? '',
                    address: patient.address ?? '',
                    medical_history: patient.medical_history ?? '',
                    allergies: patient.allergies ?? '',
                    medications: patient.medications ?? '',
                  }}
                />
              </div>
            )}
          </TabsContent>

          {/* Prontuário — inline content (eliminates redirect stub card) */}
          <TabsContent value="prontuario" className="p-4 space-y-6">
            {canWrite && (
              <div className="max-w-2xl">
                <h2 className="text-base font-semibold mb-4">Registrar Atendimento</h2>
                <ProntuarioForm patientId={id} />
              </div>
            )}

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
          </TabsContent>

          {/* Odontograma — inline content (eliminates redirect stub card) */}
          <TabsContent value="odontograma" className="p-4">
            {!editable && (
              <p className="mb-2 text-xs text-muted-foreground">Modo leitura</p>
            )}
            <Odontogram
              records={dentalRecords ?? []}
              editable={editable}
              patientId={id}
            />
          </TabsContent>

          <TabsContent value="anamneses" className="p-4">
            {/* CLINIC-08 (02-05): real anamneses list */}
            <AnamnesisList patientId={patient.id} anamneses={anamnesisItems} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
