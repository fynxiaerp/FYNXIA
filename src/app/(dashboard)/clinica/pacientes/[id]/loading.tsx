// loading.tsx — /clinica/pacientes/[id]
// Mimics PageHeader + patient header + tab skeletons + content skeleton (06-UI-SPEC line 445).
import { PageHeaderSkeleton } from '@/components/shell/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

export default function PatientDetailLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="p-4 space-y-4" aria-busy="true" aria-label="Carregando…">
        {/* Patient sub-header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-px w-full" />

        {/* Tab list skeleton */}
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-32 rounded-md" />
          ))}
        </div>

        {/* Tab content skeleton */}
        <div className="space-y-3 p-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </>
  )
}
