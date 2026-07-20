// src/app/(dashboard)/clinica/layout.tsx
// App shell: persistent sidebar (AppSidebar) + margin-tracking content area + CopilotTrigger.
// AppSidebar is a Server Component (reads role + clinic); AppShellClient owns collapse state.
// CopilotTrigger stays as a position:fixed floating island — independent of the sidebar.
// MobileMenuTrigger is built server-side here so role gating stays in Server Component territory.

import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/shell/AppSidebar'
import { AppShellClient } from '@/components/shell/AppShellClient'
import { CopilotTrigger } from '@/components/copilot/CopilotTrigger'
import { MobileMenuTrigger } from '@/components/shell/MobileMenuTrigger'
import { buildNavItems } from '@/components/shell/nav-config'

export default async function ClinicaLayout({ children }: { children: React.ReactNode }) {
  // Read role server-side for mobile nav role gating (same logic as AppSidebar).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = user
    ? await supabase.from('users').select('role').eq('id', user.id).single()
    : { data: null }
  const mobileNavItems = buildNavItems(me?.role ?? 'receptionist')

  return (
    <div className="flex h-screen overflow-hidden">
      <AppShellClient
        sidebar={<AppSidebar />}
        mobileHeader={<MobileMenuTrigger items={mobileNavItems} />}
      >
        {children}
      </AppShellClient>
      <CopilotTrigger />
    </div>
  )
}
