import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPatientDecrypted } from '@/actions/patients'
import { listAnamneses } from '@/actions/anamneses'
import { PatientForm } from '@/components/patients/PatientForm'
import { PatientDeleteDialog } from '@/components/patients/PatientDeleteDialog'
import { AnamnesisList } from '@/components/anamnesis/AnamnesisList'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface Props {
  params: Promise<{ id: string }>
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

  // CLINIC-08: fetch anamneses for the Anamneses tab (listAnamneses is RLS-aware)
  const anamnesisResult = await listAnamneses(patient.id)
  const anamnesisItems = anamnesisResult.anamneses ?? []

  // Mask CPF for receptionist/patient roles (SEC-01, T-2-10)
  const shouldMask = userRole === 'receptionist' || userRole === 'patient'
  const displayCpf = shouldMask
    ? `${patient.cpf.slice(0, 3)}.***.***-**`
    : patient.cpf

  const age = patient.date_of_birth
    ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()
    : null

  const isAdmin = userRole === 'admin' || userRole === 'superadmin'

  return (
    <div className="p-4">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/clinica" />}>
              Clínica
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/clinica/pacientes" />}>
              Pacientes
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{patient.full_name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Patient header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold leading-tight">
              {patient.full_name}
            </h1>
            {patient.is_anonymized && (
              <Badge variant="destructive">Anonimizado</Badge>
            )}
          </div>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            CPF: {displayCpf}
            {age !== null && ` · ${age} anos`}
          </p>
        </div>

        {/* Admin-only: anonymize (delete) button */}
        {isAdmin && !patient.is_anonymized && (
          <PatientDeleteDialog
            patientId={patient.id}
            patientName={patient.full_name}
          />
        )}
      </div>

      <Separator className="mb-6" />

      {/* Tab structure: Dados (02-02), Prontuário (02-03), Odontograma (02-04), Anamneses (02-05) */}
      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados do Paciente</TabsTrigger>
          <TabsTrigger value="prontuario">Prontuário</TabsTrigger>
          <TabsTrigger value="odontograma">Odontograma</TabsTrigger>
          <TabsTrigger value="anamneses">Anamneses</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-6">
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

        <TabsContent value="prontuario" className="mt-6">
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <p className="text-base font-semibold">Prontuário Clínico</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Acesse o prontuário completo para registrar atendimentos, histórico e gerar o PDF.
            </p>
            <Link
              href={`/clinica/pacientes/${patient.id}/prontuario`}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
            >
              Abrir Prontuário
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="odontograma" className="mt-6">
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <p className="text-base font-semibold">Odontograma</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Visualize e registre o estado dentário do paciente no odontograma SVG interativo.
            </p>
            <Link
              href={`/clinica/pacientes/${patient.id}/odontograma`}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
            >
              Abrir Odontograma
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="anamneses" className="mt-6">
          {/* CLINIC-08 (02-05): real anamneses list — stub removed */}
          <AnamnesisList patientId={patient.id} anamneses={anamnesisItems} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
