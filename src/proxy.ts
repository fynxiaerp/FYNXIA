import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request)

  const pathname = request.nextUrl.pathname

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password')

  // Only specific API routes are public — health check and webhook endpoints
  // (webhooks authenticate via HMAC signature, not session cookies)
  const isPublicApiRoute =
    pathname === '/api/health' ||
    pathname.startsWith('/api/webhooks/')

  // Unauthenticated user accessing a protected route → redirect to login
  if (!user && !isAuthRoute && !isPublicApiRoute) {
    // For non-browser API requests return 401 instead of a redirect
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

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
