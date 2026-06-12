import Link from 'next/link'
import { Calendar, Users, Link2, FileText, DollarSign, MessageSquare, Plus, BotMessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shell/PageHeader'

// Hub — dashboard overview for the authenticated clinic user.
// Server Component. RLS-scoped server reads for quick stats.
export default async function ClinicaPage() {
  const supabase = await createClient()

  // Derive user and first name
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: me } = user
    ? await supabase.from('users').select('role, full_name').eq('id', user.id).single()
    : { data: null }

  const firstName = me?.full_name?.split(' ')[0] ?? 'Doutor'

  // Time-based greeting
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  // Quick stats — RLS automatically scopes to tenant
  const today = new Date().toISOString().slice(0, 10)

  const [{ count: consultasHoje }, { count: pacientesAtivos }, { count: recebiveis }] =
    await Promise.all([
      supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('date', today),
      supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null),
      supabase
        .from('receivables')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente'),
    ])

  const { data: clinic } = await supabase
    .from('clinics')
    .select('name, slug')
    .single()

  const statCards = [
    { label: 'Consultas hoje', value: consultasHoje ?? 0 },
    { label: 'Pacientes ativos', value: pacientesAtivos ?? 0 },
    { label: 'Recebíveis em aberto', value: recebiveis ?? 0 },
  ]

  const shortcuts = [
    {
      href: '/clinica/agenda',
      label: 'Nova Consulta',
      icon: Calendar,
    },
    {
      href: '/clinica/pacientes/novo',
      label: 'Novo Paciente',
      icon: Users,
    },
    {
      href: '/clinica/financeiro/nova-cobranca',
      label: 'Emitir Cobrança',
      icon: DollarSign,
    },
    {
      href: '/clinica',
      label: 'Abrir Copiloto',
      icon: BotMessageSquare,
    },
  ]

  return (
    <>
      <PageHeader title="Início" />

      <div className="p-6 max-w-5xl mx-auto w-full space-y-8">
        {/* Greeting */}
        <h2 className="text-2xl font-semibold font-display">
          {greeting}, {firstName}
        </h2>

        {/* Quick stat cards */}
        <section aria-label="Resumo do dia">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="rounded-lg border border-border bg-card p-4 flex flex-col gap-1"
              >
                <span className="text-sm text-muted-foreground">{card.label}</span>
                <span className="text-2xl font-semibold tabular-nums">{card.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Shortcut grid */}
        <section aria-label="Ações rápidas">
          <h3 className="text-xl font-semibold font-display mb-3">Ações rápidas</h3>
          <div className="grid grid-cols-2 gap-4">
            {shortcuts.map((s) => {
              const Icon = s.icon
              return (
                <Link
                  key={s.href + s.label}
                  href={s.href}
                  className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm font-semibold group-hover:text-primary transition-colors">
                    {s.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

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
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              <FileText className="size-3.5" />
              /agendar/{clinic.slug}
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
