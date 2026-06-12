'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTransition } from 'react'
import Link from 'next/link'
import { signupSchema, type SignupInput } from '@/lib/validators/auth'
import { signUpClinic } from '@/actions/auth'
import { Button } from '@/components/ui/button'

export function SignupForm() {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  })

  function onSubmit(data: SignupInput) {
    startTransition(async () => {
      const formData = new FormData()
      Object.entries(data).forEach(([key, value]) => formData.append(key, value))
      const result = await signUpClinic(formData)
      if (result?.error) {
        const msg = typeof result.error === 'string'
          ? result.error
          : 'Erro ao criar conta. Verifique os dados e tente novamente.'
        setError('root', { message: msg })
      }
    })
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold font-display tracking-tight text-primary">FYNXIA</h1>
        <p className="mt-2 text-sm text-muted-foreground">Crie a conta da sua clínica</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-8 shadow-md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errors.root.message}
            </p>
          )}

          <div className="space-y-1">
            <label htmlFor="clinicName" className="block text-sm font-semibold">
              Nome da Clínica
            </label>
            <input
              id="clinicName"
              type="text"
              autoComplete="organization"
              placeholder="Ex: Clínica Odonto São Paulo"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('clinicName')}
            />
            {errors.clinicName && (
              <p className="text-xs text-destructive">{errors.clinicName.message}</p>
            )}
          </div>

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
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="document" className="block text-sm font-semibold">
              CNPJ ou CPF
            </label>
            <input
              id="document"
              type="text"
              autoComplete="off"
              placeholder="00.000.000/0001-00 ou 000.000.000-00"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('document')}
            />
            {errors.document && (
              <p className="text-xs text-destructive">{errors.document.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="phone" className="block text-sm font-semibold">
              Telefone
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(11) 99999-1234"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('phone')}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={isPending}>
            {isPending ? 'Criando conta…' : 'Criar conta'}
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
