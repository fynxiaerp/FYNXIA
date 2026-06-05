import Link from 'next/link'
import { PatientForm } from '@/components/patients/PatientForm'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export default function NovoPacientePage() {
  return (
    <div className="p-4">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            {/* BreadcrumbLink uses @base-ui/react render prop pattern — no asChild */}
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
            <BreadcrumbPage>Novo Paciente</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="mb-6 text-xl font-semibold leading-tight">
        Cadastrar Novo Paciente
      </h1>

      <div className="max-w-2xl">
        <PatientForm mode="create" />
      </div>
    </div>
  )
}
