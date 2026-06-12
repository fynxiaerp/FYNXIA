// loading.tsx — /clinica/ia/agentes
// Mimics PageHeader + 5 agent log row skeletons (06-UI-SPEC line 450).
import { PageHeaderSkeleton, TableRowsSkeleton } from '@/components/shell/skeletons'

export default function AgentesLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <main className="p-6 max-w-4xl mx-auto w-full space-y-6">
        <TableRowsSkeleton rows={5} columns={[0.2, 0.2, 0.35, 0.25]} />
      </main>
    </>
  )
}
