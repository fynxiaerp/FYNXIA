// loading.tsx — /clinica/pacientes
// Mimics PageHeader + table rows skeleton (06-UI-SPEC line 444).
import { PageHeaderSkeleton, TableRowsSkeleton } from '@/components/shell/skeletons'

export default function PacientesLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        <TableRowsSkeleton rows={5} columns={[0.4, 0.15, 0.15, 0.1, 0.2]} />
      </main>
    </>
  )
}
