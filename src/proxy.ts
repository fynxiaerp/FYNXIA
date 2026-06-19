import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// ─── Role × Module access matrix (Phase 7 / RESEARCH Pattern 3) ─────────────

export const NETWORK_ROLES = ['admin', 'superadmin', 'socio', 'auditor', 'dpo', 'ti'] as const
export const OPERATIONAL_ROLES = ['dentist', 'receptionist', 'aluno'] as const
export const READ_ONLY_ROLES = ['auditor', 'dpo', 'socio'] as const

export type AppRole =
  | 'admin' | 'superadmin' | 'dentist' | 'receptionist' | 'patient'
  | 'dpo' | 'auditor' | 'socio' | 'ti' | 'implantacao' | 'aluno'

type ModuleKey = 'clinica' | 'config' | 'superadmin' | 'paciente' | 'financeiro' | 'ia' | 'bi' | 'documentos' | 'integracoes' | 'conformidade' | 'receituario' | 'teleodontologia' | 'esterilizacao' | 'protese'

interface ModuleAccess {
  allowed: boolean
  readOnly?: boolean
}

export const MODULE_PERMISSIONS: Record<AppRole, Partial<Record<ModuleKey, ModuleAccess>>> = {
  superadmin:   { clinica: {allowed:true}, config: {allowed:true}, superadmin: {allowed:true}, paciente: {allowed:true}, financeiro: {allowed:true}, ia: {allowed:true}, bi: {allowed:true}, documentos: {allowed:true}, integracoes: {allowed:true}, conformidade: {allowed:true}, receituario: {allowed:true}, teleodontologia: {allowed:true}, esterilizacao: {allowed:true}, protese: {allowed:true} },
  admin:        { clinica: {allowed:true}, config: {allowed:true}, superadmin: {allowed:true}, financeiro: {allowed:true}, ia: {allowed:true}, bi: {allowed:true}, documentos: {allowed:true}, integracoes: {allowed:true}, conformidade: {allowed:true}, receituario: {allowed:true}, teleodontologia: {allowed:true}, esterilizacao: {allowed:true}, protese: {allowed:true} },
  dentist:      { clinica: {allowed:true}, documentos: {allowed:true}, receituario: {allowed:true}, teleodontologia: {allowed:true}, esterilizacao: {allowed:true}, protese: {allowed:true} },
  receptionist: { clinica: {allowed:true}, esterilizacao: {allowed:true} },
  patient:      { paciente: {allowed:true} },
  dpo:          { clinica: {allowed:true, readOnly:true}, config: {allowed:true, readOnly:true}, bi: {allowed:true, readOnly:true}, documentos: {allowed:true, readOnly:true}, integracoes: {allowed:true, readOnly:true}, conformidade: {allowed:true, readOnly:true}, receituario: {allowed:true, readOnly:true}, teleodontologia: {allowed:true, readOnly:true}, esterilizacao: {allowed:true, readOnly:true}, protese: {allowed:true, readOnly:true} },
  auditor:      { clinica: {allowed:true, readOnly:true}, financeiro: {allowed:true, readOnly:true}, bi: {allowed:true, readOnly:true}, documentos: {allowed:true, readOnly:true}, integracoes: {allowed:true, readOnly:true}, conformidade: {allowed:true, readOnly:true}, receituario: {allowed:true, readOnly:true}, teleodontologia: {allowed:true, readOnly:true}, esterilizacao: {allowed:true, readOnly:true}, protese: {allowed:true, readOnly:true} },
  socio:        { financeiro: {allowed:true, readOnly:true}, bi: {allowed:true, readOnly:true}, config: {allowed:true, readOnly:true}, documentos: {allowed:true, readOnly:true}, integracoes: {allowed:true, readOnly:true}, receituario: {allowed:true, readOnly:true}, teleodontologia: {allowed:true, readOnly:true}, esterilizacao: {allowed:true, readOnly:true}, protese: {allowed:true, readOnly:true} },
  ti:           { config: {allowed:true}, ia: {allowed:true}, integracoes: {allowed:true} },
  implantacao:  { clinica: {allowed:true}, config: {allowed:true, readOnly:true} },
  aluno:        { clinica: {allowed:true} },
}

// Route → module: most-specific prefix checked FIRST (documentos/financeiro before clinica).
// /clinica/documentos → 'documentos'; /clinica/financeiro → 'financeiro'; /clinica/... → 'clinica'; etc.
const ROUTE_MODULE_MAP: Array<{ prefix: string; module: ModuleKey }> = [
  { prefix: '/clinica/documentos',     module: 'documentos'     },
  { prefix: '/clinica/financeiro',     module: 'financeiro'     },
  { prefix: '/clinica/receituario',    module: 'receituario'    }, // most-specific-first (Pitfall 6)
  { prefix: '/clinica/teleodontologia', module: 'teleodontologia' }, // most-specific-first (Pitfall 6)
  { prefix: '/clinica/esterilizacao',  module: 'esterilizacao'  }, // most-specific-first (Pitfall 6)
  { prefix: '/clinica/protese',        module: 'protese'        }, // most-specific-first (Pitfall 6)
  { prefix: '/clinica',                module: 'clinica'        },
  { prefix: '/config/integracoes', module: 'integracoes' },
  { prefix: '/config',             module: 'config'     },
  { prefix: '/superadmin',         module: 'superadmin' },
  { prefix: '/paciente',           module: 'paciente'   },
  { prefix: '/bi',                 module: 'bi'         },
  { prefix: '/ia',                 module: 'ia'         },
  { prefix: '/conformidade',       module: 'conformidade' },
]

