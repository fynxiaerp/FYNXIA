// nav-config.ts — Single source of truth for app navigation items.
// Consumed by AppSidebar (desktop) and MobileMenuTrigger (mobile drawer).
// Import type NavItem from SidebarNavClient to keep a single interface definition.
import { Calendar, Users, UserCog, DollarSign, BrainCircuit, type LucideIcon } from 'lucide-react'

export interface NavItemConfig {
  href: string
  label: string
  icon: LucideIcon
  /** If true, only visible to admin / superadmin roles */
  adminOnly?: boolean
}

/** Full nav item list (unfiltered). */
export const ALL_NAV_ITEMS: NavItemConfig[] = [
  { href: '/clinica/agenda',     label: 'Agenda',      icon: Calendar },
  { href: '/clinica/pacientes',  label: 'Pacientes',   icon: Users },
  { href: '/clinica/financeiro', label: 'Financeiro',  icon: DollarSign },
  { href: '/clinica/equipe',     label: 'Equipe',      icon: UserCog, adminOnly: true },
  { href: '/clinica/ia/agentes', label: 'IA / Agentes', icon: BrainCircuit },
]

/**
 * Returns role-filtered nav items.
 * @param isAdmin Whether the current user has admin or superadmin role.
 */
export function buildNavItems(isAdmin: boolean): NavItemConfig[] {
  return ALL_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
}
