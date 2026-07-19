'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNewAppointmentStore } from '@/lib/stores/new-appointment-store'

// Functional replacement for the previously decorative "Nova Consulta" header
// button — opens the AgendaCalendar creation dialog via the trigger store.
export function NewAppointmentButton() {
  const openDialog = useNewAppointmentStore((s) => s.openDialog)

  return (
    <Button size="sm" onClick={openDialog}>
      <Plus className="size-4" />
      Nova Consulta
    </Button>
  )
}
