'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useSidebarStore } from '@/hooks/useSidebarStore'

export function SidebarCollapseButton() {
  const { isCollapsed, toggle } = useSidebarStore()

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!isCollapsed}
      aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
      className="h-8 w-8 rounded-md hover:bg-sidebar-accent flex items-center justify-center transition-colors text-sidebar-foreground shrink-0"
    >
      {isCollapsed ? (
        <PanelLeftOpen className="size-4" />
      ) : (
        <PanelLeftClose className="size-4" />
      )}
    </button>
  )
}
