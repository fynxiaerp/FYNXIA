// src/app/(dashboard)/clinica/layout.tsx
// App shell: persistent sidebar (AppSidebar) + margin-tracking content area + CopilotTrigger.
// AppSidebar is a Server Component (reads role + clinic); AppShellClient owns collapse state.
// CopilotTrigger stays as a position:fixed floating island — independent of the sidebar.
// Outer flex h-screen overflow-hidden matches 06-UI-SPEC line 561.

import { AppSidebar } from '@/components/shell/AppSidebar'
import { AppShellClient } from '@/components/shell/AppShellClient'
import { CopilotTrigger } from '@/components/copilot/CopilotTrigger'

export default async function ClinicaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppShellClient sidebar={<AppSidebar />}>
        {children}
      </AppShellClient>
      <CopilotTrigger />
    </div>
  )
}
