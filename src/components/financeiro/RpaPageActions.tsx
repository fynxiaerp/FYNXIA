'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { RpaFormDialog } from './RpaFormDialog'

interface SupplierOption {
  id: string
  name: string
  iss_retido_fonte?: boolean
}

interface RpaPageActionsProps {
  suppliers: SupplierOption[]
  unitId?: string
  defaultSupplierId?: string
  defaultCompetencia?: string
}

// Client wrapper that owns the RpaFormDialog open state.
// RSC page stays a pure Server Component; open/close state lives here (mirrors CycleFormDialog pattern).
export function RpaPageActions({
  suppliers,
  unitId,
  defaultSupplierId,
  defaultCompetencia,
}: RpaPageActionsProps) {
  const [open, setOpen] = React.useState(false)

  // Auto-open when navigated from Repasse "Gerar RPA" (supplier pre-filled)
  React.useEffect(() => {
    if (defaultSupplierId) setOpen(true)
  }, [defaultSupplierId])

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Emitir RPA
      </Button>
      <RpaFormDialog
        open={open}
        onOpenChange={setOpen}
        suppliers={suppliers}
        unitId={unitId}
        defaultSupplierId={defaultSupplierId}
        defaultCompetencia={defaultCompetencia}
      />
    </>
  )
}
