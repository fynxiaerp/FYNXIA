'use client'
import { useTransition, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { acceptInvitationSchema, type AcceptInvitationInput } from '@/lib/validators/invitation'
import { acceptInvitation } from '@/actions/invitations'
import { Button } from '@/components/ui/button'

interface InviteAcceptFormProps {
  token: string
  email: string
  clinicName: string
  role: string
}

export default function InviteAcceptForm({
  token,
  email,
}: InviteAcceptFormProps) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInvitationInput>({
    resolver: zodResolver(acceptInvitationSchema),
  })

  function onSubmit(data: AcceptInvitationInput) {
    setServerError(null)
    startTransition(async () => {
      const result = await acceptInvitation(token, data.password)
      if (!result.success) {
        setServerError(result.error ?? 'Erro ao aceitar convite')
      }
      // On success, acceptInvitation calls redirect() — component unmounts
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
          {serverError}
        </p>
      )}

      {/* Email is read-only — comes from the invitation row (T-01-17) */}
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-semibold">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          value={email}
          readOnly
          disabled
          className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-semibold">
          Defina sua senha
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isPending}>
        {isPending ? 'Ativando conta…' : 'Ativar conta'}
      </Button>
    </form>
  )
}
