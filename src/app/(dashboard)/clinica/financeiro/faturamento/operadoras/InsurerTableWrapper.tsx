'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { InsurerTable, type InsurerRow } from '@/components/financeiro/InsurerTable'
import { InsurerFormDialog } from '@/components/financeiro/InsurerFormDialog'

interface InsurerTableWrapperProps {
  insurers: InsurerRow[]
  canWrite: boolean
  showTrigger?: boolean
}

export function InsurerTableWrapper({ insurers, canWrite, showTrigger }: InsurerTableWrapperProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingInsurer, setEditingInsurer] = React.useState<InsurerRow | null>(null)

  function handleEdit(ins: InsurerRow) {
    setEditingInsurer(ins)
    setDialogOpen(true)
  }

  function handleNew() {
    setEditingInsurer(null)
    setDialogOpen(true)
  }

  if (showTrigger) {
    return (
      <>
        <Button onClick={handleNew}>
          <Plus className="size-4" />
          Cadastrar Operadora
        </Button>
        <InsurerFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          insurer={editingInsurer}
        />
      </>
    )
  }

  return (
    <>
      <InsurerTable insurers={insurers} onEdit={handleEdit} canWrite={canWrite} />
      <InsurerFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        insurer={editingInsurer}
      />
    </>
  )
}