function routeToModule(pathname: string): ModuleKey | null {
  for (const { prefix, module } of ROUTE_MODULE_MAP) {
    if (pathname === prefix || pathname.startsWith(prefix + '/') || pathname === prefix) {
      return module
    }
  }
  return null
}

/**
 * Returns true if the role is permitted to access the given pathname.
 * /perfil is universally allowed (own profile, every authenticated role).
 * Unknown roles fall back to patient-level access (/paciente only).
 */
export function isPathAllowed(role: string, pathname: string): boolean {
  if (pathname.startsWith('/perfil')) return true
  const module = routeToModule(pathname)
  if (!module) return false
  const permissions = MODULE_PERMISSIONS[role as AppRole]
  // Unknown role defaults to patient-level: only /paciente is accessible
  if (!permissions) return module === 'paciente'
  return permissions[module]?.allowed === true
}

/**
 * Returns true if the role is read-only for the module resolved from pathname.
 * Most-specific module wins (e.g. /clinica/financeiro → financeiro module).
 */
export function isReadOnly(role: string, pathname: string): boolean {
  const module = routeToModule(pathname)
  if (!module) return false
  const permissions = MODULE_PERMISSIONS[role as AppRole]
  if (!permissions) return false
  return permissions[module]?.readOnly === true
}

// ─── ROLE_ROUTES — derived from MODULE_PERMISSIONS for backward compat ────────
// Old tests assert on ROLE_ROUTES shape: patient → ['/paciente', '/perfil'],
// superadmin → contains '/clinica','/perfil','/config','/superadmin','/paciente', etc.
// We derive it from the matrix so there is a single source of truth.

function deriveRoleRoutes(): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const [role, modules] of Object.entries(MODULE_PERMISSIONS)) {
    const paths: string[] = []
    for (const [mod, access] of Object.entries(modules)) {
      if (access?.allowed) {
        // Map module key back to its primary route prefix
        // Note: 'financeiro' module is a sub-route of /clinica; we expose /clinica here
        // because the ROLE_ROUTES compat layer is path-prefix-based, not module-based.
        // The actual sub-route /clinica/financeiro is handled by routeToModule().
        if (mod === 'financeiro' || mod === 'documentos' || mod === 'receituario' || mod === 'teleodontologia' || mod === 'esterilizacao' || mod === 'protese') {
          // financeiro/documentos/receituario/teleodontologia/esterilizacao/protese live under /clinica —
          // expose /clinica for ROLE_ROUTES compat
          // (actual sub-route gating is handled by routeToModule via ROUTE_MODULE_MAP)
          if (!paths.includes('/clinica')) paths.push('/clinica')
        } else {
          paths.push(`/${mod}`)
        }
      }
    }
    // /perfil is universal for all roles except roles with no modules at all
    if (paths.length > 0) {
      paths.push('/perfil')
    }
    result[role] = paths
  }
  return result
}

const _derivedRoleRoutes = deriveRoleRoutes()

// The old rbac.test.ts checks exact equality of patient routes: ['/paciente', '/perfil']
// and containment for others. The derived routes match these contracts.
export const ROLE_ROUTES: Record<string, string[]> = _derivedRoleRoutes

export async function proxy(request: NextRequest) {
  const { user, supabaseResponse, supabase } = await updateSession(request)

  const pathname = request.nextUrl.pathname

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')

  // Public routes that bypass all auth and role checks (Pitfall 5)
  // /anamnese: public token-based anamnesis flow (CLINIC-08 — no session required)
  // /painel: public TV waiting-room display (tenant-isolated by slug, initials-only — LGPD)
  const isPublicRoute =
    pathname.startsWith('/invite') ||
    pathname.startsWith('/agendar') ||
    pathname.startsWith('/anamnese') ||
    pathname.startsWith('/painel')

  // Auth confirm is a public token-exchange route — must NOT require a session (Pitfall 5)
  const isAuthCallbackRoute = pathname.startsWith('/auth/confirm')

  // Only specific API routes are public — health check, webhooks, patient self-register (D-10)
  const isPublicApiRoute =
    pathname === '/api/health' ||
    pathname.startsWith('/api/webhooks/') ||
    pathname === '/api/invitations'  // public patient self-registration endpoint

  // Unauthenticated user accessing a protected route → redirect to login
  if (!user && !isAuthRoute && !isPublicApiRoute && !isPublicRoute && !isAuthCallbackRoute) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Authenticated user accessing auth pages → redirect to dashboard
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/clinica', request.url))
  }

  // For authenticated users on protected routes: enforce RBAC (D-06/D-07/D-08)
  if (user && !isAuthRoute && !isPublicApiRoute && !isPublicRoute && !isAuthCallbackRoute) {
    // Single DB call — read role directly from public.users (Anti-Pattern: don't use RPC).
    // Use the request-scoped client from updateSession — the server-component
    // createClient() (next/headers cookies()) is INVALID inside middleware and throws.
    const { data: roleRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = roleRow?.role ?? 'patient'

    if (!isPathAllowed(role, pathname)) {
      // Redirect to role-appropriate home (D-07)
      const home = role === 'patient' ? '/paciente' : '/clinica'
      return NextResponse.redirect(new URL(home, request.url))
    }

    // Forward role + user ID + read-only flag into REQUEST headers so Server Components
    // can read them via headers().get('x-user-role') without making another DB call.
    // x-read-only: 'true' when the role is read-only on this specific module (ROLE-02).
    // CRITICAL: Use request headers (not supabaseResponse.headers) — response
    // headers are NOT readable by Server Components via next/headers.
    const readOnly = isReadOnly(role, pathname)
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-role', role)
    requestHeaders.set('x-user-id', user.id)
    requestHeaders.set('x-read-only', readOnly ? 'true' : 'false')
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
