import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/actions/auth'
import { Button } from '@/components/ui/button'

export default async function ClinicaPage() {
  // Role already resolved by proxy.ts — no additional DB call needed
  const headersList = await headers()
  const role = headersList.get('x-user-role') ?? 'receptionist'

  const supabase = await createClient()
  const { data: clinic } = await supabase
    .from('clinics')
    .select('name, plan')
    .single()
  // RLS automatically scopes to the user's tenant

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              FYNXIA
            </p>
            <h1 className="text-2xl font-bold">
              {clinic?.name ?? 'Minha Clínica'}
            </h1>
            <p className="text-sm text-muted-foreground capitalize">
              Perfil: {role}
            </p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Sair
            </Button>
          </form>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Bem-vindo ao FYNXIA</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Plano: {clinic?.plan ?? 'free'}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            O painel completo está sendo construído. Em breve você terá acesso à agenda,
            prontuários e financeiro.
          </p>
        </div>
      </div>
    </main>
  )
}
