'use client'
/**
 * CycleFormDialog — Dialog wrapper for CycleForm.
 * Client Component so the open/close state lives on the client.
 * The RSC page (esterilizacao/page.tsx) passes autoclaves as serializable props.
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 06
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
import { CycleForm, type AutoclaveOption } from '@/components/esterilizacao/CycleForm'

interface CycleFormDialogProps {
  autoclaves: AutoclaveOption[]
}

export function CycleFormDialog({ autoclaves }: CycleFormDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Registrar Ciclo
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Ciclo de Esterilização</DialogTitle>
        </DialogHeader>
        <CycleForm
          autoclaves={autoclaves}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
