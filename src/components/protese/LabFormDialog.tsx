'use client'
/**
 * LabFormDialog — Dialog wrapper for LabForm (cadastrar laboratório).
 * Client Component so open/close state lives on the client.
 * RSC page passes no props — LabForm manages its own state.
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
import { LabForm } from '@/components/protese/LabForm'

export function LabFormDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Cadastrar Laboratório
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar Laboratório Fornecedor</DialogTitle>
        </DialogHeader>
        <LabForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
