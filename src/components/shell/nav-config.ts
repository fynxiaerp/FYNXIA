// nav-config.ts — Single source of truth for app navigation items.
// Consumed by AppSidebar (desktop) and MobileMenuTrigger (mobile drawer).
//
// IMPORTANT (RSC): `icon` is a STRING KEY, not a component. These items are built
// in Server Components (layout.tsx / AppSidebar) and passed as props to Client
// Components — and React Server Components CANNOT serialize functions/components
// across the server→client boundary. The client components map the key to a
// Lucide icon via NAV_ICONS (see nav-icons.tsx). Passing the component directly
// here caused a runtime "Server Components render" crash on /clinica.

export type NavIconKey =
  | 'agenda'
  | 'pacientes'
  | 'financeiro'
  | 'equipe'
  | 'ia'
  | 'prototipos'

export interface NavItemConfig {
  href: string
  label: string
  icon: NavIconKey
  /** If true, only visible to admin / superadmin roles */
  adminOnly?: boolean
}

/** Full nav item list (unfiltered). */
export const ALL_NAV_ITEMS: NavItemConfig[] = [
  { href: '/clinica/agenda',     label: 'Agenda',       icon: 'agenda' },
  { href: '/clinica/pacientes',  label: 'Pacientes',    icon: 'pacientes' },
  { href: '/clinica/financeiro', label: 'Financeiro',   icon: 'financeiro' },
  { href: '/clinica/equipe',     label: 'Equipe',       icon: 'equipe', adminOnly: true },
  { href: '/clinica/ia/agentes', label: 'IA / Agentes', icon: 'ia' },
  { href: '/clinica/prototipos', label: 'Protótipos',   icon: 'prototipos', adminOnly: true },
]

/**
 * Returns role-filtered nav items.
 * @param isAdmin Whether the current user has admin or superadmin role.
 */
export function buildNavItems(isAdmin: boolean): NavItemConfig[] {
  return ALL_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
}
