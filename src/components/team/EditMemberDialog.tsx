'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateTeamMemberName } from '@/actions/team'

interface EditMemberDialogProps {
  userId: string
  currentName: string
}

// Escopo estrito: edição de full_name APENAS.
export function EditMemberDialog({ userId, currentName }: EditMemberDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleOpenChange(value: boolean) {
    setOpen(value)
    if (value) {
      setName(currentName)
      setError(null)
    }
  }

  async function handleSave() {
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await updateTeamMemberName(userId, name)
      if (result.success) {
        setOpen(false)
        router.refresh()
      } else {
        setError(result.error ?? 'Erro ao salvar')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* DialogTrigger uses @base-ui/react render prop — render a styled Button */}
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Editar
          </Button>
        }
      />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar membro</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label htmlFor="member-name" className="text-sm font-medium">
              Nome completo
            </label>
            <Input
              id="member-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
            />
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
