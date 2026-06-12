'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validators/auth'
import { sendPasswordReset } from '@/actions/auth'
import { Button } from '@/components/ui/button'

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  function onSubmit(data: ForgotPasswordInput) {
    startTransition(async () => {
      const result = await sendPasswordReset(data.email)
      if (result?.error) {
        setError('root', { message: result.error })
      } else {
        setSuccess(true)
      }
    })
  }

  if (success) {
    return (
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold font-display tracking-tight text-primary">FYNXIA</h1>
        </div>
        <div className="bg-card rounded-xl border border-border p-8 shadow-md">
          <div className="rounded-md bg-green-100 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
            <p className="font-semibold">E-mail enviado!</p>
            <p className="mt-1">
              Verifique sua caixa de entrada e clique no link de recuperação de senha.
            </p>
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold font-display tracking-tight text-primary">FYNXIA</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Informe seu e-mail para receber o link de recuperação de senha
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-8 shadow-md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errors.root.message}
            </p>
          )}

          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-semibold">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="admin@clinica.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={isPending}>
            {isPending ? 'Enviando…' : 'Enviar link de recuperação'}
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Lembrou a senha?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  )
}
