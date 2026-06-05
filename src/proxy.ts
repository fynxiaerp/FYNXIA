import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createClient } from '@/lib/supabase/server'

// ─── Role → allowed path prefixes (D-07) ────────────────────────────────────
export const ROLE_ROUTES: Record<string, string[]> = {
  admin:        ['/clinica', '/perfil', '/config', '/superadmin'],
  dentist:      ['/clinica', '/perfil'],
  receptionist: ['/clinica', '/perfil'],
  patient:      ['/paciente', '/perfil'],
  superadmin:   ['/clinica', '/perfil', '/config', '/superadmin', '/paciente'],
}

/**
 * Pure helper — determines whether a role may access a given pathname.
 * Exported so it can be unit-tested without spinning up a full request.
 */
export function isPathAllowed(role: string, pathname: string): boolean {
  const allowedPrefixes = ROLE_ROUTES[role] ?? ['/paciente']
  return allowedPrefixes.some(prefix => pathname.startsWith(prefix))
}

export async function proxy(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request)

  const pathname = request.nextUrl.pathname

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')

  // Public routes that bypass all auth and role checks (Pitfall 5)
  const isPublicRoute =
    pathname.startsWith('/invite') ||
    pathname.startsWith('/agendar')

  // Auth confirm is a public token-exchange route — must NOT require a session (Pitfall 5)
  const isAuthCallbackRoute = pathname.startsWith('/auth/confirm')

  // Only specific API routes are public — health check and webhook endpoints
  const isPublicApiRoute =
    pathname === '/api/health' ||
    pathname.startsWith('/api/webhooks/')

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
    // Single DB call — read role directly from public.users (Anti-Pattern: don't use RPC)
    // createClient() uses the user's JWT cookie context so RLS applies correctly
    const supabase = await createClient()
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

    // Forward role + user ID into REQUEST headers so Server Components can read
    // them via headers().get('x-user-role') without making another DB call.
    // CRITICAL: Use request headers (not supabaseResponse.headers) — response
    // headers are NOT readable by Server Components via next/headers.
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-role', role)
    requestHeaders.set('x-user-id', user.id)
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
