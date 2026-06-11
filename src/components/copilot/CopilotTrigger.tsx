'use client'
// src/components/copilot/CopilotTrigger.tsx
// Floating action button that opens/closes the copilot sidebar.
// Mounted in clinica/layout.tsx — appears on every /clinica/* page.
// Position: fixed bottom-right (does not reflow page content).

import { Bot, X } from 'lucide-react'
import { useCopilotStore } from '@/lib/stores/copilot-store'
import { CopilotSidebar } from './CopilotSidebar'

export function CopilotTrigger() {
  const { open, toggle } = useCopilotStore()

  return (
    <>
      {/* Sidebar rendered here so it is always mounted with the trigger */}
      <CopilotSidebar />

      {/* Fixed floating trigger button */}
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Fechar copiloto' : 'Abrir copiloto'}
        aria-expanded={open}
        className={[
          'fixed z-40 flex items-center justify-center',
          'h-12 w-12 min-h-[44px] min-w-[44px]',
          'rounded-full bg-primary shadow-lg',
          'transition-transform hover:scale-105 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          // Mobile: bottom-4 right-4 / Desktop: bottom-6 right-6
          'bottom-4 right-4 sm:bottom-6 sm:right-6',
        ].join(' ')}
      >
        {open ? (
          <X size={20} className="text-primary-foreground" aria-hidden="true" />
        ) : (
          <Bot size={20} className="text-primary-foreground" aria-hidden="true" />
        )}
      </button>
    </>
  )
}
