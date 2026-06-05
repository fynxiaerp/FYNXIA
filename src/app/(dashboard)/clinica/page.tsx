import Link from 'next/link'
import { Calendar, Users, UserCog, Link2, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/actions/auth'
import { Button } from '@/components/ui/button'

// Dashboard home — navigation hub for the clinic.
// Links to the features delivered through Phase 2 (agenda, patients, team).
export default async function ClinicaPage() {
  const supabase = await createClient()

  // WR-03: derive role from a fresh authenticated lookup — not the forwardable header.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: me } = user
    ? await supabase.from('users').select('role').eq('id', user.id).single()
    : { data: null }
  const role = me?.role ?? 'receptionist'

  const { data: clinic } = await supabase
    .from('clinics')
    .select('name, plan, slug')
    .single()
  // RLS automatically scopes to the user's tenant

  const isAdmin = role === 'admin' || role === 'superadmin'

  const navItems = [
    {
      href: '/clinica/agenda',
      title: 'Agenda',
      description: 'Agenda semanal por dentista, agendar e remarcar consultas.',
      icon: Calendar,
      show: true,
    },
    {
      href: '/clinica/pacientes',
      title: 'Pacientes',
      description: 'Cadastro, prontuário, odontograma e anamneses.',
      icon: Users,
      show: true,
    },
    {
      href: '/clinica/equipe',
      title: 'Equipe',
      description: 'Convidar e gerenciar dentistas e recepcionistas.',
      icon: UserCog,
      show: isAdmin,
    },
  ].filter((item) => item.show)

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              FYNXIA
            </p>
            <h1 className="text-2xl font-bold">{clinic?.name ?? 'Minha Clínica'}</h1>
            <p className="text-sm text-muted-foreground capitalize">
              Perfil: {role} · Plano: {clinic?.plan ?? 'free'}
            </p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Sair
            </Button>
          </form>
        </div>

        {/* Feature navigation */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="size-6 text-primary" />
                <div>
                  <h2 className="text-base font-semibold group-hover:text-primary">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Public booking link */}
        {clinic?.slug && (
          <div className="rounded-lg border border-dashed border-border bg-card p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Link2 className="size-4 text-primary" />
              Link de agendamento público
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Compartilhe com pacientes para que agendem sem login:
            </p>
            <Link
              href={`/agendar/${clinic.slug}`}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <FileText className="size-3.5" />
              /agendar/{clinic.slug}
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
