'use client'

// LeadStageChangeDialog — intercept dialog for the two terminal transitions
// (CRC-01, D-04). Convertido: link to an existing patient OR create a new one
// (patients.cpf is NOT NULL — createLead never collects a CPF, so convertLead's
// `opts` requires either an existing patientId or a cpf to auto-create one,
// per leads.ts's documented Rule-2 addition). Perdido: optional reason + note,
// folded into the single `lostReason` string param (moveLeadStage's 3-arg
// contract has no separate note field).
//
// Controlled component: `pending` drives visibility (Dialog open={!!pending}).
// onCancel() rolls back the caller's optimistic kanban move. onConfirmed() is
// invoked ONLY on a successful server call — the caller finalizes/clears state.

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { convertLead, moveLeadStage } from '@/actions/leads'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import type { LeadStage } from '@/lib/validators/crc'

interface PatientOption {
  id: string
  full_name: string
  cpf: string
}

export type PendingStageChange = {
  leadId: string
  leadName: string
  fromStage: LeadStage
  toStage: 'convertido' | 'perdido'
}

const LOST_REASONS = [
  { value: 'sem_resposta', label: 'Sem resposta' },
  { value: 'nao_tem_interesse', label: 'Não tem interesse' },
  { value: 'preco', label: 'Preço' },
  { value: 'outro', label: 'Outro' },
]

interface LeadStageChangeDialogProps {
  pending: PendingStageChange | null
  patients: PatientOption[]
  onCancel: () => void
  onConfirmed: () => void
}

export function LeadStageChangeDialog({
  pending,
  patients,
  onCancel,
  onConfirmed,
}: LeadStageChangeDialogProps) {
  const [patientMode, setPatientMode] = useState<'existing' | 'new'>('existing')
  const [patientId, setPatientId] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [cpf, setCpf] = useState('')
  const [lostReason, setLostReason] = useState('')
  const [lostNote, setLostNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset local form state whenever a new pending change is requested.
  useEffect(() => {
    setPatientMode('existing')
    setPatientId('')
    setPatientSearch('')
    setCpf('')
    setLostReason('')
    setLostNote('')
    setError(null)
  }, [pending?.leadId, pending?.toStage])

  const filteredPatients = patients.filter((p) => {
    if (!patientSearch) return true
    const q = patientSearch.toLowerCase()
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.cpf.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    )
  })

  function handleCpfBlur(value: string) {
    const digits = value.replace(/\D/g, '')
    if (digits.length === 11) {
      setCpf(`${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`)
    }
  }

  async function handleConfirm() {
    if (!pending) return
    setError(null)

    if (pending.toStage === 'convertido') {
      if (patientMode === 'existing' && !patientId) {
        setError('Selecione um paciente vinculado.')
        return
      }
      if (patientMode === 'new' && !cpf.trim()) {
        setError('Informe o CPF para cadastrar o novo paciente.')
        return
      }
    }

    setSubmitting(true)

    const result =
      pending.toStage === 'convertido'
        ? await convertLead(
            pending.leadId,
            patientMode === 'existing' ? { patientId } : { cpf: cpf.trim() }
          )
        : await moveLeadStage(
            pending.leadId,
            'perdido',
            [LOST_REASONS.find((r) => r.value === lostReason)?.label, lostNote.trim() || null]
              .filter(Boolean)
              .join(' — ') || undefined
          )

    setSubmitting(false)

    if (result.success) {
      onConfirmed()
    } else {
      setError(result.error ?? 'Erro ao processar a mudança de estágio.')
    }
  }

  return (
    <Dialog open={!!pending} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent className="sm:max-w-md bg-background text-foreground">
        {pending && (
          <>
            <DialogHeader>
              <DialogTitle>
                {pending.toStage === 'convertido' ? 'Converter Lead' : 'Marcar como Perdido'}
              </DialogTitle>
              <DialogDescription>
                {pending.toStage === 'convertido'
                  ? `Vincular a paciente existente ou criar novo? ("${pending.leadName}")`
                  : `Informe o motivo (opcional) da perda de "${pending.leadName}".`}
              </DialogDescription>
            </DialogHeader>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {pending.toStage === 'convertido' ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={patientMode === 'existing' ? 'default' : 'outline'}
                    onClick={() => setPatientMode('existing')}
                  >
                    Paciente Existente
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={patientMode === 'new' ? 'default' : 'outline'}
                    onClick={() => setPatientMode('new')}
                  >
                    Criar Novo Paciente
                  </Button>
                </div>

                {patientMode === 'existing' ? (
                  <div className="space-y-2">
                    <Label>Paciente</Label>
                    <Input
                      placeholder="Buscar por nome ou CPF..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                    />
                    <Select value={patientId} onValueChange={(v) => setPatientId(v ?? '')}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o paciente">
                          {patientId
                            ? filteredPatients.find((p) => p.id === patientId)?.full_name
                            : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {filteredPatients.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            Paciente não encontrado.
                          </div>
                        ) : (
                          filteredPatients.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name} — {p.cpf}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="new-patient-cpf">CPF do novo paciente *</Label>
                    <Input
                      id="new-patient-cpf"
                      placeholder="000.000.000-00"
                      className="font-mono"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      onBlur={(e) => handleCpfBlur(e.target.value)}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Motivo (opcional)</Label>
                  <Select value={lostReason} onValueChange={(v) => setLostReason(v ?? '')}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um motivo">
                        {LOST_REASONS.find((r) => r.value === lostReason)?.label}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LOST_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lost-note">Observação (opcional)</Label>
                  <Textarea
                    id="lost-note"
                    placeholder="Detalhes adicionais sobre a perda..."
                    value={lostNote}
                    onChange={(e) => setLostNote(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Confirmar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
