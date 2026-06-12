import { PageHeaderSkeleton } from '@/components/shell/skeletons'
import { CardGridSkeleton } from '@/components/shell/skeletons'

// Hub loading skeleton — 3 quick-stat cards (CardGridSkeleton count=3).
export default function ClinicaLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="p-6 max-w-5xl mx-auto w-full space-y-8">
        {/* Greeting placeholder */}
        <div aria-busy="true" aria-label="Carregando…" className="h-8 w-64 rounded-md bg-muted animate-pulse" />

        {/* Quick stat cards */}
        <CardGridSkeleton count={3} columns={3} />

        {/* Shortcut grid placeholder */}
        <CardGridSkeleton count={4} columns={2} />
      </div>
    </>
  )
}
