'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { insurerSchema, type InsurerInput } from '@/lib/validators/insurer'
import { createInsurer, updateInsurer } from '@/actions/insurers'
import type { InsurerRow } from './InsurerTable'

interface InsurerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  insurer?: InsurerRow | null
}

// D-133: No Zod .default() — RHF defaultValues provides defaults
const DEFAULT_VALUES: InsurerInput = {
  name: '',
  cnpj: '',
  registroAns: '',
  tissVersion: '3.05.00',
  prazoPagamentoDias: 30,
  contatoEmail: '',
  contatoPhone: '',
  connectorId: null,
  status: 'ativo',
}

export function InsurerFormDialog({ open, onOpenChange, insurer }: InsurerFormDialogProps) {
  const isEdit = Boolean(insurer)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InsurerInput>({
    resolver: zodResolver(insurerSchema),
    defaultValues: DEFAULT_VALUES,
  })

  // Populate form when editing
  React.useEffect(() => {
    if (open) {
      if (insurer) {
        reset({
          name: insurer.name,
          cnpj: insurer.cnpj ?? '',
          registroAns: insurer.registro_ans ?? '',
          tissVersion: insurer.tiss_version,
          prazoPagamentoDias: insurer.prazo_pagamento_dias,
          contatoEmail: '',
          contatoPhone: '',
          connectorId: null,
          status: insurer.status as InsurerInput['status'],
        })
      } else {
        reset(DEFAULT_VALUES)
      }
    }
  }, [open, insurer, reset])

  const statusValue = watch('status')

  async function onSubmit(data: InsurerInput) {
    const result = isEdit && insurer
      ? await updateInsurer(insurer.id, data)
      : await createInsurer(data)

    if (result.success) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Operadora' : 'Nova Operadora'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="insurer-name">Nome *</Label>
            <Input
              id="insurer-name"
              {...register('name')}
              placeholder="Ex: Unimed Nacional"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* CNPJ */}
          <div className="space-y-1.5">
            <Label htmlFor="insurer-cnpj">CNPJ</Label>
            <Input
              id="insurer-cnpj"
              {...register('cnpj')}
              placeholder="00.000.000/0000-00"
              maxLength={18}
            />
            {errors.cnpj && (
              <p className="text-xs text-destructive">{errors.cnpj.message}</p>
            )}
          </div>

          {/* Registro ANS */}
          <div className="space-y-1.5">
            <Label htmlFor="insurer-ans">Registro ANS</Label>
            <Input
              id="insurer-ans"
              {...register('registroAns')}
              placeholder="000000"
              maxLength={20}
            />
            {errors.registroAns && (
              <p className="text-xs text-destructive">{errors.registroAns.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Versão TISS */}
            <div className="space-y-1.5">
              <Label htmlFor="insurer-tiss">Versão TISS *</Label>
              <Input
                id="insurer-tiss"
                {...register('tissVersion')}
                placeholder="3.05.00"
              />
              {errors.tissVersion && (
                <p className="text-xs text-destructive">{errors.tissVersion.message}</p>
              )}
            </div>

            {/* Prazo pagamento */}
            <div className="space-y-1.5">
              <Label htmlFor="insurer-prazo">Prazo (dias) *</Label>
              <Input
                id="insurer-prazo"
                type="number"
                min={0}
                {...register('prazoPagamentoDias', { valueAsNumber: true })}
                placeholder="30"
              />
              {errors.prazoPagamentoDias && (
                <p className="text-xs text-destructive">{errors.prazoPagamentoDias.message}</p>
              )}
            </div>
          </div>

          {/* Contato e-mail */}
          <div className="space-y-1.5">
            <Label htmlFor="insurer-email">E-mail de contato</Label>
            <Input
              id="insurer-email"
              type="email"
              {...register('contatoEmail')}
              placeholder="faturamento@operadora.com.br"
            />
            {errors.contatoEmail && (
              <p className="text-xs text-destructive">{errors.contatoEmail.message}</p>
            )}
          </div>

          {/* Contato telefone */}
          <div className="space-y-1.5">
            <Label htmlFor="insurer-phone">Telefone de contato</Label>
            <Input
              id="insurer-phone"
              {...register('contatoPhone')}
              placeholder="(11) 0000-0000"
              maxLength={20}
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="insurer-status">Status *</Label>
            <Select
              value={statusValue}
              onValueChange={(v) => setValue('status', v as InsurerInput['status'])}
            >
              <SelectTrigger id="insurer-status">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="em_negociacao">Em negociação</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && (
              <p className="text-xs text-destructive">{errors.status.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
