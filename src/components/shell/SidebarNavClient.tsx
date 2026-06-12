'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSidebarStore } from '@/hooks/useSidebarStore'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

interface SidebarNavClientProps {
  items: NavItem[]
}

export function SidebarNavClient({ items }: SidebarNavClientProps) {
  const pathname = usePathname()
  const isCollapsed = useSidebarStore((state) => state.isCollapsed)

  return (
    <TooltipProvider>
      <nav aria-label="Navegação principal" className="flex flex-col gap-1 px-2">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon

          if (isCollapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  render={
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={item.label}
                      className={cn(
                        'flex items-center justify-center rounded-md transition-colors h-10 w-full',
                        isActive
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" />
                    </Link>
                  }
                />
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md transition-colors h-10 px-3',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="size-[18px] shrink-0" />
              <span className="text-sm font-semibold truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </TooltipProvider>
  )
}
