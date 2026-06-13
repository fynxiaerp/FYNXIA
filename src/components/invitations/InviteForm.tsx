'use client'
import { useTransition, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createInviteSchema,
  type CreateInviteInput,
} from '@/lib/validators/invitation'
import { createInvitation } from '@/actions/invitations'
import { Button } from '@/components/ui/button'

export function InviteForm({ onSuccess }: { onSuccess?: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
    setError,
  } = useForm<CreateInviteInput>({
    resolver: zodResolver(createInviteSchema),
    defaultValues: {
      mode: 'email',
      role: 'receptionist',
    },
  })

  const mode = watch('mode')

  function onSubmit(data: CreateInviteInput) {
    setSuccessMsg(null)
    startTransition(async () => {
      const result = await createInvitation(data)
      if (!result.success) {
        setError('root', {
          message: result.error ?? 'Erro ao criar convite',
        })
        return
      }
      setSuccessMsg(
        data.mode === 'email'
          ? `Convite enviado para ${data.email}`
          : `Usuário ${data.email} criado com sucesso`
      )
      reset()
      onSuccess?.()
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Root error */}
      {errors.root && (
        <p className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      {/* Success message */}
      {successMsg && (
        <p className="rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          {successMsg}
        </p>
      )}

      {/* Mode selector */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold">
          Método de adição
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="email"
              {...register('mode')}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm text-foreground">Convite por e-mail</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="direct"
              {...register('mode')}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm text-foreground">Criação direta</span>
          </label>
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1">
        <label htmlFor="invite-email" className="block text-sm font-semibold">
          E-mail
        </label>
        <input
          id="invite-email"
          type="email"
          autoComplete="off"
          placeholder="colaborador@clinica.com"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* Role */}
      <div className="space-y-1">
        <label htmlFor="invite-role" className="block text-sm font-semibold">
          Perfil
        </label>
        <select
          id="invite-role"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          {...register('role')}
        >
          <option value="admin">Administrador</option>
          <option value="dentist">Dentista</option>
          <option value="receptionist">Recepcionista</option>
          <option value="patient">Paciente</option>
        </select>
        {errors.role && (
          <p className="text-xs text-destructive">{errors.role.message}</p>
        )}
      </div>

      {/* Temporary password — shown only for direct mode */}
      {mode === 'direct' && (
        <div className="space-y-1">
          <label
            htmlFor="invite-temp-password"
            className="block text-sm font-semibold"
          >
            Senha temporária
          </label>
          <input
            id="invite-temp-password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            {...register('tempPassword')}
          />
          {errors.tempPassword && (
            <p className="text-xs text-destructive">{errors.tempPassword.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            O colaborador deverá alterar a senha no primeiro acesso.
          </p>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending
          ? 'Processando…'
          : mode === 'email'
            ? 'Enviar convite'
            : 'Criar usuário'}
      </Button>
    </form>
  )
}
