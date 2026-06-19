'use client'
/**
 * LabOrderFormDialog — Dialog wrapper for LabOrderForm.
 * Client Component so the open/close state lives on the client.
 * The RSC page (protese/page.tsx) passes serializable labs/patients/appointments as props.
 *
 * @base-ui Button render-prop, NUNCA asChild.
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 07
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { LabOrderForm, type LabOption, type PatientOption, type AppointmentOption } from '@/components/protese/LabOrderForm'

interface LabOrderFormDialogProps {
  labs: LabOption[]
  patients: PatientOption[]
  appointments?: AppointmentOption[]
}

export function LabOrderFormDialog({ labs, patients, appointments = [] }: LabOrderFormDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Abrir OS
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Abrir Ordem de Serviço Protética</DialogTitle>
        </DialogHeader>
        <LabOrderForm
          labs={labs}
          patients={patients}
          appointments={appointments}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
