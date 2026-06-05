'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Trash2 } from 'lucide-react'
import { anonymizePatient } from '@/actions/patients'

interface PatientDeleteDialogProps {
  patientId: string
  patientName: string
}

// UI-SPEC Destructive Actions:
// Dialog requires typing the patient's full name to enable the destructive button.
// This prevents accidental clicks.
// Focus MUST land on Cancel (safe action) button first (Accessibility Contract).
export function PatientDeleteDialog({
  patientId,
  patientName,
}: PatientDeleteDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isConfirmed = confirmName === patientName

  function handleOpenChange(value: boolean) {
    setOpen(value)
    if (!value) {
      setConfirmName('')
      setError(null)
    }
  }

  function handleAnonymize() {
    if (!isConfirmed) return
    setError(null)
    startTransition(async () => {
      const result = await anonymizePatient(patientId)
      if (result.success) {
        setOpen(false)
        router.push('/clinica/pacientes')
        router.refresh()
      } else {
        setError(result.error ?? 'Erro ao anonimizar paciente')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* DialogTrigger uses @base-ui/react render prop — render a styled Button */}
      <DialogTrigger
        render={
          <Button variant="destructive" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir paciente
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir Paciente</DialogTitle>
          <DialogDescription className="text-sm">
            Esta ação <strong>anonimiza</strong> os dados de identificação do paciente
            (LGPD). O histórico clínico e prontuários são{' '}
            <strong>preservados por obrigação legal</strong> (Lei 13.787/2018 — 20 anos).
            Esta ação é <strong>irreversível</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirm-name" className="font-semibold">
              Digite o nome completo do paciente para confirmar:
            </Label>
            <p className="font-mono text-sm text-muted-foreground">{patientName}</p>
            <Input
              id="confirm-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Digite o nome exato..."
              aria-label="Digite o nome completo do paciente para confirmar a anonimização"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {/* Focus lands on Cancel (safe action) first — Accessibility Contract */}
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            autoFocus
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!isConfirmed || isPending}
            onClick={handleAnonymize}
          >
            {isPending ? 'Anonimizando...' : 'Confirmar anonimização'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
