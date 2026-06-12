// loading.tsx — /clinica/financeiro/contas-a-receber
// Mimics PageHeader + filter bar + 5 table row skeletons (06-UI-SPEC line 448).
import {
  PageHeaderSkeleton,
  FilterBarSkeleton,
  TableRowsSkeleton,
} from '@/components/shell/skeletons'

export default function ContasAReceberLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        <FilterBarSkeleton />
        <TableRowsSkeleton rows={5} columns={[0.3, 0.2, 0.15, 0.15, 0.2]} />
      </main>
    </>
  )
}
