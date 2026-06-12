// loading.tsx — /clinica/equipe
// Mimics PageHeader + 3 table row skeletons (06-UI-SPEC line 449).
import { PageHeaderSkeleton, TableRowsSkeleton } from '@/components/shell/skeletons'

export default function EquipeLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <main className="p-6 max-w-4xl mx-auto w-full space-y-6">
        <TableRowsSkeleton rows={3} columns={[0.35, 0.2, 0.2, 0.25]} />
      </main>
    </>
  )
}
