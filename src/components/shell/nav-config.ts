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
  | 'documentos'
  | 'equipe'
  | 'profissionais'
  | 'recursos'
  | 'ia'
  | 'prototipos'
  | 'receituario'
  | 'teleodontologia'
  | 'esterilizacao'
  | 'protese'
  | 'estoque'
  | 'crc'
  | 'relatorios'
  | 'orcamento'
  | 'societario'
  | 'bi'

export interface NavItemConfig {
  href: string
  label: string
  icon: NavIconKey
  /** If true, only visible to admin / superadmin roles */
  adminOnly?: boolean
  /**
   * Explicit role allowlist — overrides adminOnly when present. Use for modules
   * where a non-admin role (e.g. socio) has real access per proxy.ts's
   * MODULE_PERMISSIONS (e.g. D-14: socio has full access to orcamento) so the nav
   * link isn't hidden from a role that can otherwise navigate there directly by URL.
   */
  visibleTo?: string[]
}

/** Full nav item list (unfiltered). */
export const ALL_NAV_ITEMS: NavItemConfig[] = [
  { href: '/clinica/agenda',      label: 'Agenda',       icon: 'agenda' },
  { href: '/clinica/pacientes',   label: 'Pacientes',    icon: 'pacientes' },
  { href: '/clinica/financeiro',  label: 'Financeiro',   icon: 'financeiro' },
  { href: '/clinica/documentos',       label: 'Documentos',      icon: 'documentos' },
  { href: '/clinica/receituario',      label: 'Receituário',     icon: 'receituario' },
  { href: '/clinica/teleodontologia',  label: 'Teleodontologia', icon: 'teleodontologia' },
  { href: '/clinica/esterilizacao',    label: 'Esterilização',   icon: 'esterilizacao' },
  { href: '/clinica/protese',          label: 'Prótese (Lab)',   icon: 'protese' },
  { href: '/clinica/estoque',          label: 'Estoque',         icon: 'estoque' },
  { href: '/clinica/crc',              label: 'CRC & Marketing', icon: 'crc' },
  { href: '/clinica/relatorios',       label: 'Relatórios',      icon: 'relatorios',     adminOnly: true, visibleTo: ['admin', 'superadmin', 'socio'] },
  { href: '/clinica/orcamento',        label: 'Orçamento',       icon: 'orcamento',      adminOnly: true, visibleTo: ['admin', 'superadmin', 'socio'] },
  { href: '/clinica/societario',       label: 'Societário',      icon: 'societario',     adminOnly: true, visibleTo: ['admin', 'superadmin', 'socio'] },
  { href: '/bi',                       label: 'BI',              icon: 'bi',             adminOnly: true, visibleTo: ['admin', 'superadmin', 'socio'] },
  { href: '/clinica/equipe',           label: 'Equipe',          icon: 'equipe',         adminOnly: true },
  { href: '/clinica/profissionais',  label: 'Profissionais',  icon: 'profissionais',  adminOnly: true },
  { href: '/clinica/recursos',       label: 'Recursos',       icon: 'recursos',       adminOnly: true },
  { href: '/clinica/ia/agentes',     label: 'IA / Agentes',   icon: 'ia' },
  { href: '/clinica/prototipos',  label: 'Protótipos',   icon: 'prototipos', adminOnly: true },
]

/**
 * Returns role-filtered nav items.
 * @param isAdminOrRole Either `isAdmin` (legacy boolean — treated as admin/no-access)
 *   or the caller's actual role string, which also honors each item's `visibleTo`
 *   allowlist for non-admin roles like socio.
 */
export function buildNavItems(isAdminOrRole: boolean | string): NavItemConfig[] {
  const role = typeof isAdminOrRole === 'string' ? isAdminOrRole : isAdminOrRole ? 'admin' : ''
  const isAdmin = role === 'admin' || role === 'superadmin'
  return ALL_NAV_ITEMS.filter((item) => {
    if (!item.adminOnly) return true
    if (isAdmin) return true
    return item.visibleTo?.includes(role) ?? false
  })
}
