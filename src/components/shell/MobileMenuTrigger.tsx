'use client'

// MobileMenuTrigger — client hamburger button that opens a left-side Sheet drawer.
// Visible only at md:hidden (< 768px). Used inside PageHeader mobileMenuTrigger slot.
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { NavItemConfig } from './nav-config'
import { NAV_ICONS } from './nav-icons'

// Re-exported for callers that previously imported MobileNavItem from here.
export type MobileNavItem = NavItemConfig

interface MobileMenuTriggerProps {
  items: NavItemConfig[]
}

export function MobileMenuTrigger({ items }: MobileMenuTriggerProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* Hamburger button */}
      <button
        type="button"
        aria-label="Abrir menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center justify-center rounded-md h-8 w-8 text-foreground hover:bg-muted transition-colors"
      >
        <Menu className="size-5" />
      </button>

      {/* Left-side Sheet drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[240px] p-0 flex flex-col">
          <SheetHeader className="h-16 px-4 flex-row items-center border-b border-border shrink-0">
            <SheetTitle className="text-sm font-semibold font-display">Menu</SheetTitle>
          </SheetHeader>

          {/* Nav links */}
          <nav
            aria-label="Navegação principal"
            className="flex-1 overflow-y-auto py-4 px-2 flex flex-col gap-1"
          >
            {items.map((item) => {
              const isActive = pathname.startsWith(item.href)
              const Icon = NAV_ICONS[item.icon]
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-md transition-colors h-10 px-3 text-sm font-semibold',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
