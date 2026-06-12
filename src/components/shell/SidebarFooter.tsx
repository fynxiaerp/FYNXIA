'use client'

import { signOut } from '@/actions/auth'
import { ThemeToggle } from './ThemeToggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/hooks/useSidebarStore'

interface SidebarFooterProps {
  clinicName: string
  userEmail: string
}

function getInitials(email: string): string {
  const local = email.split('@')[0] ?? ''
  const parts = local.split('.')
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

export function SidebarFooter({ clinicName, userEmail }: SidebarFooterProps) {
  const isCollapsed = useSidebarStore((state) => state.isCollapsed)

  return (
    <div
      className={cn(
        'py-4 border-t border-sidebar-border px-2 flex flex-col gap-2',
        isCollapsed && 'items-center'
      )}
    >
      {!isCollapsed && (
        <div className="flex items-center gap-2 px-1">
          <Avatar size="sm">
            <AvatarFallback>{getInitials(userEmail)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate text-sidebar-foreground">
              {clinicName}
            </span>
            <span className="text-xs text-muted-foreground truncate">{userEmail}</span>
          </div>
        </div>
      )}

      {isCollapsed && (
        <Avatar size="sm">
          <AvatarFallback>{getInitials(userEmail)}</AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          'flex gap-1',
          isCollapsed ? 'flex-col items-center' : 'flex-row items-center px-1'
        )}
      >
        <ThemeToggle />
        <form action={signOut} className={cn(isCollapsed ? 'w-full flex justify-center' : '')}>
          <button
            type="submit"
            aria-label="Sair da conta"
            className={cn(
              'h-8 rounded-md hover:bg-sidebar-accent flex items-center justify-center transition-colors text-sm text-sidebar-foreground gap-2',
              isCollapsed ? 'w-8' : 'w-full px-2'
            )}
          >
            <LogOut className="size-4 shrink-0" />
            {!isCollapsed && <span>Sair</span>}
          </button>
        </form>
      </div>
    </div>
  )
}
