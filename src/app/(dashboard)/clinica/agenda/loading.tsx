// loading.tsx — /clinica/agenda
// Mimics PageHeader + FullCalendar week grid skeleton (06-UI-SPEC line 443).
import { PageHeaderSkeleton, CalendarGridSkeleton } from '@/components/shell/skeletons'

export default function AgendaLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <main className="p-0">
        <CalendarGridSkeleton />
      </main>
    </>
  )
}
