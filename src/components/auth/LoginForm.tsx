'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTransition } from 'react'
import Link from 'next/link'
import { loginSchema, type LoginInput } from '@/lib/validators/auth'
import { signIn } from '@/actions/auth'
import { Button } from '@/components/ui/button'

export function LoginForm() {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  function onSubmit(data: LoginInput) {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('email', data.email)
      formData.append('password', data.password)
      const result = await signIn(formData)
      if (result?.error) {
        setError('root', { message: 'E-mail ou senha inválidos.' })
      }
    })
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold font-display tracking-tight text-primary">FYNXIA</h1>
        <p className="mt-2 text-sm text-muted-foreground">Entre na sua conta</p>
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

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-semibold">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Sua senha"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground hover:text-primary hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={isPending}>
            {isPending ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Não tem uma conta?{' '}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
