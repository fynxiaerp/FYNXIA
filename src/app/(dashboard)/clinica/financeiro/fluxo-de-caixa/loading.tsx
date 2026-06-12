// loading.tsx — /clinica/financeiro/fluxo-de-caixa
// Mimics PageHeader + 3 totals cards + 6 transaction row skeletons (06-UI-SPEC line 447).
import {
  PageHeaderSkeleton,
  TotalsCardsSkeleton,
  TableRowsSkeleton,
} from '@/components/shell/skeletons'

export default function FluxoDeCaixaLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        <TotalsCardsSkeleton />
        <TableRowsSkeleton rows={6} columns={[0.25, 0.35, 0.2, 0.2]} />
      </main>
    </>
  )
}
