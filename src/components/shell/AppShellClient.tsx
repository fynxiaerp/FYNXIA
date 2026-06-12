'use client'

import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/hooks/useSidebarStore'

interface AppShellClientProps {
  sidebar: React.ReactNode
  children: React.ReactNode
}

export function AppShellClient({ sidebar, children }: AppShellClientProps) {
  const isCollapsed = useSidebarStore((state) => state.isCollapsed)

  return (
    <>
      {/* Sidebar — hidden on mobile, fixed-width on desktop */}
      <aside
        className={cn(
          'hidden md:flex flex-col fixed inset-y-0 left-0 z-30 transition-[width] duration-200',
          isCollapsed ? 'w-[56px]' : 'w-[240px]'
        )}
      >
        {sidebar}
      </aside>

      {/* Main content area — margin tracks sidebar width */}
      <div
        className={cn(
          'flex flex-col flex-1 min-w-0 transition-[margin] duration-200',
          'md:ml-[240px]',
          isCollapsed && 'md:ml-[56px]'
        )}
      >
        <main id="main-content" className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </>
  )
}
