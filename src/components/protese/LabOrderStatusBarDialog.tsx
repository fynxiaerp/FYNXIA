'use client'
/**
 * LabOrderStatusBarDialog — Dialog wrapper for LabOrderStatusBar.
 * Client Component so open/close state lives on the client.
 * The RSC page passes the serializable order shape as props.
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 07
 */

import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { LabOrderStatusBar, type LabOrderForStatusBar } from '@/components/protese/LabOrderStatusBar'

interface LabOrderStatusBarDialogProps {
  order: LabOrderForStatusBar
}

export function LabOrderStatusBarDialog({ order }: LabOrderStatusBarDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Settings2 className="size-3.5" />
            Gerenciar
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar OS</DialogTitle>
        </DialogHeader>
        <LabOrderStatusBar
          order={order}
          onUpdate={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
