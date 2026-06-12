'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useState, useEffect } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="h-8 w-8 rounded-md hover:bg-sidebar-accent flex items-center justify-center transition-colors" />
    )
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      className="h-8 w-8 rounded-md hover:bg-sidebar-accent flex items-center justify-center transition-colors"
    >
      {isDark ? (
        <Sun className="size-4 text-sidebar-foreground" />
      ) : (
        <Moon className="size-4 text-sidebar-foreground" />
      )}
    </button>
  )
}
