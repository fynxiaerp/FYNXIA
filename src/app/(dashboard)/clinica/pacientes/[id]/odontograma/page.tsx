import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { Odontogram } from '@/components/odontogram/Odontogram'

interface Props {
  params: Promise<{ id: string }>
}

export default async function OdontogramaPage({ params }: Props) {
  const { id } = await params

  const headersList = await headers()
  const userRole = headersList.get('x-user-role') ?? 'receptionist'

  // Fetch patient for breadcrumb + validation
  const supabase = await createClient()
  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name')
    .eq('id', id)
    .single()

  if (!patient) {
    notFound()
  }

  // Fetch dental records — most recent status per tooth derived client-side by mapDentalRecordsToToothStatus
  const { data: dentalRecords } = await supabase
    .from('dental_records')
    .select('id, tooth_number, status, created_at')
    .eq('patient_id', id)
    .order('created_at', { ascending: false })

  // D-15: admin and dentist can edit; receptionist/patient are read-only
  const editable = userRole === 'admin' || userRole === 'dentist'

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
            <BreadcrumbPage>Odontograma</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold leading-tight">Odontograma</h1>
        {!editable && (
          <span className="text-xs text-muted-foreground">Modo leitura</span>
        )}
      </div>

      <Separator />

      {/* Odontogram SVG container — editable flag controls D-15 gate */}
      <Odontogram
        records={dentalRecords ?? []}
        editable={editable}
        patientId={id}
      />
    </div>
  )
}
