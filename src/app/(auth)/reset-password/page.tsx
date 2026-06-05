'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTransition } from 'react'
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validators/auth'
import { updatePassword } from '@/actions/auth'
import { Button } from '@/components/ui/button'

export default function ResetPasswordPage() {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  })

  function onSubmit(data: ResetPasswordInput) {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('password', data.password)
      const result = await updatePassword(formData)
      if (result?.error) {
        const msg =
          typeof result.error === 'string'
            ? result.error
            : 'Erro ao atualizar senha. Tente novamente.'
        setError('root', { message: msg })
      }
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary">FYNXIA</h1>
          <p className="mt-2 text-sm text-muted-foreground">Defina sua nova senha</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errors.root.message}
            </p>
          )}

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium">
              Nova senha
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
            {isPending ? 'Salvando…' : 'Salvar nova senha'}
          </Button>
        </form>
      </div>
    </div>
  )
}
