'use client'
/**
 * LabForm — Cadastro / edição de laboratório fornecedor (LAB-01)
 *
 * RHF + zodResolver(labSchema). Zod v3 — sem .default() (D-133).
 * Props:
 *   id        — quando fornecido, chama updateLab (modo edição)
 *   initial   — valores iniciais para edição
 *   onSuccess — callback após sucesso
 *
 * Campos: nome (obrigatório), cnpj, contato_nome, telefone, email, notes.
 * shadcn Alert para erro/sucesso (pt-BR).
 * @base-ui Button render-prop, NUNCA asChild.
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 07
 * Requirements: LAB-01
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { labSchema, type LabInput } from '@/lib/validators/lab-order'
import { createLab, updateLab } from '@/actions/lab-orders'

// ─── Props ────────────────────────────────────────────────────────────────────

interface LabFormProps {
  id?: string
  initial?: Partial<LabInput>
  onSuccess?: (labId?: string) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LabForm({ id, initial, onSuccess }: LabFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LabInput>({
    resolver: zodResolver(labSchema),
    defaultValues: {
      nome: initial?.nome ?? '',
      cnpj: initial?.cnpj ?? '',
      contato_nome: initial?.contato_nome ?? '',
      telefone: initial?.telefone ?? '',
      email: initial?.email ?? '',
      notes: initial?.notes ?? '',
    },
  })

  async function onSubmit(data: LabInput) {
    setServerError(null)
    setSuccessMessage(null)

    const input: LabInput = {
      ...data,
      cnpj: data.cnpj || undefined,
      contato_nome: data.contato_nome || undefined,
      telefone: data.telefone || undefined,
      email: data.email || undefined,
      notes: data.notes || undefined,
    }

    let result: { success: boolean; id?: string; error?: string }

    if (id) {
      result = await updateLab(id, input)
    } else {
      result = await createLab(input)
    }

    if (!result.success) {
      setServerError(result.error ?? 'Erro ao salvar laboratório.')
      return
    }

    setSuccessMessage(id ? 'Laboratório atualizado com sucesso.' : 'Laboratório cadastrado com sucesso.')

    if (!id) {
      reset({
        nome: '',
        cnpj: '',
        contato_nome: '',
        telefone: '',
        email: '',
        notes: '',
      })
    }

    onSuccess?.(result.id)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Nome */}
      <div className="space-y-1.5">
        <Label htmlFor="lab-nome">Nome do Laboratório *</Label>
        <Input
          id="lab-nome"
          placeholder="Ex.: Lab Prótese Central"
          className="bg-background border-border text-foreground"
          {...register('nome')}
        />
        {errors.nome && (
          <p className="text-xs text-destructive">{errors.nome.message}</p>
        )}
      </div>

      {/* CNPJ + Contato */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="lab-cnpj">CNPJ</Label>
          <Input
            id="lab-cnpj"
            placeholder="00.000.000/0001-00"
            className="bg-background border-border text-foreground"
            {...register('cnpj')}
          />
          {errors.cnpj && (
            <p className="text-xs text-destructive">{errors.cnpj.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lab-contato">Contato</Label>
          <Input
            id="lab-contato"
            placeholder="Nome do responsável"
            className="bg-background border-border text-foreground"
            {...register('contato_nome')}
          />
          {errors.contato_nome && (
            <p className="text-xs text-destructive">{errors.contato_nome.message}</p>
          )}
        </div>
      </div>

      {/* Telefone + Email */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="lab-telefone">Telefone</Label>
          <Input
            id="lab-telefone"
            placeholder="(11) 99999-9999"
            type="tel"
            className="bg-background border-border text-foreground"
            {...register('telefone')}
          />
          {errors.telefone && (
            <p className="text-xs text-destructive">{errors.telefone.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lab-email">E-mail</Label>
          <Input
            id="lab-email"
            placeholder="lab@exemplo.com"
            type="email"
            className="bg-background border-border text-foreground"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      {/* Observações */}
      <div className="space-y-1.5">
        <Label htmlFor="lab-notes">Observações</Label>
        <Textarea
          id="lab-notes"
          placeholder="Especialidades, condições de entrega, etc. (opcional)"
          rows={3}
          className="bg-background border-border text-foreground resize-y"
          {...register('notes')}
        />
        {errors.notes && (
          <p className="text-xs text-destructive">{errors.notes.message}</p>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? id ? 'Salvando...' : 'Cadastrando...'
          : id ? 'Salvar Alterações' : 'Cadastrar Laboratório'}
      </Button>
    </form>
  )
}
