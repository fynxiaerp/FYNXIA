// AppSidebar — persistent left sidebar Server Component.
// Reads role + clinic server-side; renders logo chip, role-gated nav, SidebarFooter.
// SidebarFooter contains ThemeToggle + Sair (sign-out) button.
import Image from 'next/image'
import { Calendar, Users, UserCog, DollarSign, BrainCircuit } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SidebarNavClient, type NavItem } from './SidebarNavClient'
import { SidebarFooter } from './SidebarFooter'
// ThemeToggle is rendered inside SidebarFooter (imported there)
import { SidebarCollapseButton } from './SidebarCollapseButton'

export async function AppSidebar() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: me } = user
    ? await supabase.from('users').select('role, email').eq('id', user.id).single()
    : { data: null }

  const role = me?.role ?? 'receptionist'
  const userEmail = me?.email ?? user?.email ?? ''

  const { data: clinic } = await supabase.from('clinics').select('name').single()
  const clinicName = clinic?.name ?? 'Minha Clínica'

  const isAdmin = role === 'admin' || role === 'superadmin'

  const navItems: NavItem[] = [
    { href: '/clinica/agenda', label: 'Agenda', icon: Calendar },
    { href: '/clinica/pacientes', label: 'Pacientes', icon: Users },
    { href: '/clinica/financeiro', label: 'Financeiro', icon: DollarSign },
    ...(isAdmin ? [{ href: '/clinica/equipe', label: 'Equipe', icon: UserCog }] : []),
    { href: '/clinica/ia/agentes', label: 'IA / Agentes', icon: BrainCircuit },
  ]

  return (
    <aside className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
        <div className="rounded-xl overflow-hidden bg-[hsl(240_20%_8%)] flex items-center gap-2 px-3 py-1.5">
          <Image
            src="/fynxia-logo.png"
            alt="FYNXIA"
            width={28}
            height={28}
            className="rounded-lg"
          />
          <SidebarWordmark />
        </div>
        <SidebarCollapseButton />
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNavClient items={navItems} />
      </div>

      {/* Footer: ThemeToggle + Sair */}
      <SidebarFooter clinicName={clinicName} userEmail={userEmail} />
    </aside>
  )
}

// Client component to hide wordmark when collapsed
function SidebarWordmark() {
  // Rendered server-side; collapse hides it via the outer aside width change.
  // The wordmark text is always rendered but the container clips it when collapsed.
  return (
    <span className="text-white font-display font-bold text-sm tracking-tight whitespace-nowrap">
      Fynxia
    </span>
  )
}
